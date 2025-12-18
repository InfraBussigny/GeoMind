# -*- coding: utf-8 -*-
"""
Génération de la documentation utilisateur - Projet QGIS Inspection Collecteurs
"""
import sys
sys.path.insert(0, r'C:\Users\zema\GeoBrain\scripts\python')

from bussigny_pdf import (
    BussignyDocTemplate, get_styles, create_metadata_table,
    create_separator, CONTENT_WIDTH, BLEU_BUSSIGNY
)
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.units import cm
from reportlab.lib import colors
from datetime import datetime

OUTPUT_PATH = r"C:\Users\zema\GeoBrain\temp\DOC_QGIS_INSPECTION_COLLECTEURS_v3.pdf"

def create_section(elements_list):
    """Garde tous les elements ensemble sur la meme page"""
    return KeepTogether(elements_list)

def create_table(data, colWidths=None):
    """Crée un tableau avec style Bussigny"""
    if colWidths is None:
        colWidths = [CONTENT_WIDTH / len(data[0])] * len(data[0])

    t = Table(data, colWidths=colWidths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
    ]))
    return t

def create_tip_box(styles, text):
    """Crée une boîte de conseil"""
    t = Table([[Paragraph(f"<b>Conseil :</b> {text}", styles['BBody'])]], colWidths=[CONTENT_WIDTH])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.Color(0.9, 0.95, 1.0)),
        ('BOX', (0, 0), (-1, -1), 1, BLEU_BUSSIGNY),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return t

