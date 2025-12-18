# -*- coding: utf-8 -*-
import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

try:
    conn = psycopg2.connect(
        host='10.200.228.152',
        dbname='Prod',
        user='postgres',
        password='4w3TL6fsWcSqC',
        connect_timeout=10
    )
    conn.set_client_encoding('WIN1252')
    cur = conn.cursor()

    print('=== ANALYSE DES DATES D\'INSPECTION ===\n')

    # Nombre total de collecteurs publics
    cur.execute("""
        SELECT COUNT(*) FROM assainissement.by_ass_collecteur
        WHERE proprietaire = 'Bussigny - Publique'
    """)
    total = cur.fetchone()[0]
    print(f'Total collecteurs publics: {total}\n')

    # Distribution des dates
    cur.execute("""
        SELECT
            COUNT(*) FILTER (WHERE date_inspection_1 IS NULL AND date_inspection_2 IS NULL) as aucune,
            COUNT(*) FILTER (WHERE date_inspection_1 IS NOT NULL AND date_inspection_2 IS NULL) as date1_seule,
            COUNT(*) FILTER (WHERE date_inspection_1 IS NULL AND date_inspection_2 IS NOT NULL) as date2_seule,
            COUNT(*) FILTER (WHERE date_inspection_1 IS NOT NULL AND date_inspection_2 IS NOT NULL) as les_deux
        FROM assainissement.by_ass_collecteur
        WHERE proprietaire = 'Bussigny - Publique'
    """)
    row = cur.fetchone()
    print(f'Aucune date: {row[0]}')
    print(f'Date 1 seule: {row[1]}')
    print(f'Date 2 seule: {row[2]}')
    print(f'Les deux dates: {row[3]}\n')

    # Cas problematiques: date2 < date1 (date2 n'est pas la plus recente)
    cur.execute("""
        SELECT COUNT(*)
        FROM assainissement.by_ass_collecteur
        WHERE proprietaire = 'Bussigny - Publique'
        AND date_inspection_1 IS NOT NULL
        AND date_inspection_2 IS NOT NULL
        AND date_inspection_2 < date_inspection_1
    """)
    inversees = cur.fetchone()[0]
    print(f'Cas dates inversees (date2 < date1): {inversees}\n')

    # Exemples de dates inversees
    if inversees > 0:
        print('=== EXEMPLES DE DATES INVERSEES ===')
        cur.execute("""
            SELECT gid, date_inspection_1, date_inspection_2, etat_inspection_1, etat_inspection_2
            FROM assainissement.by_ass_collecteur
            WHERE proprietaire = 'Bussigny - Publique'
            AND date_inspection_1 IS NOT NULL
            AND date_inspection_2 IS NOT NULL
            AND date_inspection_2 < date_inspection_1
            LIMIT 10
        """)
        for row in cur.fetchall():
            print(f'  GID {row[0]}: date1={row[1]}, date2={row[2]} | etat1={row[3]}, etat2={row[4]}')

    print('\n=== PLAGE DES DATES ===')
    cur.execute("""
        SELECT
            MIN(date_inspection_1), MAX(date_inspection_1),
            MIN(date_inspection_2), MAX(date_inspection_2)
        FROM assainissement.by_ass_collecteur
        WHERE proprietaire = 'Bussigny - Publique'
    """)
    row = cur.fetchone()
    print(f'Date 1: min={row[0]}, max={row[1]}')
    print(f'Date 2: min={row[2]}, max={row[3]}')

    # Colonnes existantes liees aux inspections
    print('\n=== COLONNES INSPECTION EXISTANTES ===')
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'assainissement'
        AND table_name = 'by_ass_collecteur'
        AND column_name LIKE '%inspect%'
        ORDER BY ordinal_position
    """)
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]}')

    conn.close()
    print('\nConnexion OK')

except Exception as e:
    print(f'Erreur: {e}')
