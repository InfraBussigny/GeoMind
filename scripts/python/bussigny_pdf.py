# -*- coding: utf-8 -*-
"""
Module PDF Bussigny - Template réutilisable
============================================
Ce module définit le style officiel des documents PDF de la commune de Bussigny.

USAGE:
------
from bussigny_pdf import BussignyDocTemplate, get_styles, create_table, BLEU_BUSSIGNY

doc = BussignyDocTemplate(
    "mon_fichier.pdf",
    doc_title="Titre du document",
    doc_description="Description en haut à droite"
)
styles = get_styles()
elements = []
elements.append(Paragraph("Mon titre", styles['BTitle']))
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
# CONFIGURATION CHARTE GRAPHIQUE BUSSIGNY
# =============================================================================

# Chemins logos
LOGO_PATHS = [
    r"M:\7-Infra\0-Gest\2-Mod\7024_Logos\logo_bussigny_horizontal.png",
    r"M:\7-Infra\0-Gest\2-Mod\7024_Logos\logo_bussigny_pos.png",
    r"C:\Users\zema\GeoBrain\docs\logo_bussigny_pos.png",
]

# Couleurs officielles
BLEU_BUSSIGNY = colors.HexColor('#366092')
GRIS_FONCE = colors.HexColor('#444444')
GRIS_MOYEN = colors.HexColor('#666666')
GRIS_CLAIR = colors.HexColor('#888888')
GRIS_FOND = colors.HexColor('#f5f5f5')
ORANGE_ALERTE = colors.HexColor('#e67e22')
ROUGE_ERREUR = colors.HexColor('#c0392b')
VERT_SUCCES = colors.HexColor('#27ae60')
BLEU_INFO = colors.HexColor('#1a5276')

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

class BussignyDocTemplate(SimpleDocTemplate):
    """
    Template PDF avec en-tête et pied de page au format Bussigny.

    En-tête:
    - Logo Bussigny à gauche
    - Description à droite
    - Ligne bleue de séparation

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
                    PAGE_HEIGHT - 2 * cm,
                    width=4 * cm,
                    height=1.2 * cm,
                    preserveAspectRatio=True
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

        # Ligne de séparation bleue
        self.canv.setStrokeColor(BLEU_BUSSIGNY)
        self.canv.setLineWidth(0.5)
        self.canv.line(
            MARGIN,
            PAGE_HEIGHT - 2.2 * cm,
            PAGE_WIDTH - MARGIN,
            PAGE_HEIGHT - 2.2 * cm
        )

        # === PIED DE PAGE ===
        self.canv.setFont('Helvetica', 9)
        self.canv.setFillColor(colors.black)

        # Nom du fichier à gauche
        file_display = "/" + os.path.basename(self.file_path)
        self.canv.drawString(MARGIN, 1 * cm, file_display)

        # Numéro de page à droite
        page_num = self.canv.getPageNumber()
        self.canv.drawRightString(PAGE_WIDTH - MARGIN, 1 * cm, f"Page {page_num}")

        self.canv.restoreState()


# =============================================================================
# STYLES DE TEXTE
# =============================================================================

