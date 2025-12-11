/**
 * SQL Assistant - Mode intelligent pour requêtes sur les données
 * Détecte automatiquement les questions sur les données et exécute les requêtes SQL
 * avant de passer les résultats au LLM pour formulation de réponse
 */

import * as connections from './connections.js';

// ============================================
// PATTERNS DE DÉTECTION
// ============================================

const DATA_KEYWORDS = {
  // Questions de comptage
  count: ['combien', 'nombre', 'compte', 'total', 'quantité', 'how many', 'count'],

  // Entités géographiques
  entities: {
    parcelle: ['parcelle', 'parcelles', 'terrain', 'terrains', 'bien-fonds', 'biens-fonds'],
    batiment: ['bâtiment', 'bâtiments', 'batiment', 'batiments', 'immeuble', 'immeubles', 'construction', 'constructions', 'maison', 'maisons'],
    adresse: ['adresse', 'adresses', 'rue', 'rues', 'chemin', 'chemins', 'avenue', 'avenues', 'route', 'routes'],
    collecteur: ['collecteur', 'collecteurs', 'conduite', 'conduites', 'canalisation', 'canalisations', 'égout', 'égouts', 'eaux usées', 'eaux pluviales'],
    chambre: ['chambre', 'chambres', 'regard', 'regards', 'puits'],
    hydrant: ['hydrant', 'hydrants', 'borne', 'bornes hydrantes', 'bouche incendie'],
    route_troncon: ['tronçon', 'tronçons', 'route', 'routes', 'voirie']
  },

  // Actions
  actions: ['liste', 'lister', 'affiche', 'afficher', 'montre', 'montrer', 'donne', 'donner', 'quels', 'quelles', 'quel', 'quelle'],

  // Agrégations
  aggregations: ['surface', 'superficie', 'longueur', 'moyenne', 'somme', 'max', 'min', 'plus grand', 'plus petit']
};

// ============================================
// REQUÊTES SQL PRÉDÉFINIES
// ============================================

const SQL_TEMPLATES = {
  // Parcelles (surface_vd = surface officielle VD)
  parcelle_count: `SELECT COUNT(*) as total FROM bdco.bdco_parcelle`,
  parcelle_by_genre: `SELECT genre, COUNT(*) as nombre, ROUND(SUM(surface_vd)::numeric, 2) as surface_m2
    FROM bdco.bdco_parcelle GROUP BY genre ORDER BY nombre DESC`,
  parcelle_surface_total: `SELECT ROUND(SUM(surface_vd)::numeric, 2) as surface_totale_m2,
    ROUND(SUM(surface_vd)::numeric / 10000, 2) as surface_totale_ha FROM bdco.bdco_parcelle`,
  parcelle_list: `SELECT numero, identdn, genre, surface_vd as surface_m2
    FROM bdco.bdco_parcelle ORDER BY surface_vd DESC LIMIT 20`,

  // Bâtiments
  batiment_count: `SELECT COUNT(*) as total FROM bdco.bdco_batiment`,
  batiment_by_genre: `SELECT genre, COUNT(*) as nombre, ROUND(SUM(surface_vd)::numeric, 2) as surface_m2
    FROM bdco.bdco_batiment GROUP BY genre ORDER BY nombre DESC`,
  batiment_surface_total: `SELECT ROUND(SUM(surface_vd)::numeric, 2) as surface_totale_m2 FROM bdco.bdco_batiment`,
  batiment_list: `SELECT numero as egid, genre, designation, surface_vd as surface_m2
    FROM bdco.bdco_batiment ORDER BY surface_vd DESC NULLS LAST LIMIT 20`,

  // Adresses
  adresse_count: `SELECT COUNT(*) as total FROM bdco.bdco_adresse_entree`,
  rue_list: `SELECT DISTINCT texte as nom_rue FROM bdco.bdco_adresse_rue_lin ORDER BY texte`,
  adresse_by_rue: `SELECT texte as rue, COUNT(*) as nombre_adresses
    FROM bdco.bdco_adresse_entree GROUP BY texte ORDER BY nombre_adresses DESC LIMIT 20`,

  // Assainissement
  collecteur_count: `SELECT COUNT(*) as total FROM assainissement.by_ass_collecteur`,
  collecteur_by_type: `SELECT fonction_hydro, COUNT(*) as nombre,
    ROUND(SUM(ST_Length(geom))::numeric, 0) as longueur_m
    FROM assainissement.by_ass_collecteur GROUP BY fonction_hydro ORDER BY longueur_m DESC`,
  collecteur_longueur_total: `SELECT ROUND(SUM(ST_Length(geom))::numeric, 0) as longueur_totale_m,
    ROUND(SUM(ST_Length(geom))::numeric / 1000, 2) as longueur_totale_km
    FROM assainissement.by_ass_collecteur`,
  chambre_count: `SELECT COUNT(*) as total FROM assainissement.by_ass_chambre`,
  chambre_by_fonction: `SELECT fonction_hydro, COUNT(*) as nombre
    FROM assainissement.by_ass_chambre GROUP BY fonction_hydro ORDER BY nombre DESC`,

  // Hydrants (SEL)
  hydrant_count: `SELECT COUNT(*) as total FROM externe.sel_hydrant`,

  // Routes
  route_count: `SELECT COUNT(*) as total FROM route.by_rte_troncon`,
  route_longueur: `SELECT ROUND(SUM(ST_Length(geom))::numeric, 0) as longueur_totale_m,
    ROUND(SUM(ST_Length(geom))::numeric / 1000, 2) as longueur_totale_km
    FROM route.by_rte_troncon`,

  // Vue générale
  stats_general: `
    SELECT 'Parcelles' as type, COUNT(*)::text as valeur FROM bdco.bdco_parcelle
    UNION ALL
    SELECT 'Bâtiments', COUNT(*)::text FROM bdco.bdco_batiment
    UNION ALL
    SELECT 'Adresses', COUNT(*)::text FROM bdco.bdco_adresse_entree
    UNION ALL
    SELECT 'Rues', COUNT(DISTINCT texte)::text FROM bdco.bdco_adresse_rue_lin
    UNION ALL
    SELECT 'Collecteurs (m)', ROUND(SUM(ST_Length(geom)))::text FROM assainissement.by_ass_collecteur
    UNION ALL
    SELECT 'Chambres de visite', COUNT(*)::text FROM assainissement.by_ass_chambre
  `
};

