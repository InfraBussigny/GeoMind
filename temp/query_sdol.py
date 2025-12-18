import psycopg2
import json

# Connexion à SDOL
conn = psycopg2.connect(
    host="postgres.hkd-geomatique.com",
    port=5432,
    dbname="sdol",
    user="by_fme_w",
    password="dsg#6hY95!"
)
cur = conn.cursor()

results = {}

print("=== QUESTION 1 - Structure tables EU (assainissement) ===\n")
query1 = """
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'back_hkd_databy' 
AND table_name IN ('eu_chambre', 'eu_collecteur', 'eu_grille')
ORDER BY table_name, ordinal_position;
"""
cur.execute(query1)
rows1 = cur.fetchall()
results['structure_tables_eu'] = rows1
print(f"Structure des 3 tables EU : {len(rows1)} colonnes")
for row in rows1:
    print(f"  {row[0]:30} {row[1]:20} max_length={row[2]} nullable={row[3]}")

print("\n=== QUESTION 2 - Valeurs de domaines existantes ===\n")

# Domaines eu_chambre
print("--- eu_chambre.contenu ---")
cur.execute("SELECT DISTINCT contenu FROM back_hkd_databy.eu_chambre WHERE contenu IS NOT NULL LIMIT 20;")
rows_contenu_ch = cur.fetchall()
results['eu_chambre_contenu'] = rows_contenu_ch
for row in rows_contenu_ch:
    print(f"  {row[0]}")

print("\n--- eu_chambre.proprio ---")
cur.execute("SELECT DISTINCT proprio FROM back_hkd_databy.eu_chambre WHERE proprio IS NOT NULL LIMIT 20;")
rows_proprio = cur.fetchall()
results['eu_chambre_proprio'] = rows_proprio
for row in rows_proprio:
    print(f"  {row[0]}")

print("\n--- eu_chambre.etat_constr ---")
cur.execute("SELECT DISTINCT etat_constr FROM back_hkd_databy.eu_chambre WHERE etat_constr IS NOT NULL LIMIT 20;")
rows_etat = cur.fetchall()
results['eu_chambre_etat_constr'] = rows_etat
for row in rows_etat:
    print(f"  {row[0]}")

print("\n--- eu_chambre.accessibilite ---")
cur.execute("SELECT DISTINCT accessibilite FROM back_hkd_databy.eu_chambre WHERE accessibilite IS NOT NULL LIMIT 20;")
rows_acc = cur.fetchall()
results['eu_chambre_accessibilite'] = rows_acc
for row in rows_acc:
    print(f"  {row[0]}")

# Domaines eu_collecteur
print("\n--- eu_collecteur.contenu ---")
cur.execute("SELECT DISTINCT contenu FROM back_hkd_databy.eu_collecteur WHERE contenu IS NOT NULL LIMIT 20;")
rows_contenu_co = cur.fetchall()
results['eu_collecteur_contenu'] = rows_contenu_co
for row in rows_contenu_co:
    print(f"  {row[0]}")

print("\n--- eu_collecteur.materiau ---")
cur.execute("SELECT DISTINCT materiau FROM back_hkd_databy.eu_collecteur WHERE materiau IS NOT NULL LIMIT 20;")
rows_mat = cur.fetchall()
results['eu_collecteur_materiau'] = rows_mat
for row in rows_mat:
    print(f"  {row[0]}")

print("\n--- eu_collecteur.fonction ---")
cur.execute("SELECT DISTINCT fonction FROM back_hkd_databy.eu_collecteur WHERE fonction IS NOT NULL LIMIT 20;")
rows_fonc = cur.fetchall()
results['eu_collecteur_fonction'] = rows_fonc
for row in rows_fonc:
    print(f"  {row[0]}")

print("\n=== QUESTION 3 - Valeur data_owner utilisée ===\n")

print("--- eu_chambre.data_owner ---")
cur.execute("SELECT DISTINCT data_owner FROM back_hkd_databy.eu_chambre LIMIT 10;")
rows_owner_ch = cur.fetchall()
results['eu_chambre_data_owner'] = rows_owner_ch
for row in rows_owner_ch:
    print(f"  {row[0]}")

print("\n--- eu_collecteur.data_owner ---")
cur.execute("SELECT DISTINCT data_owner FROM back_hkd_databy.eu_collecteur LIMIT 10;")
rows_owner_co = cur.fetchall()
results['eu_collecteur_data_owner'] = rows_owner_co
for row in rows_owner_co:
    print(f"  {row[0]}")

print("\n--- tp_bus_s.data_owner ---")
cur.execute("SELECT DISTINCT data_owner FROM back_hkd_databy.tp_bus_s LIMIT 10;")
rows_owner_tp = cur.fetchall()
results['tp_bus_s_data_owner'] = rows_owner_tp
for row in rows_owner_tp:
    print(f"  {row[0]}")

print("\n--- mo_par.data_owner ---")
cur.execute("SELECT DISTINCT data_owner FROM back_hkd_databy.mo_par LIMIT 10;")
rows_owner_mo = cur.fetchall()
results['mo_par_data_owner'] = rows_owner_mo
for row in rows_owner_mo:
    print(f"  {row[0]}")

# Fermeture
cur.close()
conn.close()

# Export JSON
with open('C:/Users/zema/GeoBrain/temp/query_sdol_results.json', 'w', encoding='utf-8') as f:
    # Convertir tuples en listes pour JSON
    json_results = {}
    for key, value in results.items():
        json_results[key] = [list(row) for row in value]
    json.dump(json_results, f, indent=2, ensure_ascii=False)

print("\n✓ Résultats exportés dans query_sdol_results.json")
