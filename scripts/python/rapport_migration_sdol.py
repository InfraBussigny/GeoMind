# -*- coding: utf-8 -*-
"""
Rapport technique - Migration des geodonnees vers SDOL
Commune de Bussigny - Decembre 2025
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from datetime import date
import os

# === CONFIGURATION CHARTE BUSSIGNY ===
LOGO_PATH = r"M:\7-Infra\0-Gest\2-Mod\7024_Logos\logo_bussigny_horizontal.png"

# Couleurs Bussigny
BLEU_BUSSIGNY = colors.HexColor('#366092')
GRIS_FONCE = colors.HexColor('#444444')
GRIS_MOYEN = colors.HexColor('#666666')
ORANGE = colors.HexColor('#e67e22')
VERT = colors.HexColor('#27ae60')
ROUGE = colors.HexColor('#c0392b')

MARGIN = 2 * cm


class BussignyDocTemplate(SimpleDocTemplate):
    """Template PDF avec en-tete et pied de page Bussigny."""

    def __init__(self, filename, doc_title="", doc_description="", **kwargs):
        self.doc_title = doc_title
        self.doc_description = doc_description
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

        if self.doc_description:
            self.canv.setFont('Helvetica', 8)
            self.canv.setFillColor(GRIS_MOYEN)
            self.canv.drawRightString(page_width - MARGIN, page_height - 1.5*cm, self.doc_description)

        self.canv.setStrokeColor(BLEU_BUSSIGNY)
        self.canv.setLineWidth(0.5)
        self.canv.line(MARGIN, page_height - 2.2*cm, page_width - MARGIN, page_height - 2.2*cm)

        self.canv.setFont('Helvetica', 8)
        self.canv.setFillColor(colors.black)
        self.canv.drawString(MARGIN, 0.8*cm, f"/{os.path.basename(self.file_path)}")
        self.canv.drawRightString(page_width - MARGIN, 0.8*cm, f"Page {self.canv.getPageNumber()}")

        self.canv.restoreState()


def get_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle('BTitle', parent=styles['Title'], fontSize=18, textColor=BLEU_BUSSIGNY,
                              alignment=TA_CENTER, spaceAfter=6))
    styles.add(ParagraphStyle('BSubtitle', parent=styles['Normal'], fontSize=11, textColor=GRIS_MOYEN,
                              alignment=TA_CENTER, spaceAfter=20))
    styles.add(ParagraphStyle('BH1', parent=styles['Heading1'], fontSize=14, textColor=BLEU_BUSSIGNY,
                              fontName='Helvetica-Bold', spaceBefore=20, spaceAfter=10))
    styles.add(ParagraphStyle('BH2', parent=styles['Heading2'], fontSize=12, textColor=GRIS_FONCE,
                              fontName='Helvetica-Bold', spaceBefore=14, spaceAfter=8))
    styles.add(ParagraphStyle('BH3', parent=styles['Heading3'], fontSize=10, textColor=GRIS_MOYEN,
                              fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=6))
    styles.add(ParagraphStyle('BBody', parent=styles['Normal'], fontSize=9, spaceAfter=6, alignment=TA_JUSTIFY))
    styles.add(ParagraphStyle('BBullet', parent=styles['Normal'], fontSize=9, leftIndent=15, spaceAfter=3))
    styles.add(ParagraphStyle('Alert', parent=styles['Normal'], fontSize=8, textColor=ROUGE,
                              backColor=colors.HexColor('#fadbd8'), borderPadding=6, spaceAfter=10, spaceBefore=6))
    styles.add(ParagraphStyle('Warning', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#7d6608'),
                              backColor=colors.HexColor('#fef9e7'), borderPadding=6, spaceAfter=10, spaceBefore=6))
    styles.add(ParagraphStyle('Info', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#1a5276'),
                              backColor=colors.HexColor('#d4e6f1'), borderPadding=6, spaceAfter=10, spaceBefore=6))
    styles.add(ParagraphStyle('Success', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#1e8449'),
                              backColor=colors.HexColor('#d5f5e3'), borderPadding=6, spaceAfter=10, spaceBefore=6))
    styles.add(ParagraphStyle('SectionHeader', parent=styles['Normal'], fontSize=9, textColor=colors.white,
                              backColor=BLEU_BUSSIGNY, fontName='Helvetica-Bold', borderPadding=5,
                              spaceBefore=12, spaceAfter=8))
    return styles


def create_table(data, col_widths, header_color=BLEU_BUSSIGNY):
    t = Table(data, colWidths=col_widths)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), header_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]
    t.setStyle(TableStyle(style))
    return t


def create_rapport():
    today = date.today().strftime("%Y-%m-%d")
    OUTPUT_FILE = rf"C:\Users\zema\GeoBrain\projets\Migration_SDOL\{today}_Rapport_Migration_SDOL_v2.pdf"
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    doc = BussignyDocTemplate(
        OUTPUT_FILE, pagesize=A4,
        rightMargin=MARGIN, leftMargin=MARGIN, topMargin=3*cm, bottomMargin=1.5*cm,
        doc_title="Rapport Migration SDOL", doc_description="Document technique - Migration geodonnees"
    )

    styles = get_styles()
    elements = []

    # === PAGE DE TITRE ===
    elements.append(Spacer(1, 2*cm))
    elements.append(Paragraph("RAPPORT TECHNIQUE", styles['BTitle']))
    elements.append(Paragraph("Migration des geodonnees communales vers SDOL", styles['BSubtitle']))
    elements.append(Spacer(1, 0.5*cm))

    info_data = [
        ["Date :", today],
        ["Auteur :", "Marc Zermatten, Responsable SIT"],
        ["Version :", "2.0 - Analyse complete"],
        ["Statut :", "EN ATTENTE DE VALIDATION"],
    ]
    t = Table(info_data, colWidths=[3*cm, 12*cm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 1*cm))

    elements.append(Paragraph(
        "Ce document presente l'analyse complete de la migration des geodonnees de Bussigny vers "
        "la base de donnees intercommunale SDOL. Il identifie <b>23 points sensibles</b> necessitant "
        "validation avant migration.", styles['BBody']))

    elements.append(PageBreak())

    # === TABLE DES MATIERES ===
    elements.append(Paragraph("TABLE DES MATIERES", styles['BH1']))
    toc = [
        "1. Contexte et objectifs",
        "2. Architecture SDOL",
        "3. Perimetre et volumetrie",
        "4. Methodologie de mapping",
        "5. Points sensibles - Assainissement (8 points)",
        "6. Points sensibles - Route (11 points)",
        "7. Points sensibles - Divers/Nature/POI (4 points)",
        "8. Synthese des decisions a prendre",
        "9. Prochaines etapes",
    ]
    for item in toc:
        elements.append(Paragraph(item, styles['BBullet']))
    elements.append(PageBreak())

    # === 1. CONTEXTE ===
    elements.append(Paragraph("1. Contexte et objectifs", styles['BH1']))
    elements.append(Paragraph(
        "Dans le cadre du projet de geoportail intercommunal SDOL, les donnees geographiques de la commune "
        "de Bussigny doivent etre migrees vers une base PostgreSQL/PostGIS mutualisee, hebergee par HKD Geomatique.",
        styles['BBody']))

    elements.append(Paragraph("1.1 Calendrier prevu", styles['BH2']))
    cal_data = [
        ["Echeance", "Jalon"],
        ["Decembre 2025", "Finalisation mapping et validation points sensibles"],
        ["Janvier 2026", "Developpement scripts FME et tests"],
        ["Debut 2026", "Mise en ligne geoportail intercommunal SDOL"],
        ["Courant 2026", "Desactivation geoportail communal Bussigny"],
    ]
    elements.append(create_table(cal_data, [4*cm, 11*cm]))

    elements.append(Paragraph("1.2 Connexions base de donnees", styles['BH2']))
    conn_data = [
        ["Composant", "Source (Bussigny)", "Cible (SDOL)"],
        ["Serveur", "srv-fme (interne)", "postgres.hkd-geomatique.com"],
        ["Base", "Prod", "sdol"],
        ["Schema", "assainissement, route, divers, nature, pts_interet", "back_hkd_databy"],
        ["Acces", "Direct", "Via srv-fme uniquement"],
    ]
    elements.append(create_table(conn_data, [3*cm, 6*cm, 6*cm]))

    elements.append(PageBreak())

    # === 2. ARCHITECTURE SDOL ===
    elements.append(Paragraph("2. Architecture SDOL", styles['BH1']))
    elements.append(Paragraph(
        "L'analyse des schemas accessibles revele une architecture <b>multi-tenant</b> ou chaque commune "
        "dispose de son propre schema isole.", styles['BBody']))

    elements.append(Paragraph("2.1 Schemas identifies", styles['BH2']))
    schema_data = [
        ["Schema", "Commune", "Acces by_fme_w"],
        ["back_hkd_databy", "Bussigny", "OUI (406 tables)"],
        ["back_hkd_datacri", "Crissier", "NON"],
        ["hkd_dataecu", "Ecublens", "NON"],
        ["hkd_datapy", "Prilly", "NON"],
        ["hkd_datacs", "Chavannes/St-Sulpice ?", "NON"],
        ["bbhn_datare", "Renens", "NON"],
        ["back_hkd_datasdol", "Donnees communes", "NON"],
    ]
    elements.append(create_table(schema_data, [4.5*cm, 5*cm, 5.5*cm]))

    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph(
        "<b>Implication</b> : Chaque commune ne peut acceder qu'a son propre schema. Impossible de voir "
        "le format des donnees deja migrees par les autres communes.", styles['Warning']))

    elements.append(Paragraph("2.2 Differences structurelles", styles['BH2']))
    diff_data = [
        ["Aspect", "Bussigny (source)", "SDOL (cible)"],
        ["Structure", "Normalisee (FK vers tables lookup)", "Denormalisee (valeurs texte)"],
        ["Valeurs domaine", "Tables by_*_val_*", "Commentaires PostgreSQL"],
        ["Geometries", "Mixte (points, lignes, surfaces)", "Types specifiques par table"],
        ["Identifiants", "gid (integer)", "gid + pk_uuid (UUID)"],
    ]
    elements.append(create_table(diff_data, [3.5*cm, 5.5*cm, 6*cm]))

    elements.append(PageBreak())

    # === 3. PERIMETRE ===
    elements.append(Paragraph("3. Perimetre et volumetrie", styles['BH1']))

    elements.append(Paragraph("3.1 Schemas exclus (geres par SDOL)", styles['BH2']))
    excl_data = [
        ["Schema", "Tables", "Raison"],
        ["bdco", "38", "Donnees cadastrales RF Vaud - commande collective SDOL"],
        ["externe", "4", "Donnees SEL (eau potable) - gestion intercommunale"],
    ]
    elements.append(create_table(excl_data, [3*cm, 2*cm, 10*cm], GRIS_MOYEN))

    elements.append(Paragraph("3.2 Donnees a migrer - Volumetrie", styles['BH2']))
    vol_data = [
        ["Schema", "Table", "Nb objets", "Table SDOL cible", "Priorite"],
        ["assainissement", "by_ass_collecteur", "15'031", "eu_collecteur", "HAUTE"],
        ["assainissement", "by_ass_chambre", "8'014", "eu_chambre", "HAUTE"],
        ["assainissement", "by_ass_couvercle", "6'424", "eu_chambre (colonnes)", "HAUTE"],
        ["assainissement", "by_ass_chambre_detail", "112", "- (symbologie)", "BASSE"],
        ["pts_interet", "by_pti_point_interet", "203", "??? (pas d'equivalent)", "MOYENNE"],
        ["route", "by_rte_troncon", "193", "mob_rte_classe_tr", "MOYENNE"],
        ["route", "by_rte_etat_troncon", "171", "mob_rte_etat_tr", "MOYENNE"],
        ["nature", "by_nat_arbre_vergers", "66", "en_arbre_p", "BASSE"],
        ["divers", "by_transport_public_l", "20", "tp_bus_l", "BASSE"],
        ["divers", "by_ouvrage_speciaux_l", "14", "oa_ouvart_s", "BASSE"],
        ["nature", "by_nat_parcours_nature", "6", "mob_chem_ped_l ?", "BASSE"],
        ["fibre_optique", "by_fo_* (?)", "?", "fo_* (?)", "A INVENTORIER"],
        ["route", "8 tables", "0", "-", "AUCUNE"],
    ]
    elements.append(create_table(vol_data, [2.5*cm, 3.5*cm, 1.5*cm, 4*cm, 2*cm]))

    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph(
        "<b>Total</b> : ~30'000 objets a migrer, dont 97% dans le schema assainissement.",
        styles['Success']))

    elements.append(PageBreak())

    # === 4. METHODOLOGIE ===
    elements.append(Paragraph("4. Methodologie de mapping", styles['BH1']))
    elements.append(Paragraph(
        "Le mapping est realise table par table en comparant les structures source et cible. "
        "Les valeurs de domaine SDOL sont extraites des commentaires PostgreSQL sur les colonnes.",
        styles['BBody']))

    elements.append(Paragraph("4.1 Types de transformation", styles['BH2']))
    transfo_data = [
        ["Type", "Description", "Exemple"],
        ["DIRECT", "Copie sans transformation", "gid -> gid"],
        ["MAPPING_VALEURS", "Conversion selon table de correspondance", "'Privee' -> 'prive'"],
        ["FIXE", "Valeur constante", "nom_comm = 'Bussigny'"],
        ["VIDE", "Colonne cible sans equivalent (NULL)", "insp_date = NULL"],
        ["EXTRACT_YEAR", "Extraction annee depuis date", "date -> annee"],
        ["SPLIT", "1 champ source -> 2+ champs cible", "fonction_hydro -> ecoulem + fonction"],
        ["JOINTURE", "Donnees depuis autre table", "couvercle -> colonnes eu_chambre"],
        ["GENERATE_UUID", "Generation identifiant unique", "pk_uuid = gen_random_uuid()"],
    ]
    elements.append(create_table(transfo_data, [3*cm, 7*cm, 5*cm]))

    elements.append(Paragraph("4.2 Source des valeurs de domaine SDOL", styles['BH2']))
    elements.append(Paragraph(
        "Les valeurs attendues par SDOL sont documentees dans les <b>commentaires PostgreSQL</b> des colonnes. "
        "Exemple pour le champ 'contenu' :", styles['BBody']))
    elements.append(Paragraph(
        "<i>contenu - \"type d'eau //liste de valeurs : eaux claires, eaux mixtes, eaux usees, inconnu//\"</i>",
        styles['Info']))

    elements.append(PageBreak())

    # === 5. POINTS SENSIBLES ASSAINISSEMENT ===
    elements.append(Paragraph("5. Points sensibles - Assainissement", styles['BH1']))
    elements.append(Paragraph("8 points necessitant validation", styles['BSubtitle']))

    # Point 1
    elements.append(Paragraph("5.1 Proprietaire CFF (chambre + collecteur)", styles['BH2']))
    p1_data = [
        ["Valeur Bussigny", "Nb objets", "Valeur SDOL proposee", "Statut"],
        ["Bussigny - Publique", "2'324 + 3'209", "commune", "OK"],
        ["Privee", "5'592 + 11'678", "prive", "OK"],
        ["CFF", "98 + 141", "??? (canton ?)", "A VALIDER"],
        ["Ecublens", "3", "??? (autre commune)", "A VALIDER"],
    ]
    elements.append(create_table(p1_data, [4*cm, 2.5*cm, 4*cm, 3*cm]))
    elements.append(Paragraph(
        "<b>Question</b> : Mapper CFF vers 'canton' ou demander ajout valeur 'confederation'/'CFF' ?",
        styles['Warning']))

    # Point 2
    elements.append(Paragraph("5.2 Genre chambre vs Type ouvrage (ECART MAJEUR)", styles['BH2']))
    elements.append(Paragraph(
        "Le champ SDOL 'type_ouvr' n'accepte que 3 valeurs (<i>ouvert, enterre, borgne</i>) alors que "
        "Bussigny a 14 valeurs detaillees.", styles['BBody']))
    p2_data = [
        ["Valeur Bussigny (genre_chambre)", "Nb", "Proposition"],
        ["Chambre de visite", "3'872", "enterre"],
        ["Cheneau", "1'923", "ouvert ?"],
        ["Sac - Grille", "1'709", "ouvert ?"],
        ["Inspection, chambre standard", "219", "enterre"],
        ["Autres (10 valeurs)", "291", "A definir"],
    ]
    elements.append(create_table(p2_data, [6*cm, 1.5*cm, 7.5*cm]))
    elements.append(Paragraph(
        "<b>Risque</b> : Perte d'information significative. Recommandation : stocker valeur originale "
        "dans 'remarque' ou demander enrichissement domaine SDOL.", styles['Alert']))

    # Point 3
    elements.append(Paragraph("5.3 Fonction chambre 'Materialise' (6'102 objets)", styles['BH2']))
    p3_data = [
        ["Valeur Bussigny", "Nb", "Valeur SDOL", "Statut"],
        ["Regard de visite", "149", "visite", "OK"],
        ["Materialise", "6'102", "???", "A VALIDER"],
        ["NULL", "1'763", "NULL", "OK"],
    ]
    elements.append(create_table(p3_data, [4*cm, 1.5*cm, 4*cm, 4*cm]))
    elements.append(Paragraph(
        "<b>Question</b> : 76% des chambres ont 'Materialise' sans equivalent SDOL. Mapper vers NULL ou 'visite' ?",
        styles['Warning']))

    # Point 4-8
    elements.append(Paragraph("5.4 Autres points assainissement", styles['BH2']))
    autres_data = [
        ["#", "Point", "Description", "Impact"],
        ["4", "etat vs utilisat/etat_constr", "Champs de semantique differente", "Faible"],
        ["5", "fonction_hydro -> ecoulem + fonction", "Split 1 champ vers 2", "Moyen"],
        ["6", "Jointure couvercle", "by_ass_couvercle -> colonnes eu_chambre", "Technique"],
        ["7", "chambre_detail", "Symbologie, pas d'equivalent SDOL", "Perte mineure"],
        ["8", "Collecteurs Ecublens", "3 objets proprietaire 'Ecublens'", "Faible"],
    ]
    elements.append(create_table(autres_data, [0.8*cm, 4*cm, 6*cm, 2.7*cm]))

    elements.append(PageBreak())

    # === 6. POINTS SENSIBLES ROUTE ===
    elements.append(Paragraph("6. Points sensibles - Route", styles['BH1']))
    elements.append(Paragraph("11 points necessitant validation", styles['BSubtitle']))

    elements.append(Paragraph("6.1 Structure tres differente", styles['BH2']))
    elements.append(Paragraph(
        "La modelisation route differe fortement entre Bussigny (tables normalisees avec FK) et SDOL "
        "(tables denormalisees avec valeurs en clair).", styles['BBody']))

    # Points route
    route_data = [
        ["#", "Point", "Description", "Decision"],
        ["9", "Structure normalisee vs denormalisee", "FK Bussigny vs valeurs texte SDOL", "Jointures requises"],
        ["10", "Perte largeur/trottoirs", "Champs sans equivalent SDOL", "Perte acceptee ?"],
        ["11", "Classification route", "Principale/Collectrice/Desserte vs LRou", "Mapping a definir"],
        ["12", "Commune-Prive", "Valeur proprio mixte sans equivalent", "A VALIDER"],
        ["13", "Arrets TP", "Pas de table arrets bus dans SDOL (Pedibus != Bus)", "BLOQUANT"],
        ["14", "Comptage trafic", "Bussigny: lien doc vs SDOL: valeurs directes", "Migration complexe"],
        ["15", "Entretien", "Bussigny minimaliste vs SDOL detaille", "Migration partielle"],
        ["16", "Etat troncon", "1 indice (i1) vs 3 indices (i0,i1,i3)", "Champs vides"],
        ["17", "Parcours velo", "Perte largeur et cycle_uniquement", "Perte mineure"],
        ["18", "Stationnement", "Perte revetement, SDOL plus detaille", "Champs vides"],
        ["19", "Ouvrage ponctuel", "Pas d'equivalent SDOL evident", "A VALIDER"],
    ]
    elements.append(create_table(route_data, [0.8*cm, 3.5*cm, 6.5*cm, 3.7*cm]))

    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph(
        "<b>Note</b> : 8 tables route sont vides (0 lignes). La migration route concerne principalement "
        "by_rte_troncon (193) et by_rte_etat_troncon (171).", styles['Info']))

    elements.append(PageBreak())

    # === 7. POINTS SENSIBLES DIVERS/NATURE/POI ===
    elements.append(Paragraph("7. Points sensibles - Divers/Nature/POI", styles['BH1']))
    elements.append(Paragraph("5 points necessitant validation", styles['BSubtitle']))

    divers_data = [
        ["#", "Schema", "Point", "Description", "Decision"],
        ["20", "Divers", "Ouvrages speciaux", "Geometrie points vs surfaces SDOL", "Conversion ?"],
        ["21", "Nature", "Arbres/vergers", "4 champs BY vs 40 champs SDOL", "Migration partielle"],
        ["22", "Pts_interet", "POI", "Pas de table POI dans SDOL", "BLOQUANT"],
        ["23", "Global", "Architecture multi-schema", "Impossible voir format autres communes", "Contacter HKD"],
        ["24", "Fibre optique", "Tables FO", "Schema a inventorier, tables cibles SDOL ?", "A INVENTORIER"],
    ]
    elements.append(create_table(divers_data, [0.8*cm, 2*cm, 3*cm, 5*cm, 3.7*cm]))

    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph(
        "<b>Points bloquants identifies</b> : #13 (Arrets TP) et #22 (POI) n'ont pas d'equivalent dans SDOL. "
        "Ces donnees ne pourront pas etre migrees sans creation de nouvelles tables.", styles['Alert']))

    elements.append(PageBreak())

    # === 8. SYNTHESE DECISIONS ===
    elements.append(Paragraph("8. Synthese des decisions a prendre", styles['BH1']))

    elements.append(Paragraph("8.1 Decisions a prendre avec SDOL/HKD", styles['BH2']))
    hkd_data = [
        ["#", "Question", "Options", "Recommandation"],
        ["1", "CFF -> proprio ?", "canton / nouvelle valeur", "Demander ajout 'CFF'"],
        ["2", "genre_chambre -> type_ouvr ?", "Mapping simplifie / enrichir SDOL", "Stocker dans remarque"],
        ["3", "Materialise -> fonction ?", "NULL / visite / ignorer", "Mapper vers NULL"],
        ["13", "Table arrets TP ?", "Creer table / abandonner", "Demander creation"],
        ["22", "Table POI ?", "Creer table / abandonner", "Demander creation"],
        ["23", "Exemple donnees migrees ?", "Documentation / acces temporaire", "Obtenir exemple"],
    ]
    elements.append(create_table(hkd_data, [0.8*cm, 4*cm, 4.5*cm, 5.2*cm]))

    elements.append(Paragraph("8.2 Decisions internes Bussigny", styles['BH2']))
    by_data = [
        ["#", "Question", "Impact"],
        ["10", "Accepter perte largeur/trottoirs route ?", "Donnees non recuperables apres migration"],
        ["11", "Definir mapping classification route", "Principale->?, Collectrice->?, Desserte->?"],
        ["14", "Extraire donnees comptage des documents ?", "Travail manuel potentiel"],
        ["21", "Migration partielle arbres acceptable ?", "36 champs resteront vides"],
    ]
    elements.append(create_table(by_data, [0.8*cm, 6*cm, 7.7*cm]))

    elements.append(PageBreak())

    # === 9. PROCHAINES ETAPES ===
    elements.append(Paragraph("9. Prochaines etapes", styles['BH1']))

    steps_data = [
        ["#", "Action", "Responsable", "Priorite"],
        ["1", "Valider ce rapport avec la hierarchie", "Marc", "HAUTE"],
        ["2", "Organiser reunion avec HKD/SDOL pour points bloquants", "Marc", "HAUTE"],
        ["3", "Obtenir documentation officielle valeurs SDOL", "Marc/HKD", "HAUTE"],
        ["4", "Trancher les decisions internes (pertes acceptables)", "Marc/Chef", "MOYENNE"],
        ["5", "Finaliser fichiers CSV de mapping detailles", "Marc", "MOYENNE"],
        ["6", "Developper workbenches FME de migration", "Marc", "APRES VALIDATION"],
        ["7", "Tests sur environnement SDOL", "Marc", "APRES DEV"],
        ["8", "Migration production", "Marc/HKD", "APRES TESTS"],
    ]
    elements.append(create_table(steps_data, [0.8*cm, 8*cm, 2.5*cm, 3.2*cm]))

    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(
        "Ce document constitue la base de discussion pour la validation du projet de migration. "
        "Les decisions prises devront etre documentees et les fichiers de mapping mis a jour en consequence.",
        styles['Success']))

    # === SIGNATURE ===
    elements.append(Spacer(1, 1.5*cm))
    elements.append(Paragraph("Document prepare par :", styles['BBody']))
    sig_data = [["Marc Zermatten"], ["Responsable SIT"], ["Service des infrastructures"], ["Commune de Bussigny"]]
    t = Table(sig_data, colWidths=[6*cm])
    t.setStyle(TableStyle([('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 9)]))
    elements.append(t)

    doc.build(elements)
    print(f"PDF genere : {OUTPUT_FILE}")
    return OUTPUT_FILE


if __name__ == "__main__":
    create_rapport()
