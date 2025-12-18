# -*- coding: utf-8 -*-
"""
Generation du rapport Statistiques Inspection Collecteurs - Format Bussigny
Version 5 - Mise en page amelioree et graphiques coherents
"""
import sys
sys.path.insert(0, r'C:\Users\zema\GeoBrain\scripts\python')

from bussigny_pdf import (
    BussignyDocTemplate, get_styles, create_metadata_table,
    create_separator, CONTENT_WIDTH, BLEU_BUSSIGNY
)
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, KeepTogether, Image, PageBreak
from reportlab.lib.units import cm
from reportlab.lib import colors
from datetime import datetime
import psycopg2
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import os

OUTPUT_PATH = r"C:\Users\zema\GeoBrain\temp\RAPPORT_INSPECTION_COLLECTEURS_v7.pdf"
TEMP_DIR = r"C:\Users\zema\GeoBrain\temp"

# Palette coherente Bussigny (du fonce au clair)
BLEU_FONCE = '#1E4B8E'
BLEU_MOYEN = '#3D7ABF'
BLEU_CLAIR = '#6BA3D6'

# Palette etats (rouge = grave, vert = bon)
COULEURS_ETATS = ['#c0392b', '#e74c3c', '#f39c12', '#27ae60', '#2ecc71']

# Palette anciennete (recent = bleu fonce, ancien = rouge)
COULEURS_ANCIENNETE = ['#2980b9', '#3498db', '#1abc9c', '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6']

# Config graphiques - taille standard
GRAPH_WIDTH = 12 * cm
GRAPH_HEIGHT = 6 * cm
GRAPH_DPI = 150

def create_section(elements_list):
    """Garde tous les elements ensemble sur la meme page"""
    return KeepTogether(elements_list)

def setup_graph_style():
    """Configure le style global des graphiques"""
    plt.rcParams.update({
        'font.size': 9,
        'axes.titlesize': 10,
        'axes.titleweight': 'bold',
        'axes.labelsize': 9,
        'xtick.labelsize': 8,
        'ytick.labelsize': 8,
        'axes.spines.top': False,
        'axes.spines.right': False,
        'axes.grid': True,
        'grid.alpha': 0.3,
        'grid.linestyle': '--'
    })

def create_graph_km_par_annee(stats, filename):
    """Bar chart vertical: lineaire inspecte par annee"""
    setup_graph_style()
    annees = [str(a[0]) for a in stats['par_annee']]
    km = [a[2] for a in stats['par_annee']]

    fig, ax = plt.subplots(figsize=(6, 3))
    bars = ax.bar(annees, km, color=BLEU_FONCE, edgecolor='white', width=0.7)

    ax.set_xlabel('Annee de derniere inspection')
    ax.set_ylabel('Lineaire (km)')
    ax.tick_params(axis='x', rotation=45)

    # Valeurs sur les barres (seulement si > 0.5 km)
    for bar, val in zip(bars, km):
        if val > 0.5:
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.2,
                    f'{val:.1f}', ha='center', va='bottom', fontsize=7, color='#333')

    ax.set_ylim(0, max(km) * 1.15)
    plt.tight_layout()
    plt.savefig(filename, dpi=GRAPH_DPI, bbox_inches='tight', facecolor='white')
    plt.close()

def create_graph_etats(stats, filename):
    """Bar chart vertical: repartition par etat (0 a 4)"""
    setup_graph_style()

    # Extraire le code etat pour le label
    etats_labels = []
    for e in stats['etats']:
        if ' - ' in e[0]:
            code = e[0].split(' - ')[0]
            etats_labels.append(f"Etat {code}")
        else:
            etats_labels.append(e[0][:15])
    km = [e[2] for e in stats['etats']]

    fig, ax = plt.subplots(figsize=(5, 3))
    x = range(len(etats_labels))
    bars = ax.bar(x, km, color=COULEURS_ETATS[:len(km)], edgecolor='white', width=0.6)

    ax.set_xticks(x)
    ax.set_xticklabels(etats_labels, fontsize=8)
    ax.set_ylabel('Lineaire (km)')

    # Valeurs sur les barres
    for bar, val in zip(bars, km):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                f'{val:.1f}', ha='center', va='bottom', fontsize=7, color='#333')

    ax.set_ylim(0, max(km) * 1.2)
    plt.tight_layout()
    plt.savefig(filename, dpi=GRAPH_DPI, bbox_inches='tight', facecolor='white')
    plt.close()

