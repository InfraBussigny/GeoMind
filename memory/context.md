# Contexte SIT - Commune de Bussigny

## DIRECTIVE N°1 - NOYAU FONDAMENTAL
> **GeoBrain doit être : EFFICACE, FIABLE, ROBUSTE, RAPIDE, PERTINENT, POLYVALENT, USER-FRIENDLY, SANS AMBIGUÏTÉ.**
>
> Cette directive s'applique à TOUTE action : code, architecture, UI, documentation.
> - Éviter les bugs, hallucinations, quiproquos
> - Prioriser la qualité sur la quantité
> - Tester avant de livrer
> - Code clair, commenté, maintenable

## DIRECTIVE N°2 - INSTALLATION PROGRAMMES (DROITS ADMIN)
> **Procédure obligatoire pour toute installation nécessitant des droits administrateur.**
>
> Marc n'a pas les droits admin directs sur son poste. Procédure à suivre :
>
> 1. **Copier l'installateur** dans `C:\Users\Public\Downloads\` (accessible à tous les comptes)
> 2. **Shift + clic droit** sur l'exécutable → "Exécuter en tant qu'autre utilisateur"
> 3. **Compte** : `admin_user_zema`
> 4. **Mot de passe** : Demander à Marc au moment de l'installation (NE JAMAIS STOCKER)
>
> **Comportement GeoBrain :**
> - Copier automatiquement l'installateur dans `C:\Users\Public\Downloads\` (PAS C:\Temp - problèmes de permissions)
> - Débloquer le fichier avec `Unblock-File` si nécessaire
> - Informer Marc de faire Shift+clic droit → Exécuter en tant qu'autre utilisateur
> - Lui demander son mot de passe pour admin_user_zema (usage unique, non stocké)
> - Guider l'installation étape par étape

## Dernière mise à jour
2025-12-12

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

### Connexions bases de données

**PostgreSQL Bussigny (srv-fme)**
- Host: `srv-fme`
- Port: `5432`
- Database: `Prod`
- User: `postgres`
- Schéma données: `assainissement`, `bdco`, `route`, `divers`, `nature`, `pts_interet`

**PostgreSQL SDOL (HKD)** - Accès depuis srv-fme uniquement
- Host: `postgres.hkd-geomatique.com`
- Port: `5432`
- Database: `sdol`
- Schéma Bussigny: `back_hkd_databy`
- User lecture: `by_lgr` (ATTENTION: pas de droit LOGIN actuellement)
- User écriture: `by_fme_w`
- Note: Connexion whitelistée sur IP srv-fme

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
| 1. Fondations | Structure app, Assistant (chat+canevas), Gestion projets | ✅ Fait |
| 2. IA avancée | Sélection auto modèle, Sub-agents, Optimisation coûts | ✅ Fait |
| 3. UI/UX | Thème clair/sombre, Mode Standard/Expert, Easter egg activation | ✅ Fait |
| 4. Canevas pro | Édition directe, Streaming char-by-char, Export multi-format, Historique | ✅ Fait |
| 5. Mémoire | 3 niveaux (immédiate/session/persistante), Défragmentation, Fusion auto | ✅ Fait |
| 6. Productivité | Ghostwriter, Conversion fichiers, Fonctions auto-générées | ✅ Fait |
| 7. Données | Accès PostgreSQL, Sources multiples, Parcours/sélection couches | ✅ Fait |
| 8. Cartographie | Multi-sources, Auth Carto Ouest, QGIS, Chatbot carto | ✅ Fait |
| 9. Intégrations | Explorateur fichiers, Tunnels SSH, RDP/VNC | ✅ Fait |
| 10. Communications | Outlook, 3CX | ✅ Fait |
| 11. Multi-IA | Gemini, Login Claude Pro, Modèles locaux (Ollama/LM Studio) | ✅ Fait |

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

#### 6. Thèmes et Modes d'interface

##### Mode clair / Mode sombre
- **Thème clair** : par défaut, sobre et professionnel
- **Thème sombre** : palette cyber vert/noir, ambiance technique
- **Sélecteur** : toggle accessible dans l'interface
- **Persistance** : préférence sauvegardée

##### Mode Standard vs Expert (Easter Egg)
- **Mode Standard** (par défaut) :
  - Interface simplifiée
  - Onglets visibles : Assistant, Cartes
  - Fonctionnalités avancées masquées
  - Thème clair par défaut

