# -*- coding: utf-8 -*-
"""
Génération du rapport Migration SDOL - Format Bussigny
"""
import sys
sys.path.insert(0, r'C:\Users\zema\GeoBrain\scripts\python')

from bussigny_pdf import (
    BussignyDocTemplate, get_styles, create_metadata_table,
    create_separator, create_table, CONTENT_WIDTH, BLEU_BUSSIGNY
)
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak
from reportlab.lib.units import cm
from reportlab.lib import colors

OUTPUT_PATH = r"C:\Users\zema\GeoBrain\projets\Migration_SDOL\RAPPORT_MIGRATION_SDOL_v2.pdf"

def generate():
    doc = BussignyDocTemplate(
        OUTPUT_PATH,
        doc_description="Rapport Migration SDOL"
    )
    styles = get_styles()
    elements = []

    # Titre
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph("RAPPORT DE MIGRATION", styles['BTitle']))
    elements.append(Paragraph("Données Bussigny → SDOL (Carto Ouest)", styles['BSubtitle']))
    elements.append(Spacer(1, 0.3 * cm))

    # Métadonnées
    elements.append(create_metadata_table({
        "Date :": "18 décembre 2025",
        "Projet :": "Intégration géoportail intercommunal Ouest Lausannois",
        "Responsable :": "Marc Zermatten, Responsable géodonnées et SIT",
        "Prestataire :": "HKD Géomatique"
    }))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.5 * cm))

    # Section 1 - Contexte
    elements.append(Paragraph("1. Contexte et objectif", styles['BH1']))
    elements.append(Paragraph(
        "Ce rapport présente le mapping complet des données géographiques de la commune de Bussigny "
        "vers la base de données SDOL pour leur diffusion via le géoportail intercommunal Carto Ouest.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>Architecture :</b>", styles['BBody']))
    elements.append(Paragraph("• <b>Source</b> : PostgreSQL srv-fme (schémas assainissement, fibre_optique, route, nature, ouvrages_speciaux)", styles['BBullet']))
    elements.append(Paragraph("• <b>Cible</b> : PostgreSQL postgres.hkd-geomatique.com/sdol, schéma back_hkd_databy", styles['BBullet']))
    elements.append(Paragraph("• <b>Outil</b> : FME (migration ponctuelle depuis srv-fme)", styles['BBullet']))
    elements.append(Spacer(1, 0.3 * cm))

    # Section 2 - Périmètre
    elements.append(Paragraph("2. Périmètre de migration", styles['BH1']))

    # Tableau thématiques incluses
    data_inclus = [
        ["Thématique", "Schéma source", "Tables SDOL cibles", "Statut"],
        ["Assainissement", "assainissement", "eu_chambre, eu_collecteur, eu_grille", "✓ OK"],
        ["Routes", "route", "mob_rte_classe_tr, mob_stationnement", "✓ OK"],
        ["Transports publics", "route", "tp_bus_*, tp_train_*", "✓ OK"],
        ["Nature", "nature", "en_arbre_p", "✓ OK"],
        ["Ouvrages d'art", "ouvrages_speciaux", "oa_ouvart_s", "✓ OK"],
    ]
    t_inclus = Table(data_inclus, colWidths=[3.5*cm, 3.5*cm, 5.5*cm, 2.5*cm])
    t_inclus.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (-1, 1), (-1, -1), 'CENTER'),
    ]))
    elements.append(t_inclus)
    elements.append(Spacer(1, 0.3 * cm))

    elements.append(Paragraph("<b>Thématiques exclues :</b>", styles['BBody']))
    elements.append(Paragraph("• Eau potable (géré par SEL/SDOL)", styles['BBullet']))
    elements.append(Paragraph("• Cadastre BDCO (commandé collectivement par SDOL)", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>Thématiques bloquées (tables à créer) :</b>", styles['BBody']))
    elements.append(Paragraph("• <b>Fibre optique</b> : Les tables tc_swisscom_* sont réservées à Swisscom → <b>demander création tc_fo_conduite, tc_fo_elemontage</b>", styles['BBullet']))
    elements.append(Paragraph("• <b>Points d'intérêt</b> : Aucune table équivalente → <b>demander création table pti_*</b>", styles['BBullet']))
    elements.append(Spacer(1, 0.3 * cm))

    # Section 3 - Synthèse mappings
    elements.append(Paragraph("3. Synthèse des mappings", styles['BH1']))

    elements.append(Paragraph("<b>3.1 Assainissement</b> (mapping le plus détaillé)", styles['BBody']))
    elements.append(Paragraph("• by_ass_chambre → eu_chambre (27 colonnes, domaines documentés)", styles['BBullet']))
    elements.append(Paragraph("• by_ass_collecteur → eu_collecteur (22 colonnes)", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>3.2 Fibre optique - BLOQUÉ</b>", styles['BBody']))
    elements.append(Paragraph("⚠ Les tables tc_swisscom_* sont réservées à Swisscom. En attente création tables tc_fo_*.", styles['BBullet']))
    elements.append(Paragraph("• Mapping préparé : fo_segment, fo_tube_geo, fo_cable_geo → tc_fo_conduite", styles['BBullet']))
    elements.append(Paragraph("• Mapping préparé : fo_chambre, fo_armoire, etc. → tc_fo_elemontage", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>3.3 Nature</b>", styles['BBody']))
    elements.append(Paragraph("• by_nat_arbre_vergers → en_arbre_p", styles['BBullet']))
    elements.append(Paragraph("• by_nat_parcours_nature → en_nat_liaison (ou mob_chem_ped_l ?)", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>3.4 Routes</b>", styles['BBody']))
    elements.append(Paragraph("• by_rte_troncon → mob_rte_classe_tr, mob_rte_etat_tr", styles['BBullet']))
    elements.append(Paragraph("• by_rte_vitesse → mob_rte_restri_tr", styles['BBullet']))
    elements.append(Paragraph("• by_rte_zone_* → mob_stationnement", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>3.5 Transports publics</b>", styles['BBody']))
    elements.append(Paragraph("• by_transport_public_a/l/s → tp_bus_*, tp_train_*", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>3.6 Ouvrages d'art</b>", styles['BBody']))
    elements.append(Paragraph("• by_ouvrages_speciaux_s → oa_ouvart_s (direct)", styles['BBullet']))
    elements.append(Paragraph("• by_ouvrages_speciaux_p/l → oa_ouvart_s (via ST_Buffer)", styles['BBullet']))
    elements.append(Spacer(1, 0.3 * cm))

    # Section 4 - Volumétrie
    elements.append(Paragraph("4. Volumétrie estimée", styles['BH1']))

    data_vol = [
        ["Thématique", "Nb objets", "Statut"],
        ["Assainissement", "~30'000", "✓ OK"],
        ["Routes", "~2'000", "✓ OK"],
        ["Transports publics", "~100", "✓ OK"],
        ["Nature", "~500", "✓ OK"],
        ["Ouvrages d'art", "~50", "✓ OK"],
        ["Sous-total migrable", "~32'650", ""],
        ["Fibre optique", "~5'000", "⚠ Bloqué"],
        ["Points d'intérêt", "~200", "⚠ Bloqué"],
        ["Sous-total en attente", "~5'200", ""],
    ]
    t_vol = Table(data_vol, colWidths=[5*cm, 3*cm, 3*cm])
    t_vol.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 5), (-1, 5), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 5), (-1, 5), colors.Color(0.9, 0.95, 0.9)),
        ('BACKGROUND', (0, -1), (-1, -1), colors.Color(1, 0.95, 0.9)),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(t_vol)
    elements.append(Spacer(1, 0.3 * cm))

    # Section 5 - Questions
    elements.append(PageBreak())
    elements.append(Paragraph("5. Questions à clarifier", styles['BH1']))

    elements.append(Paragraph("<b>Structures et domaines :</b>", styles['BBody']))
    elements.append(Paragraph("1. Structure exacte des tables SDOL (colonnes, types, contraintes) ?", styles['BBullet']))
    elements.append(Paragraph("2. Liste exhaustive des valeurs de domaines acceptées ?", styles['BBullet']))
    elements.append(Paragraph("3. Valeur data_owner : 'BY' ou 'Bussigny' ou code OFS ?", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>Conversions géométriques :</b>", styles['BBody']))
    elements.append(Paragraph("4. Ouvrages Point/Ligne → Polygon via ST_Buffer : acceptable ?", styles['BBullet']))
    elements.append(Paragraph("5. Parcours nature : table en_nat_liaison ou mob_chem_ped_l ?", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>Tables manquantes (PRIORITAIRE) :</b>", styles['BBody']))
    elements.append(Paragraph("6. Création de tables tc_fo_conduite et tc_fo_elemontage pour la fibre communale ?", styles['BBullet']))
    elements.append(Paragraph("7. Création d'une table pti_* pour les points d'intérêt ?", styles['BBullet']))
    elements.append(Paragraph("8. Colonnes BY sans équivalent SDOL : ignorer ou stocker dans remarque ?", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>Processus :</b>", styles['BBody']))
    elements.append(Paragraph("9. Fréquence de synchronisation : one-shot ou périodique ?", styles['BBullet']))
    elements.append(Paragraph("10. Qui valide après migration ?", styles['BBullet']))
    elements.append(Paragraph("11. Procédure de test/recette ?", styles['BBullet']))
    elements.append(Spacer(1, 0.3 * cm))

    # Section 6 - Prochaines étapes
    elements.append(Paragraph("6. Prochaines étapes", styles['BH1']))

    elements.append(Paragraph("<b>Phase 1 - Validation</b>", styles['BBody']))
    elements.append(Paragraph("• Obtenir réponses aux questions ci-dessus", styles['BBullet']))
    elements.append(Paragraph("• Valider domaines de valeurs avec HKD", styles['BBullet']))
    elements.append(Paragraph("• Confirmer création table POI", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>Phase 2 - Développement</b>", styles['BBody']))
    elements.append(Paragraph("• Finaliser scripts SQL de migration", styles['BBullet']))
    elements.append(Paragraph("• Créer workbenches FME (1 par thématique)", styles['BBullet']))
    elements.append(Paragraph("• Tester sur échantillons (10 objets par type)", styles['BBullet']))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Paragraph("<b>Phase 3 - Migration</b>", styles['BBody']))
    elements.append(Paragraph("• Migration données de test", styles['BBullet']))
    elements.append(Paragraph("• Validation visuelle dans Carto Ouest", styles['BBullet']))
    elements.append(Paragraph("• Migration complète", styles['BBullet']))
    elements.append(Paragraph("• Documentation post-migration", styles['BBullet']))
    elements.append(Spacer(1, 0.5 * cm))

    # Section 7 - Fichiers
    elements.append(create_separator())
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(Paragraph("7. Fichiers de référence", styles['BH1']))

    data_files = [
        ["Fichier", "Contenu"],
        ["00_reference_sdol_excel.md", "Tables et domaines SDOL (extrait Excel HKD)"],
        ["mapping_bussigny_sdol.md", "Assainissement (détaillé avec domaines)"],
        ["04_mapping_fibre_optique.md", "Fibre optique (BLOQUÉ)"],
        ["05_mapping_nature.md", "Nature (arbres, parcours)"],
        ["06_mapping_routes.md", "Routes et mobilité"],
        ["07_mapping_transports_publics.md", "Transports publics"],
        ["08_mapping_ouvrages_art.md", "Ouvrages d'art"],
    ]
    t_files = Table(data_files, colWidths=[6*cm, 9*cm])
    t_files.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTNAME', (0, 1), (0, -1), 'Courier'),
    ]))
    elements.append(t_files)

    # ANNEXE - Mapping exhaustif
    elements.append(PageBreak())
    elements.append(Paragraph("ANNEXE : MAPPING EXHAUSTIF", styles['BTitle']))
    elements.append(Spacer(1, 0.5 * cm))

    # A1 - Assainissement Chambres
    elements.append(Paragraph("A1. Assainissement - Chambres", styles['BH1']))
    elements.append(Paragraph("<b>by_ass_chambre → eu_chambre</b>", styles['BBody']))
    data_ass_ch = [
        ["Source BY", "Cible SDOL", "Transformation"],
        ["designation", "no_obj", "Direct"],
        ["genre_chambre", "type_ouvr", "Domaine (chambre, grille...)"],
        ["fonction_hydro", "fonction", "Domaine"],
        ["materiau_chambre", "cheminee_mtx", "Domaine"],
        ["annee_construction", "constr_an", "EXTRACT(YEAR)"],
        ["etat", "etat_constr", "Domaine (bon, moyen, mauvais)"],
        ["acces", "accessibilite", "Domaine"],
        ["cote_radier", "alt_radi", "Direct"],
        ["profondeur", "profondeur", "Direct"],
        ["dimension_1 + dimension_2", "dim_ch", "Concat (ex: '100x80')"],
        ["precision_alti", "precis_pl", "Domaine"],
        ["determination_plani", "mode_acqui", "Domaine"],
        ["proprietaire", "proprio", "Domaine (communal, prive)"],
        ["remarque", "remarque", "Direct"],
        ["chambre_double", "ch_dbl_on", "Boolean"],
        ["geom", "geom", "Direct (Point)"],
        ["-", "contenu", "'EU'/'EC'/'MX' selon fonction"],
        ["-", "utilisat", "'en_service' (défaut)"],
        ["-", "nom_comm", "'Bussigny'"],
        ["-", "no_comm", "'5624'"],
        ["-", "coord_nord", "ST_Y(geom)"],
        ["-", "coord_est", "ST_X(geom)"],
        ["-", "data_owner", "'by'"],
    ]
    t = Table(data_ass_ch, colWidths=[5*cm, 4*cm, 6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.4 * cm))

    # A2 - Assainissement Collecteurs
    elements.append(Paragraph("A2. Assainissement - Collecteurs", styles['BH1']))
    elements.append(Paragraph("<b>by_ass_collecteur → eu_collecteur</b>", styles['BBody']))
    data_ass_col = [
        ["Source BY", "Cible SDOL", "Transformation"],
        ["materiau", "materiau", "Domaine"],
        ["fonction_hydro", "fonction", "Domaine"],
        ["fonction_hierarchique", "hierarchie", "Domaine"],
        ["determination_plani", "mode_acqui", "Domaine"],
        ["genre_utilisation", "contenu", "'EU'/'EC'/'MX'"],
        ["annee_construction", "constr_an", "EXTRACT(YEAR)"],
        ["etat", "etat_constr", "Domaine"],
        ["proprietaire", "proprio", "Domaine"],
        ["genre_profil", "profil", "Domaine"],
        ["precision_alti", "precis_pl", "Domaine"],
        ["largeur_profil", "diametre", "×1000 (m→mm)"],
        ["hauteur_max_profil", "hauteur", "×1000 (m→mm)"],
        ["date_inspection_1", "inspcam_date", "Direct"],
        ["remarque", "remarque", "Direct"],
        ["geom", "geom", "Direct (LineString)"],
        ["-", "nom_comm", "'Bussigny'"],
        ["-", "no_comm", "'5624'"],
        ["-", "length", "ST_Length(geom)"],
        ["-", "data_owner", "'by'"],
    ]
    t = Table(data_ass_col, colWidths=[5*cm, 4*cm, 6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.4 * cm))

    # A3 - Fibre optique linéaires
    elements.append(PageBreak())
    elements.append(Paragraph("A3. Fibre optique - Conduites", styles['BH1']))
    elements.append(Paragraph("<b>fo_segment, fo_tube_geo, fo_cable_geo → tc_conduite</b>", styles['BBody']))
    data_fo_lin = [
        ["Source BY", "Cible SDOL", "Transformation"],
        ["numero", "no_obj", "Direct"],
        ["etat_service (cable)", "utilisat", "Direct ou 'en service'"],
        ["-", "proprio", "'Commune de Bussigny'"],
        ["id_determination_planimetrique", "precis_pl", "Lookup"],
        ["-", "provenance", "'AutoCAD Map 3D'"],
        ["materiau (tube) / type_gaine (cable)", "materiau", "Direct"],
        ["dimension (tube) / section_cable", "diametre", "Direct"],
        ["date_pose", "constr_an", "EXTRACT(YEAR)"],
        ["- (tube)", "nb_tube", "1"],
        ["remarque", "remarque", "Direct"],
        ["date_pose", "releve_date", "Direct"],
        ["-", "maj_date", "CURRENT_DATE"],
        ["longueur", "length", "Direct"],
        ["geom", "geom", "Direct (LineString)"],
        ["-", "pk_uuid", "gen_random_uuid()"],
        ["-", "data_owner", "'BY'"],
    ]
    t = Table(data_fo_lin, colWidths=[5.5*cm, 4*cm, 5.5*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.4 * cm))

    # A4 - Fibre optique ponctuels
    elements.append(Paragraph("A4. Fibre optique - Éléments de montage", styles['BH1']))
    elements.append(Paragraph("<b>fo_chambre, fo_armoire, fo_manchon, fo_point_livraison → tc_elemontage</b>", styles['BBody']))
    data_fo_pt = [
        ["Source BY", "Cible SDOL", "Transformation"],
        ["numero", "no_obj", "Direct"],
        ["-", "utilisat", "'en service' ou lookup"],
        ["-", "proprio", "'Commune de Bussigny'"],
        ["id_determination_planimetrique", "precis_pl", "Lookup"],
        ["(selon table source)", "type_elem", "'chambre'/'armoire'/'manchon'/'point de livraison'"],
        ["-", "accessibilite", "NULL"],
        ["date_pose (chambre)", "constr_an", "EXTRACT(YEAR)"],
        ["remarque", "remarque", "Direct"],
        ["-", "releve_date", "NULL"],
        ["-", "maj_date", "CURRENT_DATE"],
        ["geom", "geom", "Direct (Point)"],
        ["-", "pk_uuid", "gen_random_uuid()"],
        ["-", "data_owner", "'BY'"],
    ]
    t = Table(data_fo_pt, colWidths=[5.5*cm, 4*cm, 5.5*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.4 * cm))

    # A5 - Nature
    elements.append(Paragraph("A5. Nature", styles['BH1']))
    elements.append(Paragraph("<b>by_nat_arbre_vergers → en_arbre_p</b>", styles['BBody']))
    data_nat_arbre = [
        ["Source BY", "Cible SDOL", "Transformation"],
        ["numero", "no_obj", "Direct"],
        ["-", "proprio", "'Commune de Bussigny'"],
        ["genre", "genre", "Direct"],
        ["sous_espece", "espece", "Direct"],
        ["-", "remarque", "NULL"],
        ["-", "maj_date", "CURRENT_DATE"],
        ["geom", "geom", "Direct (Point)"],
        ["-", "pk_uuid", "gen_random_uuid()"],
        ["-", "data_owner", "'BY'"],
    ]
    t = Table(data_nat_arbre, colWidths=[5*cm, 4*cm, 6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3 * cm))

    elements.append(Paragraph("<b>by_nat_parcours_nature → en_nat_liaison</b>", styles['BBody']))
    data_nat_parc = [
        ["Source BY", "Cible SDOL", "Transformation"],
        ["gid", "no_obj", "Cast texte"],
        ["nom", "nom", "Direct"],
        ["-", "type_liaison", "'parcours nature'"],
        ["remarque + description + url", "remarque", "Concat"],
        ["-", "maj_date", "CURRENT_DATE"],
        ["geom", "geom", "Direct (LineString)"],
        ["-", "pk_uuid", "gen_random_uuid()"],
        ["-", "data_owner", "'BY'"],
    ]
    t = Table(data_nat_parc, colWidths=[5*cm, 4*cm, 6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.4 * cm))

    # A6 - Routes
    elements.append(PageBreak())
    elements.append(Paragraph("A6. Routes", styles['BH1']))
    elements.append(Paragraph("<b>by_rte_troncon → mob_rte_classe_tr</b>", styles['BBody']))
    data_rte = [
        ["Source BY", "Cible SDOL", "Transformation"],
        ["gid", "no_obj", "Cast texte"],
        ["nom_rue", "nom_rue", "Direct"],
        ["classe_rte", "classe", "Direct"],
        ["cat_rte", "categorie", "Direct"],
        ["proprietaire", "proprio", "Direct"],
        ["resp_entretien", "gestionnaire", "Direct"],
        ["type_revetement", "revetement", "Direct"],
        ["largeur_troncon", "largeur", "Direct"],
        ["longueur", "longueur", "Direct"],
        ["remarque", "remarque", "Direct"],
        ["-", "maj_date", "CURRENT_DATE"],
        ["geom", "geom", "Direct (LineString)"],
        ["-", "pk_uuid", "gen_random_uuid()"],
        ["-", "data_owner", "'BY'"],
    ]
    t = Table(data_rte, colWidths=[5*cm, 4*cm, 6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3 * cm))

    elements.append(Paragraph("<b>by_rte_troncon → mob_rte_etat_tr</b>", styles['BBody']))
    data_rte_etat = [
        ["Source BY", "Cible SDOL", "Transformation"],
        ["gid", "no_obj", "Cast texte"],
        ["indice_i1", "indice_i1", "Direct"],
        ["sous_indice", "sous_indice", "Direct"],
        ["date_releve", "date_releve", "Direct"],
        ["prochaine_inspection", "prochaine_insp", "Direct"],
        ["remarque_etat", "remarque", "Direct"],
        ["geom", "geom", "Direct (LineString)"],
        ["-", "data_owner", "'BY'"],
    ]
    t = Table(data_rte_etat, colWidths=[5*cm, 4*cm, 6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3 * cm))

    elements.append(Paragraph("<b>by_rte_vitesse → mob_rte_restri_tr</b>", styles['BBody']))
    data_rte_vit = [
        ["Source BY", "Cible SDOL", "Transformation"],
        ["gid", "no_obj", "Cast texte"],
        ["-", "type_restri", "'limitation vitesse'"],
        ["vitesse_exist", "valeur", "Direct (ex: '30 km/h')"],
        ["nom_rue", "remarque", "Direct"],
        ["geom", "geom", "Direct (LineString)"],
        ["-", "data_owner", "'BY'"],
    ]
    t = Table(data_rte_vit, colWidths=[5*cm, 4*cm, 6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.4 * cm))

    # A7 - Transports publics
    elements.append(Paragraph("A7. Transports publics", styles['BH1']))
    elements.append(Paragraph("<b>by_transport_public_a → tp_bus_s</b>", styles['BBody']))
    data_tp = [
        ["Source BY", "Cible SDOL", "Transformation"],
        ["gid", "no_obj", "Cast texte"],
        ["nom_arret", "nom", "Direct"],
        ["CASE projete...", "remarque", "'Projeté' si TRUE"],
        ["-", "maj_date", "CURRENT_DATE"],
        ["geom", "geom", "Direct (Point)"],
        ["-", "pk_uuid", "gen_random_uuid()"],
        ["-", "data_owner", "'BY'"],
    ]
    t = Table(data_tp, colWidths=[5*cm, 4*cm, 6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.4 * cm))

    # A8 - Ouvrages d'art
    elements.append(Paragraph("A8. Ouvrages d'art", styles['BH1']))
    elements.append(Paragraph("<b>by_ouvrages_speciaux_* → oa_ouvart_s</b>", styles['BBody']))
    data_oa = [
        ["Source BY", "Cible SDOL", "Transformation"],
        ["gid", "no_obj", "Cast texte"],
        ["localisation", "nom", "Direct"],
        ["type", "type_ouvr", "Direct"],
        ["annee_pose", "annee_constr", "EXTRACT(YEAR)"],
        ["CASE actif...", "etat", "'en service'/'hors service'"],
        ["remarque", "remarque", "Direct"],
        ["-", "maj_date", "CURRENT_DATE"],
        ["geom (S)", "geom", "Direct (Polygon)"],
        ["geom (P)", "geom", "ST_Buffer(geom, 1)"],
        ["geom (L)", "geom", "ST_Buffer(geom, diam/2)"],
        ["-", "pk_uuid", "gen_random_uuid()"],
        ["-", "data_owner", "'BY'"],
    ]
    t = Table(data_oa, colWidths=[5*cm, 4*cm, 6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(t)

    # Générer
    doc.build(elements)
    print(f"PDF généré : {OUTPUT_PATH}")

if __name__ == "__main__":
    generate()
