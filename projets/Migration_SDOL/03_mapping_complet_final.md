# Mapping Complet Bussigny → SDOL

**Date** : 2025-12-18
**Version** : 2.0 - Mapping exhaustif basé sur Excel SDOL + Projets QGIS
**Auteur** : GeoBrain

---

## Sources utilisées

| Source | Fichier | Contenu |
|--------|---------|---------|
| Excel SDOL | `PR24-0281-contenu-geoportail.xlsx` | Structure thèmes/groupes/couches SDOL |
| QGIS Bussigny | 9 projets .qgs | Tables PostgreSQL utilisées |
| PostgreSQL | srv-fme/Prod | Schémas source |

---

## SYNTHÈSE EXÉCUTIVE

### Couverture du mapping

| Thème SDOL | Couvert par BY | Source BY | Statut |
|------------|----------------|-----------|--------|
| Assainissement | ✅ Oui | `assainissement.*` | Mappé |
| Télécommunications | ✅ Oui | `fibre_optique.*` | **À MAPPER** |
| Environnement/Arbres | ✅ Oui | `nature.*` | À mapper |
| Mobilité/Routes | ✅ Oui | `route.*` | À mapper |
| Transports publics | ✅ Oui | `route.by_transport_*` | À mapper |
| Ouvrages d'art | ✅ Oui | `ouvrages_speciaux.*` | À mapper |
| Eau potable | 🔒 SEL | `externe.sel_*` | Hors scope |
| Points d'intérêt | ❌ Non | `pts_interet.*` | Pas de table SDOL |
| Éclairage public | ❓ | À inventorier | À vérifier |
| Électricité | ❓ | À inventorier | À vérifier |
| Cadastre | 🔒 | SDOL gère | Hors scope |

---

## 1. ASSAINISSEMENT

### Source Bussigny
- Schéma : `assainissement`
- Projet QGIS : `assainissement - Copie.qgs`

### Mapping

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `by_ass_chambre` | `eu_chambre` | ✅ Mappé | Voir mapping détaillé existant |
| `by_ass_chambre_detail` | (dans remarque) | ⚠️ | Pas de table séparée SDOL |
| `by_ass_chambre_hs` | `eu_chambre` | ⚠️ | utilisat='hors service' |
| `by_ass_collecteur` | `eu_collecteur` | ✅ Mappé | Voir mapping détaillé existant |
| `by_ass_collecteur_hs` | `eu_collecteur` | ⚠️ | utilisat='hors service' |
| `by_ass_couvercle` | (dans eu_chambre) | ⚠️ | Pas de table séparée |

### Tables SDOL associées (thème Assainissement)
```
eu_chambre, eu_grille, eu_relevage, eu_ouvr_sp, eu_exutoire
eu_collecteur, eu_coll_serv_l, eu_evac_par
eu_zone_infiltration, eu_surf_impermeable
eu_va_colletat_last, eu_va_ss_surf_impermeable
```

---

## 2. TÉLÉCOMMUNICATIONS / FIBRE OPTIQUE ⭐

### Source Bussigny
- Schéma : `fibre_optique`
- Projet QGIS : `fibre_optique - Copie.qgs`

### Mapping

| Table/Vue Bussigny | Table SDOL | Statut | Notes |
|-------------------|------------|--------|-------|
| `vw_fo_chambre` | `tc_elemontage` | ⚠️ À mapper | Chambres fibre → éléments montage |
| `fo_chambre_detail` | (dans remarque) | ⚠️ | Détails |
| `vw_fo_cable` | `tc_conduite` | ⚠️ À mapper | Câbles fibre → conduites télécom |
| `mvw_fo_cable_geo` | `tc_conduite` | ⚠️ | Vue matérialisée |
| `vw_fo_tube` | `tc_conduite` | ⚠️ À mapper | Tubes → conduites |
| `mvw_fo_tube_geo` | `tc_conduite` | ⚠️ | Vue matérialisée |
| `vw_fo_segment` | `tc_conduite` | ⚠️ À mapper | Tracés |
| `vw_fo_armoire` | `tc_elemontage` | ⚠️ À mapper | Armoires fibre |
| `vw_fo_manchon` | `tc_elemontage` | ⚠️ À mapper | Manchons |
| `vw_fo_point_livraison` | `tc_elemontage` | ⚠️ À mapper | Points de livraison |
| `fo_segment_cable` | - | ❌ | Table relation interne |
| `fo_segment_tube` | - | ❌ | Table relation interne |
| `fo_tube_cable` | - | ❌ | Table relation interne |

