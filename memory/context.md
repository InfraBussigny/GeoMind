# Contexte SIT - Commune de Bussigny

## Dernière mise à jour
2025-12-08

## Responsable
- **Nom** : Marc Zermatten
- **Poste** : Responsable géodonnées et SIT
- **Organisation** : Commune de Bussigny (VD)

## Stack technique

### SIG Desktop
- **QGIS** : Version à documenter
- Plugins utilisés : à documenter

### Bases de données
- **PostgreSQL/PostGIS** : Données géospatiales
- **Oracle** : Données métier (à préciser)

### ETL & Transformation
- **FME** : Workbenches pour import/export, transformations

### Standards & Formats
- EPSG:2056 (MN95) - Système de référence suisse
- Interlis pour échanges cantonaux
- GeoPackage pour projets locaux

## Infrastructure SIT Bussigny

### Architecture générale (4 couches)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ MISE À JOUR & EXPLOITATION                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  AutoCAD Map 3D                    │  QGIS Desktop                          │
│  • Assainissement                  │  • Orthophoto                          │
│  • Fibre optique                   │  • Nature                              │
│  • (Électricité)                   │  • Points d'intérêts                   │
│  • (Eau potable)                   │  • Routes, Travaux spéciaux...         │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                │
                    ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BASES DE DONNÉES                                                            │
├──────────────────┬─────────────────────────────────┬────────────────────────┤
│ SRV-SAI          │ SRV-FME                         │ Serveur SDOL           │
│ (serveur interne)│ (serveur interne)               │                        │
│                  │                                 │                        │
│ ┌──────────┐     │ ┌─────┐    ┌────────────┐      │ ┌────────────┐         │
│ │  ORACLE  │     │ │ FME │───▶│ PostgreSQL │◀─────┼─│ PostgreSQL │         │
│ └──────────┘     │ │ MAJ │    │ (Bussigny) │ FME  │ │   (SDOL)   │         │
│                  │ │ quot│    └────────────┘ MAJ  │ └────────────┘         │
│                  │ └─────┘                  ponct.│                        │
└──────────────────┴─────────────────────────────────┴────────────────────────┘
                                    │                         │
                                    ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ DIFFUSION                                                                   │
├─────────────────────────────────────┬───────────────────────────────────────┤
│ Serveur externe Exoscale            │ Serveur SDOL                          │
│                                     │                                       │
│ ┌─────────────────────────────┐     │ ┌─────────────────────────────┐       │
│ │   Géoportail communal       │     │ │  Géoportail intercommunal   │       │
│ │   QGIS Web Server + QWC2    │     │ │  GeoMapFish (HKD)           │       │
│ │   OPENGIS                   │     │ │                             │       │
│ └─────────────────────────────┘     │ └─────────────────────────────┘       │
└─────────────────────────────────────┴───────────────────────────────────────┘
                    │                                │
                    ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONSULTATION                                                                │
├─────────────────────────────────────┬───────────────────────────────────────┤
│      Utilisateurs internes          │       Utilisateurs publics            │
└─────────────────────────────────────┴───────────────────────────────────────┘
```

### Serveurs
| Serveur | Rôle | Localisation |
|---------|------|--------------|
| SRV-SAI | Base Oracle (réseaux techniques) | Interne Bussigny |
| SRV-FME | ETL FME + PostgreSQL/PostGIS | Interne Bussigny |
| Exoscale | Géoportail communal (QWC2) | Externe (cloud) |
| SDOL | PostgreSQL + Géoportail intercommunal | Partenaire |

### Bases de données
| Base | Technologie | Contenu | Connexion QGIS |
|------|-------------|---------|----------------|
| Oracle (SRV-SAI) | Oracle Spatial | Assainissement, Fibre, (Élec, Eau) | Via AutoCAD Map 3D |
| PostgreSQL (Bussigny) | PostGIS | Données SIT communales | `PostGIS_Bussigny` |
| PostgreSQL (SDOL) | PostGIS | Données intercommunales | Via SDOL |

### Flux de données (FME)
- **MAJ quotidienne** : Oracle → PostgreSQL (Bussigny) via FME sur SRV-FME
- **MAJ ponctuelle** : PostgreSQL (SDOL) → PostgreSQL (Bussigny) via FME

### Outils de mise à jour
| Outil | Données gérées |
|-------|----------------|
| AutoCAD Map 3D | Assainissement, Fibre optique, (Électricité, Eau potable) |
| QGIS Desktop | Orthophoto, Nature, POI, Routes, Travaux spéciaux |

### Diffusion web
| Plateforme | Technologie | Public |
|------------|-------------|--------|
| Géoportail communal | QGIS Server + QWC2 (OPENGIS) | Utilisateurs internes |
| Géoportail intercommunal | GeoMapFish (HKD) | Utilisateurs publics |

## Feuille de route GeoBrain 2.0
Référence : `docs/GeoBrain_Specifications_v2.pdf`

### Phases de développement
| Phase | Modules | Priorité |
|-------|---------|----------|
| 1. Fondations | Structure app, Assistant (chat+canevas), Gestion projets | ✅ En cours |
| 2. Productivité | Ghostwriter, Conversion fichiers, Accès PostgreSQL | ⏳ |
| 3. Cartographie | Multi-sources, Auth Carto Ouest, QGIS, Chatbot carto | ⏳ |
| 4. Intégrations | Explorateur fichiers, Tunnels SSH, RDP/VNC | ⏳ |
| 5. Communications | Outlook, 3CX | ⏳ |

### État actuel (Décembre 2024)
- ✅ Structure app (Tauri + SvelteKit)
- ✅ Onglet Cartes (Géoportail Bussigny, Uzuverse)
- ✅ Sidebar et navigation
- ✅ Charte graphique Bussigny
- 🔄 Compilation Tauri via GitHub Actions
- ⏳ Assistant avec canevas (artifacts)
- ⏳ Ghostwriter
- ⏳ Conversion fichiers
- ⏳ Accès PostgreSQL

## Projets actifs
[À documenter au fil des sessions]

## Procédures documentées
[Liens vers les procédures créées]

## Contacts utiles
- ASIT-VD : standards cantonaux
- BG Ingénieurs-Conseils : projets hydrauliques

## Notes techniques
[Spécificités, configurations particulières]

## Ressources graphiques

### Logos Bussigny
**Emplacement** : `M:\7-Infra\0-Gest\2-Mod\7024_Logos`

| Fichier | Usage |
|---------|-------|
| `logo_bussigny_neg.png` | Version blanche pour fonds sombres |
| `logo_bussigny_pos.png` | Version couleur pour fonds clairs |
| `logo_bussigny_horizontal.png` | Version horizontale |
| `logo_bussigny_rvb.png` | Version RGB haute qualité |
| `logo_bussigny_texte.png` | Avec texte "Commune de Bussigny" |
| `*.ai` | Sources Adobe Illustrator |

### Copies locales (GeoBrain App)
- `geobrain-app/static/images/logo_bussigny_neg.png`
- `geobrain-app/static/images/logo_bussigny_pos.png`
