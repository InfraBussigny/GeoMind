/**
 * GeoBrain - Connection Manager
 * Gestion des connexions aux serveurs internes (PostgreSQL, SSH, WMS/WFS)
 * Avec chiffrement des credentials
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CryptoJS from 'crypto-js';
import pg from 'pg';
import { Client as SSHClient } from 'ssh2';

const { Client: PgClient } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Clé de chiffrement (en prod, utiliser une variable d'environnement)
const ENCRYPTION_KEY = process.env.GEOBRAIN_SECRET || 'geobrain-bussigny-2024-secret-key';

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
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
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
 */
async function connectPostgreSQL(id, config) {
  const client = new PgClient({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false
  });

  // Gestion des erreurs de connexion pour éviter les crashes
  client.on('error', (err) => {
    console.error(`[PostgreSQL] Erreur connexion ${id}:`, err.message);
    // Nettoyer la connexion de la map
    activeConnections.delete(id);
  });

  await client.connect();
  activeConnections.set(id, { type: 'postgresql', client, config });
  updateLastUsed(id);

  return { success: true, message: 'Connecté à PostgreSQL' };
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
function disconnect(id) {
  const active = activeConnections.get(id);
  if (!active) {
    return { success: true, message: 'Non connecté' };
  }

  try {
    if (active.type === 'postgresql' && active.client) {
      active.client.end();
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
 */
async function executeSQL(id, query) {
  const active = activeConnections.get(id);

  if (!active || active.type !== 'postgresql') {
    throw new Error('Connexion PostgreSQL non active');
  }

  const startTime = Date.now();
  const result = await active.client.query(query);
  const duration = Date.now() - startTime;

  return {
    success: true,
    rowCount: result.rowCount,
    rows: result.rows,
    fields: result.fields?.map(f => ({ name: f.name, type: f.dataTypeID })),
    duration
  };
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
  executeSSH,
  getOGCCapabilities
};
