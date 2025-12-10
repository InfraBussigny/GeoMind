-- Statistiques parcelles Bussigny depuis base prod/couche BDCO
-- Auteur : GeoBrain (Agent SQL/PostGIS)
-- Date : 2025-12-08

-- Requête principale : comptage parcelles par type de propriété
SELECT 
    CASE 
        WHEN proprietaire LIKE '%COMMUNE%' OR proprietaire LIKE '%BUSSIGNY%' THEN 'DP Communal'
        WHEN proprietaire LIKE '%CANTON%' OR proprietaire LIKE '%VAUD%' OR proprietaire LIKE '%ÉTAT%' THEN 'DP Cantonal'
        ELSE 'Privé'
    END AS type_propriete,
    COUNT(*) as nombre_parcelles,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as pourcentage
FROM bdco
WHERE commune = 'Bussigny'  -- ou code commune si différent
    OR commune_nom = 'Bussigny'
    OR ST_Within(geom, (SELECT geom FROM limites_communales WHERE nom = 'Bussigny'))
GROUP BY type_propriete
ORDER BY nombre_parcelles DESC;

-- Requête alternative si structure différente
-- (à adapter selon les champs disponibles dans BDCO)

-- Option 2 : Si champ type_propriete existe
/*
SELECT type_propriete,
    COUNT(*) as nombre_parcelles,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as pourcentage
FROM bdco
WHERE commune_code = (SELECT code FROM communes WHERE nom = 'Bussigny')
GROUP BY type_propriete
ORDER BY nombre_parcelles DESC;
*/

-- Option 3 : Si code de propriété numérique
/*
SELECT 
    CASE 
        WHEN code_propriete = 1 THEN 'Privé'
        WHEN code_propriete = 2 THEN 'DP Communal'  
        WHEN code_propriete = 3 THEN 'DP Cantonal'
        ELSE 'Autre'
    END AS type_propriete,
    COUNT(*) as nombre_parcelles,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as pourcentage
FROM bdco
WHERE commune = 'Bussigny'
GROUP BY code_propriete
ORDER BY nombre_parcelles DESC;
*/

-- Requête de diagnostic : structure de la table BDCO
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bdco' 
ORDER BY ordinal_position;

-- Total parcelles Bussigny
SELECT COUNT(*) as total_parcelles
FROM bdco
WHERE commune = 'Bussigny' OR commune_nom = 'Bussigny';