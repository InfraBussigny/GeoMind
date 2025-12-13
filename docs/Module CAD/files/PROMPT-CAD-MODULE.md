# Prompt Système - Claude Code Opus 4.5
## Mission : Développement du Module CAD pour GeoMind

---

## 🎯 OBJECTIF PRINCIPAL

Développer un module CAD complet pour GeoMind permettant de visualiser, éditer et synchroniser des fichiers DWG/DXF avec la base de données PostGIS de la commune de Bussigny. Le module doit supporter trois niveaux d'accès (Standard, Expert, God) avec des fonctionnalités croissantes.

---

## 📋 CONTEXTE TECHNIQUE

### Application GeoMind
- **Plateforme** : Application desktop Windows (Electron + React ou PyQt)
- **Base de données** : PostgreSQL/PostGIS (Oracle en source via FME)
- **Domaine** : Système d'Information du Territoire (SIT) - Commune de Bussigny, Suisse
- **Utilisateur principal** : Responsable SIT/GIS

### Systèmes de coordonnées à supporter
| Système | EPSG | Usage |
|---------|------|-------|
| MN95 (CH1903+/LV95) | 2056 | **Principal** - Standard suisse actuel |
| MN03 (CH1903/LV03) | 21781 | Ancien système, données historiques |
| WGS84 | 4326 | GPS, échanges internationaux |
| Web Mercator | 3857 | Affichage carte web (Leaflet) |

### Formats de fichiers
- **Entrée principale** : DWG (AutoCAD 2018-2025)
- **Entrée secondaire** : DXF (toutes versions)
- **Export** : DXF, GeoJSON, Shapefile, GeoPackage, PostGIS direct

---

## 🏗️ ARCHITECTURE DU MODULE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GeoMind - Module CAD                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         BARRE D'OUTILS                               │    │
│  │  [Ouvrir] [Sauver] [Undo] [Redo] | [Select] [Pan] [Zoom] | [Mesure] │    │
│  │  [Ligne] [Polyligne] [Cercle] [Texte] | [Snap] [Ortho] [Grid]       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────┐  ┌─────────────────────────────────────┐  ┌───────────┐  │
│  │   PANNEAU    │  │                                     │  │  PANNEAU  │  │
│  │   GAUCHE     │  │         ZONE DE DESSIN              │  │   DROIT   │  │
│  │              │  │                                     │  │           │  │
│  │ • Calques    │  │    ┌─────────────────────────┐      │  │ • Proprié-│  │
│  │ • Explorateur│  │    │                         │      │  │   tés     │  │
│  │   fichiers   │  │    │   Canvas 2D/WebGL       │      │  │ • Attri-  │  │
│  │ • Blocs      │  │    │   (Three.js/Fabric.js)  │      │  │   buts    │  │
│  │ • Xrefs      │  │    │                         │      │  │ • PostGIS │  │
│  │              │  │    │   + Carte Leaflet       │      │  │   sync    │  │
│  │              │  │    │   (fond géoréférencé)   │      │  │           │  │
│  │              │  │    │                         │      │  │           │  │
│  │              │  │    └─────────────────────────┘      │  │           │  │
│  │              │  │                                     │  │           │  │
│  └──────────────┘  └─────────────────────────────────────┘  └───────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      LIGNE DE COMMANDE                               │    │
│  │  Commande: _                                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Coords: E 2'533'450.123  N 1'154'230.456  |  SRID: 2056  |  SNAP   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 👤 NIVEAUX D'ACCÈS ET FONCTIONNALITÉS

### 🟢 Mode STANDARD (Consultation)
Destiné aux utilisateurs non-techniques (secrétariat, élus, etc.)

```yaml
Fonctionnalités:
  Fichiers:
    - Ouvrir DWG/DXF (lecture seule)
    - Glisser-déposer
    - Fichiers récents
  
  Navigation:
    - Pan (molette ou clic-milieu)
    - Zoom (molette, +/-, extent)
    - Zoom sur sélection
    - Zoom sur calque
  
  Visualisation:
    - Afficher/masquer calques
    - Changer couleur de fond
    - Mode fil de fer / rempli
    - Superposition carte de fond (swisstopo)
  
  Outils:
    - Mesure distance
    - Mesure surface
    - Identification (clic → infos)
  
  Export:
    - Capture d'écran (PNG)
    - Export PDF de la vue
    - Impression
```

### 🟡 Mode EXPERT (Édition)
Destiné aux techniciens et géomaticiens

```yaml
Inclut tout le mode Standard, plus:

Fonctionnalités:
  Édition:
    - Sélection (simple, fenêtre, polygone)
    - Déplacer entités
    - Copier / Coller
    - Rotation
    - Échelle
    - Miroir
    - Supprimer
    - Undo / Redo (50 niveaux)
  
  Dessin:
    - Ligne
    - Polyligne
    - Rectangle
    - Cercle / Arc
    - Texte
    - Hachures simples
    - Point
  
  Modification:
    - Ajuster (trim)
    - Prolonger (extend)
    - Décaler (offset)
    - Raccord (fillet)
    - Chanfrein (chamfer)
    - Décomposer (explode)
    - Joindre (join)
  
  Accrochages (Snaps):
    - Extrémité
    - Milieu
    - Centre
    - Intersection
    - Perpendiculaire
    - Tangente
    - Proche
    - Grille
  
  Calques:
    - Créer calque
    - Renommer
    - Changer couleur/type de ligne
    - Verrouiller
    - Geler
  
  Annotations:
    - Cotations linéaires
    - Cotations angulaires
    - Étiquettes
    - Symboles (bibliothèque)
  
  Blocs:
    - Insérer bloc
    - Créer bloc
    - Éditer bloc (simple)
  
  Export:
    - Sauvegarder DXF
    - Export GeoJSON
    - Export Shapefile
    - Export GeoPackage
```

### 🔴 Mode GOD (Administration / Synchronisation DB)
Destiné au responsable SIT uniquement

```yaml
Inclut tout le mode Expert, plus:

Fonctionnalités:
  Saisie géodonnées:
    - Mode "Sketching GIS"
    - Templates de saisie par thème:
      • Parcelles
      • Bâtiments
      • Conduites (eau, gaz, électricité)
      • Regards / Chambres
      • Mobilier urbain
      • Points d'intérêt
    - Formulaire d'attributs dynamique
    - Validation géométrique temps réel
    - Snapping sur données PostGIS
  
  Synchronisation PostGIS:
    - Connexion directe PostgreSQL
    - Charger couche PostGIS comme calque
    - Comparer DWG vs PostGIS (diff visuel)
    - Push entités vers PostGIS:
      • Mapping calque → table
      • Mapping attributs DWG → colonnes
      • Transformation CRS automatique
    - Pull données PostGIS → DWG
    - Historique des synchronisations
    - Rollback possible
  
  Intégration FME:
    - Liste des workspaces disponibles
    - Lancer un workspace FME
    - Passer des paramètres (fichier source, etc.)
    - Voir le log d'exécution
    - Planifier des tâches
  
  Transformation de coordonnées:
    - Reprojection fichier entier
    - Transformation MN03 → MN95 (FINELTRA/REFRAME)
    - Détection automatique du CRS
    - Points de contrôle pour géoréférencement manuel
  
  Administration:
    - Gestion des utilisateurs/modes
    - Logs d'audit (qui a modifié quoi)
    - Backup automatique avant sync
    - Configuration des connexions DB
```

