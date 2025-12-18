#!/usr/bin/env python3
"""
Script à exécuter sur srv-fme pour interroger la base SDOL
Utilisation: python query_sdol_srv_fme.py > resultats.txt
"""
import psycopg2
import sys
from datetime import datetime

# Connexion à SDOL
try:
    conn = psycopg2.connect(
        host="postgres.hkd-geomatique.com",
        port=5432,
        dbname="sdol",
        user="by_fme_w",
        password="dsg#6hY95!"
    )
    cur = conn.cursor()
    print(f"✓ Connexion à SDOL établie - {datetime.now()}")
    print("=" * 80)
except Exception as e:
    print(f"✗ Erreur de connexion: {e}", file=sys.stderr)
    sys.exit(1)

print("\n### QUESTION 1 - Structure tables EU (assainissement) ###\n")
print("Colonnes des tables eu_chambre, eu_collecteur, eu_grille\n")

query1 = """
SELECT table_name, column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'back_hkd_databy' 
AND table_name IN ('eu_chambre', 'eu_collecteur', 'eu_grille')
ORDER BY table_name, ordinal_position;
"""
cur.execute(query1)
rows1 = cur.fetchall()
print(f"Total: {len(rows1)} colonnes\n")

current_table = None
for row in rows1:
    if current_table != row[0]:
        current_table = row[0]
        print(f"\n--- TABLE: {current_table} ---")
    print(f"  {row[1]:30} {row[2]:20} max_length={row[3]} nullable={row[4]}")

print("\n" + "=" * 80)
print("\n### QUESTION 2 - Valeurs de domaines existantes ###\n")

# Domaines eu_chambre
print("\n--- eu_chambre.contenu (LIMIT 20) ---")
cur.execute("SELECT DISTINCT contenu FROM back_hkd_databy.eu_chambre WHERE contenu IS NOT NULL ORDER BY contenu LIMIT 20;")
for row in cur.fetchall():
    print(f"  • {row[0]}")

print("\n--- eu_chambre.proprio (LIMIT 20) ---")
cur.execute("SELECT DISTINCT proprio FROM back_hkd_databy.eu_chambre WHERE proprio IS NOT NULL ORDER BY proprio LIMIT 20;")
for row in cur.fetchall():
    print(f"  • {row[0]}")

print("\n--- eu_chambre.etat_constr (LIMIT 20) ---")
cur.execute("SELECT DISTINCT etat_constr FROM back_hkd_databy.eu_chambre WHERE etat_constr IS NOT NULL ORDER BY etat_constr LIMIT 20;")
for row in cur.fetchall():
    print(f"  • {row[0]}")

print("\n--- eu_chambre.accessibilite (LIMIT 20) ---")
cur.execute("SELECT DISTINCT accessibilite FROM back_hkd_databy.eu_chambre WHERE accessibilite IS NOT NULL ORDER BY accessibilite LIMIT 20;")
for row in cur.fetchall():
    print(f"  • {row[0]}")

# Domaines eu_collecteur
print("\n--- eu_collecteur.contenu (LIMIT 20) ---")
cur.execute("SELECT DISTINCT contenu FROM back_hkd_databy.eu_collecteur WHERE contenu IS NOT NULL ORDER BY contenu LIMIT 20;")
for row in cur.fetchall():
    print(f"  • {row[0]}")

print("\n--- eu_collecteur.materiau (LIMIT 20) ---")
cur.execute("SELECT DISTINCT materiau FROM back_hkd_databy.eu_collecteur WHERE materiau IS NOT NULL ORDER BY materiau LIMIT 20;")
for row in cur.fetchall():
    print(f"  • {row[0]}")

print("\n--- eu_collecteur.fonction (LIMIT 20) ---")
cur.execute("SELECT DISTINCT fonction FROM back_hkd_databy.eu_collecteur WHERE fonction IS NOT NULL ORDER BY fonction LIMIT 20;")
for row in cur.fetchall():
    print(f"  • {row[0]}")

print("\n" + "=" * 80)
print("\n### QUESTION 3 - Valeur data_owner utilisée ###\n")

print("\n--- eu_chambre.data_owner ---")
cur.execute("SELECT DISTINCT data_owner FROM back_hkd_databy.eu_chambre LIMIT 10;")
for row in cur.fetchall():
    print(f"  • {row[0]}")

print("\n--- eu_collecteur.data_owner ---")
cur.execute("SELECT DISTINCT data_owner FROM back_hkd_databy.eu_collecteur LIMIT 10;")
for row in cur.fetchall():
    print(f"  • {row[0]}")

print("\n--- tp_bus_s.data_owner ---")
cur.execute("SELECT DISTINCT data_owner FROM back_hkd_databy.tp_bus_s LIMIT 10;")
for row in cur.fetchall():
    print(f"  • {row[0]}")

print("\n--- mo_par.data_owner ---")
cur.execute("SELECT DISTINCT data_owner FROM back_hkd_databy.mo_par LIMIT 10;")
for row in cur.fetchall():
    print(f"  • {row[0]}")

# Fermeture
cur.close()
conn.close()

print("\n" + "=" * 80)
print(f"\n✓ Script terminé - {datetime.now()}")
