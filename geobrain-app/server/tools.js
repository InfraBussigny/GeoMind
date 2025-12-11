/**
 * GeoBrain Tools - Outils disponibles pour l'Assistant IA
 * Définitions des outils au format Claude API et fonctions d'exécution
 */

import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as connections from './connections.js';

const execAsync = promisify(exec);

// ============================================
// DÉFINITIONS DES OUTILS (format Claude API)
// ============================================

export const TOOL_DEFINITIONS = [
  {
    name: 'read_file',
    description: 'Lire le contenu d\'un fichier sur le disque local. Utilisez cet outil pour consulter le contenu de fichiers existants.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Chemin absolu ou relatif vers le fichier à lire'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Écrire du contenu dans un fichier. Crée le fichier s\'il n\'existe pas, ou remplace son contenu.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Chemin vers le fichier à créer ou modifier'
        },
        content: {
          type: 'string',
          description: 'Contenu à écrire dans le fichier'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_directory',
    description: 'Lister le contenu d\'un répertoire (fichiers et sous-dossiers).',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Chemin vers le répertoire à lister'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'execute_command',
    description: 'Exécuter une commande shell (bash/cmd). Utilisez pour git, npm, python, et autres outils en ligne de commande.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Commande à exécuter'
        },
        cwd: {
          type: 'string',
          description: 'Répertoire de travail (optionnel)'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'web_search',
    description: 'Rechercher des informations sur le web. Retourne des résultats de recherche avec titres, URLs et extraits.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Requête de recherche'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'web_fetch',
    description: 'Récupérer et lire le contenu d\'une page web. Retourne le texte principal de la page.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL de la page à récupérer'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'create_directory',
    description: 'Créer un nouveau répertoire (et ses parents si nécessaire).',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Chemin du répertoire à créer'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'sql_query',
    description: 'Exécuter une requête SQL sur une base de données PostgreSQL/PostGIS configurée. Connexions disponibles: SRV-FME PostgreSQL (base Prod avec schémas: assainissement, bdco, divers, externe, nature, pts_interet, route). Utilisez cet outil pour interroger les données cadastrales, parcelles, bâtiments, réseaux.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Requête SQL à exécuter (SELECT uniquement recommandé)'
        },
        connection_name: {
          type: 'string',
          description: 'Nom de la connexion à utiliser (défaut: "SRV-FME PostgreSQL"). Connexions disponibles: "SRV-FME PostgreSQL" (base Prod), "SRV-FME Test" (base Test)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'list_db_connections',
    description: 'Lister les connexions de bases de données configurées et leur statut (connecté/déconnecté).',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'list_db_tables',
    description: 'Lister les tables disponibles dans une base de données, avec leur schéma et taille.',
    input_schema: {
      type: 'object',
      properties: {
        connection_name: {
          type: 'string',
          description: 'Nom de la connexion (défaut: "SRV-FME PostgreSQL")'
        },
        schema: {
          type: 'string',
          description: 'Filtrer par schéma (optionnel, ex: "bdco", "assainissement")'
        }
      },
      required: []
    }
  }
];

// ============================================
// FONCTIONS D'EXÉCUTION DES OUTILS
// ============================================

async function executeReadFile(input) {
  const { path } = input;
  try {
    const content = await readFile(path, 'utf-8');
    return {
      success: true,
      content: content.length > 50000
        ? content.slice(0, 50000) + '\n\n[... fichier tronqué, trop long ...]'
        : content
    };
  } catch (error) {
    return { success: false, error: `Erreur de lecture: ${error.message}` };
  }
}

async function executeWriteFile(input) {
  const { path, content } = input;
  try {
    // Créer le répertoire parent si nécessaire
    const dir = dirname(path);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(path, content, 'utf-8');
    return { success: true, message: `Fichier écrit: ${path}` };
  } catch (error) {
    return { success: false, error: `Erreur d'écriture: ${error.message}` };
  }
}

async function executeListDirectory(input) {
  const { path } = input;
  try {
    const entries = await readdir(path);
    const results = [];

    for (const entry of entries.slice(0, 100)) { // Limiter à 100 entrées
      try {
        const fullPath = join(path, entry);
        const stats = await stat(fullPath);
        results.push({
          name: entry,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          size: stats.size
        });
      } catch (e) {
        results.push({ name: entry, error: 'Impossible de lire les stats' });
      }
    }

    return { success: true, entries: results, total: entries.length };
  } catch (error) {
    return { success: false, error: `Erreur de listage: ${error.message}` };
  }
}

