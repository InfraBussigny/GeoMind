# -*- coding: utf-8 -*-
"""
Génération de la demande de télétravail - Marc Zermatten
"""
import sys
sys.path.insert(0, r'C:\Users\zema\GeoBrain\scripts\python')

from bussigny_pdf import (
    BussignyDocTemplate, get_styles, create_metadata_table,
    create_separator, CONTENT_WIDTH, BLEU_BUSSIGNY
)
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.units import cm
from reportlab.lib import colors

# Fichier de sortie
OUTPUT_PATH = r"C:\Users\zema\GeoBrain\docs\2025-12-18_Demande_Teletravail_MZermatten.pdf"

def generate():
    doc = BussignyDocTemplate(
        OUTPUT_PATH,
        doc_description="Demande de télétravail"
    )

    styles = get_styles()
    elements = []

    # Espacement initial
    elements.append(Spacer(1, 0.5 * cm))

    # Titre
    elements.append(Paragraph("DEMANDE DE TÉLÉTRAVAIL", styles['BTitle']))
    elements.append(Spacer(1, 0.3 * cm))

    # Métadonnées
    elements.append(create_metadata_table({
        "De :": "Marc Zermatten, Responsable géodonnées et SIT",
        "À :": "M. Jean-Pierre Binggeli",
        "Date :": "18 décembre 2025",
        "Objet :": "Demande de convention de télétravail"
    }))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.5 * cm))

    # Introduction
    elements.append(Paragraph("Monsieur,", styles['BBody']))
    elements.append(Spacer(1, 0.2 * cm))
    elements.append(Paragraph(
        "Par la présente, je souhaite formuler une demande de télétravail conformément "
        "à la directive interne du 30 août 2021.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.3 * cm))

    # Section 1 - Jours et horaires (groupée pour éviter orphelins)
    section1 = [
        Paragraph("1. Jours et horaires souhaités", styles['BH1']),
        Paragraph(
            "Dans un premier temps, je souhaiterais effectuer du télétravail <b>le mercredi</b>, "
            "sur une journée entière.",
            styles['BBody']
        ),
        Paragraph(
            "À terme, si cette organisation s'avère compatible avec les besoins du service et "
            "ne pose pas de problème dans l'accomplissement de mes missions, j'aimerais avoir "
            "la possibilité d'étendre le télétravail <b>au vendredi</b> également.",
            styles['BBody']
        ),
        Paragraph(
            "Je resterais joignable durant les horaires usuels (06h00-19h00) par téléphone et courriel.",
            styles['BBody']
        ),
        Spacer(1, 0.2 * cm),
    ]
    elements.append(KeepTogether(section1))

    # Section 2 - Tâches (titre + intro groupés)
    section2_intro = [
        Paragraph("2. Tâches envisagées en télétravail", styles['BH1']),
        Paragraph(
            "Mon activité de Responsable géodonnées et SIT comprend de nombreuses tâches "
            "compatibles avec le travail à distance :",
            styles['BBody']
        ),
    ]
    elements.append(KeepTogether(section2_intro))

    taches = [
        "<b>Développement et maintenance</b> des applications SIG (scripts Python, workbenches FME)",
        "<b>Administration des bases de données</b> PostgreSQL/PostGIS et Oracle",
        "<b>Rédaction de documentation</b> technique et procédures",
        "<b>Analyse de données</b> géospatiales et requêtes SQL",
        "<b>Gestion de projets</b> SIT (suivi, planification, coordination par visioconférence)",
        "<b>Veille technologique</b> et formation continue",
        "<b>Échanges avec prestataires externes</b> (HKD, ASIT-VD) par mail/visio"
    ]
    for tache in taches:
        elements.append(Paragraph(f"• {tache}", styles['BBullet']))

    elements.append(Spacer(1, 0.2 * cm))
    elements.append(Paragraph(
        "Les tâches nécessitant une présence physique (rencontres avec les services, "
        "interventions terrain, réunions en présentiel) seraient planifiées sur les jours "
        "de présence au bureau. Toutefois, si ma présence est requise lors d'un jour de "
        "télétravail, je reste disponible pour venir en présentiel.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.2 * cm))

    # Section 3 - Infrastructure (groupée entièrement)
    section3 = [
        Paragraph("3. Infrastructure disponible", styles['BH1']),
        Paragraph("Je dispose à mon domicile de :", styles['BBody']),
        Paragraph("• <b>Espace de travail dédié</b> : bureau isolé permettant de travailler dans de bonnes conditions", styles['BBullet']),
        Paragraph("• <b>Connexion Internet</b> : fibre optique haut débit", styles['BBullet']),
        Paragraph("• <b>Matériel informatique</b> : ordinateur personnel performant", styles['BBullet']),
        Paragraph("• <b>Accès distant</b> : VPN FortiClient configuré et fonctionnel pour accéder aux ressources communales", styles['BBullet']),
        Spacer(1, 0.2 * cm),
        Paragraph(
            "Je m'engage à respecter scrupuleusement les règles de confidentialité et de protection "
            "des données, conformément à l'article 9 de la directive.",
            styles['BBody']
        ),
        Spacer(1, 0.5 * cm),
    ]
    elements.append(KeepTogether(section3))

    # Conclusion (garder ensemble pour éviter orphelin)
    conclusion = [
        create_separator(),
        Spacer(1, 0.3 * cm),
        Paragraph(
            "Je reste à votre disposition pour tout complément d'information et vous prie d'agréer, "
            "Monsieur, mes salutations les meilleures.",
            styles['BBody']
        ),
        Spacer(1, 1 * cm),
        Paragraph("Marc Zermatten", styles['BBody']),
    ]
    elements.append(KeepTogether(conclusion))

    # Section Signature (garder ensemble)
    signature_section = [
        Spacer(1, 1.5 * cm),
        Paragraph("4. Signature", styles['BH1']),
        Spacer(1, 0.5 * cm),
    ]

    # Tableau signature
    signature_data = [
        ["Lieu et date :", "_" * 40],
        ["", ""],
        ["Signature :", ""],
    ]
    signature_table = Table(signature_data, colWidths=[4 * cm, 10 * cm], rowHeights=[None, 0.8 * cm, 1.5 * cm])
    signature_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('VALIGN', (0, 2), (0, 2), 'BOTTOM'),  # "Signature :" aligné en bas de sa cellule
        ('LINEBELOW', (1, 2), (1, 2), 0.5, colors.black),  # Ligne pour signature
    ]))
    signature_section.append(signature_table)

    elements.append(KeepTogether(signature_section))

    # Générer avec gestion veuves/orphelins
    doc.build(elements)
    print(f"PDF généré : {OUTPUT_PATH}")

if __name__ == "__main__":
    generate()
