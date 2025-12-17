# Mapping Bussigny → SDOL - Assainissement

**Date** : 2025-12-17
**Source** : srv-fme/Prod (schéma assainissement)
**Cible** : postgres.hkd-geomatique.com/sdol (schéma back_hkd_databy)

---

## 1. CHAMBRES : by_ass_chambre → eu_chambre

### Mapping des colonnes

| # | Bussigny (by_ass_chambre) | Type BY | SDOL (eu_chambre) | Type SDOL | Statut | Notes |
|---|---------------------------|---------|-------------------|-----------|--------|-------|
| 1 | gid | integer | gid | integer | ✅ AUTO | Nouvelle clé générée côté SDOL |
| 2 | fid | integer | - | - | ❌ IGNORE | ID interne Bussigny |
| 3 | designation | varchar(20) | no_obj | character | ✅ DIRECT | Numéro de chambre |
| 4 | genre_chambre | varchar(30) | type_ouvr | character | ⚠️ DOMAINE | Mapping valeurs requis |
| 5 | fonction_hydro | varchar(50) | fonction | character | ⚠️ DOMAINE | Mapping valeurs requis |
| 6 | materiau_chambre | varchar(20) | cheminee_mtx | character | ⚠️ DOMAINE | Ou fond_mtx ? |
| 7 | forme_chambre | varchar(20) | - | - | ❓ ABSENT | Pas de correspondance SDOL |
| 8 | eaux_infiltration | varchar(20) | - | - | ❓ ABSENT | Pas de correspondance SDOL |
| 9 | annee_construction | date | constr_an | integer | ⚠️ TRANSFO | Extraire année (EXTRACT) |
| 10 | etat | varchar(20) | etat_constr | character | ⚠️ DOMAINE | Mapping valeurs requis |
| 11 | acces | varchar(20) | accessibilite | character | ⚠️ DOMAINE | Mapping valeurs requis |
| 12 | cote_radier | double | alt_radi | double | ✅ DIRECT | Altitude radier |
| 13 | profondeur | double | profondeur | double | ✅ DIRECT | Profondeur |
| 14 | dispositif_acces | varchar(20) | - | - | ❓ ABSENT | Pas de correspondance SDOL |
| 15 | dimension_1 | double | dim_ch | varchar | ⚠️ TRANSFO | Combiner dim1+dim2 |
| 16 | dimension_2 | double | dim_ch | varchar | ⚠️ TRANSFO | Combiner dim1+dim2 |
| 17 | fonction_chambre | varchar(20) | fonction | character | ⚠️ DOUBLON | Déjà mappé via fonction_hydro |
| 18 | precision_alti | varchar(20) | precis_pl | character | ⚠️ DOMAINE | Mapping valeurs requis |
| 19 | determination_plani | varchar(20) | mode_acqui | character | ⚠️ DOMAINE | Mapping valeurs requis |
| 20 | proprietaire | varchar(20) | proprio | character | ⚠️ DOMAINE | Mapping valeurs requis |
| 21 | no_troncon_entree | integer | - | - | ❓ ABSENT | Relation via géométrie |
| 22 | no_troncon_sortie | integer | - | - | ❓ ABSENT | Relation via géométrie |
| 23 | orientation | double | - | - | ❓ ABSENT | Pas de correspondance SDOL |
| 24 | remarque | text | remarque | character | ✅ DIRECT | Remarques |
| 25 | geom | Point | geom | Point | ✅ DIRECT | Géométrie MN95 |
| 26 | chambre_double | varchar(30) | ch_dbl_on | boolean | ⚠️ TRANSFO | Convertir en booléen |
| 27 | - | - | contenu | character | 📥 DEFAUT | 'EU', 'EC', 'MX' selon fonction |
| 28 | - | - | utilisat | character | 📥 DEFAUT | 'en_service' par défaut |
| 29 | - | - | nom_comm | character | 📥 FIXE | 'Bussigny' |
| 30 | - | - | no_comm | character | 📥 FIXE | '5624' |
| 31 | - | - | coord_nord | double | 📥 CALC | ST_Y(geom) |
| 32 | - | - | coord_est | double | 📥 CALC | ST_X(geom) |
| 33 | - | - | data_owner | varchar | 📥 FIXE | 'by' |

