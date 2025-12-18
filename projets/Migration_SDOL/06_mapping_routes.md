# Mapping Routes Bussigny → SDOL

**Date** : 2025-12-18
**Version** : 1.0
**Statut** : En cours

---

## 1. TABLES SOURCES (PostgreSQL Bussigny - schéma route)

### by_rte_troncon (LineString) - Table principale

| Colonne | Type | Description |
|---------|------|-------------|
| gid | int4 | ID unique |
| id_nom_rue | int4 | ID nom de rue |
| nom_rue | varchar(50) | Nom de la rue |
| id_proprietaire | int4 | ID propriétaire |
| proprietaire | varchar(50) | Propriétaire |
| id_resp_entretien | int4 | ID responsable entretien |
| resp_entretien | varchar(50) | Responsable entretien |
| id_cat_rte | int4 | ID catégorie route |
| cat_rte | varchar(50) | Catégorie route |
| id_classe_rte | int4 | ID classe route |
| classe_rte | varchar(50) | Classe route |
| id_type_revetement | int4 | ID type revêtement |
| type_revetement | varchar(50) | Type de revêtement |
| largeur_troncon | float8 | Largeur du tronçon (m) |
| trottoir_1 | bool | Trottoir côté 1 |
| largeur_t1 | float8 | Largeur trottoir 1 |
| trottoir_2 | bool | Trottoir côté 2 |
| largeur_t2 | float8 | Largeur trottoir 2 |
| id_charge_trafic | int4 | ID charge trafic |
| charge_trafic | varchar(50) | Charge trafic |
| id_sens_circul | int4 | ID sens circulation |
| sens_circul | varchar(50) | Sens de circulation |
| longueur | float8 | Longueur (m) |
| convention | text | Convention |
| remarque | text | Remarques |
| date_releve | date | Date du relevé |
| id_releveur | int4 | ID releveur |
| releveur | varchar(50) | Releveur |
| indice_i1 | float8 | Indice état I1 |
| sous_indice | float8 | Sous-indice |
| prochaine_inspection | date | Date prochaine inspection |
| remarque_etat | text | Remarque sur l'état |
| geom | geometry | Géométrie |

### by_rte_vitesse (LineString)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | int4 | ID unique |
| id_nom_rue | int4 | ID nom de rue |
| nom_rue | varchar(50) | Nom de la rue |
| id_vitesse_exist | int4 | ID vitesse existante |
| vitesse_exist | varchar(50) | Vitesse existante (km/h) |
| geom | geometry | Géométrie |

### Autres tables (à documenter)

- by_rte_etat_troncon
- by_rte_entretien
- by_rte_comptage (TJM)
- by_rte_zone_parc
- by_rte_zone_stationnement
- by_rte_parcours_velo
- by_rte_ouvrage_ponctuel

---

## 2. TABLES CIBLES SDOL (schéma back_hkd_databy)

### mob_rte_classe_tr (Classification routes - LineString)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | integer | ID auto |
| no_obj | char(20) | Numéro d'objet |
| nom_rue | char(100) | Nom de la rue |
| classe | char(50) | Classe de route |
| categorie | char(50) | Catégorie |
| proprio | char(50) | Propriétaire |
| gestionnaire | char(50) | Gestionnaire/entretien |
| revetement | char(50) | Type revêtement |
| largeur | double | Largeur (m) |
| longueur | double | Longueur (m) |
| remarque | char(255) | Remarques |
| maj_date | date | Date mise à jour |
| geom | geometry | Géométrie |
| pk_uuid | uuid | UUID unique |
| data_owner | varchar(50) | Propriétaire données |

### mob_rte_etat_tr (État routes - LineString)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | integer | ID auto |
| no_obj | char(20) | Numéro d'objet |
| indice_i1 | double | Indice I1 |
| sous_indice | double | Sous-indice |
| date_releve | date | Date relevé |
| prochaine_insp | date | Prochaine inspection |
| remarque | char(255) | Remarques |
| maj_date | date | Mise à jour |
| geom | geometry | Géométrie |
| pk_uuid | uuid | UUID |
| data_owner | varchar(50) | Propriétaire |

### mob_rte_restri_tr (Restrictions - LineString)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | integer | ID auto |
| no_obj | char(20) | Numéro d'objet |
| type_restri | char(50) | Type restriction |
| valeur | char(50) | Valeur (ex: 30 km/h) |
| remarque | char(255) | Remarques |
| maj_date | date | Mise à jour |
| geom | geometry | Géométrie |
| pk_uuid | uuid | UUID |
| data_owner | varchar(50) | Propriétaire |

### mob_stationnement (Zones parking - Polygon)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | integer | ID auto |
| no_obj | char(20) | Numéro d'objet |
| type_stat | char(50) | Type stationnement |
| nb_places | integer | Nombre de places |
| remarque | char(255) | Remarques |
| maj_date | date | Mise à jour |
| geom | geometry | Géométrie |
| pk_uuid | uuid | UUID |
| data_owner | varchar(50) | Propriétaire |

---

## 3. MAPPING DÉTAILLÉ

### 3.1 by_rte_troncon → mob_rte_classe_tr

| Source | Cible | Transformation |
|--------|-------|----------------|
| gid::text | no_obj | Cast texte |
| nom_rue | nom_rue | Direct |
| classe_rte | classe | Direct |
| cat_rte | categorie | Direct |
| proprietaire | proprio | Direct |
| resp_entretien | gestionnaire | Direct |
| type_revetement | revetement | Direct |
| largeur_troncon | largeur | Direct |
| longueur | longueur | Direct |
| remarque | remarque | Direct |
| - | maj_date | CURRENT_DATE |
| geom | geom | Direct |
| - | pk_uuid | gen_random_uuid() |
| - | data_owner | 'BY' |

### 3.2 by_rte_troncon → mob_rte_etat_tr

| Source | Cible | Transformation |
|--------|-------|----------------|
| gid::text | no_obj | Cast texte |
| indice_i1 | indice_i1 | Direct |
| sous_indice | sous_indice | Direct |
| date_releve | date_releve | Direct |
| prochaine_inspection | prochaine_insp | Direct |
| remarque_etat | remarque | Direct |
| - | maj_date | CURRENT_DATE |
| geom | geom | Direct |
| - | pk_uuid | gen_random_uuid() |
| - | data_owner | 'BY' |

### 3.3 by_rte_vitesse → mob_rte_restri_tr

| Source | Cible | Transformation |
|--------|-------|----------------|
| gid::text | no_obj | Cast texte |
| - | type_restri | 'limitation vitesse' |
| vitesse_exist | valeur | Direct (ex: '30 km/h') |
| - | remarque | nom_rue |
| - | maj_date | CURRENT_DATE |
| geom | geom | Direct |
| - | pk_uuid | gen_random_uuid() |
| - | data_owner | 'BY' |

---

## 4. QUESTIONS À VALIDER

1. **Structure exacte** des tables SDOL mob_* ?
2. **État des routes** : dans mob_rte_etat_tr ou dans mob_rte_classe_tr ?
3. **Sens circulation** : colonne dans SDOL ?
4. **Trottoirs** : comment mapper les infos trottoir_1/2 ?
5. **Zones parking** : by_rte_zone_parc → mob_stationnement ?

---

## 5. PROCHAINES ÉTAPES

- [ ] Vérifier structure exacte tables SDOL mob_*
- [ ] Documenter tables restantes (zone_parc, parcours_velo, etc.)
- [ ] Créer requêtes SQL de migration
- [ ] Tester sur échantillon
