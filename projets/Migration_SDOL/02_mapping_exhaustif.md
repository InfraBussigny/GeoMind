# Mapping Exhaustif Bussigny → SDOL

**Date** : 2025-12-18
**Auteur** : GeoBrain
**Version** : 1.0

---

## Légende

| Symbole | Signification |
|---------|---------------|
| ✅ | Correspondance directe trouvée |
| ⚠️ | Correspondance partielle (transformation requise) |
| ❌ | Pas de correspondance SDOL |
| 🔒 | Hors scope (géré collectivement par SDOL) |
| ❓ | À vérifier / confirmer avec HKD |

---

## 1. THÉMATIQUES SDOL (Préfixes)

| Préfixe | Thématique SDOL | Tables |
|---------|-----------------|--------|
| `ad_` | Adresses | 10 |
| `af_` | Affectation / territoire | 4 |
| `ar_` | Assainissement (réparations) | 3 |
| `at_` | Aménagement du territoire | 17 |
| `cad_` | Cadastre simplifié | 4 |
| `cd_` | Chauffage à distance | 6 |
| `cg_` | Cimetière gestion | 12 |
| `cim_` | Cimetière | 15 |
| `dn_` | Dangers naturels | 11 |
| `ecl_` | Éclairage public | 4 |
| `eg_` | Énergie solaire | 1 |
| `ele_` | Électricité | 9 |
| `en_` | Environnement / Nature | 25 |
| `ep_` | Eau potable | 35 |
| `eqp_` | Équipements urbains | 6 |
| `eu_` | Eaux usées (assainissement) | 65 |
| `ev_` | Événements | 6 |
| `gz_` | Gaz | 3 |
| `img_` | Images / traces | 2 |
| `mo_` | Mensuration officielle | 32 |
| `mob_` | Mobilité / routes | 35 |
| `oa_` | Ouvrages d'art | 3 |
| `ofen_` | OFEN énergie | 1 |
| `pao_` | PAO / cartographie | 6 |
| `pc_` | Protection civile parcelles | 5 |
| `pci_` | Protection civile abris | 2 |
| `polc_` | Police du commerce | 18 |
| `rcb_` | Registre bâtiments | 1 |
| `tc_` | Télécommunications | 4 |
| `tp_` | Transports publics | 4 |
| `tx_` | Travaux / permis fouille | 9 |
| `vd*_` | Données cantonales VD | 12 |

**Total SDOL : ~280 tables**

---

## 2. MAPPING PAR SCHÉMA BUSSIGNY

### 2.1 Schéma `assainissement` (4 tables)

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `by_ass_chambre` | `eu_chambre` | ✅ | Mappé en détail (voir mapping_bussigny_sdol.md) |
| `by_ass_chambre_detail` | ❓ | ❌ | Pas de table détail dans SDOL, stocker dans remarque |
| `by_ass_collecteur` | `eu_collecteur` | ✅ | Mappé en détail |
| `by_ass_couvercle` | ❓ | ❌ | Pas de table couvercle séparée dans SDOL |

**Volumétrie estimée** : ~30'000 objets

### 2.2 Schéma `bdco` (38 tables) 🔒

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `bdco_*` | `mo_*` | 🔒 | Mensuration officielle gérée collectivement par SDOL |

**Hors scope** : Les données cadastrales sont commandées par SDOL pour toutes les communes.

### 2.3 Schéma `route` (35 tables)

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `by_rte_troncon` | `mob_rte_classe_tr` | ⚠️ | Mapping colonnes requis |
| `by_rte_etat_troncon` | `mob_rte_etat_tr` | ⚠️ | États + actions |
| `by_rte_entretien` | `mob_rte_entretien_tr` | ⚠️ | Entretien routes |
| `by_rte_arret_tp` | `tp_bus_s` ou `tp_train_s` | ⚠️ | Selon type de transport |
| `by_rte_comptage` | `mob_rte_tjm_tr` | ⚠️ | Trafic journalier moyen |
| `by_rte_travaux` | `tx_permis_fouille` | ⚠️ | Ou table séparée ? |
| `by_rte_ouvrage_ponctuel` | `mob_rte_etat_p` | ⚠️ | Ouvrages ponctuels |
| `by_rte_parcours_velo` | `mob_parcours_cyclable` | ✅ | Correspondance directe |
| `by_rte_vitesse` | `mob_rte_restri_tr` | ⚠️ | Restrictions vitesse |
| `by_rte_zone_parc` | `mob_stationnement` | ⚠️ | Zones parking |
| `by_rte_zone_stationnement` | `mob_stationnement` | ⚠️ | Stationnement |
| `by_rte_tp` | `tp_bus_l` / `tp_train_l` | ⚠️ | Lignes TP |
| `by_rte_val_*` | - | ❌ | Tables de valeurs internes |
| `by_rte_rel_*` | - | ❌ | Tables de relations internes |

### 2.4 Schéma `divers` (12 tables)

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `by_ouvrage_speciaux_l` | `oa_ouvart_s` | ⚠️ | Ouvrages d'art (ponts, tunnels) |
| `by_ouvrage_speciaux_p` | `oa_ouvart_s` | ⚠️ | Transformer point → surface ? |
| `by_ouvrage_speciaux_s` | `oa_ouvart_s` | ✅ | Surfaces |
| `by_ouvrage_speciaux_situ` | ❓ | ❌ | Pas de correspondance claire |
| `by_transport_public_a` | `tp_bus_s` / `tp_train_s` | ⚠️ | Arrêts TP |
| `by_transport_public_a_l` | ❓ | ❌ | Arrêts linéaires ? |
| `by_transport_public_l` | `tp_bus_l` / `tp_train_l` | ⚠️ | Lignes TP |
| `by_transport_public_s` | `tp_bus_s` / `tp_train_s` | ⚠️ | Surfaces TP |
| `by_val_tp_*` | - | ❌ | Tables de valeurs internes |
| `by_val_type_ouvrage` | - | ❌ | Table de valeurs interne |