def generate():
    doc = BussignyDocTemplate(
        OUTPUT_PATH,
        doc_description="Documentation QGIS Inspection"
    )
    styles = get_styles()
    elements = []

    # ================================================================
    # PAGE DE TITRE
    # ================================================================
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph("GUIDE UTILISATEUR", styles['BTitle']))
    elements.append(Paragraph("Projet QGIS - Suivi des inspections collecteurs", styles['BSubtitle']))
    elements.append(Spacer(1, 0.3 * cm))

    elements.append(create_metadata_table({
        "Version :": "2.0",
        "Date :": datetime.now().strftime("%d decembre %Y"),
        "Auteur :": "Service Infrastructure et Geodonnees",
        "Public :": "Collaborateurs Service Voirie / Infrastructures"
    }))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.5 * cm))

    # ================================================================
    # 1. PRÉSENTATION
    # ================================================================
    elements.append(Paragraph("1. Presentation", styles['BH1']))
    elements.append(Paragraph(
        "Ce projet QGIS permet de visualiser et suivre l'etat des inspections camera "
        "sur le reseau d'assainissement public de Bussigny. Il affiche les collecteurs "
        "par couleur selon leur annee d'inspection et leur etat.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.3 * cm))

    elements.append(Paragraph("<b>Fichier du projet :</b>", styles['BBody']))
    elements.append(Paragraph(
        "M:\\7-Infra\\0-Gest\\3-Geoportail\\7032_DAO_SIG\\70321_QGIS\\703211_Projets\\<b>Ass_Collecteurs_inspection_v2.qgz</b>",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.5 * cm))

    # ================================================================
    # 2. LES COUCHES DU PROJET
    # ================================================================
    layers_data = [
        ["Couche", "Description"],
        ["Annee inspection", "Collecteurs colores par annee de derniere inspection"],
        ["Annee inspection par type", "Sous-groupe avec EC, EU, EM separes"],
        ["Etat collecteurs publics", "Collecteurs colores par etat (0 a 4)"],
        ["Reseau principal/secondaire", "Vue standard sans symbologie d'inspection"],
        ["Chambre", "Points des chambres de visite"],
        ["Couvercle", "Points des couvercles"],
    ]
    elements.append(create_section([
        Paragraph("2. Les couches disponibles", styles['BH1']),
        Paragraph(
            "Le panneau de gauche affiche la liste des couches. Cochez/decochez pour afficher ou masquer.",
            styles['BBody']
        ),
        Spacer(1, 0.2 * cm),
        create_table(layers_data, [6*cm, 9*cm]),
        Spacer(1, 0.5 * cm)
    ]))

    # ================================================================
    # 4. COMPRENDRE LES COULEURS
    # ================================================================
    legend_data = [
        ["Couleur", "Annee", "Signification"],
        ["Gris", "-", "Jamais inspecte"],
        ["Bleu fonce", "2013-2016", "Inspection ancienne (plus de 8 ans)"],
        ["Bleu", "2017-2018", "Inspection ancienne (6-8 ans)"],
        ["Cyan", "2019-2020", "Inspection intermediaire (4-6 ans)"],
        ["Vert", "2021-2022", "Inspection recente (2-4 ans)"],
        ["Jaune/Orange", "2023-2024", "Inspection recente (moins de 2 ans)"],
        ["Rouge", "2025", "Inspection de l'annee en cours"],
    ]
    elements.append(create_section([
        Paragraph("3. Comprendre les couleurs", styles['BH1']),
        Paragraph("<b>Couche \"Annee inspection\" :</b>", styles['BBody']),
        create_table(legend_data, [3*cm, 4*cm, 8*cm]),
        Spacer(1, 0.5 * cm)
    ]))

    etat_data = [
        ["Code", "Etat", "Action recommandee"],
        ["0", "Fortement deteriore", "Remplacement urgent"],
        ["1", "Deteriore", "Remplacement a planifier"],
        ["2", "Defectueux", "Reparation necessaire"],
        ["3", "Insatisfaisant", "Surveillance renforcee"],
        ["4", "Bon etat", "Entretien courant"],
    ]
    elements.append(create_section([
        Paragraph("<b>Couche \"Etat collecteurs\" :</b>", styles['BBody']),
        create_table(etat_data, [2*cm, 5*cm, 8*cm]),
        Spacer(1, 0.5 * cm)
    ]))

    # ================================================================
    # 5. CONSULTER UN COLLECTEUR
    # ================================================================
    info_data = [
        ["Champ", "Signification"],
        ["date_inspection_1", "Date de la 1ere inspection"],
        ["date_inspection_2", "Date de la 2eme inspection (si existe)"],
        ["date_derniere_inspection", "Date la plus recente (calcule auto)"],
        ["etat_derniere_inspection", "Etat constate a la derniere visite"],
        ["nb_inspections", "Nombre total d'inspections (0, 1 ou 2)"],
        ["jours_depuis_inspection", "Jours ecoules depuis derniere inspection"],
    ]
    elements.append(create_section([
        Paragraph("4. Consulter les informations d'un collecteur", styles['BH1']),
        Paragraph("<b>Etape 1 :</b> Dans la barre d'outils, cliquez sur l'icone \"i\" (identifier)", styles['BBody']),
        Paragraph("<b>Etape 2 :</b> Cliquez sur le trait du collecteur sur la carte", styles['BBody']),
        Spacer(1, 0.2 * cm),
        Paragraph("<b>Informations affichees :</b>", styles['BBody']),
        create_table(info_data, [5.5*cm, 9.5*cm]),
        Spacer(1, 0.5 * cm)
    ]))

    # ================================================================
    # PAGE 2
    # ================================================================
    elements.append(PageBreak())

    # ================================================================
    # 6. SAISIR UNE NOUVELLE INSPECTION
    # ================================================================
    saisie_data = [
        ["Si c'est...", "Remplir", "Exemple"],
        ["1ere inspection", "date_inspection_1, etat_inspection_1", "2025-12-18, 3 - Insatisfaisant"],
        ["2eme inspection", "date_inspection_2, etat_inspection_2", "2025-12-18, 4 - Bon etat"],
    ]
    elements.append(create_section([
        Paragraph("5. Saisir une nouvelle inspection", styles['BH1']),
        Paragraph(
            "Apres une campagne d'inspection camera, vous pouvez mettre a jour les dates "
            "et etats directement dans le projet.",
            styles['BBody']
        ),
        Spacer(1, 0.2 * cm),
        Paragraph("<b>Etape 1 :</b> Clic droit sur la couche, choisir \"Sketching Sketching Basculer en mode edition\"", styles['BBody']),
        Paragraph("<b>Etape 2 :</b> Sketching Selectionner les collecteurs inspectes (outil fleche)", styles['BBody']),
        Paragraph("<b>Etape 3 :</b> Ouvrir la table d'attributs (F6)", styles['BBody']),
        Paragraph("<b>Etape 4 :</b> Remplir les champs selon le tableau ci-dessous", styles['BBody']),
        Spacer(1, 0.2 * cm),
        create_table(saisie_data, [4*cm, 5.5*cm, 5.5*cm]),
        Spacer(1, 0.2 * cm),
        create_tip_box(styles,
            "Les champs date_derniere_inspection, nb_inspections, etc. se calculent automatiquement. "
            "Ne les modifiez pas manuellement."
        ),
        Spacer(1, 0.2 * cm),
        Paragraph("<b>Etape 5 :</b> Enregistrer avec Ctrl+S", styles['BBody']),
        Spacer(1, 0.5 * cm)
    ]))

    # ================================================================
    # 7. EXPORTER UNE CARTE
    # ================================================================
    elements.append(Paragraph("6. Exporter une carte (PDF/Image)", styles['BH1']))
    elements.append(Paragraph("- Zoomez sur la zone souhaitee", styles['BBullet']))
    elements.append(Paragraph("- Menu Projet puis Sketching Sketching Sketching Sketching Sketching Nouvelle mise en page", styles['BBullet']))
    elements.append(Paragraph("- Ou pour une image : Menu Projet puis Sketching Importer/Exporter puis Sketching Exporter carte en image", styles['BBullet']))
    elements.append(Spacer(1, 0.5 * cm))

    # ================================================================
    # 8. QUESTIONS FRÉQUENTES
    # ================================================================
    elements.append(Paragraph("7. Questions frequentes", styles['BH1']))

    elements.append(Paragraph("<b>Q : Les donnees ne s'affichent pas ?</b>", styles['BBody']))
    elements.append(Paragraph(
        "R : Verifiez que vous etes connecte au reseau communal. Les donnees sont stockees "
        "sur le serveur srv-fme et necessitent une connexion reseau.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>Q : Je ne peux pas modifier les donnees ?</b>", styles['BBody']))
    elements.append(Paragraph(
        "R : Assurez-vous d'avoir active le mode edition (crayon jaune visible). "
        "Si le probleme persiste, contactez le responsable SIT.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>Q : Comment voir uniquement les collecteurs non inspectes ?</b>", styles['BBody']))
    elements.append(Paragraph(
        "R : Clic droit sur la couche puis Filtrer. Sketching Dans l'expression, saisissez : \"nb_inspections\" = 0",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.5 * cm))

    # ================================================================
    # 9. CONTACT
    # ================================================================
    elements.append(Paragraph("8. Contact et support", styles['BH1']))
    elements.append(Paragraph(
        "Pour toute question technique ou demande d'acces, contactez :",
        styles['BBody']
    ))
    elements.append(Paragraph("- <b>Marc Zermatten</b> - Responsable SIT", styles['BBullet']))
    elements.append(Paragraph("- Service Infrastructure et Geodonnees", styles['BBullet']))

    # Build PDF
    doc.build(elements)
    print(f"Documentation generee: {OUTPUT_PATH}")

if __name__ == '__main__':
    try:
        generate()
    except Exception as e:
        import traceback
        print(f"Erreur: {e}")
        traceback.print_exc()
