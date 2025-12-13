// GeoMind - External Layers Module
// Export des composants et hooks pour l'intégration des géodonnées externes

// Composants
export { default as ExternalLayersManager } from './components/ExternalLayersManager';
export { default as MapViewer } from './components/MapViewer';

// Hooks
export { useExternalLayers, useBasemapLayer } from './hooks/useExternalLayers';

// Configuration
export { default as layerSourcesConfig } from './config/externalLayerSources.json';

// Types
export interface Layer {
  id: string;
  name: string;
  type: 'WMS' | 'WMTS' | 'WFS' | 'XYZ';
  url: string;
  layers?: string;
  format?: string;
  transparent?: boolean;
  attribution: string;
  maxZoom?: number;
  description?: string;
  subdomains?: string[];
}

export interface Category {
  id: string;
  name: string;
  layers: Layer[];
}

export interface Source {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  baseUrl: string;
  categories: Category[];
}

export interface ActiveLayer extends Layer {
  sourceId: string;
  sourceName: string;
  sourceColor: string;
  opacity: number;
  visible: boolean;
  zIndex: number;
}