---

## 🔧 STACK TECHNIQUE RECOMMANDÉE

### Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Electron/React)                 │
├─────────────────────────────────────────────────────────────────┤
│  UI Framework    │  React 18 + TypeScript                       │
│  State Management│  Zustand ou Redux Toolkit                    │
│  CAD Canvas      │  Fabric.js (2D) + Three.js (preview 3D)     │
│  Map Background  │  Leaflet + Plugin sync                       │
│  Styling         │  Tailwind CSS ou CSS Modules                 │
│  Icons           │  Lucide React                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Node.js/Python)                    │
├─────────────────────────────────────────────────────────────────┤
│  API             │  Express.js ou FastAPI                       │
│  DWG/DXF Parser  │  ezdxf (Python) + ODA File Converter (DWG)  │
│  CRS Transform   │  proj4js (JS) / pyproj (Python)             │
│  DB Connector    │  pg (Node) / psycopg2+asyncpg (Python)      │
│  FME Integration │  FME Server REST API ou CLI fme.exe         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Services externes                           │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL/PostGIS   │  Base de données géospatiales           │
│  ODA File Converter   │  Conversion DWG → DXF (gratuit)         │
│  FME Desktop/Server   │  ETL géospatial                         │
│  swisstopo API        │  Fonds de carte, transformation coords  │
└─────────────────────────────────────────────────────────────────┘
```

### Dépendances clés

```json
// package.json (Electron/React)
{
  "dependencies": {
    "react": "^18.2.0",
    "fabric": "^5.3.0",
    "three": "^0.160.0",
    "leaflet": "^1.9.4",
    "proj4": "^2.9.2",
    "zustand": "^4.4.0",
    "pg": "^8.11.0",
    "electron": "^28.0.0",
    "lucide-react": "^0.300.0",
    "@types/fabric": "^5.3.0"
  }
}
```

```txt
# requirements.txt (Backend Python si utilisé)
ezdxf>=1.1.0
pyproj>=3.6.0
psycopg2-binary>=2.9.9
asyncpg>=0.29.0
fastapi>=0.108.0
uvicorn>=0.25.0
shapely>=2.0.0
geopandas>=0.14.0
```

---

## 📂 STRUCTURE DES FICHIERS DU MODULE

```
src/modules/cad/
├── index.ts                          # Exports du module
├── types/
│   ├── cad.types.ts                  # Types CAD (entités, calques...)
│   ├── geometry.types.ts             # Types géométriques
│   └── sync.types.ts                 # Types synchronisation
├── components/
│   ├── CadModule.tsx                 # Composant principal
│   ├── Toolbar/
│   │   ├── MainToolbar.tsx           # Barre d'outils principale
│   │   ├── DrawingTools.tsx          # Outils de dessin
│   │   ├── ModifyTools.tsx           # Outils de modification
│   │   └── SnapSettings.tsx          # Paramètres d'accrochage
│   ├── Canvas/
│   │   ├── CadCanvas.tsx             # Canvas Fabric.js
│   │   ├── MapOverlay.tsx            # Superposition Leaflet
│   │   ├── GridRenderer.tsx          # Grille de dessin
│   │   └── CursorManager.tsx         # Gestion du curseur
│   ├── Panels/
│   │   ├── LayersPanel.tsx           # Panneau des calques
│   │   ├── PropertiesPanel.tsx       # Propriétés de l'entité
│   │   ├── BlocksPanel.tsx           # Bibliothèque de blocs
│   │   ├── XrefPanel.tsx             # Références externes
│   │   └── SyncPanel.tsx             # Synchronisation PostGIS
│   ├── Dialogs/
│   │   ├── OpenFileDialog.tsx        # Dialogue d'ouverture
│   │   ├── SaveDialog.tsx            # Dialogue de sauvegarde
│   │   ├── CrsDialog.tsx             # Sélection CRS
│   │   ├── SyncConfigDialog.tsx      # Configuration sync
│   │   └── FmeDialog.tsx             # Lancement FME
│   └── CommandLine/
│       ├── CommandLine.tsx           # Ligne de commande
│       └── CommandParser.ts          # Parser de commandes
├── hooks/
│   ├── useCadState.ts                # État global CAD
│   ├── useDrawing.ts                 # Logique de dessin
│   ├── useSelection.ts               # Logique de sélection
│   ├── useSnapping.ts                # Logique d'accrochage
│   ├── useHistory.ts                 # Undo/Redo
│   ├── useCrsTransform.ts            # Transformation CRS
│   └── usePostgisSync.ts             # Synchronisation DB
├── services/
│   ├── dxfParser.ts                  # Parser DXF (ezdxf bridge)
│   ├── dwgConverter.ts               # Conversion DWG via ODA
│   ├── geometryEngine.ts             # Opérations géométriques
│   ├── crsService.ts                 # Transformations proj4
│   ├── postgisService.ts             # Connexion PostGIS
│   ├── fmeService.ts                 # Intégration FME
│   └── exportService.ts              # Exports divers formats
├── utils/
│   ├── cadMath.ts                    # Calculs géométriques
│   ├── colorUtils.ts                 # Conversion couleurs ACI
│   ├── unitConverter.ts              # Conversion d'unités
│   └── validators.ts                 # Validations
├── config/
│   ├── defaultSettings.ts            # Paramètres par défaut
│   ├── snapModes.ts                  # Modes d'accrochage
│   ├── lineTypes.ts                  # Types de lignes
│   └── blockLibrary.ts               # Blocs prédéfinis
├── styles/
│   ├── CadModule.css                 # Styles principaux
│   ├── Toolbar.css                   # Styles barre d'outils
│   ├── Panels.css                    # Styles panneaux
│   └── Canvas.css                    # Styles canvas
└── workers/
    ├── dxfWorker.ts                  # Web Worker parsing DXF
    └── geometryWorker.ts             # Web Worker calculs lourds
```

---

## 🔄 FLUX DE DONNÉES

### Ouverture d'un fichier DWG

```
┌─────────┐    ┌─────────────┐    ┌─────────┐    ┌──────────┐    ┌────────┐
│  User   │───▶│  Electron   │───▶│   ODA   │───▶│  ezdxf   │───▶│ Canvas │
│ (DWG)   │    │  (dialog)   │    │Converter│    │ (parse)  │    │(render)│
└─────────┘    └─────────────┘    └─────────┘    └──────────┘    └────────┘
                                       │
                                       ▼
                                  fichier.dxf
                                  (temporaire)
```

### Synchronisation vers PostGIS

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌──────────┐
│  Entités   │───▶│ Transform  │───▶│  Mapping   │───▶│ PostGIS  │
│  Canvas    │    │ CRS→2056   │    │ Attributs  │    │  INSERT  │
└────────────┘    └────────────┘    └────────────┘    └──────────┘
                                          │
                                          ▼
                                   ┌────────────┐
                                   │   Audit    │
                                   │   Log      │
                                   └────────────┘
```

