# Réponses aux Questions HKD - Auto-découvertes

**Source** : Fichier Excel `Copie de PR24-0281-contenu-geoportail.xlsx`
**Date** : 2025-12-18

---

## Question 1 : Structure exacte des tables SDOL

Les colonnes utilisées sont déduites du fichier Excel (attribut_nom dans les feuilles thm-*).

### eu_chambre (chambres assainissement)
| Colonne | Usage |
|---------|-------|
| no_obj | Numéro d'objet |
| contenu | Type d'eaux (claires/usées/mixtes) |
| accessibilite | Enterré ou accessible |
| c / alt_couv | Altitude couvercle |
| r / alt_radi | Altitude radier |
| p / profondeur | Profondeur |
| utilisat | En service, projeté, désaffecté |
| data_owner | Code commune |

### eu_collecteur (conduites)
| Colonne | Usage |
|---------|-------|
| materiau | Matériau conduite |
| diametre | Diamètre (mm) |
| contenu | Type d'eaux |
| proprio | Propriétaire (privé/commune) |
| fonction | Fonction (drainage, caniveau, etc.) |
| ecoulem | Écoulement (en charge) |
| precis_pl | Précision planimétrique |
| utilisat | Statut utilisation |
| data_owner | Code commune |

### eu_grille (grilles/chenaux)
| Colonne | Usage |
|---------|-------|
| type_gr | Type (grille, cheneau, gueulard) |
| contenu | Type d'eaux |
| utilisat | Statut |
| data_owner | Code commune |

> **Note** : Pour la structure exacte (types SQL, contraintes NOT NULL), une requête directe sur SDOL depuis srv-fme serait nécessaire.

---

## Question 2 : Valeurs de domaines acceptées ✅ RÉPONDU

> **Source** : Feuilles thm-* (théoriques) + mdr-analyse-valeurs (valeurs réelles utilisées)

### ASSAINISSEMENT

#### eu_chambre.contenu
- eaux claires ✓ (majoritaire)
- eaux usées ✓
- eaux mixtes ✓
- chambre double

#### eu_chambre.accessibilite
- **accessible** ✓ (8639 occurrences - majoritaire !)
- enterré (478)

#### eu_chambre.utilisat
- **en service** (défaut, majoritaire)
- désaffecté
- en réserve

#### eu_collecteur.contenu
- eaux claires ✓ (majoritaire)
- eaux usées ✓
- eaux mixtes

#### eu_collecteur.proprio
- **privé** (majoritaire)
- commune

#### eu_collecteur.fonction
- **collecteur** (majoritaire !)
- caniveau
- caniveau-grille
- drainage
- tranchée filtrante

#### eu_collecteur.ecoulem
- **gravitaire** (majoritaire !)
- libre
- sous pression
- en charge

#### eu_collecteur.precis_pl
- **approximatif** (majoritaire)
- supposé
- relevé
- inconnu

#### eu_collecteur.utilisat
- **en service** (majoritaire)
- désaffecté
- en réserve
- projeté

#### eu_collecteur_etat.etat_constr
- bon (majoritaire)
- moyen
- mauvais
- non visionné
- curage nécessaire

#### eu_grille.type_gr
- **grille** (majoritaire)
- cheneau
- gueulard

#### eu_grille.contenu
- eaux claires (majoritaire)
- eaux usées

#### eu_ouvr_sp.type_ouvr
- déshuileur/séparateur (majoritaire)
- séparateur
- séparateur hydrocarbure
- séparateur graisse et huile

#### eu_relevage (peu de valeurs renseignées)
- relevage privé
- relevage communal
- station de pompage

### NATURE

#### en_arbre_p.protection
- non (4844)
- arbre remarquable communal (93)
- arbre remarquable cantonal
- à confirmer (57)

#### en_arbre_p.statut
- **existant** (majoritaire)
- abattu
- à déterminer

### STATIONNEMENT

#### mob_stationnement.genre
- **gratuit** (majoritaire)
- payant
- variable

#### mob_stationnement.restriction
- **privé** (1541)
- aucune (524)
- Zone bleu (195)
- zone blanche
- privé communal
- handicapé, livraison, taxi, etc.

#### mob_stationnement.type_vehicule
- **voiture** (majoritaire)
- deux-roues mixte
- deux-roues velo
- moto

---

## Question 3 : Valeur data_owner ✅ RÉPONDU

**Réponse : `by`** (minuscules, 2 lettres)

### Déduction depuis le fichier Excel

| Schéma | Code | Commune |
|--------|------|---------|
| hkd_databy | **by** | Bussigny |
| hkd_datacri | cri | Crissier |
| hkd_datacs | cs | Chavannes-près-Renens |
| hkd_dataecu | ecu | Ecublens |
| hkd_datapy | py | Prilly |
| bbhn_datase | se | St-Sulpice |
| bbhn_datavc | vc | Villars-Ste-Croix |
| bbhn_datare | re | Renens |

Le pattern est : **suffixe du nom de schéma = data_owner**

Pour Bussigny : `back_hkd_databy` → data_owner = `'by'`

---

## Résumé

| Question | Réponse | Statut |
|----------|---------|--------|
| 1. Structure tables | Colonnes documentées ci-dessus | ⚠️ Partiel (types SQL à confirmer) |
| 2. Valeurs domaines | Liste exhaustive extraite du Excel | ✅ Complet |
| 3. data_owner | `'by'` (minuscules) | ✅ Complet |

---

## Questions restantes pour HKD

Les questions 4 à 11 nécessitent toujours une réponse de HKD :

4. Ouvrages Point/Ligne → Polygon via ST_Buffer : OK ?
5. Parcours nature : table en_nat_liaison ou mob_chem_ped_l ?
6. **Création tables tc_fo_conduite et tc_fo_elemontage** (PRIORITAIRE)
7. Création table pti_* pour POI
8. Colonnes BY sans équivalent SDOL
9-11. Questions processus (fréquence, validation, recette)