def create_graph_anciennete(stats, filename):
    """Bar chart vertical: anciennete des inspections"""
    setup_graph_style()
    tranches = [a[0] for a in stats['anciennete']]
    km = [a[2] for a in stats['anciennete']]

    # Labels abreges
    labels_courts = []
    for t in tranches:
        if t == 'Jamais inspecte':
            labels_courts.append('Jamais')
        elif t == 'Moins de 1 an':
            labels_courts.append('<1 an')
        elif t == 'Plus de 10 ans':
            labels_courts.append('>10 ans')
        else:
            labels_courts.append(t)

    fig, ax = plt.subplots(figsize=(6, 3))
    x = range(len(labels_courts))
    bars = ax.bar(x, km, color=COULEURS_ANCIENNETE[:len(km)], edgecolor='white', width=0.7)

    ax.set_xticks(x)
    ax.set_xticklabels(labels_courts, fontsize=8, rotation=30, ha='right')
    ax.set_ylabel('Lineaire (km)')

    # Valeurs sur les barres
    for bar, val in zip(bars, km):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.2,
                f'{val:.1f}', ha='center', va='bottom', fontsize=7, color='#333')

    ax.set_ylim(0, max(km) * 1.15)
    plt.tight_layout()
    plt.savefig(filename, dpi=GRAPH_DPI, bbox_inches='tight', facecolor='white')
    plt.close()

def create_graph_campagnes(stats, filename):
    """Bar chart groupe: nouveaux vs reinspections par campagne"""
    setup_graph_style()
    if not stats['campagnes']:
        return False

    annees = [str(c['annee']) for c in stats['campagnes']]
    nouveaux = [c['km_nouveaux'] for c in stats['campagnes']]
    reinsp = [c['km_reinsp'] for c in stats['campagnes']]

    fig, ax = plt.subplots(figsize=(5, 3))
    x = np.arange(len(annees))
    width = 0.35

    bars1 = ax.bar(x - width/2, nouveaux, width, label='1ere inspection', color=BLEU_FONCE)
    bars2 = ax.bar(x + width/2, reinsp, width, label='Reinspection', color=BLEU_CLAIR)

    ax.set_ylabel('Lineaire (km)')
    ax.set_xticks(x)
    ax.set_xticklabels(annees)
    ax.legend(fontsize=8, loc='upper right')

    # Valeurs sur les barres
    for bar, val in zip(bars1, nouveaux):
        if val > 0.1:
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                    f'{val:.1f}', ha='center', va='bottom', fontsize=7)
    for bar, val in zip(bars2, reinsp):
        if val > 0.1:
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                    f'{val:.1f}', ha='center', va='bottom', fontsize=7)

    max_val = max(max(nouveaux), max(reinsp))
    ax.set_ylim(0, max_val * 1.25)
    plt.tight_layout()
    plt.savefig(filename, dpi=GRAPH_DPI, bbox_inches='tight', facecolor='white')
    plt.close()
    return True