### Intégration FME

```
┌──────────┐    ┌────────────┐    ┌────────────┐    ┌──────────┐
│ GeoMind  │───▶│  FME API   │───▶│  Workspace │───▶│  Output  │
│ (params) │    │  ou CLI    │    │  (.fmw)    │    │  (logs)  │
└──────────┘    └────────────┘    └────────────┘    └──────────┘
     │
     ▼
 Paramètres:
 - Fichier source
 - Table destination
 - Options de mapping
```

---

## 🛠️ IMPLÉMENTATION DÉTAILLÉE

### 1. Parser DXF avec ezdxf (Python Backend)

```python
# services/dxf_parser.py
import ezdxf
from ezdxf.entities import Line, LWPolyline, Circle, Arc, Text, Insert
from typing import Dict, List, Any
import json

class DxfParser:
    """Parser DXF pour GeoMind CAD Module"""
    
    def __init__(self, filepath: str):
        self.doc = ezdxf.readfile(filepath)
        self.msp = self.doc.modelspace()
    
    def get_layers(self) -> List[Dict]:
        """Retourne la liste des calques avec leurs propriétés"""
        layers = []
        for layer in self.doc.layers:
            layers.append({
                'name': layer.dxf.name,
                'color': layer.dxf.color,
                'linetype': layer.dxf.linetype,
                'is_on': layer.is_on(),
                'is_locked': layer.is_locked(),
                'is_frozen': layer.is_frozen(),
            })
        return layers
    
    def get_entities(self, layer_filter: str = None) -> List[Dict]:
        """Extrait toutes les entités en format JSON pour le frontend"""
        entities = []
        
        query = self.msp
        if layer_filter:
            query = self.msp.query(f'*[layer=="{layer_filter}"]')
        
        for entity in query:
            ent_data = self._parse_entity(entity)
            if ent_data:
                entities.append(ent_data)
        
        return entities
    
    def _parse_entity(self, entity) -> Dict:
        """Parse une entité DXF en dictionnaire"""
        base = {
            'handle': entity.dxf.handle,
            'layer': entity.dxf.layer,
            'color': self._resolve_color(entity),
            'linetype': entity.dxf.linetype,
        }
        
        if isinstance(entity, Line):
            return {
                **base,
                'type': 'LINE',
                'start': [entity.dxf.start.x, entity.dxf.start.y],
                'end': [entity.dxf.end.x, entity.dxf.end.y],
            }
        
        elif isinstance(entity, LWPolyline):
            points = [(p[0], p[1]) for p in entity.get_points()]
            return {
                **base,
                'type': 'POLYLINE',
                'points': points,
                'closed': entity.closed,
            }
        
        elif isinstance(entity, Circle):
            return {
                **base,
                'type': 'CIRCLE',
                'center': [entity.dxf.center.x, entity.dxf.center.y],
                'radius': entity.dxf.radius,
            }
        
        elif isinstance(entity, Arc):
            return {
                **base,
                'type': 'ARC',
                'center': [entity.dxf.center.x, entity.dxf.center.y],
                'radius': entity.dxf.radius,
                'start_angle': entity.dxf.start_angle,
                'end_angle': entity.dxf.end_angle,
            }
        
        elif isinstance(entity, Text):
            return {
                **base,
                'type': 'TEXT',
                'position': [entity.dxf.insert.x, entity.dxf.insert.y],
                'text': entity.dxf.text,
                'height': entity.dxf.height,
                'rotation': entity.dxf.rotation,
            }
        
        elif isinstance(entity, Insert):
            return {
                **base,
                'type': 'INSERT',
                'block_name': entity.dxf.name,
                'position': [entity.dxf.insert.x, entity.dxf.insert.y],
                'scale': [entity.dxf.xscale, entity.dxf.yscale],
                'rotation': entity.dxf.rotation,
            }
        
        # Ajouter d'autres types selon besoin...
        return None
    
    def _resolve_color(self, entity) -> int:
        """Résout la couleur (BYLAYER, BYBLOCK, ou directe)"""
        color = entity.dxf.color
        if color == 256:  # BYLAYER
            layer = self.doc.layers.get(entity.dxf.layer)
            return layer.dxf.color if layer else 7
        elif color == 0:  # BYBLOCK
            return 7  # Default white
        return color
    
    def get_blocks(self) -> List[Dict]:
        """Retourne la liste des blocs définis"""
        blocks = []
        for block in self.doc.blocks:
            if not block.name.startswith('*'):  # Ignorer les blocs anonymes
                blocks.append({
                    'name': block.name,
                    'base_point': [block.base_point.x, block.base_point.y],
                    'entity_count': len(list(block)),
                })
        return blocks
    
    def to_json(self) -> str:
        """Export complet en JSON"""
        return json.dumps({
            'layers': self.get_layers(),
            'entities': self.get_entities(),
            'blocks': self.get_blocks(),
            'units': self.doc.units,
        }, indent=2)


# API endpoint (FastAPI)
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import tempfile
import os

app = FastAPI()

@app.post("/api/cad/parse")
async def parse_dxf(file: UploadFile = File(...)):
    """Parse un fichier DXF et retourne les données en JSON"""
    
    # Sauvegarder temporairement
    with tempfile.NamedTemporaryFile(delete=False, suffix='.dxf') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        parser = DxfParser(tmp_path)
        data = {
            'layers': parser.get_layers(),
            'entities': parser.get_entities(),
            'blocks': parser.get_blocks(),
        }
        return JSONResponse(content=data)
    finally:
        os.unlink(tmp_path)
```

### 2. Canvas CAD avec Fabric.js (Frontend)

