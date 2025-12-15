/**
 * PyQGIS Service - Frontend interface for Python geoprocessing
 */

const API_BASE = 'http://localhost:3001/api/pyqgis';

export interface PyQGISStatus {
  available: boolean;
  pythonPath?: string;
  version?: string;
  dependencies?: {
    installed: boolean;
    error?: string;
    hint?: string;
  };
  algorithms?: string[];
  error?: string;
}

export interface ProcessResult {
  success: boolean;
  data?: GeoJSON.FeatureCollection;
  error?: string;
  traceback?: string;
  metadata?: Record<string, any>;
}

/**
 * Get PyQGIS status (Python availability, dependencies, etc.)
 */
export async function getStatus(): Promise<PyQGISStatus> {
  try {
    const res = await fetch(`${API_BASE}/status`);
    return await res.json();
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : 'Failed to connect to server'
    };
  }
}

/**
 * List available algorithms
 */
export async function listAlgorithms(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/algorithms`);
    const data = await res.json();
    return data.algorithms || [];
  } catch (err) {
    console.error('[PyQGIS] Failed to list algorithms:', err);
    return [];
  }
}

/**
 * Install Python dependencies
 */
export async function installDependencies(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/install`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to install dependencies'
    };
  }
}

/**
 * Run a geoprocessing algorithm
 */
export async function runAlgorithm(
  algorithm: string,
  params: Record<string, any> = {},
  inputGeoJSON?: GeoJSON.FeatureCollection | GeoJSON.Feature
): Promise<ProcessResult> {
  try {
    const res = await fetch(`${API_BASE}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm, params, inputGeoJSON })
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to run algorithm'
    };
  }
}

// Algorithm-specific helpers

/**
 * Create buffer zones around features
 */
export async function buffer(
  input: GeoJSON.FeatureCollection,
  distance: number,
  options: {
    segments?: number;
    capStyle?: 'round' | 'flat' | 'square';
    joinStyle?: 'round' | 'mitre' | 'bevel';
    dissolve?: boolean;
  } = {}
): Promise<ProcessResult> {
  return runAlgorithm('buffer', {
    distance,
    segments: options.segments ?? 16,
    cap_style: options.capStyle ?? 'round',
    join_style: options.joinStyle ?? 'round',
    dissolve: options.dissolve ?? false
  }, input);
}

/**
 * Dissolve (merge) features
 */
export async function dissolve(
  input: GeoJSON.FeatureCollection,
  field?: string
): Promise<ProcessResult> {
  return runAlgorithm('dissolve', { field }, input);
}

/**
 * Simplify geometries
 */
export async function simplify(
  input: GeoJSON.FeatureCollection,
  tolerance: number,
  preserveTopology: boolean = true
): Promise<ProcessResult> {
  return runAlgorithm('simplify', {
    tolerance,
    preserve_topology: preserveTopology
  }, input);
}

/**
 * Generate Voronoi polygons
 */
export async function voronoi(
  input: GeoJSON.FeatureCollection,
  envelope?: [number, number, number, number]
): Promise<ProcessResult> {
  return runAlgorithm('voronoi', { envelope }, input);
}

/**
 * Generate convex hull
 */
export async function convexHull(
  input: GeoJSON.FeatureCollection,
  groupBy?: string
): Promise<ProcessResult> {
  return runAlgorithm('convex_hull', { group_by: groupBy }, input);
}

/**
 * Calculate centroids
 */
export async function centroid(
  input: GeoJSON.FeatureCollection,
  forceInside: boolean = false
): Promise<ProcessResult> {
  return runAlgorithm('centroid', { inside: forceInside }, input);
}

/**
 * Generate grid
 */
export async function grid(
  cellSize: number,
  options: {
    extent?: [number, number, number, number];
    gridType?: 'square' | 'rectangle' | 'hexagon';
    clip?: boolean;
  } = {},
  clipGeometry?: GeoJSON.FeatureCollection
): Promise<ProcessResult> {
  return runAlgorithm('grid', {
    cell_size: cellSize,
    extent: options.extent,
    grid_type: options.gridType ?? 'square',
    clip: options.clip ?? false
  }, clipGeometry);
}

export default {
  getStatus,
  listAlgorithms,
  installDependencies,
  runAlgorithm,
  buffer,
  dissolve,
  simplify,
  voronoi,
  convexHull,
  centroid,
  grid
};
