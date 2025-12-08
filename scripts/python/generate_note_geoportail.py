# -*- coding: utf-8 -*-
"""
Note de synthèse - Désactivation géoportail communal
Pour séance de service hebdomadaire
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from datetime import date
import os

# === CONFIGURATION CHARTE BUSSIGNY ===
LOGO_PATH = r"M:\7-Infra\0-Gest\2-Mod\7024_Logos\logo_bussigny_horizontal.png"

# Couleurs Bussigny
BLEU_BUSSIGNY = colors.HexColor('#366092')
GRIS_FONCE = colors.HexColor('#444444')
GRIS_MOYEN = colors.HexColor('#666666')
GRIS_CLAIR = colors.HexColor('#888888')
ORANGE_ALERTE = colors.HexColor('#e67e22')
VERT = colors.HexColor('#27ae60')

MARGIN = 2.54 * cm


class BussignyDocTemplate(SimpleDocTemplate):
    """Template PDF avec en-tête et pied de page Bussigny."""

    def __init__(self, filename, doc_title="", doc_description="", **kwargs):
        self.doc_title = doc_title
        self.doc_description = doc_description
        self.file_path = filename
        SimpleDocTemplate.__init__(self, filename, **kwargs)

    def afterPage(self):
        """Appelé après chaque page."""
        self.canv.saveState()
        page_width, page_height = A4

        # === EN-TÊTE ===
        if os.path.exists(LOGO_PATH):
            try:
                self.canv.drawImage(LOGO_PATH, MARGIN, page_height - 2*cm,
                                   width=4*cm, height=1.2*cm, preserveAspectRatio=True)
            except:
                pass

        if self.doc_description:
            self.canv.setFont('Helvetica', 9)
            self.canv.setFillColor(GRIS_MOYEN)
            self.canv.drawRightString(page_width - MARGIN, page_height - 1.5*cm, self.doc_description)

        self.canv.setStrokeColor(BLEU_BUSSIGNY)
        self.canv.setLineWidth(0.5)
        self.canv.line(MARGIN, page_height - 2.2*cm, page_width - MARGIN, page_height - 2.2*cm)

        # === PIED DE PAGE ===
        self.canv.setFont('Helvetica', 9)
        self.canv.setFillColor(colors.black)
        file_display = "/" + os.path.basename(self.file_path)
        self.canv.drawString(MARGIN, 1*cm, file_display)
        page_num = self.canv.getPageNumber()
        self.canv.drawRightString(page_width - MARGIN, 1*cm, f"Page {page_num}")

        self.canv.restoreState()


def get_styles():
    """Retourne les styles selon la charte Bussigny."""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        'BTitle',
        parent=styles['Title'],
        fontSize=20,
        textColor=BLEU_BUSSIGNY,
        alignment=TA_CENTER,
        spaceAfter=6
    ))

    styles.add(ParagraphStyle(
        'BSubtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=GRIS_MOYEN,
        alignment=TA_CENTER,
        spaceAfter=20
    ))

    styles.add(ParagraphStyle(
        'BH1',
        parent=styles['Heading1'],
        fontSize=14,
        textColor=BLEU_BUSSIGNY,
        fontName='Helvetica-Bold',
        spaceBefore=16,
        spaceAfter=8
    ))

    styles.add(ParagraphStyle(
        'BH2',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=GRIS_FONCE,
        fontName='Helvetica-Bold',
        spaceBefore=10,
        spaceAfter=6
    ))

    styles.add(ParagraphStyle(
        'BBody',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=6,
        alignment=TA_JUSTIFY
    ))

    styles.add(ParagraphStyle(
        'BBullet',
        parent=styles['Normal'],
        fontSize=11,
        leftIndent=15,
        spaceAfter=3
    ))

    styles.add(ParagraphStyle(
        'Alert',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#c0392b'),
        backColor=colors.HexColor('#fadbd8'),
        borderPadding=8,
        spaceAfter=8
    ))

    styles.add(ParagraphStyle(
        'Info',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#1a5276'),
        backColor=colors.HexColor('#d4e6f1'),
        borderPadding=8,
        spaceAfter=8
    ))

    styles.add(ParagraphStyle(
        'Success',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#1e8449'),
        backColor=colors.HexColor('#d5f5e3'),
        borderPadding=8,
        spaceAfter=8
    ))

    styles.add(ParagraphStyle(
        'SectionHeader',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.white,
        backColor=BLEU_BUSSIGNY,
        fontName='Helvetica-Bold',
        borderPadding=(6, 6, 6, 6),
        spaceBefore=12,
        spaceAfter=8
    ))

    return styles


def create_note():
    """Génère la note de synthèse."""

    OUTPUT_FILE = r"C:\Users\zema\GeoBrain\projets\SDOL\Notes\2025-12-08_Note_Geoportail_Seance_Service.pdf"

    doc = BussignyDocTemplate(
        OUTPUT_FILE,
        pagesize=A4,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=3*cm,
        bottomMargin=2*cm,
        doc_title="Note de synthèse",
        doc_description="Note interne - Séance de service"
    )

    styles = get_styles()
    elements = []

    # === EN-TÊTE DU DOCUMENT ===
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph("NOTE DE SYNTHÈSE", styles['BTitle']))
    elements.append(Paragraph("Géoportail intercommunal SDOL - Désactivation du géoportail communal", styles['BSubtitle']))

    # Info
    info_data = [
        ["Date :", "8 décembre 2025"],
        ["De :", "Marc Zermatten, Responsable SIT"],
        ["Pour :", "Séance de service hebdomadaire"],
        ["Objet :", "Information sur le projet SDOL et ses implications"],
    ]
    info_table = Table(info_data, colWidths=[2.5*cm, 13*cm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.5*cm))

    # Ligne
    line = Table([['']], colWidths=[16*cm])
    line.setStyle(TableStyle([('LINEABOVE', (0, 0), (-1, 0), 2, BLEU_BUSSIGNY)]))
    elements.append(line)
    elements.append(Spacer(1, 0.5*cm))

    # === 1. CONTEXTE ===
    elements.append(Paragraph("1. Contexte", styles['BH1']))

    elements.append(Paragraph(
        "Le SDOL (Stratégie et Développement de l'Ouest Lausannois) pilote depuis janvier 2023 un projet de "
        "<b>géoportail intercommunal unique</b> pour les 8 communes du district. Ce projet vise à remplacer "
        "les 8 géoportails communaux existants par une plateforme mutualisée.",
        styles['BBody']
    ))

    elements.append(Paragraph("Les 8 communes partenaires :", styles['BBody']))
    communes = "Bussigny, Chavannes-près-Renens, Crissier, Ecublens, Prilly, Renens, Saint-Sulpice, Villars-Ste-Croix"
    elements.append(Paragraph(f"<i>{communes}</i>", styles['BBullet']))

    elements.append(Paragraph("État d'avancement actuel : <b>~75%</b>, mise en service prévue début 2025.", styles['BBody']))

    # === 2. DÉCISION D'ABANDON ===
    elements.append(Paragraph("2. Décision d'abandon des géoportails communaux", styles['BH1']))

    elements.append(Paragraph("CE QUI EST ACTÉ", styles['SectionHeader']))

    elements.append(Paragraph(
        "Selon les informations communiquées lors de la séance GT du 8 décembre 2025 :",
        styles['BBody']
    ))
    elements.append(Paragraph("• Les <b>municipalités ont décidé par écrit</b> de débrancher les géoportails communaux", styles['BBullet']))
    elements.append(Paragraph("• Cette décision a été prise <b>avant mon arrivée</b> au poste", styles['BBullet']))
    elements.append(Paragraph("• Le délai exact de désactivation est encore en discussion", styles['BBullet']))

    elements.append(Paragraph("DOCUMENTS DE RÉFÉRENCE", styles['SectionHeader']))

    ref_data = [
        [Paragraph("<b>Document</b>", styles['Normal']), Paragraph("<b>Contenu</b>", styles['Normal'])],
        [Paragraph("Courrier SDOL du 18.01.2024", styles['Normal']),
         Paragraph("Demande de validation aux Municipalités :<br/>"
         "- Participation au guichet cartographique unique<br/>"
         "- Participation financière (8'683.25 CHF pour Bussigny)<br/>"
         "- Constitution des groupes GT/GD", styles['Normal'])],
        [Paragraph("Délai de réponse", styles['Normal']), Paragraph("21 février 2024", styles['Normal'])],
        [Paragraph("Réponse de Bussigny", styles['Normal']), Paragraph("<b>Non retrouvée</b> dans mes archives - à vérifier", styles['Normal'])],
    ]
    t = Table(ref_data, colWidths=[4.5*cm, 10.5*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph(
        "<b>Note :</b> Je ne retrouve pas la correspondance de validation de la commune. "
        "Cependant, le projet est avancé à 75% avec participation active de Bussigny depuis le début, "
        "et l'offre HKD spécifique à Bussigny (12'219.60 CHF) a été signée le 13.01.2025.",
        styles['Info']
    ))

    # === 3. IMPLICATIONS ===
    elements.append(Paragraph("3. Implications pour Bussigny", styles['BH1']))

    elements.append(Paragraph("ASPECTS POSITIFS", styles['SectionHeader']))
    elements.append(Paragraph("• <b>Aucune perte de données</b> : toutes les couches communales seront disponibles sur le géoportail intercommunal", styles['BBullet']))
    elements.append(Paragraph("• <b>Mutualisation des coûts</b> : maintenance partagée entre 8 communes", styles['BBullet']))
    elements.append(Paragraph("• <b>Deux niveaux d'accès prévus</b> : données publiques + données internes (employés)", styles['BBullet']))
    elements.append(Paragraph("• <b>Plateforme moderne</b> : GeoMapFish (open source, utilisé par plusieurs cantons et communes suisses)", styles['BBullet']))

    elements.append(Paragraph("CONTRAINTES", styles['SectionHeader']))
    elements.append(Paragraph("• <b>Perte d'autonomie</b> : les développements futurs nécessitent coordination avec les 7 autres communes", styles['BBullet']))
    elements.append(Paragraph("• <b>Délais allongés</b> : décisions collectives via le GT/GD", styles['BBullet']))
    elements.append(Paragraph("• <b>Budget partagé</b> : si une commune développe une couche, elle \"paie\" potentiellement pour les autres", styles['BBullet']))
    elements.append(Paragraph("• <b>Format impression limité</b> : A3 maximum (contrainte serveur)", styles['BBullet']))

    # === 4. OPTIONS ===
    elements.append(Paragraph("4. Options possibles", styles['BH1']))

    # Style pour cellules de tableau
    cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=9, leading=11)
    cell_bold = ParagraphStyle('CellBold', parent=styles['Normal'], fontSize=9, leading=11, fontName='Helvetica-Bold')
    cell_header = ParagraphStyle('CellHeader', parent=styles['Normal'], fontSize=9, leading=11, fontName='Helvetica-Bold', textColor=colors.white)

    options_data = [
        [Paragraph("Option", cell_header), Paragraph("Description", cell_header), Paragraph("Recommandation", cell_header)],
        [Paragraph("<b>A. Suivre la décision SDOL</b>", cell_style),
         Paragraph("Désactiver le géoportail communal conformément à la décision actée. "
         "Utiliser uniquement le géoportail intercommunal.", cell_style),
         Paragraph("<b>RECOMMANDÉ</b><br/>Cohérent avec les engagements pris", cell_style)],
        [Paragraph("<b>B. Maintenir un géoportail interne</b>", cell_style),
         Paragraph("Conserver une version \"interne\" du géoportail communal accessible uniquement "
         "aux employés, en parallèle du géoportail intercommunal.", cell_style),
         Paragraph("<b>POSSIBLE mais...</b><br/>- Double maintenance<br/>- Coût supplémentaire<br/>- Redondance des données", cell_style)],
        [Paragraph("<b>C. Demander clarification au SDOL</b>", cell_style),
         Paragraph("Demander au SDOL la copie de la réponse de validation de Bussigny avant "
         "de procéder à la désactivation.", cell_style),
         Paragraph("<b>PRUDENT</b><br/>Permet de documenter officiellement la décision", cell_style)],
    ]
    t = Table(options_data, colWidths=[3.5*cm, 7*cm, 4.5*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (2, 1), (2, 1), colors.HexColor('#d5f5e3')),
    ]))
    elements.append(t)

    # === 5. PROPOSITION ===
    elements.append(Paragraph("5. Proposition", styles['BH1']))

    elements.append(Paragraph(
        "Je propose de <b>suivre la décision SDOL (Option A)</b> tout en demandant une copie de la validation "
        "pour nos archives (Option C). Si des besoins spécifiques internes sont identifiés qui ne seraient pas "
        "couverts par le géoportail intercommunal, nous pourrons les remonter au GT pour intégration.",
        styles['Success']
    ))

    elements.append(Paragraph("Points à valider en séance :", styles['BBody']))
    elements.append(Paragraph("• Accord sur la désactivation du géoportail communal", styles['BBullet']))
    elements.append(Paragraph("• Identification d'éventuels besoins spécifiques non couverts", styles['BBullet']))
    elements.append(Paragraph("• Demande de clarification au SDOL si nécessaire", styles['BBullet']))

    # === 6. CALENDRIER ===
    elements.append(Paragraph("6. Prochaines étapes", styles['BH1']))

    cal_data = [
        [Paragraph("<b>Échéance</b>", cell_header), Paragraph("<b>Action</b>", cell_header)],
        [Paragraph("<b>28 janvier 2026</b>", cell_style), Paragraph("Séance groupe décisionnel SDOL (GT invité)", cell_style)],
        [Paragraph("<b>Début 2026</b>", cell_style), Paragraph("Mise en service prévue du géoportail intercommunal", cell_style)],
        [Paragraph("<b>À définir</b>", cell_style), Paragraph("Désactivation des géoportails communaux", cell_style)],
        [Paragraph("<b>Mars 2026</b>", cell_style), Paragraph("Vol drone orthophoto (Elimap)", cell_style)],
    ]
    t = Table(cal_data, colWidths=[4*cm, 11*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)

    # === SIGNATURE ===
    elements.append(Spacer(1, 1.5*cm))

    sig_data = [
        ["Marc Zermatten"],
        ["Responsable SIT"],
        ["Service des infrastructures"],
    ]
    sig_table = Table(sig_data, colWidths=[6*cm])
    sig_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ]))
    elements.append(sig_table)

    # Génération
    doc.build(elements)
    print(f"PDF généré : {OUTPUT_FILE}")
    return OUTPUT_FILE


if __name__ == "__main__":
    create_note()