```typescript
// components/Canvas/CadCanvas.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { useCadState } from '../../hooks/useCadState';
import { useSnapping } from '../../hooks/useSnapping';
import { transformCoords } from '../../services/crsService';

interface CadCanvasProps {
  width: number;
  height: number;
}

export const CadCanvas: React.FC<CadCanvasProps> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  
  const { 
    entities, 
    layers, 
    currentTool, 
    snapEnabled,
    gridEnabled,
    currentCrs,
    addEntity,
    updateEntity,
    selectEntity
  } = useCadState();
  
  const { findSnapPoint } = useSnapping();
  
  // Initialisation du canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#1a1f2e',
      selection: true,
      preserveObjectStacking: true,
    });
    
    fabricRef.current = canvas;
    
    // Configuration des contrôles
    fabric.Object.prototype.set({
      cornerColor: '#4f8cff',
      cornerStyle: 'circle',
      borderColor: '#4f8cff',
      cornerSize: 8,
      transparentCorners: false,
    });
    
    // Événements
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:wheel', handleZoom);
    canvas.on('selection:created', handleSelection);
    canvas.on('object:modified', handleObjectModified);
    
    return () => {
      canvas.dispose();
    };
  }, []);
  
  // Rendu des entités DXF
  useEffect(() => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    canvas.clear();
    
    // Dessiner la grille si activée
    if (gridEnabled) {
      drawGrid(canvas);
    }
    
    // Dessiner chaque entité
    entities.forEach(entity => {
      const layer = layers.find(l => l.name === entity.layer);
      if (!layer?.is_on) return;
      
      const fabricObj = createFabricObject(entity, layer);
      if (fabricObj) {
        fabricObj.set('data', { id: entity.handle, type: entity.type });
        canvas.add(fabricObj);
      }
    });
    
    canvas.renderAll();
  }, [entities, layers, gridEnabled]);
  
  // Créer un objet Fabric à partir d'une entité DXF
  const createFabricObject = (entity: any, layer: any): fabric.Object | null => {
    const color = aciToHex(entity.color);
    const commonProps = {
      stroke: color,
      strokeWidth: 1,
      fill: 'transparent',
      selectable: !layer.is_locked,
      evented: !layer.is_locked,
    };
    
    switch (entity.type) {
      case 'LINE':
        return new fabric.Line(
          [entity.start[0], -entity.start[1], entity.end[0], -entity.end[1]],
          commonProps
        );
      
      case 'POLYLINE':
        const points = entity.points.map((p: number[]) => ({ x: p[0], y: -p[1] }));
        if (entity.closed) {
          return new fabric.Polygon(points, { ...commonProps, fill: 'transparent' });
        }
        return new fabric.Polyline(points, commonProps);
      
      case 'CIRCLE':
        return new fabric.Circle({
          ...commonProps,
          left: entity.center[0] - entity.radius,
          top: -entity.center[1] - entity.radius,
          radius: entity.radius,
        });
      
      case 'ARC':
        // Créer un arc avec path
        const path = createArcPath(
          entity.center[0], -entity.center[1],
          entity.radius,
          entity.start_angle,
          entity.end_angle
        );
        return new fabric.Path(path, commonProps);
      
      case 'TEXT':
        return new fabric.Text(entity.text, {
          ...commonProps,
          left: entity.position[0],
          top: -entity.position[1],
          fontSize: entity.height * 10, // Ajuster selon échelle
          fill: color,
          angle: -entity.rotation,
        });
      
      default:
        console.warn(`Type d'entité non supporté: ${entity.type}`);
        return null;
    }
  };
  
  // Gestion du dessin (mode création)
  const [drawingPoints, setDrawingPoints] = useState<fabric.Point[]>([]);
  const [tempLine, setTempLine] = useState<fabric.Line | null>(null);
  
  const handleMouseDown = useCallback((e: fabric.IEvent) => {
    if (currentTool === 'select') return;
    
    const pointer = fabricRef.current?.getPointer(e.e);
    if (!pointer) return;
    
    // Appliquer le snap si activé
    let point = pointer;
    if (snapEnabled) {
      const snapped = findSnapPoint(pointer.x, pointer.y, entities);
      if (snapped) {
        point = new fabric.Point(snapped.x, snapped.y);
        showSnapIndicator(snapped);
      }
    }
    
    if (currentTool === 'line' || currentTool === 'polyline') {
      setDrawingPoints([...drawingPoints, point]);
    }
  }, [currentTool, snapEnabled, drawingPoints, entities]);
  
  const handleMouseMove = useCallback((e: fabric.IEvent) => {
    const pointer = fabricRef.current?.getPointer(e.e);
    if (!pointer) return;
    
    // Afficher les coordonnées
    updateCoordinatesDisplay(pointer.x, -pointer.y);
    
    // Ligne temporaire pendant le dessin
    if (drawingPoints.length > 0 && (currentTool === 'line' || currentTool === 'polyline')) {
      if (tempLine) {
        fabricRef.current?.remove(tempLine);
      }
      const lastPoint = drawingPoints[drawingPoints.length - 1];
      const line = new fabric.Line(
        [lastPoint.x, lastPoint.y, pointer.x, pointer.y],
        { stroke: '#4f8cff', strokeWidth: 1, strokeDashArray: [5, 5] }
      );
      setTempLine(line);
      fabricRef.current?.add(line);
    }
  }, [drawingPoints, currentTool, tempLine]);
  
  const handleMouseUp = useCallback((e: fabric.IEvent) => {
    // Finaliser l'entité selon l'outil
    if (currentTool === 'line' && drawingPoints.length === 2) {
      const newEntity = {
        type: 'LINE',
        start: [drawingPoints[0].x, -drawingPoints[0].y],
        end: [drawingPoints[1].x, -drawingPoints[1].y],
        layer: 'default',
        color: 7,
      };
      addEntity(newEntity);
      setDrawingPoints([]);
    }
  }, [currentTool, drawingPoints, addEntity]);
  
  // Zoom molette
  const handleZoom = useCallback((opt: fabric.IEvent) => {
    const e = opt.e as WheelEvent;
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    const delta = e.deltaY;
    let zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    
    // Limites de zoom
    zoom = Math.min(Math.max(zoom, 0.01), 100);
    
    canvas.zoomToPoint({ x: e.offsetX, y: e.offsetY }, zoom);
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  // Sélection
  const handleSelection = useCallback((e: fabric.IEvent) => {
    const selected = e.selected?.[0];
    if (selected) {
      const data = selected.get('data');
      if (data?.id) {
        selectEntity(data.id);
      }
    }
  }, [selectEntity]);
  
  // Modification d'objet
  const handleObjectModified = useCallback((e: fabric.IEvent) => {
    const obj = e.target;
    if (!obj) return;
    
    const data = obj.get('data');
    if (data?.id) {
      // Extraire les nouvelles coordonnées et mettre à jour l'entité
      const updates = extractCoordsFromFabric(obj);
      updateEntity(data.id, updates);
    }
  }, [updateEntity]);
  
  return (
    <div className="cad-canvas-container">
      <canvas ref={canvasRef} />
    </div>
  );
};

// Utilitaires
function aciToHex(aci: number): string {
  const aciColors: { [key: number]: string } = {
    1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF',
    5: '#0000FF', 6: '#FF00FF', 7: '#FFFFFF', 8: '#808080',
    9: '#C0C0C0',
    // ... compléter avec les 256 couleurs ACI
  };
  return aciColors[aci] || '#FFFFFF';
}

function createArcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const startRad = (start * Math.PI) / 180;
  const endRad = (end * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function drawGrid(canvas: fabric.Canvas) {
  const gridSize = 100; // Ajuster selon l'échelle
  const width = canvas.getWidth();
  const height = canvas.getHeight();
  
  for (let i = 0; i < width; i += gridSize) {
    canvas.add(new fabric.Line([i, 0, i, height], {
      stroke: '#2d3548',
      strokeWidth: 0.5,
      selectable: false,
      evented: false,
    }));
  }
  for (let j = 0; j < height; j += gridSize) {
    canvas.add(new fabric.Line([0, j, width, j], {
      stroke: '#2d3548',
      strokeWidth: 0.5,
      selectable: false,
      evented: false,
    }));
  }
}

export default CadCanvas;
```

### 3. Service de transformation CRS

```typescript
// services/crsService.ts
import proj4 from 'proj4';

// Définition des systèmes de coordonnées suisses
proj4.defs([
  // MN95 (CH1903+/LV95)
  ['EPSG:2056', '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs'],
  
  // MN03 (CH1903/LV03)
  ['EPSG:21781', '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs'],
  
  // WGS84
  ['EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs'],
  
  // Web Mercator
  ['EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs'],
]);

export type CrsCode = 'EPSG:2056' | 'EPSG:21781' | 'EPSG:4326' | 'EPSG:3857';

/**
 * Transforme un point d'un système de coordonnées à un autre
 */
export function transformPoint(
  x: number, 
  y: number, 
  fromCrs: CrsCode, 
  toCrs: CrsCode
): [number, number] {
  return proj4(fromCrs, toCrs, [x, y]) as [number, number];
}

/**
 * Transforme un tableau de coordonnées
 */
export function transformCoords(
  coords: number[][], 
  fromCrs: CrsCode, 
  toCrs: CrsCode
): number[][] {
  return coords.map(([x, y]) => transformPoint(x, y, fromCrs, toCrs));
}

/**
 * Transforme toutes les entités d'un fichier
 */
export function transformEntities(
  entities: any[], 
  fromCrs: CrsCode, 
  toCrs: CrsCode
): any[] {
  return entities.map(entity => {
    const transformed = { ...entity };
    
    switch (entity.type) {
      case 'LINE':
        transformed.start = transformPoint(entity.start[0], entity.start[1], fromCrs, toCrs);
        transformed.end = transformPoint(entity.end[0], entity.end[1], fromCrs, toCrs);
        break;
      
      case 'POLYLINE':
        transformed.points = entity.points.map((p: number[]) => 
          transformPoint(p[0], p[1], fromCrs, toCrs)
        );
        break;
      
      case 'CIRCLE':
      case 'ARC':
        const center = transformPoint(entity.center[0], entity.center[1], fromCrs, toCrs);
        transformed.center = center;
        // Note: le rayon peut nécessiter un ajustement si changement d'unités
        break;
      
      case 'TEXT':
      case 'INSERT':
        transformed.position = transformPoint(
          entity.position[0], entity.position[1], fromCrs, toCrs
        );
        break;
    }
    
    return transformed;
  });
}

/**
 * Détecte automatiquement le CRS probable basé sur les coordonnées
 */
export function detectCrs(x: number, y: number): CrsCode | null {
  // MN95 - E: ~2'480'000 à ~2'840'000, N: ~1'070'000 à ~1'300'000
  if (x > 2400000 && x < 2900000 && y > 1000000 && y < 1400000) {
    return 'EPSG:2056';
  }
  
  // MN03 - E: ~480'000 à ~840'000, N: ~70'000 à ~300'000
  if (x > 400000 && x < 900000 && y > 50000 && y < 400000) {
    return 'EPSG:21781';
  }
  
  // WGS84 - Lon: ~5° à ~11°, Lat: ~45° à ~48°
  if (x > 4 && x < 12 && y > 44 && y < 49) {
    return 'EPSG:4326';
  }
  
  // Web Mercator (zone Suisse approximative)
  if (x > 500000 && x < 1200000 && y > 5700000 && y < 6100000) {
    return 'EPSG:3857';
  }
  
  return null;
}

/**
 * Transformation MN03 → MN95 avec FINELTRA (approximation)
 * Note: Pour une précision optimale, utiliser le service swisstopo REFRAME
 */
export function mn03ToMn95(e: number, n: number): [number, number] {
  // Transformation simple (translation + rotation légère)
  // Pour une précision <1m, utiliser l'API REFRAME de swisstopo
  const E_mn95 = e + 2000000;
  const N_mn95 = n + 1000000;
  return [E_mn95, N_mn95];
}

/**
 * Appel à l'API REFRAME de swisstopo pour transformation précise
 */
export async function reframeTransform(
  coords: number[][], 
  fromFrame: 'lv03' | 'lv95', 
  toFrame: 'lv03' | 'lv95'
): Promise<number[][]> {
  const response = await fetch('https://geodesy.geo.admin.ch/reframe/lv03tolv95', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: coords.map(([e, n]) => ({ easting: e, northing: n })),
    }),
  });
  
  const data = await response.json();
  return data.coordinates.map((c: any) => [c.easting, c.northing]);
}
```

### 4. Service de synchronisation PostGIS

```typescript
// services/postgisService.ts
import { Pool, QueryResult } from 'pg';
import { transformCoords, CrsCode } from './crsService';

