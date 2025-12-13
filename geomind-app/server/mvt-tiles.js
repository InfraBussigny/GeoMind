/**
 * GeoMind - MVT Tiles Generator
 * Génération de Vector Tiles (MVT) depuis PostGIS
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { SphericalMercator } = require('@mapbox/sphericalmercator');
import * as connections from './connections.js';

// Convertisseur de coordonnées tuiles
const merc = new SphericalMercator({ size: 256 });

/**
 * Convertit les coordonnées de tuile (z/x/y) en bbox EPSG:3857
 */
export function tileToBBox(z, x, y) {
  // Retourne [minX, minY, maxX, maxY] en EPSG:3857 (Web Mercator)
  return merc.bbox(x, y, z, false, '900913');
}

/**
 * Récupère la liste des tables avec des colonnes géométriques
 */
export async function getGeometryTables(connectionId) {
  const query = `
    SELECT
      f_table_schema as schema,
      f_table_name as table_name,
      f_geometry_column as geometry_column,
      type as geometry_type,
      srid,
      coord_dimension
    FROM geometry_columns
    WHERE f_table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'topology')
    ORDER BY f_table_schema, f_table_name
  `;

  try {
    const result = await connections.executeSQL(connectionId, query);
    return result.rows.map(row => ({
      schema: row.schema,
      table: row.table_name,
      fullName: `${row.schema}.${row.table_name}`,
      geometryColumn: row.geometry_column,
      geometryType: row.geometry_type,
      srid: row.srid,
      coordDimension: row.coord_dimension
    }));
  } catch (error) {
    console.error('[MVT] Erreur getGeometryTables:', error.message);
    throw error;
  }
}

/**
 * Récupère l'extent (bbox) d'une table géométrique
 */
export async function getTableExtent(connectionId, schema, table) {
  // D'abord récupérer le nom de la colonne géométrique
  const geoColQuery = `
    SELECT f_geometry_column, srid
    FROM geometry_columns
    WHERE f_table_schema = $1 AND f_table_name = $2
    LIMIT 1
  `;

  try {
    const geoResult = await connections.executeSQL(connectionId, geoColQuery.replace('$1', `'${schema}'`).replace('$2', `'${table}'`));

    if (geoResult.rows.length === 0) {
      throw new Error(`Table ${schema}.${table} n'a pas de colonne géométrique`);
    }

    const geomCol = geoResult.rows[0].f_geometry_column;
    const srid = geoResult.rows[0].srid;

    // Calculer l'extent en EPSG:4326 (lat/lon) pour MapLibre
    const extentQuery = `
      SELECT
        ST_XMin(extent) as minx,
        ST_YMin(extent) as miny,
        ST_XMax(extent) as maxx,
        ST_YMax(extent) as maxy
      FROM (
        SELECT ST_Extent(ST_Transform("${geomCol}", 4326)) as extent
        FROM "${schema}"."${table}"
        WHERE "${geomCol}" IS NOT NULL
      ) sub
    `;

    const extentResult = await connections.executeSQL(connectionId, extentQuery);

    if (extentResult.rows.length === 0 || !extentResult.rows[0].minx) {
      // Table vide, retourner extent par défaut (Suisse)
      return {
        minx: 5.9,
        miny: 45.8,
        maxx: 10.5,
        maxy: 47.8,
        center: [8.2, 46.8]
      };
    }

    const { minx, miny, maxx, maxy } = extentResult.rows[0];
    return {
      minx: parseFloat(minx),
      miny: parseFloat(miny),
      maxx: parseFloat(maxx),
      maxy: parseFloat(maxy),
      center: [(parseFloat(minx) + parseFloat(maxx)) / 2, (parseFloat(miny) + parseFloat(maxy)) / 2]
    };
  } catch (error) {
    console.error('[MVT] Erreur getTableExtent:', error.message);
    throw error;
  }
}

/**
 * Récupère les colonnes d'attributs d'une table (exclut géométrie)
 */
export async function getTableAttributes(connectionId, schema, table) {
  const query = `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = '${schema}' AND table_name = '${table}'
      AND udt_name NOT IN ('geometry', 'geography')
    ORDER BY ordinal_position
    LIMIT 20
  `;

  try {
    const result = await connections.executeSQL(connectionId, query);
    return result.rows;
  } catch (error) {
    console.error('[MVT] Erreur getTableAttributes:', error.message);
    return [];
  }
}

/**
 * Génère une tuile MVT pour une table donnée
 */
export async function getTile(connectionId, schema, table, z, x, y) {
  // Obtenir la bbox de la tuile en EPSG:3857
  const bbox = tileToBBox(z, x, y);
  const [minX, minY, maxX, maxY] = bbox;

  // Récupérer info géométrie
  const geoColQuery = `
    SELECT f_geometry_column, srid
    FROM geometry_columns
    WHERE f_table_schema = '${schema}' AND f_table_name = '${table}'
    LIMIT 1
  `;

  try {
    const geoResult = await connections.executeSQL(connectionId, geoColQuery);

    if (geoResult.rows.length === 0) {
      throw new Error(`Table ${schema}.${table} n'a pas de colonne géométrique`);
    }

    const geomCol = geoResult.rows[0].f_geometry_column;
    const sourceSrid = geoResult.rows[0].srid;

    // Récupérer quelques attributs (limiter pour performance)
    const attributes = await getTableAttributes(connectionId, schema, table);
    const attrSelect = attributes.length > 0
      ? attributes.slice(0, 10).map(a => `"${a.column_name}"`).join(', ') + ','
      : '';

    // Simplification adaptative selon le niveau de zoom
    const simplifyTolerance = z < 10 ? 100 : (z < 14 ? 10 : 0);
    const simplifyClause = simplifyTolerance > 0
      ? `ST_Simplify(geom_3857, ${simplifyTolerance})`
      : 'geom_3857';

    // Requête MVT avec ST_AsMVT et ST_AsMVTGeom
    const mvtQuery = `
      SELECT ST_AsMVT(tile, '${table}', 4096, 'geom') AS mvt
      FROM (
        SELECT
          ST_AsMVTGeom(
            ${simplifyClause},
            ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 3857),
            4096,
            256,
            true
          ) AS geom,
          ${attrSelect}
          1 as _dummy
        FROM (
          SELECT
            ${attrSelect.replace(/,\s*$/, '')}${attrSelect ? ',' : ''}
            ST_Transform("${geomCol}", 3857) as geom_3857
          FROM "${schema}"."${table}"
          WHERE "${geomCol}" IS NOT NULL
            AND ST_Intersects(
              ST_Transform("${geomCol}", 3857),
              ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 3857)
            )
        ) sub
      ) AS tile
      WHERE geom IS NOT NULL
    `;

    const result = await connections.executeSQL(connectionId, mvtQuery);

    if (result.rows.length === 0 || !result.rows[0].mvt) {
      // Tuile vide
      return Buffer.alloc(0);
    }

    // Le résultat est un Buffer (bytea en PostgreSQL)
    return Buffer.from(result.rows[0].mvt);
  } catch (error) {
    console.error(`[MVT] Erreur getTile ${schema}.${table} z${z}/x${x}/y${y}:`, error.message);
    throw error;
  }
}
