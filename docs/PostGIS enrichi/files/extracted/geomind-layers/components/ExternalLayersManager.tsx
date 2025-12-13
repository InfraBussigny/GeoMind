import React, { useState, useCallback, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Layers, 
  Settings,
  GripVertical,
  Info,
  RefreshCw,
  Search,
  X,
  ExternalLink
} from 'lucide-react';
import layerSourcesConfig from '../config/externalLayerSources.json';

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

interface Category {
  id: string;
  name: string;
  layers: Layer[];
}

interface Source {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  baseUrl: string;
  categories: Category[];
}

interface ActiveLayer extends Layer {
  sourceId: string;
  sourceName: string;
  sourceColor: string;
  opacity: number;
  visible: boolean;
  zIndex: number;
}

interface ExternalLayersManagerProps {
  onLayerToggle: (layer: ActiveLayer, active: boolean) => void;
  onLayerOpacityChange: (layerId: string, opacity: number) => void;
  onLayerOrderChange: (layers: ActiveLayer[]) => void;
  activeLayers: ActiveLayer[];
}

// Composant pour une couche individuelle
const LayerItem: React.FC<{
  layer: Layer;
  source: Source;
  isActive: boolean;
  activeLayer?: ActiveLayer;
  onToggle: (layer: Layer, source: Source) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
}> = ({ layer, source, isActive, activeLayer, onToggle, onOpacityChange }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="layer-item">
      <div className="layer-item-main">
        <button
          className={`layer-toggle ${isActive ? 'active' : ''}`}
          onClick={() => onToggle(layer, source)}
          style={{ 
            borderColor: isActive ? source.color : 'transparent',
            backgroundColor: isActive ? `${source.color}15` : 'transparent'
          }}
        >
          {isActive ? (
            <Eye size={14} style={{ color: source.color }} />
          ) : (
            <EyeOff size={14} className="text-muted" />
          )}
        </button>
        
        <span className="layer-name" title={layer.name}>
          {layer.name}
        </span>
        
        <div className="layer-actions">
          <span className="layer-type-badge">{layer.type}</span>
          {layer.description && (
            <button 
              className="layer-info-btn"
              onClick={() => setShowDetails(!showDetails)}
              title="Informations"
            >
              <Info size={12} />
            </button>
          )}
        </div>
      </div>
      
      {isActive && activeLayer && (
        <div className="layer-opacity-control">
          <span className="opacity-label">Opacité</span>
          <input
            type="range"
            min="0"
            max="100"
            value={activeLayer.opacity}
            onChange={(e) => onOpacityChange(layer.id, parseInt(e.target.value))}
            className="opacity-slider"
            style={{ 
              accentColor: source.color 
            }}
          />
          <span className="opacity-value">{activeLayer.opacity}%</span>
        </div>
      )}
      
      {showDetails && layer.description && (
        <div className="layer-details">
          <p>{layer.description}</p>
          <small className="layer-attribution">{layer.attribution}</small>
        </div>
      )}
    </div>
  );
};

