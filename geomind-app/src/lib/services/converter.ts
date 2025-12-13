/**
 * GeoMind File Converter Service
 * Conversion de fichiers entre différents formats
 *
 * Formats supportés:
 * - Texte: TXT, MD, HTML, JSON, CSV, SQL, PY, YAML, XML
 * - Documents: PDF (via backend), DOCX (via backend)
 * - Géo: GeoJSON, WKT, KML, GML, GPX, DXF (info), Interlis (ITF/XTF)
 * - Tabular: CSV, JSON, XLSX (basic)
 */

import { browser } from '$app/environment';

// ============================================
// Types
// ============================================

export type TextFormat = 'txt' | 'md' | 'html' | 'json' | 'csv' | 'sql' | 'py' | 'yaml' | 'xml';
export type GeoFormat = 'geojson' | 'wkt' | 'kml' | 'gml' | 'gpx' | 'dxf' | 'dwg' | 'itf' | 'xtf';
export type DocumentFormat = 'pdf' | 'docx' | 'xlsx';
export type AllFormat = TextFormat | GeoFormat | DocumentFormat;

export interface ConversionResult {
  success: boolean;
  content?: string;
  blob?: Blob;
  filename: string;
  mimeType: string;
  error?: string;
}

export interface ConversionOptions {
  filename?: string;
  styling?: boolean;
  includeMetadata?: boolean;
}

// ============================================
// MIME Types
// ============================================

const MIME_TYPES: Record<AllFormat, string> = {
  // Text formats
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  json: 'application/json',
  csv: 'text/csv',
  sql: 'application/sql',
  py: 'text/x-python',
  yaml: 'text/yaml',
  xml: 'application/xml',
  // Geo formats
  geojson: 'application/geo+json',
  wkt: 'text/plain',
  kml: 'application/vnd.google-earth.kml+xml',
  gml: 'application/gml+xml',
  gpx: 'application/gpx+xml',
  dxf: 'application/dxf',
  dwg: 'application/acad', // AutoCAD DWG
  itf: 'text/plain', // Interlis 1
  xtf: 'application/xml', // Interlis 2 (XML-based)
  // Document formats
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

// Format labels for UI
export const FORMAT_LABELS: Record<AllFormat, string> = {
  txt: 'Texte brut',
  md: 'Markdown',
  html: 'HTML',
  json: 'JSON',
  csv: 'CSV',
  sql: 'SQL',
  py: 'Python',
  yaml: 'YAML',
  xml: 'XML',
  geojson: 'GeoJSON',
  wkt: 'WKT',
  kml: 'KML (Google Earth)',
  gml: 'GML',
  gpx: 'GPX (GPS)',
  dxf: 'DXF (AutoCAD)',
  dwg: 'DWG (AutoCAD)',
  itf: 'Interlis 1 (ITF)',
  xtf: 'Interlis 2 (XTF)',
  pdf: 'PDF',
  docx: 'Word (DOCX)',
  xlsx: 'Excel (XLSX)'
};

// Format categories for grouping in UI
export const FORMAT_CATEGORIES = {
  text: ['txt', 'md', 'html', 'json', 'csv', 'sql', 'py', 'yaml', 'xml'] as AllFormat[],
  geo: ['geojson', 'wkt', 'kml', 'gml', 'gpx', 'dxf', 'dwg', 'itf', 'xtf'] as AllFormat[],
  document: ['pdf', 'docx', 'xlsx'] as AllFormat[]
};

// ============================================
// Text Conversions (client-side)
// ============================================

/**
 * Convertir du texte brut en Markdown
 */
export function textToMarkdown(text: string, options: ConversionOptions = {}): ConversionResult {
  try {
    // Simple conversion: wrap in code block if it looks like code
    const isCode = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|def |class |function |import |from |const |let |var )/mi.test(text);

    let content: string;
    if (isCode) {
      const lang = detectLanguage(text);
      content = `\`\`\`${lang}\n${text}\n\`\`\``;
    } else {
      content = text;
    }

    if (options.includeMetadata) {
      const now = new Date().toISOString();
      content = `---
created: ${now}
source: GeoMind Converter
---

${content}`;
    }

    return {
      success: true,
      content,
      filename: options.filename || 'converted.md',
      mimeType: MIME_TYPES.md
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.md',
      mimeType: MIME_TYPES.md,
      error: String(error)
    };
  }
}

/**
 * Convertir du Markdown en HTML
 */
export function markdownToHtml(markdown: string, options: ConversionOptions = {}): ConversionResult {
  try {
    // Simple Markdown to HTML conversion
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      // Inline code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      // Lists
      .replace(/^\- (.*$)/gm, '<li>$1</li>');

    // Wrap in paragraphs
    html = `<p>${html}</p>`;

    // Add styling if requested
    if (options.styling) {
      html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.filename || 'Document'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
      color: #333;
    }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    code {
      background: #f0f0f0;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
    }
    pre code {
      background: none;
      padding: 0;
    }
    h1, h2, h3 {
      color: #00ff88;
    }
    a {
      color: #00c3ff;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;
    }

    return {
      success: true,
      content: html,
      filename: options.filename || 'converted.html',
      mimeType: MIME_TYPES.html
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.html',
      mimeType: MIME_TYPES.html,
      error: String(error)
    };
  }
}

/**
 * Convertir JSON en CSV
 */
export function jsonToCsv(jsonString: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const data = JSON.parse(jsonString);

    if (!Array.isArray(data)) {
      return {
        success: false,
        filename: 'error.csv',
        mimeType: MIME_TYPES.csv,
        error: 'JSON doit être un tableau d\'objets'
      };
    }

    if (data.length === 0) {
      return {
        success: true,
        content: '',
        filename: options.filename || 'empty.csv',
        mimeType: MIME_TYPES.csv
      };
    }

    // Extract headers from first object
    const headers = Object.keys(data[0]);
    const csvRows: string[] = [];

    // Header row
    csvRows.push(headers.map(h => `"${h}"`).join(','));

    // Data rows
    for (const row of data) {
      const values = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    return {
      success: true,
      content: csvRows.join('\n'),
      filename: options.filename || 'data.csv',
      mimeType: MIME_TYPES.csv
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.csv',
      mimeType: MIME_TYPES.csv,
      error: String(error)
    };
  }
}

