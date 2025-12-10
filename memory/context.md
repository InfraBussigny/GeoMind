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
| 11. Multi-IA | Gemini, Login Claude Pro, Modèles locaux (Ollama/LM Studio) | ⏳ |

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
