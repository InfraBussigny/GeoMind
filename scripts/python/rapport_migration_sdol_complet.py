# -*- coding: utf-8 -*-
"""
Rapport complet de migration SDOL
=================================
Document professionnel pour présentation et discussion des points critiques
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from bussigny_pdf import (
    BussignyDocTemplate, get_styles, create_table, create_result_box,
    create_metadata_table, create_separator, format_date, format_number,
    BLEU_BUSSIGNY, GRIS_FOND, CONTENT_WIDTH, VERT_SUCCES
)
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, PageBreak, ListFlowable, ListItem
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from datetime import datetime

OUTPUT_DIR = r"C:\Users\zema\GeoBrain\projets\Migration_SDOL"


def create_pdf():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"{date_str}_Rapport_Migration_SDOL_Complet.pdf"
    filepath = os.path.join(OUTPUT_DIR, filename)

    doc = BussignyDocTemplate(
        filepath,
        doc_title="Rapport de migration",
        doc_description="Projet SDOL - Migration assainissement"
    )

    styles = get_styles()
    elements = []

    # Style personnalisé pour les listes
    bullet_style = ParagraphStyle(
        'BulletItem',
        parent=styles['Normal'],
        fontSize=10,
        leftIndent=20,
        spaceAfter=4
    )

    # ===========================================================================
    # PAGE DE TITRE
    # ===========================================================================
    elements.append(Spacer(1, 3*cm))
    elements.append(Paragraph("RAPPORT DE MIGRATION", styles['BTitle']))
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph("Données d'assainissement", styles['BSubtitle']))
    elements.append(Paragraph("Bussigny → SDOL (Géoportail intercommunal)", styles['BSubtitle']))
    elements.append(Spacer(1, 2*cm))

    # Infos document
    info_table = Table([
        ["Version", "1.0"],
        ["Date", format_date()],
        ["Auteur", "Marc Zermatten"],
        ["Service", "Infrastructures - Commune de Bussigny"],
        ["Statut", "Document de travail"],
    ], colWidths=[4*cm, 10*cm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
    ]))
    elements.append(info_table)

    elements.append(PageBreak())

    # ===========================================================================
    # TABLE DES MATIÈRES
    # ===========================================================================
    elements.append(Paragraph("TABLE DES MATIÈRES", styles['BH1']))
    elements.append(Spacer(1, 0.5*cm))

    toc_items = [
        ("1.", "Contexte et objectifs", "3"),
        ("2.", "Méthodologie d'analyse", "4"),
        ("3.", "Résultats de l'analyse", "5"),
        ("4.", "Points sensibles et discussions", "8"),
        ("5.", "Plan d'action", "10"),
        ("6.", "Ressources nécessaires", "11"),
        ("", "", ""),
        ("A.", "Annexe - Mapping détaillé CHAMBRES", "12"),
        ("B.", "Annexe - Mapping détaillé COLLECTEURS", "14"),
        ("C.", "Annexe - Mapping des domaines", "16"),
    ]

    toc_table = Table(toc_items, colWidths=[1*cm, 12*cm, 2*cm])
    toc_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
    ]))
    elements.append(toc_table)

    elements.append(PageBreak())

    # ===========================================================================
    # 1. CONTEXTE ET OBJECTIFS
    # ===========================================================================
    elements.append(Paragraph("1. Contexte et objectifs", styles['BH1']))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("1.1 Contexte du projet SDOL", styles['BH2']))
    elements.append(Paragraph(
        "Le SDOL (Schéma Directeur de l'Ouest Lausannois) pilote depuis 2023 un projet de "
        "<b>géoportail intercommunal unique</b> pour les 8 communes du district. Ce projet vise à "
        "mutualiser les données géographiques et à offrir une plateforme commune de consultation.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.2*cm))

    communes_table = create_table([
        ["Communes partenaires"],
        ["Bussigny, Chavannes-près-Renens, Crissier, Ecublens, Prilly, Renens, Saint-Sulpice, Villars-Ste-Croix"],
    ], col_widths=[15*cm])
    elements.append(communes_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("1.2 Objectif de la migration", styles['BH2']))
    elements.append(Paragraph(
        "L'objectif est de migrer les données d'<b>assainissement</b> de la base de données communale "
        "(PostgreSQL/PostGIS sur srv-fme) vers la base de données intercommunale SDOL hébergée par "
        "HKD Géomatique. Cette migration permettra :",
        styles['BBody']
    ))
    elements.append(Paragraph("• Centralisation des données d'assainissement au niveau intercommunal", bullet_style))
    elements.append(Paragraph("• Consultation via le géoportail SDOL (GeoMapFish)", bullet_style))
    elements.append(Paragraph("• Harmonisation des données entre communes", bullet_style))
    elements.append(Paragraph("• Maintenance mutualisée", bullet_style))
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("1.3 Périmètre de la migration", styles['BH2']))
    perimetre_table = create_table([
        ["Élément", "Inclus", "Commentaire"],
        ["Chambres de visite", "✅ Oui", "Table by_ass_chambre → eu_chambre"],
        ["Collecteurs", "✅ Oui", "Table by_ass_collecteur → eu_collecteur"],
        ["Couvercles", "⚠️ À évaluer", "Table by_ass_couvercle"],
        ["Exutoires", "⚠️ À évaluer", "Pas de table source identifiée"],
        ["Grilles", "⚠️ À évaluer", "Inclus dans chambres actuellement"],
    ], col_widths=[4*cm, 3*cm, 8*cm])
    elements.append(perimetre_table)

    elements.append(PageBreak())

    # ===========================================================================
    # 2. MÉTHODOLOGIE
    # ===========================================================================
    elements.append(Paragraph("2. Méthodologie d'analyse", styles['BH1']))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("2.1 Approche adoptée", styles['BH2']))
    elements.append(Paragraph(
        "L'analyse a été réalisée par connexion directe aux deux bases de données pour extraire "
        "et comparer les structures de manière automatisée.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.3*cm))

    methode_table = create_table([
        ["Étape", "Action", "Outil"],
        ["1", "Extraction structure base Bussigny", "psql via srv-fme"],
        ["2", "Extraction structure base SDOL", "psql via srv-fme (IP whitelistée)"],
        ["3", "Comparaison automatique des colonnes", "Script Python"],
        ["4", "Identification des correspondances", "Analyse sémantique"],
        ["5", "Mapping des domaines (valeurs)", "Analyse manuelle"],
        ["6", "Identification des points sensibles", "Revue croisée"],
    ], col_widths=[1.5*cm, 8*cm, 5.5*cm])
    elements.append(methode_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("2.2 Environnement technique", styles['BH2']))

    env_table = create_table([
        ["Environnement", "Détails"],
        ["Base source", "PostgreSQL/PostGIS - srv-fme:5432/Prod - schéma 'assainissement'"],
        ["Base cible", "PostgreSQL/PostGIS - postgres.hkd-geomatique.com:5432/sdol"],
        ["Schéma cible", "back_hkd_databy (schéma spécifique Bussigny)"],
        ["Accès SDOL", "Connexion autorisée uniquement depuis srv-fme (whitelist IP)"],
        ["Compte lecture", "by_lgr (actuellement sans droit LOGIN)"],
        ["Compte écriture", "by_fme_w (utilisé pour l'analyse)"],
    ], col_widths=[4*cm, 11*cm])
    elements.append(env_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("2.3 Contraintes identifiées", styles['BH2']))
    elements.append(Paragraph("• Accès à la base SDOL uniquement depuis srv-fme (pas depuis les postes clients)", bullet_style))
    elements.append(Paragraph("• Compte by_lgr non fonctionnel pour la connexion directe", bullet_style))
    elements.append(Paragraph("• Nécessité d'utiliser FME sur srv-fme pour la migration effective", bullet_style))

    elements.append(PageBreak())

    # ===========================================================================
    # 3. RÉSULTATS DE L'ANALYSE
    # ===========================================================================
    elements.append(Paragraph("3. Résultats de l'analyse", styles['BH1']))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("3.1 Volumétrie des données", styles['BH2']))

    elements.append(Paragraph("<b>Base Bussigny (source)</b>", styles['BBody']))
    vol_by_table = create_table([
        ["Table", "Nombre d'enregistrements", "Géométrie"],
        ["by_ass_chambre", "8'014", "Point"],
        ["by_ass_collecteur", "~7'500 (estimé)", "LineString"],
        ["by_ass_couvercle", "À vérifier", "Point"],
        ["by_ass_chambre_detail", "À vérifier", "-"],
    ], col_widths=[5*cm, 5*cm, 5*cm])
    elements.append(vol_by_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("<b>Base SDOL (cible)</b>", styles['BBody']))
    elements.append(Paragraph(
        "Le schéma back_hkd_databy contient <b>321 tables</b> couvrant l'ensemble des thématiques "
        "SIT (cadastre, routes, réseaux, environnement, etc.). Les tables d'assainissement sont "
        "préfixées 'eu_' (Eaux Usées).",
        styles['BBody']
    ))

    vol_sdol_table = create_table([
        ["Préfixe", "Thématique", "Nb tables"],
        ["eu_", "Assainissement (eaux usées/claires)", "~40"],
        ["ep_", "Eau potable", "~25"],
        ["mo_", "Mensuration officielle", "~25"],
        ["mob_", "Mobilité / Routes", "~20"],
        ["at_", "Aménagement du territoire", "~15"],
        ["Autres", "Divers (éclairage, gaz, nature, etc.)", "~196"],
    ], col_widths=[3*cm, 8*cm, 4*cm])
    elements.append(vol_sdol_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("3.2 Comparaison des structures", styles['BH2']))

    elements.append(Paragraph("<b>Table CHAMBRES</b>", styles['BBody']))
    comp_ch_table = create_table([
        ["Aspect", "Bussigny (by_ass_chambre)", "SDOL (eu_chambre)"],
        ["Nombre de colonnes", "39", "68"],
        ["Colonnes avec correspondance directe", "8", "8"],
        ["Colonnes nécessitant transformation", "12", "12"],
        ["Colonnes sans correspondance", "6", "-"],
        ["Colonnes SDOL à alimenter par défaut", "-", "15"],
    ], col_widths=[6*cm, 4.5*cm, 4.5*cm])
    elements.append(comp_ch_table)
    elements.append(Spacer(1, 0.2*cm))

    elements.append(Paragraph("<b>Table COLLECTEURS</b>", styles['BBody']))
    comp_coll_table = create_table([
        ["Aspect", "Bussigny (by_ass_collecteur)", "SDOL (eu_collecteur)"],
        ["Nombre de colonnes", "43", "97"],
        ["Colonnes avec correspondance directe", "5", "5"],
        ["Colonnes nécessitant transformation", "10", "10"],
        ["Colonnes sans correspondance", "8", "-"],
        ["Colonnes SDOL à alimenter par défaut", "-", "20"],
    ], col_widths=[6*cm, 4.5*cm, 4.5*cm])
    elements.append(comp_coll_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("3.3 Synthèse du mapping", styles['BH2']))

    # Encadré résumé
    resume_box = create_result_box(
        "Taux de couverture estimé : 70-75% des données Bussigny transférables directement"
    )
    elements.append(resume_box)
    elements.append(Spacer(1, 0.3*cm))

    synth_table = create_table([
        ["Type de mapping", "Chambres", "Collecteurs", "Action requise"],
        ["✅ Direct (copie)", "8 colonnes", "5 colonnes", "Aucune"],
        ["⚠️ Transformation", "12 colonnes", "10 colonnes", "Script SQL/FME"],
        ["⚠️ Domaine (valeurs)", "8 colonnes", "8 colonnes", "Table de correspondance"],
        ["📥 Valeur par défaut", "15 colonnes", "20 colonnes", "Valeur fixe"],
        ["❌ Sans correspondance", "6 colonnes", "8 colonnes", "Stockage remarque"],
    ], col_widths=[4.5*cm, 3*cm, 3*cm, 4.5*cm])
    elements.append(synth_table)

    elements.append(PageBreak())

    # ===========================================================================
    # 3.4 Détail des correspondances
    # ===========================================================================
    elements.append(Paragraph("3.4 Correspondances directes (sans transformation)", styles['BH2']))

    direct_table = create_table([
        ["Bussigny", "SDOL", "Type", "Description"],
        ["designation", "no_obj", "varchar", "Numéro de chambre/collecteur"],
        ["cote_radier / alt_radi", "alt_radi", "double", "Altitude du radier"],
        ["profondeur", "profondeur", "double", "Profondeur de l'ouvrage"],
        ["remarque", "remarque", "text", "Remarques libres"],
        ["geom", "geom", "geometry", "Géométrie (Point/LineString)"],
    ], col_widths=[4*cm, 3.5*cm, 2.5*cm, 5*cm])
    elements.append(direct_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("3.5 Transformations requises", styles['BH2']))

    transfo_table = create_table([
        ["Bussigny", "SDOL", "Transformation"],
        ["annee_construction (date)", "constr_an (integer)", "EXTRACT(YEAR FROM date)"],
        ["dimension_1 + dimension_2", "dim_ch (varchar)", "Concaténation '100x80'"],
        ["chambre_double (varchar)", "ch_dbl_on (boolean)", "Conversion booléenne"],
        ["largeur_profil (m)", "diametre (mm)", "Multiplication × 1000"],
        ["hauteur_max_profil (m)", "hauteur (mm)", "Multiplication × 1000"],
    ], col_widths=[5*cm, 4.5*cm, 5.5*cm])
    elements.append(transfo_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("3.6 Valeurs par défaut à injecter", styles['BH2']))

    defaut_table = create_table([
        ["Colonne SDOL", "Valeur", "Justification"],
        ["nom_comm", "'Bussigny'", "Nom de la commune"],
        ["no_comm", "'5624'", "Numéro OFS de Bussigny"],
        ["data_owner", "'by'", "Identifiant Bussigny dans SDOL"],
        ["coord_nord", "ST_Y(geom)", "Calculé depuis géométrie"],
        ["coord_est", "ST_X(geom)", "Calculé depuis géométrie"],
        ["length (collecteurs)", "ST_Length(geom)", "Longueur calculée"],
    ], col_widths=[4*cm, 4*cm, 7*cm])
    elements.append(defaut_table)

    elements.append(PageBreak())

    # ===========================================================================
    # 4. POINTS SENSIBLES ET DISCUSSIONS
    # ===========================================================================
    elements.append(Paragraph("4. Points sensibles et discussions", styles['BH1']))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("4.1 Points bloquants à résoudre", styles['BH2']))

    # Tableau avec fond coloré pour les bloquants
    bloq_table = Table([
        [Paragraph("<b>#</b>", styles['CellHeader']),
         Paragraph("<b>Problème</b>", styles['CellHeader']),
         Paragraph("<b>Impact</b>", styles['CellHeader']),
         Paragraph("<b>Solution proposée</b>", styles['CellHeader'])],
        [Paragraph("1", styles['CellNormal']),
         Paragraph("Compte by_lgr sans droit LOGIN", styles['CellNormal']),
         Paragraph("Impossible d'utiliser ce compte pour la lecture", styles['CellNormal']),
         Paragraph("Utiliser by_fme_w ou demander correction à HKD", styles['CellNormal'])],
        [Paragraph("2", styles['CellNormal']),
         Paragraph("Champs Bussigny sans équivalent SDOL", styles['CellNormal']),
         Paragraph("Perte de données (forme_chambre, dispositif_acces, orientation, eaux_infiltration)", styles['CellNormal']),
         Paragraph("Stocker dans champ 'remarque' ou créer vue locale", styles['CellNormal'])],
        [Paragraph("3", styles['CellNormal']),
         Paragraph("Domaines non validés", styles['CellNormal']),
         Paragraph("Risque d'erreurs d'insertion si valeurs non reconnues", styles['CellNormal']),
         Paragraph("Valider la liste des valeurs SDOL avec HKD", styles['CellNormal'])],
    ], colWidths=[0.8*cm, 4.2*cm, 4.5*cm, 5.5*cm])
    bloq_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#c0392b')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(bloq_table)
    elements.append(Spacer(1, 0.4*cm))

    elements.append(Paragraph("4.2 Points à clarifier avec HKD", styles['BH2']))

    clarif_table = Table([
        [Paragraph("<b>#</b>", styles['CellHeader']),
         Paragraph("<b>Question</b>", styles['CellHeader']),
         Paragraph("<b>Contexte</b>", styles['CellHeader'])],
        [Paragraph("1", styles['CellNormal']),
         Paragraph("Quel champ pour le matériau chambre ?", styles['CellNormal']),
         Paragraph("SDOL a 'cheminee_mtx', 'fond_mtx', 'couv_mtx'. Lequel utiliser ?", styles['CellNormal'])],
        [Paragraph("2", styles['CellNormal']),
         Paragraph("Format attendu pour les dimensions ?", styles['CellNormal']),
         Paragraph("Bussigny: 2 champs (dim1, dim2). SDOL: 1 champ texte (dim_ch). Format '100x80' OK ?", styles['CellNormal'])],
        [Paragraph("3", styles['CellNormal']),
         Paragraph("Liste exhaustive des valeurs de domaines ?", styles['CellNormal']),
         Paragraph("Besoin de la liste des valeurs acceptées pour proprio, etat_constr, materiau, type_ouvr, etc.", styles['CellNormal'])],
        [Paragraph("4", styles['CellNormal']),
         Paragraph("Gestion des chambres doubles ?", styles['CellNormal']),
         Paragraph("Bussigny: suffixe .1, .2 dans désignation. SDOL: champ booléen ch_dbl_on. Logique à confirmer.", styles['CellNormal'])],
        [Paragraph("5", styles['CellNormal']),
         Paragraph("Tables supplémentaires à migrer ?", styles['CellNormal']),
         Paragraph("Couvercles, grilles, exutoires: tables SDOL correspondantes ?", styles['CellNormal'])],
    ], colWidths=[0.8*cm, 5.5*cm, 8.7*cm])
    clarif_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f39c12')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(clarif_table)
    elements.append(Spacer(1, 0.4*cm))

    elements.append(Paragraph("4.3 Points validés", styles['BH2']))

    valid_table = Table([
        [Paragraph("<b>Élément</b>", styles['CellHeader']),
         Paragraph("<b>Statut</b>", styles['CellHeader']),
         Paragraph("<b>Détail</b>", styles['CellHeader'])],
        [Paragraph("Système de coordonnées", styles['CellNormal']),
         Paragraph("✅ Compatible", styles['CellNormal']),
         Paragraph("MN95 (EPSG:2056) des deux côtés", styles['CellNormal'])],
        [Paragraph("Type de géométrie", styles['CellNormal']),
         Paragraph("✅ Compatible", styles['CellNormal']),
         Paragraph("Point pour chambres, LineString pour collecteurs", styles['CellNormal'])],
        [Paragraph("Connexion base SDOL", styles['CellNormal']),
         Paragraph("✅ Fonctionnel", styles['CellNormal']),
         Paragraph("Via srv-fme avec compte by_fme_w", styles['CellNormal'])],
        [Paragraph("Structure générale", styles['CellNormal']),
         Paragraph("✅ Compatible", styles['CellNormal']),
         Paragraph("Modèle de données cohérent", styles['CellNormal'])],
    ], colWidths=[5*cm, 3*cm, 7*cm])
    valid_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#27ae60')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(valid_table)

    elements.append(PageBreak())

    # ===========================================================================
    # 5. PLAN D'ACTION
    # ===========================================================================
    elements.append(Paragraph("5. Plan d'action", styles['BH1']))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("5.1 Phases de la migration", styles['BH2']))

    phases_table = create_table([
        ["Phase", "Description", "Livrables"],
        ["1. Validation", "Valider le mapping avec HKD, clarifier les points en suspens", "PV de validation, mapping finalisé"],
        ["2. Développement", "Créer le workbench FME de migration", "Fichier .fmw documenté"],
        ["3. Test", "Migrer un échantillon (100 chambres, 100 collecteurs)", "Rapport de test, corrections"],
        ["4. Migration", "Migration complète des données", "Données migrées, logs"],
        ["5. Validation", "Contrôle qualité post-migration", "Rapport de validation"],
        ["6. Documentation", "Documentation de la procédure de MAJ", "Guide de maintenance"],
    ], col_widths=[2.5*cm, 7*cm, 5.5*cm])
    elements.append(phases_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("5.2 Détail des tâches", styles['BH2']))

    elements.append(Paragraph("<b>Phase 1 - Validation (pré-requis)</b>", styles['BBody']))
    elements.append(Paragraph("• Réunion avec HKD pour valider le mapping proposé", bullet_style))
    elements.append(Paragraph("• Obtenir la liste exhaustive des domaines SDOL", bullet_style))
    elements.append(Paragraph("• Clarifier les 5 points en suspens (§4.2)", bullet_style))
    elements.append(Paragraph("• Valider le périmètre final (chambres + collecteurs + ?)", bullet_style))
    elements.append(Spacer(1, 0.2*cm))

    elements.append(Paragraph("<b>Phase 2 - Développement FME</b>", styles['BBody']))
    elements.append(Paragraph("• Créer le workbench de lecture source (PostgreSQL Bussigny)", bullet_style))
    elements.append(Paragraph("• Implémenter les transformations (AttributeManager, ValueMapper)", bullet_style))
    elements.append(Paragraph("• Créer les tables de correspondance des domaines", bullet_style))
    elements.append(Paragraph("• Configurer l'écriture cible (PostgreSQL SDOL)", bullet_style))
    elements.append(Paragraph("• Gérer les cas particuliers (chambres doubles, valeurs nulles)", bullet_style))
    elements.append(Spacer(1, 0.2*cm))

    elements.append(Paragraph("<b>Phase 3 - Test</b>", styles['BBody']))
    elements.append(Paragraph("• Extraire un échantillon représentatif", bullet_style))
    elements.append(Paragraph("• Exécuter la migration test", bullet_style))
    elements.append(Paragraph("• Vérifier les données dans le géoportail SDOL", bullet_style))
    elements.append(Paragraph("• Corriger les anomalies identifiées", bullet_style))
    elements.append(Spacer(1, 0.2*cm))

    elements.append(Paragraph("<b>Phase 4 - Migration complète</b>", styles['BBody']))
    elements.append(Paragraph("• Planifier la fenêtre de migration (hors heures ouvrées)", bullet_style))
    elements.append(Paragraph("• Sauvegarder les données existantes", bullet_style))
    elements.append(Paragraph("• Exécuter la migration complète", bullet_style))
    elements.append(Paragraph("• Vérification immédiate post-migration", bullet_style))

    elements.append(PageBreak())

    # ===========================================================================
    # 6. RESSOURCES NÉCESSAIRES
    # ===========================================================================
    elements.append(Paragraph("6. Ressources nécessaires", styles['BH1']))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("6.1 Ressources humaines", styles['BH2']))

    rh_table = create_table([
        ["Rôle", "Personne/Entité", "Charge estimée"],
        ["Chef de projet", "Marc Zermatten (Bussigny)", "Coordination, validation"],
        ["Développeur FME", "Marc Zermatten (Bussigny)", "2-3 jours"],
        ["Support technique SDOL", "HKD Géomatique", "À définir"],
        ["Validation métier", "Service Infrastructures", "1/2 journée"],
    ], col_widths=[4*cm, 5.5*cm, 5.5*cm])
    elements.append(rh_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("6.2 Ressources techniques", styles['BH2']))

    tech_table = create_table([
        ["Ressource", "Disponibilité", "Remarque"],
        ["FME Desktop", "✅ Disponible", "Licence sur srv-fme"],
        ["Accès PostgreSQL Bussigny", "✅ Disponible", "Compte postgres"],
        ["Accès PostgreSQL SDOL", "✅ Disponible", "Compte by_fme_w (via srv-fme)"],
        ["Documentation SDOL", "⚠️ À obtenir", "Demander à HKD"],
    ], col_widths=[5*cm, 3.5*cm, 6.5*cm])
    elements.append(tech_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("6.3 Prérequis avant démarrage", styles['BH2']))
    elements.append(Paragraph("☐ Validation du mapping par HKD", bullet_style))
    elements.append(Paragraph("☐ Réception des tables de domaines SDOL", bullet_style))
    elements.append(Paragraph("☐ Clarification des 5 points en suspens", bullet_style))
    elements.append(Paragraph("☐ Confirmation du périmètre de migration", bullet_style))
    elements.append(Paragraph("☐ Planification de la fenêtre de migration", bullet_style))

    elements.append(PageBreak())

    # ===========================================================================
    # ANNEXE A - MAPPING CHAMBRES
    # ===========================================================================
    elements.append(Paragraph("Annexe A - Mapping détaillé CHAMBRES", styles['BH1']))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph("by_ass_chambre (Bussigny) → eu_chambre (SDOL)", styles['BSubtitle']))
    elements.append(Spacer(1, 0.3*cm))

    mapping_ch = [
        ["#", "Bussigny", "SDOL", "Type", "Statut"],
        ["1", "gid", "gid", "integer", "AUTO"],
        ["2", "fid", "-", "-", "IGNORE"],
        ["3", "designation", "no_obj", "varchar→char", "DIRECT"],
        ["4", "genre_chambre", "type_ouvr", "varchar→char", "DOMAINE"],
        ["5", "fonction_hydro", "fonction", "varchar→char", "DOMAINE"],
        ["6", "materiau_chambre", "cheminee_mtx", "varchar", "DOMAINE"],
        ["7", "forme_chambre", "-", "-", "ABSENT"],
        ["8", "eaux_infiltration", "-", "-", "ABSENT"],
        ["9", "annee_construction", "constr_an", "date→int", "TRANSFO"],
        ["10", "etat", "etat_constr", "varchar→char", "DOMAINE"],
        ["11", "acces", "accessibilite", "varchar→char", "DOMAINE"],
        ["12", "cote_radier", "alt_radi", "double", "DIRECT"],
        ["13", "profondeur", "profondeur", "double", "DIRECT"],
        ["14", "dispositif_acces", "-", "-", "ABSENT"],
        ["15", "dimension_1", "dim_ch", "double→varchar", "TRANSFO"],
        ["16", "dimension_2", "dim_ch", "double→varchar", "TRANSFO"],
        ["17", "fonction_chambre", "fonction", "varchar→char", "DOUBLON"],
        ["18", "precision_alti", "precis_pl", "varchar→char", "DOMAINE"],
        ["19", "determination_plani", "mode_acqui", "varchar→char", "DOMAINE"],
        ["20", "proprietaire", "proprio", "varchar→char", "DOMAINE"],
        ["21", "no_troncon_entree", "-", "-", "ABSENT"],
        ["22", "no_troncon_sortie", "-", "-", "ABSENT"],
        ["23", "orientation", "-", "-", "ABSENT"],
        ["24", "remarque", "remarque", "text→char", "DIRECT"],
        ["25", "geom", "geom", "Point", "DIRECT"],
        ["26", "chambre_double", "ch_dbl_on", "varchar→bool", "TRANSFO"],
    ]

    ch_table = Table(mapping_ch, colWidths=[0.8*cm, 4*cm, 4*cm, 3*cm, 2.7*cm])
    ch_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        # Couleurs selon statut
        ('BACKGROUND', (4, 2), (4, 2), colors.HexColor('#d5f5e3')),  # IGNORE
        ('BACKGROUND', (4, 3), (4, 3), colors.HexColor('#d5f5e3')),  # DIRECT
        ('BACKGROUND', (4, 7), (4, 7), colors.HexColor('#fadbd8')),  # ABSENT
        ('BACKGROUND', (4, 8), (4, 8), colors.HexColor('#fadbd8')),  # ABSENT
        ('BACKGROUND', (4, 14), (4, 14), colors.HexColor('#fadbd8')),  # ABSENT
        ('BACKGROUND', (4, 21), (4, 21), colors.HexColor('#fadbd8')),  # ABSENT
        ('BACKGROUND', (4, 22), (4, 22), colors.HexColor('#fadbd8')),  # ABSENT
        ('BACKGROUND', (4, 23), (4, 23), colors.HexColor('#fadbd8')),  # ABSENT
    ]))
    elements.append(ch_table)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("<b>Légende :</b> DIRECT=copie, DOMAINE=mapping valeurs, TRANSFO=transformation, ABSENT=pas de correspondance, AUTO=généré", styles['BBody']))

    elements.append(PageBreak())

    # ===========================================================================
    # ANNEXE B - MAPPING COLLECTEURS
    # ===========================================================================
    elements.append(Paragraph("Annexe B - Mapping détaillé COLLECTEURS", styles['BH1']))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph("by_ass_collecteur (Bussigny) → eu_collecteur (SDOL)", styles['BSubtitle']))
    elements.append(Spacer(1, 0.3*cm))

    mapping_coll = [
        ["#", "Bussigny", "SDOL", "Type", "Statut"],
        ["1", "gid", "gid", "integer", "AUTO"],
        ["2", "fid", "-", "-", "IGNORE"],
        ["3", "materiau", "materiau", "varchar→char", "DOMAINE"],
        ["4", "fonction_hydro", "fonction", "varchar→char", "DOMAINE"],
        ["5", "fonction_hierarchique", "hierarchie", "varchar→char", "DOMAINE"],
        ["6", "determination_plani", "mode_acqui", "varchar→char", "DOMAINE"],
        ["7", "genre_utilisation", "contenu", "varchar→char", "DOMAINE"],
        ["8", "annee_construction", "constr_an", "date→int", "TRANSFO"],
        ["9", "etat", "etat_constr", "varchar→char", "DOMAINE"],
        ["10", "proprietaire", "proprio", "varchar→char", "DOMAINE"],
        ["11", "genre_profil", "profil", "varchar→char", "DOMAINE"],
        ["12", "precision_alti", "precis_pl", "varchar→char", "DOMAINE"],
        ["13", "largeur_profil", "diametre", "double→int", "TRANSFO (×1000)"],
        ["14", "hauteur_max_profil", "hauteur", "double→int", "TRANSFO (×1000)"],
        ["15", "date_inspection_1", "inspcam_date", "date", "DIRECT"],
        ["16", "etat_inspection_1", "etat_constr", "varchar→char", "DOMAINE"],
        ["17", "date_inspection_2", "-", "-", "ABSENT"],
        ["18", "remarque", "remarque", "text", "DIRECT"],
        ["19", "default_1", "-", "-", "ABSENT"],
        ["20", "default_2", "-", "-", "ABSENT"],
        ["21", "mesure_1", "-", "-", "ABSENT"],
        ["22", "mesure_2", "-", "-", "ABSENT"],
        ["23", "remarque_tv", "remarque", "text", "CONCAT"],
        ["24", "geom", "geom", "LineString", "DIRECT"],
    ]

    coll_table = Table(mapping_coll, colWidths=[0.8*cm, 4*cm, 3.5*cm, 3*cm, 3.2*cm])
    coll_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(coll_table)

    elements.append(PageBreak())

    # ===========================================================================
    # ANNEXE C - MAPPING DOMAINES
    # ===========================================================================
    elements.append(Paragraph("Annexe C - Mapping des domaines (valeurs)", styles['BH1']))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("C.1 Propriétaire (proprio)", styles['BH2']))
    proprio_dom = create_table([
        ["Valeur Bussigny", "Valeur SDOL", "Validé"],
        ["Bussigny - Publique", "communal", "⚠️ À confirmer"],
        ["Privée", "prive", "⚠️ À confirmer"],
        ["CFF", "cff", "⚠️ À confirmer"],
    ], col_widths=[5*cm, 5*cm, 5*cm])
    elements.append(proprio_dom)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("C.2 État (etat_constr)", styles['BH2']))
    etat_dom = create_table([
        ["Valeur Bussigny", "Valeur SDOL", "Validé"],
        ["Bon", "bon", "⚠️ À confirmer"],
        ["Moyen", "moyen", "⚠️ À confirmer"],
        ["Mauvais", "mauvais", "⚠️ À confirmer"],
        ["Inconnu", "inconnu", "⚠️ À confirmer"],
    ], col_widths=[5*cm, 5*cm, 5*cm])
    elements.append(etat_dom)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("C.3 Type d'ouvrage (type_ouvr) - Chambres", styles['BH2']))
    type_dom = create_table([
        ["Valeur Bussigny (genre_chambre)", "Valeur SDOL", "Validé"],
        ["Chambre de visite", "chambre", "⚠️ À confirmer"],
        ["Cheneau", "grille", "⚠️ À confirmer"],
        ["Sac - Grille", "grille", "⚠️ À confirmer"],
        ["Chambre de décantation", "chambre_speciale", "⚠️ À confirmer"],
        ["Séparateur d'hydrocarbures", "separateur", "⚠️ À confirmer"],
        ["Station pompage", "station_pompage", "⚠️ À confirmer"],
        ["Chambre de rétention", "retention", "⚠️ À confirmer"],
        ["Déversoir d'orage", "deversoir", "⚠️ À confirmer"],
        ["Pipe de rinçage", "?", "❓ À définir"],
        ["Rejet au milieu récepteur", "exutoire", "⚠️ À confirmer"],
    ], col_widths=[5.5*cm, 4.5*cm, 5*cm])
    elements.append(type_dom)
    elements.append(Spacer(1, 0.3*cm))

    elements.append(Paragraph("C.4 Contenu (contenu) - Type d'eaux", styles['BH2']))
    contenu_dom = create_table([
        ["Valeur Bussigny", "Valeur SDOL", "Validé"],
        ["Eaux usées", "EU", "⚠️ À confirmer"],
        ["Eaux claires", "EC", "⚠️ À confirmer"],
        ["Mixte", "MX", "⚠️ À confirmer"],
        ["Inconnu", "INC", "⚠️ À confirmer"],
    ], col_widths=[5*cm, 5*cm, 5*cm])
    elements.append(contenu_dom)
    elements.append(Spacer(1, 0.5*cm))

    # Note finale
    note_box = Table([
        [Paragraph(
            "<b>IMPORTANT :</b> Tous les mappings de domaines sont proposés sur base de l'analyse "
            "sémantique. Ils doivent être validés avec HKD qui possède la liste exhaustive des "
            "valeurs acceptées dans la base SDOL.",
            styles['CellNormal']
        )]
    ], colWidths=[15*cm])
    note_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff3cd')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#ffc107')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(note_box)

    # Générer le PDF
    doc.build(elements)
    print(f"PDF généré : {filepath}")
    return filepath


if __name__ == "__main__":
    create_pdf()