async function executeCommand(input) {
  const { command, cwd } = input;

  // Liste de commandes dangereuses à bloquer
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, // rm -rf /
    /format\s+c:/i,  // format c:
    /del\s+\/s\s+\/q\s+c:/i, // del /s /q c:
    /shutdown/i,
    /taskkill.*\/f.*node/i // Ne pas tuer node
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { success: false, error: 'Commande potentiellement dangereuse bloquée' };
    }
  }

  try {
    const options = {
      timeout: 30000, // 30 secondes max
      maxBuffer: 1024 * 1024 * 5 // 5MB
    };
    if (cwd) options.cwd = cwd;

    const { stdout, stderr } = await execAsync(command, options);
    return {
      success: true,
      stdout: stdout.slice(0, 20000),
      stderr: stderr.slice(0, 5000)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stdout: error.stdout?.slice(0, 10000) || '',
      stderr: error.stderr?.slice(0, 5000) || ''
    };
  }
}

async function executeWebSearch(input) {
  const { query } = input;
  try {
    // Utiliser DuckDuckGo HTML (pas d'API key nécessaire)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Parser les résultats (format simplifié)
    const results = [];
    const resultRegex = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]*)</g;
    let match;

    while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
      results.push({
        url: match[1],
        title: match[2].trim(),
        snippet: match[3].trim()
      });
    }

    // Fallback si pas de résultats parsés
    if (results.length === 0) {
      return {
        success: true,
        message: `Recherche effectuée pour: "${query}"`,
        results: [{ note: 'Résultats disponibles mais parsing limité. Utilisez web_fetch pour consulter des URLs spécifiques.' }]
      };
    }

    return { success: true, query, results };
  } catch (error) {
    return { success: false, error: `Erreur de recherche: ${error.message}` };
  }
}

async function executeWebFetch(input) {
  const { url } = input;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const json = await response.json();
      return { success: true, url, contentType: 'json', content: JSON.stringify(json, null, 2).slice(0, 30000) };
    }

    const html = await response.text();

    // Extraire le texte principal (version simple)
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limiter la taille
    if (text.length > 30000) {
      text = text.slice(0, 30000) + '\n\n[... contenu tronqué ...]';
    }

    return { success: true, url, contentType: 'html', content: text };
  } catch (error) {
    return { success: false, error: `Erreur de fetch: ${error.message}` };
  }
}

async function executeCreateDirectory(input) {
  const { path } = input;
  try {
    await mkdir(path, { recursive: true });
    return { success: true, message: `Répertoire créé: ${path}` };
  } catch (error) {
    return { success: false, error: `Erreur de création: ${error.message}` };
  }
}

// ============================================
// OUTILS BASE DE DONNÉES
// ============================================

async function executeSqlQuery(input) {
  const { query, connection_name = 'SRV-FME PostgreSQL' } = input;

  try {
    // Trouver la connexion par nom
    const connList = connections.listConnections();
    const conn = connList.find(c => c.name === connection_name);

    if (!conn) {
      return {
        success: false,
        error: `Connexion "${connection_name}" non trouvée. Connexions disponibles: ${connList.map(c => c.name).join(', ')}`
      };
    }

    // Se connecter si pas déjà connecté
    if (conn.status !== 'connected') {
      try {
        await connections.connect(conn.id);
      } catch (e) {
        return { success: false, error: `Impossible de se connecter: ${e.message}` };
      }
    }

    // Exécuter la requête
    const result = await connections.executeSQL(conn.id, query);

    // Limiter le nombre de lignes retournées
    const maxRows = 100;
    const truncated = result.rows.length > maxRows;
    const rows = truncated ? result.rows.slice(0, maxRows) : result.rows;

    return {
      success: true,
      rowCount: result.rowCount,
      rows,
      fields: result.fields?.map(f => f.name) || [],
      duration: result.duration,
      truncated,
      message: truncated ? `Résultats tronqués à ${maxRows} lignes (${result.rowCount} total)` : undefined
    };
  } catch (error) {
    return { success: false, error: `Erreur SQL: ${error.message}` };
  }
}