/**
 * Convertir CSV en JSON
 */
export function csvToJson(csv: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) {
      return {
        success: true,
        content: '[]',
        filename: options.filename || 'data.json',
        mimeType: MIME_TYPES.json
      };
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]);

    // Parse rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      data.push(row);
    }

    return {
      success: true,
      content: JSON.stringify(data, null, 2),
      filename: options.filename || 'data.json',
      mimeType: MIME_TYPES.json
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.json',
      mimeType: MIME_TYPES.json,
      error: String(error)
    };
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// ============================================
// Geo Conversions
// ============================================

/**
 * Convertir GeoJSON en WKT
 */
export function geojsonToWkt(geojsonString: string): ConversionResult {
  try {
    const geojson = JSON.parse(geojsonString);
    const wktParts: string[] = [];

    const features = geojson.features || [geojson];

    for (const feature of features) {
      const geom = feature.geometry || feature;
      const wkt = geometryToWkt(geom);
      if (wkt) wktParts.push(wkt);
    }

    return {
      success: true,
      content: wktParts.join('\n'),
      filename: 'geometry.wkt',
      mimeType: MIME_TYPES.wkt
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.wkt',
      mimeType: MIME_TYPES.wkt,
      error: String(error)
    };
  }
}

function geometryToWkt(geom: { type: string; coordinates: unknown }): string | null {
  switch (geom.type) {
    case 'Point':
      return `POINT(${(geom.coordinates as number[]).join(' ')})`;

    case 'LineString':
      return `LINESTRING(${(geom.coordinates as number[][]).map(c => c.join(' ')).join(', ')})`;

    case 'Polygon':
      return `POLYGON(${(geom.coordinates as number[][][]).map(ring =>
        `(${ring.map(c => c.join(' ')).join(', ')})`
      ).join(', ')})`;

    case 'MultiPoint':
      return `MULTIPOINT(${(geom.coordinates as number[][]).map(c => `(${c.join(' ')})`).join(', ')})`;

    case 'MultiLineString':
      return `MULTILINESTRING(${(geom.coordinates as number[][][]).map(line =>
        `(${line.map(c => c.join(' ')).join(', ')})`
      ).join(', ')})`;

    case 'MultiPolygon':
      return `MULTIPOLYGON(${(geom.coordinates as number[][][][]).map(poly =>
        `(${poly.map(ring => `(${ring.map(c => c.join(' ')).join(', ')})`).join(', ')})`
      ).join(', ')})`;

    default:
      return null;
  }
}

/**
 * Convertir WKT en GeoJSON
 */
export function wktToGeojson(wkt: string): ConversionResult {
  try {
    const geometry = parseWkt(wkt);

    const geojson = {
      type: 'Feature',
      geometry,
      properties: {}
    };

    return {
      success: true,
      content: JSON.stringify(geojson, null, 2),
      filename: 'geometry.geojson',
      mimeType: MIME_TYPES.geojson
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.geojson',
      mimeType: MIME_TYPES.geojson,
      error: String(error)
    };
  }
}

function parseWkt(wkt: string): { type: string; coordinates: unknown } {
  const typeMatch = wkt.match(/^(\w+)\s*\((.*)\)$/s);
  if (!typeMatch) throw new Error('Invalid WKT format');

  const [, type, coordsStr] = typeMatch;

  switch (type.toUpperCase()) {
    case 'POINT':
      return {
        type: 'Point',
        coordinates: coordsStr.trim().split(/\s+/).map(Number)
      };

    case 'LINESTRING':
      return {
        type: 'LineString',
        coordinates: coordsStr.split(',').map(p => p.trim().split(/\s+/).map(Number))
      };

    case 'POLYGON': {
      const rings = coordsStr.match(/\([^()]+\)/g) || [];
      return {
        type: 'Polygon',
        coordinates: rings.map(ring =>
          ring.replace(/[()]/g, '').split(',').map(p => p.trim().split(/\s+/).map(Number))
        )
      };
    }

    default:
      throw new Error(`Unsupported WKT type: ${type}`);
  }
}

/**
 * Convertir GeoJSON en KML
 */
export function geojsonToKml(geojsonString: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const geojson = JSON.parse(geojsonString);
    const features = geojson.features || [{ type: 'Feature', geometry: geojson, properties: {} }];

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${options.filename || 'GeoMind Export'}</name>
`;

    for (const feature of features) {
      const name = feature.properties?.name || feature.properties?.nom || 'Feature';
      const desc = feature.properties?.description || '';

      kml += `    <Placemark>
      <name>${escapeXml(name)}</name>
      <description>${escapeXml(desc)}</description>
      ${geometryToKml(feature.geometry)}
    </Placemark>
`;
    }

    kml += `  </Document>
</kml>`;

    return {
      success: true,
      content: kml,
      filename: options.filename || 'export.kml',
      mimeType: MIME_TYPES.kml
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.kml',
      mimeType: MIME_TYPES.kml,
      error: String(error)
    };
  }
}

function geometryToKml(geom: { type: string; coordinates: unknown }): string {
  switch (geom.type) {
    case 'Point':
      return `<Point><coordinates>${(geom.coordinates as number[]).join(',')}</coordinates></Point>`;

    case 'LineString':
      return `<LineString><coordinates>${(geom.coordinates as number[][]).map(c => c.join(',')).join(' ')}</coordinates></LineString>`;

    case 'Polygon':
      return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${
        (geom.coordinates as number[][][])[0].map(c => c.join(',')).join(' ')
      }</coordinates></LinearRing></outerBoundaryIs></Polygon>`;

    default:
      return '';
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convertir GeoJSON en GPX
 */
export function geojsonToGpx(geojsonString: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const geojson = JSON.parse(geojsonString);
    const features = geojson.features || [{ type: 'Feature', geometry: geojson, properties: {} }];

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GeoMind" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(options.filename || 'GeoMind Export')}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;

    for (const feature of features) {
      const name = feature.properties?.name || feature.properties?.nom || '';
      const desc = feature.properties?.description || '';
      const geom = feature.geometry;

      if (geom.type === 'Point') {
        const [lon, lat, ele] = geom.coordinates;
        gpx += `  <wpt lat="${lat}" lon="${lon}"${ele ? ` ele="${ele}"` : ''}>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(desc)}</desc>
  </wpt>
`;
      } else if (geom.type === 'LineString') {
        gpx += `  <trk>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(desc)}</desc>
    <trkseg>
`;
        for (const coord of geom.coordinates) {
          const [lon, lat, ele] = coord;
          gpx += `      <trkpt lat="${lat}" lon="${lon}"${ele ? `><ele>${ele}</ele></trkpt` : '/'}>\n`;
        }
        gpx += `    </trkseg>
  </trk>
`;
      }
    }

    gpx += `</gpx>`;

    return {
      success: true,
      content: gpx,
      filename: options.filename || 'export.gpx',
      mimeType: MIME_TYPES.gpx
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.gpx',
      mimeType: MIME_TYPES.gpx,
      error: String(error)
    };
  }
}

