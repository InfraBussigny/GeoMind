# -*- coding: utf-8 -*-
import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VIEW_SQL = """
-- Vue pour le suivi des inspections avec calcul automatique des dates
CREATE OR REPLACE VIEW assainissement.v_ass_collecteur_inspection AS
SELECT
    c.*,

    -- Nombre d'inspections (0, 1 ou 2)
    CASE
        WHEN c.date_inspection_1 IS NULL AND c.date_inspection_2 IS NULL THEN 0
        WHEN c.date_inspection_1 IS NOT NULL AND c.date_inspection_2 IS NOT NULL THEN 2
        ELSE 1
    END AS nb_inspections,

    -- Date de la dernière inspection (la plus récente)
    GREATEST(c.date_inspection_1, c.date_inspection_2) AS date_derniere_inspection,

    -- Date de la première inspection (la plus ancienne)
    LEAST(
        COALESCE(c.date_inspection_1, c.date_inspection_2),
        COALESCE(c.date_inspection_2, c.date_inspection_1)
    ) AS date_premiere_inspection,

    -- État de la dernière inspection
    CASE
        WHEN c.date_inspection_1 IS NULL AND c.date_inspection_2 IS NULL THEN NULL
        WHEN c.date_inspection_2 IS NULL THEN c.etat_inspection_1
        WHEN c.date_inspection_1 IS NULL THEN c.etat_inspection_2
        WHEN c.date_inspection_1 >= c.date_inspection_2 THEN c.etat_inspection_1
        ELSE c.etat_inspection_2
    END AS etat_derniere_inspection,

    -- ID état de la dernière inspection
    CASE
        WHEN c.date_inspection_1 IS NULL AND c.date_inspection_2 IS NULL THEN NULL
        WHEN c.date_inspection_2 IS NULL THEN c.id_etat_inspection_1
        WHEN c.date_inspection_1 IS NULL THEN c.id_etat_inspection_2
        WHEN c.date_inspection_1 >= c.date_inspection_2 THEN c.id_etat_inspection_1
        ELSE c.id_etat_inspection_2
    END AS id_etat_derniere_inspection,

    -- Année de la dernière inspection
    EXTRACT(YEAR FROM GREATEST(c.date_inspection_1, c.date_inspection_2))::INTEGER AS annee_derniere_inspection,

    -- Jours depuis la dernière inspection
    CASE
        WHEN GREATEST(c.date_inspection_1, c.date_inspection_2) IS NOT NULL
        THEN (CURRENT_DATE - GREATEST(c.date_inspection_1, c.date_inspection_2))
        ELSE NULL
    END AS jours_depuis_inspection

FROM assainissement.by_ass_collecteur c;

-- Commentaire sur la vue
COMMENT ON VIEW assainissement.v_ass_collecteur_inspection IS
'Vue collecteurs avec calcul automatique des dates d''inspection.
Champs ajoutés: nb_inspections, date_derniere_inspection, date_premiere_inspection,
etat_derniere_inspection, id_etat_derniere_inspection, annee_derniere_inspection, jours_depuis_inspection.
Créée le 2025-12-18 par GeoBrain.';
"""

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

    print('Création de la vue v_ass_collecteur_inspection...')
    cur.execute(VIEW_SQL)
    conn.commit()
    print('Vue créée avec succès!')

    # Vérification
    print('\n=== VERIFICATION ===')
    cur.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE nb_inspections = 0) as sans_insp,
            COUNT(*) FILTER (WHERE nb_inspections = 1) as une_insp,
            COUNT(*) FILTER (WHERE nb_inspections = 2) as deux_insp
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
    """)
    row = cur.fetchone()
    print(f'Total: {row[0]} | Sans: {row[1]} | 1 insp: {row[2]} | 2 insp: {row[3]}')

    # Exemple des nouveaux champs
    print('\n=== EXEMPLE DONNEES ===')
    cur.execute("""
        SELECT gid, date_inspection_1, date_inspection_2,
               date_derniere_inspection, etat_derniere_inspection,
               annee_derniere_inspection, jours_depuis_inspection
        FROM assainissement.v_ass_collecteur_inspection
        WHERE proprietaire = 'Bussigny - Publique'
        AND nb_inspections = 2
        LIMIT 5
    """)
    for row in cur.fetchall():
        print(f'  GID {row[0]}: d1={row[1]}, d2={row[2]} -> derniere={row[3]}, etat={row[4]}, annee={row[5]}, jours={row[6]}')

    conn.close()
    print('\nTerminé!')

except Exception as e:
    print(f'Erreur: {e}')
