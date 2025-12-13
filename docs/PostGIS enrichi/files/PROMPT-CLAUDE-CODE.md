# Prompt Système - Claude Code Opus 4.5
## Mission : Intégration du Module Géodonnées Externes dans GeoMind

---

## 🎯 OBJECTIF PRINCIPAL

Tu dois intégrer un module complet de gestion des géodonnées externes suisses (WMS/WMTS/XYZ) dans l'application GeoMind. Ce module permet d'afficher des couches provenant de geo.admin.ch, geo.vd.ch, ASIT-VD et autres sources sur la carte, en complément des données PostGIS communales.

---

## 📋 CONTEXTE DE L'APPLICATION

### GeoMind - Application de gestion SIT/GIS
- **Plateforme** : Application desktop Windows
- **Stack probable** : Electron + React ou PyQt + WebView
- **Domaine** : Système d'Information du Territoire pour la commune de Bussigny (Suisse)
- **SRID par défaut** : EPSG:2056 (MN95 Suisse)
- **Centre géographique** : Bussigny VD (46.5525, 6.5515)

### Module Cartes existant
- Onglet "Cartes" dans la navigation principale
- Sous-onglet "PostGIS" pour les couches de la base communale
- Visualisation cartographique (probablement Leaflet ou OpenLayers)
- Connexion PostgreSQL/PostGIS existante

---

## 📦 FICHIERS À INTÉGRER

Tu recevras un dossier `geomind-layers/` contenant :

```
geomind-layers/
├── components/
│   ├── ExternalLayersManager.tsx   # Gestionnaire UI des couches externes
│   └── MapViewer.tsx               # Composant carte avec onglets
├── hooks/
│   └── useExternalLayers.ts        # Hook Leaflet pour WMS/WMTS/XYZ
├── styles/
│   ├── ExternalLayersManager.css   # Styles du gestionnaire (dark theme)
│   └── MapViewer.css               # Styles de la carte
├── config/
│   └── externalLayerSources.json   # Configuration des ~50 couches
├── index.ts                        # Exports du module
└── README.md                       # Documentation technique
```

---

## 🔧 ÉTAPES D'INTÉGRATION

### PHASE 1 : Analyse de l'existant

Avant toute modification, tu DOIS :

1. **Explorer la structure du projet**
   ```bash
   # Trouver la racine du projet
   find / -name "package.json" -o -name "requirements.txt" 2>/dev/null | head -20
   
   # Lister l'arborescence
   tree -L 3 -I 'node_modules|__pycache__|.git' /chemin/projet
   ```

2. **Identifier le framework UI**
   - Chercher `package.json` pour React/Electron
   - Chercher `requirements.txt` ou `pyproject.toml` pour Python
   - Identifier la librairie cartographique (Leaflet, OpenLayers, MapLibre)

3. **Localiser le module Cartes existant**
   ```bash
   # Chercher les fichiers liés aux cartes
   find . -type f \( -name "*map*" -o -name "*carte*" -o -name "*layer*" \) 2>/dev/null
   grep -r "Leaflet\|OpenLayers\|mapbox" --include="*.tsx" --include="*.ts" --include="*.js"
   ```

4. **Comprendre la structure des composants**
   ```bash
   # Trouver les composants existants
   find . -path "*/components/*" -name "*.tsx" -o -name "*.vue" -o -name "*.py"
   ```

5. **Vérifier les dépendances installées**
   ```bash
   cat package.json | grep -A 50 '"dependencies"'
   # ou
   pip list | grep -i "leaflet\|folium\|geopandas"
   ```

### PHASE 2 : Installation des dépendances

#### Si React/TypeScript (Electron)
```bash
npm install leaflet @types/leaflet lucide-react
# ou
yarn add leaflet @types/leaflet lucide-react
```

#### Si Python (PyQt/PySide)
Tu devras adapter les composants React en Python. Voir la section ADAPTATION PYTHON.

### PHASE 3 : Intégration des fichiers