/**
 * Convertir GPX en GeoJSON
 */
export function gpxToGeojson(gpxString: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const features: Array<{type: string; geometry: unknown; properties: Record<string, string>}> = [];

    // Parse waypoints
    const wptRegex = /<wpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/wpt>/gi;
    let match;
    while ((match = wptRegex.exec(gpxString)) !== null) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      const content = match[3];
      const name = content.match(/<name>([^<]*)<\/name>/i)?.[1] || '';
      const desc = content.match(/<desc>([^<]*)<\/desc>/i)?.[1] || '';
      const ele = content.match(/<ele>([^<]*)<\/ele>/i)?.[1];

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: ele ? [lon, lat, parseFloat(ele)] : [lon, lat]
        },
        properties: { name, description: desc }
      });
    }

    // Parse tracks
    const trkRegex = /<trk>([\s\S]*?)<\/trk>/gi;
    while ((match = trkRegex.exec(gpxString)) !== null) {
      const trkContent = match[1];
      const name = trkContent.match(/<name>([^<]*)<\/name>/i)?.[1] || '';
      const desc = trkContent.match(/<desc>([^<]*)<\/desc>/i)?.[1] || '';

      const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*(?:\/>|>([\s\S]*?)<\/trkpt>)/gi;
      const coords: number[][] = [];
      let trkptMatch;
      while ((trkptMatch = trkptRegex.exec(trkContent)) !== null) {
        const lat = parseFloat(trkptMatch[1]);
        const lon = parseFloat(trkptMatch[2]);
        const eleMatch = trkptMatch[3]?.match(/<ele>([^<]*)<\/ele>/i);
        if (eleMatch) {
          coords.push([lon, lat, parseFloat(eleMatch[1])]);
        } else {
          coords.push([lon, lat]);
        }
      }

      if (coords.length > 0) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { name, description: desc }
        });
      }
    }

    // Parse routes
    const rteRegex = /<rte>([\s\S]*?)<\/rte>/gi;
    while ((match = rteRegex.exec(gpxString)) !== null) {
      const rteContent = match[1];
      const name = rteContent.match(/<name>([^<]*)<\/name>/i)?.[1] || '';

      const rteptRegex = /<rtept\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*(?:\/>|>[^<]*<\/rtept>)/gi;
      const coords: number[][] = [];
      let rteptMatch;
      while ((rteptMatch = rteptRegex.exec(rteContent)) !== null) {
        coords.push([parseFloat(rteptMatch[2]), parseFloat(rteptMatch[1])]);
      }

      if (coords.length > 0) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { name }
        });
      }
    }

    const geojson = { type: 'FeatureCollection', features };

    return {
      success: true,
      content: JSON.stringify(geojson, null, 2),
      filename: options.filename || 'converted.geojson',
      mimeType: MIME_TYPES.geojson
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.geojson',
      mimeType: MIME_TYPES.geojson,
      error: String(error)
    };
  }
}

/**
 * Convertir GeoJSON en GML
 */
export function geojsonToGml(geojsonString: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const geojson = JSON.parse(geojsonString);
    const features = geojson.features || [{ type: 'Feature', geometry: geojson, properties: {} }];

    let gml = `<?xml version="1.0" encoding="UTF-8"?>
<gml:FeatureCollection xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
`;

    features.forEach((feature: {geometry: {type: string; coordinates: unknown}; properties: Record<string, unknown>}, idx: number) => {
      gml += `  <gml:featureMember>
    <Feature gml:id="f${idx + 1}">
      ${geometryToGml(feature.geometry)}
`;
      // Add properties
      for (const [key, value] of Object.entries(feature.properties || {})) {
        gml += `      <${key}>${escapeXml(String(value))}</${key}>\n`;
      }
      gml += `    </Feature>
  </gml:featureMember>
`;
    });

    gml += `</gml:FeatureCollection>`;

    return {
      success: true,
      content: gml,
      filename: options.filename || 'export.gml',
      mimeType: MIME_TYPES.gml
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.gml',
      mimeType: MIME_TYPES.gml,
      error: String(error)
    };
  }
}

function geometryToGml(geom: { type: string; coordinates: unknown }): string {
  switch (geom.type) {
    case 'Point': {
      const [x, y] = geom.coordinates as number[];
      return `<gml:Point><gml:pos>${x} ${y}</gml:pos></gml:Point>`;
    }
    case 'LineString': {
      const coords = (geom.coordinates as number[][]).map(c => c.join(' ')).join(' ');
      return `<gml:LineString><gml:posList>${coords}</gml:posList></gml:LineString>`;
    }
    case 'Polygon': {
      const rings = geom.coordinates as number[][][];
      let gml = '<gml:Polygon>';
      rings.forEach((ring, i) => {
        const coords = ring.map(c => c.join(' ')).join(' ');
        if (i === 0) {
          gml += `<gml:exterior><gml:LinearRing><gml:posList>${coords}</gml:posList></gml:LinearRing></gml:exterior>`;
        } else {
          gml += `<gml:interior><gml:LinearRing><gml:posList>${coords}</gml:posList></gml:LinearRing></gml:interior>`;
        }
      });
      gml += '</gml:Polygon>';
      return gml;
    }
    default:
      return '';
  }
}

