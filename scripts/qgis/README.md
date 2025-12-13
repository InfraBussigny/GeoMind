# Plans de Servitude - Commune de Bussigny

Templates et scripts pour la generation de plans cadastraux avec servitudes.
Inspire des plans de Bovard & Fritsche SA, adapte au format Bussigny.

## Structure

```
scripts/qgis/
├── templates/
│   └── plan_servitude_A3.qpt    # Template QGIS (composeur)
├── resources/
│   ├── logo_bussigny_pos.png    # Logo couleur
│   ├── logo_bussigny_neg.png    # Logo blanc
│   └── logo_bussigny_horizontal.png
└── README.md
```

## Types de Servitudes

| Type | Nom | Couleur |
|------|-----|---------|
| `eau_pression` | Canalisation d'eaux sous pression | Vert #00AA00 |
| `eau_usee` | Conduite de refoulement d'eaux usees | Rouge #FF0000 |
| `electricite` | Canalisations d'electricite | Violet #9966FF |
| `gaz` | Conduite de gaz | Jaune #FFCC00 |
| `passage_pied` | Passage public a pied | Orange #FF8800 |
| `passage_vehicule` | Droit de passage (vehicules) | Orange fonce #CC6600 |

## Usage

### 1. Script Python (standalone)

Genere un PDF avec mise en page complete (sans carte):

```bash
cd scripts/python
python plan_servitude.py \
    --parcelle 1234 \
    --type eau_pression \
    --plan "3" \
    --echelle "1:500" \
    --coord-e 2533500 \
    --coord-n 1155500 \
    --dossier "G25-001" \
    --output plan.pdf
```

Options:
- `--parcelle, -p` : Numero(s) de parcelle (obligatoire)
- `--type, -t` : Type de servitude (voir tableau ci-dessus)
- `--plan` : Numero du plan cadastral
- `--echelle` : Echelle du plan (defaut: 1:500)
- `--coord-e, --coord-n` : Coordonnees du centre
- `--dossier` : Reference du dossier technique
- `--nrf` : Numero au Registre Foncier
- `--output, -o` : Chemin du PDF de sortie

### 2. Dans QGIS (PyQGIS)

```python
from scripts.python.plan_servitude import PlanServitude, generate_qgis_layout

# Creer le plan
plan = PlanServitude(
    parcelles=['1234', '1235'],
    type_servitude='eau_usee',
    plan_cadastral='3',
    echelle='1:500',
    coord_centre=(2533500, 1155500),
    dossier_ref='G25-001'
)

# Generer la mise en page QGIS
layout = generate_qgis_layout(plan)

# Exporter en PDF
from plan_servitude import export_layout_to_pdf
export_layout_to_pdf(layout, 'plan_servitude.pdf')
```

### 3. Template QGIS (.qpt)

1. Ouvrir QGIS avec un projet contenant le cadastre
2. Aller dans Projet > Gestionnaire de mises en page
3. Creer une nouvelle mise en page
4. Mise en page > Ajouter des elements depuis un modele
5. Selectionner `templates/plan_servitude_A3.qpt`
6. Configurer les variables du projet:
   - `@commune` : Nom de la commune
   - `@plan_numero` : Numero du plan
   - `@echelle` : Echelle
   - `@servitude_type` : Type de servitude
   - `@coord_e`, `@coord_n` : Coordonnees
   - `@dossier_ref` : Reference dossier
   - `@nrf` : Numero RF

## Elements du Plan

### En-tete
- Titre: "PLAN CADASTRAL - SERVITUDE"
- Case N°RF (haut droite)
- Bloc gauche: Commune, Plan, Echelle
- Bloc droite: Mensuration numerique, Coordonnees C.N.S.
- Encadre: Type de servitude avec ligne coloree

### Zone Carte
- Fond cadastral gris clair
- Servitude en couleur distinctive
- Numeros de parcelles
- Rose des vents
- Grille de coordonnees
- Croix de repere (+)

### Pied de Page
- Date et lieu
- Copyright "Geodonnee (c) Etat de Vaud"
- Responsable SIT

### Cartouche
- Logo Bussigny
- Commune de Bussigny / Service des Infrastructures
- Systeme d'Information du Territoire
- Adresse et contact
- Reference dossier
- Chemin du fichier

## Templates Existants Bussigny

Les templates officiels sont dans:
`M:\7-Infra\0-Gest\3-Geoportail\7032_DAO_SIG\70321_QGIS\703215_Mise en page\`

- `Infra_A3_Paysage.qpt` - Template A3 paysage infrastructures
- `A0_Projet.qpt` - Template A0 projets
- Etc.

## Ressources

- Logos: `M:\7-Infra\0-Gest\2-Mod\7024_Logos\`
- SVG (fleche nord): `Z:\01_QGIS\02-Projet\SVG\`
- Exemples B&F: `docs\exemple servitude\`
