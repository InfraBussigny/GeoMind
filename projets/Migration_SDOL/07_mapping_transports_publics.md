# Mapping Transports Publics Bussigny → SDOL

**Date** : 2025-12-18
**Version** : 1.0
**Statut** : En cours

---

## 1. TABLES SOURCES (PostgreSQL Bussigny - schéma route)

### by_transport_public_a (Arrêts - Point)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | serial | ID auto |
| nom_arret | text | Nom de l'arrêt |
| orientation | int4 | Orientation |
| projete | bool | Arrêt projeté (futur) |
| date_mise_en_service | date | Date mise en service |
| geom | geometry(Point) | Géométrie |

### by_transport_public_l (Lignes - LineString)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | serial | ID auto |
| nom_ligne | text | Nom/numéro de ligne |
| type_transport | text | Bus, train, etc. |
| remarque | text | Remarques |
| geom | geometry(LineString) | Géométrie |

### by_transport_public_s (Stations - Polygon)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | serial | ID auto |
| nom_station | text | Nom de la station |
| type_station | text | Type (gare, arrêt...) |
| geom | geometry(Polygon) | Géométrie |

> **Note** : Structure à confirmer depuis la base

---

## 2. TABLES CIBLES SDOL (schéma back_hkd_databy)

### tp_bus_s (Stations bus - Point)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | integer | ID auto |
| no_obj | char(20) | Numéro d'objet |
| nom | char(100) | Nom de l'arrêt |
| remarque | char(255) | Remarques |
| maj_date | date | Date mise à jour |
| geom | geometry(Point) | Géométrie |
| pk_uuid | uuid | UUID |
| data_owner | varchar(50) | Propriétaire |

### tp_bus_l (Lignes bus - LineString)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | integer | ID auto |
| no_obj | char(20) | Numéro d'objet |
| nom_ligne | char(50) | Nom/numéro ligne |
| remarque | char(255) | Remarques |
| maj_date | date | Date mise à jour |
| geom | geometry(LineString) | Géométrie |
| pk_uuid | uuid | UUID |
| data_owner | varchar(50) | Propriétaire |

### tp_train_s / tp_train_l

Mêmes structures pour les trains.

---

## 3. MAPPING DÉTAILLÉ

### 3.1 by_transport_public_a → tp_bus_s

| Source | Cible | Transformation |
|--------|-------|----------------|
| gid::text | no_obj | Cast texte |
| nom_arret | nom | Direct |
| CASE WHEN projete THEN 'Projeté' ELSE '' END | remarque | Conditionnel |
| - | maj_date | CURRENT_DATE |
| geom | geom | Direct |
| - | pk_uuid | gen_random_uuid() |
| - | data_owner | 'BY' |

### 3.2 by_transport_public_l → tp_bus_l

| Source | Cible | Transformation |
|--------|-------|----------------|
| gid::text | no_obj | Cast texte |
| nom_ligne | nom_ligne | Direct |
| remarque | remarque | Direct |
| - | maj_date | CURRENT_DATE |
| geom | geom | Direct |
| - | pk_uuid | gen_random_uuid() |
| - | data_owner | 'BY' |

---

## 4. QUESTIONS À VALIDER

1. **Type transport** : Comment distinguer bus/train ? Colonne type_transport ?
2. **Stations surfaces** : by_transport_public_s → quelle table SDOL ?
3. **Arrêts projetés** : Migrer ou exclure ?

---

## 5. PROCHAINES ÉTAPES

- [ ] Confirmer structure exacte tables source
- [ ] Vérifier si distinction bus/train dans les données BY
- [ ] Créer requêtes SQL de migration