/**
 * Convertir KML en GeoJSON
 */
export function kmlToGeojson(kmlString: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const features: Array<{type: string; geometry: unknown; properties: Record<string, string>}> = [];

    const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/gi;
    let match;
    while ((match = placemarkRegex.exec(kmlString)) !== null) {
      const content = match[1];
      const name = content.match(/<name>([^<]*)<\/name>/i)?.[1] || '';
      const desc = content.match(/<description>([^<]*)<\/description>/i)?.[1] || '';

      // Point
      const pointMatch = content.match(/<Point>[\s\S]*?<coordinates>([^<]+)<\/coordinates>[\s\S]*?<\/Point>/i);
      if (pointMatch) {
        const [lon, lat, ele] = pointMatch[1].trim().split(',').map(Number);
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: ele ? [lon, lat, ele] : [lon, lat] },
          properties: { name, description: desc }
        });
        continue;
      }

      // LineString
      const lineMatch = content.match(/<LineString>[\s\S]*?<coordinates>([^<]+)<\/coordinates>[\s\S]*?<\/LineString>/i);
      if (lineMatch) {
        const coords = lineMatch[1].trim().split(/\s+/).map(c => {
          const parts = c.split(',').map(Number);
          return parts.length === 3 ? parts : [parts[0], parts[1]];
        });
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { name, description: desc }
        });
        continue;
      }

      // Polygon
      const polyMatch = content.match(/<Polygon>[\s\S]*?<outerBoundaryIs>[\s\S]*?<coordinates>([^<]+)<\/coordinates>/i);
      if (polyMatch) {
        const coords = polyMatch[1].trim().split(/\s+/).map(c => {
          const parts = c.split(',').map(Number);
          return parts.length === 3 ? parts : [parts[0], parts[1]];
        });
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: { name, description: desc }
        });
      }
    }

    const geojson = { type: 'FeatureCollection', features };

    return {
      success: true,
      content: JSON.stringify(geojson, null, 2),
      filename: options.filename || 'converted.geojson',
      mimeType: MIME_TYPES.geojson
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.geojson',
      mimeType: MIME_TYPES.geojson,
      error: String(error)
    };
  }
}

/**
 * Convertir JSON en XML
 */
