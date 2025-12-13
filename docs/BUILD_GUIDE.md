# Guide de Compilation GeoMind

> Repository : https://github.com/InfraBussigny/GeoMind

## Prerequis

### 1. Node.js
- Version recommandee : 20+ (LTS)
- Verification : `node --version`

### 2. Rust/Cargo
Installation via winget :
```bash
winget install Rustlang.Rustup --accept-package-agreements --accept-source-agreements
```
Verification : `cargo --version`

### 3. Visual Studio Build Tools (CRITIQUE)
Les composants C++ sont obligatoires pour compiler Tauri/Rust.

**Installation :**
```bash
# Telecharger l'installateur
curl -L -o vs_buildtools.exe "https://aka.ms/vs/17/release/vs_buildtools.exe"

# Installer avec les composants C++
vs_buildtools.exe --add Microsoft.VisualStudio.Workload.VCTools ^
                  --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 ^
                  --add Microsoft.VisualStudio.Component.Windows11SDK.22621 ^
                  --includeRecommended --passive --wait
```

**Verification :** Le fichier suivant doit exister :
```
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat
```

## Compilation locale

### Option 1 : Script batch (recommande)

Creer un fichier `build_geomind.bat` :
```batch
@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set PATH=%PATH%;C:\Users\VOTRE_USER\.cargo\bin
cd /d C:\chemin\vers\GeoMind\geomind-app
npm run tauri:build
```

Executer :
```bash
powershell.exe -Command "& 'C:\chemin\vers\build_geomind.bat'"
```

### Option 2 : Developer Command Prompt
1. Ouvrir "Developer Command Prompt for VS 2022"
2. Naviguer vers le projet et executer :
```bash
cd geomind-app
npm install
npm run tauri:build
```

## Compilation via GitHub Actions (recommande)

Le repository InfraBussigny/GeoMind dispose d'un workflow GitHub Actions.

### Lancer manuellement :
1. Aller sur https://github.com/InfraBussigny/GeoMind/actions
2. Cliquer sur "Build GeoBrain Desktop"
3. Cliquer sur "Run workflow"
4. Les artefacts seront disponibles dans les builds

### Automatique :
Le workflow se declenche automatiquement lors d'un push sur `master` modifiant `geomind-app/`.

## Fichiers de sortie

Apres compilation :
```
src-tauri/target/release/bundle/
├── msi/GeoMind_X.X.X_x64_en-US.msi    # Installateur MSI
└── nsis/GeoMind_X.X.X_x64-setup.exe   # Installateur NSIS
```

## Problemes connus et solutions

### Erreur : Import "ol/Map" ou "proj4" non resolu
**Cause :** Dependances manquantes dans package.json
**Solution :** S'assurer que package.json contient toutes les dependances :
- ol, proj4, fabric, leaflet, monaco-editor, etc.
- Comparer avec la version de reference si necessaire

### Erreur : "link.exe" failed
**Cause :** Conflit avec link.exe de Git (pas celui de MSVC)
**Solution :** Utiliser le script batch qui appelle vcvars64.bat

### Erreur : "cargo metadata" not found
**Cause :** Cargo pas dans le PATH
**Solution :** Ajouter au script : `set PATH=%PATH%;C:\Users\USER\.cargo\bin`

### Erreur : Composants C++ manquants
**Cause :** VS Build Tools incomplet
**Solution :** Reinstaller avec les composants VCTools + Windows SDK

## Dependances npm requises

Le package.json doit inclure :
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.x",
    "highlight.js": "^11.x",
    "monaco-editor": "^0.55.x",
    "ol": "^10.x",
    "proj4": "^2.x",
    "fabric": "^6.x",
    "leaflet": "^1.x",
    "pdfjs-dist": "^5.x",
    "@xyflow/svelte": "^1.x",
    "dxf-parser": "^1.x",
    "html-to-image": "^1.x"
  }
}
```

## Temps de compilation

- Premiere compilation : ~5-10 min (telechargement crates Rust)
- Compilations suivantes : ~2-3 min

## Checklist rapide

- [ ] Node.js installe
- [ ] Rust/Cargo installe
- [ ] VS Build Tools avec C++ installe
- [ ] vcvarsall.bat existe
- [ ] Toutes les dependances npm installees
- [ ] Utiliser le script batch ou GitHub Actions

---
*Derniere mise a jour : 13 decembre 2025*
