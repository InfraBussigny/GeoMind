# GeoBrain Bussigny 2.0

Assistant IA specialise en geodonnees et systemes d'information du territoire (SIT) pour la commune de Bussigny.

## Table des matieres

1. [Installation de Claude Code (sans droits admin)](#installation-de-claude-code-sans-droits-admin)
2. [Installation de GeoBrain Bussigny](#installation-de-geobrain-bussigny)
3. [Utilisation](#utilisation)
4. [Fonctionnalites](#fonctionnalites)

---

## Installation de Claude Code (sans droits admin)

### Prerequis

- Windows 10/11
- Connexion internet
- Compte Anthropic avec acces a Claude Code

### Etape 1 : Installer Node.js (sans admin)

1. Telecharger la version **ZIP** de Node.js (pas l'installeur MSI) :
   - Aller sur https://nodejs.org/en/download/
   - Choisir "Windows Binary (.zip)" - 64-bit
   - Telecharger le fichier `node-vXX.X.X-win-x64.zip`

2. Extraire dans votre dossier utilisateur :
   ```
   C:\Users\VOTRE_NOM\nodejs\
   ```

3. Ajouter Node.js au PATH utilisateur :
   - Ouvrir "Modifier les variables d'environnement pour votre compte" (rechercher dans Windows)
   - Dans "Variables utilisateur", selectionner `Path` et cliquer "Modifier"
   - Cliquer "Nouveau" et ajouter : `C:\Users\VOTRE_NOM\nodejs`
   - Cliquer "OK" pour fermer

4. Ouvrir un nouveau terminal (cmd ou PowerShell) et verifier :
   ```bash
   node --version
   npm --version
   ```

### Etape 2 : Installer Git (sans admin)

1. Telecharger Git Portable :
   - Aller sur https://git-scm.com/download/win
   - Choisir "64-bit Git for Windows Portable"

2. Extraire dans votre dossier utilisateur :
   ```
   C:\Users\VOTRE_NOM\git\
   ```

3. Ajouter Git au PATH utilisateur :
   - Meme procedure que Node.js
   - Ajouter : `C:\Users\VOTRE_NOM\git\bin`

4. Verifier :
   ```bash
   git --version
   ```

### Etape 3 : Installer Claude Code

1. Ouvrir un terminal et installer globalement :
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

   Note : Sans droits admin, npm installe dans `%APPDATA%\npm` qui est deja dans le PATH utilisateur.

2. Verifier l'installation :
   ```bash
   claude --version
   ```

### Etape 4 : Configurer Claude Code

1. Lancer Claude Code une premiere fois :
   ```bash
   claude
   ```

2. Suivre les instructions pour :
   - Se connecter avec votre compte Anthropic
   - Autoriser l'acces

### Etape 5 : Installer GitHub CLI (optionnel mais recommande)

1. Telecharger la version ZIP :
   - Aller sur https://github.com/cli/cli/releases
   - Telecharger `gh_X.X.X_windows_amd64.zip`

2. Extraire dans :
   ```
   C:\Users\VOTRE_NOM\gh\
   ```

3. Ajouter au PATH : `C:\Users\VOTRE_NOM\gh\bin`

4. Authentifier :
   ```bash
   gh auth login
   ```

---

## Installation de GeoBrain Bussigny

### Option A : Cloner depuis GitHub

```bash
# Se placer dans le dossier utilisateur
cd C:\Users\VOTRE_NOM

# Cloner le depot
git clone https://github.com/InfraBussigny/geobrain-bussigny.git GeoBrain

# Entrer dans le dossier
cd GeoBrain
```

### Option B : Telecharger le ZIP

1. Aller sur https://github.com/InfraBussigny/geobrain-bussigny
2. Cliquer "Code" > "Download ZIP"
3. Extraire dans `C:\Users\VOTRE_NOM\GeoBrain`

### Configuration Git (premiere fois)

```bash
cd C:\Users\VOTRE_NOM\GeoBrain
git config user.name "Votre Nom"
git config user.email "votre@email.com"
```

### Copier le fichier de permissions

Le fichier `.claude/settings.local.json` n'est pas versionne. Creer le fichier :

```bash
# Creer le dossier .claude s'il n'existe pas
mkdir -p .claude
```

Creer le fichier `.claude/settings.local.json` avec ce contenu :

```json
{
  "permissions": {
    "allow": [
      "Bash(git:*)",
      "Bash(gh:*)",
      "Bash(python:*)",
      "Bash(pip install:*)",
      "Bash(npm:*)",
      "Bash(node:*)",
      "Bash(dir:*)",
      "Bash(where:*)",
      "Bash(ls:*)",
      "Bash(pwd:*)",
      "Bash(cat:*)",
      "Bash(icacls:*)",
      "Bash(powershell:*)",
      "Bash(cmd:*)"
    ],
    "deny": [],
    "ask": []
  }
}
```

---

## Utilisation

### Lancer GeoBrain

```bash
cd C:\Users\VOTRE_NOM\GeoBrain
claude
```

GeoBrain va automatiquement :
1. Charger sa memoire (context.md, personality.md, sessions.md)
2. Se presenter et faire reference aux travaux precedents

### Commandes disponibles

| Commande | Description |
|----------|-------------|
| `/memorise <info>` | Memorise une information technique |
| `/recap` | Resume le contexte et les travaux en cours |
| `/erreur <description>` | Documente un bug rencontre |
| `/save [message]` | Commit et push sur GitHub |

### Exemples d'utilisation

```
# Demander une requete SQL spatiale
"Ecris une requete PostGIS pour trouver tous les batiments a moins de 50m d'une route"

# Creer un script FME
"Cree un workbench FME pour convertir des shapefiles en GeoPackage avec reprojection MN95"

# Script PyQGIS
"Ecris un script PyQGIS pour exporter toutes les couches visibles en PDF"
```

---

## Fonctionnalites

### Domaines d'expertise

- **SIG** : QGIS, plugins, expressions, PyQGIS
- **Bases de donnees** : PostgreSQL/PostGIS, Oracle Spatial
- **ETL** : FME (workbenches, transformers)
- **Formats** : GeoJSON, Shapefile, GeoPackage, WMS/WFS, Interlis
- **Standards** : ASIT-VD, EPSG:2056 (MN95)

### Organisation des scripts

```
scripts/
├── python/      # Scripts PyQGIS et utilitaires
├── sql/         # Requetes SQL et procedures stockees
├── fme/         # Workbenches FME (.fmw)
└── qgis/        # Projets QGIS, styles, expressions
```

### Memoire persistante

GeoBrain memorise automatiquement :
- Le contexte technique (infrastructure, configurations)
- L'historique des travaux realises
- Les solutions aux problemes rencontres
- Les erreurs et leurs corrections

---

## GeoMind App (Interface graphique)

GeoMind App est l'interface graphique de GeoBrain, construite avec SvelteKit + Tauri.

### Architecture

```
geomind-app/
├── src/                 # Frontend SvelteKit
├── src-tauri/           # Application Tauri (Rust)
└── server/              # Backend Node.js (Express)
```

**Important** : L'application est composee de deux parties independantes :
- **Frontend** : Interface utilisateur (Tauri ou navigateur)
- **Backend** : Serveur API sur le port 3001

### Installation

```bash
cd C:\Users\zema\GeoBrain\geomind-app

# Installer les dependances du frontend
npm install

# Installer les dependances du backend
cd server
npm install
cd ..
```

### Mode developpement

```bash
# Terminal 1 : Lancer le backend
cd geomind-app/server
npm start

# Terminal 2 : Lancer le frontend
cd geomind-app
npm run dev
```

L'application sera accessible sur http://localhost:5173

### Mode Tauri (application desktop)

```bash
# Terminal 1 : Lancer le backend (OBLIGATOIRE)
cd geomind-app/server
npm start

# Terminal 2 : Lancer l'app Tauri
cd geomind-app
npm run tauri:dev
```

### Compilation

```bash
# Compiler l'application Tauri
cd geomind-app
npm run tauri:build
```

L'executable sera dans `src-tauri/target/release/`

**ATTENTION** : L'application compilee necessite toujours le backend lance separement !

```bash
# Avant de lancer l'exe compile :
cd geomind-app/server
npm start

# Puis lancer GeoMind.exe
```

### Script de lancement rapide (Windows)

Creer un fichier `start-geomind.bat` :

```batch
@echo off
echo Demarrage de GeoMind...

:: Lancer le backend en arriere-plan
start /B cmd /c "cd /d C:\Users\zema\GeoBrain\geomind-app\server && node index.js"

:: Attendre 2 secondes que le backend demarre
timeout /t 2 /nobreak > nul

:: Lancer l'application
start "" "C:\Users\zema\GeoBrain\geomind-app\src-tauri\target\release\GeoMind.exe"

echo GeoMind demarre !
```

### Modules disponibles

| Module | Description |
|--------|-------------|
| Chat | Assistant IA conversationnel |
| Canvas | Visualisation cartographique |
| CAD | Viewer DXF/DWG |
| Databases | Connexions PostgreSQL/PostGIS |
| Converter | Conversion de formats geospatiaux |
| kDrive | Partage de fichiers Infomaniak |
| VPN | Gestion FortiClient VPN |
| WakeLock | Anti-veille ecran |

### Indicateurs de la barre de statut

- **Backend** : Connexion au serveur API (port 3001)
- **VPN** : Statut FortiClient VPN
- **Serveurs** : Connexions aux bases PostGIS
- **Veille** : Anti-veille ecran actif

---

## Depannage

### GeoMind : "Backend non connecte"

Le backend doit etre lance separement :
```bash
cd geomind-app/server
npm start
```

Verifier que le port 3001 est libre :
```bash
netstat -ano | findstr 3001
```

### GeoMind : Couches geoportail non affichees (app compilee)

Les couches WMS/WMTS necessitent une configuration CSP (Content Security Policy) dans Tauri.

**Fichier** : `geomind-app/src-tauri/tauri.conf.json`

La directive `connect-src` doit inclure tous les services geo :
- `https://*.geo.admin.ch` - Services federaux
- `https://*.asit-asso.ch` - ASIT-VD
- `https://*.geodienste.ch` - Geodienste
- `https://*.vd.ch` - Canton de Vaud
- `https://*.ne.ch` - Canton de Neuchatel

La directive `img-src` doit aussi inclure ces domaines pour les tuiles.

### GeoMind : Module Communications n'ouvre que des popups

Le module Communications utilise des fenêtres Tauri WebView pour afficher WhatsApp, Outlook et 3CX.

**Fichier** : `geomind-app/src-tauri/capabilities/default.json`

Permissions requises :
```json
{
  "permissions": [
    "core:default",
    "core:window:allow-create",
    "core:webview:allow-create-webview-window",
    "shell:allow-open"
  ]
}
```

**Fichier** : `geomind-app/src-tauri/Cargo.toml`

Plugin requis :
```toml
tauri-plugin-shell = "2"
```

**Fichier** : `geomind-app/src-tauri/src/lib.rs`

Initialisation du plugin :
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
```

### "claude" n'est pas reconnu

Verifier que npm est dans le PATH :
```bash
echo %PATH%
```

Reinstaller Claude Code :
```bash
npm install -g @anthropic-ai/claude-code
```

### Erreur de permissions Git

Configurer Git localement :
```bash
git config user.name "Votre Nom"
git config user.email "votre@email.com"
```

### Claude demande des permissions a chaque commande

Verifier que `.claude/settings.local.json` existe et contient les bonnes permissions.

---

## Support

- Documentation Claude Code : https://docs.anthropic.com/claude-code
- Issues : https://github.com/InfraBussigny/geobrain-bussigny/issues