### Tables SDOL (thème Autres réseaux → Télécom)
```
tc_conduite       - Conduites télécom
tc_elemontage     - Éléments de montage télécom
tc_swisscom_conduite    - Conduites Swisscom (séparé)
tc_swisscom_elemontage  - Éléments Swisscom (séparé)
```

### Prochaine étape
Créer mapping colonnes détaillé `fibre_optique → tc_*`

---

## 3. ENVIRONNEMENT / NATURE

### Source Bussigny
- Schéma : `nature`
- Projet QGIS : `nature - Copie.qgs`

### Mapping

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `by_nat_arbre_vergers` | `en_arbre_p` | ⚠️ À mapper | Arbres remarquables |
| `by_nat_parcours_nature` | `en_nat_liaison` ou `mob_chem_ped_l` | ⚠️ | Parcours nature |
| `by_val_genre_vergers` | - | ❌ | Table de valeurs interne |

### Tables SDOL (thème Environnement)
```
en_arbre_p       - Arbres (point)
en_arbre_s       - Arbres (surface/canopée)
en_nat_liaison   - Liaisons nature
en_reserve_faune - Réserves faune
en_imns_l/s      - Monuments naturels
```

---

## 4. MOBILITÉ / ROUTES

### Source Bussigny
- Schéma : `route`
- Projet QGIS : `route - Copie.qgs`

### Mapping

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `by_rte_troncon` | `mob_rte_classe_tr` | ⚠️ À mapper | Tronçons routiers |
| `by_rte_etat_troncon` | `mob_rte_etat_tr` | ⚠️ | États des tronçons |
| `by_rte_vitesse` | `mob_rte_restri_tr` | ⚠️ | Restrictions vitesse |
| `by_rte_entretien` | `mob_rte_entretien_tr` | ⚠️ | Entretien |
| `by_rte_comptage` | `mob_rte_tjm_tr` | ⚠️ | Trafic journalier moyen |
| `by_rte_zone_parc` | `mob_stationnement` | ⚠️ | Zones parking |
| `by_rte_zone_stationnement` | `mob_stationnement` | ⚠️ | Stationnement |
| `by_rte_parcours_velo` | `mob_parcours_cyclable` | ✅ | Pistes cyclables |
| `by_rte_ouvrage_ponctuel` | `mob_rte_etat_p` | ⚠️ | Ouvrages ponctuels |

### Tables SDOL (thème Mobilité)
```
mob_rte_classe_tr      - Classification routes
mob_rte_etat_tr        - État des routes
mob_rte_entretien_tr   - Entretien routes
mob_rte_restri_tr      - Restrictions
mob_rte_tjm_tr         - Trafic journalier
mob_stationnement      - Stationnement
mob_parcours_cyclable  - Pistes cyclables
mob_chem_ped_*         - Chemins pédestres
```

---

## 5. TRANSPORTS PUBLICS

### Source Bussigny
- Schéma : `route`
- Projet QGIS : `route - Copie.qgs`

### Mapping

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `by_transport_public_a` | `tp_bus_s` / `tp_train_s` | ⚠️ À mapper | Arrêts TP |
| `by_transport_public_l` | `tp_bus_l` / `tp_train_l` | ⚠️ | Lignes TP |
| `by_transport_public_s` | `tp_bus_s` / `tp_train_s` | ⚠️ | Surfaces TP |

### Tables SDOL (thème Mobilité → TP)
```
tp_bus_l    - Lignes de bus
tp_bus_s    - Stations de bus
tp_train_l  - Lignes de train
tp_train_s  - Stations de train
tp_bateau_s - Stations de bateau
```

---

## 6. OUVRAGES D'ART

### Source Bussigny
- Schéma : `ouvrages_speciaux`
- Projet QGIS : `ouvrages_speciaux - Copie.qgs`

### Mapping

