# -*- coding: utf-8 -*-
"""
Analyse des collecteurs reinspectes - patterns et statistiques
"""
import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

conn = psycopg2.connect(
    host='10.200.228.152',
    dbname='Prod',
    user='postgres',
    password='4w3TL6fsWcSqC',
    connect_timeout=10
)
conn.set_client_encoding('WIN1252')
cur = conn.cursor()

print("=" * 60)
print("ANALYSE DES REINSPECTIONS")
print("=" * 60)

# 1. Collecteurs inspectes 2 annees de suite
print("\n=== COLLECTEURS INSPECTES 2 ANNEES DE SUITE ===\n")
cur.execute("""
    SELECT
        EXTRACT(YEAR FROM date_inspection_1)::int as annee1,
        EXTRACT(YEAR FROM date_inspection_2)::int as annee2,
        COUNT(*) as nb,
        SUM(ST_Length(geom)) / 1000 as km
    FROM assainissement.v_ass_collecteur_inspection
    WHERE proprietaire = 'Bussigny - Publique'
    AND nb_inspections = 2
    GROUP BY 1, 2
    ORDER BY 1, 2
""")
for row in cur.fetchall():
    ecart = row[1] - row[0] if row[1] and row[0] else None
    print(f"  {row[0]} -> {row[1]} (ecart {ecart} ans): {row[2]} collecteurs ({row[3]:.2f} km)")

# 2. Distribution des ecarts entre inspections
print("\n=== ECART ENTRE 2 INSPECTIONS ===\n")
cur.execute("""
    SELECT
        (EXTRACT(YEAR FROM date_inspection_2) - EXTRACT(YEAR FROM date_inspection_1))::int as ecart_annees,
        COUNT(*) as nb,
        SUM(ST_Length(geom)) / 1000 as km
    FROM assainissement.v_ass_collecteur_inspection
    WHERE proprietaire = 'Bussigny - Publique'
    AND nb_inspections = 2
    GROUP BY 1
    ORDER BY 1
""")
for row in cur.fetchall():
    print(f"  Ecart {row[0]} an(s): {row[1]} collecteurs ({row[2]:.2f} km)")

# 3. Analyse par campagne annuelle (2024 et 2025)
print("\n=== ANALYSE CAMPAGNES RECENTES ===\n")

for annee in [2023, 2024, 2025]:
    print(f"\n--- Campagne {annee} ---")
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
            SUM(ST_Length(geom)) / 1000 as km_total,
            COUNT(*) FILTER (WHERE type_insp = 'insp1' AND date_inspection_2 IS NULL) as nouveaux,
            SUM(ST_Length(geom)) FILTER (WHERE type_insp = 'insp1' AND date_inspection_2 IS NULL) / 1000 as km_nouveaux,
            COUNT(*) FILTER (WHERE type_insp = 'insp2') as reinspections,
            SUM(ST_Length(geom)) FILTER (WHERE type_insp = 'insp2') / 1000 as km_reinsp
        FROM campagne
    """, (annee, annee, annee, annee))
    row = cur.fetchone()
    if row[0] > 0:
        total, km_total = row[0], row[1] or 0
        nouveaux, km_nouveaux = row[2] or 0, row[3] or 0
        reinsp, km_reinsp = row[4] or 0, row[5] or 0

        # Cas speciaux: insp1 avec deja insp2 avant (reinspection aussi)
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
        km_reinsp_special = row2[1] or 0

        total_reinsp = reinsp + reinsp_special
        km_total_reinsp = km_reinsp + km_reinsp_special
        total_nouveaux = nouveaux - reinsp_special
        km_total_nouveaux = km_nouveaux - km_reinsp_special

        pct_reinsp = (km_total_reinsp / km_total * 100) if km_total > 0 else 0
        pct_nouveaux = (km_total_nouveaux / km_total * 100) if km_total > 0 else 0

        print(f"  Total campagne: {total} collecteurs ({km_total:.2f} km)")
        print(f"  - Nouveaux (1ere inspection): {total_nouveaux} ({km_total_nouveaux:.2f} km) = {pct_nouveaux:.0f}%")
        print(f"  - Reinspections: {total_reinsp} ({km_total_reinsp:.2f} km) = {pct_reinsp:.0f}%")

# 4. Collecteurs reinspectes a intervalle regulier (potentiellement sensibles)
print("\n=== COLLECTEURS POTENTIELLEMENT SENSIBLES ===")
print("(reinspectes avec ecart <= 2 ans)\n")
cur.execute("""
    SELECT
        genre_utilisation,
        COUNT(*) as nb,
        SUM(ST_Length(geom)) / 1000 as km,
        AVG(date_derniere_inspection - date_premiere_inspection) as delai_moyen
    FROM assainissement.v_ass_collecteur_inspection
    WHERE proprietaire = 'Bussigny - Publique'
    AND nb_inspections = 2
    AND (date_derniere_inspection - date_premiere_inspection) <= 730
    GROUP BY genre_utilisation
    ORDER BY km DESC
""")
total_sensibles = 0
km_sensibles = 0
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} collecteurs ({row[2]:.2f} km), delai moyen {row[3]:.0f} jours")
    total_sensibles += row[1]
    km_sensibles += row[2]
print(f"\n  TOTAL sensibles: {total_sensibles} collecteurs ({km_sensibles:.2f} km)")

# 5. Etat des collecteurs reinspectes rapidement
print("\n=== ETAT DES COLLECTEURS REINSPECTES RAPIDEMENT ===\n")
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
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} collecteurs ({row[2]:.2f} km)")

conn.close()
print("\n" + "=" * 60)
