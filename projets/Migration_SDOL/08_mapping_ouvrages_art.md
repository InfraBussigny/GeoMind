# Mapping Ouvrages d'Art Bussigny → SDOL

**Date** : 2025-12-18
**Version** : 1.0
**Statut** : En cours

---

## 1. TABLES SOURCES (PostgreSQL Bussigny - schéma ouvrages_speciaux)

### Structure commune (L/P/S)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | serial | ID auto |
| localisation | varchar(100) | Localisation |
| id_type | int4 | ID type ouvrage |
| type | varchar(50) | Type d'ouvrage |
| profondeur | float8 | Profondeur (m) |
| actif | bool | Ouvrage actif |
| annee_pose | date | Année de pose |
| diam_epaisseur | float8 | Diamètre/épaisseur |
| longueur | float8 | Longueur (m) |
| angle_pose | int4 | Angle de pose |
| lien_pdf | text | Lien vers PDF |
| remarque | text | Remarques |
| geom | geometry | Géométrie |

### Tables disponibles

| Table | Type géométrie |
|-------|----------------|
| by_ouvrages_speciaux_l | LineString |
| by_ouvrages_speciaux_p | Point |
| by_ouvrages_speciaux_s | Polygon |
| vw_by_ouvrage_speciaux_l | Vue LineString |
| vw_by_ouvrage_speciaux_p | Vue Point |
| vw_by_ouvrage_speciaux_s | Vue Polygon |

---

## 2. TABLE CIBLE SDOL (schéma back_hkd_databy)

### oa_ouvart_s (Ouvrages d'art - Polygon)

| Colonne | Type | Description |
|---------|------|-------------|
| gid | integer | ID auto |
| no_obj | char(20) | Numéro d'objet |
| nom | char(100) | Nom/localisation |
| type_ouvr | char(50) | Type d'ouvrage |
| annee_constr | integer | Année construction |
| etat | char(50) | État |
| remarque | char(255) | Remarques |
| maj_date | date | Date mise à jour |
| geom | geometry(Polygon) | Géométrie |
| pk_uuid | uuid | UUID |
| data_owner | varchar(50) | Propriétaire |

> **Problème** : SDOL n'a que des polygones (oa_ouvart_s), mais BY a des L/P/S

---

## 3. MAPPING DÉTAILLÉ

### 3.1 by_ouvrages_speciaux_s → oa_ouvart_s (direct)

| Source | Cible | Transformation |
|--------|-------|----------------|
| gid::text | no_obj | Cast texte |
| localisation | nom | Direct |
| type | type_ouvr | Direct |
| EXTRACT(YEAR FROM annee_pose)::int | annee_constr | Extraction année |
| CASE WHEN actif THEN 'en service' ELSE 'hors service' END | etat | Conditionnel |
| remarque | remarque | Direct |
| - | maj_date | CURRENT_DATE |
| geom | geom | Direct (déjà Polygon) |
| - | pk_uuid | gen_random_uuid() |
| - | data_owner | 'BY' |

### 3.2 by_ouvrages_speciaux_p → oa_ouvart_s (Point → Polygon)

| Source | Cible | Transformation |
|--------|-------|----------------|
| gid::text | no_obj | Cast texte |
| localisation | nom | Direct |
| type | type_ouvr | Direct |
| ... | ... | ... |
| ST_Buffer(geom, 1) | geom | **Buffer 1m autour du point** |
| - | data_owner | 'BY' |

### 3.3 by_ouvrages_speciaux_l → oa_ouvart_s (Line → Polygon)

| Source | Cible | Transformation |
|--------|-------|----------------|
| gid::text | no_obj | Cast texte |
| localisation | nom | Direct |
| type | type_ouvr | Direct |
| ... | ... | ... |
| ST_Buffer(geom, diam_epaisseur/2) | geom | **Buffer selon diamètre** |
| - | data_owner | 'BY' |

---

## 4. QUESTIONS À VALIDER

1. **Conversion L/P → S** : OK de faire des buffers ?
2. **Diamètre buffer** : Utiliser diam_epaisseur ou valeur fixe ?
3. **lien_pdf** : Où stocker dans SDOL ? Pas de colonne équivalente.

---

## 5. SQL DE MIGRATION (draft)

```sql
-- Surfaces (direct)
INSERT INTO back_hkd_databy.oa_ouvart_s (...)
SELECT ... FROM ouvrages_speciaux.by_ouvrages_speciaux_s;

-- Points (avec buffer)
INSERT INTO back_hkd_databy.oa_ouvart_s (...)
SELECT
    ...,
    ST_Buffer(geom, COALESCE(diam_epaisseur/2, 1)) as geom
FROM ouvrages_speciaux.by_ouvrages_speciaux_p;

-- Lignes (avec buffer)
INSERT INTO back_hkd_databy.oa_ouvart_s (...)
SELECT
    ...,
    ST_Buffer(geom, COALESCE(diam_epaisseur/2, 0.5)) as geom
FROM ouvrages_speciaux.by_ouvrages_speciaux_l;
```

---

## 6. PROCHAINES ÉTAPES

- [ ] Confirmer conversion L/P → Polygon OK avec SDOL
- [ ] Définir diamètre buffer par défaut
- [ ] Gérer lien_pdf (dans remarque ?)
