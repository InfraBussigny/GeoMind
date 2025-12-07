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
git clone https://github.com/MarcZermatten/GeoBrain-Bussigny.git

# Entrer dans le dossier
cd GeoBrain-Bussigny
```

### Option B : Telecharger le ZIP

1. Aller sur https://github.com/MarcZermatten/GeoBrain-Bussigny
2. Cliquer "Code" > "Download ZIP"
3. Extraire dans `C:\Users\VOTRE_NOM\GeoBrain-Bussigny`

### Configuration Git (premiere fois)

```bash
cd C:\Users\VOTRE_NOM\GeoBrain-Bussigny
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
cd C:\Users\VOTRE_NOM\GeoBrain-Bussigny
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

## Depannage

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
- Issues : https://github.com/MarcZermatten/GeoBrain-Bussigny/issues