def create_graph_couverture(stats, filename):
    """Bar chart horizontal: couverture par type d'eaux"""
    setup_graph_style()

    types = [t[0] for t in stats['par_type']]
    km_insp = [t[3] for t in stats['par_type']]
    km_non_insp = [t[2] - t[3] for t in stats['par_type']]

    fig, ax = plt.subplots(figsize=(6, 2.5))
    y = range(len(types))

    bars1 = ax.barh(y, km_insp, label='Inspecte', color=BLEU_FONCE, height=0.5)
    bars2 = ax.barh(y, km_non_insp, left=km_insp, label='Non inspecte', color='#bdc3c7', height=0.5)

    ax.set_yticks(y)
    ax.set_yticklabels(types, fontsize=8)
    ax.set_xlabel('Lineaire (km)')
    ax.legend(fontsize=8, loc='lower right')
    ax.invert_yaxis()

    plt.tight_layout()
    plt.savefig(filename, dpi=GRAPH_DPI, bbox_inches='tight', facecolor='white')
    plt.close()

def create_stats_table(data, colWidths=None, highlight_total=False):
    """Crée un tableau de statistiques avec style Bussigny"""
    if colWidths is None:
        colWidths = [CONTENT_WIDTH / len(data[0])] * len(data[0])

    t = Table(data, colWidths=colWidths)
    style_commands = [
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
    ]
    if highlight_total and len(data) > 1:
        style_commands.append(('BACKGROUND', (0, -1), (-1, -1), colors.Color(0.9, 0.9, 0.9)))
        style_commands.append(('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'))
    t.setStyle(TableStyle(style_commands))
    return t

