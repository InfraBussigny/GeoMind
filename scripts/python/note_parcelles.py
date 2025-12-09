# -*- coding: utf-8 -*-
"""
Note statistiques parcelles Bussigny
Format charte Bussigny
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER
from datetime import date
import os

# === CONFIGURATION CHARTE BUSSIGNY ===
LOGO_PATH = r"M:\7-Infra\0-Gest\2-Mod\7024_Logos\logo_bussigny_horizontal.png"

# Couleurs Bussigny
BLEU_BUSSIGNY = colors.HexColor('#366092')
GRIS_FONCE = colors.HexColor('#444444')
GRIS_MOYEN = colors.HexColor('#666666')

MARGIN = 2.54 * cm

# Données
TOTAL = 1206
PRIVEES = 1079
COMMUNALES = 102
CANTONALES = 25


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
        fontSize=12,
        textColor=GRIS_MOYEN,
        alignment=TA_CENTER,
        spaceAfter=20
    ))

    styles.add(ParagraphStyle(
        'BBody',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=6,
        alignment=TA_CENTER
    ))

    return styles


def create_note():
    """Génère la note statistiques parcelles."""

    OUTPUT_FILE = r"C:\Users\zema\GeoBrain\projets\Notes\2025-12-09_Statistiques_Parcelles_Bussigny.pdf"

    doc = BussignyDocTemplate(
        OUTPUT_FILE,
        pagesize=A4,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=3*cm,
        bottomMargin=2*cm,
        doc_title="Statistiques parcelles",
        doc_description="Service SIT - Commune de Bussigny"
    )

    styles = get_styles()
    elements = []

    # === EN-TÊTE DU DOCUMENT ===
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph("STATISTIQUES DES PARCELLES", styles['BTitle']))
    elements.append(Paragraph("Commune de Bussigny", styles['BSubtitle']))

    # Info
    today = date.today().strftime("%d.%m.%Y")
    info_data = [
        ["Date :", today],
        ["Source :", "RF Vaud - Cadastre"],
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
    elements.append(Spacer(1, 1*cm))

    # === TABLEAU PRINCIPAL ===
    # Calculer les pourcentages
    pct_privees = (PRIVEES / TOTAL) * 100
    pct_communales = (COMMUNALES / TOTAL) * 100
    pct_cantonales = (CANTONALES / TOTAL) * 100

    cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER)
    cell_bold = ParagraphStyle('CellBold', parent=styles['Normal'], fontSize=14, alignment=TA_CENTER, fontName='Helvetica-Bold')
    cell_header = ParagraphStyle('CellHeader', parent=styles['Normal'], fontSize=11, alignment=TA_CENTER, fontName='Helvetica-Bold', textColor=colors.white)

    def fmt_num(n):
        return f"{n:,}".replace(',', "'")

    data = [
        [Paragraph("Catégorie", cell_header), Paragraph("Nombre", cell_header), Paragraph("Pourcentage", cell_header)],
        [Paragraph("<b>Total des parcelles</b>", cell_style), Paragraph(f"<b>{fmt_num(TOTAL)}</b>", cell_bold), Paragraph("<b>100%</b>", cell_bold)],
        [Paragraph("Parcelles privées", cell_style), Paragraph(fmt_num(PRIVEES), cell_style), Paragraph(f"{pct_privees:.1f}%", cell_style)],
        [Paragraph("DP Communal", cell_style), Paragraph(fmt_num(COMMUNALES), cell_style), Paragraph(f"{pct_communales:.1f}%", cell_style)],
        [Paragraph("DP Cantonal", cell_style), Paragraph(fmt_num(CANTONALES), cell_style), Paragraph(f"{pct_cantonales:.1f}%", cell_style)],
    ]

    t = Table(data, colWidths=[7*cm, 4*cm, 4*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#e8f0f8')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t)

    elements.append(Spacer(1, 1.5*cm))

    # Génération
    doc.build(elements)
    print(f"PDF généré : {OUTPUT_FILE}")
    return OUTPUT_FILE


if __name__ == "__main__":
    create_note()