- **Mode Expert** (secret) :
  - Tous les onglets : Assistant, Cartes, Éditeur, Documents, etc.
  - Fonctionnalités avancées activées (sub-agents, outils système, etc.)
  - Passage automatique en mode sombre (modifiable via sélecteur)
  - Status bar complète avec infos techniques

- **Activation secrète** :
  - Trigger : dire à l'assistant une phrase type "On passe aux choses sérieuses"
  - Phrases alternatives possibles : "Mode expert", "Unlock", "Power mode"
  - Animation de transition (effet "unlock")
  - L'assistant confirme l'activation avec une réponse appropriée

- **Désactivation** :
  - Phrase type "Mode normal" ou via settings cachés
  - Retour au mode standard + thème clair

#### 7. Easter Eggs (à développer)

##### Idées potentielles
- **Konami Code** : Séquence de touches (↑↑↓↓←→←→BA) déclenche un effet visuel
- **Matrix Mode** : Taper "follow the white rabbit" → effet pluie de caractères verts
- **GeoBrain Birthday** : Animation spéciale le jour de création du projet
- **Secret commands** : Commandes cachées dans le chat ("/coffee", "/credits", "/about")
- **Achievement system** : Badges cachés pour des actions spécifiques (1000 messages, première requête SQL, etc.)
- **Thèmes secrets** : Palettes de couleurs cachées (rétro, synthwave, etc.)
- **Voice lines** : Sons/notifications easter egg pour certaines actions

##### Règles de design
- Ne jamais impacter l'UX principale
- Découverte = récompense, pas frustration
- Documentés nulle part (vraiment secrets)
- Fun mais professionnels

#### 8. Phase 11 - Multi-IA (planifiée)

##### Fournisseurs cloud
| Fournisseur | Modèles | Authentification |
|-------------|---------|------------------|
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus, Haiku | API Key + Login Claude Pro |
| **Google** | Gemini 1.5 Pro, Gemini 1.5 Flash | API Key Google AI Studio |
| **OpenAI** | GPT-4o, GPT-4o-mini | API Key OpenAI |

##### Login Claude Pro (abonnement)
- OAuth avec compte claude.ai
- Utilise les quotas de l'abonnement Pro
- Pas de coûts API supplémentaires
- Avantage : accès à Claude 3.5 Sonnet sans limites API

##### Modèles locaux (offline)
| Solution | Avantages | Modèles recommandés |
|----------|-----------|---------------------|
| **Ollama** | Simple, CLI, multi-OS | Llama 3.1 8B/70B, Mistral, CodeLlama |
| **LM Studio** | GUI, téléchargement facile | Tous formats GGUF |
| **LocalAI** | API compatible OpenAI | Drop-in replacement |