def get_styles():
    """
    Retourne tous les styles selon la charte graphique Bussigny.

    Styles disponibles:
    - BTitle : Titre principal (centré, bleu, 20pt)
    - BSubtitle : Sous-titre (centré, gris, 14pt)
    - BH1 : Titre de section niveau 1 (bleu, 14pt)
    - BH2 : Titre de section niveau 2 (gris foncé, 12pt)
    - BBody : Texte courant justifié (11pt)
    - BBullet : Élément de liste avec indentation
    - BCode : Code/SQL (Courier, fond gris)
    - Alert : Encadré alerte rouge
    - Info : Encadré information bleu
    - Success : Encadré succès vert
    - SectionHeader : Bandeau de section (fond bleu, texte blanc)
    - CellNormal : Texte pour cellules de tableau
    - CellBold : Texte gras pour cellules de tableau
    - CellHeader : En-tête de tableau (texte blanc)
    """
    styles = getSampleStyleSheet()

    # Titre principal
    styles.add(ParagraphStyle(
        'BTitle',
        parent=styles['Title'],
        fontSize=20,
        textColor=BLEU_BUSSIGNY,
        alignment=TA_CENTER,
        spaceAfter=6
    ))

    # Sous-titre
    styles.add(ParagraphStyle(
        'BSubtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=GRIS_MOYEN,
        alignment=TA_CENTER,
        spaceAfter=20
    ))

    # Titre section H1 (keepWithNext évite les titres orphelins en bas de page)
    styles.add(ParagraphStyle(
        'BH1',
        parent=styles['Heading1'],
        fontSize=14,
        textColor=BLEU_BUSSIGNY,
        fontName='Helvetica-Bold',
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    ))

    # Titre section H2 (keepWithNext évite les titres orphelins en bas de page)
    styles.add(ParagraphStyle(
        'BH2',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=GRIS_FONCE,
        fontName='Helvetica-Bold',
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    ))

    # Texte courant
    styles.add(ParagraphStyle(
        'BBody',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=6,
        alignment=TA_JUSTIFY
    ))

    # Élément de liste
    styles.add(ParagraphStyle(
        'BBullet',
        parent=styles['Normal'],
        fontSize=11,
        leftIndent=15,
        spaceAfter=3
    ))

    # Code / SQL
    styles.add(ParagraphStyle(
        'BCode',
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

    # Encadré alerte
    styles.add(ParagraphStyle(
        'Alert',
        parent=styles['Normal'],
        fontSize=10,
        textColor=ROUGE_ERREUR,
        backColor=colors.HexColor('#fadbd8'),
        borderPadding=8,
        spaceAfter=8
    ))

    # Encadré information
    styles.add(ParagraphStyle(
        'Info',
        parent=styles['Normal'],
        fontSize=10,
        textColor=BLEU_INFO,
        backColor=colors.HexColor('#d4e6f1'),
        borderPadding=8,
        spaceAfter=8
    ))

    # Encadré succès
    styles.add(ParagraphStyle(
        'Success',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#1e8449'),
        backColor=colors.HexColor('#d5f5e3'),
        borderPadding=8,
        spaceAfter=8
    ))

    # Bandeau de section
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

    return styles


# =============================================================================
# CRÉATION DE TABLEAUX
# =============================================================================

def create_table(data, col_widths, header_row=True, styles=None):
    """
    Crée un tableau formaté selon le style Bussigny.

    Args:
        data: Liste de listes (lignes du tableau)
              Les éléments peuvent être des strings ou des Paragraph
        col_widths: Liste des largeurs de colonnes (en cm ou mm)
        header_row: Si True, la première ligne est un en-tête (fond bleu)
        styles: Styles à utiliser (optionnel, sera récupéré si non fourni)

    Returns:
        Table: Objet Table formaté
    """
    if styles is None:
        styles = get_styles()

    # Convertir les strings en Paragraphs pour le retour à la ligne automatique
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
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]

    if header_row:
        table_style.append(('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY))

    table.setStyle(TableStyle(table_style))

    return table


def create_result_box(text, background=None):
    """
    Crée un encadré de résultat mis en évidence.

    Args:
        text: Texte à afficher
        background: Couleur de fond (défaut: BLEU_BUSSIGNY)

    Returns:
        Table: Encadré formaté
    """
    if background is None:
        background = BLEU_BUSSIGNY

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


def create_metadata_table(metadata_dict):
    """
    Crée un tableau de métadonnées (Date, Auteur, etc.).

    Args:
        metadata_dict: Dictionnaire {label: valeur}

    Returns:
        Table: Tableau de métadonnées formaté
    """
    data = [[k, v] for k, v in metadata_dict.items()]
    table = Table(data, colWidths=[3 * cm, 12 * cm])
    table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return table


def create_separator():
    """Crée une ligne de séparation bleue."""
    line = Table([['']], colWidths=[CONTENT_WIDTH])
    line.setStyle(TableStyle([('LINEABOVE', (0, 0), (-1, 0), 2, BLEU_BUSSIGNY)]))
    return line


# =============================================================================
# EXEMPLE D'UTILISATION
# =============================================================================

if __name__ == "__main__":
    """Exemple de création d'un document PDF Bussigny."""

    # Créer le document
    doc = BussignyDocTemplate(
        "exemple_bussigny.pdf",
        doc_title="Document exemple",
        doc_description="Note technique"
    )

    styles = get_styles()
    elements = []

    # Titre
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph("DOCUMENT EXEMPLE", styles['BTitle']))
    elements.append(Paragraph("Démonstration du template Bussigny", styles['BSubtitle']))

    # Métadonnées
    elements.append(create_metadata_table({
        "Date :": format_date(),
        "Auteur :": "Marc Zermatten",
        "Service :": "Infrastructures"
    }))
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.5 * cm))

    # Contenu
    elements.append(Paragraph("1. Section exemple", styles['BH1']))
    elements.append(Paragraph(
        "Ceci est un texte d'exemple montrant le style BBody avec alignement justifié.",
        styles['BBody']
    ))

    # Tableau
    elements.append(Paragraph("2. Tableau exemple", styles['BH1']))
    table = create_table(
        [
            ["Colonne 1", "Colonne 2", "Colonne 3"],
            ["Valeur A", "Description longue qui peut faire plusieurs lignes", "100"],
            ["Valeur B", "Autre description", "200"],
        ],
        col_widths=[4 * cm, 8 * cm, 3 * cm]
    )
    elements.append(table)

    # Résultat
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(create_result_box("RÉSULTAT : 300"))

    # Générer
    doc.build(elements)
    print("Document exemple généré : exemple_bussigny.pdf")
