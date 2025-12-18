#!/usr/bin/env python3
"""
Script pour récupérer la structure des tables SDOL tc_conduite et tc_elemontage
À exécuter depuis srv-fme ou un poste avec accès whitelisté
"""

import psycopg2
import sys

# Configuration SDOL
SDOL_CONFIG = {
    'host': 'postgres.hkd-geomatique.com',
    'port': 5432,
    'database': 'sdol',
    'user': 'by_fme_w',
    # Mot de passe à fournir en argument ou saisir interactivement
}

def get_table_structure(conn, schema, tables):
    """Récupère la structure des tables spécifiées"""
    cur = conn.cursor()

    query = """
    SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.character_maximum_length,
        c.numeric_precision,
        c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = %s
    AND c.table_name = ANY(%s)
    ORDER BY c.table_name, c.ordinal_position
    """

    cur.execute(query, (schema, tables))
    return cur.fetchall()

def main():
    # Mot de passe en argument ou saisie interactive
    if len(sys.argv) > 1:
        password = sys.argv[1]
    else:
        import getpass
        password = getpass.getpass("Mot de passe SDOL (by_fme_w): ")

    config = SDOL_CONFIG.copy()
    config['password'] = password

    try:
        print("Connexion à SDOL...")
        conn = psycopg2.connect(**config)
        print("Connecté!\n")

        tables = ['tc_conduite', 'tc_elemontage']
        schema = 'back_hkd_databy'

        rows = get_table_structure(conn, schema, tables)

        # Affichage formaté
        current_table = None
        for row in rows:
            table, col, dtype, nullable, char_len, num_prec, default = row

            if table != current_table:
                if current_table:
                    print()
                print(f"\n### {table}")
                print(f"| Colonne | Type | Nullable | Longueur | Défaut |")
                print(f"|---------|------|----------|----------|--------|")
                current_table = table

            length = char_len or num_prec or ''
            default_val = str(default)[:30] if default else ''
            print(f"| {col} | {dtype} | {nullable} | {length} | {default_val} |")

        conn.close()
        print("\n\nTerminé!")

    except Exception as e:
        print(f"Erreur: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