##### Architecture multi-provider
```
┌─────────────────────────────────────────────────────────────┐
│                    GeoBrain AI Router                       │
├─────────────────────────────────────────────────────────────┤
│  Sélection automatique selon:                               │
│  - Type de tâche (code, SQL, texte, analyse)               │
│  - Coût (gratuit local → API payante)                      │
│  - Disponibilité (fallback si provider down)               │
│  - Préférence utilisateur                                   │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Claude  │    │ Gemini  │    │  GPT-4  │    │ Ollama  │
    │  API    │    │   API   │    │   API   │    │ (local) │
    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

##### Workflow recommandé
1. **Tâches simples/rapides** → Modèle local (Llama 8B) - gratuit
2. **Code/SQL** → Claude Sonnet ou GPT-4o - meilleur pour code
3. **Analyse longue** → Gemini 1.5 Pro (1M tokens context)
4. **Tâches critiques** → Claude Opus ou GPT-4o

### État actuel (10 décembre 2025)

#### Fait ✅
- Structure app (Tauri + SvelteKit)
- Onglet Cartes (Géoportail Bussigny, Uzuverse)
- Sidebar et navigation
- Backend avec outils (read, write, execute, web_search, web_fetch)
- Système d'agents avec boucle d'exécution
- **Sélection automatique du modèle** (Haiku/Sonnet/Opus selon complexité)
- **7 Sub-agents spécialisés** (Code, SQL, FME, QGIS, Doc, QA, Optimize)
- Buffer de prompts (file d'attente)
- Bouton Stop avec AbortController
- **Thème clair (défaut) / sombre** avec sélecteur
- **Mode Standard / Expert** (easter egg activation)
- Passage auto en mode sombre lors de l'activation expert

#### En cours 🔄
- Streaming temps réel dans le canevas (backend OK, frontend à tester)
- Mode édition par défaut dans le canevas

#### À faire ⏳
- Canevas éditable avec historique
- Status bar avancée
- Export multi-format
- Intégration backend dans Tauri (sidecar)

## Projets actifs
[À documenter au fil des sessions]

## Procédures documentées
[Liens vers les procédures créées]

## Contacts utiles
- ASIT-VD : standards cantonaux
- BG Ingénieurs-Conseils : projets hydrauliques

## Notes techniques

### Module CAD / DXF (GeoMind App)

**Emplacement** : `geomind-app/src/lib/components/CAD/CADModule.svelte`

**État actuel** :
- Lecture DXF via `dxf-parser` (v1.1.2) ✅
- Rendu canvas avec Fabric.js (v6.9.0) ✅
- Géoréférencement avec transformation Helmert (4 param: tx, ty, scale, rotation) ✅
- Support PostGIS pour chargement couches géospatiales ✅
- Système de calques avec visibilité, couleur, opacité, strokeWidth ✅
- Outils mesure (distance, surface) ✅
- Support projection Swiss MN95 (EPSG:2056) via proj4 ✅

**Guide d'implémentation** : `docs/cad-implementation-guide.md`

**Améliorations planifiées** :
1. **Géoréférencement** : Passer de Helmert (4 param) à transformation affine complète (6 param)
   - Meilleur support des distorsions/inclinaisons
   - Calcul RMS error et résidus par point
   - Export worldfile (.pgw/.tfw)
   - Bibliothèque : ml-matrix pour résolution moindres carrés

2. **Outils d'édition CAD** :
   - Dessin : lignes, polylignes, rectangles, cercles
   - Snapping : grille + accrochage objets (extrémités, milieux, centres)
   - Move, rotate, scale avec transformations
   - Undo/Redo avec stack d'états JSON

3. **Export DXF** :
   - Bibliothèque recommandée : @tarikjabiri/dxf (TypeScript, moderne)
   - Alternative : dxf-writer (simple mais plus ancienne)
   - Conversion Fabric.js objects → DXF entities
   - Export en coordonnées géoréférencées MN95 si calé

4. **Styles dynamiques de calques** :
   - Modification strokeWidth, couleur, opacité en temps réel
   - Fonction updateLayerStyle() pour appliquer à tous objets du calque
   - Workaround opacité : gérer RGBA pour fill tout en gardant stroke opaque

**Packages NPM recommandés** :
```bash
npm install ml-matrix           # Calculs matriciels affine transform
npm install @tarikjabiri/dxf    # Export DXF moderne
npm install @turf/turf          # (Optionnel) Validation géométries
```

**Références** :
- Swisstopo transformations : https://www.swisstopo.admin.ch/fr/transformations-3d-planimetrie
- Fabric.js docs : https://fabricjs.com/docs/
- DXF writer : https://dxf.vercel.app/

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

### Copies locales (GeoMind App)
- `geomind-app/static/images/logo_bussigny_neg.png`
- `geomind-app/static/images/logo_bussigny_pos.png`

### Template PDF Bussigny (OBLIGATOIRE)
**Module** : `scripts/python/bussigny_pdf.py`

**RÈGLES** :
- À chaque demande de génération de PDF, TOUJOURS utiliser ce module !
- PAS DE SIGNATURE en fin de document (pas de "Marc Zermatten, Responsable...")

**Composants** :
- `BussignyDocTemplate` : Classe document avec en-tête (logo + ligne bleue) et pied de page (nom fichier + page)
- `get_styles()` : Styles officiels (BTitle, BSubtitle, BH1, BH2, BBody, BBullet, BCode, Alert, Info, Success)
- `create_table()` : Tableaux avec Paragraph dans les cellules (évite dépassements)
- `create_result_box()` : Encadré résultat mis en évidence
- `create_metadata_table()` : Métadonnées (date, auteur, service)
- `format_date()`, `format_number()` : Formatage suisse

**Couleurs officielles** :
- `BLEU_BUSSIGNY` : #366092
- `GRIS_FONCE` : #444444
- `GRIS_MOYEN` : #666666

**Exemple d'usage** :
```python
from bussigny_pdf import BussignyDocTemplate, get_styles, create_table
doc = BussignyDocTemplate("fichier.pdf", doc_description="Note technique")
styles = get_styles()
elements = [Paragraph("Titre", styles['BTitle'])]
doc.build(elements)
```
