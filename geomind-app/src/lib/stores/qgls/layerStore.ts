import { writable, derived, get } from 'svelte/store';
import type { Layer } from 'ol/layer';

// Types
export interface QGlSLayer {
  id: string;
  name: string;
  type: 'postgis' | 'geojson' | 'wms' | 'wmts' | 'sketch';
  visible: boolean;
  opacity: number;
  zIndex: number;
  source: {
    connectionId?: string;
    schema?: string;
    table?: string;
    geometryColumn?: string;
    srid?: number;
    url?: string;
    geojson?: GeoJSON.FeatureCollection;
  };
  style?: LayerStyle;
  olLayer?: Layer;
  editable: boolean;
  extent?: [number, number, number, number];
}

export interface LayerStyle {
  fill?: { color: string; opacity: number };
  stroke?: { color: string; width: number; lineDash?: number[] };
  symbol?: { type: 'circle' | 'square' | 'triangle'; size: number; color: string };
  label?: { field: string; font: string; color: string; offset: [number, number] };
}

// Stores
export const layers = writable<QGlSLayer[]>([]);
export const selectedLayerId = writable<string | null>(null);

// Derived stores
export const visibleLayers = derived(layers, $layers =>
  $layers.filter(l => l.visible)
);

export const selectedLayer = derived([layers, selectedLayerId], ([$layers, $id]) =>
  $layers.find(l => l.id === $id) || null
);

export const editableLayer = derived([layers, selectedLayerId], ([$layers, $id]) =>
  $layers.find(l => l.id === $id && l.editable) || null
);

// Actions
export function addLayer(layer: Omit<QGlSLayer, 'id' | 'zIndex'>): string {
  const id = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const currentLayers = get(layers);
  const newLayer: QGlSLayer = {
    ...layer,
    id,
    zIndex: currentLayers.length
  };
  layers.set([...currentLayers, newLayer]);
  return id;
}

export function removeLayer(id: string): void {
  layers.update(l => l.filter(layer => layer.id !== id));

  // Clear selection if removed layer was selected
  if (get(selectedLayerId) === id) {
    selectedLayerId.set(null);
  }
}

export function updateLayer(id: string, updates: Partial<QGlSLayer>): void {
  layers.update(l => l.map(layer =>
    layer.id === id ? { ...layer, ...updates } : layer
  ));
}

export function toggleLayerVisibility(id: string): void {
  layers.update(l => l.map(layer =>
    layer.id === id ? { ...layer, visible: !layer.visible } : layer
  ));
}

export function setLayerOpacity(id: string, opacity: number): void {
  layers.update(l => l.map(layer =>
    layer.id === id ? { ...layer, opacity: Math.max(0, Math.min(1, opacity)) } : layer
  ));
}

export function reorderLayers(fromIndex: number, toIndex: number): void {
  layers.update(currentLayers => {
    const newLayers = [...currentLayers];
    const [moved] = newLayers.splice(fromIndex, 1);
    newLayers.splice(toIndex, 0, moved);
    // Update zIndex values
    return newLayers.map((l, i) => ({ ...l, zIndex: i }));
  });
}

export function updateLayerStyle(id: string, style: Partial<LayerStyle>): void {
  layers.update(l => l.map(layer =>
    layer.id === id ? { ...layer, style: { ...layer.style, ...style } } : layer
  ));
}

export function moveLayerUp(id: string): void {
  const currentLayers = get(layers);
  const index = currentLayers.findIndex(l => l.id === id);
  if (index > 0) {
    reorderLayers(index, index - 1);
  }
}

export function moveLayerDown(id: string): void {
  const currentLayers = get(layers);
  const index = currentLayers.findIndex(l => l.id === id);
  if (index < currentLayers.length - 1) {
    reorderLayers(index, index + 1);
  }
}

export function clearLayers(): void {
  layers.set([]);
  selectedLayerId.set(null);
}
