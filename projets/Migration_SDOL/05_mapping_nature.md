# Mapping Nature Bussigny → SDOL

**Date** : 2025-12-18
**Version** : 1.0
**Statut** : En cours

---

## 1. TABLES SOURCES (PostgreSQL Bussigny - schéma nature)

### by_nat_arbre_vergers (Point)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | int4 | ID unique |
| numero | varchar(10) | Numéro de l'arbre |
| id_genre | int4 | ID genre (lookup) |
| genre | varchar(50) | Genre de l'arbre (via lookup) |
| sous_espece | varchar(100) | Sous-espèce / variété |
| geom | geometry(Point) | Géométrie |

### by_nat_parcours_nature (LineString)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | serial | ID auto |
| nom | varchar(50) | Nom du parcours |
| description | text | Description |
| url | text | Lien web |
| remarque | text | Remarques |
| geom | geometry(LineString) | Géométrie |

### by_val_genre_vergers (table de valeurs)

Table de lookup pour id_genre → genre (non migrée)

---

## 2. TABLES CIBLES SDOL (schéma back_hkd_databy)

### en_arbre_p (Arbres - Point)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | integer | ID auto |
| no_obj | char(20) | Numéro d'objet |
| proprio | char(50) | Propriétaire |
| genre | char(50) | Genre de l'arbre |
| espece | char(50) | Espèce |
| remarque | char(255) | Remarques |
| releve_date | date | Date du relevé |
| maj_date | date | Date mise à jour |
| geom | geometry(Point) | Géométrie |
| pk_uuid | uuid | UUID unique |
| data_owner | varchar(50) | Propriétaire des données |

> **À VÉRIFIER** : Structure exacte avec HKD

### en_nat_liaison (Liaisons nature - LineString)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | integer | ID auto |
| no_obj | char(20) | Numéro d'objet |
| nom | char(100) | Nom |
| type_liaison | char(50) | Type de liaison |
| remarque | char(255) | Remarques |
| maj_date | date | Date mise à jour |
| geom | geometry(LineString) | Géométrie |
| pk_uuid | uuid | UUID unique |
| data_owner | varchar(50) | Propriétaire des données |

> **À VÉRIFIER** : Structure exacte avec HKD (ou `mob_chem_ped_l` ?)

---

## 3. MAPPING DÉTAILLÉ

### 3.1 Arbres → en_arbre_p

| Source by_nat_arbre_vergers | Cible en_arbre_p | Transformation |
|-----------------------------|------------------|----------------|
| numero | no_obj | Direct |
| - | proprio | 'Commune de Bussigny' |
| genre | genre | Direct |
| sous_espece | espece | Direct |
| - | remarque | NULL |
| - | releve_date | NULL |
| - | maj_date | CURRENT_DATE |
| geom | geom | Direct |
| - | pk_uuid | gen_random_uuid() |
| - | data_owner | 'BY' |

### 3.2 Parcours nature → en_nat_liaison

| Source by_nat_parcours_nature | Cible en_nat_liaison | Transformation |
|-------------------------------|----------------------|----------------|
| gid::text | no_obj | Cast en texte |
| nom | nom | Direct |
| - | type_liaison | 'parcours nature' |
| remarque | remarque | Direct |
| - | maj_date | CURRENT_DATE |
| geom | geom | Direct |
| - | pk_uuid | gen_random_uuid() |
| - | data_owner | 'BY' |

> **Note** : `description` et `url` de la source n'ont pas d'équivalent direct dans SDOL.
> Options : concaténer dans remarque ou ignorer.

---

## 4. QUESTIONS À VALIDER

1. **en_arbre_p** : Structure exacte ? Colonnes disponibles ?
2. **Parcours nature** : Table `en_nat_liaison` ou `mob_chem_ped_l` ?
3. **Description/URL** : Où mettre ces infos dans SDOL ?

---

## 5. SQL DE MIGRATION (draft)

```sql
-- Arbres → en_arbre_p
INSERT INTO back_hkd_databy.en_arbre_p (
    no_obj, proprio, genre, espece, remarque,
    releve_date, maj_date, geom, pk_uuid, data_owner
)
SELECT
    numero,
    'Commune de Bussigny',
    genre,
    sous_espece,
    NULL,
    NULL,
    CURRENT_DATE,
    geom,
    gen_random_uuid(),
    'BY'
FROM nature.by_nat_arbre_vergers;

-- Parcours nature → en_nat_liaison
INSERT INTO back_hkd_databy.en_nat_liaison (
    no_obj, nom, type_liaison, remarque,
    maj_date, geom, pk_uuid, data_owner
)
SELECT
    gid::text,
    nom,
    'parcours nature',
    COALESCE(remarque, '') ||
        CASE WHEN description IS NOT NULL THEN ' | ' || description ELSE '' END ||
        CASE WHEN url IS NOT NULL THEN ' | URL: ' || url ELSE '' END,
    CURRENT_DATE,
    geom,
    gen_random_uuid(),
    'BY'
FROM nature.by_nat_parcours_nature;
```

---

## 6. PROCHAINES ÉTAPES

- [ ] Vérifier structure exacte tables SDOL (en_arbre_p, en_nat_liaison)
- [ ] Confirmer table cible pour parcours nature
- [ ] Tester requêtes sur échantillon
