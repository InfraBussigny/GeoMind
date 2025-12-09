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

### Phases de développement (mise à jour décembre 2025)

| Phase | Modules | Priorité |
|-------|---------|----------|
| 1. Fondations | Structure app, Assistant (chat+canevas), Gestion projets | 🔄 En cours |
| 2. IA avancée | Sélection auto modèle, Sub-agents, Optimisation coûts | ⏳ |
| 3. Canevas pro | Édition directe, Streaming char-by-char, Export multi-format, Historique | ⏳ |
| 4. Mémoire | 3 niveaux (immédiate/session/persistante), Défragmentation, Fusion auto | ⏳ |
| 5. Productivité | Ghostwriter, Conversion fichiers, Fonctions auto-générées | ⏳ |
| 6. Données | Accès PostgreSQL, Sources multiples, Parcours/sélection couches | ⏳ |
| 7. Cartographie | Multi-sources, Auth Carto Ouest, QGIS, Chatbot carto | ⏳ |
| 8. Intégrations | Explorateur fichiers, Tunnels SSH, RDP/VNC | ⏳ |
| 9. Communications | Outlook, 3CX | ⏳ |

### Nouvelles fonctionnalités planifiées (v2.1)

#### 1. Optimisation IA et modèles
- **Sélection automatique du modèle** selon type de tâche, complexité, coût, délai, précision
  - Modèles légers → reformulation, traduction simple
  - Modèles avancés → génération code, analyse complexe
- **Sub-agents spécialisés** : code Python, UI, base de données, documentation, QA, optimisation
  - Coordination automatisée (workflow hiérarchique)
  - Transfert d'état entre agents
  - Visualisation de l'avancement

#### 2. Canevas avancé
- **Édition directe** : modification en temps réel, coloration syntaxique
- **Mode live coding** : modifications caractère par caractère
  - 🔵 Caractères ajoutés (bleu)
  - 🔴 Caractères supprimés (rouge)
  - Total modifié + horodatage
- **Export multi-format** : PDF, DOCX, TXT, MD, JSON, HTML
- **Historique des révisions**
- **Détection auto du langage** : Python, YAML, SQL, Markdown, etc.

#### 3. Mémoire à 3 niveaux
| Niveau | Contenu | Durée |
|--------|---------|-------|
| Immédiate | Conversation courante, contexte direct | Session active |
| Session | Éléments à conserver jusqu'à reset | Jusqu'à fermeture |
| Persistante | Réglages, préférences, profils | Permanent |

- Défragmentation automatique
- Fusion des informations redondantes
- Purge contrôlée (taille, ancienneté, pertinence)

#### 4. Automatisation intelligente
- **Détection de patterns** : suggestion de fonctions automatisées pour actions répétitives
- **Bibliothèque locale** de fonctions réutilisables
- Exemple : formatage texte répétitif → fonction dédiée

#### 5. Status bar avancée
Affichage permanent en bas de l'interface :
- Dossier/projet courant
- Coût session (tokens)
- Coût cumulé mois
- Utilisation vs quotas
- Modèle IA actif
- Temps avant reset session
- Statut système (mémoire/CPU/connexion)

#### 6. Nouvelle direction artistique
- **Palette** : vert / noir (cyber/digital)
- **Ambiance** : technique, électrique, glitch
- **Effets** : transitions glitch, animations "impulsion électrique"
- **Typo** : monospace modernisé
- **Mode** : dark theme par défaut
- Icônes cohérentes, contrastes forts

### État actuel (Décembre 2025)
- ✅ Structure app (Tauri + SvelteKit)
- ✅ Onglet Cartes (Géoportail Bussigny, Uzuverse)
- ✅ Sidebar et navigation
- ✅ Charte graphique Bussigny (à migrer vers nouvelle DA)
- ✅ Backend avec outils (read, write, execute, web_search, web_fetch)
- ✅ Système d'agents basique
- 🔄 Streaming temps réel dans le canevas
- 🔄 Buffer de prompts + bouton stop
- ⏳ Sub-agents spécialisés
- ⏳ Sélection automatique modèle
- ⏳ Canevas éditable avec historique
- ⏳ Status bar
- ⏳ Nouvelle DA vert/noir

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
