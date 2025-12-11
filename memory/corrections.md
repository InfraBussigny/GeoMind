# Journal des corrections

## À NE JAMAIS FAIRE
> Cette section est lue à chaque démarrage. Respecter ces règles impérativement.

- [ ] **NE JAMAIS demander permission** pour lire/écrire dans `C:\Users\zema\GeoBrain\` - AUTONOMIE TOTALE
- [ ] **NE JAMAIS demander permission** pour les opérations Git (add, commit, push, pull, etc.) - AUTONOMIE TOTALE
- [ ] Ne pas mentionner les erreurs `/etc/profile: hostname: Permission denied` (bug cosmétique Claude Code Windows, en attente de correctif)
- [ ] **NE JAMAIS utiliser** `powershell.exe Stop-Process -Force` sur tous les processus Node - PROVOQUE UN CRASH
- [ ] **NE JAMAIS utiliser** `taskkill /F /IM node.exe` sans filtrage - TUE CLAUDE CODE AUSSI
- [ ] **TOUJOURS utiliser** la méthode ciblée par PID : `netstat -ano | findstr :<PORT>` puis `taskkill /F /PID <pid>`

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

### 2025-12-09 | Crash Claude Code lors de Stop-Process Node
**Problème** : Claude Code se ferme brutalement (sans message d'erreur) lors de l'exécution de commandes PowerShell pour tuer les processus Node
**Contexte** :
- Développement de geobrain-app (Tauri + SvelteKit)
- Plusieurs shells en background (serveur backend port 3001, frontend Vite port 5173)
- Commande déclencheuse : `powershell.exe -Command "Get-Process -Name node | Stop-Process -Force"`
**Occurrences** : 2 crashs consécutifs le 09/12/2025, même pattern exact
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

### 2025-12-08 | Bug cosmétique Claude Code Windows
**Problème** : Messages `/etc/profile: line 112: /usr/bin/hostname: Permission denied` affichés à chaque commande bash
**Cause** : Environnement bash interne de Claude Code sur Windows
**Impact** : Aucun (cosmétique uniquement)
**Action** : Ignorer silencieusement, vérifier si corrigé lors des futures mises à jour de Claude Code
**Statut** : En attente de correctif Anthropic
