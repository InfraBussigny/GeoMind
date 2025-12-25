# Journal des corrections

## À NE JAMAIS FAIRE
> Cette section est lue à chaque démarrage. Respecter ces règles impérativement.

- [ ] **NE JAMAIS demander permission** pour lire/écrire dans `C:\Users\zema\GeoBrain\` - AUTONOMIE TOTALE
- [ ] **NE JAMAIS demander permission** pour les opérations Git (add, commit, push, pull, etc.) - AUTONOMIE TOTALE
- [ ] Ne pas mentionner les erreurs `/etc/profile: hostname: Permission denied` (bug cosmétique Claude Code Windows, en attente de correctif)
- [ ] **NE JAMAIS utiliser** `powershell.exe Stop-Process -Force` sur tous les processus Node - PROVOQUE UN CRASH
- [ ] **NE JAMAIS utiliser** `taskkill /F /IM node.exe` sans filtrage - TUE CLAUDE CODE AUSSI
- [ ] **TOUJOURS utiliser** la méthode ciblée par PID : `netstat -ano | findstr :<PORT>` puis `taskkill /F /PID <pid>`
- [ ] **TOUJOURS utiliser les unités SI** : mètres (m) pour les longueurs, mètres carrés (m²) pour les surfaces - JAMAIS km, ha, ou autres conversions automatiques
- [ ] **NE JAMAIS lire certaines images PNG** avec l'outil Read - peut provoquer une erreur API 400 "Could not process image" qui bloque la conversation (voir section dédiée ci-dessous)

## CHECKLIST - Ajout d'un nouveau module
> **OBLIGATOIRE** : Suivre TOUTES ces étapes lors de la création d'un nouveau module
> **ÉCHEC RÉCENT** : QGlS (15/12/2025) - module invisible car manquait dans 4 endroits

### Étapes obligatoires (dans l'ordre)

1. **Créer le composant** : `src/lib/components/[NomModule]/[NomModule]Module.svelte`

2. **app.ts** - **4 ENDROITS À MODIFIER** :
   - [ ] `ModuleType` (ligne ~4) : ajouter `'nommodule'` au type union
   - [ ] `ALL_MODULES` (ligne ~232) : ajouter `{ id: 'nommodule', label: 'Label', description: 'Desc' }`
   - [ ] `DEFAULT_MODULE_CONFIG` (ligne ~253) : ajouter `'nommodule'` aux tableaux expert/god/bfsa
   - [ ] `STANDARD_MODULES` (ligne ~259) : ajouter `'nommodule'` si visible en mode standard

3. **+page.svelte** - 2 endroits :
   - [ ] Import : `import NomModuleModule from '$lib/components/[NomModule]/[NomModule]Module.svelte';`
   - [ ] Condition : `{:else if $currentModule === 'nommodule'}<NomModuleModule />`

4. **Sidebar.svelte** - 2 endroits :
   - [ ] `allModules` (ligne ~29) : ajouter `{ id: 'nommodule', label: 'Label', description: 'Desc' }`
   - [ ] Template SVG (ligne ~350+) : ajouter `{:else if module.id === 'nommodule'}` avec l'icône SVG

5. **Backend** (si nécessaire) : Ajouter les endpoints API dans `server/index.js`

### Fichiers à modifier (résumé)
| Fichier | Nombre d'endroits | Obligatoire |
|---------|-------------------|-------------|
| `src/lib/stores/app.ts` | **4** | Oui |
| `src/routes/+page.svelte` | 2 | Oui |
| `src/lib/components/Sidebar.svelte` | 2 | Oui |
| `server/index.js` | 1+ | Si API |

### Erreurs fréquentes
- **Module invisible** : Manque dans `ALL_MODULES`, `DEFAULT_MODULE_CONFIG` ou `STANDARD_MODULES`
- **Pas d'icône** : Manque le bloc `{:else if module.id === 'xxx'}` dans Sidebar.svelte
- **Build échoue** : Import manquant dans +page.svelte

## À TOUJOURS FAIRE (prévention crashs)
> Actions obligatoires AVANT toute opération risquée

**AVANT de demander à Marc de tuer des processus Node ou d'effectuer des opérations système risquées :**
1. **Sauvegarder dans `memory/sessions.md`** : état actuel du travail, fichiers modifiés, étapes pour reprendre
2. **Commit et push sur GitHub** : `git add . && git commit -m "Sauvegarde avant opération risquée" && git push`
3. **Informer Marc** que la sauvegarde est faite avant de procéder

**Opérations considérées comme risquées :**
- Demander de tuer des processus Node manuellement
- Redémarrer des serveurs après blocage de port
- Toute opération PowerShell sur les processus
- Modifications système importantes

## Historique des corrections

### 2025-12-16 | PuTTY freeze sur "Passphrase for key" (RÉSOLU)
**Problème** : PuTTY se fige (fenêtre "inactive") après affichage "Passphrase for key rsa-key-XXXXXXXX" - impossible de taper quoi que ce soit
**Cause** : La session PuTTY avait un chemin vers un fichier `.ppk` sur OneDrive configuré dans Connection → SSH → Auth → Credentials. Même si Pageant avait une clé chargée, PuTTY essayait d'utiliser le fichier directement (potentiellement inaccessible/cloud-only).
**Solution** :
1. Ouvrir PuTTY → charger la session
2. Connection → SSH → Auth → Credentials
3. **Supprimer** le chemin dans "Private key file for authentication"
4. Sauvegarder la session
5. PuTTY utilise maintenant Pageant automatiquement
**Fichier concerné** : `C:\Users\zema\OneDrive - bussigny.ch\Documents\PuTTY\putty_private_zema.ppk`
**Session** : `geo.bussigny.ch`

---

### 2025-12-09 & 2025-12-13 | Crash Claude Code lors de Stop-Process Node
**Problème** : Claude Code se ferme brutalement (sans message d'erreur) lors de l'exécution de commandes PowerShell pour tuer les processus Node
**Contexte** :
- Développement de geobrain-app (Tauri + SvelteKit)
- Plusieurs shells en background (serveur backend port 3001, frontend Vite port 5173)
- Commande déclencheuse : `powershell.exe -Command "Get-Process -Name node | Stop-Process -Force"`
**Occurrences** :
- 2 crashs consécutifs le 09/12/2025
- 1 crash le 13/12/2025 soir : `taskkill /F /IM node.exe` lancé en background pour redémarrer le serveur après ajout de Groq dans PROVIDERS
**Cause probable** :
- Conflit entre PowerShell tuant les processus Node et Claude Code qui gère des shells en background utilisant Node
- Possible timeout ou deadlock
**Solution de contournement** :
- NE JAMAIS utiliser `Stop-Process -Force` sur tous les processus Node en une seule commande
- NE JAMAIS utiliser `taskkill /F /IM node.exe` (tue TOUS les Node y compris Claude Code)
- **Méthode recommandée** :
  1. `netstat -ano | findstr :<PORT>` pour trouver le PID sur un port spécifique
  2. `taskkill /F /PID <pid_specifique>` pour tuer uniquement ce processus
- Ou utiliser `Ctrl+C` dans le terminal où le serveur tourne
- Ou fermer les shells proprement via KillShell avant de lancer de nouvelles commandes
**Statut** : Validé - Marc a confirmé que `taskkill /F /IM node.exe` cause aussi le crash

---

### 2025-12-10 | Erreurs TypeScript/Build GeoBrain

#### 1. Regex mal fermée dans converter.ts (ligne 633)
**Problème** : `if (/^(def |class |import |from |#.*coding|#!/m.test(trimmed))` - parenthèse manquante
**Cause** : Le `#!` (shebang) n'était pas proprement fermé dans l'alternation regex
**Solution** : Ajouter la parenthèse fermante : `|#!)/m.test`
**Fichier** : `src/lib/services/converter.ts:633`

#### 2. Imports incorrects SchemaBrowser/QueryBuilder
**Problème** : Import de `listConnections` et `executeQuery` qui n'existent pas dans api.ts
**Cause** : Noms de fonctions erronés lors de la création des composants
**Solution** :
- `listConnections` → `getConnections`
- `executeQuery` → `executeSQL`
- `getConnections()` retourne un tableau directement, pas `{success, connections}`
- `executeSQL()` retourne `{success, rows, error}`
**Fichiers** : `SchemaBrowser.svelte`, `QueryBuilder.svelte`

#### 3. Monaco Editor manualChunks error
**Problème** : `"monaco-editor" cannot be included in manualChunks because it is resolved as external`
**Cause** : Conflit de config Vite - monaco marqué comme chunk manuel ET comme externe
**Solution** : Retirer la section `build.rollupOptions.output.manualChunks` de vite.config.ts
**Fichier** : `vite.config.ts`

#### 4. Types incompatibles dans CommunicationsPanel
**Problème** : `Type 'OutlookState' is not assignable to type '{ isAuthenticated: boolean, config: null... }'`
**Cause** : Les interfaces `OutlookState` et `ThreeCXState` n'étaient pas exportées du module
**Solution** :
- Exporter les interfaces depuis `communications.ts`
- Typer correctement les `$state<OutlookState>()` et `$state<ThreeCXState>()`
**Fichiers** : `communications.ts`, `CommunicationsPanel.svelte`

---

### 2025-12-13 | Build Tauri échoue - mauvais linker link.exe

**Problème** : `error: linker 'link.exe' not found` ou utilise `C:\Users\zema\git\usr\bin\link.exe` (Git) au lieu du MSVC

**Cause** :
- Git pour Windows installe son propre `link.exe` (commande Unix) dans `C:\Users\zema\git\usr\bin\`
- Ce chemin est prioritaire dans le PATH, même dans Developer PowerShell
- Rust/Cargo trouve le mauvais `link.exe`

**Solution** : Créer un fichier `C:\Users\zema\.cargo\config.toml` avec le chemin explicite du linker MSVC :
```toml
[target.x86_64-pc-windows-msvc]
linker = "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC\\14.44.35207\\bin\\Hostx64\\x64\\link.exe"
```

**Important** :
- Les backslashes DOIVENT être doublés (`\\`) dans TOML
- La version MSVC (14.44.35207) peut changer - vérifier avec : `ls "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\"`
- VS Build Tools avec le workload "Desktop development with C++" doit être installé

**Comment trouver le bon chemin** :
```powershell
Get-ChildItem 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC' -Recurse -Filter 'link.exe' | Select-Object -ExpandProperty FullName
```

---

### 2025-12-13 | Build Tauri - Erreurs Vite/SvelteKit (RÉSOLUES)

#### 1. highlight.js SSR import error
**Problème** : `Rollup failed to resolve import "highlight.js/lib/core"`
**Cause** : highlight.js n'est pas compatible SSR par défaut, Rollup essaie de l'externaliser
**Solution** : Ajouter dans `vite.config.ts` :
```typescript
ssr: {
  noExternal: ['highlight.js']
},
optimizeDeps: {
  include: ['highlight.js']
}
```

#### 2. Monaco Editor workers error
**Problème** : `Could not resolve "../base/common/worker/webWorkerBootstrap.js"`
**Cause** : Monaco Editor utilise des web workers qui nécessitent une config spéciale
**Solution** : Modifier `vite.config.ts` :
```typescript
optimizeDeps: {
  include: ['highlight.js'],
  exclude: ['monaco-editor']  // Exclure monaco de l'optimisation
},
worker: {
  format: 'es'  // Format ES pour les workers
}
```

**Config vite.config.ts finale fonctionnelle** :
```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    include: ['highlight.js'],
    exclude: ['monaco-editor']
  },
  ssr: {
    noExternal: ['highlight.js']
  },
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: false
      }
    }
  },
  worker: {
    format: 'es'
  }
});
```

---

### 2025-12-13 | Build Tauri - Windows Defender bloque Rust (NON RÉSOLU)

**Problème** : `Accès refusé. (os error 5)` lors de l'exécution des build scripts Rust
**Manifestation** : Erreurs sur `getrandom`, `serde`, `proc-macro2`, `quote`, etc.
**Cause** : Windows Defender bloque l'exécution des build scripts Rust compilés (.exe)
**Impact** : Build frontend OK, mais compilation Rust impossible

**Ce qui NE marche PAS** (compte admin limité) :
- Ajouter exclusion via Windows Security UI (demande élévation)
- `Add-MpPreference` PowerShell (droits insuffisants)
- Compiler dans `C:\Temp` (Defender bloque aussi)
- Compiler dans le dossier d'origine

**Solutions possibles** :
1. **Compiler sur autre poste** avec droits admin complets
2. **GitHub Actions** - build automatique dans le cloud
3. **Demander à l'IT** d'ajouter exclusion pour `C:\Users\zema\GeoBrain`
4. **Désactiver temporairement** Defender (si droits suffisants)

---

### Recommandations pour prochaine compilation Tauri

**AVANT de compiler** :
1. Vérifier que l'exclusion Windows Defender est en place pour le dossier de build
2. Utiliser "Developer PowerShell for VS 2022" (ou vérifier que `~/.cargo/config.toml` existe)
3. S'assurer que le frontend compile seul d'abord : `npm run build`

**Ordre des opérations** :
1. `npm run build` - Teste le frontend seul
2. `npm run tauri build` - Build complet avec Rust

**Si erreur linker** :
```powershell
# Trouver le bon link.exe
Get-ChildItem 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC' -Recurse -Filter 'link.exe' | Select-Object -ExpandProperty FullName
```

**Si erreur Accès refusé (Defender)** :
→ Pas de workaround, nécessite exclusion ou autre machine

---

### 2025-12-13 | Nouveau module non visible dans la sidebar (alwaysVisible ignoré)

**Problème** : Les modules ajoutés avec `alwaysVisible: true` dans `ALL_MODULES` ne s'affichent pas dans la sidebar pour les utilisateurs existants

**Cause** :
- Le store `moduleConfig` charge les modules visibles depuis `localStorage` (`geomind-module-config`)
- Pour les utilisateurs existants, cette configuration en cache ne contient pas les nouveaux modules
- Le derived store `visibleModules` utilisait directement cette config sans vérifier `alwaysVisible`
- Conséquence: même si un module est marqué `alwaysVisible: true`, il était ignoré si pas dans le localStorage

**Fichiers concernés** :
- `src/lib/stores/app.ts` - store `visibleModules`

**Solution** :
Modifier le derived store `visibleModules` pour toujours inclure les modules avec `alwaysVisible: true` :

```typescript
export const visibleModules = derived([appMode, moduleConfig], ([$mode, $config]) => {
  // Modules qui doivent toujours être visibles (alwaysVisible: true)
  const alwaysVisibleModules = ALL_MODULES
    .filter(m => m.alwaysVisible)
    .map(m => m.id);

  if ($mode === 'standard') {
    return [...new Set([...STANDARD_MODULES, ...alwaysVisibleModules])];
  }
  const configModules = $config[$mode] || DEFAULT_MODULE_CONFIG[$mode] || DEFAULT_MODULE_CONFIG.expert;
  return [...new Set([...configModules, ...alwaysVisibleModules])];
});
```

**Impact** :
- Tous les modules avec `alwaysVisible: true` sont maintenant garantis d'apparaître
- Pas besoin de clear le localStorage des utilisateurs
- Les futures ajouts de modules alwaysVisible fonctionneront automatiquement

**Modules actuellement alwaysVisible** :
- `chat` (Assistant)
- `settings` (Parametres)
- `converter` (Convertisseur)

---

### 2025-12-08 | Bug cosmétique Claude Code Windows
**Problème** : Messages `/etc/profile: line 112: /usr/bin/hostname: Permission denied` affichés à chaque commande bash
**Cause** : Environnement bash interne de Claude Code sur Windows
**Impact** : Aucun (cosmétique uniquement)
**Action** : Ignorer silencieusement, vérifier si corrigé lors des futures mises à jour de Claude Code
**Statut** : En attente de correctif Anthropic

---

### 2025-12-15 | Module kDrive buggé (GeoMind) - CORRIGÉ
**Problèmes identifiés et corrigés** :

1. **🔴 CRITIQUE - Token API hardcodé en clair**
   - Token de Marc exposé dans le code source (ligne 62-66)
   - **Correction** : Supprimé le token par défaut, config vide obligeant l'utilisateur à entrer ses propres credentials

2. **🔴 CRITIQUE - Upload cassé (FormData vs Raw binary)**
   - Frontend envoyait FormData (multipart)
   - Backend utilisait express.raw() → incompatible
   - API Infomaniak attend du raw binary + query param `file_name`
   - **Correction** : Frontend envoie ArrayBuffer avec Content-Type + file_name en query param

3. **🟡 Auto-connexion avec config vide**
   - Tentait de se connecter automatiquement même sans config
   - **Correction** : Affiche le panel de config si pas de credentials sauvés

4. **🟡 Messages d'erreur peu explicites**
   - Erreurs génériques "Erreur inconnue"
   - **Correction** : Messages spécifiques selon code HTTP (401, 403, 404)

**Fichiers modifiés** :
- `src/lib/components/KDrive/KDriveModule.svelte` (frontend)
- `server/index.js` (backend - endpoint upload)

**Statut** : ✅ Corrigé

---

### 2025-12-22 | Erreur API Claude "Could not process image" (CRITIQUE)

**Problème** : L'API Claude retourne une erreur 400 lors de la lecture de certaines images PNG avec l'outil Read, ce qui bloque complètement la conversation.

**Message d'erreur** :
```
API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Could not process image"}}
```

**Contexte** :
- Projet : Smash Tournament Tracker
- Fichier problématique : `public/assets/melee/stock-icons.png`
- L'erreur se produit même si on réessaie (`> re`)

**Cause probable** :
- Format PNG non standard (palette indexée, profondeur de couleur inhabituelle)
- Dimensions ou encodage non supporté par l'API Claude Vision
- Certains assets de jeux vidéo utilisent des formats PNG optimisés/spéciaux

**Impact** :
- La conversation devient inutilisable après l'erreur
- L'utilisateur doit relancer une nouvelle session Claude Code

**Solution de contournement** :
1. **NE JAMAIS utiliser Read() sur des images d'assets de jeux vidéo** (sprites, icons, textures)
2. Si on doit travailler avec des images :
   - Utiliser Bash pour lister les fichiers : `ls -la public/assets/`
   - Utiliser Bash pour obtenir les infos : `file image.png` ou `identify image.png`
   - Référencer les images par leur chemin dans le code CSS/HTML sans les ouvrir
3. Si on a besoin de voir une image, demander à l'utilisateur de la décrire ou de fournir un screenshot

**Images connues problématiques** :
- `stock-icons.png` (Smash Bros assets)
- Potentiellement d'autres sprites/icons de jeux

**Statut** : ⚠️ Contournement documenté (pas de fix possible côté utilisateur)

---

### 2025-12-24 | Ethernet déconnecté au démarrage Windows (CORRIGÉ)

**Problème** : L'adaptateur Ethernet Realtek Gaming 2.5GbE nécessite un redémarrage manuel après chaque boot Windows

**Carte** : Realtek Gaming 2.5GbE Family Controller (RTL8125)

**Cause** : Windows avait l'autorisation de désactiver l'adaptateur pour économiser l'énergie (PnPCapabilities = 0)

**Corrections appliquées** :

1. **Paramètres carte réseau** (déjà faits précédemment) :
   - Power Saving Mode → Désactivé
   - Ethernet vert → Désactivé
   - Gigabit Lite → Désactivé

2. **Wake-on-LAN désactivé** (24/12/2025) :
   - Réveil sur Magic Packet → Désactivé
   - Avertir lors de correspondance de motif → Désactivé

3. **Gestion d'alimentation Windows** (24/12/2025) - **LE FIX PRINCIPAL** :
   - Clé registre : `HKLM:\SYSTEM\CurrentControlSet\Enum\PCI\VEN_10EC&DEV_8125&...\Device Parameters`
   - PnPCapabilities = 24 (désactive "Autoriser l'ordinateur à éteindre ce périphérique")

**Script** : `scripts/disable_ethernet_power.ps1`

**Statut** : ✅ Corrigé - À vérifier au prochain redémarrage