// Composant pour une catégorie
const CategorySection: React.FC<{
  category: Category;
  source: Source;
  activeLayers: ActiveLayer[];
  onLayerToggle: (layer: Layer, source: Source) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
  searchTerm: string;
}> = ({ category, source, activeLayers, onLayerToggle, onOpacityChange, searchTerm }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const filteredLayers = useMemo(() => {
    if (!searchTerm) return category.layers;
    return category.layers.filter(layer => 
      layer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      layer.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [category.layers, searchTerm]);

  if (filteredLayers.length === 0) return null;

  const activeCount = filteredLayers.filter(l => 
    activeLayers.some(al => al.id === l.id)
  ).length;

  return (
    <div className="category-section">
      <button 
        className="category-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="category-name">{category.name}</span>
        {activeCount > 0 && (
          <span 
            className="category-badge"
            style={{ backgroundColor: source.color }}
          >
            {activeCount}
          </span>
        )}
      </button>
      
      {isExpanded && (
        <div className="category-layers">
          {filteredLayers.map(layer => (
            <LayerItem
              key={layer.id}
              layer={layer}
              source={source}
              isActive={activeLayers.some(al => al.id === layer.id)}
              activeLayer={activeLayers.find(al => al.id === layer.id)}
              onToggle={onLayerToggle}
              onOpacityChange={onOpacityChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Composant pour une source
const SourceSection: React.FC<{
  source: Source;
  activeLayers: ActiveLayer[];
  onLayerToggle: (layer: Layer, source: Source) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
  searchTerm: string;
}> = ({ source, activeLayers, onLayerToggle, onOpacityChange, searchTerm }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const sourceActiveLayers = activeLayers.filter(al => al.sourceId === source.id);
  
  const hasMatchingLayers = useMemo(() => {
    if (!searchTerm) return true;
    return source.categories.some(cat => 
      cat.layers.some(layer => 
        layer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        layer.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [source.categories, searchTerm]);

  if (!hasMatchingLayers) return null;

  return (
    <div className="source-section">
      <button 
        className="source-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ borderLeftColor: source.color }}
      >
        <div className="source-header-left">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="source-icon">{source.icon}</span>
          <span className="source-name">{source.name}</span>
        </div>
        <div className="source-header-right">
          {sourceActiveLayers.length > 0 && (
            <span 
              className="source-active-count"
              style={{ backgroundColor: source.color }}
            >
              {sourceActiveLayers.length}
            </span>
          )}
          {source.baseUrl && (
            <a 
              href={source.baseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="source-link"
              onClick={e => e.stopPropagation()}
              title="Ouvrir le géoportail source"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="source-content">
          <p className="source-description">{source.description}</p>
          {source.categories.map(category => (
            <CategorySection
              key={category.id}
              category={category}
              source={source}
              activeLayers={activeLayers}
              onLayerToggle={onLayerToggle}
              onOpacityChange={onOpacityChange}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Panneau des couches actives avec drag & drop
const ActiveLayersPanel: React.FC<{
  activeLayers: ActiveLayer[];
  onToggleVisibility: (layerId: string) => void;
  onRemove: (layerId: string) => void;
  onReorder: (layers: ActiveLayer[]) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
}> = ({ activeLayers, onToggleVisibility, onRemove, onReorder, onOpacityChange }) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newLayers = [...activeLayers];
    const [removed] = newLayers.splice(draggedIndex, 1);
    newLayers.splice(index, 0, removed);
    
    // Mettre à jour les zIndex
    const reindexed = newLayers.map((layer, idx) => ({
      ...layer,
      zIndex: newLayers.length - idx
    }));
    
    onReorder(reindexed);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (activeLayers.length === 0) {
    return (
      <div className="active-layers-empty">
        <Layers size={32} className="empty-icon" />
        <p>Aucune couche externe active</p>
        <small>Activez des couches depuis le catalogue ci-dessous</small>
      </div>
    );
  }

  return (
    <div className="active-layers-panel">
      <div className="active-layers-header">
        <h4>
          <Layers size={16} />
          Couches actives ({activeLayers.length})
        </h4>
        <small>Glisser pour réordonner</small>
      </div>
      
      <div className="active-layers-list">
        {activeLayers.map((layer, index) => (
          <div
            key={layer.id}
            className={`active-layer-item ${draggedIndex === index ? 'dragging' : ''}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            style={{ borderLeftColor: layer.sourceColor }}
          >
            <div className="active-layer-drag">
              <GripVertical size={14} />
            </div>
            
            <button
              className={`visibility-toggle ${layer.visible ? 'visible' : 'hidden'}`}
              onClick={() => onToggleVisibility(layer.id)}
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            
            <div className="active-layer-info">
              <span className="active-layer-name">{layer.name}</span>
              <span className="active-layer-source">{layer.sourceName}</span>
            </div>
            
            <div className="active-layer-controls">
              <input
                type="range"
                min="0"
                max="100"
                value={layer.opacity}
                onChange={(e) => onOpacityChange(layer.id, parseInt(e.target.value))}
                className="mini-opacity-slider"
                title={`Opacité: ${layer.opacity}%`}
              />
              <button
                className="remove-layer-btn"
                onClick={() => onRemove(layer.id)}
                title="Retirer la couche"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Composant principal
const ExternalLayersManager: React.FC<ExternalLayersManagerProps> = ({
  onLayerToggle,
  onLayerOpacityChange,
  onLayerOrderChange,
  activeLayers
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCatalog, setShowCatalog] = useState(true);
  
  const sources: Source[] = layerSourcesConfig.sources;

  const handleLayerToggle = useCallback((layer: Layer, source: Source) => {
    const existingIndex = activeLayers.findIndex(al => al.id === layer.id);
    
    if (existingIndex >= 0) {
      // Désactiver la couche
      onLayerToggle(activeLayers[existingIndex], false);
    } else {
      // Activer la couche
      const newActiveLayer: ActiveLayer = {
        ...layer,
        sourceId: source.id,
        sourceName: source.name,
        sourceColor: source.color,
        opacity: 100,
        visible: true,
        zIndex: activeLayers.length + 1
      };
      onLayerToggle(newActiveLayer, true);
    }
  }, [activeLayers, onLayerToggle]);

  const handleToggleVisibility = useCallback((layerId: string) => {
    const layer = activeLayers.find(l => l.id === layerId);
    if (layer) {
      onLayerToggle({ ...layer, visible: !layer.visible }, true);
    }
  }, [activeLayers, onLayerToggle]);

  const handleRemoveLayer = useCallback((layerId: string) => {
    const layer = activeLayers.find(l => l.id === layerId);
    if (layer) {
      onLayerToggle(layer, false);
    }
  }, [activeLayers, onLayerToggle]);

  return (
    <div className="external-layers-manager">
      {/* En-tête */}
      <div className="elm-header">
        <h3>
          <Layers size={20} />
          Géodonnées externes
        </h3>
        <div className="elm-header-actions">
          <button 
            className="elm-btn"
            onClick={() => setShowCatalog(!showCatalog)}
            title={showCatalog ? 'Masquer le catalogue' : 'Afficher le catalogue'}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Panneau des couches actives */}
      <ActiveLayersPanel
        activeLayers={activeLayers}
        onToggleVisibility={handleToggleVisibility}
        onRemove={handleRemoveLayer}
        onReorder={onLayerOrderChange}
        onOpacityChange={onLayerOpacityChange}
      />

      {/* Catalogue des sources */}
      {showCatalog && (
        <div className="elm-catalog">
          <div className="elm-search">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Rechercher une couche..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button 
                className="search-clear"
                onClick={() => setSearchTerm('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="elm-sources-list">
            {sources.map(source => (
              <SourceSection
                key={source.id}
                source={source}
                activeLayers={activeLayers}
                onLayerToggle={handleLayerToggle}
                onOpacityChange={onLayerOpacityChange}
                searchTerm={searchTerm}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalLayersManager;
