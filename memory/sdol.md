# Mémoire SDOL - Guichet Cartographique Intercommunal

## Dernière mise à jour
2025-12-08

---

## 1. Présentation du projet

### Objectif
Création d'un **guichet cartographique unique et mutualisé** pour les 8 communes de l'Ouest lausannois, remplaçant les géoportails communaux existants.

### Nom retenu (CONFIDENTIEL)
**"Carto Ouest"** - En attente de validation par le groupe décisionnel
- URL envisagée : `map.ouest-lausannois.ch` ou `carto.ouest-lausannois.ch`

### Plateforme technique
- **Outil** : GeoMapFish / Géocommunes (open source)
- **Prestataire** : HKD Géomatique Vaud SA (Gérard Sollberger)
- **Serveur** : PostgreSQL hébergé chez HKD à Nyon

---

## 2. Les 8 communes partenaires

| Commune | Représentant GT | Solution actuelle | Part budget (%) |
|---------|-----------------|-------------------|-----------------|
| Bussigny | Marc Zermatten (ex Ludovic Gauthier) | Solution personnelle (QGIS) | 13.4% |
| Chavannes-près-Renens | Donovan Menoud | Géocommunes | 11.2% |
| Crissier | Jacques Liaudet, Laurent Beyeler | Géoconcept (migration prévue) | 11.8% |
| Ecublens | Loïc Lair, Etienne Brajon | Géocommunes | 16.9% |
| Prilly | Grégoire Romailler, Diego Marin | Géomapfish | 11.9% |
| Renens | Simon Vogel | Géocommunes | 27.1% |
| Saint-Sulpice | David Conde, Mathieu Allaz | Géocommunes | 6.5% |
| Villars-Ste-Croix | Georges Cherix | Géocommunes | 1.3% |

---

## 3. Organisation et gouvernance

### Bureau SDOL
- **Benoît Bieler** : Directeur SDOL
- **Laurent Dutheil** : Chef de projets en mobilité (pilote le projet)
- **Madrine Collaud** : Secrétaire
- **Laurent Bovay** : Président SDOL

### Groupes de travail
- **GT (Groupe Technique)** : Représentants techniques des communes + POL + SDOL + HKD
- **GD (Groupe Décisionnel)** : Municipaux en charge + GT

### POL Ouest (Police)
- **Daniel Binggeli** : Sergent-major, police de proximité
- **Ludovic Marguet** : Gestionnaire administratif

---

## 4. Chronologie du projet

### 2022
- Octobre : Courrier du bureau SDOL aux Municipalités pour démarrer les réflexions

### 2023
- **20 janvier** : Création du GT, 1ère séance - audit de la situation
- **8 février** : 2ème séance GT
- **16 mars** : PV discuté, TVT décline le projet, HKD/Géocommunes sélectionné
- **24 avril** : 4ème séance GT
- **15-17 mai** : 5ème et 6ème séances GT
- **19 juin** : 7ème séance GT
- **28 août** : 8ème séance GT, version 3 de la note
- **2 octobre** : GD + GT réunis - Présentation aux 8 communes, décision d'utiliser Géocommunes

