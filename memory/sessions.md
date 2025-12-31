## Session 45 - 31 décembre 2025 → 1er janvier 2026
**Thème** : Léon v1.0.0 → v1.0.9 - Release et corrections

### Travail effectué

#### 1. Première release Léon v1.0.0
- GUI pour Claude Code CLI (Tauri 2 + SvelteKit 5)
- Terminal PTY natif, multi-onglets
- Mode planification interactif pour nouveaux projets
- Import de projets existants
- Configuration Claude Code automatique (11 agents, commandes, règles)

#### 2. Corrections v1.0.1 → v1.0.9
| Version | Bug corrigé |
|---------|-------------|
| 1.0.1 | `prompt()` → modal Tauri |
| 1.0.2 | Terminal ne s'ouvre pas (dépendance circulaire) |
| 1.0.3 | `confirm()`/`alert()` → composants dialog |
| 1.0.4 | Permissions filesystem ($HOME/**) |
| 1.0.5 | Chemin template (`resolveResource`) |
| 1.0.6 | Backslashes JSON non échappés |
| 1.0.7 | Syntaxe permissions Claude Code |
| 1.0.8 | Règles Bash avec parenthèses, alertes erreur |
| 1.0.9 | Timing terminal: `waitForTerminalReady()` + `isReady()` PTY |

#### 3. Composants créés
- `ConfirmDialog.svelte`, `InputDialog.svelte`, `AlertDialog.svelte`
- `dialogs.ts` - Store Svelte pour dialogues globaux

#### 4. Architecture corrigée (v1.0.9)
- `TerminalTabs.waitForTerminalReady()` : attend binding Svelte + PTY prêt
- `Terminal.isReady()` : vérifie si le PTY est démarré
- `createNewProject()` : attend terminal prêt avant git init + prompt

### Releases GitHub
- v1.0.0 à v1.0.9 sur https://github.com/MarcZermatten/leon

---

## Session 44 - 28 décembre 2025
**Thème** : Popote v1.3.1 à v1.3.3 - UX, Stats et Mode sombre

### Travail effectué

#### 1. Nouvelles fonctionnalités (v1.3.1)
- **Plats rapides** : 3ème onglet dans sélecteur repas pour condiments/accompagnements simples
  - Modèle `QuickDish` + repository Firestore
  - Sauvegarde et réutilisation avec compteur d'usage
- **Accompagnements** : Champ optionnel à la planification (Pâtes, Riz, Ébly, etc.)
- **Statistiques accueil** : Widget `MealStatsCard` avec :
  - Taux de complétion semaine
  - Top 3 plats favoris du mois
  - Alertes variété (accompagnement surreprésenté, plat oublié)

#### 2. Corrections bugs (v1.3.1)
- Restauration portions congélateur à la déplanification (dialog confirmation)
- Images Marmiton (srcset + URLs relatives)
- Renommage menu "Frigo" → "Stock", onglet "Ingrédients" → "Frigo"

#### 3. Améliorations UX (v1.3.2)
- **Logo** Popote dans AppBar accueil
- **Stats** repositionnées au-dessus des suggestions frigo
- **Accompagnement** affiché dans repas du jour ("Poulet + Riz")
- **Swipe navigation** entre les 5 menus principaux (PageView)
- **Swipe semaines** dans le planning (GestureDetector)

#### 4. Mode sombre (v1.3.2 + v1.3.3)
- Corrections couleurs adaptatives dans 6 fichiers
- Cartes suggestions frigo adaptées au mode sombre

### Fichiers créés
```
lib/features/dishes/domain/quick_dish.dart
lib/features/dishes/data/quick_dish_repository.dart
lib/features/meal_plan/domain/meal_statistics.dart
lib/features/meal_plan/data/meal_statistics_provider.dart
lib/features/meal_plan/presentation/widgets/meal_stats_card.dart
```

### Releases GitHub
- v1.3.1-popote : Plats rapides & Statistiques
- v1.3.2-popote : UX & Mode sombre
- v1.3.3-popote : Fix mode sombre suggestions

---

## Session 43 - 25 décembre 2025
**Thème** : Miam Planning - Refonte majeure UX et architecture

### Travail effectué

#### 1. Amélioration UI/UX
- **Contraste texte** : Couleurs `primaryDark` et `secondaryDark` plus foncées
- **Mode sombre** : Toggle 3 options dans les paramètres, persistance SharedPreferences
- **Planning** : Nouveau design des slots de repas

#### 2. Refonte architecture données
Nouvelle hiérarchie : **Journée → Repas → Plat(s) → Recette(s) → Ingrédients**

- **Dish** (nouveau modèle) : Catégories nutritionnelles, support congélateur
- **MealAssignment** : Refonte multi-plats avec `DishAssignment`

#### 3. Module Congélateur
- Onglet "Congélo" dans Frigo, ajout/gestion portions

---

## Session 42 - 24 décembre 2025
**Thème** : Smash Tournament Tracker - Conversion Tauri

- Ajout Tauri pour app desktop standalone
- Config fenêtre 1280x720, identifiant ch.smash.tournament.tracker
- Première compilation Rust réussie

---

## Session 41 - 22 décembre 2025
**Thème** : Smash Tournament Tracker - Sauvegarde et reprise

- Stack : React + Vite + Tauri
- Joueurs : Marc, Max, Flo, Boris, Daniel
- Modes : 1v1, FFA, 2v2
- Repo : https://github.com/MarcZermatten/smash-tournament-tracker

---

*Sessions 1-40 archivées dans `memory/sessions_archive.md`*