export function jsonToXml(jsonString: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const data = JSON.parse(jsonString);
    const rootName = options.filename?.replace(/\.\w+$/, '') || 'root';

    function objectToXml(obj: unknown, tagName: string, indent: string = ''): string {
      if (obj === null || obj === undefined) {
        return `${indent}<${tagName}/>\n`;
      }
      if (Array.isArray(obj)) {
        return obj.map((item, i) => objectToXml(item, `item`, indent)).join('');
      }
      if (typeof obj === 'object') {
        let xml = `${indent}<${tagName}>\n`;
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
          xml += objectToXml(value, key, indent + '  ');
        }
        xml += `${indent}</${tagName}>\n`;
        return xml;
      }
      return `${indent}<${tagName}>${escapeXml(String(obj))}</${tagName}>\n`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${objectToXml(data, rootName)}`;

    return {
      success: true,
      content: xml,
      filename: options.filename || 'data.xml',
      mimeType: MIME_TYPES.xml
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.xml',
      mimeType: MIME_TYPES.xml,
      error: String(error)
    };
  }
}

/**
 * Convertir XML en JSON (simple)
 */
export function xmlToJson(xmlString: string, options: ConversionOptions = {}): ConversionResult {
  try {
    function parseXmlNode(xml: string): unknown {
      // Remove XML declaration
      xml = xml.replace(/<\?xml[^?]*\?>/gi, '').trim();

      // Simple regex-based parser
      const tagMatch = xml.match(/^<(\w+)([^>]*)>([\s\S]*)<\/\1>$/);
      if (!tagMatch) {
        // Self-closing or text
        const selfClose = xml.match(/^<(\w+)([^/>]*)\/>$/);
        if (selfClose) return null;
        return xml.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      }

      const [, tagName, attrs, content] = tagMatch;
      const result: Record<string, unknown> = {};

      // Parse attributes
      const attrRegex = /(\w+)="([^"]*)"/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        result[`@${attrMatch[1]}`] = attrMatch[2];
      }

      // Parse children
      const childRegex = /<(\w+)([^>]*)(?:\/>|>([\s\S]*?)<\/\1>)/g;
      const children: Record<string, unknown[]> = {};
      let childMatch;
      let hasChildren = false;

      while ((childMatch = childRegex.exec(content)) !== null) {
        hasChildren = true;
        const childTag = childMatch[1];
        const childContent = childMatch[3] !== undefined
          ? `<${childTag}${childMatch[2]}>${childMatch[3]}</${childTag}>`
          : `<${childTag}${childMatch[2]}/>`;

        if (!children[childTag]) children[childTag] = [];
        children[childTag].push(parseXmlNode(childContent));
      }

      if (hasChildren) {
        for (const [key, value] of Object.entries(children)) {
          result[key] = value.length === 1 ? value[0] : value;
        }
      } else if (content.trim()) {
        return content.trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      }

      return Object.keys(result).length > 0 ? result : null;
    }

    const json = parseXmlNode(xmlString);

    return {
      success: true,
      content: JSON.stringify(json, null, 2),
      filename: options.filename || 'data.json',
      mimeType: MIME_TYPES.json
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.json',
      mimeType: MIME_TYPES.json,
      error: String(error)
    };
  }
}

/**
 * Convertir CSV en GeoJSON (si colonnes lat/lon détectées)
 */
export function csvToGeojson(csv: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
      return { success: false, filename: 'error.geojson', mimeType: MIME_TYPES.geojson, error: 'CSV vide ou sans données' };
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    // Detect coordinate columns
    const latIdx = headers.findIndex(h => ['lat', 'latitude', 'y', 'nord', 'north'].includes(h));
    const lonIdx = headers.findIndex(h => ['lon', 'lng', 'longitude', 'x', 'est', 'east'].includes(h));

    if (latIdx === -1 || lonIdx === -1) {
      return { success: false, filename: 'error.geojson', mimeType: MIME_TYPES.geojson, error: 'Colonnes lat/lon non trouvées' };
    }

    const features = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const lat = parseFloat(values[latIdx]);
      const lon = parseFloat(values[lonIdx]);

      if (isNaN(lat) || isNaN(lon)) continue;

      const properties: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (idx !== latIdx && idx !== lonIdx) {
          properties[h] = values[idx] || '';
        }
      });

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties
      });
    }

    const geojson = { type: 'FeatureCollection', features };

    return {
      success: true,
      content: JSON.stringify(geojson, null, 2),
      filename: options.filename || 'points.geojson',
      mimeType: MIME_TYPES.geojson
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.geojson',
      mimeType: MIME_TYPES.geojson,
      error: String(error)
    };
  }
}

/**
 * Convertir GeoJSON en CSV (extrait propriétés + centroïde)
 */
export function geojsonToCsv(geojsonString: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const geojson = JSON.parse(geojsonString);
    const features = geojson.features || [];

    if (features.length === 0) {
      return { success: true, content: '', filename: 'empty.csv', mimeType: MIME_TYPES.csv };
    }

    // Collect all property keys
    const allKeys = new Set<string>();
    features.forEach((f: {properties: Record<string, unknown>}) => {
      Object.keys(f.properties || {}).forEach(k => allKeys.add(k));
    });
    const headers = ['longitude', 'latitude', ...Array.from(allKeys)];

    const rows: string[] = [headers.map(h => `"${h}"`).join(',')];

    for (const feature of features) {
      const centroid = getCentroid(feature.geometry);
      const values = [
        centroid[0].toFixed(6),
        centroid[1].toFixed(6),
        ...Array.from(allKeys).map(k => {
          const val = feature.properties?.[k];
          if (val === null || val === undefined) return '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
      ];
      rows.push(values.join(','));
    }

    return {
      success: true,
      content: rows.join('\n'),
      filename: options.filename || 'export.csv',
      mimeType: MIME_TYPES.csv
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.csv',
      mimeType: MIME_TYPES.csv,
      error: String(error)
    };
  }
}

function getCentroid(geom: { type: string; coordinates: unknown }): [number, number] {
  switch (geom.type) {
    case 'Point':
      return geom.coordinates as [number, number];
    case 'LineString': {
      const coords = geom.coordinates as number[][];
      const mid = Math.floor(coords.length / 2);
      return [coords[mid][0], coords[mid][1]];
    }
    case 'Polygon': {
      const ring = (geom.coordinates as number[][][])[0];
      let x = 0, y = 0;
      for (const c of ring) { x += c[0]; y += c[1]; }
      return [x / ring.length, y / ring.length];
    }
    default:
      return [0, 0];
  }
}

// ============================================
// Utility Functions
// ============================================

function detectLanguage(content: string): string {
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/im.test(content)) return 'sql';
  if (/^(def |class |import |from |print\()/m.test(content)) return 'python';
  if (/^(function |const |let |var |=>|import \{)/m.test(content)) return 'javascript';
  if (/<\?xml|<html|<div|<span/i.test(content)) return 'html';
  if (/^[\[{]/.test(content.trim())) return 'json';
  if (/^[\w-]+:\s/m.test(content)) return 'yaml';
  return 'text';
}

/**
 * Télécharger le résultat de conversion
 */
export function downloadConversion(result: ConversionResult): void {
  if (!browser || !result.success) return;

  const blob = result.blob || new Blob([result.content || ''], { type: result.mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Conversion automatique basée sur les extensions
 */
export function autoConvert(
  content: string,
  fromFormat: AllFormat,
  toFormat: AllFormat,
  options: ConversionOptions = {}
): ConversionResult {
  const key = `${fromFormat}_to_${toFormat}`;

  const converters: Record<string, (c: string, o: ConversionOptions) => ConversionResult> = {
    // Text
    'txt_to_md': textToMarkdown,
    'md_to_html': markdownToHtml,
    'json_to_csv': jsonToCsv,
    'csv_to_json': csvToJson,
    'json_to_xml': jsonToXml,
    'xml_to_json': xmlToJson,
    // Geo
    'geojson_to_wkt': (c) => geojsonToWkt(c),
    'wkt_to_geojson': (c) => wktToGeojson(c),
    'geojson_to_kml': geojsonToKml,
    'kml_to_geojson': kmlToGeojson,
    'geojson_to_gpx': geojsonToGpx,
    'gpx_to_geojson': gpxToGeojson,
    'geojson_to_gml': geojsonToGml,
    'geojson_to_csv': geojsonToCsv,
    'csv_to_geojson': csvToGeojson,
    // DXF/CAD
    'dxf_to_geojson': dxfToGeojson,
    // Interlis
    'itf_to_geojson': itfToGeojson,
    'xtf_to_geojson': xtfToGeojson
  };

  const converter = converters[key];

  if (!converter) {
    return {
      success: false,
      filename: 'error.txt',
      mimeType: 'text/plain',
      error: `Conversion ${fromFormat} → ${toFormat} non supportée`
    };
  }

  return converter(content, options);
}

// ============================================
// Format Detection
// ============================================

export function detectFormat(content: string, filename?: string): AllFormat {
  // By filename extension
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && ext in MIME_TYPES) return ext as AllFormat;
  }

  // By content
  const trimmed = content.trim();

  // JSON/GeoJSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'Feature' || parsed.type === 'FeatureCollection' || parsed.type === 'Point' || parsed.type === 'Polygon') {
        return 'geojson';
      }
      return 'json';
    } catch {
      // Not valid JSON
    }
  }

  // WKT
  if (/^(POINT|LINESTRING|POLYGON|MULTI)/i.test(trimmed)) {
    return 'wkt';
  }

  // DXF (AutoCAD)
  if (/^\s*0\s*\n\s*SECTION/m.test(trimmed) || trimmed.includes('ENTITIES') && trimmed.includes('ENDSEC')) {
    return 'dxf';
  }

  // ITF (Interlis 1) - starts with SCNT or MODL
  if (/^(SCNT|MODL|TOPI)/m.test(trimmed)) {
    return 'itf';
  }

  // XTF (Interlis 2) - XML with TRANSFER or specific namespace
  if (/<TRANSFER\b|xmlns:ili|<DATASECTION>/i.test(trimmed)) {
    return 'xtf';
  }

  // SQL
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\s/im.test(trimmed)) {
    return 'sql';
  }

  // Python
  if (/^(def |class |import |from |#.*coding|#\!)/m.test(trimmed)) {
    return 'py';
  }

  // YAML
  if (/^[\w-]+:\s/m.test(trimmed) && !trimmed.includes('{')) {
    return 'yaml';
  }

  // CSV
  if (trimmed.includes(',') && trimmed.split('\n').every(line => line.split(',').length > 1)) {
    return 'csv';
  }

  // HTML
  if (/<(!DOCTYPE|html|head|body|div|span|p)\b/i.test(trimmed)) {
    return 'html';
  }

  // Markdown
  if (/^#{1,6}\s|^\*\*|^\- |^```/m.test(trimmed)) {
    return 'md';
  }

  return 'txt';
}

