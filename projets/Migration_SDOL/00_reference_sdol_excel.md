# Référence SDOL - Extrait du fichier Excel HKD

**Source** : `docs/Mapping/Copie de PR24-0281-contenu-geoportail.xlsx`
**Date extraction** : 2025-12-18

---

## 1. TABLES SDOL DISPONIBLES

### EU - Assainissement (23 tables)
| Table | Description |
|-------|-------------|
| eu_bassin_versant | Bassins versants |
| eu_ce_tr | Cours d'eau tronçon |
| eu_chambre | Chambres/regards |
| eu_collecteur | Collecteurs (conduites) |
| eu_collecteur_action | Actions sur collecteurs |
| eu_collecteur_etat | État des collecteurs |
| eu_constr_l | Constructions linéaires |
| eu_constr_p | Constructions ponctuelles |
| eu_constr_s | Constructions surfaciques |
| eu_defaut | Défauts |
| eu_deversoir | Déversoirs |
| eu_ecp_p | Points ECP |
| eu_elemontage | Éléments de montage |
| eu_evac_par | Évacuation parcellaire |
| eu_exutoire | Exutoires |
| eu_fontaine | Fontaines |
| eu_grille | Grilles |
| eu_install_infilt | Installations infiltration |
| eu_ouvr_sp | Ouvrages spéciaux |
| eu_relevage | Stations de relevage |
| eu_retention | Rétentions ponctuelles |
| eu_retention_s | Rétentions surfaciques |
| eu_sous_bv | Sous-bassins versants |
| eu_zone_infiltration | Zones infiltration |
| eu_zone_inondable | Zones inondables |

### MOB - Mobilité (14 tables)
| Table | Description |
|-------|-------------|
| mob_chem_ped_comm_l | Chemins piétons communaux |
| mob_parcours_cyclable | Parcours cyclables |
| mob_rte_classe_s | Routes - classification (surface) |
| mob_rte_classe_s_action | Actions routes surface |
| mob_rte_classe_s_etat | État routes surface |
| mob_rte_classe_tr | Routes - classification (tronçon) |
| mob_rte_entretien_tr | Entretien routes |
| mob_rte_etat_p | État ponctuel routes |
| mob_rte_etat_tr | État tronçons routes |
| mob_rte_neige_tr | Déneigement |
| mob_rte_restri_tr | Restrictions (vitesse, etc.) |
| mob_rte_signal_p | Signalisation ponctuelle |
| mob_stationnement | Zones de stationnement |
| mob_velo_station | Stations vélo |

### TC - Télécom (2 tables - SWISSCOM UNIQUEMENT)
| Table | Description |
|-------|-------------|
| tc_swisscom_conduite | Conduites Swisscom |
| tc_swisscom_elemontage | Éléments montage Swisscom |

> **⚠️ ATTENTION** : Pas de table pour la fibre optique communale !

### EN - Environnement/Nature (10 tables)
| Table | Description |
|-------|-------------|
| en_arbre_action | Actions sur arbres |
| en_arbre_etat | État des arbres |
| en_arbre_nom | Noms d'arbres |
| en_arbre_p | Arbres (points) |
| en_arbre_s | Arbres (surfaces/couronnes) |
| en_citerne | Citernes |
| en_courbes_niveau | Courbes de niveau |
| en_imns_l | IMNS linéaires |
| en_imns_s | IMNS surfaciques |
| en_reserve_faune | Réserves faune |

### TP - Transports publics (4 tables)
| Table | Description |
|-------|-------------|
| tp_bus_l | Lignes de bus |
| tp_bus_s | Arrêts de bus |
| tp_train_l | Lignes de train |
| tp_train_s | Arrêts de train |

### OA - Ouvrages d'art (2 tables)
| Table | Description |
|-------|-------------|
| oa_ouvart_s | Ouvrages d'art (surface) |
| oa_ouvart_s_etat | État ouvrages d'art |

### EQP - Équipements (5 tables)
| Table | Description |
|-------|-------------|
| eqp_dechet_tournee_tr | Tournées déchets |
| eqp_objet_mobilier_urbain | Mobilier urbain |
| eqp_panneau_affichage | Panneaux affichage |
| eqp_point_collecte | Points de collecte |
| eqp_secteur_collecte | Secteurs collecte |