interface PostGISConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema?: string;
}

interface SyncMapping {
  layerName: string;
  tableName: string;
  geometryColumn: string;
  geometryType: 'POINT' | 'LINESTRING' | 'POLYGON' | 'MULTIPOLYGON';
  attributeMapping: Record<string, string>; // DXF attr → DB column
  srid: number;
}

export class PostGISService {
  private pool: Pool;
  private schema: string;
  
  constructor(config: PostGISConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
    });
    this.schema = config.schema || 'public';
  }
  
  /**
   * Teste la connexion à la base de données
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Erreur de connexion PostGIS:', error);
      return false;
    }
  }
  
  /**
   * Liste les tables géospatiales disponibles
   */
  async listGeoTables(): Promise<any[]> {
    const query = `
      SELECT 
        f_table_schema as schema,
        f_table_name as table_name,
        f_geometry_column as geom_column,
        type as geom_type,
        srid
      FROM geometry_columns
      WHERE f_table_schema = $1
      ORDER BY f_table_name
    `;
    const result = await this.pool.query(query, [this.schema]);
    return result.rows;
  }
  
  /**
   * Charge une couche PostGIS comme entités CAD
   */
  async loadLayer(
    tableName: string, 
    geomColumn: string = 'geom',
    targetCrs: CrsCode = 'EPSG:2056'
  ): Promise<any[]> {
    const query = `
      SELECT 
        id,
        ST_AsGeoJSON(ST_Transform(${geomColumn}, 2056)) as geometry,
        *
      FROM ${this.schema}.${tableName}
    `;
    
    const result = await this.pool.query(query);
    
    return result.rows.map(row => {
      const geojson = JSON.parse(row.geometry);
      return this.geojsonToEntity(geojson, row);
    });
  }
  
  /**
   * Convertit GeoJSON en entité CAD
   */
  private geojsonToEntity(geojson: any, attributes: any): any {
    const base = {
      handle: `pg_${attributes.id}`,
      layer: 'PostGIS',
      color: 3, // Vert pour distinguer
      attributes,
    };
    
    switch (geojson.type) {
      case 'Point':
        return {
          ...base,
          type: 'POINT',
          position: geojson.coordinates,
        };
      
      case 'LineString':
        return {
          ...base,
          type: 'POLYLINE',
          points: geojson.coordinates,
          closed: false,
        };
      
      case 'Polygon':
        return {
          ...base,
          type: 'POLYLINE',
          points: geojson.coordinates[0], // Anneau extérieur
          closed: true,
        };
      
      default:
        return null;
    }
  }
  
  /**
   * Synchronise des entités CAD vers PostGIS
   */
  async syncToPostGIS(
    entities: any[], 
    mapping: SyncMapping,
    sourceCrs: CrsCode = 'EPSG:2056'
  ): Promise<{ inserted: number; errors: string[] }> {
    const client = await this.pool.connect();
    const errors: string[] = [];
    let inserted = 0;
    
    try {
      await client.query('BEGIN');
      
      // Créer un point de sauvegarde pour rollback si nécessaire
      await client.query('SAVEPOINT before_sync');
      
      for (const entity of entities) {
        if (entity.layer !== mapping.layerName) continue;
        
        try {
          const wkt = this.entityToWKT(entity, mapping.geometryType);
          if (!wkt) continue;
          
          // Construire les colonnes et valeurs
          const columns = [mapping.geometryColumn];
          const values = [`ST_SetSRID(ST_GeomFromText($1), ${mapping.srid})`];
          const params: any[] = [wkt];
          
          let paramIndex = 2;
          for (const [dxfAttr, dbColumn] of Object.entries(mapping.attributeMapping)) {
            if (entity.attributes?.[dxfAttr] !== undefined) {
              columns.push(dbColumn);
              values.push(`$${paramIndex}`);
              params.push(entity.attributes[dxfAttr]);
              paramIndex++;
            }
          }
          
          const query = `
            INSERT INTO ${this.schema}.${mapping.tableName} 
            (${columns.join(', ')}) 
            VALUES (${values.join(', ')})
          `;
          
          await client.query(query, params);
          inserted++;
          
        } catch (entityError) {
          errors.push(`Entité ${entity.handle}: ${entityError}`);
        }
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT before_sync');
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
    return { inserted, errors };
  }
  
  /**
   * Convertit une entité CAD en WKT
   */
  private entityToWKT(entity: any, targetType: string): string | null {
    switch (entity.type) {
      case 'POINT':
        if (targetType !== 'POINT') return null;
        return `POINT(${entity.position[0]} ${entity.position[1]})`;
      
      case 'LINE':
        if (targetType !== 'LINESTRING') return null;
        return `LINESTRING(${entity.start[0]} ${entity.start[1]}, ${entity.end[0]} ${entity.end[1]})`;
      
      case 'POLYLINE':
        const coords = entity.points.map((p: number[]) => `${p[0]} ${p[1]}`).join(', ');
        
        if (entity.closed && targetType === 'POLYGON') {
          // Fermer le polygone si nécessaire
          const firstPoint = entity.points[0];
          const lastPoint = entity.points[entity.points.length - 1];
          if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
            return `POLYGON((${coords}, ${firstPoint[0]} ${firstPoint[1]}))`;
          }
          return `POLYGON((${coords}))`;
        }
        
        return `LINESTRING(${coords})`;
      
      case 'CIRCLE':
        if (targetType !== 'POLYGON') return null;
        // Approximer le cercle par un polygone à 64 segments
        const points = [];
        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * 2 * Math.PI;
          const x = entity.center[0] + entity.radius * Math.cos(angle);
          const y = entity.center[1] + entity.radius * Math.sin(angle);
          points.push(`${x} ${y}`);
        }
        return `POLYGON((${points.join(', ')}))`;
      
      default:
        return null;
    }
  }
  
  /**
   * Compare les entités CAD avec PostGIS (diff)
   */
  async compareWithPostGIS(
    entities: any[],
    tableName: string,
    geomColumn: string,
    tolerance: number = 0.01
  ): Promise<{
    onlyInCad: any[];
    onlyInDb: any[];
    modified: any[];
    matching: any[];
  }> {
    // Charger les données PostGIS
    const dbEntities = await this.loadLayer(tableName, geomColumn);
    
    const onlyInCad: any[] = [];
    const onlyInDb: any[] = [...dbEntities];
    const modified: any[] = [];
    const matching: any[] = [];
    
    for (const cadEntity of entities) {
      const wkt = this.entityToWKT(cadEntity, 'LINESTRING'); // Adapter selon type
      if (!wkt) continue;
      
      // Chercher une correspondance géométrique
      const query = `
        SELECT id, ST_AsText(${geomColumn}) as geom
        FROM ${this.schema}.${tableName}
        WHERE ST_DWithin(${geomColumn}, ST_GeomFromText($1, 2056), $2)
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [wkt, tolerance]);
      
      if (result.rows.length > 0) {
        // Correspondance trouvée
        const dbMatch = result.rows[0];
        const dbIndex = onlyInDb.findIndex(e => e.handle === `pg_${dbMatch.id}`);
        if (dbIndex >= 0) {
          onlyInDb.splice(dbIndex, 1);
        }
        
        // Vérifier si identique ou modifié
        if (this.geometriesEqual(wkt, dbMatch.geom, tolerance)) {
          matching.push({ cad: cadEntity, db: dbMatch });
        } else {
          modified.push({ cad: cadEntity, db: dbMatch });
        }
      } else {
        onlyInCad.push(cadEntity);
      }
    }
    
    return { onlyInCad, onlyInDb, modified, matching };
  }
  
  private geometriesEqual(wkt1: string, wkt2: string, tolerance: number): boolean {
    // Comparaison simplifiée - pour une vraie comparaison, utiliser ST_Equals ou ST_HausdorffDistance
    return wkt1 === wkt2;
  }
  
  /**
   * Ferme le pool de connexions
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

export default PostGISService;
```

### 5. Service d'intégration FME

```typescript
// services/fmeService.ts
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

interface FMEConfig {
  fmeExePath: string;           // Chemin vers fme.exe
  workspacesDir: string;        // Dossier des workspaces .fmw
  logDir: string;               // Dossier pour les logs
  fmeServerUrl?: string;        // URL FME Server (optionnel)
  fmeServerToken?: string;      // Token FME Server (optionnel)
}

interface WorkspaceParameter {
  name: string;
  value: string;
}

interface FMEJobResult {
  success: boolean;
  exitCode: number;
  log: string;
  duration: number;
  outputFiles?: string[];
}

export class FMEService {
  private config: FMEConfig;
  private runningProcesses: Map<string, ChildProcess> = new Map();
  
  constructor(config: FMEConfig) {
    this.config = config;
    
    // Vérifier que FME est installé
    if (!fs.existsSync(config.fmeExePath)) {
      console.warn(`FME non trouvé à ${config.fmeExePath}`);
    }
  }
  
  /**
   * Liste les workspaces disponibles
   */
  async listWorkspaces(): Promise<{ name: string; path: string; description?: string }[]> {
    const workspaces: any[] = [];
    
    const files = fs.readdirSync(this.config.workspacesDir);
    for (const file of files) {
      if (file.endsWith('.fmw')) {
        const fullPath = path.join(this.config.workspacesDir, file);
        const description = await this.extractWorkspaceDescription(fullPath);
        
        workspaces.push({
          name: file.replace('.fmw', ''),
          path: fullPath,
          description,
        });
      }
    }
    
    return workspaces;
  }
  
  /**
   * Extrait la description d'un workspace FME
   */
  private async extractWorkspaceDescription(fmwPath: string): Promise<string | undefined> {
    try {
      const content = fs.readFileSync(fmwPath, 'utf-8');
      // Les workspaces FME sont des fichiers texte avec des métadonnées
      const match = content.match(/DESCRIPTION\s+"([^"]+)"/);
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  }
  
  /**
   * Liste les paramètres publiés d'un workspace
   */
  async getWorkspaceParameters(workspacePath: string): Promise<WorkspaceParameter[]> {
    const params: WorkspaceParameter[] = [];
    
    try {
      const content = fs.readFileSync(workspacePath, 'utf-8');
      
      // Regex pour trouver les paramètres publiés
      const paramRegex = /MACRO\s+(\w+)\s+"([^"]*)"/g;
      let match;
      
      while ((match = paramRegex.exec(content)) !== null) {
        params.push({
          name: match[1],
          value: match[2], // Valeur par défaut
        });
      }
    } catch (error) {
      console.error('Erreur lecture paramètres workspace:', error);
    }
    
    return params;
  }
  
  /**
   * Exécute un workspace FME localement
   */
  async runWorkspace(
    workspaceName: string,
    parameters: WorkspaceParameter[] = [],
    onProgress?: (message: string) => void
  ): Promise<FMEJobResult> {
    const startTime = Date.now();
    const workspacePath = path.join(this.config.workspacesDir, `${workspaceName}.fmw`);
    const logFile = path.join(
      this.config.logDir, 
      `${workspaceName}_${Date.now()}.log`
    );
    
    // Construire la ligne de commande
    const args = [
      workspacePath,
      `--LogFile`, logFile,
    ];
    
    // Ajouter les paramètres
    for (const param of parameters) {
      args.push(`--${param.name}`, param.value);
    }
    
    return new Promise((resolve) => {
      const jobId = `${workspaceName}_${Date.now()}`;
      let logContent = '';
      
      const process = spawn(this.config.fmeExePath, args, {
        cwd: this.config.workspacesDir,
      });
      
      this.runningProcesses.set(jobId, process);
      
      process.stdout?.on('data', (data) => {
        const message = data.toString();
        logContent += message;
        onProgress?.(message);
      });
      
      process.stderr?.on('data', (data) => {
        const message = data.toString();
        logContent += `[ERROR] ${message}`;
        onProgress?.(`[ERROR] ${message}`);
      });
      
      process.on('close', (code) => {
        this.runningProcesses.delete(jobId);
        
        const duration = Date.now() - startTime;
        
        // Lire le fichier log complet si disponible
        let fullLog = logContent;
        if (fs.existsSync(logFile)) {
          fullLog = fs.readFileSync(logFile, 'utf-8');
        }
        
        resolve({
          success: code === 0,
          exitCode: code || 0,
          log: fullLog,
          duration,
          outputFiles: this.extractOutputFiles(fullLog),
        });
      });
      
      process.on('error', (error) => {
        this.runningProcesses.delete(jobId);
        
        resolve({
          success: false,
          exitCode: -1,
          log: `Erreur d'exécution: ${error.message}`,
          duration: Date.now() - startTime,
        });
      });
    });
  }
  
  /**
   * Extrait les fichiers de sortie du log FME
   */
  private extractOutputFiles(log: string): string[] {
    const files: string[] = [];
    
    // Pattern commun dans les logs FME pour les fichiers écrits
    const patterns = [
      /Successfully wrote\s+\d+\s+features to\s+'([^']+)'/g,
      /Output file:\s*([^\s]+)/g,
      /Written to:\s*([^\s]+)/g,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(log)) !== null) {
        files.push(match[1]);
      }
    }
    
    return [...new Set(files)]; // Dédupliquer
  }
  
  /**
   * Annule un job en cours
   */
  cancelJob(jobId: string): boolean {
    const process = this.runningProcesses.get(jobId);
    if (process) {
      process.kill('SIGTERM');
      this.runningProcesses.delete(jobId);
      return true;
    }
    return false;
  }
  
  /**
   * Exécute via FME Server (si configuré)
   */
  async runOnServer(
    repository: string,
    workspaceName: string,
    parameters: WorkspaceParameter[] = []
  ): Promise<FMEJobResult> {
    if (!this.config.fmeServerUrl || !this.config.fmeServerToken) {
      throw new Error('FME Server non configuré');
    }
    
    const startTime = Date.now();
    
    // Construire les paramètres pour l'API
    const publishedParams: Record<string, string> = {};
    for (const param of parameters) {
      publishedParams[param.name] = param.value;
    }
    
    try {
      // Soumettre le job
      const submitResponse = await fetch(
        `${this.config.fmeServerUrl}/fmerest/v3/transformations/submit/${repository}/${workspaceName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `fmetoken token=${this.config.fmeServerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            publishedParameters: publishedParams,
          }),
        }
      );
      
      if (!submitResponse.ok) {
        throw new Error(`Erreur soumission job: ${submitResponse.statusText}`);
      }
      
      const { id: jobId } = await submitResponse.json();
      
      // Polling du statut
      let status = 'SUBMITTED';
      let log = '';
      
      while (status === 'SUBMITTED' || status === 'RUNNING') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await fetch(
          `${this.config.fmeServerUrl}/fmerest/v3/transformations/jobs/id/${jobId}`,
          {
            headers: {
              'Authorization': `fmetoken token=${this.config.fmeServerToken}`,
            },
          }
        );
        
        const jobInfo = await statusResponse.json();
        status = jobInfo.status;
        
        // Récupérer le log
        const logResponse = await fetch(
          `${this.config.fmeServerUrl}/fmerest/v3/transformations/jobs/id/${jobId}/log`,
          {
            headers: {
              'Authorization': `fmetoken token=${this.config.fmeServerToken}`,
            },
          }
        );
        
        if (logResponse.ok) {
          log = await logResponse.text();
        }
      }
      
      return {
        success: status === 'SUCCESS',
        exitCode: status === 'SUCCESS' ? 0 : 1,
        log,
        duration: Date.now() - startTime,
      };
      
    } catch (error) {
      return {
        success: false,
        exitCode: -1,
        log: `Erreur FME Server: ${error}`,
        duration: Date.now() - startTime,
      };
    }
  }
  
  /**
   * Crée un workspace simple pour l'export DWG → PostGIS
   */
  async generateDwgToPostGISWorkspace(
    outputPath: string,
    postgisConfig: {
      host: string;
      port: number;
      database: string;
      user: string;
      schema: string;
    },
    mappings: Array<{
      dwgLayer: string;
      postgisTable: string;
      geometryType: string;
    }>
  ): Promise<void> {
    // Template de workspace FME
    const template = `
#! FME 2024.0
MACRO SourceDataset_ACAD ""
MACRO DestDataset_POSTGIS "$(POSTGIS_CONNECTION_STRING)"

# =====================================================================
# Workspace généré par GeoMind
# Export DWG vers PostGIS
# =====================================================================

READER_TYPE ACAD
READER_DATASET "$(SourceDataset_ACAD)"

WRITER_TYPE POSTGIS
WRITER_DATASET "$(DestDataset_POSTGIS)"

${mappings.map(m => `
# Mapping: ${m.dwgLayer} → ${m.postgisTable}
ROUTE ${m.dwgLayer} ${m.postgisTable}
`).join('\n')}
    `.trim();
    
    fs.writeFileSync(outputPath, template, 'utf-8');
  }
}

