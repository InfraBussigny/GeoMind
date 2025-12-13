/**
 * Service de gestion des couches externes WMS/WMTS/XYZ
 * Adapté pour GeoMind avec Svelte et Leaflet
 */

import { writable, derived, get } from 'svelte/store';
import L from 'leaflet';
import layerSourcesConfig from '$lib/config/externalLayerSources.json';

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

// Export config
export const layerSources: Source[] = layerSourcesConfig.sources as Source[];
export const defaultCenter = layerSourcesConfig.defaultCenter;
export const defaultBbox = layerSourcesConfig.defaultBbox;

// Stores
export const activeLayers = writable<ActiveLayer[]>([]);
export const isLoadingLayers = writable(false);
export const layerError = writable<string | null>(null);
export const currentBasemap = writable<string | null>(null);

// Référence aux couches Leaflet
const leafletLayersMap = new Map<string, L.TileLayer | L.TileLayer.WMS>();
let basemapLayer: L.TileLayer | null = null;
let currentMap: L.Map | null = null;

/**
 * Initialise le service avec une carte Leaflet
 */
export function initExternalLayers(map: L.Map) {
  currentMap = map;
}

/**
 * Crée une couche Leaflet selon le type
 */
function createLeafletLayer(layer: ActiveLayer): L.TileLayer | L.TileLayer.WMS | null {
  try {
    switch (layer.type) {
      case 'WMS':
        return L.tileLayer.wms(layer.url, {
          layers: layer.layers || '',
          format: layer.format || 'image/png',
          transparent: layer.transparent !== false,
          attribution: layer.attribution,
          maxZoom: layer.maxZoom || 20,
          opacity: layer.opacity / 100,
        });

      case 'WMTS':
        return L.tileLayer(layer.url, {
          attribution: layer.attribution,
          maxZoom: layer.maxZoom || 20,
          opacity: layer.opacity / 100,
          tileSize: 256,
        });

      case 'XYZ':
        return L.tileLayer(layer.url, {
          attribution: layer.attribution,
          maxZoom: layer.maxZoom || 19,
          subdomains: layer.subdomains || ['a', 'b', 'c'],
          opacity: layer.opacity / 100,
        });

      default:
        console.warn(`Type de couche non supporté: ${layer.type}`);
        return null;
    }
  } catch (err) {
    console.error(`Erreur lors de la création de la couche ${layer.id}:`, err);
    return null;
  }
}

/**
 * Ajoute une couche externe à la carte
 */
export function addLayer(layer: ActiveLayer): boolean {
  if (!currentMap) {
    layerError.set('La carte n\'est pas initialisée');
    return false;
  }

  if (leafletLayersMap.has(layer.id)) {
    console.warn(`La couche ${layer.id} existe déjà`);
    return false;
  }

  isLoadingLayers.set(true);
  layerError.set(null);

  try {
    const leafletLayer = createLeafletLayer(layer);

    if (!leafletLayer) {
      throw new Error(`Impossible de créer la couche ${layer.name}`);
    }

    if (layer.visible) {
      leafletLayer.addTo(currentMap);
    }

    if (leafletLayer.setZIndex) {
      leafletLayer.setZIndex(layer.zIndex);
    }

    leafletLayersMap.set(layer.id, leafletLayer);

    activeLayers.update(layers => [...layers, layer]);

    leafletLayer.on('loading', () => isLoadingLayers.set(true));
    leafletLayer.on('load', () => isLoadingLayers.set(false));
    leafletLayer.on('tileerror', (e: L.TileErrorEvent) => {
      console.error(`Erreur de tuile pour ${layer.id}:`, e);
      layerError.set(`Erreur de chargement pour ${layer.name}`);
    });

    return true;
  } catch (err) {
    layerError.set(err instanceof Error ? err.message : 'Erreur inconnue');
    return false;
  } finally {
    isLoadingLayers.set(false);
  }
}

/**
 * Supprime une couche de la carte
 */
export function removeLayer(layerId: string) {
  const leafletLayer = leafletLayersMap.get(layerId);

  if (leafletLayer && currentMap) {
    currentMap.removeLayer(leafletLayer);
    leafletLayersMap.delete(layerId);
  }

  activeLayers.update(layers => layers.filter(l => l.id !== layerId));
}

/**
 * Met à jour l'opacité d'une couche
 */