1. **Copier le module dans le projet**
   ```bash
   # Adapter le chemin selon la structure existante
   cp -r geomind-layers/ src/modules/external-layers/
   # ou
   cp -r geomind-layers/ src/features/maps/external-layers/
   ```

2. **Ajuster les imports selon la structure**
   - Modifier les chemins relatifs dans `index.ts`
   - Adapter les imports CSS selon le bundler (Webpack, Vite, etc.)

### PHASE 4 : Connexion au module Cartes existant

#### Scénario A : Le module Cartes utilise déjà Leaflet

```tsx
// Dans le composant Cartes existant, ajouter :
import { ExternalLayersManager, useExternalLayers } from '@/modules/external-layers';
import '@/modules/external-layers/styles/ExternalLayersManager.css';

// Dans le composant :
const { activeLayers, addLayer, removeLayer, updateLayerOpacity, reorderLayers } = 
  useExternalLayers({ map: existingMapInstance });

// Ajouter le panneau dans la sidebar :
<ExternalLayersManager
  activeLayers={activeLayers}
  onLayerToggle={(layer, active) => active ? addLayer(layer) : removeLayer(layer.id)}
  onLayerOpacityChange={updateLayerOpacity}
  onLayerOrderChange={reorderLayers}
/>
```

#### Scénario B : Remplacer entièrement le composant Cartes

```tsx
// Remplacer le composant existant par MapViewer
import { MapViewer } from '@/modules/external-layers';
import '@/modules/external-layers/styles/MapViewer.css';
import '@/modules/external-layers/styles/ExternalLayersManager.css';

// Dans le rendu de l'onglet Cartes :
<MapViewer 
  postgisLayers={postgisLayersFromExistingCode}
  onPostGISLayerToggle={handlePostGISToggle}
/>
```

#### Scénario C : Ajouter comme sous-onglet

```tsx
// Dans le composant Cartes, ajouter un système d'onglets :
const [activeSubTab, setActiveSubTab] = useState<'postgis' | 'external'>('postgis');

return (
  <div className="cartes-container">
    <div className="sub-tabs">
      <button onClick={() => setActiveSubTab('postgis')}>PostGIS</button>
      <button onClick={() => setActiveSubTab('external')}>Externes</button>
    </div>
    
    {activeSubTab === 'postgis' && <ExistingPostGISPanel />}
    {activeSubTab === 'external' && (
      <ExternalLayersManager
        activeLayers={activeLayers}
        onLayerToggle={handleLayerToggle}
        onLayerOpacityChange={handleOpacityChange}
        onLayerOrderChange={handleReorder}
      />
    )}
  </div>
);
```

### PHASE 5 : Adaptation du style

1. **Vérifier la cohérence avec le thème existant**
   ```bash
   # Trouver les variables CSS existantes
   grep -r "^--" --include="*.css" --include="*.scss" .
   ```

2. **Adapter les variables CSS si nécessaire**
   ```css
   /* Dans ExternalLayersManager.css, remplacer les variables par celles du projet */
   .external-layers-manager {
     --elm-bg: var(--app-bg-primary, #1a1f2e);
     --elm-accent: var(--app-accent, #4f8cff);
     /* etc. */
   }
   ```

3. **Gérer le thème clair/sombre**
   - Le module supporte `.light-theme` pour le mode clair
   - Connecter au système de thème existant de l'application

### PHASE 6 : Configuration des sources

1. **Vérifier les URLs des services WMS/WMTS**
   ```bash
   # Tester un service
   curl -I "https://wms.geo.admin.ch/?SERVICE=WMS&REQUEST=GetCapabilities"
   ```

2. **Ajouter des couches spécifiques si demandé**
   - Éditer `config/externalLayerSources.json`
   - Suivre la structure existante

3. **Configurer le centre par défaut**
   ```json
   // Dans externalLayerSources.json
   "defaultCenter": {
     "lat": 46.5525,
     "lng": 6.5515,
     "zoom": 14,
     "crs": "EPSG:2056"
   }
   ```

