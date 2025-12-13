import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Types
interface Layer {
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

interface ActiveLayer extends Layer {
  sourceId: string;
  sourceName: string;
  sourceColor: string;
  opacity: number;
  visible: boolean;
  zIndex: number;
}

interface UseExternalLayersOptions {
  map: L.Map | null;
  crs?: L.CRS;
}

interface UseExternalLayersReturn {
  activeLayers: ActiveLayer[];
  addLayer: (layer: ActiveLayer) => void;
  removeLayer: (layerId: string) => void;
  updateLayerOpacity: (layerId: string, opacity: number) => void;
  updateLayerVisibility: (layerId: string, visible: boolean) => void;
  reorderLayers: (layers: ActiveLayer[]) => void;
  clearAllLayers: () => void;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook personnalisé pour gérer les couches externes WMS/WMTS/XYZ avec Leaflet
 * Optimisé pour les géodonnées suisses (EPSG:2056)
 */
export const useExternalLayers = ({ 
  map, 
  crs 
}: UseExternalLayersOptions): UseExternalLayersReturn => {
  const [activeLayers, setActiveLayers] = useState<ActiveLayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Référence aux couches Leaflet pour la manipulation directe
  const leafletLayersRef = useRef<Map<string, L.TileLayer | L.TileLayer.WMS>>(new Map());

  /**
   * Crée une couche Leaflet selon le type
   */
  const createLeafletLayer = useCallback((layer: ActiveLayer): L.TileLayer | L.TileLayer.WMS | null => {
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
          // Pour les services WMTS suisses, on utilise une URL template
          return L.tileLayer(layer.url, {
            attribution: layer.attribution,
            maxZoom: layer.maxZoom || 20,
            opacity: layer.opacity / 100,
            // Les tuiles suisses utilisent souvent des paramètres différents
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
  }, []);

  /**
   * Ajoute une couche externe à la carte
   */
  const addLayer = useCallback((layer: ActiveLayer) => {
    if (!map) {
      setError('La carte n\'est pas initialisée');
      return;
    }

    // Vérifier si la couche existe déjà
    if (leafletLayersRef.current.has(layer.id)) {
      console.warn(`La couche ${layer.id} existe déjà`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const leafletLayer = createLeafletLayer(layer);
      
      if (!leafletLayer) {
        throw new Error(`Impossible de créer la couche ${layer.name}`);
      }

      // Ajouter à la carte si visible
      if (layer.visible) {
        leafletLayer.addTo(map);
      }

      // Définir le z-index
      if (leafletLayer.setZIndex) {
        leafletLayer.setZIndex(layer.zIndex);
      }

      // Stocker la référence
      leafletLayersRef.current.set(layer.id, leafletLayer);

      // Mettre à jour l'état
      setActiveLayers(prev => [...prev, layer]);

      // Événements de chargement
      leafletLayer.on('loading', () => setIsLoading(true));
      leafletLayer.on('load', () => setIsLoading(false));
      leafletLayer.on('tileerror', (e) => {
        console.error(`Erreur de tuile pour ${layer.id}:`, e);
        setError(`Erreur de chargement pour ${layer.name}`);
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  }, [map, createLeafletLayer]);

  /**
   * Supprime une couche de la carte
   */
  const removeLayer = useCallback((layerId: string) => {
    const leafletLayer = leafletLayersRef.current.get(layerId);
    
    if (leafletLayer && map) {
      map.removeLayer(leafletLayer);
      leafletLayersRef.current.delete(layerId);
    }

    setActiveLayers(prev => prev.filter(l => l.id !== layerId));
  }, [map]);

  /**
   * Met à jour l'opacité d'une couche
   */
  const updateLayerOpacity = useCallback((layerId: string, opacity: number) => {
    const leafletLayer = leafletLayersRef.current.get(layerId);
    
    if (leafletLayer) {
      leafletLayer.setOpacity(opacity / 100);
    }

    setActiveLayers(prev => 
      prev.map(l => l.id === layerId ? { ...l, opacity } : l)
    );
  }, []);

  /**
   * Met à jour la visibilité d'une couche
   */
  const updateLayerVisibility = useCallback((layerId: string, visible: boolean) => {
    const leafletLayer = leafletLayersRef.current.get(layerId);
    
    if (leafletLayer && map) {
      if (visible) {
        leafletLayer.addTo(map);
      } else {
        map.removeLayer(leafletLayer);
      }
    }

    setActiveLayers(prev => 
      prev.map(l => l.id === layerId ? { ...l, visible } : l)
    );
  }, [map]);

  /**
   * Réorganise l'ordre des couches (z-index)
   */
  const reorderLayers = useCallback((newOrder: ActiveLayer[]) => {
    newOrder.forEach((layer, index) => {
      const leafletLayer = leafletLayersRef.current.get(layer.id);
      if (leafletLayer && leafletLayer.setZIndex) {
        leafletLayer.setZIndex(newOrder.length - index);
      }
    });

    setActiveLayers(newOrder);
  }, []);

  /**
   * Supprime toutes les couches externes
   */
  const clearAllLayers = useCallback(() => {
    leafletLayersRef.current.forEach((leafletLayer, layerId) => {
      if (map) {
        map.removeLayer(leafletLayer);
      }
    });
    
    leafletLayersRef.current.clear();
    setActiveLayers([]);
  }, [map]);

  /**
   * Nettoyage lors du démontage
   */
  useEffect(() => {
    return () => {
      clearAllLayers();
    };
  }, [clearAllLayers]);

  return {
    activeLayers,
    addLayer,
    removeLayer,
    updateLayerOpacity,
    updateLayerVisibility,
    reorderLayers,
    clearAllLayers,
    isLoading,
    error,
  };
};

/**
 * Hook pour les couches de fond (basemaps)
 * Permet de changer le fond de carte sans empiler les couches
 */
export const useBasemapLayer = (map: L.Map | null) => {
  const [currentBasemap, setCurrentBasemap] = useState<string | null>(null);
  const basemapLayerRef = useRef<L.TileLayer | null>(null);

  const setBasemap = useCallback((layer: ActiveLayer | null) => {
    if (!map) return;

    // Supprimer l'ancien fond de carte
    if (basemapLayerRef.current) {
      map.removeLayer(basemapLayerRef.current);
      basemapLayerRef.current = null;
    }

    if (!layer) {
      setCurrentBasemap(null);
      return;
    }

    // Créer le nouveau fond de carte
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
      // Ajouter en arrière-plan (z-index bas)
      newBasemap.addTo(map);
      newBasemap.setZIndex(0);
      basemapLayerRef.current = newBasemap;
      setCurrentBasemap(layer.id);
    }
  }, [map]);

  return { currentBasemap, setBasemap };
};

export default useExternalLayers;
