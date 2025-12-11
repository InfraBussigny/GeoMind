# Plan des servitudes - Parcelle 791
## Chemin du Cèdre 35, Bussigny

---

## Fichiers du projet

| Fichier | Description |
|---------|-------------|
| `servitudes_791.qgs` | Projet QGIS principal |
| `creer_couches_servitudes.py` | Script PyQGIS pour créer les couches |
| `README_PROCEDURE.md` | Ce document |

---

## Servitudes identifiées

### Parcelle 791 comme **SERVANT** (grevée)

| ID | Type | Date | Bénéficiaire | Plan |
|----|------|------|--------------|------|
| 010-2002/004259 | Canalisations eau/égout | 16.06.1955 | Commune Bussigny | Bleu/rouge tiretés |
| 010-2003/001959 | Passage pied et char | 29.06.1912 | BF 757 | Jaune |
| 007-2013/002286 | Passage pied et véhicules | 30.07.2013 | BF 3417 | Bleu |
| 007-2013/002287 | Canalisations quelconques | 30.07.2013 | BF 3417 | Non défini |

### Parcelle 791 comme **BÉNÉFICIAIRE** (ayant droit)

| ID | Type | Date | Fonds servant | Plan |
|----|------|------|---------------|------|
| 010-2001/003598 | Passage pied, véhicules, canalisations | 31.10.1940 | Quartier Lavanchy | Jaune |
| 010-2003/003622 | Passage à pied | 14.07.1934 | BF 1615 | Toute la surface |

---

## Procédure de création du plan

### Étape 1 : Ouvrir le projet QGIS

1. Ouvrir QGIS 3.x
2. Fichier > Ouvrir > `servitudes_791.qgs`
3. Le projet charge automatiquement les couches WMS du cadastre VD

### Étape 2 : Géoréférencer les plans PDF

Pour chaque plan de servitude (2001_003598.pdf, 2002_004259.pdf, etc.):

1. Menu **Sketches** > **Sketches de géoréférencement**
2. Ouvrir le fichier PDF
3. Identifier au moins 4 points de contrôle:
   - Sommets de parcelles visibles sur le plan ET sur le cadastre WMS
   - Intersections de limites
   - Points fixes identifiables
4. Pour chaque point:
   - Cliquer sur le plan PDF
   - Saisir les coordonnées MN95 (E, N) du point correspondant
5. Transformation: **Polynomiale 1** (affine)
6. Méthode de rééchantillonnage: **Plus proche voisin**
7. SCR cible: **EPSG:2056**
8. Sauvegarder le raster géoréférencé (GeoTIFF)

### Étape 3 : Digitaliser les emprises de servitudes

1. Sélectionner la couche `Servitudes de passage`
2. Basculer en mode édition (icône crayon)
3. Outil **Ajouter une entité polygone**
4. Dessiner l'emprise selon le tracé coloré visible sur le plan géoréférencé:
   - **Jaune** : Passages (010-2001/003598, 010-2003/001959)
   - **Bleu** : Passage 2013 (007-2013/002286)
5. Remplir les attributs dans le formulaire
6. Sauvegarder les modifications
7. Répéter pour la couche `Servitudes de canalisations` (lignes)

### Étape 4 : Ajuster les styles

Les styles sont prédéfinis dans le script:
- **Servant** : Hachures rouges (791 est grevé)
- **Bénéficiaire** : Hachures vertes (791 a le droit)
- **Canalisations** : Lignes tiretées (bleu=eau, rouge=égout)

### Étape 5 : Créer la mise en page

1. Menu **Sketches** > **Sketches**
2. Sélectionner `Plan de situation - Servitudes parcelle 791`
3. Ajuster l'emprise de la carte si nécessaire
4. Vérifier les éléments:
   - Titre avec n° de parcelle et adresse
   - Légende complète
   - Échelle graphique (1:500)
   - Nord
   - Cartouche avec mentions légales
   - Tableau récapitulatif des servitudes
5. Exporter en PDF (300 dpi)

---

## Coordonnées de référence (MN95)

Points de calage identifiés sur les plans:

| Point | Description | E (X) | N (Y) |
|-------|-------------|-------|-------|
| A | Angle NE parcelle 791 | ~2533150 | ~1155500 |
| B | Angle SW parcelle 791 | ~2533050 | ~1155400 |
| C | Intersection chemin/limite 1615 | ~2533100 | ~1155350 |
| D | Angle parcelle 764 | ~2533200 | ~1155550 |

*Note: Ces coordonnées sont approximatives. Utiliser le cadastre WMS pour les valeurs exactes.*

---

## Sources de données

### WMS Cadastre VD
- URL: `https://wms.geo.vd.ch/wms`
- Couche: `cadastre_wms`
- CRS: EPSG:2056

### WMS Swisstopo (alternative)
- URL: `https://wms.geo.admin.ch/`
- Couche: `ch.swisstopo.pixelkarte-farbe`

### Plans de servitudes
- Source: Registre foncier La Côte / Lausanne
- Format: PDF scannés
- Échelles: 1:500 et 1:1000

---

## Mentions légales

> **Ce plan n'a pas valeur de foi publique.**
>
> Les servitudes sont représentées à titre indicatif selon les plans annexés aux extraits du Registre foncier.
> Pour toute information officielle, se référer au Registre foncier du district.

---

## Contact

**Service de l'urbanisme - Commune de Bussigny**
Marc Zermatten, Responsable SIT

Document créé le: 2024-12-11