export function updateLayerOpacity(layerId: string, opacity: number) {
  const leafletLayer = leafletLayersMap.get(layerId);

  if (leafletLayer) {
    leafletLayer.setOpacity(opacity / 100);
  }

  activeLayers.update(layers =>
    layers.map(l => l.id === layerId ? { ...l, opacity } : l)
  );
}

/**
 * Met à jour la visibilité d'une couche
 */
export function updateLayerVisibility(layerId: string, visible: boolean) {
  const leafletLayer = leafletLayersMap.get(layerId);

  if (leafletLayer && currentMap) {
    if (visible) {
      leafletLayer.addTo(currentMap);
    } else {
      currentMap.removeLayer(leafletLayer);
    }
  }

  activeLayers.update(layers =>
    layers.map(l => l.id === layerId ? { ...l, visible } : l)
  );
}

/**
 * Réorganise l'ordre des couches (z-index)
 */
export function reorderLayers(newOrder: ActiveLayer[]) {
  newOrder.forEach((layer, index) => {
    const leafletLayer = leafletLayersMap.get(layer.id);
    if (leafletLayer && leafletLayer.setZIndex) {
      leafletLayer.setZIndex(newOrder.length - index);
    }
  });

  activeLayers.set(newOrder);
}

/**
 * Supprime toutes les couches externes
 */
export function clearAllLayers() {
  leafletLayersMap.forEach((leafletLayer) => {
    if (currentMap) {
      currentMap.removeLayer(leafletLayer);
    }
  });

  leafletLayersMap.clear();
  activeLayers.set([]);
}

/**
 * Change le fond de carte (basemap)
 */
export function setBasemap(layer: ActiveLayer | null) {
  if (!currentMap) return;

  // Supprimer l'ancien fond de carte
  if (basemapLayer) {
    currentMap.removeLayer(basemapLayer);
    basemapLayer = null;
  }

  if (!layer) {
    currentBasemap.set(null);
    return;
  }

  let newBasemap: L.TileLayer | null = null;

  switch (layer.type) {
    case 'WMTS':
      newBasemap = L.tileLayer(layer.url, {
        attribution: layer.attribution,
        maxZoom: layer.maxZoom || 20,
      });
      break;

    case 'XYZ':
      newBasemap = L.tileLayer(layer.url, {
        attribution: layer.attribution,
        maxZoom: layer.maxZoom || 19,
        subdomains: layer.subdomains || ['a', 'b', 'c'],
      });
      break;

    default:
      console.warn('Les fonds de carte doivent être de type WMTS ou XYZ');
      return;
  }

  if (newBasemap) {
    newBasemap.addTo(currentMap);
    newBasemap.setZIndex(0);
    basemapLayer = newBasemap;
    currentBasemap.set(layer.id);
  }
}

/**
 * Toggle une couche (ajouter ou supprimer)
 */
export function toggleLayer(layer: Layer, source: Source) {
  const layers = get(activeLayers);
  const existingIndex = layers.findIndex(al => al.id === layer.id);

  if (existingIndex >= 0) {
    removeLayer(layer.id);
  } else {
    const newActiveLayer: ActiveLayer = {
      ...layer,
      sourceId: source.id,
      sourceName: source.name,
      sourceColor: source.color,
      opacity: 100,
      visible: true,
      zIndex: layers.length + 1
    };
    addLayer(newActiveLayer);
  }
}

/**
 * Recherche une couche par ID dans toutes les sources
 */
export function findLayerById(layerId: string): { layer: Layer; source: Source } | null {
  for (const source of layerSources) {
    for (const category of source.categories) {
      const layer = category.layers.find(l => l.id === layerId);
      if (layer) {
        return { layer, source };
      }
    }
  }
  return null;
}

/**
 * Compte le nombre de couches par source
 */
export const layerCountBySource = derived(activeLayers, $activeLayers => {
  const counts: Record<string, number> = {};
  for (const layer of $activeLayers) {
    counts[layer.sourceId] = (counts[layer.sourceId] || 0) + 1;
  }
  return counts;
});

/**
 * Filtre les couches par terme de recherche
 */
export function searchLayers(searchTerm: string): { source: Source; layer: Layer }[] {
  const results: { source: Source; layer: Layer }[] = [];
  const term = searchTerm.toLowerCase();

  for (const source of layerSources) {
    for (const category of source.categories) {
      for (const layer of category.layers) {
        if (
          layer.name.toLowerCase().includes(term) ||
          layer.description?.toLowerCase().includes(term)
        ) {
          results.push({ source, layer });
        }
      }
    }
  }

  return results;
}
