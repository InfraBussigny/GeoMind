import pyodbc
import sys

# Connexion à PostgreSQL via ODBC (si disponible)
# Alternative: utiliser subprocess pour appeler psql si disponible

# Méthode 1: Essayer avec pyodbc PostgreSQL driver
try:
    conn_str = (
        'Driver={PostgreSQL Unicode};'
        'Server=srv-fme;'
        'Port=5432;'
        'Database=Prod;'
        'Uid=postgres;'
        'Pwd=;'  # Mot de passe si nécessaire
    )
    conn = pyodbc.connect(conn_str, timeout=10)
    cursor = conn.cursor()
    
    query = """
    SELECT 
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        pgd.description as comment
    FROM information_schema.columns c
    LEFT JOIN pg_catalog.pg_statio_all_tables st 
        ON c.table_schema = st.schemaname AND c.table_name = st.relname
    LEFT JOIN pg_catalog.pg_description pgd 
        ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
    WHERE c.table_schema = 'fibre_optique'
    ORDER BY c.table_name, c.ordinal_position;
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    
    # Affichage CSV pour parsing facile
    print("table_name|column_name|data_type|is_nullable|column_default|comment")
    for row in rows:
        values = [str(x) if x is not None else '' for x in row]
        print('|'.join(values))
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Erreur: {e}", file=sys.stderr)
    print("\nPas de driver ODBC PostgreSQL disponible.", file=sys.stderr)
    print("Essayez d'installer le driver PostgreSQL ODBC ou utilisez DBeaver/pgAdmin.", file=sys.stderr)
    sys.exit(1)
