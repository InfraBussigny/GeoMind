-- Export de la structure du schéma fibre_optique
-- À exécuter dans DBeaver ou pgAdmin sur la base srv-fme/Prod

-- Liste des tables et vues
SELECT 
    schemaname AS schema,
    tablename AS table_name,
    'TABLE' AS object_type
FROM pg_tables
WHERE schemaname = 'fibre_optique'
UNION ALL
SELECT 
    schemaname AS schema,
    viewname AS table_name,
    'VIEW' AS object_type
FROM pg_views
WHERE schemaname = 'fibre_optique'
ORDER BY table_name;

-- Structure détaillée de TOUTES les tables/vues
SELECT 
    c.table_name,
    c.ordinal_position AS pos,
    c.column_name,
    c.data_type,
    CASE 
        WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
        WHEN c.numeric_precision IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || COALESCE(c.numeric_scale, 0) || ')'
        ELSE c.data_type
    END AS full_type,
    c.is_nullable,
    c.column_default,
    pgd.description AS comment
FROM information_schema.columns c
LEFT JOIN pg_catalog.pg_statio_all_tables st 
    ON c.table_schema = st.schemaname AND c.table_name = st.relname
LEFT JOIN pg_catalog.pg_description pgd 
    ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
WHERE c.table_schema = 'fibre_optique'
ORDER BY c.table_name, c.ordinal_position;
