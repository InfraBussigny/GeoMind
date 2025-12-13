/**
 * GeoMind - Connection Manager
 * Gestion des connexions aux serveurs internes (PostgreSQL, SSH, WMS/WFS)
 * Avec chiffrement des credentials
 *
 * v2.0 - Optimisé avec postgres.js (4.8x plus rapide) et validation SQL pour IA
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CryptoJS from 'crypto-js';
import pg from 'pg';
import postgres from 'postgres';
import { Client as SSHClient } from 'ssh2';
import { validateSQL, sanitizeQuery, getValidationSummary } from './sql-validator.js';

const { Client: PgClient } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Clé de chiffrement (en prod, utiliser une variable d'environnement)
const ENCRYPTION_KEY = process.env.GEOMIND_SECRET || 'geomind-bussigny-2024-secret-key';

// Fichier de stockage des connexions
const CONNECTIONS_FILE = path.join(__dirname, 'data', 'connections.json');

// Assurer que le dossier data existe
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Types de connexions supportés
const CONNECTION_TYPES = {
  postgresql: {
    name: 'PostgreSQL/PostGIS',
    icon: 'database',
    defaultPort: 5432,
    fields: ['host', 'port', 'database', 'username', 'password', 'ssl']
  },
  ssh: {
    name: 'SSH',
    icon: 'terminal',
    defaultPort: 22,
    fields: ['host', 'port', 'username', 'password', 'privateKey']
  },
  wms: {
    name: 'WMS',
    icon: 'map',
    defaultPort: 443,
    fields: ['url', 'username', 'password', 'version']
  },
  wfs: {
    name: 'WFS',
    icon: 'layers',
    defaultPort: 443,
    fields: ['url', 'username', 'password', 'version']
  }
};

// Cache des connexions actives
const activeConnections = new Map();

/**
 * Chiffre une valeur sensible
 */
function encrypt(text) {
  if (!text) return null;
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

/**
 * Déchiffre une valeur sensible
 */
function decrypt(ciphertext) {
  if (!ciphertext) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    // Vérifier que le déchiffrement a réussi (non vide)
    if (!decrypted) {
      console.warn('[Connections] Déchiffrement a retourné une chaîne vide - clé incorrecte ou données corrompues');
      return null;
    }
    return decrypted;
  } catch (error) {
    console.error('[Connections] Erreur déchiffrement:', error.message);
    return null; // Retourner null au lieu de planter
  }
}

/**
 * Charge les connexions depuis le fichier
 */
function loadConnections() {
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) {
      const data = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Erreur chargement connexions:', error);
  }
  return [];
}

/**
 * Sauvegarde les connexions dans le fichier
 */
function saveConnections(connections) {
  try {
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connections, null, 2));
    return true;
  } catch (error) {
    console.error('Erreur sauvegarde connexions:', error);
    return false;
  }
}

/**
 * Liste toutes les connexions (sans les credentials déchiffrés)
 */
function listConnections() {
  const connections = loadConnections();
  return connections.map(conn => ({
    id: conn.id,
    name: conn.name,
    type: conn.type,
    host: conn.host || conn.url,
    port: conn.port,
    database: conn.database,
    username: conn.username,
    lastUsed: conn.lastUsed,
    status: activeConnections.has(conn.id) ? 'connected' : 'disconnected'
  }));
}

/**
 * Récupère une connexion par ID (avec credentials déchiffrés)
 */
function getConnection(id) {
  const connections = loadConnections();
  const conn = connections.find(c => c.id === id);
  if (!conn) return null;

  // Déchiffrer les credentials
  return {
    ...conn,
    password: conn.password ? decrypt(conn.password) : null,
    privateKey: conn.privateKey ? decrypt(conn.privateKey) : null
  };
}

/**
 * Ajoute une nouvelle connexion
 */