### 2024
- **18 janvier** : Courrier aux Municipalités pour validation (étude 65'000 CHF)
- **Février** : Retour des communes attendu pour le 21 février
- **Avril** : Démarrage du mandat HKD, 1ère séance GT 2024
- **Septembre** : 2ème séance GT 2024, état des lieux couches par couche
- **Octobre** : 3ème séance GT 2024
- **13 novembre** : GD Guichet Cartographique - Décision de lancement
- **28 novembre** : Offre HKD signée (OF24-1411)

### 2025
- **27 janvier** : Séance GT - Adjudications, couches, planning 2025
- **17 mars** : Séance GT - 75% avancement, propositions URL, logo Atelier Poisson
- **26 mai** : Séance GT - Normalisation thèmes (cimetière, stationnement)
- **8 décembre** : Séance GT - Abandon géoportails communaux acté
- **28 janvier 2026** : Prochaine séance GD (GT invité)

---

## 5. Aspects financiers

### Budget initial 2024 (étude)
- **Total** : 65'000 CHF TTC
- Réparti selon population des communes

### Coûts de mise en place (offre HKD nov. 2024)

| Poste | SDOL | Bussigny | Crissier |
|-------|------|----------|----------|
| Acquisition Géocommunes | - | 9'000 | 9'000 |
| Normalisation données | - | 2'304 | 5'542 |
| Développements (scripts, agrégation, géoportail) | 56'503 | - | - |
| **Total unique HT** | 56'503 | 11'304 | 14'542 |
| **Total unique TTC** | 61'079.75 | 12'219.60 | 15'719.90 |

### Maintenances annuelles

| Poste | SDOL | Autres communes |
|-------|------|-----------------|
| Maintenance géoportail | 10'000 | - |
| Maintenance base données | - | 2'200/commune |
| Frais serveur Postgres | - | 1'000/commune |
| **Total annuel HT** | 10'000 | 3'200/commune |

### Offre Bussigny (OF24-1411)
- **Signée le** : 13.01.2025
- **Total TTC** : 12'219.60 CHF
  - Normalisation données : 2'304 CHF
  - Acquisition Géocommunes : 9'000 CHF (déduit si déjà client)

---

## 6. Architecture technique

### Principes fondamentaux
1. **Guichet unique mutualisé** à l'échelle de l'Ouest lausannois
2. **Gestion des données reste communale** - seule la publication est mutualisée
3. **Outil GeoMapFish** (open source) retenu
4. **Gouvernance GT/GD** animée par le SDOL
5. **Deux niveaux d'accès** : données publiques + données internes employés
6. **Frais sur budget SDOL** répartis entre communes

### Flux de données
```
Communes (QGIS/autre) → Scripts normalisation → Schéma Postgres HKD → Agrégation → Géoportail régional
```

### Sources externes prévues
- Swisscom, TVT/SIE, Lausanne Eau, Lausanne Gaz, EPFL, UNIL
- Accès via conventions (en cours de négociation)
- TVT maintient sa demande de cloisonnement par commune

---

## 7. Couches et thématiques

### État des lieux (nov. 2024)
- ~40 couches identifiées
- Peu de disparités majeures entre communes
- Travail d'uniformisation en cours (3 ateliers GT)

### Couches principales par thème
| Thème | Couches | Nb communes |
|-------|---------|-------------|
| Assainissement | Cadastre canalisations, historisation | 8 |
| Aménagement territoire | Affectation sol, lisières forestières | 6 |
| Cadastre | Cadastre projeté, gestion arbres | 6 |
| Environnement | Gestion arbres | 5 |
| Patrimoine communal | Parcelles et bâtiments | 5 |
| Imagerie | Orthophoto drone | 4 |
| Mobilité | État chaussée, classification routes | 4 |
| Stationnement | Places (sans durée) | 4 |
| Cimetière | Gestion sépultures, contrats | 3 |
| Équipement public | Mobilier urbain, déchets | 3 |

### Décisions importantes
- **Stationnement** : Durée NON représentée graphiquement (trop de variantes)
- **Format impression** : Maximum A3 (serveur limité)

---

## 8. Contraintes et décisions clés

### Décisions actées
- Les Municipalités ont décidé PAR ÉCRIT d'abandonner les géoportails communaux
- Logo validé par le GT (ajustements mineurs)
- Format d'impression limité au A3

### Problématiques en cours
- **TVT** : Maintient demande de cloisonnement des données réseaux
- **Budget 2026** : Pas prévu pour développement de nouvelles couches
- Si une commune développe une couche, elle "paie" pour les 7 autres

### Recommandations HKD
| Mode | Avantages | Inconvénients |
|------|-----------|---------------|
| WMS | Toujours à jour | Image uniquement |
| Données en base | Exploitables | Pas garanties à jour |

Pour données fraîches réseaux → www.plans-reseaux.ch

---

## 9. Orthophoto 2026

| Élément | Détail |
|---------|--------|
| Mandat | Adjugé à Elimap |
| Appel d'offres | 5 offres reçues, moins-disant retenu |
| Budget | Inscrit budget SDOL 2025 |
| Technologie | Drone pentacam |
| Vol été 2025 | Uzufly (réalisé) |
| Vol orthophoto | Mars 2026 (Elimap) |

---

## 10. Actions Bussigny

### À faire
- [ ] Remonter besoins en échelles d'affichage/impression à HKD
- [ ] Participer à définition coût type développement couche
- [ ] Réfléchir aux thématiques prioritaires

### À surveiller
- Réception projet de communication SDOL par e-mail
- Informations vol orthophoto par e-mail
- Évolution négociations TVT

---

## 11. Contacts utiles

### HKD Géomatique
- **Gérard Sollberger**
- Tél : +41 22 361 18 28
- Email : vaud@hkd-geomatique.com
- Adresse : Chemin de la Vuarpillière 35, 1260 Nyon

### Bureau SDOL
- Tél : 021 632 71 60
- Email : sdol@ouest-lausannois.ch
- Web : www.ouest-lausannois.ch
- Adresse : Rue de Lausanne 35, 1020 Renens

---

## 12. Documents de référence

### Emplacement
`M:\7-Infra\0-Gest\3-Geoportail\7030_Gen\70301_Geoportail_Regional\`

### Documents clés
- `Etude de faisabilité et note de cadrage_Guichet carto_vf.pdf` - Note fondatrice
- `Offre_HKD_241128_signée.pdf` - Offre globale signée
- `Offre OF24-1411.pdf` - Offre spécifique Bussigny
- `2024_11_13_GD_GuichetCarto_v1.pdf` - Présentation GD novembre 2024
- `PR24-0281-*` - Rapports méthodologie et chiffrage

### Base légale
- LGéo (Loi fédérale sur la géoinformation)
- LGéo-VD (Loi cantonale sur la géoinformation)
- Art. 14 LGéo-VD : Accès mutuel aux géodonnées entre autorités

---

*Synthèse générée par GeoBrain le 8 décembre 2025*
