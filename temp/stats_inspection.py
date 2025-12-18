# -*- coding: utf-8 -*-
"""
Extraction des statistiques d'inspection des collecteurs pour rapport Bussigny
"""
import psycopg2
import sys
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def get_stats():
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

    # ============================================
    # 1. STATISTIQUES GENERALES
    # ============================================
    print("=== 1. STATISTIQUES GENERALES ===\n")

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
        'km_total': round(row[1], 2),
        'nb_inspectes': row[2],
        'km_inspectes': round(row[3], 2),
        'nb_non_inspectes': row[4],
        'km_non_inspectes': round(row[5], 2),
        'pct_km_inspectes': round(row[3] / row[1] * 100, 1) if row[1] > 0 else 0
    }
    print(f"Total: {stats['general']['nb_total']} collecteurs ({stats['general']['km_total']} km)")
    print(f"Inspectés: {stats['general']['nb_inspectes']} ({stats['general']['km_inspectes']} km) - {stats['general']['pct_km_inspectes']}%")
    print(f"Non inspectés: {stats['general']['nb_non_inspectes']} ({stats['general']['km_non_inspectes']} km)")

    # ============================================
    # 2. KM INSPECTES PAR ANNEE (dernière inspection)
    # ============================================
    print("\n=== 2. KM INSPECTES PAR ANNEE ===\n")

    cur.execute("""
        SELECT
            annee_derniere_inspection as annee,
            COUNT(*) as nb,
            SUM(ST_Length(geom)) / 1000 as km
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
        AND annee_derniere_inspection IS NOT NULL
        GROUP BY annee_derniere_inspection
        ORDER BY annee_derniere_inspection
    """)
    stats['par_annee'] = []
    for row in cur.fetchall():
        stats['par_annee'].append({
            'annee': int(row[0]),
            'nb': row[1],
            'km': round(row[2], 2)
        })
        print(f"  {row[0]}: {row[1]} collecteurs ({round(row[2], 2)} km)")

    # ============================================
    # 3. EVOLUTION DES INSPECTIONS (1ère et 2ème)
    # ============================================
    print("\n=== 3. INSPECTIONS PAR ANNEE (toutes) ===\n")

    cur.execute("""
        WITH all_inspections AS (
            SELECT EXTRACT(YEAR FROM date_inspection_1)::int as annee, ST_Length(geom) as longueur
            FROM assainissement.v_ass_collecteur_inspection
            WHERE proprietaire = 'Bussigny - Publique' AND date_inspection_1 IS NOT NULL
            UNION ALL
            SELECT EXTRACT(YEAR FROM date_inspection_2)::int as annee, ST_Length(geom) as longueur
            FROM assainissement.v_ass_collecteur_inspection
            WHERE proprietaire = 'Bussigny - Publique' AND date_inspection_2 IS NOT NULL
        )
        SELECT annee, COUNT(*) as nb_inspections, SUM(longueur)/1000 as km
        FROM all_inspections
        GROUP BY annee
        ORDER BY annee
    """)
    stats['inspections_toutes'] = []
    for row in cur.fetchall():
        stats['inspections_toutes'].append({
            'annee': row[0],
            'nb': row[1],
            'km': round(row[2], 2)
        })
        print(f"  {row[0]}: {row[1]} inspections ({round(row[2], 2)} km)")

    # ============================================
    # 4. COLLECTEURS INSPECTES 2 FOIS (sensibles/frequents)
    # ============================================
    print("\n=== 4. COLLECTEURS INSPECTES 2 FOIS ===\n")

    cur.execute("""
        SELECT
            COUNT(*) as nb,
            SUM(ST_Length(geom)) / 1000 as km,
            AVG(date_derniere_inspection - date_premiere_inspection) as delai_moyen_jours
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
        AND nb_inspections = 2
    """)
    row = cur.fetchone()
    stats['deux_inspections'] = {
        'nb': row[0],
        'km': round(row[1], 2),
        'delai_moyen_jours': round(row[2]) if row[2] else 0,
        'delai_moyen_annees': round(row[2] / 365, 1) if row[2] else 0
    }
    print(f"Collecteurs avec 2 inspections: {row[0]} ({round(row[1], 2)} km)")
    print(f"Délai moyen entre inspections: {round(row[2])} jours ({round(row[2]/365, 1)} ans)" if row[2] else "")

    # ============================================
    # 5. DISTRIBUTION DES DELAIS ENTRE INSPECTIONS
    # ============================================
    print("\n=== 5. DELAI ENTRE 2 INSPECTIONS ===\n")

    cur.execute("""
        SELECT
            CASE
                WHEN (date_derniere_inspection - date_premiere_inspection) < 365 THEN 'Moins de 1 an'
                WHEN (date_derniere_inspection - date_premiere_inspection) < 730 THEN '1-2 ans'
                WHEN (date_derniere_inspection - date_premiere_inspection) < 1095 THEN '2-3 ans'
                WHEN (date_derniere_inspection - date_premiere_inspection) < 1825 THEN '3-5 ans'
                ELSE 'Plus de 5 ans'
            END as tranche,
            COUNT(*) as nb,
            SUM(ST_Length(geom)) / 1000 as km
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
        AND nb_inspections = 2
        GROUP BY 1
        ORDER BY MIN(date_derniere_inspection - date_premiere_inspection)
    """)
    stats['delais_distribution'] = []
    for row in cur.fetchall():
        stats['delais_distribution'].append({
            'tranche': row[0],
            'nb': row[1],
            'km': round(row[2], 2)
        })
        print(f"  {row[0]}: {row[1]} collecteurs ({round(row[2], 2)} km)")

    # ============================================
    # 6. ETAT DES COLLECTEURS (dernière inspection)
    # ============================================
    print("\n=== 6. ETAT DES COLLECTEURS ===\n")

    cur.execute("""
        SELECT
            etat_derniere_inspection,
            id_etat_derniere_inspection,
            COUNT(*) as nb,
            SUM(ST_Length(geom)) / 1000 as km
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
        AND etat_derniere_inspection IS NOT NULL
        GROUP BY etat_derniere_inspection, id_etat_derniere_inspection
        ORDER BY id_etat_derniere_inspection
    """)
    stats['etats'] = []
    for row in cur.fetchall():
        stats['etats'].append({
            'etat': row[0],
            'nb': row[2],
            'km': round(row[3], 2)
        })
        print(f"  {row[0]}: {row[2]} collecteurs ({round(row[3], 2)} km)")

    # ============================================
    # 7. ANCIENNETE SANS INSPECTION
    # ============================================
    print("\n=== 7. ANCIENNETE DERNIERE INSPECTION ===\n")

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
            END as anciennete,
            COUNT(*) as nb,
            SUM(ST_Length(geom)) / 1000 as km
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
        GROUP BY 1
        ORDER BY MIN(COALESCE(jours_depuis_inspection, 999999))
    """)
    stats['anciennete'] = []
    for row in cur.fetchall():
        stats['anciennete'].append({
            'tranche': row[0],
            'nb': row[1],
            'km': round(row[2], 2)
        })
        print(f"  {row[0]}: {row[1]} collecteurs ({round(row[2], 2)} km)")

    # ============================================
    # 8. PAR TYPE D'EAUX
    # ============================================
    print("\n=== 8. PAR TYPE D'EAUX ===\n")

    cur.execute("""
        SELECT
            genre_utilisation,
            COUNT(*) as nb_total,
            SUM(ST_Length(geom)) / 1000 as km_total,
            COUNT(*) FILTER (WHERE nb_inspections > 0) as nb_insp,
            SUM(ST_Length(geom)) FILTER (WHERE nb_inspections > 0) / 1000 as km_insp
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
        GROUP BY genre_utilisation
        ORDER BY km_total DESC
    """)
    stats['par_type_eaux'] = []
    for row in cur.fetchall():
        pct = round(row[4] / row[2] * 100, 1) if row[2] > 0 else 0
        stats['par_type_eaux'].append({
            'type': row[0] or 'Non défini',
            'nb_total': row[1],
            'km_total': round(row[2], 2),
            'nb_insp': row[3],
            'km_insp': round(row[4], 2) if row[4] else 0,
            'pct_insp': pct
        })
        print(f"  {row[0] or 'Non défini'}: {round(row[2], 2)} km total, {round(row[4] or 0, 2)} km inspectés ({pct}%)")

    conn.close()

    # Sauvegarder en JSON pour le rapport
    with open(r'C:\Users\zema\GeoBrain\temp\stats_inspection.json', 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print("\n\nStatistiques sauvegardées dans stats_inspection.json")
    return stats

if __name__ == '__main__':
    try:
        get_stats()
    except Exception as e:
        print(f"Erreur: {e}")
