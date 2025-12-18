# -*- coding: utf-8 -*-
"""
Note technique - Modifications projet QGIS Inspection Collecteurs
Version reader-friendly
"""
import sys
sys.path.insert(0, r'C:\Users\zema\GeoBrain\scripts\python')

from bussigny_pdf import (
    BussignyDocTemplate, get_styles, create_metadata_table,
    create_separator, CONTENT_WIDTH, BLEU_BUSSIGNY
)
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from datetime import datetime

OUTPUT_PATH = r"C:\Users\zema\GeoBrain\temp\NOTE_TECHNIQUE_QGIS_INSPECTION_v3.pdf"

def create_table(data, colWidths=None):
    if colWidths is None:
        colWidths = [CONTENT_WIDTH / len(data[0])] * len(data[0])
    t = Table(data, colWidths=colWidths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    return t

def create_box(text, color=colors.Color(0.95, 0.95, 0.95)):
    """Cree une boite mise en evidence"""
    t = Table([[text]], colWidths=[CONTENT_WIDTH])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), color),
        ('BOX', (0, 0), (-1, -1), 1, colors.grey),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 0), (-1, -1), 'Courier'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
    ]))
    return t

def generate():
    doc = BussignyDocTemplate(
        OUTPUT_PATH,
        doc_description="Note technique QGIS"
    )
    styles = get_styles()
    elements = []

    # Titre
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph("NOTE TECHNIQUE", styles['BTitle']))
    elements.append(Paragraph("Amelioration du projet QGIS Inspection", styles['BSubtitle']))
    elements.append(Spacer(1, 0.3 * cm))

    elements.append(create_metadata_table({
        "Date :": datetime.now().strftime("%d decembre %Y"),
        "Auteur :": "Service SIT",
        "Version :": "v1 vers v2"
    }))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.5 * cm))

    # En bref
    elements.append(Paragraph("En bref", styles['BH1']))
    elements.append(Paragraph(
        "Le projet QGIS a ete ameliore pour <b>calculer automatiquement la date "
        "d'inspection la plus recente</b>, corrigeant ainsi 20 collecteurs dont "
        "les dates etaient mal interpretees.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.4 * cm))

    # Ce qui change pour l'utilisateur
    elements.append(Paragraph("Ce qui change pour l'utilisateur", styles['BH1']))
    elements.append(Paragraph("- <b>Rien a faire differemment</b> : le projet s'utilise exactement comme avant", styles['BBullet']))
    elements.append(Paragraph("- Les couleurs par annee sont maintenant toujours correctes", styles['BBullet']))
    elements.append(Paragraph("- Nouveaux champs disponibles pour les filtres et analyses :", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    champs_data = [
        ["Nouveau champ", "Description"],
        ["date_derniere_inspection", "La date la plus recente (calculee automatiquement)"],
        ["nb_inspections", "Nombre d'inspections : 0, 1 ou 2"],
        ["jours_depuis_inspection", "Nombre de jours depuis la derniere inspection"],
        ["annee_derniere_inspection", "Annee de la derniere inspection"],
    ]
    elements.append(create_table(champs_data, [5.5*cm, 9.5*cm]))
    elements.append(Spacer(1, 0.5 * cm))

    # Le probleme corrige
    elements.append(Paragraph("Le probleme corrige", styles['BH1']))
    elements.append(Paragraph(
        "La table des collecteurs contient deux champs de date (<b>date_inspection_1</b> et "
        "<b>date_inspection_2</b>), mais sans ordre garanti : la date 2 n'est pas forcement "
        "plus recente que la date 1.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.15 * cm))
    elements.append(Paragraph(
        "Pour afficher la couleur selon l'annee de derniere inspection, il fallait utiliser "
        "des <b>formules QGIS complexes</b> avec des <i>if</i> imbriques pour comparer les dates, "
        "gerer les valeurs nulles, etc. Ces expressions etaient difficiles a maintenir et "
        "sources d'erreurs.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.2 * cm))
    elements.append(Paragraph("<b>Exemple concret :</b>", styles['BBody']))
    elements.append(Spacer(1, 0.1 * cm))

    exemple_data = [
        ["Collecteur", "date_inspection_1", "date_inspection_2", "Date la plus recente"],
        ["GID 15631", "2025-05-19", "2023-08-09", "2025-05-19 (date 1)"],
        ["GID 12458", "2018-03-12", "2024-09-15", "2024-09-15 (date 2)"],
    ]
    elements.append(create_table(exemple_data, [2.5*cm, 3.5*cm, 3.5*cm, 5.5*cm]))
    elements.append(Spacer(1, 0.5 * cm))

    # Ce qui a ete fait techniquement
    elements.append(Paragraph("Ce qui a ete fait (technique)", styles['BH1']))

    elements.append(Paragraph("<b>1. Creation d'une vue PostgreSQL</b>", styles['BBody']))
    elements.append(Paragraph(
        "Une vue <b>v_ass_collecteur_inspection</b> a ete creee dans la base de donnees. "
        "Elle reprend toutes les donnees de la table collecteur et ajoute les champs calcules.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>2. Modification du projet QGIS</b>", styles['BBody']))
    elements.append(Paragraph(
        "Les couches pointent maintenant vers la vue au lieu de la table originale. "
        "Les regles de symbologie utilisent le champ <b>annee_derniere_inspection</b> "
        "au lieu d'une formule complexe.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.4 * cm))

    # Fichiers
    elements.append(Paragraph("Fichiers", styles['BH1']))
    fichiers_data = [
        ["Element", "Emplacement"],
        ["Projet original (v1)", "Ass_Collecteurs_inspection.qgz"],
        ["Projet ameliore (v2)", "Ass_Collecteurs_inspection_v2.qgz"],
        ["Vue PostgreSQL", "assainissement.v_ass_collecteur_inspection"],
    ]
    elements.append(create_table(fichiers_data, [4.5*cm, 10.5*cm]))
    elements.append(Spacer(1, 0.2 * cm))
    elements.append(Paragraph(
        "<i>Chemin : M:\\7-Infra\\0-Gest\\3-Geoportail\\7032_DAO_SIG\\70321_QGIS\\703211_Projets\\</i>",
        styles['BBody']
    ))

    # Build
    doc.build(elements)
    print(f"Note technique generee: {OUTPUT_PATH}")

if __name__ == '__main__':
    try:
        generate()
    except Exception as e:
        import traceback
        print(f"Erreur: {e}")
        traceback.print_exc()
