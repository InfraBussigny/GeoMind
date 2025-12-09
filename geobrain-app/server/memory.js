/**
 * GeoBrain Memory System
 * Gestion de la mémoire partagée entre tous les providers IA
 *
 * Structure de la mémoire :
 * - context.md : Contexte professionnel, infrastructure, stack technique
 * - personality.md : Personnalité et compétences de GeoBrain
 * - sessions.md : Historique des sessions et travaux
 * - corrections.md : Erreurs passées à ne pas répéter
 * - sdol.md : Projet SDOL spécifique
 *
 * + Index sémantique pour recherche rapide
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const GEOBRAIN_ROOT = join(homedir(), 'GeoBrain');
const MEMORY_DIR = join(GEOBRAIN_ROOT, 'memory');
const MEMORY_INDEX_PATH = join(MEMORY_DIR, '.index.json');

// ============================================
// MEMORY STRUCTURE
// ============================================

const MEMORY_FILES = {
  context: {
    path: 'context.md',
    description: 'Contexte professionnel SIT Bussigny, infrastructure, stack technique',
    priority: 1, // Toujours inclus
    maxTokens: 2000
  },
  personality: {
    path: 'personality.md',
    description: 'Personnalité GeoBrain, compétences, comportement',
    priority: 1,
    maxTokens: 1000
  },
  sessions: {
    path: 'sessions.md',
    description: 'Historique des sessions et travaux récents',
    priority: 2, // Inclus si pertinent
    maxTokens: 1500
  },
  corrections: {
    path: 'corrections.md',
    description: 'Erreurs passées et corrections à retenir',
    priority: 2,
    maxTokens: 500
  },
  sdol: {
    path: 'sdol.md',
    description: 'Projet géoportail intercommunal SDOL',
    priority: 3, // Inclus si mentionné
    maxTokens: 1000
  }
};

// ============================================
// MEMORY INDEX (pour recherche rapide)
// ============================================

let memoryIndex = {
  lastUpdate: null,
  files: {},
  keywords: {},
  summary: ''
};

/**
 * Charge et indexe toute la mémoire
 */
export async function loadMemory() {
  console.log('Loading GeoBrain memory...');

  const newIndex = {
    lastUpdate: new Date().toISOString(),
    files: {},
    keywords: {},
    summary: ''
  };

  for (const [key, config] of Object.entries(MEMORY_FILES)) {
    const filePath = join(MEMORY_DIR, config.path);

    try {
      if (existsSync(filePath)) {
        const content = await readFile(filePath, 'utf-8');

        newIndex.files[key] = {
          content,
          path: config.path,
          priority: config.priority,
          maxTokens: config.maxTokens,
          description: config.description,
          size: content.length,
          keywords: extractKeywords(content)
        };

        // Ajouter les keywords à l'index global
        for (const keyword of newIndex.files[key].keywords) {
          if (!newIndex.keywords[keyword]) {
            newIndex.keywords[keyword] = [];
          }
          newIndex.keywords[keyword].push(key);
        }
      }
    } catch (error) {
      console.error(`Error loading ${config.path}:`, error.message);
    }
  }

  // Générer un résumé compact
  newIndex.summary = generateMemorySummary(newIndex);

  memoryIndex = newIndex;

  // Sauvegarder l'index
  await saveIndex(newIndex);

  console.log(`Memory loaded: ${Object.keys(newIndex.files).length} files indexed`);
  return newIndex;
}

/**
 * Extrait les mots-clés importants d'un texte
 */
