# -*- coding: utf-8 -*-
"""
Génération PDF selon charte graphique Bussigny
Template basé sur Notice_plugin_assainissement.docx
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image, Frame, PageTemplate
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.pdfgen import canvas
from datetime import date
import os

# === CONFIGURATION CHARTE BUSSIGNY ===
LOGO_PATH = r"M:\7-Infra\0-Gest\2-Mod\7024_Logos\logo_bussigny_horizontal.png"

# Couleurs Bussigny
BLEU_BUSSIGNY = colors.HexColor('#366092')
GRIS_FONCE = colors.HexColor('#444444')
GRIS_MOYEN = colors.HexColor('#666666')
GRIS_CLAIR = colors.HexColor('#888888')

# Marges (2.54 cm = 1 inch)
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
        # Logo
        if os.path.exists(LOGO_PATH):
            try:
                self.canv.drawImage(LOGO_PATH, MARGIN, page_height - 2*cm,
                                   width=4*cm, height=1.2*cm, preserveAspectRatio=True)
            except:
                pass

        # Description du document (à droite)
        if self.doc_description:
            self.canv.setFont('Helvetica', 9)
            self.canv.setFillColor(GRIS_MOYEN)
            self.canv.drawRightString(page_width - MARGIN, page_height - 1.5*cm, self.doc_description)

        # Ligne séparatrice
        self.canv.setStrokeColor(BLEU_BUSSIGNY)
        self.canv.setLineWidth(0.5)
        self.canv.line(MARGIN, page_height - 2.2*cm, page_width - MARGIN, page_height - 2.2*cm)

        # === PIED DE PAGE ===
        self.canv.setFont('Helvetica', 9)
        self.canv.setFillColor(colors.black)

        # Chemin du fichier (à gauche)
        file_display = "/" + os.path.basename(self.file_path)
        self.canv.drawString(MARGIN, 1*cm, file_display)

        # Numéro de page (à droite)
        page_num = self.canv.getPageNumber()
        self.canv.drawRightString(page_width - MARGIN, 1*cm, f"Page {page_num}")

        self.canv.restoreState()


def get_bussigny_styles():
    """Retourne les styles selon la charte Bussigny."""
    styles = getSampleStyleSheet()

    # Titre principal (24 pt, bleu)
    styles.add(ParagraphStyle(
        'BussignyTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=BLEU_BUSSIGNY,
        alignment=TA_CENTER,
        spaceAfter=6
    ))

    # Sous-titre (14 pt, gris moyen)
    styles.add(ParagraphStyle(
        'BussignySubtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=GRIS_MOYEN,
        alignment=TA_CENTER,
        spaceAfter=6
    ))

    # Description (12 pt, gris clair)
    styles.add(ParagraphStyle(
        'BussignyDescription',
        parent=styles['Normal'],
        fontSize=12,
        textColor=GRIS_CLAIR,
        alignment=TA_CENTER,
        spaceAfter=20
    ))

    # Heading 1 (16 pt, gras, bleu)
    styles.add(ParagraphStyle(
        'BussignyH1',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=BLEU_BUSSIGNY,
        fontName='Helvetica-Bold',
        spaceBefore=16,
        spaceAfter=8
    ))

    # Heading 2 (13 pt, gras, gris foncé)
    styles.add(ParagraphStyle(
        'BussignyH2',
        parent=styles['Heading2'],
        fontSize=13,
        textColor=GRIS_FONCE,
        fontName='Helvetica-Bold',
        spaceBefore=12,
        spaceAfter=6
    ))

    # Corps de texte (11 pt)
    styles.add(ParagraphStyle(
        'BussignyBody',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=6,
        alignment=TA_JUSTIFY
    ))

    # Liste à puces
    styles.add(ParagraphStyle(
        'BussignyBullet',
        parent=styles['Normal'],
        fontSize=11,
        leftIndent=15,
        spaceAfter=3
    ))

    # Alerte/Confidentiel
    styles.add(ParagraphStyle(
        'BussignyAlert',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#c0392b'),
        backColor=colors.HexColor('#fadbd8'),
        borderPadding=8,
        spaceAfter=8
    ))

    # Section mise en évidence
    styles.add(ParagraphStyle(
        'BussignyHighlight',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.white,
        backColor=BLEU_BUSSIGNY,
        fontName='Helvetica-Bold',
        borderPadding=(8, 8, 8, 8),
        spaceBefore=12,
        spaceAfter=8
    ))

    return styles


def create_pv_sdol_08122025():
    """Génère le PV de la séance SDOL GT du 8 décembre 2025."""

    OUTPUT_FILE = r"C:\Users\zema\GeoBrain\projets\SDOL\PV\2025-12-08_SDOL_GT.pdf"

    doc = BussignyDocTemplate(
        OUTPUT_FILE,
        pagesize=A4,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=3*cm,
        bottomMargin=2*cm,
        doc_title="Procès-verbal SDOL",
        doc_description="PV Séance GT SDOL - 8 décembre 2025"
    )

    styles = get_bussigny_styles()
    elements = []

    # === PAGE DE TITRE ===
    elements.append(Spacer(1, 3*cm))
    elements.append(Paragraph("PROCÈS-VERBAL", styles['BussignyTitle']))
    elements.append(Paragraph("Séance SDOL - Groupe Technique", styles['BussignySubtitle']))
    elements.append(Paragraph("8 décembre 2025", styles['BussignyDescription']))
    elements.append(Spacer(1, 1*cm))

    # Info séance
    info_data = [
        ["Date :", "8 décembre 2025"],
        ["Rédacteur :", "Marc Zermatten, Responsable SIT Bussigny"],
    ]
    info_table = Table(info_data, colWidths=[3*cm, 12*cm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.5*cm))

    # Ligne séparatrice
    line_table = Table([['']], colWidths=[16*cm])
    line_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 2, BLEU_BUSSIGNY),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.3*cm))

    # === CONTENU ===

    # 1. Agenda
    elements.append(Paragraph("1. Agenda", styles['BussignyH1']))
    elements.append(Paragraph("• <b>Prochaine séance groupe décisionnel SDOL</b> : 28 janvier 2026", styles['BussignyBullet']))
    elements.append(Paragraph("• Le Groupe Technique (GT) est invité à participer au groupe décisionnel", styles['BussignyBullet']))

    # 2. Orientation stratégique
    elements.append(Paragraph("2. Orientation stratégique", styles['BussignyH1']))
    elements.append(Paragraph("• <b>Objectif</b> : Abandon des géoportails communaux au profit d'un <b>unique géoportail intercommunal</b>", styles['BussignyBullet']))
    elements.append(Paragraph("• Délai pour l'abandon : en discussion", styles['BussignyBullet']))
    elements.append(Paragraph("• <b>Décision actée</b> : Les municipalités ont décidé par écrit de débrancher les géoportails communaux", styles['BussignyBullet']))
    elements.append(Paragraph("• Point ayant fait l'objet d'une importante discussion", styles['BussignyBullet']))

    # 3. Géoportail intercommunal
    elements.append(Paragraph("3. Géoportail intercommunal - Forme et fond", styles['BussignyH1']))

    elements.append(Paragraph("3.1 Charte graphique", styles['BussignyH2']))
    elements.append(Paragraph("Le graphiste mandaté a refait les logos, pictogrammes des thèmes et polices d'écriture. Phase actuelle : <b>fine tuning</b>.", styles['BussignyBody']))

    elements.append(Paragraph("3.2 Nom et domaine", styles['BussignyH2']))
    elements.append(Paragraph("CONFIDENTIEL - Nom retenu : \"Carto Ouest\" - En attente de validation par le groupe décisionnel, pas de communication officielle.", styles['BussignyAlert']))
    elements.append(Paragraph("• Nom de domaine : pas encore réservé, prévu prochainement", styles['BussignyBullet']))

    elements.append(Paragraph("3.3 Logo", styles['BussignyH2']))
    elements.append(Paragraph("• Déclinaisons présentées (différentes formes pour différentes intégrations)", styles['BussignyBullet']))
    elements.append(Paragraph("• Remarques mineures sur l'alignement", styles['BussignyBullet']))
    elements.append(Paragraph("• <b>Validé globalement par le groupe technique</b>", styles['BussignyBullet']))

    elements.append(Paragraph("3.4 Gabarits d'impression", styles['BussignyH2']))
    elements.append(Paragraph("<b>Demandes :</b>", styles['BussignyBody']))
    elements.append(Paragraph("• Réduire le masque au minimum pour maximiser la surface de carte", styles['BussignyBullet']))
    elements.append(Paragraph("• Ajouter des échelles intermédiaires", styles['BussignyBullet']))
    elements.append(Paragraph("<b>Action :</b> Communes remontent leurs besoins en échelles → HKD évalue la faisabilité (liste échelles d'affichage + liste échelles d'impression)", styles['BussignyBody']))
    elements.append(Paragraph("<b>Format maximum : A3</b> - Formats > A3 nécessiteraient un nouveau serveur. Pour les grands formats, utiliser QGIS.", styles['BussignyBody']))

    elements.append(Paragraph("3.5 Thématiques et couches", styles['BussignyH2']))
    elements.append(Paragraph("• Couches validées par le GT appliquées", styles['BussignyBullet']))
    elements.append(Paragraph("• <b>2 thèmes restants</b> → finalisation prévue en 2026", styles['BussignyBullet']))

    elements.append(Paragraph("3.6 Couche stationnement", styles['BussignyH2']))
    elements.append(Paragraph("• Places représentées, durée de stationnement <b>non représentée graphiquement</b> (trop de variantes)", styles['BussignyBullet']))
    elements.append(Paragraph("• <b>Décision</b> : publication en l'état", styles['BussignyBullet']))

    elements.append(Paragraph("3.7 Stratégie de publication", styles['BussignyH2']))
    elements.append(Paragraph("Publication prévue même si pas parfait, puis phase d'ajustements sur plusieurs mois via séances régulières.", styles['BussignyBody']))

    # 4. Réseaux souterrains
    elements.append(Paragraph("4. Réseaux souterrains", styles['BussignyH1']))
    elements.append(Paragraph("• Demandes en cours auprès des fournisseurs", styles['BussignyBullet']))
    elements.append(Paragraph("• <b>Blocage initial</b> : fournisseurs exigeaient un cloisonnement par commune (incohérent car CADOuest publie déjà tout le réseau sans limite)", styles['BussignyBullet']))
    elements.append(Paragraph("• Argument compris par la plupart, mais fin d'année = pas de priorité", styles['BussignyBullet']))
    elements.append(Paragraph("• <b>TVT maintient sa demande de cloisonnement</b> (discussions en cours)", styles['BussignyBullet']))

    elements.append(Paragraph("4.1 Convention", styles['BussignyH2']))
    elements.append(Paragraph("SDOL signera une convention au nom des communes. Une commune souhaite établir sa propre convention pour ses projets.", styles['BussignyBody']))

    elements.append(Paragraph("4.2 Mise en garde HKD", styles['BussignyH2']))
    table_data = [
        ["Mode", "Avantages", "Inconvénients"],
        ["WMS", "Toujours à jour", "Image uniquement"],
        ["Données en base SDOL", "Données exploitables", "Pas garanties à jour"],
    ]
    t = Table(table_data, colWidths=[4*cm, 5.5*cm, 5.5*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)
    elements.append(Paragraph("<b>Recommandation :</b> Pour les données les plus fraîches → www.plans-reseaux.ch", styles['BussignyBody']))

    # 5. Support technique
    elements.append(Paragraph("5. Support technique - Géoportail démo SDOL", styles['BussignyH1']))
    elements.append(Paragraph("En cas de problème de chargement, signaler à HKD :", styles['BussignyBody']))
    elements.append(Paragraph("• Date et heure du problème", styles['BussignyBullet']))
    elements.append(Paragraph("• Thème concerné", styles['BussignyBullet']))
    elements.append(Paragraph("• Capture d'écran de la composition de la carte", styles['BussignyBullet']))

    # 6. Communication
    elements.append(Paragraph("6. Communication", styles['BussignyH1']))
    elements.append(Paragraph("• Communication nécessaire pour la désactivation des géoportails communaux", styles['BussignyBullet']))
    elements.append(Paragraph("• <b>SDOL prend en charge</b> la communication", styles['BussignyBullet']))
    elements.append(Paragraph("• <b>À venir</b> : projet de communication envoyé par e-mail aux communes", styles['BussignyBullet']))

    # 7. Orthophoto 2026
    elements.append(Paragraph("7. Orthophoto 2026", styles['BussignyH1']))
    ortho_data = [
        ["Élément", "Détail"],
        ["Mandat", "Adjugé à Elimap (5 offres, moins-disant retenu)"],
        ["Budget", "SDOL 2025, facture payée par SDOL"],
        ["Technologie", "Drone pentacam (conforme cahier des charges GT)"],
        ["Vol été 2025", "Uzufly (réalisé)"],
        ["Vol mars 2026", "Elimap (date précise demandée par GT)"],
    ]
    t = Table(ortho_data, colWidths=[4*cm, 11*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph("<b>Avis du GT :</b> Laisser Elimap travailler selon le cahier des charges, trop de supervision risque de les freiner.", styles['BussignyBody']))
    elements.append(Paragraph("<b>À venir :</b> SDOL transmet les informations par mail prochainement.", styles['BussignyBody']))

    # 8. Budget 2026
    elements.append(Paragraph("8. Budget 2026 - Développement géoportail", styles['BussignyH1']))
    elements.append(Paragraph("• <b>Pas de budget prévu</b> pour le développement de couches en 2026 (situation susceptible d'évoluer)", styles['BussignyBullet']))
    elements.append(Paragraph("• <b>Problématique</b> : Si une commune développe une couche, elle \"paie\" pour les 7 autres", styles['BussignyBullet']))
    elements.append(Paragraph("<b>Propositions :</b>", styles['BussignyBody']))
    elements.append(Paragraph("• Organiser une réunion pour définir un coût type de développement de couche", styles['BussignyBullet']))
    elements.append(Paragraph("• Anticiper les thématiques à développer pour mutualiser et réduire les coûts", styles['BussignyBullet']))
    elements.append(Paragraph("• Prioriser les couches et présenter au groupe décisionnel pour débloquer des budgets", styles['BussignyBullet']))

    # === PAGE RÉCAPITULATIVE ===
    elements.append(PageBreak())

    elements.append(Paragraph("POINTS CLÉS POUR LA SÉANCE DE SERVICE", styles['BussignyTitle']))
    elements.append(Spacer(1, 0.5*cm))
    elements.append(line_table)
    elements.append(Spacer(1, 0.5*cm))

    # Décisions
    elements.append(Paragraph("DÉCISIONS IMPORTANTES", styles['BussignyHighlight']))
    elements.append(Paragraph("• Les municipalités ont acté par écrit l'abandon des géoportails communaux", styles['BussignyBullet']))
    elements.append(Paragraph("• Logo du géoportail intercommunal validé par le GT (ajustements mineurs à faire)", styles['BussignyBullet']))
    elements.append(Paragraph("• Format d'impression limité au A3 sur le géoportail", styles['BussignyBullet']))

    # Confidentiel
    elements.append(Paragraph("INFORMATION CONFIDENTIELLE", styles['BussignyHighlight']))
    elements.append(Paragraph("Nom retenu pour le géoportail : \"Carto Ouest\" - En attente validation groupe décisionnel, ne pas communiquer.", styles['BussignyAlert']))

    # Actions
    elements.append(Paragraph("ACTIONS POUR BUSSIGNY", styles['BussignyHighlight']))
    actions_data = [
        ["☐", "Remonter les besoins en échelles d'affichage et d'impression à HKD"],
        ["☐", "Participer à la définition d'un coût type de développement de couche"],
        ["☐", "Réfléchir aux thématiques prioritaires à développer"],
    ]
    t = Table(actions_data, colWidths=[1*cm, 14*cm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)

    # Dates
    elements.append(Paragraph("DATES À RETENIR", styles['BussignyHighlight']))
    dates_data = [
        ["28 janvier 2026", "Prochaine séance groupe décisionnel SDOL (GT invité)"],
        ["Mars 2026", "Vol drone orthophoto (Elimap)"],
    ]
    t = Table(dates_data, colWidths=[4*cm, 11*cm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#d5f5e3')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)

    # À surveiller
    elements.append(Paragraph("À SURVEILLER", styles['BussignyHighlight']))
    elements.append(Paragraph("• Réception du projet de communication SDOL par e-mail", styles['BussignyBullet']))
    elements.append(Paragraph("• Réception des informations sur le vol orthophoto par e-mail", styles['BussignyBullet']))
    elements.append(Paragraph("• Évolution des négociations avec TVT (cloisonnement données réseaux)", styles['BussignyBullet']))

    # Génération
    doc.build(elements)
    print(f"PDF généré : {OUTPUT_FILE}")


if __name__ == "__main__":
    create_pv_sdol_08122025()