### PHASE 7 : Tests et validation

1. **Vérifier le chargement des couches**
   - Activer une couche WMS fédérale (ex: carte nationale)
   - Activer une couche cantonale (ex: parcelles VD)
   - Vérifier l'affichage correct sur la carte

2. **Tester les fonctionnalités**
   - [ ] Toggle activation/désactivation
   - [ ] Slider d'opacité
   - [ ] Drag & drop pour réordonnancer
   - [ ] Recherche dans le catalogue
   - [ ] Affichage de la légende

3. **Vérifier la performance**
   - Activer plusieurs couches simultanément
   - Observer la mémoire et le CPU

---

## 🐍 ADAPTATION PYTHON (Si PyQt/PySide)

Si GeoMind est en Python, tu devras créer des équivalents :

### Structure alternative Python

```python
# src/modules/external_layers/
├── __init__.py
├── external_layers_manager.py    # Widget PyQt
├── map_viewer.py                 # Widget carte
├── layer_sources.py              # Classe de configuration
├── external_layer_sources.json   # Configuration (inchangé)
└── styles.qss                    # Styles Qt
```

### Exemple de widget PyQt

```python
# external_layers_manager.py
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTreeWidget, 
    QTreeWidgetItem, QCheckBox, QSlider, QLabel
)
from PyQt6.QtCore import Qt, pyqtSignal
import json

class ExternalLayersManager(QWidget):
    layerToggled = pyqtSignal(str, bool)  # layer_id, active
    opacityChanged = pyqtSignal(str, int)  # layer_id, opacity
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.active_layers = {}
        self.setup_ui()
        self.load_sources()
    
    def setup_ui(self):
        layout = QVBoxLayout(self)
        
        # Arbre des sources
        self.tree = QTreeWidget()
        self.tree.setHeaderLabels(["Couche", "Type"])
        self.tree.itemChanged.connect(self.on_item_changed)
        layout.addWidget(self.tree)
    
    def load_sources(self):
        with open('external_layer_sources.json', 'r') as f:
            config = json.load(f)
        
        for source in config['sources']:
            source_item = QTreeWidgetItem([source['name']])
            source_item.setData(0, Qt.ItemDataRole.UserRole, source)
            
            for category in source['categories']:
                cat_item = QTreeWidgetItem([category['name']])
                
                for layer in category['layers']:
                    layer_item = QTreeWidgetItem([layer['name'], layer['type']])
                    layer_item.setCheckState(0, Qt.CheckState.Unchecked)
                    layer_item.setData(0, Qt.ItemDataRole.UserRole, layer)
                    cat_item.addChild(layer_item)
                
                source_item.addChild(cat_item)
            
            self.tree.addTopLevelItem(source_item)
    
    def on_item_changed(self, item, column):
        if item.childCount() == 0:  # C'est une couche
            layer = item.data(0, Qt.ItemDataRole.UserRole)
            active = item.checkState(0) == Qt.CheckState.Checked
            self.layerToggled.emit(layer['id'], active)
```

### Intégration avec Folium (Python web)

```python
# Pour une carte web dans PyQt
import folium
from PyQt6.QtWebEngineWidgets import QWebEngineView

class MapViewer(QWidget):
    def __init__(self):
        super().__init__()
        self.web_view = QWebEngineView()
        self.map = folium.Map(location=[46.5525, 6.5515], zoom_start=14)
        self.update_map()
    
    def add_wms_layer(self, layer_config):
        folium.raster_layers.WmsTileLayer(
            url=layer_config['url'],
            layers=layer_config.get('layers', ''),
            fmt=layer_config.get('format', 'image/png'),
            transparent=layer_config.get('transparent', True),
            name=layer_config['name'],
            attr=layer_config['attribution']
        ).add_to(self.map)
        self.update_map()
    
    def update_map(self):
        html = self.map._repr_html_()
        self.web_view.setHtml(html)
```

