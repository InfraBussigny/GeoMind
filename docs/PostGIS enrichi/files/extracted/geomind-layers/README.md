# GeoMind - Module Géodonnées Externes

Module d'intégration des géodonnées suisses (fédérales, cantonales, régionales) pour l'application GeoMind.

## 📋 Vue d'ensemble

Ce module permet d'ajouter des couches de géodonnées externes au visualiseur cartographique de GeoMind, en complément des données PostGIS communales de Bussigny.

### Fonctionnalités

- ✅ Catalogue structuré par sources (Confédération, Canton VD, ASIT-VD, SDOL, OpenData)
- ✅ Activation/désactivation individuelle des couches
- ✅ Contrôle d'opacité par couche
- ✅ Réorganisation par glisser-déposer (z-index)
- ✅ Recherche dans le catalogue
- ✅ Support WMS, WMTS, XYZ
- ✅ Légende dynamique
- ✅ Indicateurs de chargement et erreurs

## 🗂️ Structure des fichiers

```
geomind-layers/
├── components/
│   ├── ExternalLayersManager.tsx   # Gestionnaire de couches (UI)
│   └── MapViewer.tsx               # Composant carte principal
├── hooks/
│   └── useExternalLayers.ts        # Hook d'intégration Leaflet
├── styles/
│   ├── ExternalLayersManager.css   # Styles du gestionnaire
│   └── MapViewer.css               # Styles de la carte
├── config/
│   └── externalLayerSources.json   # Configuration des sources
├── index.ts                        # Exports du module
└── README.md                       # Cette documentation
```

## 🚀 Intégration dans GeoMind

### 1. Installation des dépendances

```bash
npm install leaflet @types/leaflet lucide-react
```

### 2. Import dans l'application

```tsx
import { MapViewer, ExternalLayersManager } from './geomind-layers';
import './geomind-layers/styles/ExternalLayersManager.css';
import './geomind-layers/styles/MapViewer.css';
```

### 3. Utilisation du composant MapViewer

```tsx
function CarteTab() {
  const [postgisLayers, setPostgisLayers] = useState([
    // Couches PostGIS de Bussigny
  ]);

  const handlePostGISToggle = (layerId: string, active: boolean) => {
    // Logique de toggle
  };

  return (
    <MapViewer 
      postgisLayers={postgisLayers}
      onPostGISLayerToggle={handlePostGISToggle}
    />
  );
}
```

### 4. Utilisation standalone du gestionnaire de couches

```tsx
import { ExternalLayersManager, useExternalLayers } from './geomind-layers';

function CustomMap() {
  const { 
    activeLayers, 
    addLayer, 
    removeLayer,
    updateLayerOpacity,
    reorderLayers 
  } = useExternalLayers({ map: leafletMapInstance });

  return (
    <ExternalLayersManager
      activeLayers={activeLayers}
      onLayerToggle={(layer, active) => active ? addLayer(layer) : removeLayer(layer.id)}
      onLayerOpacityChange={updateLayerOpacity}
      onLayerOrderChange={reorderLayers}
    />
  );
}
```

## 📊 Sources de données configurées

### 🇨🇭 Confédération (geo.admin.ch)

| Catégorie | Couches |
|-----------|---------|
| Fonds de carte | Carte nationale couleur/grise, SWISSIMAGE |
| Cadastre | Répertoire des rues, RegBL, Mensuration officielle |
| RDPPF | Lignes de construction, Zones réservées |
| Environnement | Marais, Zones alluviales, Bruit |
| Dangers | Crues, Glissements, Chutes de pierres |
| Transport | Arrêts TP, Itinéraires pédestres/cyclables |
| Patrimoine | ISOS, IVS |
| Énergie | Potentiel solaire, Réseaux thermiques |

### 🏔️ Canton de Vaud (geo.vd.ch)

| Catégorie | Couches |
|-----------|---------|
| Aménagement | Zones d'affectation, Périmètres spéciaux, PDR |
| Cadastre | Parcelles, Bâtiments, Adresses, Points fixes |
| Environnement | Forêts, Cours d'eau, Protection des eaux, Sites pollués |
| Dangers | Inondation, Glissement |
| Transport | Routes cantonales, Réseau cyclable, TL |
| Patrimoine | Monuments, Sites archéologiques |
| Énergie | Zones thermiques, Géothermie |

### 📐 ASIT-VD

| Catégorie | Couches |
|-----------|---------|
| Fonds de plan | Fond cadastral ASIT, Orthophoto VD 2020 |

### 🏘️ Ouest lausannois (SDOL)

| Catégorie | Couches |
|-----------|---------|
| Urbanisme | Projets PALM, Quartiers durables |

### 🌐 OpenData

| Catégorie | Couches |
|-----------|---------|
| OpenStreetMap | OSM Standard, OpenTopoMap |

## ⚙️ Personnalisation

### Ajouter une nouvelle source

Éditez `config/externalLayerSources.json` :

```json
{
  "id": "ma-source",
  "name": "Ma Source",
  "icon": "🗺️",
  "color": "#FF5733",
  "description": "Description de la source",
  "baseUrl": "https://example.com/",
  "categories": [
    {
      "id": "ma-categorie",
      "name": "Ma Catégorie",
      "layers": [
        {
          "id": "ma-couche",
          "name": "Ma Couche",
          "type": "WMS",
          "url": "https://example.com/wms",
          "layers": "nom_couche_wms",
          "format": "image/png",
          "transparent": true,
          "attribution": "© Mon Attribution"
        }
      ]
    }
  ]
}
```

### Types de services supportés

| Type | Description | Paramètres requis |
|------|-------------|-------------------|
| `WMS` | Web Map Service | `url`, `layers` |
| `WMTS` | Web Map Tile Service | `url` (template avec {z}/{x}/{y}) |
| `XYZ` | Tuiles XYZ standard | `url` (template) |
| `WFS` | Web Feature Service | À implémenter |

### Thème clair

Ajoutez la classe `light-theme` au conteneur :

```tsx
<div className="external-layers-manager light-theme">
```

## 🔧 API des hooks

### useExternalLayers

```typescript
const {
  activeLayers,          // ActiveLayer[] - Couches actives
  addLayer,              // (layer: ActiveLayer) => void
  removeLayer,           // (layerId: string) => void
  updateLayerOpacity,    // (layerId: string, opacity: number) => void
  updateLayerVisibility, // (layerId: string, visible: boolean) => void
  reorderLayers,         // (layers: ActiveLayer[]) => void
  clearAllLayers,        // () => void
  isLoading,             // boolean
  error,                 // string | null
} = useExternalLayers({ map, crs });
```

### useBasemapLayer

```typescript
const { 
  currentBasemap,  // string | null - ID du fond de carte actif
  setBasemap       // (layer: ActiveLayer | null) => void
} = useBasemapLayer(map);
```

## 📝 Notes techniques

### Système de coordonnées

- Les services suisses utilisent généralement **EPSG:2056** (MN95)
- Leaflet utilise **EPSG:3857** (Web Mercator) par défaut
- Les URLs WMTS sont configurées pour EPSG:2056 quand disponible

### Performance

- Les couches sont chargées de manière asynchrone
- Le z-index est géré dynamiquement lors du réordonnancement
- Les événements de chargement sont suivis pour l'indicateur de loading

### Limites connues

- WFS non encore implémenté (prévu pour une version future)
- Pas de support pour les couches vectorielles GeoJSON
- GetFeatureInfo (clic sur la carte) non implémenté

## 📄 Licence

Module développé pour GeoMind - Commune de Bussigny.

---

*Dernière mise à jour : 13 décembre 2025*