### Légende statuts
- ✅ DIRECT : Correspondance directe
- ⚠️ DOMAINE : Nécessite mapping des valeurs
- ⚠️ TRANSFO : Nécessite transformation
- ❓ ABSENT : Pas d'équivalent côté SDOL
- 📥 DEFAUT : Valeur par défaut à injecter
- 📥 FIXE : Valeur fixe (Bussigny)
- 📥 CALC : Valeur calculée

---

## 2. COLLECTEURS : by_ass_collecteur → eu_collecteur

### Mapping des colonnes

| # | Bussigny (by_ass_collecteur) | Type BY | SDOL (eu_collecteur) | Type SDOL | Statut | Notes |
|---|------------------------------|---------|----------------------|-----------|--------|-------|
| 1 | gid | integer | gid | integer | ✅ AUTO | Nouvelle clé |
| 2 | fid | integer | - | - | ❌ IGNORE | ID interne |
| 3 | materiau | varchar | materiau | character | ⚠️ DOMAINE | Mapping valeurs |
| 4 | fonction_hydro | varchar | fonction | character | ⚠️ DOMAINE | Mapping valeurs |
| 5 | fonction_hierarchique | varchar | hierarchie | character | ⚠️ DOMAINE | Mapping valeurs |
| 6 | determination_plani | varchar | mode_acqui | character | ⚠️ DOMAINE | Mapping valeurs |
| 7 | genre_utilisation | varchar | contenu | character | ⚠️ DOMAINE | EU/EC/MX |
| 8 | annee_construction | date | constr_an | integer | ⚠️ TRANSFO | Extraire année |
| 9 | etat | varchar | etat_constr | character | ⚠️ DOMAINE | Mapping valeurs |
| 10 | proprietaire | varchar | proprio | character | ⚠️ DOMAINE | Mapping valeurs |
| 11 | genre_profil | varchar | profil | character | ⚠️ DOMAINE | Mapping valeurs |
| 12 | precision_alti | varchar | precis_pl | character | ⚠️ DOMAINE | Mapping valeurs |
| 13 | largeur_profil | double | diametre | integer | ⚠️ TRANSFO | Convertir en mm |
| 14 | hauteur_max_profil | double | hauteur | integer | ⚠️ TRANSFO | Convertir en mm |
| 15 | date_inspection_1 | date | inspcam_date | date | ✅ DIRECT | Date inspection |
| 16 | etat_inspection_1 | varchar | etat_constr | character | ⚠️ DOMAINE | Mapping valeurs |
| 17 | remarque | text | remarque | text | ✅ DIRECT | Remarques |
| 18 | geom | LineString | geom | LineString | ✅ DIRECT | Géométrie |
| 19 | - | - | nom_comm | character | 📥 FIXE | 'Bussigny' |
| 20 | - | - | no_comm | character | 📥 FIXE | '5624' |
| 21 | - | - | length | double | 📥 CALC | ST_Length(geom) |
| 22 | - | - | data_owner | varchar | 📥 FIXE | 'by' |

---

## 3. MAPPING DES DOMAINES (VALEURS)

### 3.1 Propriétaire (proprio)

| Bussigny | SDOL |
|----------|------|
| Bussigny - Publique | communal |
| Privée | prive |
| CFF | cff |

### 3.2 État (etat_constr)

| Bussigny | SDOL |
|----------|------|
| Bon | bon |
| Moyen | moyen |
| Mauvais | mauvais |
| Inconnu | inconnu |
| À vérifier | a_verifier |

### 3.3 Matériau (materiau)

