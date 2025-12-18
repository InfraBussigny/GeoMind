# -*- coding: utf-8 -*-
import psycopg2
import sys

# Force console encoding
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

    print('=== COLLECTEURS: genre_utilisation ===')
    cur.execute("""
        SELECT DISTINCT genre_utilisation, COUNT(*)
        FROM assainissement.by_ass_collecteur
        WHERE genre_utilisation IS NOT NULL
        GROUP BY genre_utilisation
        ORDER BY COUNT(*) DESC
    """)
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]}')

    print()
    print('=== CHAMBRES: fonction_hydro ===')
    cur.execute("""
        SELECT DISTINCT fonction_hydro, COUNT(*)
        FROM assainissement.by_ass_chambre
        WHERE fonction_hydro IS NOT NULL
        GROUP BY fonction_hydro
        ORDER BY COUNT(*) DESC
    """)
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]}')

    print()
    print('=== CHAMBRES: genre_chambre (si existe) ===')
    try:
        cur.execute("""
            SELECT DISTINCT genre_chambre, COUNT(*)
            FROM assainissement.by_ass_chambre
            WHERE genre_chambre IS NOT NULL
            GROUP BY genre_chambre
            ORDER BY COUNT(*) DESC
        """)
        for row in cur.fetchall():
            print(f'  {row[0]}: {row[1]}')
    except:
        print('  (colonne non trouvée)')

    conn.close()
    print('\nConnexion OK')

except Exception as e:
    error_msg = str(e)
    # Try to decode if needed
    try:
        if isinstance(e.args[0], bytes):
            error_msg = e.args[0].decode('latin1')
    except:
        pass
    print(f'Erreur connexion: {error_msg}')
