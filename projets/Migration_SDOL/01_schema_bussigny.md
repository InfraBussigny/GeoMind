# Schéma Base de Données Bussigny (Source)

**Connexion** : SRV-FME PostgreSQL (srv-fme/Prod)
**Date d'extraction** : 2025-12-16

## Résumé

| Schéma | Nb Tables | Description |
|--------|-----------|-------------|
| bdco | 38 | Base de Données Cadastre Ouest - données cadastrales |
| route | 35 | Réseau routier, tronçons, arrêts TP |
| divers | 12 | Ouvrages spéciaux, transports publics |
| assainissement | 4 | Réseau d'assainissement |
| externe | 4 | Données externes (SEL eau potable) |
| nature | 3 | Nature, arbres, vergers |
| pts_interet | 3 | Points d'intérêt |
| **TOTAL** | **100** | |

---

## Schéma: assainissement

| Table | Colonnes | Description |
|-------|----------|-------------|
| by_ass_chambre | 39 | Chambres de visite |
| by_ass_chambre_detail | 5 | Détails des chambres |
| by_ass_collecteur | 43 | Collecteurs (conduites) |
| by_ass_couvercle | 14 | Couvercles |

---

## Schéma: bdco

| Table | Colonnes | Description |
|-------|----------|-------------|
| bdco_adresse_entree | 7 | Entrées d'adresses |
| bdco_adresse_entree_label | 7 | Labels entrées |
| bdco_adresse_lieudit_surf | 7 | Lieux-dits (surfaces) |
| bdco_adresse_npa_surf | 5 | NPA (surfaces) |
| bdco_adresse_rue_label | 7 | Labels rues |
| bdco_adresse_rue_lin | 7 | Rues (linéaire) |
| bdco_batiment | 9 | Bâtiments |
| bdco_batiment_label | 7 | Labels bâtiments |
| bdco_batiment_souterrain | 6 | Bâtiments souterrains |
| bdco_batiment_souterrain_label | 7 | Labels bât. souterrains |
| bdco_couvert | 6 | Couverts |
| bdco_couvert_label | 7 | Labels couverts |
| bdco_cs_bois | 7 | Couverture sol - bois |
| bdco_cs_divers | 7 | Couverture sol - divers |
| bdco_cs_dur | 7 | Couverture sol - dur |
| bdco_cs_eau | 7 | Couverture sol - eau |
| bdco_cs_label | 6 | Labels couverture sol |
| bdco_cs_vert | 7 | Couverture sol - vert |
| bdco_ddp | 9 | Droits distincts permanents |
| bdco_ddp_label | 6 | Labels DDP |
| bdco_limite_commune_lin | 2 | Limite commune (linéaire) |
| bdco_limite_commune_surf | 8 | Limite commune (surface) |
| bdco_liste_parcelle_communale | 4 | Liste parcelles communales |
| bdco_objet_divers_label | 6 | Labels objets divers |
| bdco_objet_divers_lin | 6 | Objets divers (linéaire) |
| bdco_objet_divers_surf | 7 | Objets divers (surface) |
| bdco_parcelle | 9 | Parcelles |
| bdco_parcelle_label | 6 | Labels parcelles |
| bdco_point_fixe_1 | 14 | Points fixes cat. 1 |
| bdco_point_fixe_2 | 14 | Points fixes cat. 2 |
| bdco_point_fixe_3 | 14 | Points fixes cat. 3 |
| bdco_point_limite | 12 | Points limites |
| by_batiment_projete | 10 | Bâtiments projetés |
| by_nom_rue_label | 8 | Labels noms de rue |
| by_numero_entree_label | 13 | Labels numéros entrée |
| by_objet_divers_lin | 3 | Objets divers linéaires |
| by_val_etat_avancement | 5 | Valeurs état avancement |
| by_val_genre_bat_proj | 5 | Valeurs genre bât. projeté |

---

## Schéma: divers

| Table | Colonnes | Description |
|-------|----------|-------------|
| by_ouvrage_speciaux_l | 12 | Ouvrages spéciaux (linéaire) |
| by_ouvrage_speciaux_p | 12 | Ouvrages spéciaux (point) |
| by_ouvrage_speciaux_s | 12 | Ouvrages spéciaux (surface) |
| by_ouvrage_speciaux_situ | 8 | Situation ouvrages spéciaux |
| by_transport_public_a | 7 | Transports publics (arrêts) |
| by_transport_public_a_l | 8 | TP arrêts (linéaire) |
| by_transport_public_l | 9 | TP lignes |
| by_transport_public_s | 4 | TP surfaces |
| by_val_tp_exploitant | 7 | Valeurs exploitant TP |
| by_val_tp_type_ligne | 5 | Valeurs type ligne TP |
| by_val_type_ouvrage | 5 | Valeurs type ouvrage |

---

## Schéma: externe

| Table | Colonnes | Description |
|-------|----------|-------------|
| by_ass_couvercle | 14 | Couvercles assainissement |
| sel_conduite | 15 | Conduites SEL (eau potable) |
| sel_hydrant | 22 | Hydrants |
| sel_vanne | 15 | Vannes |

---

## Schéma: nature

| Table | Colonnes | Description |
|-------|----------|-------------|
| by_nat_arbre_vergers | 5 | Arbres et vergers |
| by_nat_parcours_nature | 6 | Parcours nature |
| by_val_genre_vergers | 5 | Valeurs genre vergers |

---

## Schéma: pts_interet

| Table | Colonnes | Description |
|-------|----------|-------------|
| by_pti_point_interet | 9 | Points d'intérêt |
| by_pti_val_theme | 5 | Valeurs thèmes |
| by_pti_val_type_point | 6 | Valeurs types de points |

---

## Schéma: route

| Table | Colonnes | Description |
|-------|----------|-------------|
| by_rte_arret_tp | 11 | Arrêts transports publics |
| by_rte_comptage | 5 | Comptages routiers |
| by_rte_entretien | 5 | Entretien routes |
| by_rte_etat_troncon | 8 | État des tronçons |
| by_rte_ouvrage_ponctuel | 5 | Ouvrages ponctuels |
| by_rte_parcours_velo | 7 | Parcours vélo |
| by_rte_rel_troncon_comptage | 3 | Relation tronçon-comptage |
| by_rte_rel_troncon_entretien | 3 | Relation tronçon-entretien |
| by_rte_rel_troncon_etat | 3 | Relation tronçon-état |
| by_rte_rel_troncon_tp | 3 | Relation tronçon-TP |
| by_rte_rel_troncon_travaux | 3 | Relation tronçon-travaux |
| by_rte_tp | 5 | Transports publics |
| by_rte_travaux | 13 | Travaux routiers |
| by_rte_troncon | 24 | Tronçons routiers |
| by_rte_val_* | 5 | Tables de valeurs (19 tables) |
| by_rte_vitesse | 6 | Vitesses |
| by_rte_zone_parc | 4 | Zones de parcage |
| by_rte_zone_stationnement | 9 | Zones de stationnement |

---

## Nomenclature observée

### Préfixes
- `bdco_` : Données cadastrales standards (BDCO)
- `by_` : Données spécifiques Bussigny
- `sel_` : Données SEL (eau potable)

### Suffixes géométriques
- `_lin` ou `_l` : Géométrie linéaire
- `_surf` ou `_s` : Géométrie surfacique
- `_p` : Géométrie ponctuelle
- `_label` : Labels/étiquettes

### Tables de valeurs
- `by_val_*` : Tables de domaines/listes de valeurs
