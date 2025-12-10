# GeoBrain Codebase Map

> Référence rapide des fichiers clés pour éviter les recherches répétitives.
> Mise à jour : 2025-12-10

## Structure racine

```
geobrain-app/
├── src/                    # Frontend SvelteKit
│   ├── lib/
│   │   ├── components/     # Composants UI
│   │   ├── stores/         # État global (Svelte stores)
│   │   ├── services/       # API et services
│   │   └── styles/         # CSS global
│   └── routes/             # Pages SvelteKit
├── server/                 # Backend Node.js
│   ├── index.js            # Point d'entrée + endpoints API
│   ├── connections.js      # Gestion connexions DB (PG/SSH/OGC)
│   └── data/               # Données persistantes (JSON)
└── static/                 # Assets statiques
```

## Fichiers clés par domaine

### 1. STORES (État global)
| Fichier | Contenu | Exports principaux |
|---------|---------|-------------------|
| `src/lib/stores/app.ts` | Modes, thèmes, permissions, messages | `appMode`, `theme`, `visibleModules`, `checkModeActivation()`, `glitchSettings` |

**Lignes importantes app.ts :**
- L13-14: Types `ThemeMode`, `AppMode`
- L31-112: `MODE_PERMISSIONS` (standard/expert/god/bfsa)
- L163-220: Stores `theme`, `appMode` avec méthodes
- L237-319: Phrases activation/désactivation modes
- L330-383: `checkModeActivation()` fonction détection
- L395-438: `glitchSettings` store (effets visuels)

### 2. COMPOSANTS UI
| Fichier | Rôle | Lignes clés |
|---------|------|-------------|
| `src/lib/components/Sidebar.svelte` | Navigation + badge mode | L139-148: badges mode, L421-485: styles badges |
| `src/lib/components/ThemeToggle.svelte` | Toggle clair/sombre | L5-27: logique toggle, L39-74: icônes par mode |
| `src/lib/components/Chat/ChatModule.svelte` | Chat principal | L93-185: `handleModeChange()` switch cases |
| `src/lib/components/Editor/EditorModule.svelte` | Éditeur code | L235-403: templates langages, L405-421: `newFile()` |
| `src/lib/components/Editor/FileExplorer.svelte` | Navigation fichiers | L1-69: script, L199-268: nav-bar + drives |
| `src/lib/components/GlitchEngine.svelte` | Effets glitch God mode | Moteur effets visuels aléatoires |
| `src/lib/components/Settings/SettingsModule.svelte` | Paramètres | Sections mode, connexions, effets visuels |

### 3. STYLES
| Fichier | Contenu |
|---------|---------|
| `src/lib/styles/theme.css` | Variables CSS tous thèmes |

**Sections theme.css :**
- L6-38: Variables communes (espacements, typo)
- L44-126: Thème `light`
- L132-217: Thème `dark` (cyber vert)
- L224-304: Thème `god` (CMY glitch)
- L311-531: Thème `bfsa` (Bovard & Fritsché)
- L537-513: Effets glitch CSS

### 4. LAYOUT
| Fichier | Rôle |
|---------|------|
| `src/routes/+layout.svelte` | Layout principal, sync mode→thème |

**Lignes clés +layout.svelte :**
- L12-16: `$effect` applique `data-theme`
- L20-36: Mapping `modeToTheme` (standard→light, expert→dark, god→god, bfsa→bfsa)

### 5. SERVICES API
| Fichier | Contenu |
|---------|---------|
| `src/lib/services/api.ts` | Appels backend |

**Fonctions api.ts :**
- `listDirectory()`, `readFile()`, `writeFile()`
- `listDrives()` (L281-287)
- `executeSQL()`, `chat()`

### 6. BACKEND
| Fichier | Contenu | Lignes clés |
|---------|---------|-------------|
| `server/index.js` | Serveur Express + endpoints | L1060-1111: `/api/tools/list-drives`, L1735-1749: error handlers |
| `server/connections.js` | Connexions DB | L448-470: `connectPostgreSQL()`, L540-558: `executeSQL()` |

**Endpoints backend :**
- `GET /api/health` - Santé serveur
- `GET /api/providers` - Liste providers IA
- `POST /api/chat` - Chat avec IA
- `GET /api/tools/list-directory` - Liste fichiers
- `GET /api/tools/read-file` - Lire fichier
- `POST /api/tools/write-file` - Écrire fichier
- `GET /api/tools/list-drives` - Liste disques Windows
- `POST /api/connections/*` - Gestion connexions DB

## Patterns récurrents

### Ajouter un nouveau mode
1. `app.ts`: Ajouter au type `AppMode` + `ThemeMode`
2. `app.ts`: Ajouter permissions dans `MODE_PERMISSIONS`
3. `app.ts`: Ajouter méthode `activate{Mode}()` dans store
4. `app.ts`: Ajouter `visibleModules` si différent
5. `app.ts`: Ajouter phrases activation/désactivation
6. `app.ts`: Mettre à jour `checkModeActivation()`
7. `theme.css`: Créer `[data-theme="xxx"]` avec variables
8. `Sidebar.svelte`: Ajouter badge + styles
9. `ChatModule.svelte`: Ajouter case dans `handleModeChange()`
10. `ThemeToggle.svelte`: Ajouter icône + style
11. `+layout.svelte`: Ajouter mapping dans `modeToTheme`

### Ajouter un endpoint backend
1. `server/index.js`: Ajouter route Express
2. `src/lib/services/api.ts`: Ajouter fonction fetch

### Ajouter un composant
1. Créer fichier `.svelte` dans `src/lib/components/`
2. Importer dans le parent

## Sub-agents recommandés

Pour les tâches parallélisables, utiliser `Task` avec:
- `subagent_type: 'Explore'` → recherche codebase
- `subagent_type: 'Plan'` → planification architecture
- `subagent_type: 'general-purpose'` → tâches complexes

**Exemple tâche multi-fichiers :**
```
1. Lancer 3 agents Explore en parallèle:
   - Agent 1: "Trouve tous les usages de appMode"
   - Agent 2: "Trouve tous les usages de theme"
   - Agent 3: "Trouve la structure des permissions"
2. Attendre résultats
3. Planifier modifications
4. Exécuter séquentiellement
```
