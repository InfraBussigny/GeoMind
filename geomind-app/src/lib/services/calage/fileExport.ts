/**
 * File Export Service for Georeferenced Data
 * Supports: GeoJSON, World File, PNG with georef, DXF (vectorized)
 * Server-side exports: Shapefile, GeoPackage (require backend)
 */

import type { CalibrationPoint, TransformResult, ImportedFile } from '$lib/stores/calageStore';
import { applyHelmert, applyAffine, type HelmertParams, type AffineParams } from './transformation';

// ============================================
// TYPES
// ============================================

export interface ExportOptions {
  format: 'geojson' | 'worldfile' | 'geotiff' | 'shapefile' | 'geopackage' | 'dxf';
  filename: string;
  crs: string;  // e.g., 'EPSG:2056'
  includeMetadata?: boolean;
  metadata?: {
    source?: string;
    date?: string;
    operator?: string;
    rms?: number;
    transformType?: string;
  };
}

export interface WorldFileParams {
  pixelSizeX: number;   // A - pixel size in X direction
  rotationY: number;    // D - rotation about Y axis (usually 0)
  rotationX: number;    // B - rotation about X axis (usually 0)
  pixelSizeY: number;   // E - pixel size in Y direction (usually negative)
  upperLeftX: number;   // C - X coordinate of upper-left corner center
  upperLeftY: number;   // F - Y coordinate of upper-left corner center
}

// ============================================
// WORLD FILE GENERATION
// ============================================

export function generateWorldFile(
  transform: TransformResult,
  imageWidth: number,
  imageHeight: number
): WorldFileParams {
  // Extract transformation parameters
  const scale = transform.scale || 1;
  const rotation = (transform.rotation || 0) * Math.PI / 180;
  const tx = transform.tx || 0;
  const ty = transform.ty || 0;

  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);

  // World file parameters
  // A: pixel size in X direction (with rotation)
  // B: rotation about Y axis
  // C: rotation about X axis
  // D: pixel size in Y direction (with rotation, usually negative)
  // E: X coordinate of center of upper-left pixel
  // F: Y coordinate of center of upper-left pixel

  const A = scale * cosR;    // pixelSizeX with rotation
  const D = scale * sinR;    // rotationY
  const B = -scale * sinR;   // rotationX
  const E = -scale * cosR;   // pixelSizeY with rotation (negative)

  // Upper-left corner (pixel 0,0 center)
  const C = tx + 0.5 * A + 0.5 * B;
  const F = ty + 0.5 * D + 0.5 * E;

  return {
    pixelSizeX: A,
    rotationY: D,
    rotationX: B,
    pixelSizeY: E,
    upperLeftX: C,
    upperLeftY: F
  };
}

export function worldFileToString(params: WorldFileParams): string {
  return [
    params.pixelSizeX.toFixed(10),
    params.rotationY.toFixed(10),
    params.rotationX.toFixed(10),
    params.pixelSizeY.toFixed(10),
    params.upperLeftX.toFixed(6),
    params.upperLeftY.toFixed(6)
  ].join('\n');
}

export function getWorldFileExtension(imageExtension: string): string {
  const ext = imageExtension.toLowerCase();
  switch (ext) {
    case 'png': return 'pgw';
    case 'jpg':
    case 'jpeg': return 'jgw';
    case 'tif':
    case 'tiff': return 'tfw';
    case 'bmp': return 'bpw';
    case 'gif': return 'gfw';
    default: return 'wld';
  }
}

// ============================================
// GEOJSON EXPORT
// ============================================

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  name?: string;
  crs?: {
    type: string;
    properties: { name: string };
  };
  features: GeoJSONFeature[];
}

export interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
}

export function exportCalibrationPointsToGeoJSON(
  points: CalibrationPoint[],
  crs: string = 'EPSG:2056',
  metadata?: Record<string, any>
): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = points
    .filter(p => p.worldX !== undefined && p.worldY !== undefined)
    .map((point, index) => ({
      type: 'Feature' as const,
      properties: {
        id: point.id,
        label: point.label || `P${index + 1}`,
        imageX: point.imageX,
        imageY: point.imageY,
        ...metadata
      },
      geometry: {
        type: 'Point',
        coordinates: [point.worldX, point.worldY]
      }
    }));

  return {
    type: 'FeatureCollection',
    name: 'calibration_points',
    crs: {
      type: 'name',
      properties: { name: `urn:ogc:def:crs:${crs.replace(':', '::')}` }
    },
    features
  };
}

