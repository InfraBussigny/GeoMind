/**
 * GeoBrain Map Sources Service
 * Gestion des sources cartographiques (WMS, WFS, WMTS, GeoJSON)
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================
// Types
// ============================================

export type MapSourceType = 'wms' | 'wfs' | 'wmts' | 'geojson' | 'xyz';

export interface MapSource {
  id: string;
  name: string;
  type: MapSourceType;
  url: string;
  layers?: string[];
  format?: string;
  version?: string;
  attribution?: string;
  minZoom?: number;
  maxZoom?: number;
  projection?: string;
  username?: string;
  password?: string;
  isActive: boolean;
  isDefault: boolean;
  category: string;
}

export interface MapLayer {
  id: string;
  sourceId: string;
  name: string;
  title: string;
  abstract?: string;
  visible: boolean;
  opacity: number;
  minZoom?: number;
  maxZoom?: number;
  legendUrl?: string;
  queryable?: boolean;
  styles?: string[];
}

export interface WMSCapabilities {
  version: string;
  title: string;
  abstract?: string;
  layers: WMSLayer[];
}

export interface WMSLayer {
  name: string;
  title: string;
  abstract?: string;
  queryable: boolean;
  styles: Array<{ name: string; title: string; legendUrl?: string }>;
  boundingBox?: [number, number, number, number];
  minScale?: number;
  maxScale?: number;
}

// ============================================
// Constants - Preconfigured Sources
// ============================================

export const DEFAULT_SOURCES: MapSource[] = [
  // Suisse
  {
    id: 'swisstopo-wmts',
    name: 'Swisstopo',
    type: 'wmts',
    url: 'https://wmts.geo.admin.ch/1.0.0/WMTSCapabilities.xml',
    attribution: '© swisstopo',
    projection: 'EPSG:2056',
    isActive: true,
    isDefault: true,
    category: 'Suisse'
  },
  {
    id: 'swisstopo-wms',
    name: 'Swisstopo WMS',
    type: 'wms',
    url: 'https://wms.geo.admin.ch/',
    version: '1.3.0',
    attribution: '© swisstopo',
    projection: 'EPSG:2056',
    isActive: false,
    isDefault: false,
    category: 'Suisse'
  },

  // Canton de Vaud
  {
    id: 'vd-geoportail',
    name: 'Géoportail VD',
    type: 'wms',
    url: 'https://www.geo.vd.ch/main/wsgi/mapserv_proxy',
    version: '1.3.0',
    attribution: '© Canton de Vaud',
    projection: 'EPSG:2056',
    isActive: false,
    isDefault: false,
    category: 'Canton VD'
  },
  {
    id: 'asit-vd',
    name: 'ASIT-VD',
    type: 'wms',
    url: 'https://www.asitvd.ch/cgi-bin/mapserv',
    version: '1.1.1',
    attribution: '© ASIT-VD',
    projection: 'EPSG:2056',
    isActive: false,
    isDefault: false,
    category: 'Canton VD'
  },

  // Bussigny
  {
    id: 'bussigny-geoportail',
    name: 'Géoportail Bussigny',
    type: 'wms',
    url: 'https://geo.bussigny.ch/qgis/wms',
    version: '1.3.0',
    attribution: '© Commune de Bussigny',
    projection: 'EPSG:2056',
    isActive: true,
    isDefault: false,
    category: 'Bussigny'
  },

  // OpenStreetMap
  {
    id: 'osm-standard',
    name: 'OpenStreetMap',
    type: 'xyz',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    minZoom: 0,
    maxZoom: 19,
    isActive: true,
    isDefault: false,
    category: 'Fonds de plan'
  },
  {
    id: 'osm-topo',
    name: 'OpenTopoMap',
    type: 'xyz',
    url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap',
    minZoom: 0,
    maxZoom: 17,
    isActive: false,
    isDefault: false,
    category: 'Fonds de plan'
  },

  // Satellite
  {
    id: 'esri-satellite',
    name: 'ESRI Satellite',
    type: 'xyz',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© ESRI',
    minZoom: 0,
    maxZoom: 19,
    isActive: false,
    isDefault: false,
    category: 'Satellite'
  }
];

// ============================================
// Store
// ============================================

const STORAGE_KEY = 'geobrain_map_sources';

function loadSources(): MapSource[] {
  if (!browser) return DEFAULT_SOURCES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const custom = JSON.parse(stored) as MapSource[];
      // Merge with defaults (keep custom overrides)
      const merged = [...DEFAULT_SOURCES];
      for (const source of custom) {
        const existing = merged.findIndex(s => s.id === source.id);
        if (existing >= 0) {
          merged[existing] = { ...merged[existing], ...source };
        } else {
          merged.push(source);
        }
      }
      return merged;
    }
  } catch (e) {
    console.error('Failed to load map sources:', e);
  }
  return DEFAULT_SOURCES;
}

function saveSources(sources: MapSource[]) {
  if (!browser) return;
  // Only save non-default or modified sources
  const toSave = sources.filter(s => {
    const def = DEFAULT_SOURCES.find(d => d.id === s.id);
    if (!def) return true; // Custom source
    // Check if modified
    return JSON.stringify(s) !== JSON.stringify(def);
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function createMapSourcesStore() {
  const { subscribe, set, update } = writable<MapSource[]>(loadSources());

  return {
    subscribe,

    addSource(source: Omit<MapSource, 'id'>) {
      update(sources => {
        const newSource: MapSource = {
          ...source,
          id: `custom_${Date.now()}`
        };
        const updated = [...sources, newSource];
        saveSources(updated);
        return updated;
      });
    },

    updateSource(id: string, changes: Partial<MapSource>) {
      update(sources => {
        const updated = sources.map(s =>
          s.id === id ? { ...s, ...changes } : s
        );
        saveSources(updated);
        return updated;
      });
    },

    removeSource(id: string) {
      update(sources => {
        // Don't remove default sources
        if (DEFAULT_SOURCES.some(s => s.id === id)) return sources;
        const updated = sources.filter(s => s.id !== id);
        saveSources(updated);
        return updated;
      });
    },

    toggleActive(id: string) {
      update(sources => {
        const updated = sources.map(s =>
          s.id === id ? { ...s, isActive: !s.isActive } : s
        );
        saveSources(updated);
        return updated;
      });
    },

    getByCategory(): Map<string, MapSource[]> {
      const sources = get({ subscribe });
      const byCategory = new Map<string, MapSource[]>();
      for (const source of sources) {
        const cat = source.category || 'Autres';
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(source);
      }
      return byCategory;
    },

    getActive(): MapSource[] {
      return get({ subscribe }).filter(s => s.isActive);
    },

    reset() {
      if (browser) localStorage.removeItem(STORAGE_KEY);
      set(DEFAULT_SOURCES);
    }
  };
}

export const mapSourcesStore = createMapSourcesStore();

// ============================================
// Layers Store
// ============================================

const LAYERS_KEY = 'geobrain_map_layers';

function loadLayers(): MapLayer[] {
  if (!browser) return [];
  try {
    const stored = localStorage.getItem(LAYERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function createLayersStore() {
  const { subscribe, set, update } = writable<MapLayer[]>(loadLayers());

  // Auto-save
  if (browser) {
    subscribe(layers => {
      localStorage.setItem(LAYERS_KEY, JSON.stringify(layers));
    });
  }

  return {
    subscribe,

    addLayer(layer: Omit<MapLayer, 'id'>) {
      update(layers => [...layers, {
        ...layer,
        id: `layer_${Date.now()}`
      }]);
    },

    removeLayer(id: string) {
      update(layers => layers.filter(l => l.id !== id));
    },

    toggleVisibility(id: string) {
      update(layers => layers.map(l =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ));
    },

    setOpacity(id: string, opacity: number) {
      update(layers => layers.map(l =>
        l.id === id ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l
      ));
    },

    reorder(fromIndex: number, toIndex: number) {
      update(layers => {
        const result = [...layers];
        const [moved] = result.splice(fromIndex, 1);
        result.splice(toIndex, 0, moved);
        return result;
      });
    },

    clear() {
      set([]);
    }
  };
}

export const layersStore = createLayersStore();

// ============================================
// WMS Capabilities Parser
// ============================================

export async function getWMSCapabilities(url: string, version = '1.3.0'): Promise<WMSCapabilities> {
  const separator = url.includes('?') ? '&' : '?';
  const capUrl = `${url}${separator}SERVICE=WMS&REQUEST=GetCapabilities&VERSION=${version}`;

  const response = await fetch(capUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  // Parse service info
  const service = doc.querySelector('Service');
  const title = service?.querySelector('Title')?.textContent || 'Unknown';
  const abstract = service?.querySelector('Abstract')?.textContent || undefined;

  // Parse layers
  const layers: WMSLayer[] = [];
  const layerElements = doc.querySelectorAll('Layer > Layer');

  layerElements.forEach(layerEl => {
    const name = layerEl.querySelector('Name')?.textContent;
    if (!name) return;

    const layerTitle = layerEl.querySelector('Title')?.textContent || name;
    const layerAbstract = layerEl.querySelector('Abstract')?.textContent;
    const queryable = layerEl.getAttribute('queryable') === '1';

    // Parse styles
    const styles: WMSLayer['styles'] = [];
    layerEl.querySelectorAll('Style').forEach(styleEl => {
      const styleName = styleEl.querySelector('Name')?.textContent || 'default';
      const styleTitle = styleEl.querySelector('Title')?.textContent || styleName;
      const legendUrl = styleEl.querySelector('LegendURL OnlineResource')?.getAttribute('xlink:href');
      styles.push({ name: styleName, title: styleTitle, legendUrl: legendUrl || undefined });
    });

    layers.push({
      name,
      title: layerTitle,
      abstract: layerAbstract || undefined,
      queryable,
      styles
    });
  });

  return {
    version,
    title,
    abstract,
    layers
  };
}

// ============================================
// WFS Capabilities Parser
// ============================================

export async function getWFSCapabilities(url: string, version = '2.0.0'): Promise<{ layers: string[] }> {
  const separator = url.includes('?') ? '&' : '?';
  const capUrl = `${url}${separator}SERVICE=WFS&REQUEST=GetCapabilities&VERSION=${version}`;

  const response = await fetch(capUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  const layers: string[] = [];
  doc.querySelectorAll('FeatureType Name, FeatureTypeList FeatureType Name').forEach(el => {
    if (el.textContent) layers.push(el.textContent);
  });

  return { layers };
}

// ============================================
// Swiss Geocoding (api3.geo.admin.ch)
// ============================================

export interface GeocodingResult {
  label: string;
  x: number;
  y: number;
  bbox?: [number, number, number, number];
  type: string;
}

export async function geocodeSwiss(query: string, limit = 10): Promise<GeocodingResult[]> {
  const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(query)}&type=locations&limit=${limit}&sr=2056`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();

    return (data.results || []).map((r: {
      attrs: {
        label: string;
        x: number;
        y: number;
        geom_st_box2d?: string;
        origin: string;
      };
    }) => ({
      label: r.attrs.label.replace(/<[^>]*>/g, ''),
      x: r.attrs.x,
      y: r.attrs.y,
      bbox: r.attrs.geom_st_box2d ? parseBBox(r.attrs.geom_st_box2d) : undefined,
      type: r.attrs.origin
    }));
  } catch (e) {
    console.error('Geocoding error:', e);
    return [];
  }
}

function parseBBox(box2d: string): [number, number, number, number] | undefined {
  // Format: BOX(x1 y1,x2 y2)
  const match = box2d.match(/BOX\(([0-9.]+)\s+([0-9.]+),([0-9.]+)\s+([0-9.]+)\)/);
  if (!match) return undefined;
  return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4])];
}

// ============================================
// Coordinate Transformation (CH1903+ / WGS84)
// ============================================

export function lv95ToWgs84(e: number, n: number): [number, number] {
  // Simplified approximate transformation
  const e1 = (e - 2600000) / 1000000;
  const n1 = (n - 1200000) / 1000000;

  const lon = 2.6779094 +
    4.728982 * e1 +
    0.791484 * e1 * n1 +
    0.1306 * e1 * n1 * n1 -
    0.0436 * e1 * e1 * e1;

  const lat = 16.9023892 +
    3.238272 * n1 -
    0.270978 * e1 * e1 -
    0.002528 * n1 * n1 -
    0.0447 * e1 * e1 * n1 -
    0.014 * n1 * n1 * n1;

  return [lon * 100 / 36, lat * 100 / 36];
}

export function wgs84ToLv95(lon: number, lat: number): [number, number] {
  const lon1 = (lon * 3600 - 26782.5) / 10000;
  const lat1 = (lat * 3600 - 169028.66) / 10000;

  const e = 2600072.37 +
    211455.93 * lon1 -
    10938.51 * lon1 * lat1 -
    0.36 * lon1 * lat1 * lat1 -
    44.54 * lon1 * lon1 * lon1;

  const n = 1200147.07 +
    308807.95 * lat1 +
    3745.25 * lon1 * lon1 +
    76.63 * lat1 * lat1 -
    194.56 * lon1 * lon1 * lat1 +
    119.79 * lat1 * lat1 * lat1;

  return [e, n];
}
