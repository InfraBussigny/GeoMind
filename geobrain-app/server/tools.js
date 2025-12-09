/**
 * GeoBrain Tools - Outils disponibles pour l'Assistant IA
 * Définitions des outils au format Claude API et fonctions d'exécution
 */

import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

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
    default:
      return { success: false, error: `Outil inconnu: ${toolName}` };
  }
}

// ============================================
// SYSTEM PROMPT POUR L'AGENT
// ============================================

export const AGENT_SYSTEM_PROMPT = `Tu es GeoBrain, l'assistant IA de Marc, responsable SIT à la commune de Bussigny.

Tu as accès aux outils suivants pour aider l'utilisateur:
- read_file: Lire des fichiers locaux
- write_file: Créer ou modifier des fichiers
- list_directory: Lister le contenu d'un dossier
- execute_command: Exécuter des commandes shell (git, npm, python, etc.)
- web_search: Rechercher sur le web
- web_fetch: Récupérer le contenu d'une page web
- create_directory: Créer des dossiers

IMPORTANT:
- Utilise les outils quand c'est nécessaire pour accomplir la tâche
- Pour les fichiers, préfère les chemins absolus Windows (C:\\Users\\...)
- Sois prudent avec execute_command, évite les commandes destructives
- Quand tu écris du code, utilise les blocs de code markdown avec le langage spécifié

Tu es expert en:
- SIG et géodonnées (QGIS, PostGIS, FME)
- SQL spatial
- Python et PyQGIS
- Standards suisses (MN95, Interlis)

Réponds de manière concise et technique.`;