export function exportImageBoundsToGeoJSON(
  transform: TransformResult,
  imageWidth: number,
  imageHeight: number,
  filename: string,
  crs: string = 'EPSG:2056'
): GeoJSONFeatureCollection {
  // Transform image corners to world coordinates
  const corners = [
    { x: 0, y: 0 },                           // Top-left
    { x: imageWidth, y: 0 },                  // Top-right
    { x: imageWidth, y: imageHeight },        // Bottom-right
    { x: 0, y: imageHeight },                 // Bottom-left
    { x: 0, y: 0 }                            // Close polygon
  ];

  const worldCorners = corners.map(corner => {
    if (transform.type === 'helmert') {
      const params: HelmertParams = {
        tx: transform.tx!,
        ty: transform.ty!,
        scale: transform.scale!,
        rotation: transform.rotation!
      };
      const result = applyHelmert(params, corner.x, corner.y);
      return [result.worldX, result.worldY];
    } else {
      const params: AffineParams = {
        a: transform.a!,
        b: transform.b!,
        c: transform.c!,
        d: transform.d!,
        e: transform.e!,
        f: transform.f!
      };
      const result = applyAffine(params, corner.x, corner.y);
      return [result.worldX, result.worldY];
    }
  });

  return {
    type: 'FeatureCollection',
    name: 'image_bounds',
    crs: {
      type: 'name',
      properties: { name: `urn:ogc:def:crs:${crs.replace(':', '::')}` }
    },
    features: [{
      type: 'Feature',
      properties: {
        filename: filename,
        width: imageWidth,
        height: imageHeight,
        transform_type: transform.type,
        rms: transform.rms,
        scale: transform.scale,
        rotation: transform.rotation
      },
      geometry: {
        type: 'Polygon',
        coordinates: [worldCorners]
      }
    }]
  };
}

// ============================================
// DOWNLOAD HELPERS
// ============================================

export function downloadAsFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadAsJSON(data: object, filename: string) {
  const content = JSON.stringify(data, null, 2);
  downloadAsFile(content, filename, 'application/json');
}

export function downloadWorldFile(
  transform: TransformResult,
  imageWidth: number,
  imageHeight: number,
  originalFilename: string
) {
  const params = generateWorldFile(transform, imageWidth, imageHeight);
  const content = worldFileToString(params);

  // Get appropriate extension
  const ext = originalFilename.split('.').pop() || 'png';
  const worldExt = getWorldFileExtension(ext);
  const baseName = originalFilename.replace(/\.[^/.]+$/, '');

  downloadAsFile(content, `${baseName}.${worldExt}`, 'text/plain');
}

// ============================================
// SERVER-SIDE EXPORT (via API)
// ============================================

export async function exportToShapefile(
  geojson: GeoJSONFeatureCollection,
  filename: string
): Promise<Blob> {
  const response = await fetch('http://localhost:3001/api/calage/export/shapefile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geojson, filename })
  });

  if (!response.ok) {
    throw new Error('Failed to export to Shapefile');
  }

  return response.blob();
}

export async function exportToGeoPackage(
  geojson: GeoJSONFeatureCollection,
  filename: string,
  tableName: string = 'georeferenced_data'
): Promise<Blob> {
  const response = await fetch('http://localhost:3001/api/calage/export/geopackage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geojson, filename, tableName })
  });

  if (!response.ok) {
    throw new Error('Failed to export to GeoPackage');
  }

  return response.blob();
}

// ============================================
// COMPLETE EXPORT FUNCTION
// ============================================

export async function exportGeoreferencedData(
  options: ExportOptions,
  transform: TransformResult,
  points: CalibrationPoint[],
  importedFile: ImportedFile | null
): Promise<void> {
  const { format, filename, crs, metadata } = options;

  switch (format) {
    case 'geojson': {
      // Export calibration points
      const pointsGeoJSON = exportCalibrationPointsToGeoJSON(points, crs, metadata);
      downloadAsJSON(pointsGeoJSON, `${filename}_points.geojson`);

      // Export image bounds if available
      if (importedFile?.width && importedFile?.height) {
        const boundsGeoJSON = exportImageBoundsToGeoJSON(
          transform,
          importedFile.width,
          importedFile.height,
          importedFile.name,
          crs
        );
        downloadAsJSON(boundsGeoJSON, `${filename}_bounds.geojson`);
      }
      break;
    }

    case 'worldfile': {
      if (!importedFile?.width || !importedFile?.height) {
        throw new Error('Image dimensions required for world file export');
      }
      downloadWorldFile(transform, importedFile.width, importedFile.height, importedFile.name);
      break;
    }

    case 'shapefile': {
      const geojson = exportCalibrationPointsToGeoJSON(points, crs, metadata);
      const blob = await exportToShapefile(geojson, filename);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      break;
    }

    case 'geopackage': {
      const geojson = exportCalibrationPointsToGeoJSON(points, crs, metadata);
      const blob = await exportToGeoPackage(geojson, filename);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.gpkg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      break;
    }

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