def get_stats_from_db():
    """Récupère les statistiques depuis la base de données"""
    stats = {}

    conn = psycopg2.connect(
        host='10.200.228.152',
        dbname='Prod',
        user='postgres',
        password='4w3TL6fsWcSqC',
        connect_timeout=10
    )
    conn.set_client_encoding('WIN1252')
    cur = conn.cursor()

    # Statistiques générales
    cur.execute("""
        SELECT
            COUNT(*) as nb_total,
            SUM(ST_Length(geom)) / 1000 as km_total,
            COUNT(*) FILTER (WHERE nb_inspections > 0) as nb_inspectes,
            SUM(ST_Length(geom)) FILTER (WHERE nb_inspections > 0) / 1000 as km_inspectes,
            COUNT(*) FILTER (WHERE nb_inspections = 0) as nb_non_inspectes,
            SUM(ST_Length(geom)) FILTER (WHERE nb_inspections = 0) / 1000 as km_non_inspectes
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
    """)
    row = cur.fetchone()
    stats['general'] = {
        'nb_total': row[0],
        'km_total': float(row[1]),
        'nb_inspectes': row[2],
        'km_inspectes': float(row[3]),
        'nb_non_inspectes': row[4],
        'km_non_inspectes': float(row[5]),
    }

    # Par année
    cur.execute("""
        SELECT annee_derniere_inspection, COUNT(*), SUM(ST_Length(geom)) / 1000
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique' AND annee_derniere_inspection IS NOT NULL
        GROUP BY annee_derniere_inspection ORDER BY annee_derniere_inspection
    """)
    stats['par_annee'] = [(int(r[0]), r[1], float(r[2])) for r in cur.fetchall()]

    # Par état
    cur.execute("""
        SELECT etat_derniere_inspection, COUNT(*), SUM(ST_Length(geom)) / 1000
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique' AND etat_derniere_inspection IS NOT NULL
        AND etat_derniere_inspection != ''
        GROUP BY etat_derniere_inspection, id_etat_derniere_inspection
        ORDER BY id_etat_derniere_inspection
    """)
    stats['etats'] = [(r[0], r[1], float(r[2])) for r in cur.fetchall()]

    # Ancienneté
    cur.execute("""
        SELECT
            CASE
                WHEN jours_depuis_inspection IS NULL THEN 'Jamais inspecté'
                WHEN jours_depuis_inspection < 365 THEN 'Moins de 1 an'
                WHEN jours_depuis_inspection < 730 THEN '1-2 ans'
                WHEN jours_depuis_inspection < 1095 THEN '2-3 ans'
                WHEN jours_depuis_inspection < 1825 THEN '3-5 ans'
                WHEN jours_depuis_inspection < 3650 THEN '5-10 ans'
                ELSE 'Plus de 10 ans'
            END,
            COUNT(*), SUM(ST_Length(geom)) / 1000
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
        GROUP BY 1 ORDER BY MIN(COALESCE(jours_depuis_inspection, 999999))
    """)
    stats['anciennete'] = [(r[0], r[1], float(r[2])) for r in cur.fetchall()]

    # Délai ré-inspection
    cur.execute("""
        SELECT
            COUNT(*), SUM(ST_Length(geom)) / 1000,
            AVG(date_derniere_inspection - date_premiere_inspection)
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique' AND nb_inspections = 2
    """)
    row = cur.fetchone()
    stats['reinspection'] = {
        'nb': row[0],
        'km': float(row[1]),
        'delai_jours': float(row[2]) if row[2] else 0
    }

    # Par type d'eaux
    cur.execute("""
        SELECT genre_utilisation, COUNT(*), SUM(ST_Length(geom)) / 1000,
               SUM(ST_Length(geom)) FILTER (WHERE nb_inspections > 0) / 1000
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
        GROUP BY genre_utilisation ORDER BY 3 DESC
    """)
    stats['par_type'] = [(r[0] or 'Non defini', r[1], float(r[2]), float(r[3]) if r[3] else 0) for r in cur.fetchall()]

    # Analyse des campagnes (nouveaux vs reinspections)
    stats['campagnes'] = []
    for annee in [2023, 2024, 2025]:
        cur.execute("""
            WITH campagne AS (
                SELECT *,
                    CASE
                        WHEN EXTRACT(YEAR FROM date_inspection_1) = %s THEN 'insp1'
                        WHEN EXTRACT(YEAR FROM date_inspection_2) = %s THEN 'insp2'
                    END as type_insp
                FROM assainissement.v_ass_collecteur_inspection
                WHERE proprietaire = 'Bussigny - Publique'
                AND (EXTRACT(YEAR FROM date_inspection_1) = %s OR EXTRACT(YEAR FROM date_inspection_2) = %s)
            )
            SELECT
                COUNT(*) as total,
                COALESCE(SUM(ST_Length(geom)) / 1000, 0) as km_total,
                COUNT(*) FILTER (WHERE type_insp = 'insp1' AND date_inspection_2 IS NULL) as nouveaux,
                COALESCE(SUM(ST_Length(geom)) FILTER (WHERE type_insp = 'insp1' AND date_inspection_2 IS NULL) / 1000, 0) as km_nouveaux,
                COUNT(*) FILTER (WHERE type_insp = 'insp2') as reinsp,
                COALESCE(SUM(ST_Length(geom)) FILTER (WHERE type_insp = 'insp2') / 1000, 0) as km_reinsp
            FROM campagne
        """, (annee, annee, annee, annee))
        row = cur.fetchone()
        if row[0] > 0:
            # Cas speciaux: collecteurs ou insp1 est une reinspection (insp2 existe avant)
            cur.execute("""
                SELECT COUNT(*), COALESCE(SUM(ST_Length(geom)) / 1000, 0)
                FROM assainissement.v_ass_collecteur_inspection
                WHERE proprietaire = 'Bussigny - Publique'
                AND EXTRACT(YEAR FROM date_inspection_1) = %s
                AND date_inspection_2 IS NOT NULL
                AND EXTRACT(YEAR FROM date_inspection_2) < %s
            """, (annee, annee))
            row2 = cur.fetchone()
            reinsp_special = row2[0] or 0
            km_reinsp_special = float(row2[1]) if row2[1] else 0

            stats['campagnes'].append({
                'annee': annee,
                'total': row[0],
                'km_total': float(row[1]),
                'nouveaux': (row[2] or 0) - reinsp_special,
                'km_nouveaux': float(row[3] or 0) - km_reinsp_special,
                'reinsp': (row[4] or 0) + reinsp_special,
                'km_reinsp': float(row[5] or 0) + km_reinsp_special
            })

    # Collecteurs sensibles (reinspectes en <= 2 ans)
    cur.execute("""
        SELECT
            COUNT(*) as nb,
            SUM(ST_Length(geom)) / 1000 as km,
            AVG(date_derniere_inspection - date_premiere_inspection) as delai_moyen
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
        AND nb_inspections = 2
        AND (date_derniere_inspection - date_premiere_inspection) <= 730
    """)
    row = cur.fetchone()
    stats['sensibles'] = {
        'nb': row[0],
        'km': float(row[1]) if row[1] else 0,
        'delai_moyen_jours': float(row[2]) if row[2] else 0
    }

    # Etat des collecteurs sensibles
    cur.execute("""
        SELECT
            etat_derniere_inspection,
            COUNT(*) as nb,
            SUM(ST_Length(geom)) / 1000 as km
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
        AND nb_inspections = 2
        AND (date_derniere_inspection - date_premiere_inspection) <= 730
        AND etat_derniere_inspection IS NOT NULL
        AND etat_derniere_inspection != ''
        GROUP BY etat_derniere_inspection, id_etat_derniere_inspection
        ORDER BY id_etat_derniere_inspection
    """)
    stats['sensibles_etats'] = [(r[0], r[1], float(r[2])) for r in cur.fetchall()]

    conn.close()
    return stats