// ============================================
// DÉTECTION ET MATCHING
// ============================================

/**
 * Détecte si la question concerne des données
 */
function detectDataQuestion(message) {
  const lowerMsg = message.toLowerCase();

  // Vérifier si c'est une question sur les données
  const hasCountKeyword = DATA_KEYWORDS.count.some(kw => lowerMsg.includes(kw));
  const hasActionKeyword = DATA_KEYWORDS.actions.some(kw => lowerMsg.includes(kw));
  const hasAggregationKeyword = DATA_KEYWORDS.aggregations.some(kw => lowerMsg.includes(kw));

  // Détecter l'entité concernée
  let detectedEntity = null;
  for (const [entity, keywords] of Object.entries(DATA_KEYWORDS.entities)) {
    if (keywords.some(kw => lowerMsg.includes(kw))) {
      detectedEntity = entity;
      break;
    }
  }

  // Si on a une entité et une action/comptage
  if (detectedEntity && (hasCountKeyword || hasActionKeyword || hasAggregationKeyword)) {
    return {
      isDataQuestion: true,
      entity: detectedEntity,
      wantsCount: hasCountKeyword,
      wantsList: hasActionKeyword && !hasCountKeyword,
      wantsAggregation: hasAggregationKeyword
    };
  }

  // Questions générales sur les stats
  if (lowerMsg.includes('statistique') || lowerMsg.includes('résumé') ||
      lowerMsg.includes('overview') || lowerMsg.includes('vue d\'ensemble') ||
      (lowerMsg.includes('données') && lowerMsg.includes('bussigny'))) {
    return {
      isDataQuestion: true,
      entity: 'general',
      wantsCount: true
    };
  }

  return { isDataQuestion: false };
}

/**
 * Sélectionne la requête SQL appropriée
 */
function selectQuery(detection) {
  const { entity, wantsCount, wantsList, wantsAggregation } = detection;

  switch (entity) {
    case 'parcelle':
      if (wantsAggregation) return SQL_TEMPLATES.parcelle_surface_total;
      if (wantsList) return SQL_TEMPLATES.parcelle_list;
      if (wantsCount) return SQL_TEMPLATES.parcelle_by_genre;
      return SQL_TEMPLATES.parcelle_count;

    case 'batiment':
      if (wantsAggregation) return SQL_TEMPLATES.batiment_surface_total;
      if (wantsList) return SQL_TEMPLATES.batiment_list;
      if (wantsCount) return SQL_TEMPLATES.batiment_by_genre;
      return SQL_TEMPLATES.batiment_count;

    case 'adresse':
      if (wantsList) return SQL_TEMPLATES.rue_list;
      return SQL_TEMPLATES.adresse_count;

    case 'collecteur':
      if (wantsAggregation) return SQL_TEMPLATES.collecteur_longueur_total;
      if (wantsCount) return SQL_TEMPLATES.collecteur_by_type;
      return SQL_TEMPLATES.collecteur_count;

    case 'chambre':
      if (wantsCount) return SQL_TEMPLATES.chambre_by_fonction;
      return SQL_TEMPLATES.chambre_count;

    case 'hydrant':
      return SQL_TEMPLATES.hydrant_count;

    case 'route_troncon':
      if (wantsAggregation) return SQL_TEMPLATES.route_longueur;
      return SQL_TEMPLATES.route_count;

    case 'general':
    default:
      return SQL_TEMPLATES.stats_general;
  }
}