function addConnection(config) {
  const connections = loadConnections();

  const newConnection = {
    id: `conn_${Date.now()}`,
    name: config.name,
    type: config.type,
    host: config.host,
    url: config.url,
    port: config.port || CONNECTION_TYPES[config.type]?.defaultPort,
    database: config.database,
    username: config.username,
    password: config.password ? encrypt(config.password) : null,
    privateKey: config.privateKey ? encrypt(config.privateKey) : null,
    ssl: config.ssl || false,
    version: config.version,
    createdAt: new Date().toISOString(),
    lastUsed: null
  };

  connections.push(newConnection);
  saveConnections(connections);

  return { id: newConnection.id, name: newConnection.name };
}

/**
 * Met à jour une connexion existante
 */
function updateConnection(id, config) {
  const connections = loadConnections();
  const index = connections.findIndex(c => c.id === id);

  if (index === -1) {
    throw new Error('Connexion non trouvée');
  }

  const updated = {
    ...connections[index],
    name: config.name ?? connections[index].name,
    host: config.host ?? connections[index].host,
    url: config.url ?? connections[index].url,
    port: config.port ?? connections[index].port,
    database: config.database ?? connections[index].database,
    username: config.username ?? connections[index].username,
    ssl: config.ssl ?? connections[index].ssl,
    version: config.version ?? connections[index].version,
    updatedAt: new Date().toISOString()
  };

  // Ne mettre à jour le password que s'il est fourni
  if (config.password) {
    updated.password = encrypt(config.password);
  }
  if (config.privateKey) {
    updated.privateKey = encrypt(config.privateKey);
  }

  connections[index] = updated;
  saveConnections(connections);

  return { id: updated.id, name: updated.name };
}

/**
 * Supprime une connexion
 */
function deleteConnection(id) {
  // D'abord déconnecter si active
  if (activeConnections.has(id)) {
    disconnect(id);
  }

  const connections = loadConnections();
  const filtered = connections.filter(c => c.id !== id);

  if (filtered.length === connections.length) {
    throw new Error('Connexion non trouvée');
  }

  saveConnections(filtered);
  return true;
}

/**
 * Teste une connexion sans la sauvegarder
 */
async function testConnection(config) {
  const type = config.type;

  switch (type) {
    case 'postgresql':
      return await testPostgreSQL(config);
    case 'ssh':
      return await testSSH(config);
    case 'wms':
    case 'wfs':
      return await testOGC(config);
    default:
      throw new Error(`Type de connexion non supporté: ${type}`);
  }
}

/**
 * Test connexion PostgreSQL
 */
