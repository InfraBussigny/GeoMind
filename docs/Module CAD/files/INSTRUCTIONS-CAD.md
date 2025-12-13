# CLAUDE CODE - Module CAD GeoMind
## Instructions rapides

---

## 🎯 MISSION
Développer un module CAD complet avec 3 niveaux d'accès (Standard/Expert/God) pour visualiser, éditer et synchroniser des DWG/DXF avec PostGIS.

## 📊 NIVEAUX D'ACCÈS

| Mode | Utilisateurs | Fonctionnalités clés |
|------|--------------|---------------------|
| **Standard** | Secrétariat, élus | Lecture seule, navigation, mesures, export image |
| **Expert** | Techniciens | + Dessin, édition, snaps, export DXF/GeoJSON |
| **God** | Responsable SIT | + Sync PostGIS, saisie GIS, intégration FME |

## 🔧 STACK TECHNIQUE

```
Frontend: React + TypeScript + Fabric.js + Leaflet + proj4js
Backend:  Python (FastAPI) + ezdxf + pyproj
External: ODA File Converter (DWG→DXF), FME Desktop
Database: PostgreSQL/PostGIS
```

## 📦 DÉPENDANCES

```bash
# Frontend
npm install fabric @types/fabric three leaflet proj4 zustand lucide-react

# Backend Python  
pip install ezdxf pyproj psycopg2-binary asyncpg fastapi uvicorn shapely geopandas
```

## 🗂️ STRUCTURE

```
src/modules/cad/
├── components/
│   ├── CadModule.tsx           # Principal
│   ├── Toolbar/                # Barre d'outils
│   ├── Canvas/CadCanvas.tsx    # Zone dessin Fabric.js
│   ├── Panels/                 # Calques, propriétés, sync
│   └── CommandLine/            # Ligne de commande
├── hooks/
│   ├── useCadState.ts          # État global
│   ├── useDrawing.ts           # Dessin
│   ├── useSnapping.ts          # Accrochage
│   └── usePostgisSync.ts       # Sync DB
├── services/
│   ├── dxfParser.ts            # Bridge vers Python/ezdxf
│   ├── crsService.ts           # proj4 transformations
│   ├── postgisService.ts       # Connexion PostGIS
│   └── fmeService.ts           # Intégration FME
└── config/
```

## 🔄 FLUX PRINCIPAL

```
1. User drop DWG
2. Electron → ODA Converter → fichier.dxf (temp)
3. Python/ezdxf → parse → JSON entities
4. Fabric.js → render canvas
5. [Mode God] → sync bidirectionnel PostGIS
```

## 🌐 CRS À SUPPORTER

| EPSG | Nom | Usage |
|------|-----|-------|
| 2056 | MN95 | **Principal** (standard suisse actuel) |
| 21781 | MN03 | Données historiques |
| 4326 | WGS84 | GPS |
| 3857 | Web Mercator | Affichage Leaflet |

## ⚡ ÉTAPES D'IMPLÉMENTATION

### Phase 1 (2 sem) - Fondations
```
[ ] Structure module + ODA integration
[ ] Parser DXF basique → JSON
[ ] Canvas Fabric.js (lignes, polylignes)
[ ] Pan/zoom navigation
```

### Phase 2 (2 sem) - Mode Standard
```
[ ] Rendu complet (cercles, arcs, textes, blocs)
[ ] Panneau calques (toggle on/off)
[ ] Mesure distance/surface
[ ] Export PNG/PDF
[ ] Fond de carte swisstopo
```

### Phase 3 (4 sem) - Mode Expert
```
[ ] Sélection (simple, fenêtre)
[ ] Undo/Redo (50 niveaux)
[ ] Outils dessin (ligne, polyligne, cercle, texte)
[ ] Snapping (extrémité, milieu, intersection...)
[ ] Modification (déplacer, copier, rotation, échelle)
[ ] Calques (créer, couleur, verrouiller)
[ ] Export DXF, GeoJSON, Shapefile
```

### Phase 4 (4 sem) - Mode God
```
[ ] Connexion PostgreSQL/PostGIS
[ ] Charger couche PostGIS → calque CAD
[ ] Diff visuel CAD vs PostGIS
[ ] Sync Push (CAD → PostGIS)
[ ] Templates saisie GIS (parcelles, conduites...)
[ ] Intégration FME (liste workspaces, run)
[ ] Transformation MN03↔MN95 (FINELTRA/REFRAME)
[ ] Audit log
```

## 🔑 POINTS CRITIQUES

1. **DWG propriétaire** → Toujours convertir via ODA File Converter
2. **Performance** → Web Workers pour parsing gros fichiers
3. **Snapping** → Essentiel pour précision GIS
4. **CRS** → Valider avant sync PostGIS (tout en 2056)
5. **FME** → Gérer async (jobs peuvent durer longtemps)

## 📝 COMMANDES CAD À IMPLÉMENTER

```
Basiques:     LINE, PLINE, CIRCLE, ARC, TEXT, POINT
Modification: MOVE, COPY, ROTATE, SCALE, MIRROR, ERASE
Édition:      TRIM, EXTEND, OFFSET, FILLET, CHAMFER, EXPLODE, JOIN
Navigation:   ZOOM, PAN, REGEN
Calques:      LAYER, LAYERSTATE
Blocs:        INSERT, BLOCK, WBLOCK
```

## 🆘 RESSOURCES

- ezdxf docs: https://ezdxf.readthedocs.io/
- Fabric.js: http://fabricjs.com/docs/
- proj4 defs suisses: incluses dans prompt complet
- ODA Converter: https://www.opendesign.com/guestfiles/oda_file_converter

---

**Voir PROMPT-CAD-MODULE.md pour spécifications complètes et code de référence.**
