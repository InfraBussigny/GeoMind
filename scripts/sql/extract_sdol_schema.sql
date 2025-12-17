-- ============================================================================
-- EXTRACTION SCHEMA SDOL - À exécuter sur srv-fme
-- ============================================================================
-- Connexion : psql -h postgres.hkd-geomatique.com -p 5432 -U by_lgr -d sdol
-- Mot de passe : H5$HrjTg&f
-- ============================================================================

-- Sortie en CSV pour faciliter l'analyse
\pset format csv
\pset tuples_only off

-- ============================================================================
-- 1. LISTE DES SCHEMAS
-- ============================================================================
\echo '=== SCHEMAS ==='
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name LIKE 'back_hkd%'
ORDER BY schema_name;

-- ============================================================================
-- 2. TABLES DU SCHEMA BUSSIGNY (back_hkd_databy)
-- ============================================================================
\echo '=== TABLES BUSSIGNY ==='
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'back_hkd_databy'
ORDER BY table_name;

-- ============================================================================
-- 3. STRUCTURE DETAILLEE DES TABLES (colonnes, types)
-- ============================================================================
\echo '=== COLONNES DETAILLEES ==='
SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.numeric_precision,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c
    ON t.table_schema = c.table_schema
    AND t.table_name = c.table_name
WHERE t.table_schema = 'back_hkd_databy'
ORDER BY t.table_name, c.ordinal_position;

-- ============================================================================
-- 4. TABLES ASSAINISSEMENT (eu_*)
-- ============================================================================
\echo '=== TABLES ASSAINISSEMENT EU ==='
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'back_hkd_databy'
  AND table_name LIKE 'eu_%'
ORDER BY table_name;

-- ============================================================================
-- 5. STRUCTURE TABLE EU_CHAMBRE (mapping principal)
-- ============================================================================
\echo '=== STRUCTURE EU_CHAMBRE ==='
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'back_hkd_databy'
  AND table_name = 'eu_chambre'
ORDER BY ordinal_position;

-- ============================================================================
-- 6. STRUCTURE TABLE EU_TRONCON
-- ============================================================================
\echo '=== STRUCTURE EU_TRONCON ==='
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'back_hkd_databy'
  AND table_name = 'eu_troncon'
ORDER BY ordinal_position;

-- ============================================================================
-- 7. TABLES DE DOMAINES/VALEURS
-- ============================================================================
\echo '=== TABLES DE DOMAINES ==='
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'back_hkd_databy'
  AND (table_name LIKE '%_val_%' OR table_name LIKE 'val_%' OR table_name LIKE '%_dom_%')
ORDER BY table_name;

-- ============================================================================
-- 8. COMPTAGE PAR TABLE
-- ============================================================================
\echo '=== COMPTAGE ENREGISTREMENTS ==='
SELECT
    schemaname,
    relname as table_name,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'back_hkd_databy'
ORDER BY n_live_tup DESC;

-- ============================================================================
-- 9. CONTRAINTES ET CLES
-- ============================================================================
\echo '=== CONTRAINTES ==='
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'back_hkd_databy'
ORDER BY tc.table_name, tc.constraint_type;

\echo '=== FIN EXTRACTION ==='