def generate():
    stats = get_stats_from_db()

    # Generation des graphiques
    graph_annee = os.path.join(TEMP_DIR, 'graph_km_annee.png')
    graph_etats = os.path.join(TEMP_DIR, 'graph_etats.png')
    graph_anciennete = os.path.join(TEMP_DIR, 'graph_anciennete.png')
    graph_campagnes = os.path.join(TEMP_DIR, 'graph_campagnes.png')
    graph_couverture = os.path.join(TEMP_DIR, 'graph_couverture.png')

    create_graph_km_par_annee(stats, graph_annee)
    create_graph_etats(stats, graph_etats)
    create_graph_anciennete(stats, graph_anciennete)
    create_graph_couverture(stats, graph_couverture)
    has_campagnes = stats['campagnes'] and create_graph_campagnes(stats, graph_campagnes)

    doc = BussignyDocTemplate(
        OUTPUT_PATH,
        doc_description="Rapport Inspection Collecteurs"
    )
    styles = get_styles()
    elements = []

    # ================================================================
    # PAGE DE TITRE
    # ================================================================
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(Paragraph("RAPPORT STATISTIQUE", styles['BTitle']))
    elements.append(Paragraph("Suivi des inspections - Collecteurs publics", styles['BSubtitle']))
    elements.append(Spacer(1, 0.3 * cm))

    elements.append(create_metadata_table({
        "Date :": datetime.now().strftime("%d decembre %Y"),
        "Service :": "Infrastructure et Geodonnees",
        "Perimetre :": "Reseau d'assainissement communal"
    }))
    elements.append(Spacer(1, 0.2 * cm))
    elements.append(create_separator())
    elements.append(Spacer(1, 0.4 * cm))

    # ================================================================
    # 1. SYNTHESE
    # ================================================================
    pct_insp = stats['general']['km_inspectes'] / stats['general']['km_total'] * 100

    # Encadre synthese
    synthese_data = [
        ["SYNTHESE", "", ""],
        ["Lineaire total", f"{stats['general']['km_total']:.1f} km", f"{stats['general']['nb_total']} troncons"],
        ["Lineaire inspecte", f"{stats['general']['km_inspectes']:.1f} km", f"{pct_insp:.0f}% du reseau"],
        ["A inspecter", f"{stats['general']['km_non_inspectes']:.1f} km", f"{stats['general']['nb_non_inspectes']} troncons"],
    ]
    t = Table(synthese_data, colWidths=[5*cm, 4*cm, 6*cm])
    t.setStyle(TableStyle([
        ('SPAN', (0, 0), (-1, 0)),
        ('BACKGROUND', (0, 0), (-1, 0), BLEU_BUSSIGNY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.5 * cm))

    # ================================================================
    # 2. HISTORIQUE PAR ANNEE
    # ================================================================
    elements.append(Paragraph("1. Historique des inspections", styles['BH1']))
    elements.append(Paragraph(
        "Lineaire ayant fait l'objet d'une inspection camera, par annee de derniere inspection.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.2 * cm))

    # Tableau d'abord (reste sur page 1)
    annee_data = [["Annee", "Troncons", "km"]]
    total_nb, total_km = 0, 0
    for annee, nb, km in stats['par_annee']:
        annee_data.append([str(annee), str(nb), f"{km:.1f}"])
        total_nb += nb
        total_km += km
    annee_data.append(["Total", str(total_nb), f"{total_km:.1f}"])

    elements.append(create_stats_table(annee_data, [4*cm, 4*cm, 4*cm], highlight_total=True))
    elements.append(Spacer(1, 0.3 * cm))

    # Graphique ensuite (passera sur page 2 si necessaire)
    elements.append(Image(graph_annee, width=GRAPH_WIDTH, height=GRAPH_HEIGHT))
    elements.append(Spacer(1, 0.5 * cm))

    # ================================================================
    # 3. ETAT DES COLLECTEURS
    # ================================================================
    elements.append(Paragraph("2. Etat des collecteurs", styles['BH1']))
    elements.append(Paragraph(
        "Classification VSA : 0 = degrade (intervention urgente), 4 = bon etat.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Image(graph_etats, width=10*cm, height=GRAPH_HEIGHT))
    elements.append(Spacer(1, 0.3 * cm))

    etat_data = [["Code", "Etat", "km", "%"]]
    total_km_etat = sum(e[2] for e in stats['etats'])
    for etat, nb, km in stats['etats']:
        pct = (km / total_km_etat * 100) if total_km_etat > 0 else 0
        # Extraire code et libelle
        if ' - ' in etat:
            code, lib = etat.split(' - ', 1)
        else:
            code, lib = '-', etat
        etat_data.append([code, lib, f"{km:.1f}", f"{pct:.0f}%"])

    elements.append(create_stats_table(etat_data, [2*cm, 7*cm, 3*cm, 3*cm]))
    elements.append(Spacer(1, 0.5 * cm))

    # ================================================================
    # 4. ANCIENNETE
    # ================================================================
    anc_data = [["Anciennete", "Troncons", "km"]]
    for tranche, nb, km in stats['anciennete']:
        anc_data.append([tranche, str(nb), f"{km:.1f}"])

    # KeepTogether pour eviter titre orphelin
    elements.append(create_section([
        Paragraph("3. Anciennete des inspections", styles['BH1']),
        Paragraph(
            "Temps ecoule depuis la derniere inspection. Permet d'identifier les secteurs a reinspecter en priorite.",
            styles['BBody']
        ),
        Spacer(1, 0.2 * cm),
        Image(graph_anciennete, width=GRAPH_WIDTH, height=GRAPH_HEIGHT),
        Spacer(1, 0.3 * cm),
        create_stats_table(anc_data, [6*cm, 4*cm, 5*cm]),
        Spacer(1, 0.5 * cm)
    ]))

    # ================================================================
    # 5. COUVERTURE PAR TYPE D'EAUX
    # ================================================================
    elements.append(Paragraph("4. Couverture par type de reseau", styles['BH1']))
    elements.append(Paragraph(
        "Taux d'inspection par categorie : eaux claires (EC), eaux usees (EU), eaux mixtes (EM).",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.2 * cm))

    elements.append(Image(graph_couverture, width=GRAPH_WIDTH, height=5*cm))
    elements.append(Spacer(1, 0.3 * cm))

    type_data = [["Type", "Total", "Inspecte", "Couverture"]]
    for typ, nb, km_tot, km_insp in stats['par_type']:
        pct = km_insp / km_tot * 100 if km_tot > 0 else 0
        type_data.append([typ, f"{km_tot:.1f} km", f"{km_insp:.1f} km", f"{pct:.0f}%"])
    elements.append(create_stats_table(type_data, [5*cm, 3.5*cm, 3.5*cm, 3*cm]))
    elements.append(Spacer(1, 0.5 * cm))

    # ================================================================
    # 6. CAMPAGNES ANNUELLES
    # ================================================================
    if has_campagnes:
        elements.append(Paragraph("5. Analyse des campagnes recentes", styles['BH1']))
        elements.append(Paragraph(
            "Repartition entre 1eres inspections (extension couverture) et reinspections (suivi).",
            styles['BBody']
        ))
        elements.append(Spacer(1, 0.2 * cm))

        elements.append(Image(graph_campagnes, width=10*cm, height=GRAPH_HEIGHT))
        elements.append(Spacer(1, 0.3 * cm))

        camp_data = [["Annee", "Total", "1ere insp.", "Reinsp."]]
        for c in stats['campagnes']:
            camp_data.append([
                str(c['annee']),
                f"{c['km_total']:.1f} km",
                f"{c['km_nouveaux']:.1f} km",
                f"{c['km_reinsp']:.1f} km"
            ])
        elements.append(create_stats_table(camp_data, [3*cm, 4*cm, 4*cm, 4*cm]))
        elements.append(Spacer(1, 0.5 * cm))

    # ================================================================
    # 7. COLLECTEURS A SUIVI RENFORCE
    # ================================================================
    if stats['sensibles']['nb'] > 0:
        delai_mois = stats['sensibles']['delai_moyen_jours'] / 30

        elements.append(create_section([
            Paragraph("6. Collecteurs a suivi renforce", styles['BH1']),
            Paragraph(
                f"<b>{stats['sensibles']['nb']} collecteurs ({stats['sensibles']['km']:.1f} km)</b> ont ete "
                f"reinspectes en moins de 2 ans (delai moyen : {delai_mois:.0f} mois).",
                styles['BBody']
            ),
            Paragraph(
                "Motifs possibles : etat preoccupant, zone sensible (nappe, cours d'eau), collecteur strategique.",
                styles['BBody']
            ),
            Spacer(1, 0.2 * cm),
        ]))

        if stats['sensibles_etats']:
            sens_data = [["Etat", "Troncons", "km"]]
            for etat, nb, km in stats['sensibles_etats']:
                sens_data.append([etat, str(nb), f"{km:.1f}"])
            elements.append(create_stats_table(sens_data, [8*cm, 3.5*cm, 3.5*cm]))
        elements.append(Spacer(1, 0.5 * cm))

    # ================================================================
    # 8. INDICATEURS CLES
    # ================================================================
    elements.append(Paragraph("7. Indicateurs cles", styles['BH1']))
    elements.append(Paragraph(
        "Synthese des principaux indicateurs de suivi du programme d'inspection.",
        styles['BBody']
    ))
    elements.append(Spacer(1, 0.2 * cm))

    kpi_data = [
        ["Indicateur", "Valeur", "Commentaire"],
        ["Taux de couverture", f"{pct_insp:.0f}%", "Lineaire inspecte / lineaire total"],
        ["Collecteurs reinspectes", f"{stats['reinspection']['nb']}", f"{stats['reinspection']['km']:.1f} km au total"],
        ["Delai moyen reinspection", f"{stats['reinspection']['delai_jours']/365:.1f} ans", "Entre 1ere et 2eme inspection"],
    ]
    if stats['sensibles']['nb'] > 0:
        kpi_data.append(["Suivi renforce (<2 ans)", f"{stats['sensibles']['nb']}", f"{stats['sensibles']['km']:.1f} km"])

    elements.append(create_stats_table(kpi_data, [5*cm, 3*cm, 7*cm]))

    # Build PDF
    doc.build(elements)
    print(f"Rapport genere: {OUTPUT_PATH}")

if __name__ == '__main__':
    try:
        generate()
    except Exception as e:
        import traceback
        print(f"Erreur: {e}")
        traceback.print_exc()