// ============================================
// DWG Conversion (via backend + ODA)
// ============================================

const API_BASE = 'http://localhost:3001/api';

/**
 * Check if ODA File Converter is installed
 */
export async function checkDwgSupport(): Promise<{ installed: boolean; downloadUrl: string }> {
  try {
    const res = await fetch(`${API_BASE}/dwg/status`);
    const data = await res.json();
    return { installed: data.odaInstalled, downloadUrl: data.downloadUrl };
  } catch {
    return { installed: false, downloadUrl: 'https://www.opendesign.com/guestfiles/oda_file_converter' };
  }
}

/**
 * Convertir DWG en GeoJSON via backend (ODA File Converter)
 */
export async function dwgToGeojson(file: File | ArrayBuffer, filename?: string): Promise<ConversionResult> {
  try {
    // Convert to base64
    let base64: string;
    if (file instanceof File) {
      const buffer = await file.arrayBuffer();
      base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      filename = filename || file.name;
    } else {
      base64 = btoa(String.fromCharCode(...new Uint8Array(file)));
    }

    const res = await fetch(`${API_BASE}/dwg/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content: base64 })
    });

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        filename: 'error.geojson',
        mimeType: MIME_TYPES.geojson,
        error: data.error || 'Erreur de conversion DWG',
        ...(data.downloadUrl && { downloadUrl: data.downloadUrl }),
        ...(data.instructions && { instructions: data.instructions })
      };
    }

    return {
      success: true,
      content: JSON.stringify(data.geojson, null, 2),
      filename: data.filename || 'converted.geojson',
      mimeType: MIME_TYPES.geojson
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.geojson',
      mimeType: MIME_TYPES.geojson,
      error: `Erreur de conversion DWG: ${String(error)}`
    };
  }
}

// ============================================
// DXF Conversion
// ============================================

/**
 * Convertir DXF en GeoJSON
 * Supporte: LINE, LWPOLYLINE, CIRCLE, ARC, POINT, TEXT
 */
export function dxfToGeojson(dxfContent: string, options: ConversionOptions = {}): ConversionResult {
  try {
    // Dynamic import would be better but for simplicity we parse manually
    // DXF is a complex format, this is a simplified parser for common entities
    const features: Array<{type: string; geometry: unknown; properties: Record<string, unknown>}> = [];

    const lines = dxfContent.split('\n');
    let i = 0;
    let currentSection = '';
    let currentEntity: Record<string, unknown> = {};
    let entityType = '';
    let inEntities = false;

    // Parse DXF structure
    while (i < lines.length) {
      const code = parseInt(lines[i]?.trim() || '0');
      const value = lines[i + 1]?.trim() || '';
      i += 2;

      // Section markers
      if (code === 0 && value === 'SECTION') {
        const sectionCode = parseInt(lines[i]?.trim() || '0');
        const sectionName = lines[i + 1]?.trim() || '';
        if (sectionCode === 2) {
          currentSection = sectionName;
          inEntities = sectionName === 'ENTITIES';
        }
        i += 2;
        continue;
      }

      if (code === 0 && value === 'ENDSEC') {
        currentSection = '';
        inEntities = false;
        continue;
      }

      if (!inEntities) continue;

      // Entity start
      if (code === 0) {
        // Save previous entity
        if (entityType && Object.keys(currentEntity).length > 0) {
          const feature = dxfEntityToFeature(entityType, currentEntity);
          if (feature) features.push(feature);
        }

        entityType = value;
        currentEntity = { layer: '0' };
        continue;
      }

      // Entity data
      switch (code) {
        case 8: currentEntity.layer = value; break;
        case 10: currentEntity.x = parseFloat(value); break;
        case 20: currentEntity.y = parseFloat(value); break;
        case 11: currentEntity.x2 = parseFloat(value); break;
        case 21: currentEntity.y2 = parseFloat(value); break;
        case 40: currentEntity.radius = parseFloat(value); break;
        case 50: currentEntity.startAngle = parseFloat(value); break;
        case 51: currentEntity.endAngle = parseFloat(value); break;
        case 1: currentEntity.text = value; break;
        case 62: currentEntity.color = parseInt(value); break;
        // LWPOLYLINE vertices
        case 90: currentEntity.vertexCount = parseInt(value); break;
        case 70: currentEntity.flags = parseInt(value); break;
      }

      // Collect LWPOLYLINE vertices
      if (entityType === 'LWPOLYLINE' && code === 10) {
        if (!currentEntity.vertices) currentEntity.vertices = [];
        (currentEntity.vertices as number[][]).push([parseFloat(value), 0]);
      }
      if (entityType === 'LWPOLYLINE' && code === 20) {
        const verts = currentEntity.vertices as number[][];
        if (verts && verts.length > 0) {
          verts[verts.length - 1][1] = parseFloat(value);
        }
      }
    }

    // Save last entity
    if (entityType && Object.keys(currentEntity).length > 0) {
      const feature = dxfEntityToFeature(entityType, currentEntity);
      if (feature) features.push(feature);
    }

    const geojson = { type: 'FeatureCollection', features };

    return {
      success: true,
      content: JSON.stringify(geojson, null, 2),
      filename: options.filename?.replace(/\.dxf$/i, '.geojson') || 'drawing.geojson',
      mimeType: MIME_TYPES.geojson
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.geojson',
      mimeType: MIME_TYPES.geojson,
      error: `Erreur parsing DXF: ${String(error)}`
    };
  }
}

function dxfEntityToFeature(type: string, entity: Record<string, unknown>): {type: string; geometry: unknown; properties: Record<string, unknown>} | null {
  const props = { layer: entity.layer, color: entity.color, entityType: type };

  switch (type) {
    case 'POINT':
      if (entity.x !== undefined && entity.y !== undefined) {
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [entity.x, entity.y] },
          properties: props
        };
      }
      break;

    case 'LINE':
      if (entity.x !== undefined && entity.y !== undefined && entity.x2 !== undefined && entity.y2 !== undefined) {
        return {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[entity.x, entity.y], [entity.x2, entity.y2]] },
          properties: props
        };
      }
      break;

    case 'LWPOLYLINE':
    case 'POLYLINE': {
      const vertices = entity.vertices as number[][] | undefined;
      if (vertices && vertices.length >= 2) {
        const isClosed = ((entity.flags as number) || 0) & 1;
        if (isClosed && vertices.length >= 3) {
          // Close the polygon
          const coords = [...vertices];
          if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
            coords.push([...coords[0]]);
          }
          return {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: props
          };
        } else {
          return {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: vertices },
            properties: props
          };
        }
      }
      break;
    }

    case 'CIRCLE': {
      const cx = entity.x as number;
      const cy = entity.y as number;
      const r = entity.radius as number;
      if (cx !== undefined && cy !== undefined && r) {
        // Approximate circle with 32 points
        const coords: number[][] = [];
        for (let i = 0; i <= 32; i++) {
          const angle = (i / 32) * 2 * Math.PI;
          coords.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
        }
        return {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: { ...props, radius: r }
        };
      }
      break;
    }

    case 'ARC': {
      const cx = entity.x as number;
      const cy = entity.y as number;
      const r = entity.radius as number;
      const start = ((entity.startAngle as number) || 0) * Math.PI / 180;
      const end = ((entity.endAngle as number) || 360) * Math.PI / 180;
      if (cx !== undefined && cy !== undefined && r) {
        const coords: number[][] = [];
        const arcLength = end > start ? end - start : (2 * Math.PI - start + end);
        const segments = Math.max(8, Math.ceil(arcLength / (Math.PI / 16)));
        for (let i = 0; i <= segments; i++) {
          const angle = start + (i / segments) * arcLength;
          coords.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
        }
        return {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { ...props, radius: r, startAngle: entity.startAngle, endAngle: entity.endAngle }
        };
      }
      break;
    }

    case 'TEXT':
    case 'MTEXT':
      if (entity.x !== undefined && entity.y !== undefined) {
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [entity.x, entity.y] },
          properties: { ...props, text: entity.text }
        };
      }
      break;
  }

  return null;
}

// ============================================
// Interlis Conversions (ITF/XTF)
// ============================================

/**
 * Parser ITF (Interlis 1) - Format texte structuré suisse
 * Structure: SCNT, TOPI, TABL, OBJE
 */
export function itfToGeojson(itfContent: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const features: Array<{type: string; geometry: unknown; properties: Record<string, unknown>}> = [];
    const lines = itfContent.split('\n');

    let currentTopic = '';
    let currentTable = '';
    let currentObject: Record<string, unknown> = {};
    let inObject = false;
    let coordBuffer: number[][] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Topic declaration
      if (trimmed.startsWith('TOPI')) {
        currentTopic = trimmed.substring(4).trim();
        continue;
      }

      // Table declaration
      if (trimmed.startsWith('TABL')) {
        currentTable = trimmed.substring(4).trim();
        continue;
      }

      // End table
      if (trimmed === 'ETAB') {
        currentTable = '';
        continue;
      }

      // End topic
      if (trimmed === 'ETOP') {
        currentTopic = '';
        continue;
      }

      // Object start
      if (trimmed.startsWith('OBJE')) {
        inObject = true;
        currentObject = {
          _topic: currentTopic,
          _table: currentTable,
          _tid: trimmed.substring(4).trim()
        };
        coordBuffer = [];
        continue;
      }

      // Object end - create feature
      if (trimmed === 'ELIN' || trimmed === 'EOBJ') {
        if (inObject && Object.keys(currentObject).length > 3) {
          // Try to create geometry from coords
          let geometry: unknown = null;

          if (coordBuffer.length === 1) {
            geometry = { type: 'Point', coordinates: coordBuffer[0] };
          } else if (coordBuffer.length >= 2) {
            // Check if closed polygon
            const first = coordBuffer[0];
            const last = coordBuffer[coordBuffer.length - 1];
            if (coordBuffer.length >= 3 && first[0] === last[0] && first[1] === last[1]) {
              geometry = { type: 'Polygon', coordinates: [coordBuffer] };
            } else {
              geometry = { type: 'LineString', coordinates: coordBuffer };
            }
          }

          if (geometry) {
            features.push({
              type: 'Feature',
              geometry,
              properties: { ...currentObject }
            });
          }
        }
        inObject = false;
        currentObject = {};
        coordBuffer = [];
        continue;
      }

      // Parse object attributes
      if (inObject) {
        // Coordinate line (STPT, LIPT, ARCP patterns or direct coords)
        const coordMatch = trimmed.match(/^(?:STPT|LIPT|ARCP)?\s*([\d.]+)\s+([\d.]+)/);
        if (coordMatch) {
          coordBuffer.push([parseFloat(coordMatch[1]), parseFloat(coordMatch[2])]);
          continue;
        }

        // Attribute line (NAME VALUE or NAME=VALUE)
        const attrMatch = trimmed.match(/^(\w+)\s*[=:]?\s*(.*)$/);
        if (attrMatch && !['STPT', 'LIPT', 'ARCP', 'ELIN'].includes(attrMatch[1])) {
          currentObject[attrMatch[1]] = attrMatch[2] || true;
        }
      }
    }

    const geojson = { type: 'FeatureCollection', features };

    return {
      success: true,
      content: JSON.stringify(geojson, null, 2),
      filename: options.filename?.replace(/\.itf$/i, '.geojson') || 'interlis.geojson',
      mimeType: MIME_TYPES.geojson
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.geojson',
      mimeType: MIME_TYPES.geojson,
      error: `Erreur parsing ITF: ${String(error)}`
    };
  }
}

/**
 * Parser XTF (Interlis 2) - Format XML suisse
 */
export function xtfToGeojson(xtfContent: string, options: ConversionOptions = {}): ConversionResult {
  try {
    const features: Array<{type: string; geometry: unknown; properties: Record<string, unknown>}> = [];

    // Parse all objects with TID
    const objectRegex = /<(\w+(?:\.\w+)*)\s+TID="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;

    while ((match = objectRegex.exec(xtfContent)) !== null) {
      const className = match[1];
      const tid = match[2];
      const content = match[3];

      const properties: Record<string, unknown> = {
        _class: className,
        _tid: tid
      };

      // Extract simple attributes
      const attrRegex = /<(\w+)>([^<]+)<\/\1>/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(content)) !== null) {
        const attrName = attrMatch[1];
        const attrValue = attrMatch[2].trim();
        // Skip geometry tags
        if (!['COORD', 'POLYLINE', 'SURFACE', 'C1', 'C2', 'C3'].includes(attrName)) {
          properties[attrName] = attrValue;
        }
      }

      // Extract geometry
      let geometry: unknown = null;

      // Point (COORD)
      const coordMatch = content.match(/<COORD>\s*<C1>([^<]+)<\/C1>\s*<C2>([^<]+)<\/C2>/);
      if (coordMatch) {
        geometry = {
          type: 'Point',
          coordinates: [parseFloat(coordMatch[1]), parseFloat(coordMatch[2])]
        };
      }

      // Polyline
      const polylineMatch = content.match(/<POLYLINE>([\s\S]*?)<\/POLYLINE>/);
      if (polylineMatch) {
        const coords: number[][] = [];
        const pointRegex = /<COORD>\s*<C1>([^<]+)<\/C1>\s*<C2>([^<]+)<\/C2>/g;
        let pointMatch;
        while ((pointMatch = pointRegex.exec(polylineMatch[1])) !== null) {
          coords.push([parseFloat(pointMatch[1]), parseFloat(pointMatch[2])]);
        }
        if (coords.length >= 2) {
          geometry = { type: 'LineString', coordinates: coords };
        }
      }

      // Surface (polygon)
      const surfaceMatch = content.match(/<SURFACE>([\s\S]*?)<\/SURFACE>/);
      if (surfaceMatch) {
        const coords: number[][] = [];
        const pointRegex = /<COORD>\s*<C1>([^<]+)<\/C1>\s*<C2>([^<]+)<\/C2>/g;
        let pointMatch;
        while ((pointMatch = pointRegex.exec(surfaceMatch[1])) !== null) {
          coords.push([parseFloat(pointMatch[1]), parseFloat(pointMatch[2])]);
        }
        if (coords.length >= 3) {
          // Close if not closed
          if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
            coords.push([...coords[0]]);
          }
          geometry = { type: 'Polygon', coordinates: [coords] };
        }
      }

      if (geometry) {
        features.push({ type: 'Feature', geometry, properties });
      }
    }

    const geojson = { type: 'FeatureCollection', features };

    return {
      success: true,
      content: JSON.stringify(geojson, null, 2),
      filename: options.filename?.replace(/\.xtf$/i, '.geojson') || 'interlis2.geojson',
      mimeType: MIME_TYPES.geojson
    };
  } catch (error) {
    return {
      success: false,
      filename: 'error.geojson',
      mimeType: MIME_TYPES.geojson,
      error: `Erreur parsing XTF: ${String(error)}`
    };
  }
}

// ============================================
// Available Conversions
// ============================================

export const AVAILABLE_CONVERSIONS: Array<{ from: AllFormat; to: AllFormat; label: string }> = [
  // Text conversions
  { from: 'txt', to: 'md', label: 'Texte → Markdown' },
  { from: 'md', to: 'html', label: 'Markdown → HTML' },
  { from: 'json', to: 'csv', label: 'JSON → CSV' },
  { from: 'csv', to: 'json', label: 'CSV → JSON' },
  { from: 'json', to: 'xml', label: 'JSON → XML' },
  { from: 'xml', to: 'json', label: 'XML → JSON' },
  // Geo conversions
  { from: 'geojson', to: 'wkt', label: 'GeoJSON → WKT' },
  { from: 'wkt', to: 'geojson', label: 'WKT → GeoJSON' },
  { from: 'geojson', to: 'kml', label: 'GeoJSON → KML' },
  { from: 'kml', to: 'geojson', label: 'KML → GeoJSON' },
  { from: 'geojson', to: 'gpx', label: 'GeoJSON → GPX' },
  { from: 'gpx', to: 'geojson', label: 'GPX → GeoJSON' },
  { from: 'geojson', to: 'gml', label: 'GeoJSON → GML' },
  { from: 'geojson', to: 'csv', label: 'GeoJSON → CSV' },
  { from: 'csv', to: 'geojson', label: 'CSV → GeoJSON (lat/lon)' },
  // DXF/DWG (CAD)
  { from: 'dxf', to: 'geojson', label: 'DXF → GeoJSON' },
  { from: 'dwg', to: 'geojson', label: 'DWG → GeoJSON (via ODA)' },
  // Interlis (Swiss cadastre)
  { from: 'itf', to: 'geojson', label: 'ITF → GeoJSON (Interlis 1)' },
  { from: 'xtf', to: 'geojson', label: 'XTF → GeoJSON (Interlis 2)' }
];

export function getAvailableConversions(fromFormat: AllFormat): Array<{ to: AllFormat; label: string }> {
  return AVAILABLE_CONVERSIONS
    .filter(c => c.from === fromFormat)
    .map(c => ({ to: c.to, label: c.label }));
}