function extractKeywords(text) {
  const keywords = new Set();

  // Mots-clés techniques
  const techPatterns = [
    /QGIS/gi, /PostGIS/gi, /PostgreSQL/gi, /Oracle/gi, /FME/gi,
    /SQL/gi, /Python/gi, /PyQGIS/gi, /GeoJSON/gi, /WMS/gi, /WFS/gi,
    /Interlis/gi, /cadastre/gi, /parcelle/gi, /bâtiment/gi,
    /géoportail/gi, /SDOL/gi, /Bussigny/gi, /EPSG/gi, /MN95/gi,
    /assainissement/gi, /fibre/gi, /optique/gi, /AutoCAD/gi,
    /shapefile/gi, /GeoPackage/gi, /coordonnées/gi, /projection/gi
  ];

  for (const pattern of techPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      keywords.add(matches[0].toLowerCase());
    }
  }

  // Projets et entités nommées (lignes commençant par ## ou ###)
  const headers = text.match(/^#{2,3}\s+(.+)$/gm);
  if (headers) {
    for (const header of headers) {
      const clean = header.replace(/^#+\s+/, '').toLowerCase();
      if (clean.length > 2 && clean.length < 50) {
        keywords.add(clean);
      }
    }
  }

  return Array.from(keywords);
}

/**
 * Génère un résumé compact de la mémoire
 */
function generateMemorySummary(index) {
  const parts = [];

  if (index.files.context) {
    parts.push('Contexte SIT Bussigny chargé');
  }
  if (index.files.sessions) {
    // Extraire la dernière session
    const sessionsContent = index.files.sessions.content;
    const lastSessionMatch = sessionsContent.match(/## Session \d+[^\n]*\n([^#]*)/);
    if (lastSessionMatch) {
      parts.push(`Dernière session: ${lastSessionMatch[0].slice(0, 100)}...`);
    }
  }
  if (index.files.sdol) {
    parts.push('Projet SDOL documenté');
  }

  return parts.join(' | ');
}

/**
 * Sauvegarde l'index
 */
async function saveIndex(index) {
  try {
    await writeFile(MEMORY_INDEX_PATH, JSON.stringify(index, null, 2));
  } catch (error) {
    console.error('Error saving memory index:', error.message);
  }
}

// ============================================
// CONTEXT BUILDER
// ============================================

/**
 * Construit le contexte optimal pour une requête
 * @param {string} userMessage - Message de l'utilisateur
 * @param {number} maxTokens - Limite de tokens pour le contexte
 * @returns {string} Contexte optimisé
 */
export async function buildContext(userMessage, maxTokens = 4000) {
  // Recharger si l'index est vide ou ancien (>5 min)
  if (!memoryIndex.lastUpdate ||
      Date.now() - new Date(memoryIndex.lastUpdate).getTime() > 5 * 60 * 1000) {
    await loadMemory();
  }

  const contextParts = [];
  let currentTokens = 0;
  const estimateTokens = (text) => Math.ceil(text.length / 4); // Approximation

  // 1. Toujours inclure le contexte de base (priority 1)
  for (const [key, file] of Object.entries(memoryIndex.files)) {
    if (file.priority === 1) {
      const tokens = Math.min(estimateTokens(file.content), file.maxTokens);
      if (currentTokens + tokens <= maxTokens) {
        contextParts.push({
          key,
          content: truncateToTokens(file.content, file.maxTokens),
          priority: file.priority
        });
        currentTokens += tokens;
      }
    }
  }

  // 2. Détecter les sujets mentionnés et ajouter le contexte pertinent
  const mentionedTopics = detectTopics(userMessage);

  for (const [key, file] of Object.entries(memoryIndex.files)) {
    if (file.priority > 1) {
      // Vérifier si ce fichier est pertinent
      const isRelevant = file.keywords.some(kw =>
        mentionedTopics.includes(kw) ||
        userMessage.toLowerCase().includes(kw)
      );

      if (isRelevant) {
        const tokens = Math.min(estimateTokens(file.content), file.maxTokens);
        if (currentTokens + tokens <= maxTokens) {
          contextParts.push({
            key,
            content: truncateToTokens(file.content, file.maxTokens),
            priority: file.priority
          });
          currentTokens += tokens;
        }
      }
    }
  }

  // 3. Construire le prompt système
  return formatContextPrompt(contextParts);
}

/**
 * Détecte les sujets mentionnés dans un message
 */
function detectTopics(message) {
  const topics = [];
  const lowerMessage = message.toLowerCase();

  // Patterns de détection
  const topicPatterns = {
    sdol: ['sdol', 'géoportail intercommunal', 'hkd', 'geomapfish'],
    sql: ['sql', 'requête', 'postgis', 'base de données', 'select', 'insert'],
    qgis: ['qgis', 'pyqgis', 'plugin', 'couche', 'layer'],
    fme: ['fme', 'workbench', 'transformer', 'etl'],
    cadastre: ['cadastre', 'parcelle', 'egrid', 'bien-fonds'],
    reseau: ['assainissement', 'fibre', 'optique', 'eau', 'électricité', 'réseau']
  };

  for (const [topic, keywords] of Object.entries(topicPatterns)) {
    if (keywords.some(kw => lowerMessage.includes(kw))) {
      topics.push(topic);
    }
  }

  return topics;
}

/**
 * Tronque un texte à un nombre approximatif de tokens
 */
function truncateToTokens(text, maxTokens) {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;

  // Tronquer intelligemment (à la fin d'une section)
  const truncated = text.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf('\n\n');
  if (lastNewline > maxChars * 0.8) {
    return truncated.slice(0, lastNewline) + '\n\n[... contenu tronqué ...]';
  }
  return truncated + '\n\n[... contenu tronqué ...]';
}

/**
 * Formate le contexte en prompt système
 */
function formatContextPrompt(contextParts) {
  const sections = [];

  sections.push(`# GeoBrain - Assistant SIT Bussigny

Tu es GeoBrain, l'assistant spécialisé en géodonnées et systèmes d'information du territoire (SIT) de Marc Zermatten, responsable SIT à la commune de Bussigny.

## Tes compétences
- Expert QGIS, PostgreSQL/PostGIS, Oracle Spatial, FME
- Maîtrise des standards suisses (EPSG:2056/MN95, Interlis)
- Scripts Python, PyQGIS, SQL spatial
- Documentation technique et procédures

## Instructions
- Sois technique et précis
- Propose du code fonctionnel et commenté
- Anticipe les problèmes (encodage, projections, SRID)
- Utilise le contexte ci-dessous pour personnaliser tes réponses
`);

  // Ajouter les contextes chargés
  for (const part of contextParts) {
    sections.push(`\n---\n## ${part.key.toUpperCase()}\n${part.content}`);
  }

  sections.push(`\n---\n## IMPORTANT
- Tu as accès au système de fichiers local via des outils
- Tu peux lire et modifier les fichiers du projet GeoBrain
- Mets à jour la mémoire quand tu apprends des informations importantes
`);

  return sections.join('\n');
}

// ============================================
// MEMORY UPDATES
// ============================================

/**
 * Met à jour un fichier de mémoire
 */
export async function updateMemory(fileKey, content, append = false) {
  const config = MEMORY_FILES[fileKey];
  if (!config) {
    throw new Error(`Unknown memory file: ${fileKey}`);
  }

  const filePath = join(MEMORY_DIR, config.path);

  if (append && existsSync(filePath)) {
    const existing = await readFile(filePath, 'utf-8');
    content = existing + '\n\n' + content;
  }

  await writeFile(filePath, content, 'utf-8');

  // Recharger l'index
  await loadMemory();

  return { success: true, path: filePath };
}

/**
 * Ajoute une entrée à la session courante
 */
export async function logSession(entry) {
  const today = new Date().toISOString().split('T')[0];
  const sessionsPath = join(MEMORY_DIR, 'sessions.md');

  let content = '';
  if (existsSync(sessionsPath)) {
    content = await readFile(sessionsPath, 'utf-8');
  }

  // Vérifier si une session existe déjà pour aujourd'hui
  const todayHeader = `## Session - ${today}`;
  if (!content.includes(todayHeader)) {
    // Créer une nouvelle session
    const newSession = `${todayHeader}\n\n### Travaux effectués\n`;
    content = newSession + '\n---\n\n' + content;
  }

  // Ajouter l'entrée
  const timestamp = new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  const logEntry = `- [${timestamp}] ${entry}\n`;

  content = content.replace(
    /(### Travaux effectués\n)/,
    `$1${logEntry}`
  );

  await writeFile(sessionsPath, content, 'utf-8');
  await loadMemory();
}

/**
 * Récupère le résumé de la mémoire
 */
export function getMemorySummary() {
  return {
    lastUpdate: memoryIndex.lastUpdate,
    files: Object.keys(memoryIndex.files),
    keywords: Object.keys(memoryIndex.keywords).slice(0, 20),
    summary: memoryIndex.summary
  };
}

// Charger la mémoire au démarrage
loadMemory().catch(console.error);

export default {
  loadMemory,
  buildContext,
  updateMemory,
  logSession,
  getMemorySummary
};
