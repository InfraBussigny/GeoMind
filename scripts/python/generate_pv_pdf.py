# -*- coding: utf-8 -*-
"""
Génération PDF du PV SDOL GT - 8 décembre 2025
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, ListFlowable, ListItem
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from datetime import date
import os

# Chemin de sortie
OUTPUT_DIR = r"C:\Users\zema\GeoBrain\projets\SDOL\PV"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "2025-12-08_SDOL_GT.pdf")

def create_pv_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_FILE,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()

    # Styles personnalisés
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=6,
        textColor=colors.HexColor('#1a5276'),
        alignment=TA_CENTER
    )

    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER,
        spaceAfter=20
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Heading1'],
        fontSize=14,
        spaceBefore=16,
        spaceAfter=8,
        textColor=colors.HexColor('#1a5276'),
        borderPadding=(0, 0, 3, 0),
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading2'],
        fontSize=11,
        spaceBefore=10,
        spaceAfter=6,
        textColor=colors.HexColor('#2874a6'),
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        alignment=TA_JUSTIFY
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontSize=10,
        leftIndent=15,
        spaceAfter=3
    )

    warning_style = ParagraphStyle(
        'Warning',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#c0392b'),
        backColor=colors.HexColor('#fadbd8'),
        borderPadding=8,
        spaceAfter=8
    )

    key_points_style = ParagraphStyle(
        'KeyPoints',
        parent=styles['Normal'],
        fontSize=10,
        backColor=colors.HexColor('#d5f5e3'),
        borderPadding=8,
        spaceAfter=6
    )

    elements = []

    # ===== EN-TÊTE =====
    elements.append(Paragraph("PROCÈS-VERBAL", title_style))
    elements.append(Paragraph("Séance SDOL - Groupe Technique", subtitle_style))

    # Info séance
    info_data = [
        ["Date :", "8 décembre 2025"],
        ["Rédacteur :", "Marc Zermatten, Responsable SIT Bussigny"],
    ]
    info_table = Table(info_data, colWidths=[3*cm, 12*cm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.5*cm))

    # Ligne séparatrice
    line_table = Table([['']], colWidths=[17*cm])
    line_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor('#1a5276')),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.3*cm))

    # ===== 1. AGENDA =====
    elements.append(Paragraph("1. Agenda", h1_style))
    elements.append(Paragraph("• <b>Prochaine séance groupe décisionnel SDOL</b> : 28 janvier 2026", bullet_style))
    elements.append(Paragraph("• Le Groupe Technique (GT) est invité à participer au groupe décisionnel", bullet_style))

    # ===== 2. ORIENTATION STRATÉGIQUE =====
    elements.append(Paragraph("2. Orientation stratégique", h1_style))
    elements.append(Paragraph("• <b>Objectif</b> : Abandon des géoportails communaux au profit d'un <b>unique géoportail intercommunal</b>", bullet_style))
    elements.append(Paragraph("• Délai pour l'abandon : en discussion", bullet_style))
    elements.append(Paragraph("• <b>Décision actée</b> : Les municipalités ont décidé par écrit de débrancher les géoportails communaux", bullet_style))
    elements.append(Paragraph("• Point ayant fait l'objet d'une importante discussion", bullet_style))

    # ===== 3. GÉOPORTAIL INTERCOMMUNAL =====
    elements.append(Paragraph("3. Géoportail intercommunal - Forme et fond", h1_style))

    elements.append(Paragraph("3.1 Charte graphique", h2_style))
    elements.append(Paragraph("Le graphiste mandaté a refait les logos, pictogrammes des thèmes et polices d'écriture. Phase actuelle : <b>fine tuning</b>.", body_style))

    elements.append(Paragraph("3.2 Nom et domaine", h2_style))
    elements.append(Paragraph("⚠️ CONFIDENTIEL - Nom retenu : \"Carto Ouest\" - En attente de validation par le groupe décisionnel, pas de communication officielle pour l'instant.", warning_style))
    elements.append(Paragraph("• Nom de domaine : pas encore réservé, prévu prochainement", bullet_style))

    elements.append(Paragraph("3.3 Logo", h2_style))
    elements.append(Paragraph("• Déclinaisons présentées (différentes formes pour différentes intégrations)", bullet_style))
    elements.append(Paragraph("• Remarques mineures sur l'alignement", bullet_style))
    elements.append(Paragraph("• <b>Validé globalement par le groupe technique</b>", bullet_style))

    elements.append(Paragraph("3.4 Gabarits d'impression", h2_style))
    elements.append(Paragraph("<b>Demandes :</b>", body_style))
    elements.append(Paragraph("• Réduire le masque au minimum pour maximiser la surface de carte", bullet_style))
    elements.append(Paragraph("• Ajouter des échelles intermédiaires", bullet_style))
    elements.append(Paragraph("<b>Action :</b> Communes remontent leurs besoins en échelles → HKD évalue la faisabilité technique (liste échelles d'affichage + liste échelles d'impression)", body_style))
    elements.append(Paragraph("<b>Format maximum : A3</b> - Formats > A3 nécessiteraient un nouveau serveur d'impression. Pour les grands formats, utiliser QGIS.", body_style))

    elements.append(Paragraph("3.5 Thématiques et couches", h2_style))
    elements.append(Paragraph("• Couches validées par le GT appliquées", bullet_style))
    elements.append(Paragraph("• <b>2 thèmes restants</b> → finalisation prévue en 2026", bullet_style))

    elements.append(Paragraph("3.6 Couche stationnement", h2_style))
    elements.append(Paragraph("• Places représentées, durée de stationnement <b>non représentée graphiquement</b> (trop de variantes)", bullet_style))
    elements.append(Paragraph("• <b>Décision</b> : publication en l'état", bullet_style))

    elements.append(Paragraph("3.7 Stratégie de publication", h2_style))
    elements.append(Paragraph("Publication prévue même si pas parfait, puis phase d'ajustements sur plusieurs mois via séances régulières.", body_style))

    # ===== 4. RÉSEAUX SOUTERRAINS =====
    elements.append(Paragraph("4. Réseaux souterrains", h1_style))
    elements.append(Paragraph("• Demandes en cours auprès des fournisseurs", bullet_style))
    elements.append(Paragraph("• <b>Blocage initial</b> : fournisseurs exigeaient un cloisonnement par commune (incohérent car CADOuest publie déjà tout le réseau sans limite)", bullet_style))
    elements.append(Paragraph("• Argument compris par la plupart, mais fin d'année = pas de priorité", bullet_style))
    elements.append(Paragraph("• <b>TVT maintient sa demande de cloisonnement</b> (discussions en cours)", bullet_style))

    elements.append(Paragraph("4.1 Convention", h2_style))
    elements.append(Paragraph("SDOL signera une convention au nom des communes. Une commune souhaite établir sa propre convention pour ses projets.", body_style))

    elements.append(Paragraph("4.2 Mise en garde HKD", h2_style))
    table_data = [
        ["Mode", "Avantages", "Inconvénients"],
        ["WMS", "Toujours à jour", "Image uniquement"],
        ["Données en base SDOL", "Données exploitables", "Pas garanties à jour"],
    ]
    t = Table(table_data, colWidths=[4*cm, 5.5*cm, 5.5*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2874a6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)
    elements.append(Paragraph("<b>Recommandation :</b> Pour les données les plus fraîches → www.plans-reseaux.ch", body_style))

    # ===== 5. SUPPORT TECHNIQUE =====
    elements.append(Paragraph("5. Support technique - Géoportail démo SDOL", h1_style))
    elements.append(Paragraph("En cas de problème de chargement, signaler à HKD :", body_style))
    elements.append(Paragraph("• Date et heure du problème", bullet_style))
    elements.append(Paragraph("• Thème concerné", bullet_style))
    elements.append(Paragraph("• Capture d'écran de la composition de la carte", bullet_style))

    # ===== 6. COMMUNICATION =====
    elements.append(Paragraph("6. Communication", h1_style))
    elements.append(Paragraph("• Communication nécessaire pour la désactivation des géoportails communaux", bullet_style))
    elements.append(Paragraph("• <b>SDOL prend en charge</b> la communication", bullet_style))
    elements.append(Paragraph("• <b>À venir</b> : projet de communication envoyé par e-mail aux communes", bullet_style))

    # ===== 7. ORTHOPHOTO 2026 =====
    elements.append(Paragraph("7. Orthophoto 2026", h1_style))

    ortho_data = [
        ["Élément", "Détail"],
        ["Mandat", "Adjugé à Elimap (5 offres, moins-disant retenu)"],
        ["Budget", "SDOL 2025, facture payée par SDOL"],
        ["Technologie", "Drone pentacam (conforme cahier des charges GT)"],
        ["Vol été 2025", "Uzufly ✓ (réalisé)"],
        ["Vol mars 2026", "Elimap (date précise demandée par GT)"],
    ]
    t = Table(ortho_data, colWidths=[4*cm, 11*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2874a6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph("<b>Avis du GT :</b> Laisser Elimap travailler selon le cahier des charges, trop de supervision risque de les freiner.", body_style))
    elements.append(Paragraph("<b>À venir :</b> SDOL transmet les informations par mail prochainement.", body_style))

    # ===== 8. BUDGET 2026 =====
    elements.append(Paragraph("8. Budget 2026 - Développement géoportail", h1_style))
    elements.append(Paragraph("• <b>Pas de budget prévu</b> pour le développement de couches en 2026 (situation susceptible d'évoluer)", bullet_style))
    elements.append(Paragraph("• <b>Problématique</b> : Si une commune développe une couche, elle \"paie\" pour les 7 autres", bullet_style))
    elements.append(Paragraph("<b>Propositions :</b>", body_style))
    elements.append(Paragraph("• Organiser une réunion pour définir un coût type de développement de couche", bullet_style))
    elements.append(Paragraph("• Anticiper les thématiques à développer pour mutualiser et réduire les coûts", bullet_style))
    elements.append(Paragraph("• Prioriser les couches et présenter au groupe décisionnel pour débloquer des budgets", bullet_style))

    # ===== PAGE 2 : POINTS CLÉS =====
    elements.append(PageBreak())

    elements.append(Paragraph("POINTS CLÉS POUR LA SÉANCE DE SERVICE", title_style))
    elements.append(Spacer(1, 0.5*cm))

    # Ligne séparatrice
    elements.append(line_table)
    elements.append(Spacer(1, 0.5*cm))

    # Décisions importantes
    section_title = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=12,
        spaceBefore=12,
        spaceAfter=8,
        textColor=colors.white,
        backColor=colors.HexColor('#1a5276'),
        borderPadding=(8, 8, 8, 8),
    )

    elements.append(Paragraph("DÉCISIONS IMPORTANTES", section_title))
    elements.append(Paragraph("• Les municipalités ont acté par écrit l'abandon des géoportails communaux", bullet_style))
    elements.append(Paragraph("• Logo du géoportail intercommunal validé par le GT (ajustements mineurs à faire)", bullet_style))
    elements.append(Paragraph("• Format d'impression limité au A3 sur le géoportail", bullet_style))

    elements.append(Paragraph("INFORMATION CONFIDENTIELLE", section_title))
    elements.append(Paragraph("⚠️ Nom retenu pour le géoportail : \"Carto Ouest\" - En attente validation groupe décisionnel, ne pas communiquer", warning_style))

    elements.append(Paragraph("ACTIONS POUR BUSSIGNY", section_title))
    actions_data = [
        ["☐", "Remonter les besoins en échelles d'affichage et d'impression à HKD"],
        ["☐", "Participer à la définition d'un coût type de développement de couche"],
        ["☐", "Réfléchir aux thématiques prioritaires à développer"],
    ]
    t = Table(actions_data, colWidths=[1*cm, 14*cm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)

    elements.append(Paragraph("DATES À RETENIR", section_title))
    dates_data = [
        ["28 janvier 2026", "Prochaine séance groupe décisionnel SDOL (GT invité)"],
        ["Mars 2026", "Vol drone orthophoto (Elimap)"],
    ]
    t = Table(dates_data, colWidths=[4*cm, 11*cm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#d5f5e3')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)

    elements.append(Paragraph("À SURVEILLER", section_title))
    elements.append(Paragraph("• Réception du projet de communication SDOL par e-mail", bullet_style))
    elements.append(Paragraph("• Réception des informations sur le vol orthophoto par e-mail", bullet_style))
    elements.append(Paragraph("• Évolution des négociations avec TVT (cloisonnement données réseaux)", bullet_style))

    # Footer
    elements.append(Spacer(1, 1*cm))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#999999'),
        alignment=TA_CENTER
    )
    elements.append(Paragraph("PV rédigé avec l'assistance de GeoBrain - Commune de Bussigny", footer_style))

    # Génération
    doc.build(elements)
    print(f"PDF généré : {OUTPUT_FILE}")

if __name__ == "__main__":
    create_pv_pdf()
