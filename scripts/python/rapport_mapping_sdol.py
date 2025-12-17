# -*- coding: utf-8 -*-
"""
Rapport de mapping Bussigny → SDOL
Utilise le template PDF Bussigny
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from bussigny_pdf import (
    BussignyDocTemplate, get_styles, create_table, create_result_box,
    create_metadata_table, create_separator, format_date,
    BLEU_BUSSIGNY, GRIS_FOND, CONTENT_WIDTH, VERT_SUCCES, ORANGE_ALERTE, ROUGE_ERREUR
)
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.units import cm
from reportlab.lib import colors
from datetime import datetime

OUTPUT_DIR = r"C:\Users\zema\GeoBrain\projets\Migration_SDOL"


def create_pdf():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"{date_str}_Mapping_Bussigny_SDOL.pdf"
    filepath = os.path.join(OUTPUT_DIR, filename)

    doc = BussignyDocTemplate(
        filepath,
        doc_title="Rapport de mapping",
        doc_description="Migration SDOL - Assainissement"
    )

    styles = get_styles()
    elements = []

    # === TITRE ===
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph("RAPPORT DE MAPPING", styles['BTitle']))
    elements.append(Paragraph("Migration Bussigny → SDOL - Assainissement", styles['BSubtitle']))

    # === MÉTADONNÉES ===
    elements.append(create_metadata_table({
        "Date :": format_date(),
        "Source :": "srv-fme/Prod (schéma assainissement)",
        "Cible :": "postgres.hkd-geomatique.com/sdol",
        "Schéma cible :": "back_hkd_databy"
    }))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.3 * cm))

    # === RÉSUMÉ ===
    elements.append(Paragraph("1. Résumé du mapping", styles['BH1']))

    resume_table = create_table(
        [
            ["Table source", "Table cible", "Colonnes mappées", "Statut"],
            ["by_ass_chambre", "eu_chambre", "26 → 68", "⚠️ Partiel"],
            ["by_ass_collecteur", "eu_collecteur", "43 → 97", "⚠️ Partiel"],
        ],
        col_widths=[4*cm, 4*cm, 3.5*cm, 3.5*cm]
    )
    elements.append(resume_table)
    elements.append(Spacer(1, 0.5*cm))

    # === CHAMBRES ===
    elements.append(Paragraph("2. Mapping CHAMBRES (by_ass_chambre → eu_chambre)", styles['BH1']))

    elements.append(Paragraph("Correspondances directes :", styles['BH2']))
    direct_table = create_table(
        [
            ["Bussigny", "SDOL", "Notes"],
            ["designation", "no_obj", "Numéro de chambre"],
            ["cote_radier", "alt_radi", "Altitude radier"],
            ["profondeur", "profondeur", "Identique"],
            ["remarque", "remarque", "Texte libre"],
            ["geom", "geom", "Point MN95"],
        ],
        col_widths=[4*cm, 4*cm, 7*cm]
    )
    elements.append(direct_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("Transformations requises :", styles['BH2']))
    transfo_table = create_table(
        [
            ["Bussigny", "SDOL", "Transformation"],
            ["genre_chambre", "type_ouvr", "Mapping domaine (voir §4)"],
            ["proprietaire", "proprio", "Mapping domaine"],
            ["etat", "etat_constr", "Mapping domaine"],
            ["annee_construction", "constr_an", "EXTRACT(YEAR FROM date)"],
            ["dimension_1 + dimension_2", "dim_ch", "Concaténer: '100x80'"],
            ["chambre_double", "ch_dbl_on", "Convertir en boolean"],
        ],
        col_widths=[4.5*cm, 3.5*cm, 7*cm]
    )
    elements.append(transfo_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("Champs sans correspondance SDOL :", styles['BH2']))
    absent_table = create_table(
        [
            ["Champ Bussigny", "Action proposée"],
            ["forme_chambre", "Stocker dans remarque"],
            ["dispositif_acces", "Stocker dans remarque"],
            ["orientation", "Stocker dans remarque"],
            ["eaux_infiltration", "Stocker dans remarque"],
            ["no_troncon_entree/sortie", "Relation recalculée par géométrie"],
        ],
        col_widths=[5*cm, 10*cm]
    )
    elements.append(absent_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("Valeurs par défaut à injecter :", styles['BH2']))
    defaut_table = create_table(
        [
            ["Champ SDOL", "Valeur"],
            ["nom_comm", "'Bussigny'"],
            ["no_comm", "'5624'"],
            ["data_owner", "'by'"],
            ["coord_nord", "ST_Y(geom)"],
            ["coord_est", "ST_X(geom)"],
        ],
        col_widths=[5*cm, 10*cm]
    )
    elements.append(defaut_table)

    # Page break
    elements.append(PageBreak())

    # === COLLECTEURS ===
    elements.append(Paragraph("3. Mapping COLLECTEURS (by_ass_collecteur → eu_collecteur)", styles['BH1']))

    elements.append(Paragraph("Correspondances principales :", styles['BH2']))
    coll_table = create_table(
        [
            ["Bussigny", "SDOL", "Notes"],
            ["materiau", "materiau", "Mapping domaine"],
            ["fonction_hydro", "fonction", "Mapping domaine"],
            ["fonction_hierarchique", "hierarchie", "Mapping domaine"],
            ["genre_profil", "profil", "Mapping domaine"],
            ["largeur_profil", "diametre", "Convertir m → mm"],
            ["hauteur_max_profil", "hauteur", "Convertir m → mm"],
            ["date_inspection_1", "inspcam_date", "Direct"],
            ["remarque", "remarque", "Direct"],
            ["geom", "geom", "LineString MN95"],
        ],
        col_widths=[4.5*cm, 4*cm, 6.5*cm]
    )
    elements.append(coll_table)

    # === DOMAINES ===
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph("4. Mapping des domaines (valeurs)", styles['BH1']))

    elements.append(Paragraph("Propriétaire :", styles['BH2']))
    proprio_table = create_table(
        [
            ["Bussigny", "SDOL"],
            ["Bussigny - Publique", "communal"],
            ["Privée", "prive"],
            ["CFF", "cff"],
        ],
        col_widths=[7.5*cm, 7.5*cm]
    )
    elements.append(proprio_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("État :", styles['BH2']))
    etat_table = create_table(
        [
            ["Bussigny", "SDOL"],
            ["Bon", "bon"],
            ["Moyen", "moyen"],
            ["Mauvais", "mauvais"],
            ["Inconnu", "inconnu"],
        ],
        col_widths=[7.5*cm, 7.5*cm]
    )
    elements.append(etat_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("Genre chambre → type_ouvr :", styles['BH2']))
    genre_table = create_table(
        [
            ["Bussigny (genre_chambre)", "SDOL (type_ouvr)"],
            ["Chambre de visite", "chambre"],
            ["Cheneau", "grille"],
            ["Sac - Grille", "grille"],
            ["Chambre de décantation", "chambre_speciale"],
            ["Séparateur d'hydrocarbures", "separateur"],
            ["Station pompage", "station_pompage"],
            ["Déversoir d'orage", "deversoir"],
        ],
        col_widths=[7.5*cm, 7.5*cm]
    )
    elements.append(genre_table)

    # === POINTS SENSIBLES ===
    elements.append(PageBreak())
    elements.append(Paragraph("5. Points sensibles", styles['BH1']))

    elements.append(Paragraph("🔴 Bloquants :", styles['BH2']))
    bloquants = create_table(
        [
            ["Problème", "Impact", "Solution"],
            [
                "Champs absents SDOL",
                "Perte données (forme, dispositif, orientation)",
                "Stocker dans remarque ou vue locale"
            ],
            [
                "Domaines non validés",
                "Erreurs d'insertion possibles",
                "Valider liste valeurs avec HKD"
            ],
        ],
        col_widths=[4*cm, 5*cm, 6*cm]
    )
    elements.append(bloquants)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("🟡 À valider avec HKD :", styles['BH2']))
    valider = create_table(
        [
            ["Question"],
            ["Mapping matériau → cheminee_mtx ou fond_mtx ?"],
            ["Format attendu pour dim_ch ? (ex: '100x80')"],
            ["Liste exhaustive des valeurs de domaines SDOL ?"],
        ],
        col_widths=[15*cm]
    )
    elements.append(valider)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("🟢 Validé :", styles['BH2']))
    valide = create_table(
        [
            ["Élément", "Statut"],
            ["Géométrie (Point/LineString)", "Compatible EPSG:2056"],
            ["Structure générale", "Compatible"],
            ["Connexion base SDOL", "OK (via srv-fme)"],
        ],
        col_widths=[10*cm, 5*cm]
    )
    elements.append(valide)

    # === PROCHAINES ÉTAPES ===
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph("6. Prochaines étapes", styles['BH1']))
    elements.append(Paragraph("1. Valider le mapping des domaines avec HKD", styles['BBullet']))
    elements.append(Paragraph("2. Créer workbench FME de migration", styles['BBullet']))
    elements.append(Paragraph("3. Tester sur échantillon (10 chambres, 10 collecteurs)", styles['BBullet']))
    elements.append(Paragraph("4. Migration complète", styles['BBullet']))
    elements.append(Paragraph("5. Validation post-migration", styles['BBullet']))

    # Générer
    doc.build(elements)
    print(f"PDF généré : {filepath}")
    return filepath


if __name__ == "__main__":
    create_pdf()
