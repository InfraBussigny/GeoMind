/**
 * GeoMind File Converter Service
 * Conversion de fichiers entre différents formats
 *
 * Formats supportés:
 * - Texte: TXT, MD, HTML, JSON, CSV
 * - Documents: PDF (via backend), DOCX (via backend)
 * - Géo: GeoJSON, Shapefile info, WKT
 */

import { browser } from '$app/environment';

// ============================================
// Types
// ============================================

export type TextFormat = 'txt' | 'md' | 'html' | 'json' | 'csv' | 'sql' | 'py' | 'yaml';
export type GeoFormat = 'geojson' | 'wkt' | 'kml';
export type DocumentFormat = 'pdf' | 'docx';
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
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  json: 'application/json',
  csv: 'text/csv',
  sql: 'application/sql',
  py: 'text/x-python',
  yaml: 'text/yaml',
  geojson: 'application/geo+json',
  wkt: 'text/plain',
  kml: 'application/vnd.google-earth.kml+xml',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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
    'txt_to_md': textToMarkdown,
    'md_to_html': markdownToHtml,
    'json_to_csv': jsonToCsv,
    'csv_to_json': csvToJson,
    'geojson_to_wkt': (c) => geojsonToWkt(c),
    'wkt_to_geojson': (c) => wktToGeojson(c),
    'geojson_to_kml': geojsonToKml
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
// Available Conversions
// ============================================

export const AVAILABLE_CONVERSIONS: Array<{ from: AllFormat; to: AllFormat; label: string }> = [
  { from: 'txt', to: 'md', label: 'Texte → Markdown' },
  { from: 'md', to: 'html', label: 'Markdown → HTML' },
  { from: 'json', to: 'csv', label: 'JSON → CSV' },
  { from: 'csv', to: 'json', label: 'CSV → JSON' },
  { from: 'geojson', to: 'wkt', label: 'GeoJSON → WKT' },
  { from: 'wkt', to: 'geojson', label: 'WKT → GeoJSON' },
  { from: 'geojson', to: 'kml', label: 'GeoJSON → KML' }
];

export function getAvailableConversions(fromFormat: AllFormat): Array<{ to: AllFormat; label: string }> {
  return AVAILABLE_CONVERSIONS
    .filter(c => c.from === fromFormat)
    .map(c => ({ to: c.to, label: c.label }));
}