| Table Bussigny | Table SDOL | Statut | Notes |
|----------------|------------|--------|-------|
| `by_ouvrages_speciaux_l` | `oa_ouvart_s` | ⚠️ | Linéaire → Surface ? |
| `by_ouvrages_speciaux_p` | `oa_ouvart_s` | ⚠️ | Point → Surface ? |
| `by_ouvrages_speciaux_s` | `oa_ouvart_s` | ✅ | Surface → Surface |
| `by_ouvrage_speciaux_situ` | - | ❌ | Pas d'équivalent |

### Tables SDOL (thème Infrastructure routière)
```
oa_ouvart_s         - Ouvrages d'art (surface)
oa_ouvart_s_action  - Actions sur ouvrages
oa_ouvart_s_etat    - État des ouvrages
```

---

## 7. POINTS D'INTÉRÊT ❌

### Source Bussigny
- Schéma : `pts_interet`
- Projet QGIS : `pts_interet - Copie.qgs`

### Problème
**Pas de table équivalente dans SDOL !**

| Table Bussigny | Table SDOL | Statut |
|----------------|------------|--------|
| `by_pti_point_interet` | ❌ Aucune | **BLOQUANT** |
| `by_pec_locaux_commer` | ❌ Aucune | Promotion économique |

### Solution proposée
1. Demander à HKD de créer une table `pti_*` ou `poi_*`
2. Ou intégrer dans une table existante (`eqp_*` ?)

---

## 8. EAU POTABLE 🔒

### Source Bussigny
- Schéma : `externe`
- Projet QGIS : `sel_eau_potable - Copie.qgs`

### Statut
**Géré par SEL/SDOL - Hors scope migration Bussigny**

| Table Bussigny | Table SDOL | Statut |
|----------------|------------|--------|
| `sel_conduite` | `ep_conduite` | 🔒 SEL gère |
| `sel_hydrant` | `ep_hydrante` | 🔒 SEL gère |
| `sel_vanne` | `ep_vanne` | 🔒 SEL gère |

---

## 9. SWISSCOM

### Source Bussigny
- Projet QGIS : `swisscom - Copie.qgs`

### Statut
**Données via géoservice WMS Swisscom - pas de données locales**

Tables SDOL disponibles :
```
tc_swisscom_conduite
tc_swisscom_elemontage
```

---

## RÉCAPITULATIF ACTIONS

### À faire immédiatement

| Priorité | Action | Effort estimé |
|----------|--------|---------------|
| 🔴 Haute | Mapper colonnes `fibre_optique → tc_*` | 2-3h |
| 🔴 Haute | Valider domaines assainissement avec HKD | 1h |
| 🟡 Moyenne | Mapper colonnes `route → mob_*` | 2h |
| 🟡 Moyenne | Mapper colonnes `nature → en_*` | 1h |
| 🟡 Moyenne | Mapper colonnes `transport_public → tp_*` | 1h |
| 🟡 Moyenne | Mapper colonnes `ouvrages_speciaux → oa_*` | 1h |
| 🔴 Haute | Demander table POI à HKD | Dépend HKD |

### Questions pour HKD

1. **POI** : Création d'une table `pti_*` prévue ?
2. **Fibre** : Mapping `fibre_optique` → `tc_*` OK ?
3. **Domaines** : Liste exhaustive des valeurs acceptées ?
4. **Ouvrages** : Géométries L/P → S comment ?
5. **Couvercles** : Dans remarque chambre ou table séparée ?

---

## VOLUMÉTRIE ESTIMÉE

| Thématique | Nb objets estimé | Tables source |
|------------|------------------|---------------|
| Assainissement | ~30'000 | 6 tables |
| Fibre optique | ~5'000 ? | 12 tables/vues |
| Routes | ~2'000 ? | 10+ tables |
| Transports publics | ~100 ? | 3 tables |
| Nature | ~500 ? | 3 tables |
| Ouvrages spéciaux | ~50 ? | 4 tables |
| Points d'intérêt | ~200 ? | 3 tables (BLOQUÉ) |

**Total estimé : ~40'000 objets**

---

## PROCHAINES ÉTAPES

1. [ ] **Mapper fibre optique** : Créer `04_mapping_fibre_optique.md`
2. [ ] **Mapper routes** : Créer `05_mapping_routes.md`
3. [ ] **Mapper nature** : Créer `06_mapping_nature.md`
4. [ ] **Contacter HKD** : Questions domaines + POI
5. [ ] **Créer workbenches FME** : Un par thématique
6. [ ] **Tester sur échantillon** : 10 objets par type