async function testPostgreSQL(config) {
  const client = new PgClient({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    const result = await client.query('SELECT version(), PostGIS_Version() as postgis');
    await client.end();

    return {
      success: true,
      message: 'Connexion réussie',
      info: {
        version: result.rows[0].version.split(',')[0],
        postgis: result.rows[0].postgis
      }
    };
  } catch (error) {
    // Si PostGIS n'est pas installé, on essaie sans
    if (error.message.includes('PostGIS_Version')) {
      try {
        const client2 = new PgClient({
          host: config.host,
          port: config.port || 5432,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: config.ssl ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 5000
        });
        await client2.connect();
        const result = await client2.query('SELECT version()');
        await client2.end();

        return {
          success: true,
          message: 'Connexion réussie (PostGIS non installé)',
          info: {
            version: result.rows[0].version.split(',')[0],
            postgis: null
          }
        };
      } catch (e) {
        throw e;
      }
    }
    throw error;
  }
}

/**
 * Test connexion SSH
 */
async function testSSH(config) {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('Timeout de connexion'));
    }, 10000);

    conn.on('ready', () => {
      clearTimeout(timeout);
      conn.exec('uname -a', (err, stream) => {
        if (err) {
          conn.end();
          resolve({ success: true, message: 'Connexion SSH réussie', info: {} });
          return;
        }

        let output = '';
        stream.on('data', (data) => { output += data; });
        stream.on('close', () => {
          conn.end();
          resolve({
            success: true,
            message: 'Connexion SSH réussie',
            info: { system: output.trim() }
          });
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    const connConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: 10000
    };

    if (config.privateKey) {
      connConfig.privateKey = config.privateKey;
    } else if (config.password) {
      connConfig.password = config.password;
    }

    conn.connect(connConfig);
  });
}

/**
 * Test connexion WMS/WFS
 */
async function testOGC(config) {
  const url = new URL(config.url);
  url.searchParams.set('SERVICE', config.type.toUpperCase());
  url.searchParams.set('REQUEST', 'GetCapabilities');
  if (config.version) {
    url.searchParams.set('VERSION', config.version);
  }

  const headers = {};
  if (config.username && config.password) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
  }

  try {
    const response = await fetch(url.toString(), { headers, timeout: 10000 });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();

    // Vérifier que c'est bien du XML OGC
    if (text.includes('WMS_Capabilities') || text.includes('WMT_MS_Capabilities')) {
      return {
        success: true,
        message: 'Service WMS accessible',
        info: { type: 'WMS' }
      };
    } else if (text.includes('WFS_Capabilities')) {
      return {
        success: true,
        message: 'Service WFS accessible',
        info: { type: 'WFS' }
      };
    } else if (text.includes('ServiceException') || text.includes('ExceptionReport')) {
      throw new Error('Le service a retourné une erreur');
    } else {
      return {
        success: true,
        message: 'Service accessible (format non standard)',
        info: {}
      };
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Se connecte à un serveur et garde la connexion active
 */
async function connect(id) {
  const config = getConnection(id);
  if (!config) {
    throw new Error('Connexion non trouvée');
  }

  // Si déjà connecté, retourner le statut
  if (activeConnections.has(id)) {
    return { success: true, message: 'Déjà connecté' };
  }

  const type = config.type;

  // Vérifier que le mot de passe existe pour les types qui en ont besoin
  if ((type === 'postgresql' || type === 'ssh') && !config.password && !config.privateKey) {
    throw new Error('Mot de passe invalide ou corrompu. Veuillez modifier la connexion et ressaisir le mot de passe.');
  }

  switch (type) {
    case 'postgresql':
      return await connectPostgreSQL(id, config);
    case 'ssh':
      return await connectSSH(id, config);
    case 'wms':
    case 'wfs':
      // WMS/WFS sont stateless, on marque juste comme "connecté"
      activeConnections.set(id, { type, config });
      updateLastUsed(id);
      return { success: true, message: 'Service OGC prêt' };
    default:
      throw new Error(`Type de connexion non supporté: ${type}`);
  }
}

/**
 * Connexion PostgreSQL persistante
 * Utilise postgres.js pour les performances (4.8x plus rapide que pg)
 * Garde aussi une connexion pg pour la compatibilité si besoin
 */
async function connectPostgreSQL(id, config) {
  // Connexion postgres.js (principale - optimisée)
  const sql = postgres({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    username: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 10, // Pool de connexions
    idle_timeout: 20,
    connect_timeout: 10,
    // Protection contre les requêtes trop longues
    statement_timeout: 60000, // 60 secondes max par requête
    // Transformations automatiques
    transform: {
      undefined: null
    }
  });

  // Connexion pg legacy (pour compatibilité avec certaines opérations)
  const pgClient = new PgClient({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false
  });

  // Gestion des erreurs de connexion pour éviter les crashes
  pgClient.on('error', (err) => {
    console.error(`[PostgreSQL] Erreur connexion ${id}:`, err.message);
    activeConnections.delete(id);
  });

  // Test de la connexion postgres.js
  try {
    await sql`SELECT 1 as test`;
    console.log(`[PostgreSQL] Connexion postgres.js établie pour ${id}`);
  } catch (err) {
    console.error(`[PostgreSQL] Erreur postgres.js ${id}:`, err.message);
    throw err;
  }

  // Connexion pg legacy
  await pgClient.connect();

  activeConnections.set(id, {
    type: 'postgresql',
    sql,           // postgres.js (rapide)
    client: pgClient, // pg legacy (compatibilité)
    config
  });
  updateLastUsed(id);

  return { success: true, message: 'Connecté à PostgreSQL (postgres.js optimisé)' };
}

/**
 * Connexion SSH persistante
 */
async function connectSSH(id, config) {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();

    conn.on('ready', () => {
      activeConnections.set(id, { type: 'ssh', client: conn, config });
      updateLastUsed(id);
      resolve({ success: true, message: 'Connecté en SSH' });
    });

    conn.on('error', (err) => {
      reject(err);
    });

    conn.on('close', () => {
      activeConnections.delete(id);
    });

    const connConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username
    };

    if (config.privateKey) {
      connConfig.privateKey = config.privateKey;
    } else if (config.password) {
      connConfig.password = config.password;
    }

    conn.connect(connConfig);
  });
}

/**
 * Déconnexion
 */
async function disconnect(id) {
  const active = activeConnections.get(id);
  if (!active) {
    return { success: true, message: 'Non connecté' };
  }

  try {
    if (active.type === 'postgresql') {
      // Fermer postgres.js
      if (active.sql) {
        await active.sql.end();
      }
      // Fermer pg legacy
      if (active.client) {
        active.client.end();
      }
    } else if (active.type === 'ssh' && active.client) {
      active.client.end();
    }
  } catch (error) {
    console.error('Erreur déconnexion:', error);
  }

  activeConnections.delete(id);
  return { success: true, message: 'Déconnecté' };
}

/**
 * Met à jour la date de dernière utilisation
 */
function updateLastUsed(id) {
  const connections = loadConnections();
  const index = connections.findIndex(c => c.id === id);
  if (index !== -1) {
    connections[index].lastUsed = new Date().toISOString();
    saveConnections(connections);
  }
}

/**
 * Exécute une requête SQL sur une connexion PostgreSQL
 * Utilise postgres.js pour les performances optimales
 */
async function executeSQL(id, query) {
  const active = activeConnections.get(id);

  if (!active || active.type !== 'postgresql') {
    throw new Error('Connexion PostgreSQL non active');
  }

  const startTime = Date.now();

  // Utiliser postgres.js si disponible (plus rapide)
  if (active.sql) {
    try {
      const result = await active.sql.unsafe(query);
      const duration = Date.now() - startTime;

      return {
        success: true,
        rowCount: result.length,
        rows: result,
        fields: result.columns?.map(c => ({ name: c.name, type: c.type })) || [],
        duration,
        driver: 'postgres.js'
      };
    } catch (err) {
      // Fallback sur pg en cas d'erreur
      console.warn('[PostgreSQL] Fallback sur pg:', err.message);
    }
  }

  // Fallback pg legacy
  const result = await active.client.query(query);
  const duration = Date.now() - startTime;

  return {
    success: true,
    rowCount: result.rowCount,
    rows: result.rows,
    fields: result.fields?.map(f => ({ name: f.name, type: f.dataTypeID })),
    duration,
    driver: 'pg'
  };
}

/**
 * Exécute une requête SQL générée par IA avec validation et protections
 * @param {string} id - ID de la connexion
 * @param {string} query - Requête SQL (potentiellement générée par IA)
 * @param {Object} options - Options de sécurité
 * @param {boolean} options.readOnly - Mode lecture seule (défaut: true)
 * @param {string[]} options.allowedTables - Tables autorisées
 * @param {number} options.maxRows - Limite de lignes (défaut: 1000)
 * @param {number} options.timeout - Timeout en ms (défaut: 30000)
 */
async function executeAISQL(id, query, options = {}) {
  const {
    readOnly = true,
    allowedTables = [],
    maxRows = 1000,
    timeout = 30000
  } = options;

  const active = activeConnections.get(id);

  if (!active || active.type !== 'postgresql') {
    throw new Error('Connexion PostgreSQL non active');
  }

  // Validation de la requête
  const validation = validateSQL(query, { readOnly, allowedTables, maxRows });

  if (!validation.valid) {
    return {
      success: false,
      error: 'Requête refusée par le validateur SQL',
      validation: {
        errors: validation.errors,
        warnings: validation.warnings,
        summary: getValidationSummary(validation)
      }
    };
  }

  // Sanitize la requête (ajoute LIMIT si manquant, etc.)
  const sanitizedQuery = sanitizeQuery(query, { maxRows, timeout });

  const startTime = Date.now();

  try {
    // Utiliser postgres.js avec timeout
    if (active.sql) {
      const result = await Promise.race([
        active.sql.unsafe(sanitizedQuery),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout: requête > ${timeout}ms`)), timeout)
        )
      ]);

      const duration = Date.now() - startTime;

      return {
        success: true,
        rowCount: result.length,
        rows: result,
        fields: result.columns?.map(c => ({ name: c.name, type: c.type })) || [],
        duration,
        driver: 'postgres.js',
        validation: {
          warnings: validation.warnings,
          analysis: validation.analysis
        },
        sanitized: sanitizedQuery !== query
      };
    }

    // Fallback pg
    const result = await active.client.query(sanitizedQuery);
    const duration = Date.now() - startTime;

    return {
      success: true,
      rowCount: result.rowCount,
      rows: result.rows,
      fields: result.fields?.map(f => ({ name: f.name, type: f.dataTypeID })),
      duration,
      driver: 'pg',
      validation: {
        warnings: validation.warnings,
        analysis: validation.analysis
      },
      sanitized: sanitizedQuery !== query
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
      validation: {
        warnings: validation.warnings,
        analysis: validation.analysis
      }
    };
  }
}

/**
 * Liste les tables disponibles dans la base de données
 */
async function listTables(id) {
  const active = activeConnections.get(id);

  if (!active || active.type !== 'postgresql') {
    throw new Error('Connexion PostgreSQL non active');
  }

  const query = `
    SELECT
      schemaname as schema,
      tablename as table,
      COALESCE(
        (SELECT reltuples::bigint FROM pg_class WHERE oid = (schemaname || '.' || tablename)::regclass),
        0
      ) as estimated_rows
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname, tablename
  `;

  if (active.sql) {
    const result = await active.sql.unsafe(query);
    return result;
  }

  const result = await active.client.query(query);
  return result.rows;
}

/**
 * Obtient le schéma d'une table
 */
async function getTableSchema(id, tableName) {
  const active = activeConnections.get(id);

  if (!active || active.type !== 'postgresql') {
    throw new Error('Connexion PostgreSQL non active');
  }

  // Parse schema.table si présent
  let schema = 'public';
  let table = tableName;
  if (tableName.includes('.')) {
    [schema, table] = tableName.split('.');
  }

  const query = `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = '${schema}' AND table_name = '${table}'
    ORDER BY ordinal_position
  `;

  if (active.sql) {
    const result = await active.sql.unsafe(query);
    return result;
  }

  const result = await active.client.query(query);
  return result.rows;
}

/**
 * Exécute une commande SSH
 */
async function executeSSH(id, command) {
  const active = activeConnections.get(id);

  if (!active || active.type !== 'ssh') {
    throw new Error('Connexion SSH non active');
  }

  return new Promise((resolve, reject) => {
    active.client.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = '';
      let stderr = '';

      stream.on('data', (data) => { stdout += data; });
      stream.stderr.on('data', (data) => { stderr += data; });

      stream.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code
        });
      });
    });
  });
}

/**
 * Récupère les capabilities d'un service WMS/WFS
 */
async function getOGCCapabilities(id) {
  const active = activeConnections.get(id);

  if (!active || (active.type !== 'wms' && active.type !== 'wfs')) {
    throw new Error('Connexion OGC non active');
  }

  const config = active.config;
  const url = new URL(config.url);
  url.searchParams.set('SERVICE', config.type.toUpperCase());
  url.searchParams.set('REQUEST', 'GetCapabilities');
  if (config.version) {
    url.searchParams.set('VERSION', config.version);
  }

  const headers = {};
  if (config.username && config.password) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
  }

  const response = await fetch(url.toString(), { headers });
  const text = await response.text();

  return { success: true, capabilities: text };
}

// Export des fonctions (ES modules)
export {
  CONNECTION_TYPES,
  listConnections,
  getConnection,
  addConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  connect,
  disconnect,
  executeSQL,
  executeAISQL,    // Nouvelle fonction pour requêtes IA avec validation
  listTables,      // Liste les tables de la DB
  getTableSchema,  // Obtient le schéma d'une table
  executeSSH,
  getOGCCapabilities
};
