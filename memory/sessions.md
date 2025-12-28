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

## Session 40 - 19 décembre 2025
**Thème** : MaxTools - Migration QGIS 3.x + Thème UI

#### Bugs corrigés (migration PyQt4→PyQt5/6)
- QDoubleValidator, parenthèses, QgsWKBTypes, QPrinter, resources.py, icônes Qt

#### Thème UI Dark Neon
- dark_neon.qss (noir #1a1a1a, vert néon #00ff88)
- Appliqué aux 20 dialogues
- Branding "Powered by GeoMind"

---

*Sessions 1-39 archivées dans `memory/sessions_archive.md`*
