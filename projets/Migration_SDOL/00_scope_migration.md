# Migration SDOL - Scope et Périmètre

**Projet** : Migration des données Bussigny vers la base intercommunale SDOL (Carto Ouest)
**Date** : 2025-12-16
**Responsable** : Marc Zermatten

---

## Contexte

- **Source** : Base PostgreSQL Bussigny (srv-fme/Prod)
- **Cible** : Base PostgreSQL SDOL (postgres.hkd-geomatique.com/sdol)
- **Objectif** : Formater les données Bussigny pour intégration dans la structure SDOL

---

## Périmètre de migration

### ❌ EXCLU (géré collectivement par SDOL)

| Schéma | Tables | Raison |
|--------|--------|--------|
| `bdco` | 38 | Données cadastrales commandées par SDOL pour toutes les communes |
| `externe` | 4 | Données SEL (eau potable) gérées par SDOL |

### ✅ À MIGRER (données Bussigny)

| Schéma | Tables | Description |
|--------|--------|-------------|
| `assainissement` | 4 | Réseau d'assainissement (Bussigny gère) |
| `route` | 35 | Réseau routier, tronçons, arrêts TP |
| `divers` | 12 | Ouvrages spéciaux, transports publics |
| `nature` | 3 | Arbres, vergers, parcours nature |
| `pts_interet` | 3 | Points d'intérêt |
| `fibre_optique` | ? | **À INVENTORIER** - Réseau fibre optique |

**Total : ~57+ tables à migrer**

### ⚠️ À VÉRIFIER
- **Fibre optique** : Identifier les tables dans la base Bussigny et vérifier si SDOL a une structure cible correspondante

---

## Accès bases de données

### Base Bussigny (source)
- **Serveur** : srv-fme
- **Base** : Prod
- **Accès** : Direct depuis poste Marc

### Base SDOL (cible)
- **Serveur** : postgres.hkd-geomatique.com
- **Base** : sdol
- **Comptes** :
  - `by_lgr` : Lecture
  - `by_fme_w` : Écriture FME
- **Accès** : Via srv-fme uniquement (pgAdmin ou FME)

---

## Étapes de migration

1. [x] Analyser schéma Bussigny (source)
2. [ ] Analyser schéma SDOL (cible) - *en attente accès via srv-fme*
3. [ ] Créer mapping tables/colonnes source → cible
4. [ ] Identifier écarts et problèmes potentiels
5. [ ] Développer scripts de migration (FME ou SQL)
6. [ ] Valider avec tests et contrôles qualité
7. [ ] Migration de production

---

## Questions ouvertes

- [ ] Quelles autres thématiques sont prévues pour Carto Ouest ?
- [ ] Toutes les communes auront-elles les mêmes couches ?
- [ ] Fréquence de synchronisation (one-shot ou régulier) ?
- [ ] Qui valide côté SDOL après migration ?