### EV - Espaces verts (3 tables)
| Table | Description |
|-------|-------------|
| ev_point | Points espaces verts |
| ev_site | Sites espaces verts |
| ev_surface | Surfaces espaces verts |

---

## 2. VALEURS DE DOMAINES SDOL

### 2.1 Assainissement

**eu_chambre.contenu**
- eaux claires
- eaux usées
- eaux mixtes
- chambre double

**eu_chambre.accessibilite**
- enterré

**eu_collecteur.contenu**
- eaux claires
- eaux usées
- eaux mixtes

**eu_collecteur.proprio**
- privé
- commune
- (autre)

**eu_collecteur.fonction**
- drainage
- caniveau
- tranchée filtrante

**eu_collecteur.ecoulem**
- en charge

**eu_collecteur.utilisat**
- projeté
- désaffecté

**eu_collecteur.precis_pl**
- relevé

**eu_grille.type_gr**
- grille
- cheneau
- gueulard

**eu_relevage.type_relevage**
- relevage privé
- relevage communal
- station de pompage

**eu_ouvr_sp.type_ouvr**
- séparateur hydrocarbure
- séparateur graisse et huile

**eu_install_infilt.type_inst**
- superficielle
- profonde

**eu_retention_s.type_retention**
- rétention ouvrage
- rétention toiture
- rétention noue

**eu_evac_par.racc_conf**
- conforme
- conforme avec remarque
- non conforme mineur
- non conforme
- non conforme pollution
- à contrôler
- sans contrôle

**eu_collecteur_etat.etat_constr**
- bon
- moyen

### 2.2 Nature / Environnement

**en_arbre_p.protection**
- arbre remarquable communal
- arbre remarquable cantonal

**en_arbre_p.statut**
- existant
- abattu

### 2.3 Mobilité / Stationnement

**mob_stationnement.situation**
- public
- privé

**mob_stationnement.genre**
- gratuit
- payant
- variable

**mob_stationnement.restriction**
- variable
- handicapé
- livraison
- taxi
- mobility
- p+r
- réservé services publics
- véhicule électrique
- aucune

**mob_stationnement.type_vehicule**
- voiture
- voiture électrique
- moto
- vélo
- vélo-moto
- car
- poids-lourds

### 2.4 Équipements

**eqp_objet_mobilier_urbain.type**
- abri bus
- banc
- table
- poubelle
- robidog
- fontaine
- bac à matériaux

**eqp_panneau_affichage.type_affichage**
- informations
- événement
- publicitaire
- autre

**eqp_point_collecte.type_collecte**
- déchetterie
- écopoint

**eqp_point_collecte.type_dechet**
- PET
- aluminium
- verre
- papier
- fer
- vêtement
- huile
- café
- déchet vert
- ordures ménagères

### 2.5 Espaces verts

**ev_surface.type_surf**
- gazon
- prairie fleurie/sèche
- haie/bosquet
- aménagement avec fleurs, vivaces, graminées
- potager urbain
- jardin familial
- réalisation spécifique

**ev_surface.type_entretien**
- normal
- extensif
- intensif
- synthétique

---

## 3. PROBLÈMES IDENTIFIÉS

### 3.1 Tables manquantes pour Bussigny

| Thématique | Problème | Action |
|------------|----------|--------|
| **Fibre optique** | Aucune table TC pour fibre communale (seulement Swisscom) | **Demander création tables tc_fo_* à HKD** |
| **Points d'intérêt** | Aucune table POI existante | **Demander création table pti_* à HKD** |

### 3.2 Schéma Bussigny

Le schéma pour Bussigny est : `back_hkd_databy` (préfixe `hkd_databy` ou `by`)

Actuellement, Bussigny n'a des données que dans :
- ad_entree_rcb (adresses)
- at_* (aménagement territoire)
- dn_* (divers)
- en_* (environnement - partiel)
- mo_* (mensuration officielle)
- tp_* (transports publics)
- vd* (données cantonales)

Manquent pour Bussigny :
- eu_* (assainissement) → à migrer
- mob_* (mobilité/routes) → à migrer
- tc_* (fibre) → tables à créer puis migrer
- oa_* (ouvrages art) → à migrer

---

*Document généré automatiquement depuis le fichier Excel HKD*
