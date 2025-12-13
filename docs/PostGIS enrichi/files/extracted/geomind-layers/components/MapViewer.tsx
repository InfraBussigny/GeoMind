import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import ExternalLayersManager from './ExternalLayersManager';
import { useExternalLayers, useBasemapLayer } from '../hooks/useExternalLayers';
import '../styles/ExternalLayersManager.css';
import '../styles/MapViewer.css';

// Configuration initiale de la carte centrée sur Bussigny
const BUSSIGNY_CENTER: [number, number] = [46.5525, 6.5515];
const DEFAULT_ZOOM = 14;

interface ActiveLayer {
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
  sourceId: string;
  sourceName: string;
  sourceColor: string;
  opacity: number;
  visible: boolean;
  zIndex: number;
}

interface MapViewerProps {
  // Props pour la connexion PostGIS existante
  postgisLayers?: any[];
  onPostGISLayerToggle?: (layerId: string, active: boolean) => void;
}

/**
 * Composant MapViewer - Onglet Cartes de GeoMind
 * Intègre les couches PostGIS locales et les géodonnées externes
 */
const MapViewer: React.FC<MapViewerProps> = ({ 
  postgisLayers = [],
  onPostGISLayerToggle 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [activeTab, setActiveTab] = useState<'postgis' | 'external'>('external');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Hook pour les couches externes
  const {
    activeLayers,
    addLayer,
    removeLayer,
    updateLayerOpacity,
    updateLayerVisibility,
    reorderLayers,
    isLoading,
    error
  } = useExternalLayers({ map });

  // Hook pour le fond de carte
  const { currentBasemap, setBasemap } = useBasemapLayer(map);

  // Initialisation de la carte Leaflet
  useEffect(() => {
    if (!mapRef.current || map) return;

    const leafletMap = L.map(mapRef.current, {
      center: BUSSIGNY_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
    });

    // Contrôle de zoom personnalisé
    L.control.zoom({ position: 'topright' }).addTo(leafletMap);

    // Échelle
    L.control.scale({ 
      metric: true, 
      imperial: false,
      position: 'bottomleft' 
    }).addTo(leafletMap);

    // Fond de carte par défaut (swisstopo gris)
    const defaultBasemap = L.tileLayer(
      'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg',
      {
        attribution: '© swisstopo',
        maxZoom: 20,
      }
    );
    defaultBasemap.addTo(leafletMap);

    setMap(leafletMap);

    return () => {
      leafletMap.remove();
    };
  }, []);

  // Gestionnaire de toggle de couche
  const handleLayerToggle = useCallback((layer: ActiveLayer, active: boolean) => {
    if (active) {
      // Vérifier si c'est une mise à jour (visibilité)
      const existing = activeLayers.find(l => l.id === layer.id);
      if (existing) {
        updateLayerVisibility(layer.id, layer.visible);
      } else {
        addLayer(layer);
      }
    } else {
      removeLayer(layer.id);
    }
  }, [activeLayers, addLayer, removeLayer, updateLayerVisibility]);

  // Gestionnaire de changement d'opacité
  const handleOpacityChange = useCallback((layerId: string, opacity: number) => {
    updateLayerOpacity(layerId, opacity);
  }, [updateLayerOpacity]);

  // Gestionnaire de réorganisation
  const handleLayerOrderChange = useCallback((layers: ActiveLayer[]) => {
    reorderLayers(layers);
  }, [reorderLayers]);

  return (
    <div className="map-viewer">
      {/* Sidebar avec les panneaux de gestion */}
      <aside className={`map-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        {/* Onglets */}
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${activeTab === 'postgis' ? 'active' : ''}`}
            onClick={() => setActiveTab('postgis')}
          >
            <span className="tab-icon">🗄️</span>
            <span className="tab-label">PostGIS</span>
            {postgisLayers.length > 0 && (
              <span className="tab-badge">{postgisLayers.length}</span>
            )}
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'external' ? 'active' : ''}`}
            onClick={() => setActiveTab('external')}
          >
            <span className="tab-icon">🌐</span>
            <span className="tab-label">Externes</span>
            {activeLayers.length > 0 && (
              <span className="tab-badge external">{activeLayers.length}</span>
            )}
          </button>
        </div>

        {/* Contenu des onglets */}
        <div className="sidebar-content">
          {activeTab === 'postgis' && (
            <div className="postgis-panel">
              <div className="panel-header">
                <h3>Couches PostGIS</h3>
                <p className="panel-subtitle">
                  Base de données communale de Bussigny
                </p>
              </div>
              
              {postgisLayers.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🗄️</span>
                  <p>Aucune couche PostGIS configurée</p>
                  <small>
                    Connectez-vous à la base de données dans le module 
                    "Bases de données" pour ajouter des couches.
                  </small>
                </div>
              ) : (
                <div className="postgis-layers-list">
                  {postgisLayers.map(layer => (
                    <div key={layer.id} className="postgis-layer-item">
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        onChange={() => onPostGISLayerToggle?.(layer.id, !layer.visible)}
                      />
                      <span>{layer.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'external' && (
            <ExternalLayersManager
              activeLayers={activeLayers}
              onLayerToggle={handleLayerToggle}
              onLayerOpacityChange={handleOpacityChange}
              onLayerOrderChange={handleLayerOrderChange}
            />
          )}
        </div>

        {/* Bouton toggle sidebar */}
        <button 
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? 'Réduire' : 'Agrandir'}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </aside>

      {/* Zone de carte */}
      <main className="map-container">
        <div ref={mapRef} className="leaflet-map" />
        
        {/* Indicateur de chargement */}
        {isLoading && (
          <div className="map-loading-indicator">
            <div className="spinner" />
            <span>Chargement des couches...</span>
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="map-error-toast">
            <span>⚠️ {error}</span>
            <button onClick={() => {}}>✕</button>
          </div>
        )}

        {/* Légende des couches actives */}
        {activeLayers.length > 0 && (
          <div className="map-legend">
            <h4>Couches actives</h4>
            {activeLayers.filter(l => l.visible).map(layer => (
              <div 
                key={layer.id} 
                className="legend-item"
                style={{ borderLeftColor: layer.sourceColor }}
              >
                <span className="legend-color" style={{ backgroundColor: layer.sourceColor }} />
                <span className="legend-name">{layer.name}</span>
                <span className="legend-source">{layer.sourceName}</span>
              </div>
            ))}
          </div>
        )}

        {/* Coordonnées de la souris */}
        <div className="map-coordinates" id="map-coords">
          {BUSSIGNY_CENTER[0].toFixed(6)}, {BUSSIGNY_CENTER[1].toFixed(6)}
        </div>
      </main>
    </div>
  );
};

export default MapViewer;