| Bussigny | SDOL |
|----------|------|
| Béton | beton |
| PVC | pvc |
| Grès | gres |
| Fonte | fonte |
| PE | pe |
| Acier | acier |
| Inconnu | inconnu |

### 3.4 Fonction/Contenu (contenu)

| Bussigny (genre_utilisation) | SDOL (contenu) |
|------------------------------|----------------|
| Eaux usées | EU |
| Eaux claires | EC |
| Mixte | MX |
| Inconnu | INC |

### 3.5 Genre chambre → type_ouvr

| Bussigny (genre_chambre) | SDOL (type_ouvr) |
|--------------------------|------------------|
| Chambre de visite | chambre |
| Cheneau | grille |
| Sac - Grille | grille |
| Chambre de décantation | chambre_speciale |
| Séparateur d'hydrocarbures | separateur |
| Station pompage | station_pompage |
| Chambre de rétention | retention |
| Déversoir d'orage | deversoir |

---

## 4. POINTS SENSIBLES

### 🔴 Bloquants

| # | Problème | Impact | Solution proposée |
|---|----------|--------|-------------------|
| 1 | Champs absents SDOL (forme_chambre, dispositif_acces, orientation) | Perte de données | Stocker dans remarque ou créer vue Bussigny |
| 2 | Domaines non validés | Erreurs d'insertion | Valider avec HKD la liste des valeurs SDOL |

### 🟡 À valider

| # | Élément | Question |
|---|---------|----------|
| 1 | Mapping matériau → cheminee_mtx ou fond_mtx ? | Quel champ SDOL utiliser ? |
| 2 | Chambre double : varchar → boolean | Comment interpréter les valeurs existantes ? |
| 3 | Dimensions : 2 champs → 1 champ texte | Format attendu par SDOL ? (ex: "100x80") |

### 🟢 OK

| # | Élément | Statut |
|---|---------|--------|
| 1 | Géométrie | Compatible (Point/LineString, EPSG:2056) |
| 2 | Coordonnées | MN95 identique |
| 3 | Structure générale | Compatible |

---

## 5. SCRIPT SQL DE MIGRATION (DRAFT)

```sql
-- Migration eu_chambre
INSERT INTO back_hkd_databy.eu_chambre (
    no_obj, contenu, proprio, nom_comm, no_comm,
    coord_nord, coord_est, fonction, type_ouvr,
    alt_radi, profondeur, etat_constr, accessibilite,
    remarque, ch_dbl_on, geom, data_owner
)
SELECT
    designation AS no_obj,
    CASE genre_utilisation
        WHEN 'Eaux usées' THEN 'EU'
        WHEN 'Eaux claires' THEN 'EC'
        ELSE 'MX'
    END AS contenu,
    CASE proprietaire
        WHEN 'Bussigny - Publique' THEN 'communal'
        WHEN 'Privée' THEN 'prive'
        ELSE 'autre'
    END AS proprio,
    'Bussigny' AS nom_comm,
    '5624' AS no_comm,
    ST_Y(geom) AS coord_nord,
    ST_X(geom) AS coord_est,
    fonction_hydro AS fonction,
    CASE genre_chambre
        WHEN 'Chambre de visite' THEN 'chambre'
        WHEN 'Cheneau' THEN 'grille'
        ELSE 'autre'
    END AS type_ouvr,
    cote_radier AS alt_radi,
    profondeur,
    LOWER(etat) AS etat_constr,
    LOWER(acces) AS accessibilite,
    remarque,
    CASE WHEN chambre_double IS NOT NULL THEN TRUE ELSE FALSE END AS ch_dbl_on,
    geom,
    'by' AS data_owner
FROM assainissement.by_ass_chambre;
```

---

## 6. PROCHAINES ÉTAPES

1. [ ] Valider le mapping des domaines avec HKD
2. [ ] Créer workbench FME de migration
3. [ ] Tester sur échantillon (10 chambres, 10 collecteurs)
4. [ ] Migration complète
5. [ ] Validation post-migration
