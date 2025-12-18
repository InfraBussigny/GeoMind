# Mapping Fibre Optique Bussigny → SDOL

**Date** : 2025-12-18
**Version** : 2.0
**Statut** : En cours

---

## 1. ARCHITECTURE

```
PostgreSQL Bussigny (srv-fme)              PostgreSQL SDOL (HKD)
fibre_optique.*                            back_hkd_databy.*
       │                                          │
       │            Workbench FME                 │
       └──────────────────────────────────────────┘
```

**Connexion SDOL :**
- Host: `postgres.hkd-geomatique.com:5432`
- Database: `sdol`
- Schéma: `back_hkd_databy`
- User écriture: `by_fme_w`
- Accès: depuis srv-fme uniquement (IP whitelistée)

---

## 2. TABLES SOURCES (PostgreSQL Bussigny - schéma fibre_optique)

### Éléments linéaires (géométrie LineString)

| Table | Colonnes |
|-------|----------|
| **fo_segment** | gid, numero, id_type_segment, id_gabarit_coupe, id_type_pose, id_determination_planimetrique, longueur, remarque, geom |
| **fo_tube_geo** | gid, id, numero, id_type_cana, type_cana, id_materiau, materiau, date_pose, id_gabarit_tube, gabarit_tube, dimension, longueur, remarque, geom |
| **fo_cable_geo** | gid, id, numero, id_etat_disposition, etat_disposition, id_etat_service, etat_service, id_tension_service, tension_service, id_type_gaine, type_gaine, id_section, date_pose, longueur, remarque, section_cable, geom |

### Éléments ponctuels (géométrie Point)

| Table | Colonnes |
|-------|----------|
| **fo_chambre** | gid, numero, id_type_chambre, diametre, date_pose, remarque, geom |
| **fo_armoire** | gid, numero, numero_coffret, info_cad, id_genre_armoire, id_etat_service, id_etat_disposition, id_determination_planimetrique, remarque, geom |
| **fo_manchon** | gid, numero, id_etat_service, id_tension_service, id_genre_manchon, id_determination_planimetrique, remarque, geom |
| **fo_point_livraison** | gid, numero, id_tension_service, id_montage, id_determination_planimetrique, remarque, geom |

### Tables attributaires (sans géométrie)

| Table | Colonnes |
|-------|----------|
| fo_tube | id, numero, id_type_cana, id_materiau, date_pose, id_gabarit_tube, dimension, longueur, remarque |
| fo_cable | id, numero, id_etat_disposition, id_etat_service, id_tension_service, id_type_gaine, id_section, date_pose, longueur, remarque |
| fo_chambre_detail | gid, numero, type_chambre, remarque |
| fo_segment_cable | id, id_segment, id_cable |
| fo_segment_tube | id, id_segment, id_tube |
| fo_tube_cable | id, id_tube, id_cable |

---

## 3. TABLES CIBLES SDOL (schéma back_hkd_databy)

### tc_conduite (Conduites télécom - LineString)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | integer | ID auto |
| no_obj | char(20) | Numéro d'objet |
| utilisat | char(50) | Utilisation (en service, hors service...) |
| proprio | char(50) | Propriétaire |
| precis_pl | char(20) | Précision planimétrique |
| provenance | char(50) | Provenance des données |
| materiau | char(50) | Matériau |
| diametre | double | Diamètre (mm) |
| constr_an | integer | Année de construction |
| nb_tube | integer | Nombre de tubes |
| remarque | char(255) | Remarques |
| releve_date | date | Date du relevé |
| maj_date | date | Date mise à jour |
| length | double | Longueur (m) |
| geom | geometry | Géométrie LineString |
| pk_uuid | uuid | UUID unique |
| data_owner | varchar(50) | Propriétaire des données |