// ============================================
// EXÉCUTION
// ============================================

/**
 * Exécute une requête SQL
 */
async function executeQuery(query, connectionName = 'SRV-FME PostgreSQL') {
  try {
    const connList = connections.listConnections();
    console.log('[SQL Assistant] Available connections:', connList.map(c => `${c.name} (${c.status})`).join(', '));

    const conn = connList.find(c => c.name === connectionName);

    if (!conn) {
      console.log(`[SQL Assistant] ERROR: Connection "${connectionName}" not found`);
      return { success: false, error: `Connexion "${connectionName}" non trouvée` };
    }

    console.log(`[SQL Assistant] Using connection: ${conn.name} (${conn.id}), status: ${conn.status}`);

    if (conn.status !== 'connected') {
      console.log('[SQL Assistant] Connecting...');
      await connections.connect(conn.id);
      console.log('[SQL Assistant] Connected!');
    }

    console.log('[SQL Assistant] Executing query:', query.slice(0, 100) + '...');
    const result = await connections.executeSQL(conn.id, query);
    console.log(`[SQL Assistant] Query returned ${result.rowCount} rows`);

    return {
      success: true,
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields?.map(f => f.name) || [],
      query: query
    };
  } catch (error) {
    console.log('[SQL Assistant] ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Formate les résultats pour le LLM
 */
function formatResultsForLLM(results, detection) {
  if (!results.success) {
    return `Erreur lors de la requête: ${results.error}`;
  }

  const { rows, rowCount, fields } = results;

  if (rowCount === 0) {
    return "Aucun résultat trouvé.";
  }

  // Format tableau simple
  let output = `**Résultats de la requête** (${rowCount} ligne${rowCount > 1 ? 's' : ''}):\n\n`;

  // Headers
  output += '| ' + fields.join(' | ') + ' |\n';
  output += '| ' + fields.map(() => '---').join(' | ') + ' |\n';

  // Rows (max 25)
  const displayRows = rows.slice(0, 25);
  for (const row of displayRows) {
    const values = fields.map(f => {
      const val = row[f];
      if (val === null) return '-';
      if (typeof val === 'number') return val.toLocaleString('fr-CH');
      return String(val);
    });
    output += '| ' + values.join(' | ') + ' |\n';
  }

  if (rows.length > 25) {
    output += `\n... et ${rows.length - 25} autres lignes`;
  }

  output += `\n\n*Requête SQL exécutée:*\n\`\`\`sql\n${results.query}\n\`\`\``;

  return output;
}

// ============================================
// API PRINCIPALE
// ============================================

/**
 * Traite une question avec le mode SQL Assistant
 * Retourne les données à inclure dans le contexte du LLM
 */
export async function processSQLAssistant(message) {
  const detection = detectDataQuestion(message);

  if (!detection.isDataQuestion) {
    return {
      activated: false,
      context: null
    };
  }

  console.log('[SQL Assistant] Detected data question:', detection);

  const query = selectQuery(detection);
  console.log('[SQL Assistant] Selected query:', query);

  const results = await executeQuery(query);
  const formattedResults = formatResultsForLLM(results, detection);

  return {
    activated: true,
    entity: detection.entity,
    results: results,
    context: `
## DONNÉES DE LA BASE (Bussigny - SRV-FME PostgreSQL)

${formattedResults}

**INSTRUCTION IMPORTANTE:** Les données ci-dessus proviennent directement de la base de données PostgreSQL de Bussigny.
Utilise UNIQUEMENT ces données pour répondre à la question. Ne fais aucune supposition ou estimation.
Cite les chiffres exacts tels qu'ils apparaissent dans les résultats.
`
  };
}

/**
 * Génère un prompt enrichi avec les données SQL
 */
export function buildEnrichedPrompt(originalPrompt, sqlContext) {
  if (!sqlContext || !sqlContext.activated) {
    return originalPrompt;
  }

  return `${sqlContext.context}\n\n---\n\n**Question de l'utilisateur:** ${originalPrompt}`;
}

export { detectDataQuestion, selectQuery, executeQuery, formatResultsForLLM, SQL_TEMPLATES };