---

## ⚠️ POINTS D'ATTENTION

### Gestion des erreurs

```typescript
// Toujours wrapper les appels réseau
try {
  const layer = createLeafletLayer(config);
  layer.on('tileerror', (e) => {
    console.error(`Erreur de chargement: ${config.name}`, e);
    showNotification(`Impossible de charger ${config.name}`, 'error');
  });
} catch (error) {
  console.error('Erreur création couche:', error);
}
```

### CORS et proxying

Certains services WMS peuvent avoir des restrictions CORS. Solutions :

```typescript
// Option 1: Proxy côté serveur
const proxyUrl = `/api/proxy?url=${encodeURIComponent(wmsUrl)}`;

// Option 2: Configuration Electron
// Dans main.js
webPreferences: {
  webSecurity: false // ⚠️ Uniquement en développement
}
```

### Performance avec nombreuses couches

```typescript
// Limiter le nombre de couches actives simultanément
const MAX_ACTIVE_LAYERS = 10;

const addLayer = (layer) => {
  if (activeLayers.length >= MAX_ACTIVE_LAYERS) {
    showNotification('Maximum 10 couches actives', 'warning');
    return;
  }
  // ...
};
```

### Persistance des préférences

```typescript
// Sauvegarder les couches actives
const saveLayerPreferences = () => {
  const prefs = activeLayers.map(l => ({
    id: l.id,
    opacity: l.opacity,
    visible: l.visible,
    zIndex: l.zIndex
  }));
  localStorage.setItem('geomind_external_layers', JSON.stringify(prefs));
};

// Restaurer au démarrage
const loadLayerPreferences = () => {
  const saved = localStorage.getItem('geomind_external_layers');
  if (saved) {
    const prefs = JSON.parse(saved);
    // Réactiver les couches...
  }
};
```

---

## 📊 CHECKLIST FINALE

Avant de terminer, vérifie que :

- [ ] Les dépendances sont installées (leaflet, lucide-react)
- [ ] Les fichiers sont copiés au bon endroit
- [ ] Les imports sont corrects et fonctionnels
- [ ] Les styles sont chargés et cohérents avec le thème
- [ ] Le composant s'affiche dans l'onglet Cartes
- [ ] Les couches WMS se chargent correctement
- [ ] L'opacité fonctionne
- [ ] Le drag & drop réordonne les couches
- [ ] La recherche filtre le catalogue
- [ ] Pas d'erreurs dans la console
- [ ] La performance est acceptable

---

## 🆘 EN CAS DE PROBLÈME

### Les couches ne s'affichent pas
1. Vérifier la console pour les erreurs réseau
2. Tester l'URL WMS directement dans le navigateur
3. Vérifier le CRS/SRID (2056 vs 3857)

### Erreurs TypeScript
1. Vérifier que `@types/leaflet` est installé
2. Ajouter les déclarations de module manquantes

### Styles cassés
1. Vérifier que les fichiers CSS sont importés
2. Inspecter les conflits de classes CSS
3. Augmenter la spécificité si nécessaire

### L'application plante
1. Vérifier les références nulles (map non initialisée)
2. Ajouter des guards : `if (!map) return;`
3. Utiliser des try/catch autour des opérations critiques

---

## 📝 RAPPORT D'INTÉGRATION

À la fin de l'intégration, génère un rapport contenant :

1. **Résumé des modifications**
   - Fichiers ajoutés
   - Fichiers modifiés
   - Dépendances ajoutées

2. **Architecture finale**
   - Arborescence mise à jour
   - Diagramme de composants si pertinent

3. **Tests effectués**
   - Fonctionnalités validées
   - Problèmes rencontrés et solutions

4. **Recommandations**
   - Améliorations futures suggérées
   - Points de vigilance pour la maintenance

---

*Prompt créé le 13 décembre 2025 pour l'intégration du module géodonnées externes dans GeoMind*