### tc_elemontage (Éléments de montage télécom - Point)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | integer | ID auto |
| no_obj | char(20) | Numéro d'objet |
| utilisat | char(50) | Utilisation |
| proprio | char(50) | Propriétaire |
| precis_pl | char(20) | Précision planimétrique |
| type_elem | char(50) | Type d'élément |
| accessibilite | char(20) | Accessibilité |
| constr_an | integer | Année de construction |
| remarque | char(255) | Remarques |
| releve_date | date | Date du relevé |
| maj_date | date | Date mise à jour |
| geom | geometry | Géométrie Point |
| pk_uuid | uuid | UUID unique |
| data_owner | varchar(50) | Propriétaire des données |

---

## 4. MAPPING DÉTAILLÉ

### 4.1 Linéaires → tc_conduite

| Source | Table source | Cible tc_conduite | Transformation |
|--------|--------------|-------------------|----------------|
| fo_segment | numero | no_obj | Direct |
| fo_segment | - | utilisat | 'en service' (défaut) |
| fo_segment | - | proprio | 'Commune de Bussigny' |
| fo_segment | id_determination_planimetrique | precis_pl | Lookup table |
| fo_segment | - | provenance | 'AutoCAD Map 3D' |
| fo_segment | - | materiau | NULL |
| fo_segment | id_gabarit_coupe | diametre | Lookup table |
| fo_segment | - | constr_an | NULL |
| fo_segment | - | nb_tube | NULL |
| fo_segment | remarque | remarque | Direct |
| fo_segment | - | releve_date | NULL |
| fo_segment | - | maj_date | CURRENT_DATE |
| fo_segment | longueur | length | Direct |
| fo_segment | geom | geom | ST_Force2D si nécessaire |
| fo_segment | - | pk_uuid | gen_random_uuid() |
| fo_segment | - | data_owner | 'BY' |

| Source | Table source | Cible tc_conduite | Transformation |
|--------|--------------|-------------------|----------------|
| fo_tube_geo | numero | no_obj | Direct |
| fo_tube_geo | - | utilisat | 'en service' |
| fo_tube_geo | - | proprio | 'Commune de Bussigny' |
| fo_tube_geo | - | precis_pl | NULL |
| fo_tube_geo | - | provenance | 'AutoCAD Map 3D' |
| fo_tube_geo | materiau | materiau | Direct (déjà texte) |
| fo_tube_geo | dimension | diametre | Direct |
| fo_tube_geo | EXTRACT(YEAR FROM date_pose) | constr_an | Extraction année |
| fo_tube_geo | - | nb_tube | 1 |
| fo_tube_geo | remarque | remarque | Direct |
| fo_tube_geo | date_pose | releve_date | Direct |
| fo_tube_geo | - | maj_date | CURRENT_DATE |
| fo_tube_geo | longueur | length | Direct |
| fo_tube_geo | geom | geom | Direct |
| fo_tube_geo | - | pk_uuid | gen_random_uuid() |
| fo_tube_geo | - | data_owner | 'BY' |

| Source | Table source | Cible tc_conduite | Transformation |
|--------|--------------|-------------------|----------------|
| fo_cable_geo | numero | no_obj | Direct |
| fo_cable_geo | etat_service | utilisat | Direct (déjà texte) |
| fo_cable_geo | - | proprio | 'Commune de Bussigny' |
| fo_cable_geo | - | precis_pl | NULL |
| fo_cable_geo | - | provenance | 'AutoCAD Map 3D' |
| fo_cable_geo | type_gaine | materiau | Direct |
| fo_cable_geo | section_cable | diametre | Direct |
| fo_cable_geo | EXTRACT(YEAR FROM date_pose) | constr_an | Extraction année |
| fo_cable_geo | - | nb_tube | NULL |
| fo_cable_geo | remarque | remarque | Direct |
| fo_cable_geo | date_pose | releve_date | Direct |
| fo_cable_geo | - | maj_date | CURRENT_DATE |
| fo_cable_geo | longueur | length | Direct |
| fo_cable_geo | geom | geom | Direct |
| fo_cable_geo | - | pk_uuid | gen_random_uuid() |
| fo_cable_geo | - | data_owner | 'BY' |

### 4.2 Ponctuels → tc_elemontage

