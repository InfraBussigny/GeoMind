# -*- coding: utf-8 -*-
"""
Module PDF GeoMind - Template réutilisable
==========================================
Ce module définit le style GeoMind pour les documents PDF.
Basé sur le template Bussigny, adapté avec une palette verte.

USAGE:
------
from geomind_pdf import GeoMindDocTemplate, get_styles, create_table, VERT_GEOMIND

doc = GeoMindDocTemplate(
    "mon_fichier.pdf",
    doc_title="Titre du document",
    doc_description="Description en haut à droite"
)
styles = get_styles()
elements = []
elements.append(Paragraph("Mon titre", styles['GTitle']))
doc.build(elements)
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, PageBreak, Image
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from datetime import datetime, date
import os

# =============================================================================
# CONFIGURATION CHARTE GRAPHIQUE GEOMIND
# =============================================================================

# Chemins logos GeoMind
LOGO_PATHS = [
    r"C:\Users\zema\GeoBrain\docs\Logos\GeoMind_Logo_tsp.png",
    r"C:\Users\zema\GeoBrain\docs\Logos\GeoMind_Logo_tsp2.png",
    r"C:\Users\zema\GeoBrain\docs\Logos\GeoMind_Logo_fond blanc.png",
]

# Couleurs GeoMind - Palette verte
VERT_GEOMIND = colors.HexColor('#2d8a4e')       # Vert principal (similaire au vert de l'app)
VERT_FONCE = colors.HexColor('#1e6b3a')         # Vert foncé pour accents
VERT_CLAIR = colors.HexColor('#4CAF50')         # Vert clair pour highlights
VERT_PALE = colors.HexColor('#e8f5e9')          # Vert très pâle pour fonds

# Couleurs neutres
GRIS_FONCE = colors.HexColor('#333333')
GRIS_MOYEN = colors.HexColor('#666666')
GRIS_CLAIR = colors.HexColor('#888888')
GRIS_FOND = colors.HexColor('#f5f5f5')

# Couleurs d'état
ORANGE_ALERTE = colors.HexColor('#ff9800')
ROUGE_ERREUR = colors.HexColor('#f44336')
VERT_SUCCES = colors.HexColor('#4caf50')
BLEU_INFO = colors.HexColor('#2196f3')

# Marges
MARGIN = 2.54 * cm
PAGE_WIDTH, PAGE_HEIGHT = A4
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN


# =============================================================================
# FONCTIONS UTILITAIRES
# =============================================================================

def get_logo_path():
    """Retourne le premier chemin de logo disponible."""
    for path in LOGO_PATHS:
        if os.path.exists(path):
            return path
    return None


def format_date(d=None):
    """Formate une date au format suisse (dd.mm.yyyy)."""
    if d is None:
        d = date.today()
    return d.strftime("%d.%m.%Y")


def format_number(n):
    """Formate un nombre avec séparateur de milliers suisse (apostrophe)."""
    return f"{n:,}".replace(",", "'")


# =============================================================================
# CLASSE TEMPLATE DOCUMENT
# =============================================================================

class GeoMindDocTemplate(SimpleDocTemplate):
    """
    Template PDF avec en-tête et pied de page au format GeoMind.

    En-tête:
    - Logo GeoMind à gauche
    - Description à droite
    - Ligne verte de séparation

    Pied de page:
    - Nom du fichier à gauche
    - Numéro de page à droite
    """

    def __init__(self, filename, doc_title="", doc_description="", **kwargs):
        self.doc_title = doc_title
        self.doc_description = doc_description
        self.file_path = filename

        # Marges par défaut
        kwargs.setdefault('pagesize', A4)
        kwargs.setdefault('rightMargin', MARGIN)
        kwargs.setdefault('leftMargin', MARGIN)
        kwargs.setdefault('topMargin', 3 * cm)
        kwargs.setdefault('bottomMargin', 2 * cm)

        SimpleDocTemplate.__init__(self, filename, **kwargs)

    def afterPage(self):
        """Appelé après chaque page pour dessiner en-tête et pied de page."""
        self.canv.saveState()

        # === EN-TÊTE ===
        logo_path = get_logo_path()
        if logo_path:
            try:
                self.canv.drawImage(
                    logo_path,
                    MARGIN,
                    PAGE_HEIGHT - 2.2 * cm,
                    width=3.5 * cm,
                    height=1.4 * cm,
                    preserveAspectRatio=True,
                    mask='auto'
                )
            except Exception:
                pass

        # Description en haut à droite
        if self.doc_description:
            self.canv.setFont('Helvetica', 9)
            self.canv.setFillColor(GRIS_MOYEN)
            self.canv.drawRightString(
                PAGE_WIDTH - MARGIN,
                PAGE_HEIGHT - 1.5 * cm,
                self.doc_description
            )

        # Ligne de séparation verte
        self.canv.setStrokeColor(VERT_GEOMIND)
        self.canv.setLineWidth(1)
        self.canv.line(
            MARGIN,
            PAGE_HEIGHT - 2.5 * cm,
            PAGE_WIDTH - MARGIN,
            PAGE_HEIGHT - 2.5 * cm
        )

        # === PIED DE PAGE ===
        self.canv.setFont('Helvetica', 8)
        self.canv.setFillColor(GRIS_MOYEN)

        # Nom du fichier à gauche
        file_display = os.path.basename(self.file_path)
        self.canv.drawString(MARGIN, 1 * cm, file_display)

        # Numéro de page à droite
        page_num = self.canv.getPageNumber()
        self.canv.drawRightString(PAGE_WIDTH - MARGIN, 1 * cm, f"Page {page_num}")

        # Ligne fine en haut du pied de page
        self.canv.setStrokeColor(VERT_GEOMIND)
        self.canv.setLineWidth(0.5)
        self.canv.line(
            MARGIN,
            1.5 * cm,
            PAGE_WIDTH - MARGIN,
            1.5 * cm
        )

        self.canv.restoreState()


# =============================================================================
# STYLES DE TEXTE
# =============================================================================

def get_styles():
    """
    Retourne tous les styles selon la charte graphique GeoMind.

    Styles disponibles:
    - GTitle : Titre principal (centré, vert, 22pt)
    - GSubtitle : Sous-titre (centré, gris, 14pt)
    - GH1 : Titre de section niveau 1 (vert, 14pt)
    - GH2 : Titre de section niveau 2 (gris foncé, 12pt)
    - GH3 : Titre de section niveau 3 (vert foncé, 11pt)
    - GBody : Texte courant justifié (10pt)
    - GBullet : Élément de liste avec indentation
    - GCode : Code/SQL (Courier, fond gris)
    - Alert : Encadré alerte orange
    - Info : Encadré information bleu
    - Success : Encadré succès vert
    - Warning : Encadré avertissement orange
    - SectionHeader : Bandeau de section (fond vert, texte blanc)
    - CellNormal : Texte pour cellules de tableau
    - CellBold : Texte gras pour cellules de tableau
    - CellHeader : En-tête de tableau (texte blanc)
    """
    styles = getSampleStyleSheet()

    # Titre principal
    styles.add(ParagraphStyle(
        'GTitle',
        parent=styles['Title'],
        fontSize=22,
        textColor=VERT_GEOMIND,
        alignment=TA_CENTER,
        spaceAfter=6,
        fontName='Helvetica-Bold'
    ))

    # Sous-titre
    styles.add(ParagraphStyle(
        'GSubtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=GRIS_MOYEN,
        alignment=TA_CENTER,
        spaceAfter=20
    ))

    # Titre section H1
    styles.add(ParagraphStyle(
        'GH1',
        parent=styles['Heading1'],
        fontSize=14,
        textColor=VERT_GEOMIND,
        fontName='Helvetica-Bold',
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    ))

    # Titre section H2
    styles.add(ParagraphStyle(
        'GH2',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=GRIS_FONCE,
        fontName='Helvetica-Bold',
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    ))

    # Titre section H3
    styles.add(ParagraphStyle(
        'GH3',
        parent=styles['Heading3'],
        fontSize=11,
        textColor=VERT_FONCE,
        fontName='Helvetica-Bold',
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    ))

    # Texte courant
    styles.add(ParagraphStyle(
        'GBody',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        alignment=TA_JUSTIFY,
        leading=14
    ))

    # Élément de liste
    styles.add(ParagraphStyle(
        'GBullet',
        parent=styles['Normal'],
        fontSize=10,
        leftIndent=15,
        spaceAfter=3,
        bulletIndent=5
    ))

    # Code / SQL
    styles.add(ParagraphStyle(
        'GCode',
        parent=styles['Code'],
        fontName='Courier',
        fontSize=8,
        textColor=colors.black,
        backColor=GRIS_FOND,
        leftIndent=10,
        rightIndent=10,
        spaceBefore=8,
        spaceAfter=8
    ))

    # Encadré alerte (rouge)
    styles.add(ParagraphStyle(
        'Alert',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#c62828'),
        backColor=colors.HexColor('#ffebee'),
        borderPadding=8,
        spaceAfter=8
    ))

    # Encadré warning (orange)
    styles.add(ParagraphStyle(
        'Warning',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#e65100'),
        backColor=colors.HexColor('#fff3e0'),
        borderPadding=8,
        spaceAfter=8
    ))

    # Encadré information (bleu)
    styles.add(ParagraphStyle(
        'Info',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#1565c0'),
        backColor=colors.HexColor('#e3f2fd'),
        borderPadding=8,
        spaceAfter=8
    ))

    # Encadré succès (vert)
    styles.add(ParagraphStyle(
        'Success',
        parent=styles['Normal'],
        fontSize=10,
        textColor=VERT_FONCE,
        backColor=VERT_PALE,
        borderPadding=8,
        spaceAfter=8
    ))

    # Bandeau de section
    styles.add(ParagraphStyle(
        'SectionHeader',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.white,
        backColor=VERT_GEOMIND,
        fontName='Helvetica-Bold',
        borderPadding=(6, 6, 6, 6),
        spaceBefore=12,
        spaceAfter=8
    ))

    # Cellule tableau normale
    styles.add(ParagraphStyle(
        'CellNormal',
        parent=styles['Normal'],
        fontSize=9,
        leading=11
    ))

    # Cellule tableau gras
    styles.add(ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        fontName='Helvetica-Bold'
    ))

    # Cellule en-tête tableau
    styles.add(ParagraphStyle(
        'CellHeader',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        fontName='Helvetica-Bold',
        textColor=colors.white
    ))

    # Note de bas de page
    styles.add(ParagraphStyle(
        'GNote',
        parent=styles['Normal'],
        fontSize=8,
        textColor=GRIS_CLAIR,
        leftIndent=10,
        spaceAfter=4
    ))

    # Tip box
    styles.add(ParagraphStyle(
        'GTip',
        parent=styles['Normal'],
        fontSize=9,
        textColor=VERT_FONCE,
        backColor=VERT_PALE,
        leftIndent=10,
        rightIndent=10,
        spaceBefore=6,
        spaceAfter=6,
        borderPadding=8
    ))

    return styles


# =============================================================================
# CRÉATION DE TABLEAUX
# =============================================================================

def create_table(data, col_widths, header_row=True, styles=None, zebra=False):
    """
    Crée un tableau formaté selon le style GeoMind.

    Args:
        data: Liste de listes (lignes du tableau)
        col_widths: Liste des largeurs de colonnes (en cm ou mm)
        header_row: Si True, la première ligne est un en-tête (fond vert)
        styles: Styles à utiliser (optionnel)
        zebra: Si True, alterne les couleurs de fond des lignes

    Returns:
        Table: Objet Table formaté
    """
    if styles is None:
        styles = get_styles()

    # Convertir les strings en Paragraphs
    formatted_data = []
    for i, row in enumerate(data):
        formatted_row = []
        for cell in row:
            if isinstance(cell, str):
                if header_row and i == 0:
                    formatted_row.append(Paragraph(cell, styles['CellHeader']))
                else:
                    formatted_row.append(Paragraph(cell, styles['CellNormal']))
            else:
                formatted_row.append(cell)
        formatted_data.append(formatted_row)

    table = Table(formatted_data, colWidths=col_widths)

    table_style = [
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]

    if header_row:
        table_style.append(('BACKGROUND', (0, 0), (-1, 0), VERT_GEOMIND))

    # Zebra striping (lignes alternées)
    if zebra:
        start_row = 1 if header_row else 0
        for i in range(start_row, len(data)):
            if (i - start_row) % 2 == 1:
                table_style.append(('BACKGROUND', (0, i), (-1, i), GRIS_FOND))

    table.setStyle(TableStyle(table_style))
    return table


def create_result_box(text, background=None):
    """
    Crée un encadré de résultat mis en évidence.

    Args:
        text: Texte à afficher
        background: Couleur de fond (défaut: VERT_GEOMIND)

    Returns:
        Table: Encadré formaté
    """
    if background is None:
        background = VERT_GEOMIND

    box = Table([[text]], colWidths=[CONTENT_WIDTH])
    box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), background),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 14),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    return box


def create_tip_box(text, styles=None):
    """
    Crée un encadré de conseil/astuce avec icône.

    Args:
        text: Texte du conseil
        styles: Styles à utiliser

    Returns:
        Table: Encadré formaté
    """
    if styles is None:
        styles = get_styles()

    content = Paragraph(f"<b>💡 Astuce :</b> {text}", styles['GTip'])
    box = Table([[content]], colWidths=[CONTENT_WIDTH])
    box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), VERT_PALE),
        ('BOX', (0, 0), (-1, -1), 1, VERT_GEOMIND),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    return box


def create_warning_box(text, styles=None):
    """
    Crée un encadré d'avertissement.

    Args:
        text: Texte de l'avertissement
        styles: Styles à utiliser

    Returns:
        Table: Encadré formaté
    """
    if styles is None:
        styles = get_styles()

    content = Paragraph(f"<b>⚠️ Attention :</b> {text}", styles['Warning'])
    box = Table([[content]], colWidths=[CONTENT_WIDTH])
    box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff3e0')),
        ('BOX', (0, 0), (-1, -1), 1, ORANGE_ALERTE),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    return box


def create_metadata_table(metadata_dict):
    """
    Crée un tableau de métadonnées (Date, Auteur, etc.).

    Args:
        metadata_dict: Dictionnaire {label: valeur}

    Returns:
        Table: Tableau de métadonnées formaté
    """
    data = [[k, v] for k, v in metadata_dict.items()]
    table = Table(data, colWidths=[3.5 * cm, 11.5 * cm])
    table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (0, -1), VERT_FONCE),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return table


def create_separator():
    """Crée une ligne de séparation verte."""
    line = Table([['']], colWidths=[CONTENT_WIDTH])
    line.setStyle(TableStyle([('LINEABOVE', (0, 0), (-1, 0), 2, VERT_GEOMIND)]))
    return line


def create_section_header(text, styles=None):
    """
    Crée un bandeau de section avec fond vert.

    Args:
        text: Texte du bandeau

    Returns:
        Table: Bandeau formaté
    """
    if styles is None:
        styles = get_styles()

    content = Paragraph(text, styles['CellHeader'])
    box = Table([[content]], colWidths=[CONTENT_WIDTH])
    box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), VERT_GEOMIND),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    return box


# =============================================================================
# EXEMPLE D'UTILISATION
# =============================================================================

if __name__ == "__main__":
    """Exemple de création d'un document PDF GeoMind."""

    # Créer le document
    doc = GeoMindDocTemplate(
        "exemple_geomind.pdf",
        doc_title="Document exemple",
        doc_description="Manuel utilisateur"
    )

    styles = get_styles()
    elements = []

    # Titre
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph("DOCUMENT EXEMPLE", styles['GTitle']))
    elements.append(Paragraph("Démonstration du template GeoMind", styles['GSubtitle']))

    # Métadonnées
    elements.append(create_metadata_table({
        "Date :": format_date(),
        "Auteur :": "GeoMind",
        "Version :": "1.0"
    }))
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.5 * cm))

    # Contenu
    elements.append(Paragraph("1. Section exemple", styles['GH1']))
    elements.append(Paragraph(
        "Ceci est un texte d'exemple montrant le style GBody avec alignement justifié. "
        "Le template GeoMind utilise une palette verte professionnelle.",
        styles['GBody']
    ))

    # Tip box
    elements.append(create_tip_box("Utilisez les styles GH1, GH2, GH3 pour les titres."))

    # Tableau
    elements.append(Paragraph("2. Tableau exemple", styles['GH1']))
    table = create_table(
        [
            ["Colonne 1", "Colonne 2", "Colonne 3"],
            ["Valeur A", "Description longue qui peut faire plusieurs lignes", "100"],
            ["Valeur B", "Autre description", "200"],
            ["Valeur C", "Encore une ligne", "300"],
        ],
        col_widths=[4 * cm, 8 * cm, 3 * cm],
        zebra=True
    )
    elements.append(table)

    # Warning
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(create_warning_box("N'oubliez pas de sauvegarder régulièrement."))

    # Résultat
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(create_result_box("RÉSULTAT : 600"))

    # Générer
    doc.build(elements)
    print("Document exemple généré : exemple_geomind.pdf")
