/**
 * GeoMind - SQL Validator
 * Module de validation et sécurisation des requêtes SQL
 * Particulièrement important pour les requêtes générées par IA (text-to-SQL)
 */

// Patterns SQL dangereux à bloquer
const DANGEROUS_PATTERNS = [
  // DDL destructif
  { pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW|FUNCTION|TRIGGER)/i, message: 'DROP interdit', severity: 'critical' },
  { pattern: /\bTRUNCATE\s+/i, message: 'TRUNCATE interdit', severity: 'critical' },

  // DML sans conditions (potentiellement destructif)
  { pattern: /\bDELETE\s+FROM\s+\w+\s*(?:;|$)/i, message: 'DELETE sans WHERE interdit', severity: 'high' },
  { pattern: /\bUPDATE\s+\w+\s+SET\s+[^;]+(?:;|$)(?!.*WHERE)/i, message: 'UPDATE sans WHERE interdit', severity: 'high' },

  // Commandes admin/système
  { pattern: /\bALTER\s+(SYSTEM|DATABASE|ROLE|USER)/i, message: 'ALTER système interdit', severity: 'critical' },
  { pattern: /\bCREATE\s+(ROLE|USER|DATABASE)/i, message: 'Création utilisateur/DB interdite', severity: 'critical' },
  { pattern: /\bGRANT\s+/i, message: 'GRANT interdit', severity: 'critical' },
  { pattern: /\bREVOKE\s+/i, message: 'REVOKE interdit', severity: 'critical' },

  // Fonctions système dangereuses
  { pattern: /\bpg_read_file\s*\(/i, message: 'Lecture fichier système interdite', severity: 'critical' },
  { pattern: /\bpg_write_file\s*\(/i, message: 'Écriture fichier système interdite', severity: 'critical' },
  { pattern: /\blo_import\s*\(/i, message: 'Import large object interdit', severity: 'critical' },
  { pattern: /\blo_export\s*\(/i, message: 'Export large object interdit', severity: 'critical' },
  { pattern: /\bCOPY\s+.*\bFROM\s+PROGRAM/i, message: 'COPY FROM PROGRAM interdit', severity: 'critical' },
  { pattern: /\bCOPY\s+.*\bTO\s+PROGRAM/i, message: 'COPY TO PROGRAM interdit', severity: 'critical' },

  // Injection potentielle
  { pattern: /;\s*--/i, message: 'Pattern injection SQL détecté (;--)', severity: 'high' },
  { pattern: /'\s*OR\s+['"]?1['"]?\s*=\s*['"]?1/i, message: 'Pattern injection SQL détecté (OR 1=1)', severity: 'high' },
  { pattern: /UNION\s+ALL\s+SELECT\s+NULL/i, message: 'Pattern injection SQL détecté (UNION NULL)', severity: 'high' },

  // Extensions dangereuses
  { pattern: /\bCREATE\s+EXTENSION\s+/i, message: 'CREATE EXTENSION interdit', severity: 'high' },
  { pattern: /\bDBLINK\s*\(/i, message: 'dblink interdit', severity: 'critical' },
];

// Patterns autorisés en mode read-only
const READ_ONLY_PATTERNS = [
  /^\s*SELECT\s+/i,
  /^\s*WITH\s+.*SELECT\s+/is, // CTE avec SELECT
  /^\s*EXPLAIN\s+/i,
  /^\s*SHOW\s+/i,
];

// Patterns d'écriture (pour détecter les tentatives en mode read-only)
const WRITE_PATTERNS = [
  /\bINSERT\s+INTO\s+/i,
  /\bUPDATE\s+\w+\s+SET\s+/i,
  /\bDELETE\s+FROM\s+/i,
  /\bCREATE\s+(TABLE|VIEW|INDEX|FUNCTION|SCHEMA|TRIGGER|SEQUENCE)/i,
  /\bALTER\s+(TABLE|VIEW|INDEX|FUNCTION|SCHEMA|TRIGGER|SEQUENCE)/i,
  /\bDROP\s+/i,
];

/**
 * Résultat de validation
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - La requête est-elle valide
 * @property {string[]} errors - Liste des erreurs
 * @property {string[]} warnings - Liste des avertissements
 * @property {Object} analysis - Analyse de la requête
 */

/**
 * Valide une requête SQL
 * @param {string} query - La requête SQL à valider
 * @param {Object} options - Options de validation
 * @param {boolean} options.readOnly - Mode lecture seule (défaut: true pour IA)
 * @param {boolean} options.strict - Mode strict (bloque les warnings, défaut: false)
 * @param {string[]} options.allowedTables - Tables autorisées (si vide, toutes autorisées)
 * @param {number} options.maxRows - Limite LIMIT automatique
 * @returns {ValidationResult}
 */
function validateSQL(query, options = {}) {
  const {
    readOnly = true,
    strict = false,
    allowedTables = [],
    maxRows = 10000
  } = options;

  const result = {
    valid: true,
    errors: [],
    warnings: [],
    analysis: {
      type: detectQueryType(query),
      tables: extractTables(query),
      hasLimit: /\bLIMIT\s+\d+/i.test(query),
      estimatedComplexity: estimateComplexity(query)
    }
  };

  // Vérifier les patterns dangereux
  for (const { pattern, message, severity } of DANGEROUS_PATTERNS) {
    if (pattern.test(query)) {
      if (severity === 'critical' || severity === 'high') {
        result.errors.push(`🚫 ${message}`);
        result.valid = false;
      } else {
        result.warnings.push(`⚠️ ${message}`);
        if (strict) result.valid = false;
      }
    }
  }

  // En mode read-only, bloquer les écritures
  if (readOnly) {
    const isReadQuery = READ_ONLY_PATTERNS.some(p => p.test(query));
    const isWriteQuery = WRITE_PATTERNS.some(p => p.test(query));

    if (isWriteQuery || !isReadQuery) {
      result.errors.push(`🔒 Mode lecture seule: seules les requêtes SELECT sont autorisées`);
      result.valid = false;
    }
  }

  // Vérifier les tables autorisées
  if (allowedTables.length > 0) {
    const queryTables = result.analysis.tables;
    const unauthorized = queryTables.filter(t => !allowedTables.includes(t.toLowerCase()));
    if (unauthorized.length > 0) {
      result.errors.push(`🚫 Tables non autorisées: ${unauthorized.join(', ')}`);
      result.valid = false;
    }
  }

  // Avertissement si pas de LIMIT sur un SELECT
  if (result.analysis.type === 'SELECT' && !result.analysis.hasLimit) {
    result.warnings.push(`⚠️ Pas de LIMIT défini - ajout automatique de LIMIT ${maxRows}`);
    result.analysis.suggestedLimit = maxRows;
  }

  // Avertissement sur la complexité
  if (result.analysis.estimatedComplexity === 'high') {
    result.warnings.push('⚠️ Requête complexe détectée - temps d\'exécution potentiellement long');
  }

  return result;
}

/**
 * Détecte le type de requête
 */
function detectQueryType(query) {
  const normalized = query.trim().toUpperCase();
  if (normalized.startsWith('SELECT') || normalized.startsWith('WITH')) return 'SELECT';
  if (normalized.startsWith('INSERT')) return 'INSERT';
  if (normalized.startsWith('UPDATE')) return 'UPDATE';
  if (normalized.startsWith('DELETE')) return 'DELETE';
  if (normalized.startsWith('CREATE')) return 'CREATE';
  if (normalized.startsWith('ALTER')) return 'ALTER';
  if (normalized.startsWith('DROP')) return 'DROP';
  if (normalized.startsWith('EXPLAIN')) return 'EXPLAIN';
  return 'OTHER';
}

/**
 * Extrait les noms de tables d'une requête
 */
function extractTables(query) {
  const tables = new Set();

  // FROM table
  const fromMatches = query.matchAll(/\bFROM\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi);
  for (const match of fromMatches) {
    tables.add(match[1].toLowerCase());
  }

  // JOIN table
  const joinMatches = query.matchAll(/\bJOIN\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi);
  for (const match of joinMatches) {
    tables.add(match[1].toLowerCase());
  }

  // INSERT INTO table
  const insertMatches = query.matchAll(/\bINSERT\s+INTO\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi);
  for (const match of insertMatches) {
    tables.add(match[1].toLowerCase());
  }

  // UPDATE table
  const updateMatches = query.matchAll(/\bUPDATE\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi);
  for (const match of updateMatches) {
    tables.add(match[1].toLowerCase());
  }

  return Array.from(tables);
}

/**
 * Estime la complexité d'une requête
 */
function estimateComplexity(query) {
  let score = 0;

  // Nombre de JOINs
  const joinCount = (query.match(/\bJOIN\b/gi) || []).length;
  score += joinCount * 2;

  // Sous-requêtes
  const subqueryCount = (query.match(/\(\s*SELECT/gi) || []).length;
  score += subqueryCount * 3;

  // Fonctions d'agrégation
  const aggCount = (query.match(/\b(COUNT|SUM|AVG|MAX|MIN|GROUP BY)\b/gi) || []).length;
  score += aggCount;

  // Fonctions spatiales PostGIS (souvent coûteuses)
  const spatialCount = (query.match(/\bST_/gi) || []).length;
  score += spatialCount * 2;

  // DISTINCT
  if (/\bDISTINCT\b/i.test(query)) score += 2;

  // ORDER BY sans index probable
  if (/\bORDER BY\b/i.test(query)) score += 1;

  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

/**
 * Sanitize une requête en ajoutant les protections nécessaires
 * @param {string} query - Requête originale
 * @param {Object} options - Options
 * @returns {string} Requête sécurisée
 */
function sanitizeQuery(query, options = {}) {
  const { maxRows = 10000, timeout = 30000 } = options;
  let sanitized = query.trim();

  // Enlever les points-virgules multiples
  sanitized = sanitized.replace(/;+\s*$/, '');

  // Ajouter LIMIT si c'est un SELECT sans LIMIT
  if (/^\s*(SELECT|WITH)/i.test(sanitized) && !/\bLIMIT\s+\d+/i.test(sanitized)) {
    // Si ORDER BY existe, ajouter LIMIT après
    if (/\bORDER\s+BY\b/i.test(sanitized)) {
      sanitized = sanitized.replace(/(\bORDER\s+BY\s+[^)]+?)(\s*$)/i, `$1 LIMIT ${maxRows}$2`);
    } else {
      sanitized += ` LIMIT ${maxRows}`;
    }
  }

  return sanitized;
}

/**
 * Génère un résumé lisible de la validation
 */
function getValidationSummary(validation) {
  const lines = [];

  if (validation.valid) {
    lines.push('✅ Requête validée');
  } else {
    lines.push('❌ Requête refusée');
  }

  lines.push(`📋 Type: ${validation.analysis.type}`);

  if (validation.analysis.tables.length > 0) {
    lines.push(`📊 Tables: ${validation.analysis.tables.join(', ')}`);
  }

  lines.push(`⚡ Complexité: ${validation.analysis.estimatedComplexity}`);

  if (validation.errors.length > 0) {
    lines.push('\nErreurs:');
    validation.errors.forEach(e => lines.push(`  ${e}`));
  }

  if (validation.warnings.length > 0) {
    lines.push('\nAvertissements:');
    validation.warnings.forEach(w => lines.push(`  ${w}`));
  }

  return lines.join('\n');
}

export {
  validateSQL,
  sanitizeQuery,
  detectQueryType,
  extractTables,
  estimateComplexity,
  getValidationSummary,
  DANGEROUS_PATTERNS,
  READ_ONLY_PATTERNS
};
