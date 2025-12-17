# -*- coding: utf-8 -*-
"""
Note technique - Comptage des chambres d'assainissement
Utilise le template PDF Bussigny

RÈGLES DE MISE EN PAGE :
- Utiliser KeepTogether pour ne jamais couper un tableau
- Grouper titre de section + contenu ensemble
- Vérifier que le contenu tient sur une page quand possible
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from bussigny_pdf import (
    BussignyDocTemplate, get_styles, create_table, create_result_box,
    create_metadata_table, create_separator, format_date, format_number,
    BLEU_BUSSIGNY, GRIS_FOND, CONTENT_WIDTH
)
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.units import cm
from reportlab.lib import colors
from datetime import datetime

# Configuration
OUTPUT_DIR = r"C:\Users\zema\GeoBrain\projets\Notes"


def create_pdf():
    """Génère la note PDF sur le comptage des chambres."""

    # Créer le dossier si nécessaire
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Nom du fichier
    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"{date_str}_Comptage_Chambres_Assainissement.pdf"
    filepath = os.path.join(OUTPUT_DIR, filename)

    # Document
    doc = BussignyDocTemplate(
        filepath,
        doc_title="Note technique",
        doc_description="Assainissement - Analyse de données"
    )

    styles = get_styles()
    elements = []

    # === EN-TÊTE ===
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph("NOTE TECHNIQUE", styles['BTitle']))
    elements.append(Paragraph(
        "Comptage des chambres du réseau d'assainissement",
        styles['BSubtitle']
    ))

    # === MÉTADONNÉES ===
    elements.append(create_metadata_table({
        "Date :": format_date(),
        "Auteur :": "Marc Zermatten - Responsable SIT",
        "Service :": "Infrastructures - Commune de Bussigny",
        "Source :": "PostgreSQL/PostGIS (srv-fme, base Prod)"
    }))
    elements.append(Spacer(1, 0.4 * cm))

    # === RÉSULTAT PRINCIPAL (en évidence) ===
    elements.append(create_result_box("RÉSULTAT : 1'269 chambres de visite publiques"))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.4 * cm))

    # === 1. OBJECTIF (groupé avec KeepTogether) ===
    section1 = [
        Paragraph("1. Objectif", styles['BH1']),
        Paragraph(
            "Déterminer le nombre de <b>chambres de visite</b> dans le réseau public "
            "d'assainissement de Bussigny. Les chambres doubles (plusieurs collecteurs "
            "dans une même chambre) ne sont comptées qu'une seule fois.",
            styles['BBody']
        ),
        Spacer(1, 0.4 * cm)
    ]
    elements.append(KeepTogether(section1))

    # === 2. CRITÈRES (groupé avec KeepTogether) ===
    criteres_table = create_table(
        [
            ["Critère", "Valeur", "Justification"],
            ["Genre", "Chambre de visite", "Exclut cheneaux, grilles, décanteurs, etc."],
            ["Propriétaire", "Bussigny - Publique", "Réseau communal (exclut privé et CFF)"],
            ["Désignation", "Sans suffixe .1 à .9", "Évite le double comptage"],
        ],
        col_widths=[3 * cm, 4 * cm, 8 * cm]
    )
    section2 = [
        Paragraph("2. Critères de filtrage", styles['BH1']),
        criteres_table,
        Spacer(1, 0.4 * cm)
    ]
    elements.append(KeepTogether(section2))

    # === 3. RÉSULTATS (groupé avec KeepTogether) ===
    resultats_table = create_table(
        [
            ["Étape de filtrage", "Nombre"],
            ["Total enregistrements (by_ass_chambre)", format_number(8014)],
            ["Genre = 'Chambre de visite'", format_number(3872)],
            ["Propriétaire = 'Bussigny - Publique'", format_number(1419)],
            ["Sans doublons (.1, .2, ..., .9)", format_number(1269)],
        ],
        col_widths=[11 * cm, 4 * cm]
    )
    section3 = [
        Paragraph("3. Résultats de l'analyse", styles['BH1']),
        resultats_table,
        Spacer(1, 0.4 * cm)
    ]
    elements.append(KeepTogether(section3))

    # === 4. REQUÊTE SQL (groupé avec KeepTogether) ===
    sql_query = """SELECT COUNT(*) AS chambres_visite_publiques
FROM assainissement.by_ass_chambre
WHERE genre_chambre = 'Chambre de visite'
  AND proprietaire = 'Bussigny - Publique'
  AND designation NOT SIMILAR TO '%.[1-9]';"""

    sql_table = Table([[sql_query]], colWidths=[CONTENT_WIDTH])
    sql_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), GRIS_FOND),
        ('FONTNAME', (0, 0), (-1, -1), 'Courier'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))

    section4 = [
        Paragraph("4. Requête SQL", styles['BH1']),
        sql_table
    ]
    elements.append(KeepTogether(section4))

    # Générer le PDF
    doc.build(elements)

    print(f"PDF généré : {filepath}")
    return filepath


if __name__ == "__main__":
    create_pdf()
