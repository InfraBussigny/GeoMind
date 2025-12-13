# BDCO Sketcher - Plugin QGIS

Plugin QGIS pour creer des plans de servitudes selon les standards vaudois.

## Fonctionnalites

### Chargement automatique des couches BDCO
- Connexion a PostgreSQL/PostGIS (connexions QGIS existantes)
- Chargement des couches cadastrales avec styles pre-configures :
  - **Parcelles** : contour noir fin, fond gris clair, etiquettes numeros
  - **Batiments** : gris moyen
  - **Surfaces** : routes et surfaces dures
  - **Points limites** : cercles vides
  - **Noms locaux** : etiquettes italiques
  - **Limites de plans** : tirets

### Couches servitudes LINEAIRES (conduites)
Couches memoire editables pre-stylisees :

| Code | Type | Couleur |
|------|------|---------|
| EU | Eaux usees (refoulement) | Rouge #E52421 |
| EC | Eaux claires | Bleu #4A90D9 |
| ESP | Eaux sous pression | Vert #22B14C |
| SEIC | Electricite | Violet #AEA1D1 |
| GAZ | Gaz | Jaune #FFD700 |
| TELECOM | Telecommunications | Orange #FF8C00 |
| AUTRE | Autre | Gris #808080 |

### Couches servitudes SURFACIQUES (emprises)
Couches memoire editables avec fond semi-transparent :

| Code | Type | Couleur |
|------|------|---------|
| EMPRISE_EU | Emprise eaux usees | Rouge transparent |
| EMPRISE_EC | Emprise eaux claires | Bleu transparent |
| EMPRISE_ESP | Emprise eaux sous pression | Vert transparent |
| EMPRISE_SEIC | Emprise electricite | Violet transparent |
| EMPRISE_GAZ | Emprise gaz | Jaune transparent |
| PASSAGE | Servitude de passage | Brun transparent |
| NON_BATIR | Zone non aedificandi | Rouge transparent, tirets |
| AUTRE_SURF | Autre surfacique | Gris transparent |

## Installation

### Methode 1 : Copie manuelle
1. Copier le dossier `bdco_sketcher` dans :
   - Windows : `%APPDATA%\QGIS\QGIS3\profiles\default\python\plugins\`
   - Linux : `~/.local/share/QGIS/QGIS3/profiles/default/python/plugins/`
   - Mac : `~/Library/Application Support/QGIS/QGIS3/profiles/default/python/plugins/`

2. Redemarrer QGIS

3. Activer le plugin : Menu Extensions > Sketcher et configurer les extensions > Cocher "BDCO Sketcher"

### Methode 2 : Depuis ZIP
1. Menu Extensions > Sketcher et configurer les extensions
2. Installer depuis un ZIP
3. Selectionner le fichier `bdco_sketcher.zip`

## Utilisation

### Sketcher complet
1. Cliquer sur l'icone "Sketcher plan de servitude" dans la toolbar
2. Selectionner la connexion PostgreSQL
3. Choisir le schema (mo, cadastre, bdco, public)
4. Cocher les couches BDCO a charger
5. Cocher les servitudes lineaires (conduites)
6. Cocher les servitudes surfaciques (emprises)
7. Cliquer sur "Charger"

### Creation rapide des servitudes
- Cliquer sur "Creer couches servitudes" pour creer TOUTES les couches de servitudes en une fois (lineaires + surfaciques)

## Configuration

### Noms de tables BDCO
Le plugin recherche automatiquement les tables suivantes (par ordre de priorite) :

- Parcelles : `mo_bf_bien_fonds`, `bf_bien_fonds`, `bien_fonds`, `parcelles`
- Batiments : `mo_bat_batiment`, `bat_batiment`, `batiment`, `batiments`
- Surfaces : `mo_cs_surface_cs`, `cs_surface_cs`, `couverture_sol`, `surfaces`
- Points limites : `mo_bf_point_limite`, `bf_point_limite`, `points_limites`
- Noms locaux : `mo_nom_local_nom`, `nom_local`, `noms_rues`, `nomenclature`
- Limites plans : `mo_bf_limite_plan`, `limite_plan`, `limites_plans`

### Colonne geometrie
Par defaut, le plugin cherche la colonne `geometrie`. Si votre base utilise un autre nom (ex: `geom`, `the_geom`), modifiez la fonction `build_uri()` dans `bdco_sketcher.py`.

### Personnalisation des couleurs
Modifiez les dictionnaires `SERVITUDES_CONFIG` et `SERVITUDES_SURFACES_CONFIG` dans `bdco_sketcher.py` pour ajuster les couleurs et epaisseurs.

## Attributs des couches servitudes

### Servitudes lineaires
| Champ | Type | Description |
|-------|------|-------------|
| type_serv | string(50) | Type de servitude |
| remarque | string(255) | Commentaire libre |
| largeur_m | double | Largeur en metres |

### Servitudes surfaciques
| Champ | Type | Description |
|-------|------|-------------|
| type_serv | string(50) | Type de servitude |
| remarque | string(255) | Commentaire libre |
| surface_m2 | double | Surface en m2 |

### Georeferencement de plans (Helmert)
Outil integre pour caler des plans PDF sur la carte :

1. Cliquer sur "Georeferencer un plan (Helmert)"
2. Charger un plan PDF (ou image PNG/JPG/TIF)
3. Placer des points de calage (GCPs) :
   - **Manuel** : Cliquer sur l'image puis sur la carte QGIS
   - **Auto (OCR)** : Detection automatique des numeros de parcelles
4. Minimum 2 GCPs (3-4 recommandes)
5. Calculer la transformation Helmert
6. **Previsualiser** : voir le plan cale en transparence sur la carte
7. **Ajuster** : affiner manuellement avec les controles :
   - Translation X/Y (metres)
   - Rotation (degres)
   - Echelle (%)
   - Transparence
8. Exporter en GeoTIFF georeference

La transformation de Helmert (4 parametres) preserve les angles et les rapports de distance :
- 2 translations (X, Y)
- 1 rotation
- 1 facteur d'echelle

### Installation des dependances
Executer `install_dependencies.bat` en tant qu'administrateur, ou manuellement :

```batch
REM Dans OSGeo4W Shell (admin)
pip install pymupdf opencv-python-headless pytesseract pillow numpy
```

Pour la detection automatique (OCR), installer aussi **Tesseract-OCR** :
- Telecharger : https://github.com/UB-Mannheim/tesseract/wiki
- Installer avec les options par defaut

## Auteur
Marc Zermatten - Commune de Bussigny
GeoBrain 2025