### 2.5 Schéma `nature` (3 tables)

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `by_nat_arbre_vergers` | `en_arbre_p` ou `en_arbre_s` | ⚠️ | Arbres remarquables/vergers |
| `by_nat_parcours_nature` | `en_nat_liaison` | ⚠️ | Ou `mob_chem_ped_l` ? |
| `by_val_genre_vergers` | - | ❌ | Table de valeurs interne |

### 2.6 Schéma `pts_interet` (3 tables)

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `by_pti_point_interet` | ❓ | ❌ | **BLOQUANT** : Pas de table POI dans SDOL |
| `by_pti_val_theme` | - | ❌ | Table de valeurs interne |
| `by_pti_val_type_point` | - | ❌ | Table de valeurs interne |

### 2.7 Schéma `externe` (4 tables) 🔒

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `sel_conduite` | `ep_conduite` | 🔒 | Géré par SEL/SDOL |
| `sel_hydrant` | `ep_hydrante` | 🔒 | Géré par SEL/SDOL |
| `sel_vanne` | `ep_vanne` | 🔒 | Géré par SEL/SDOL |
| `by_ass_couvercle` | ❓ | ❓ | Doublon ? |

---

## 3. DONNÉES MANQUANTES CÔTÉ BUSSIGNY

### 3.1 Tables SDOL sans source Bussigny identifiée

| Thématique | Tables SDOL | Source possible |
|------------|-------------|-----------------|
| Chauffage à distance | `cd_*` (6 tables) | ❓ Pas de réseau CAD à Bussigny ? |
| Cimetière | `cim_*` (15 tables) | ❓ Données existantes ? |
| Dangers naturels | `dn_*` (11 tables) | Canton VD ? |
| Éclairage public | `ecl_*` (4 tables) | ❓ Oracle (SRV-SAI) ? |
| Électricité | `ele_*` (9 tables) | Oracle (SRV-SAI) via AutoCAD |
| Équipements urbains | `eqp_*` (6 tables) | ❓ À créer ? |
| Gaz | `gz_*` (3 tables) | ❓ Pas de réseau gaz communal ? |
| **Télécommunications** | `tc_*` (4 tables) | **Oracle (SRV-SAI) - FIBRE OPTIQUE** |
| Travaux/permis | `tx_*` (9 tables) | ❓ Gestion séparée ? |

### 3.2 Données Oracle (SRV-SAI) à inventorier

| Thématique | Géré par | Cible SDOL potentielle |
|------------|----------|------------------------|
| **Fibre optique** | AutoCAD Map 3D | `tc_conduite`, `tc_elemontage` |
| Électricité | AutoCAD Map 3D | `ele_*` |
| Éclairage public | AutoCAD Map 3D | `ecl_*` |
| (Eau potable) | SEL | `ep_*` (déjà géré) |

---

## 4. SYNTHÈSE

### 4.1 Prêt à migrer ✅

| Schéma | Tables | Volumétrie | Statut mapping |
|--------|--------|------------|----------------|
| assainissement | 2/4 | ~30'000 | Détaillé |
| route (partiel) | 8/35 | À estimer | Ébauche |
| divers (partiel) | 4/12 | À estimer | Ébauche |
| nature | 2/3 | À estimer | Ébauche |

### 4.2 À mapper en détail ⚠️

| Schéma | Tables concernées | Action requise |
|--------|-------------------|----------------|
| route | troncon, etat, entretien, arrets | Mapping colonnes |
| divers | ouvrages, TP | Mapping colonnes |
| nature | arbres, parcours | Mapping colonnes |

### 4.3 Bloquants ❌

| Problème | Tables concernées | Solution proposée |
|----------|-------------------|-------------------|
| Pas de table POI dans SDOL | `by_pti_point_interet` | Demander création à HKD |
| Pas de table couvercle | `by_ass_couvercle` | Stocker dans remarque chambre |
| Pas de table détail chambre | `by_ass_chambre_detail` | Stocker dans remarque |

### 4.4 À inventorier (Oracle) 🔍

| Source | Thématique | Priorité |
|--------|------------|----------|
| Oracle SRV-SAI | **Fibre optique** | Haute |
| Oracle SRV-SAI | Électricité | Moyenne |
| Oracle SRV-SAI | Éclairage public | Moyenne |

---

## 5. PROCHAINES ÉTAPES

1. [ ] **Inventorier Oracle** : Lister les tables fibre/électricité/éclairage dans Oracle SRV-SAI
2. [ ] **Compléter mapping route** : Colonnes détaillées pour tronçons, états, arrêts TP
3. [ ] **Compléter mapping divers** : Ouvrages d'art, transports publics
4. [ ] **Compléter mapping nature** : Arbres, parcours
5. [ ] **Valider avec HKD** : Domaines, création table POI, format dimensions
6. [ ] **Créer workbenches FME** : Un par thématique

---

## 6. QUESTIONS POUR HKD/SDOL

1. **POI** : Est-il prévu une table `pti_*` ou équivalent dans SDOL ?
2. **Couvercles** : Doivent-ils être migrés ? Comment (dans chambre ou séparé) ?
3. **Fibre optique** : Structure `tc_*` prévue pour toutes les communes ?
4. **Domaines** : Liste exhaustive des valeurs acceptées par SDOL ?
5. **Fréquence sync** : Migration one-shot ou synchronisation régulière ?
