# CLAUDE CODE - Instructions d'intégration rapide

## MISSION
Intégrer le module `geomind-layers/` dans GeoMind (onglet Cartes > sous-onglet "Externes").

## FICHIERS FOURNIS
```
geomind-layers/
├── components/ExternalLayersManager.tsx  # UI gestionnaire couches
├── components/MapViewer.tsx              # Composant carte complet
├── hooks/useExternalLayers.ts            # Hook Leaflet WMS/WMTS
├── styles/*.css                          # Styles dark theme
├── config/externalLayerSources.json      # 50 couches suisses
└── index.ts                              # Exports
```

## ÉTAPES OBLIGATOIRES

### 1. ANALYSER D'ABORD
```bash
# Structure projet
tree -L 3 -I 'node_modules' .

# Framework utilisé
cat package.json | grep -E "react|vue|electron"

# Librairie carto existante
grep -r "leaflet\|openlayers" --include="*.ts" --include="*.tsx"

# Module Cartes existant
find . -name "*map*" -o -name "*carte*" | head -20
```

### 2. INSTALLER DÉPENDANCES
```bash
npm install leaflet @types/leaflet lucide-react
```

### 3. COPIER FICHIERS
```bash
# Adapter selon structure existante
cp -r geomind-layers/ src/features/maps/external-layers/
```

### 4. INTÉGRER DANS L'ONGLET CARTES

**Option A** - Ajouter le panneau à la sidebar existante :
```tsx
import { ExternalLayersManager, useExternalLayers } from './external-layers';
import './external-layers/styles/ExternalLayersManager.css';

// Dans le composant Cartes :
const { activeLayers, addLayer, removeLayer, updateLayerOpacity, reorderLayers } = 
  useExternalLayers({ map });

<ExternalLayersManager
  activeLayers={activeLayers}
  onLayerToggle={(layer, active) => active ? addLayer(layer) : removeLayer(layer.id)}
  onLayerOpacityChange={updateLayerOpacity}
  onLayerOrderChange={reorderLayers}
/>
```

**Option B** - Utiliser MapViewer complet :
```tsx
import { MapViewer } from './external-layers';
import './external-layers/styles/MapViewer.css';
import './external-layers/styles/ExternalLayersManager.css';

<MapViewer 
  postgisLayers={existingPostGISLayers}
  onPostGISLayerToggle={handleToggle}
/>
```

### 5. ADAPTER LES STYLES
- Vérifier cohérence avec thème existant
- Connecter variables CSS si nécessaire
- Le module supporte `.light-theme` pour mode clair

### 6. TESTER
- [ ] Activation couche WMS fédérale
- [ ] Activation couche cantonale VD  
- [ ] Slider opacité fonctionne
- [ ] Drag & drop réordonne
- [ ] Recherche filtre catalogue
- [ ] Légende s'affiche

## POINTS CRITIQUES

1. **Map null** → Toujours vérifier `if (!map) return;`
2. **CORS** → Certains WMS peuvent nécessiter un proxy
3. **CRS** → Services suisses en EPSG:2056, Leaflet en 3857
4. **Performance** → Limiter à ~10 couches actives simultanées

## SOURCES CONFIGURÉES

| Source | Couleur | Exemples |
|--------|---------|----------|
| 🇨🇭 Confédération | #DC0018 | Cartes nationales, SWISSIMAGE, RDPPF |
| 🏔️ Canton VD | #009F4D | Parcelles, zones affectation, forêts |
| 📐 ASIT-VD | #0066B3 | Fond cadastral, orthophoto |
| 🏘️ Ouest lausannois | #8B4513 | Projets PALM |
| 🌐 OpenData | #6B7280 | OSM |

## EN CAS DE PROBLÈME

- **Couches invisibles** → Vérifier console réseau, tester URL WMS
- **Erreurs TS** → Vérifier `@types/leaflet` installé
- **Styles cassés** → Vérifier imports CSS, spécificité

---
Générer un rapport des modifications à la fin.
