# -*- coding: utf-8 -*-
"""
Note statistique - Couvercles assainissement
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from datetime import date
import os

LOGO_PATH = r"M:\7-Infra\0-Gest\2-Mod\7024_Logos\logo_bussigny_horizontal.png"
BLEU_BUSSIGNY = colors.HexColor('#366092')
GRIS_MOYEN = colors.HexColor('#666666')
MARGIN = 2.54 * cm


class BussignyDocTemplate(SimpleDocTemplate):
    def __init__(self, filename, **kwargs):
        self.file_path = filename
        SimpleDocTemplate.__init__(self, filename, **kwargs)

    def afterPage(self):
        self.canv.saveState()
        page_width, page_height = A4

        if os.path.exists(LOGO_PATH):
            try:
                self.canv.drawImage(LOGO_PATH, MARGIN, page_height - 2*cm,
                                   width=4*cm, height=1.2*cm, preserveAspectRatio=True)
            except:
                pass

        self.canv.setStrokeColor(BLEU_BUSSIGNY)
        self.canv.setLineWidth(0.5)
        self.canv.line(MARGIN, page_height - 2.2*cm, page_width - MARGIN, page_height - 2.2*cm)

        self.canv.setFont('Helvetica', 9)
        self.canv.drawRightString(page_width - MARGIN, 1*cm, f"Page {self.canv.getPageNumber()}")
        self.canv.restoreState()


def create_note():
    OUTPUT_FILE = r"C:\Users\zema\GeoBrain\projets\Notes\2025-12-12_Couvercles_Assainissement.pdf"
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    doc = BussignyDocTemplate(
        OUTPUT_FILE,
        pagesize=A4,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=3*cm,
        bottomMargin=2*cm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=16,
                                  textColor=BLEU_BUSSIGNY, alignment=TA_CENTER, spaceAfter=20)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11,
                                 spaceAfter=10, alignment=TA_JUSTIFY)
    result_style = ParagraphStyle('Result', parent=styles['Normal'], fontSize=12,
                                   textColor=colors.HexColor('#1e8449'),
                                   backColor=colors.HexColor('#d5f5e3'),
                                   borderPadding=12, spaceAfter=12)
    bullet_style = ParagraphStyle('Bullet', parent=styles['Normal'], fontSize=11,
                                   leftIndent=15, spaceAfter=4)

    elements = []

    # Titre
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph("Couvercles de chambres de visite", title_style))
    elements.append(Paragraph(f"<i>12 decembre 2025</i>",
                              ParagraphStyle('Date', alignment=TA_CENTER, textColor=GRIS_MOYEN, spaceAfter=25)))

    # Contexte
    elements.append(Paragraph(
        "Analyse du nombre de couvercles sur le reseau d'assainissement public communal. "
        "Le comptage initial des chambres de visite inclut des doublons lies aux chambres doubles "
        "(deux chambres distinctes partageant un meme couvercle).",
        body_style
    ))

    # Donnees
    elements.append(Paragraph("<b>Donnees extraites</b>", body_style))

    data = [
        ["Chambres de visite (reseau public)", "1'419"],
    ]
    t = Table(data, colWidths=[10*cm, 4*cm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
    ]))
    elements.append(t)

    elements.append(Spacer(1, 0.3*cm))

    # Detail chambres partagees
    elements.append(Paragraph("<b>Chambres a couvercle partage</b>", body_style))
    elements.append(Paragraph("• 318 couvercles desservent 2 chambres (chambres doubles)", bullet_style))
    elements.append(Paragraph("• 3 couvercles desservent 3 chambres (chambres triples)", bullet_style))
    elements.append(Paragraph("• 10 chambres sans couvercle associe dans la base", bullet_style))

    elements.append(Spacer(1, 0.5*cm))

    # Resultat
    elements.append(Paragraph(
        "<b>Nombre de couvercles : environ 1'095</b>",
        result_style
    ))

    # Note methodologique
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph(
        "<i>Source : base PostgreSQL/PostGIS, schema assainissement. "
        "Filtre : genre = chambre de visite, proprietaire = Bussigny publique.</i>",
        ParagraphStyle('Note', parent=styles['Normal'], fontSize=9, textColor=GRIS_MOYEN)
    ))

    # Signature
    elements.append(Spacer(1, 1.5*cm))
    elements.append(Paragraph("Marc Zermatten<br/>Responsable SIT", body_style))

    doc.build(elements)
    print(f"PDF genere : {OUTPUT_FILE}")
    return OUTPUT_FILE


if __name__ == "__main__":
    create_note()