| Source | Table source | Cible tc_elemontage | Transformation |
|--------|--------------|---------------------|----------------|
| fo_chambre | numero | no_obj | Direct |
| fo_chambre | - | utilisat | 'en service' |
| fo_chambre | - | proprio | 'Commune de Bussigny' |
| fo_chambre | - | precis_pl | NULL |
| fo_chambre | - | **type_elem** | **'chambre'** |
| fo_chambre | - | accessibilite | NULL |
| fo_chambre | EXTRACT(YEAR FROM date_pose) | constr_an | Extraction année |
| fo_chambre | remarque | remarque | Direct |
| fo_chambre | - | maj_date | CURRENT_DATE |
| fo_chambre | geom | geom | Direct |
| fo_chambre | - | pk_uuid | gen_random_uuid() |
| fo_chambre | - | data_owner | 'BY' |

| Source | Table source | Cible tc_elemontage | Transformation |
|--------|--------------|---------------------|----------------|
| fo_armoire | numero | no_obj | Direct |
| fo_armoire | - | utilisat | Lookup id_etat_service |
| fo_armoire | - | proprio | 'Commune de Bussigny' |
| fo_armoire | id_determination_planimetrique | precis_pl | Lookup table |
| fo_armoire | - | **type_elem** | **'armoire'** |
| fo_armoire | - | accessibilite | NULL |
| fo_armoire | - | constr_an | NULL |
| fo_armoire | remarque | remarque | Direct |
| fo_armoire | - | maj_date | CURRENT_DATE |
| fo_armoire | geom | geom | Direct |
| fo_armoire | - | pk_uuid | gen_random_uuid() |
| fo_armoire | - | data_owner | 'BY' |

| Source | Table source | Cible tc_elemontage | Transformation |
|--------|--------------|---------------------|----------------|
| fo_manchon | numero | no_obj | Direct |
| fo_manchon | - | utilisat | Lookup id_etat_service |
| fo_manchon | - | proprio | 'Commune de Bussigny' |
| fo_manchon | id_determination_planimetrique | precis_pl | Lookup table |
| fo_manchon | - | **type_elem** | **'manchon'** |
| fo_manchon | - | accessibilite | NULL |
| fo_manchon | - | constr_an | NULL |
| fo_manchon | remarque | remarque | Direct |
| fo_manchon | - | maj_date | CURRENT_DATE |
| fo_manchon | geom | geom | Direct |
| fo_manchon | - | pk_uuid | gen_random_uuid() |
| fo_manchon | - | data_owner | 'BY' |

| Source | Table source | Cible tc_elemontage | Transformation |
|--------|--------------|---------------------|----------------|
| fo_point_livraison | numero | no_obj | Direct |
| fo_point_livraison | - | utilisat | Lookup id_tension_service |
| fo_point_livraison | - | proprio | 'Commune de Bussigny' |
| fo_point_livraison | id_determination_planimetrique | precis_pl | Lookup table |
| fo_point_livraison | - | **type_elem** | **'point de livraison'** |
| fo_point_livraison | - | accessibilite | NULL |
| fo_point_livraison | - | constr_an | NULL |
| fo_point_livraison | remarque | remarque | Direct |
| fo_point_livraison | - | maj_date | CURRENT_DATE |
| fo_point_livraison | geom | geom | Direct |
| fo_point_livraison | - | pk_uuid | gen_random_uuid() |
| fo_point_livraison | - | data_owner | 'BY' |

---

## 5. QUESTIONS À VALIDER AVEC HKD/SDOL

1. **Valeurs type_elem** : 'chambre', 'armoire', 'manchon', 'point de livraison' - OK ?
2. **data_owner** : 'BY' ou 'Bussigny' ou autre code ?
3. **precis_pl** : quelles valeurs acceptées ?
4. **utilisat** : quelles valeurs acceptées ? ('en service', 'hors service', 'projet' ?)

---

## 6. PROCHAINES ÉTAPES

- [ ] Valider les valeurs de domaines avec HKD
- [ ] Créer les lookup tables pour les ID → texte
- [ ] Créer le workbench FME ou les vues SQL
- [ ] Tester sur quelques enregistrements
- [ ] Mise en production
