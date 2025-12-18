# RAPPORT COMPLET - Migration Bussigny → SDOL

**Date** : 2025-12-18
**Projet** : Intégration données Bussigny au géoportail intercommunal Ouest Lausannois
**Responsable** : Marc Zermatten, Responsable géodonnées et SIT
**Prestataire SDOL** : HKD Géomatique

---

## 1. CONTEXTE ET OBJECTIF

### 1.1 Situation actuelle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SOURCES BUSSIGNY                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Oracle srv-sai          PostgreSQL srv-fme                                 │
│  (historique)            (copie locale)                                     │
│  - Assainissement   ───► assainissement.*                                   │
│  - Fibre optique    ───► fibre_optique.*                                    │
│                          route.*, nature.*, ouvrages_speciaux.*             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ FME (migration ponctuelle)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CIBLE SDOL                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL postgres.hkd-geomatique.com/sdol                                │
│  Schéma : back_hkd_databy                                                   │
│  - eu_chambre, eu_collecteur         (assainissement)                       │
│  - tc_conduite, tc_elemontage        (fibre optique)                        │
│  - mob_rte_*, mob_stationnement      (routes)                               │
│  - tp_bus_*, tp_train_*              (transports publics)                   │
│  - en_arbre_p, en_nat_liaison        (nature)                               │
│  - oa_ouvart_s                       (ouvrages d'art)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Objectif

Alimenter la base de données SDOL avec les géodonnées communales de Bussigny pour leur diffusion via le géoportail intercommunal Carto Ouest (GeoMapFish).

### 1.3 Accès base SDOL

| Paramètre | Valeur |
|-----------|--------|
| Host | postgres.hkd-geomatique.com |
| Port | 5432 |
| Database | sdol |
| Schéma | back_hkd_databy |
| User écriture | by_fme_w |
| Accès | Depuis srv-fme uniquement (IP whitelistée) |

---

## 2. PÉRIMÈTRE DE MIGRATION

### 2.1 Thématiques incluses

| # | Thématique | Schéma source | Tables source | Tables SDOL cibles | Fichier mapping |
|---|------------|---------------|---------------|-------------------|-----------------|
| 1 | **Assainissement** | assainissement | 4+ tables | eu_chambre, eu_collecteur, eu_grille, etc. | mapping_bussigny_sdol.md |
| 2 | **Nature** | nature | 2 tables | en_arbre_p | 05_mapping_nature.md |
| 3 | **Routes** | route | 10+ tables | mob_rte_classe_tr, mob_rte_etat_tr, mob_stationnement | 06_mapping_routes.md |
| 4 | **Transports publics** | route | 3 tables | tp_bus_s, tp_bus_l, tp_train_* | 07_mapping_transports_publics.md |
| 5 | **Ouvrages d'art** | ouvrages_speciaux | 3 tables (L/P/S) | oa_ouvart_s | 08_mapping_ouvrages_art.md |

### 2.2 Thématiques exclues

| Thématique | Raison |
|------------|--------|
| **Eau potable** | Géré par SEL / SDOL directement |
| **Cadastre (BDCO)** | Commandé collectivement par SDOL |
| **Swisscom** | Données via WMS, pas de données locales |

### 2.3 Thématiques bloquées

| Thématique | Problème | Action requise |
|------------|----------|----------------|
| **Fibre optique** | Les tables tc_* sont réservées à Swisscom (tc_swisscom_conduite, tc_swisscom_elemontage). Aucune table pour fibre communale. | **Demander création tables tc_fo_conduite, tc_fo_elemontage à HKD** |
| **Points d'intérêt** | Aucune table équivalente dans SDOL | **Demander création table pti_* à HKD** |

---

## 3. SYNTHÈSE DES MAPPINGS

### 3.1 Assainissement (le plus détaillé)

| Source BY | Cible SDOL | Nb colonnes mappées | Domaines à valider |
|-----------|------------|---------------------|-------------------|
| by_ass_chambre | eu_chambre | 27 | propriétaire, état, matériau, genre, fonction |
| by_ass_collecteur | eu_collecteur | 22 | propriétaire, état, matériau, fonction, profil |

**Script SQL** : Draft disponible dans le fichier de mapping.

### 3.2 Fibre optique - BLOQUÉ

> **⚠️ PROBLÈME** : Les tables SDOL `tc_swisscom_conduite` et `tc_swisscom_elemontage` sont réservées à Swisscom.
> Il n'existe aucune table pour la fibre optique communale.
> **Action** : Demander à HKD la création de tables `tc_fo_conduite` et `tc_fo_elemontage`.

Mapping préparé (en attente des tables) :
| Source BY | Type géométrie | Cible proposée |
|-----------|----------------|----------------|
| fo_segment, fo_tube_geo, fo_cable_geo | LineString | tc_fo_conduite |
| fo_chambre, fo_armoire, fo_manchon, fo_point_livraison | Point | tc_fo_elemontage |

### 3.3 Nature

| Source BY | Cible SDOL | Notes |
|-----------|------------|-------|
| by_nat_arbre_vergers | en_arbre_p | Arbres remarquables |
| by_nat_parcours_nature | en_nat_liaison | Parcours nature (ou mob_chem_ped_l ?) |

### 3.4 Routes

| Source BY | Cible SDOL | Notes |
|-----------|------------|-------|
| by_rte_troncon | mob_rte_classe_tr | Classification routes |
| by_rte_troncon | mob_rte_etat_tr | État des routes (indices I1) |
| by_rte_vitesse | mob_rte_restri_tr | Limitations de vitesse |
| by_rte_zone_* | mob_stationnement | Zones de stationnement |

### 3.5 Transports publics

| Source BY | Cible SDOL | Notes |
|-----------|------------|-------|
| by_transport_public_a | tp_bus_s | Arrêts |
| by_transport_public_l | tp_bus_l | Lignes |
| by_transport_public_s | tp_bus_s / tp_train_s | Stations |

### 3.6 Ouvrages d'art

| Source BY | Cible SDOL | Transformation géométrique |
|-----------|------------|---------------------------|
| by_ouvrages_speciaux_s | oa_ouvart_s | Direct (Polygon) |
| by_ouvrages_speciaux_p | oa_ouvart_s | ST_Buffer (Point → Polygon) |
| by_ouvrages_speciaux_l | oa_ouvart_s | ST_Buffer (Line → Polygon) |

---

## 4. VOLUMÉTRIE ESTIMÉE

| Thématique | Nb objets estimé | Tables source | Statut |
|------------|------------------|---------------|--------|
| Assainissement | ~30'000 | 6 tables | ✅ OK |
| Routes | ~2'000 | 10+ tables | ✅ OK |
| Transports publics | ~100 | 3 tables | ✅ OK |
| Nature | ~500 | 2 tables | ✅ OK |
| Ouvrages d'art | ~50 | 3 tables | ✅ OK |
| Fibre optique | ~5'000 | 7 tables géo | ⚠️ **BLOQUÉ** - tables à créer |
| Points d'intérêt | ~200 | 1 table | ⚠️ **BLOQUÉ** - table à créer |

**Total migrables immédiatement : ~32'650 objets**
**En attente création tables : ~5'200 objets**

---

## 5. QUESTIONS POUR HKD

### 5.1 Validation des structures

| # | Question | Thématique |
|---|----------|------------|
| 1 | Structure exacte des tables SDOL (colonnes, types, contraintes) ? | Toutes |
| 2 | Liste exhaustive des valeurs de domaines acceptées ? | Assainissement, FO |
| 3 | Valeur data_owner : 'BY' ou 'Bussigny' ou code OFS ? | Toutes |

### 5.2 Conversions géométriques

| # | Question | Thématique |
|---|----------|------------|
| 4 | Ouvrages Point/Ligne → Polygon via ST_Buffer : OK ? | Ouvrages d'art |
| 5 | Parcours nature : table en_nat_liaison ou mob_chem_ped_l ? | Nature |

### 5.3 Tables manquantes (PRIORITAIRE)

| # | Question | Thématique |
|---|----------|------------|
| 6 | **Création de tables tc_fo_conduite et tc_fo_elemontage** pour la fibre optique communale ? Les tables tc_swisscom_* ne conviennent pas. | Fibre optique |
| 7 | Création d'une table pti_* pour les points d'intérêt ? | POI |
| 8 | Colonnes BY sans équivalent SDOL : ignorer ou stocker dans remarque ? | Toutes |

### 5.4 Processus

| # | Question |
|---|----------|
| 8 | Fréquence de synchronisation : one-shot ou périodique ? |
| 9 | Qui valide après migration ? |
| 10 | Procédure de test/recette ? |

---

## 6. PROCHAINES ÉTAPES

### Phase 1 : Validation (en attente HKD)
- [ ] Envoyer ce rapport à HKD
- [ ] Obtenir réponses aux questions
- [ ] Valider domaines de valeurs
- [ ] Confirmer création table POI

### Phase 2 : Développement
- [ ] Finaliser scripts SQL de migration
- [ ] Créer workbenches FME (1 par thématique)
- [ ] Tester sur échantillons (10 objets par type)

### Phase 3 : Migration
- [ ] Migration données de test
- [ ] Validation visuelle dans Carto Ouest
- [ ] Migration complète
- [ ] Documentation post-migration

---

## 7. FICHIERS DE RÉFÉRENCE

| Fichier | Contenu |
|---------|---------|
| `00_reference_sdol_excel.md` | **Tables et domaines SDOL** (extrait Excel HKD) |
| `00_scope_migration.md` | Périmètre et contexte |
| `01_schema_bussigny.md` | Structure base source |
| `02_mapping_exhaustif.md` | Inventaire initial |
| `03_mapping_complet_final.md` | Synthèse globale |
| `mapping_bussigny_sdol.md` | **Assainissement** (détaillé) |
| `04_mapping_fibre_optique.md` | **Fibre optique** (BLOQUÉ) |
| `05_mapping_nature.md` | **Nature** |
| `06_mapping_routes.md` | **Routes** |
| `07_mapping_transports_publics.md` | **Transports publics** |
| `08_mapping_ouvrages_art.md` | **Ouvrages d'art** |

**Source Excel HKD** : `docs/Mapping/Copie de PR24-0281-contenu-geoportail.xlsx`

---

## 8. CONTACTS

| Rôle | Nom | Organisation |
|------|-----|--------------|
| Responsable projet | Marc Zermatten | Commune de Bussigny |
| Prestataire géoportail | HKD Géomatique | SDOL |
| Pilotage intercommunal | SDOL | Ouest Lausannois |

---

*Rapport généré le 2025-12-18 par GeoBrain*