async function executeListDbConnections(input) {
  try {
    const connList = connections.listConnections();
    return {
      success: true,
      connections: connList.map(c => ({
        name: c.name,
        type: c.type,
        host: c.host,
        database: c.database,
        status: c.status,
        lastUsed: c.lastUsed
      }))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeListDbTables(input) {
  const { connection_name = 'SRV-FME PostgreSQL', schema } = input;

  try {
    // Trouver la connexion
    const connList = connections.listConnections();
    const conn = connList.find(c => c.name === connection_name);

    if (!conn) {
      return { success: false, error: `Connexion "${connection_name}" non trouvée` };
    }

    // Se connecter si nécessaire
    if (conn.status !== 'connected') {
      await connections.connect(conn.id);
    }

    // Requête pour lister les tables
    let query = `
      SELECT
        table_schema as schema,
        table_name as table,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_schema) || '.' || quote_ident(table_name))) as size
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'tiger', 'tiger_data', 'topology')
        AND table_type = 'BASE TABLE'
    `;

    if (schema) {
      query += ` AND table_schema = '${schema.replace(/'/g, "''")}'`;
    }

    query += ' ORDER BY table_schema, table_name';

    const result = await connections.executeSQL(conn.id, query);

    return {
      success: true,
      tables: result.rows,
      total: result.rowCount
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// DISPATCHER D'OUTILS
// ============================================

export async function executeTool(toolName, toolInput) {
  console.log(`[Tools] Executing: ${toolName}`, toolInput);

  switch (toolName) {
    case 'read_file':
      return executeReadFile(toolInput);
    case 'write_file':
      return executeWriteFile(toolInput);
    case 'list_directory':
      return executeListDirectory(toolInput);
    case 'execute_command':
      return executeCommand(toolInput);
    case 'web_search':
      return executeWebSearch(toolInput);
    case 'web_fetch':
      return executeWebFetch(toolInput);
    case 'create_directory':
      return executeCreateDirectory(toolInput);
    case 'sql_query':
      return executeSqlQuery(toolInput);
    case 'list_db_connections':
      return executeListDbConnections(toolInput);
    case 'list_db_tables':
      return executeListDbTables(toolInput);
    default:
      return { success: false, error: `Outil inconnu: ${toolName}` };
  }
}

// ============================================
// SYSTEM PROMPT POUR L'AGENT
// ============================================

export const AGENT_SYSTEM_PROMPT = `Tu es GeoBrain, l'assistant IA de Marc, responsable SIT à la commune de Bussigny.

## OUTILS DISPONIBLES

**Fichiers:**
- read_file: Lire des fichiers locaux
- write_file: Créer ou modifier des fichiers
- list_directory: Lister le contenu d'un dossier
- create_directory: Créer des dossiers

**Base de données PostgreSQL/PostGIS:**
- sql_query: Exécuter une requête SQL (connection_name="SRV-FME PostgreSQL" par défaut)
- list_db_connections: Voir les connexions disponibles
- list_db_tables: Lister les tables d'un schéma

**Autres:**
- execute_command: Commandes shell (git, npm, python)
- web_search / web_fetch: Recherches web

## BASE DE DONNÉES BUSSIGNY (Prod sur srv-fme:5432)
SRID: 2056 (MN95 / Swiss CH1903+ LV95)

### SCHÉMA BDCO - Cadastre communal (source: RF Vaud)
| Table | Description | Géométrie | Colonnes clés |
|-------|-------------|-----------|---------------|
| bdco_parcelle | Parcelles cadastrales | POLYGON | numero, identdn (VD0157-XXXX), genre, surface_vd (m²) |
| bdco_batiment | Bâtiments hors-sol | POLYGON | numero (EGID), genre, designation, surface_vd (m²) |
| bdco_batiment_souterrain | Constructions souterraines | POLYGON | numero, surface_vd |
| bdco_adresse_entree | Adresses (points d'entrée) | POINT | numero_maison, texte (nom rue), designation |
| bdco_adresse_rue_lin | Axes de rues | LINESTRING | texte, genre |
| bdco_ddp | Droits distincts permanents | POLYGON | numero, designation |
| bdco_cs_dur | Surfaces dures (routes, parkings) | POLYGON | genre, surface |
| bdco_cs_vert | Surfaces vertes | POLYGON | genre, surface |
| bdco_point_limite | Points limites (bornes) | POINT | - |

### SCHÉMA ASSAINISSEMENT - Réseau eaux usées/pluviales (PGEE)
| Table | Description | Géométrie | Colonnes clés |
|-------|-------------|-----------|---------------|
| by_ass_chambre | Chambres de visite | POINT | designation, fonction_hydro (EP/EU/UN), etat, profondeur, proprietaire |
| by_ass_collecteur | Conduites | LINESTRING | materiau, fonction_hydro, largeur_profil (mm), etat |
| by_ass_couvercle | Couvercles | POINT | forme_couvercle, diametre, cote |

### SCHÉMA ROUTE - Réseau routier
| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| by_rte_troncon | Tronçons de route | nom_rue, classe_rte, type_revetement, vitesse |
| by_rte_arret_tp | Arrêts transports publics | - |
| by_rte_zone_stationnement | Zones parking | - |

### SCHÉMA EXTERNE - Données fournisseurs (SEL)
| Table | Description |
|-------|-------------|
| sel_conduite | Conduites eau potable |
| sel_hydrant | Bornes hydrantes |
| sel_vanne | Vannes réseau eau |

## REQUÊTES TYPES
\`\`\`sql
-- Compter parcelles
SELECT COUNT(*) FROM bdco.bdco_parcelle

-- Parcelles par genre avec surface
SELECT genre, COUNT(*) as nb, SUM(surface_vd) as surface_m2
FROM bdco.bdco_parcelle GROUP BY genre ORDER BY nb DESC

-- Bâtiments
SELECT COUNT(*), SUM(surface_vd) FROM bdco.bdco_batiment

-- Longueur collecteurs par type
SELECT fonction_hydro, SUM(ST_Length(geom))::int as metres
FROM assainissement.by_ass_collecteur GROUP BY fonction_hydro

-- Rues de Bussigny
SELECT DISTINCT texte FROM bdco.bdco_adresse_rue_lin ORDER BY texte
\`\`\`

## RÈGLES DE FIABILITÉ (CRITIQUES)

### 1. JAMAIS D'INVENTION DE DONNÉES
- Ne JAMAIS inventer, estimer ou deviner des chiffres
- Si une requête échoue → dire "Je n'ai pas pu obtenir cette information"
- Si le résultat est NULL ou vide → le dire clairement
- Ne JAMAIS arrondir sans le préciser explicitement

### 2. TOUJOURS VÉRIFIER AVANT DE RÉPONDRE
- Vérifie que la table existe avant d'y accéder
- Vérifie que les colonnes utilisées existent (cf. schéma ci-dessus)
- Si doute sur une colonne → utiliser list_db_tables d'abord
- Préfère les requêtes simples et directes aux requêtes complexes

### 3. CLARIFIER LES AMBIGUÏTÉS
- "Parcelles" = bdco.bdco_parcelle (cadastre officiel)
- "Bâtiments" = bdco.bdco_batiment (hors-sol uniquement)
- "Surface" = préciser si surface_vd (officielle VD) ou surface_calcul (géométrique)
- Si la demande est ambiguë → poser une question de clarification

### 4. FORMAT DES RÉPONSES
- Toujours citer la source: "Selon la table bdco.bdco_parcelle..."
- Donner le nombre exact retourné par la requête
- Pour les surfaces: préciser l'unité (m², ha, km²)
- Pour les longueurs: préciser l'unité (m, km)
- Afficher la requête SQL utilisée pour transparence

### 5. GESTION DES ERREURS
- Si erreur SQL → NE PAS inventer de réponse, dire qu'il y a eu une erreur
- Si connexion échoue → suggérer de vérifier la connexion dans Paramètres
- Si table inexistante → proposer list_db_tables pour explorer

### 6. LIMITES À RESPECTER
- Les données BDCO sont celles de Bussigny uniquement (VD0157)
- Les données peuvent avoir un décalage avec la réalité (mise à jour périodique)
- Ne pas extrapoler au-delà des données disponibles

## RÈGLES TECHNIQUES
1. Utilise sql_query DIRECTEMENT - tu as accès à la base, ne demande PAS les credentials
2. Pour Bussigny: identdn LIKE 'VD0157%' ou numero_commune = 5157
3. Préfère les chemins Windows absolus: C:\\Users\\...
4. Évite les commandes destructives avec execute_command
5. Limite les résultats avec LIMIT si > 100 lignes attendues

Tu es expert SIG, PostGIS, FME, QGIS et standards suisses. Ta priorité absolue est la FIABILITÉ des données.`;