export default FMEService;
```

---

## 🎨 STYLES CSS DU MODULE

```css
/* styles/CadModule.css */

.cad-module {
  --cad-bg: #1a1f2e;
  --cad-bg-secondary: #242b3d;
  --cad-bg-tertiary: #2d3548;
  --cad-border: #3d4659;
  --cad-text: #e8eaed;
  --cad-text-muted: #9aa0a6;
  --cad-accent: #4f8cff;
  --cad-accent-hover: #6ba1ff;
  --cad-success: #34d399;
  --cad-warning: #fbbf24;
  --cad-danger: #f87171;
  --cad-crosshair: #4f8cff;
  
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--cad-bg);
  color: var(--cad-text);
  font-family: 'Segoe UI', -apple-system, sans-serif;
}

/* Barre d'outils principale */
.cad-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--cad-bg-secondary);
  border-bottom: 1px solid var(--cad-border);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 8px;
  border-right: 1px solid var(--cad-border);
}

.toolbar-group:last-child {
  border-right: none;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--cad-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  background: var(--cad-bg-tertiary);
  color: var(--cad-text);
}

.toolbar-btn.active {
  background: var(--cad-accent);
  color: white;
  border-color: var(--cad-accent);
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Zone principale */
.cad-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Panneau latéral */
.cad-panel {
  width: 280px;
  background: var(--cad-bg-secondary);
  border-right: 1px solid var(--cad-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cad-panel.right {
  border-right: none;
  border-left: 1px solid var(--cad-border);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--cad-border);
}

.panel-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

/* Calques */
.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.layer-item:hover {
  background: var(--cad-bg-tertiary);
}

.layer-item.selected {
  background: rgba(79, 140, 255, 0.15);
}

.layer-visibility {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.layer-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(255,255,255,0.2);
}

.layer-name {
  flex: 1;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-lock {
  color: var(--cad-text-muted);
  font-size: 12px;
}

/* Zone de dessin */
.cad-canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #0d1117;
}

.cad-canvas-container {
  width: 100%;
  height: 100%;
}

.cad-canvas-container canvas {
  cursor: crosshair;
}

/* Ligne de commande */
.cad-command-line {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--cad-bg-secondary);
  border-top: 1px solid var(--cad-border);
}

.command-prompt {
  color: var(--cad-text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  margin-right: 8px;
}

.command-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--cad-text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  outline: none;
}

/* Barre de statut */
.cad-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  background: var(--cad-bg-tertiary);
  border-top: 1px solid var(--cad-border);
  font-size: 11px;
  color: var(--cad-text-muted);
}

.status-coords {
  font-family: 'JetBrains Mono', monospace;
  display: flex;
  gap: 16px;
}

.status-toggles {
  display: flex;
  gap: 8px;
}

.status-toggle {
  padding: 2px 8px;
  background: transparent;
  border: 1px solid var(--cad-border);
  border-radius: 3px;
  color: var(--cad-text-muted);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.status-toggle.active {
  background: var(--cad-accent);
  border-color: var(--cad-accent);
  color: white;
}

/* Indicateur de snap */
.snap-indicator {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid var(--cad-accent);
  border-radius: 50%;
  background: transparent;
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: snap-pulse 0.3s ease;
}

@keyframes snap-pulse {
  0% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

/* Mode God - Sync Panel */
.sync-panel {
  padding: 12px;
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: var(--cad-bg);
  border-radius: 6px;
  margin-bottom: 12px;
}

.sync-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.sync-indicator.connected { background: var(--cad-success); }
.sync-indicator.disconnected { background: var(--cad-danger); }
.sync-indicator.syncing { 
  background: var(--cad-warning);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.sync-btn {
  width: 100%;
  padding: 10px;
  background: var(--cad-accent);
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.sync-btn:hover {
  background: var(--cad-accent-hover);
}

.sync-btn:disabled {
  background: var(--cad-bg-tertiary);
  color: var(--cad-text-muted);
  cursor: not-allowed;
}

/* Diff viewer */
.diff-legend {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 11px;
}

.diff-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.diff-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.diff-color.added { background: var(--cad-success); }
.diff-color.removed { background: var(--cad-danger); }
.diff-color.modified { background: var(--cad-warning); }
.diff-color.unchanged { background: var(--cad-text-muted); }
```

---

## 📋 CHECKLIST D'IMPLÉMENTATION

### Phase 1 : Fondations (Semaines 1-2)
- [ ] Setup structure du module
- [ ] Intégration ODA File Converter
- [ ] Parser DXF basique (ezdxf)
- [ ] Canvas Fabric.js avec rendu entités simples
- [ ] Navigation (pan, zoom)

### Phase 2 : Mode Standard (Semaines 3-4)
- [ ] Panneau des calques (toggle visibility)
- [ ] Rendu complet (lignes, polylignes, cercles, arcs, textes)
- [ ] Mesure distance et surface
- [ ] Export PNG/PDF
- [ ] Superposition carte de fond

### Phase 3 : Mode Expert (Semaines 5-8)
- [ ] Outils de sélection
- [ ] Undo/Redo
- [ ] Outils de dessin (ligne, polyligne, cercle, texte)
- [ ] Système d'accrochage (snaps)
- [ ] Outils de modification (déplacer, copier, rotation)
- [ ] Gestion des calques (création, modification)
- [ ] Export DXF, GeoJSON, Shapefile

### Phase 4 : Mode God (Semaines 9-12)
- [ ] Connexion PostGIS
- [ ] Charger couches PostGIS comme calques
- [ ] Comparaison/Diff CAD vs PostGIS
- [ ] Synchronisation vers PostGIS
- [ ] Intégration FME (liste workspaces, exécution)
- [ ] Transformation CRS (MN03↔MN95↔WGS84)
- [ ] Audit log

### Phase 5 : Polish (Semaines 13-14)
- [ ] Tests complets
- [ ] Optimisation performance
- [ ] Documentation utilisateur
- [ ] Gestion des erreurs robuste

---

## 🆘 RESSOURCES

### Documentation
- ezdxf: https://ezdxf.readthedocs.io/
- Fabric.js: http://fabricjs.com/docs/
- proj4js: https://github.com/proj4js/proj4js
- PostGIS: https://postgis.net/documentation/
- FME: https://docs.safe.com/

### APIs suisses
- swisstopo WMTS: https://api3.geo.admin.ch/
- REFRAME (transformation coords): https://www.swisstopo.admin.ch/fr/cartes-donnees-en-ligne/calculation-services/reframe.html
- ODA File Converter: https://www.opendesign.com/guestfiles/oda_file_converter

---

*Prompt créé le 13 décembre 2025 pour le développement du module CAD de GeoMind*
