/**
 * Sub-Agents System - Agents spécialisés pour tâches spécifiques
 *
 * Architecture :
 * - Agent Principal (orchestrateur) : analyse la demande, délègue aux sub-agents
 * - Sub-agents spécialisés : code, SQL, documentation, QA, optimisation
 *
 * Workflow :
 * 1. L'utilisateur envoie une demande
 * 2. L'agent principal analyse et identifie les sub-agents nécessaires
 * 3. Les sub-agents exécutent leurs tâches en parallèle ou séquentiellement
 * 4. L'agent principal compile et retourne le résultat final
 */

import { selectModel, MODELS } from './model-selector.js';

// Définition des sub-agents disponibles
const SUB_AGENTS = {
  code: {
    id: 'code',
    name: 'Agent Code',
    description: 'Spécialisé en développement Python, JavaScript, SQL',
    model: MODELS.claude.sonnet,
    systemPrompt: `Tu es un expert en développement logiciel. Tu écris du code propre, commenté et optimisé.
Langages maîtrisés : Python, JavaScript/TypeScript, SQL, Rust, Go.
Frameworks : SvelteKit, FastAPI, Express, QGIS (PyQGIS).
Tu fournis toujours du code fonctionnel avec gestion des erreurs.
Format de réponse : code dans des blocs \`\`\` avec le langage spécifié.`,
    triggers: [
      /\b(code|script|fonction|function|class|module)\b/i,
      /\b(python|javascript|typescript|sql|rust)\b/i,
      /\b(créer|implémenter|développer|coder|écrire)\b/i,
      /\b(bug|erreur|debug|fix|corriger)\b/i
    ]
  },

  sql: {
    id: 'sql',
    name: 'Agent SQL/PostGIS',
    description: 'Expert bases de données spatiales PostgreSQL/PostGIS et Oracle',
    model: MODELS.claude.sonnet,
    systemPrompt: `Tu es un expert en bases de données spatiales.
Technologies maîtrisées : PostgreSQL, PostGIS, Oracle Spatial, SQL Server.
Tu maîtrises les requêtes spatiales (ST_*, géométries, index GIST).
Contexte : Système de référence suisse EPSG:2056 (MN95).
Tu optimises les requêtes et proposes des index pertinents.
Format : requêtes SQL commentées avec explication de la logique.`,
    triggers: [
      /\b(sql|select|insert|update|delete|join)\b/i,
      /\b(postgis|postgresql|oracle|base de données|database)\b/i,
      /\b(st_|geometry|spatial|géométrie)\b/i,
      /\b(requête|query|table|schema|index)\b/i
    ]
  },

  fme: {
    id: 'fme',
    name: 'Agent FME',
    description: 'Expert ETL et workbenches FME',
    model: MODELS.claude.sonnet,
    systemPrompt: `Tu es un expert FME (Feature Manipulation Engine).
Tu conçois des workbenches efficaces pour l'ETL de données géospatiales.
Transformers maîtrisés : tous les transformers standards FME.
Formats : Shapefile, GeoJSON, GeoPackage, PostGIS, Oracle, Interlis.
Tu documentes chaque étape du workflow avec les paramètres importants.`,
    triggers: [
      /\b(fme|workbench|transformer|etl)\b/i,
      /\b(reader|writer|feature)\b/i,
      /\b(interlis|shapefile|geopackage)\b/i
    ]
  },

  qgis: {
    id: 'qgis',
    name: 'Agent QGIS',
    description: 'Expert QGIS Desktop et PyQGIS',
    model: MODELS.claude.sonnet,
    systemPrompt: `Tu es un expert QGIS et PyQGIS.
Tu maîtrises : configuration projets, styles, expressions, scripts Python QGIS.
Plugins : tu connais les plugins courants et sais en créer.
Contexte : projets SIT communaux, données cadastrales suisses.
Tu fournis des solutions pratiques avec captures d'écran si utile.`,
    triggers: [
      /\b(qgis|pyqgis|plugin|couche|layer)\b/i,
      /\b(style|symbologie|expression|filtre)\b/i,
      /\b(projet qgis|\.qgs|\.qgz)\b/i
    ]
  },

  doc: {
    id: 'doc',
    name: 'Agent Documentation',
    description: 'Rédaction de documentation technique et notes',
    model: MODELS.claude.haiku, // Haiku suffit pour la doc
    systemPrompt: `Tu es un rédacteur technique expert.
Tu produis une documentation claire, structurée et professionnelle.
Formats maîtrisés : Markdown, PDF (via templates), notes de service.
Style : concis, précis, adapté au public cible.
Tu utilises des listes, tableaux et schémas quand c'est pertinent.`,
    triggers: [
      /\b(documentation|documenter|doc|readme)\b/i,
      /\b(note|rapport|procédure|guide)\b/i,
      /\b(rédiger|écrire|expliquer)\b/i
    ]
  },

  qa: {
    id: 'qa',
    name: 'Agent QA/Review',
    description: 'Review de code, tests, qualité',
    model: MODELS.claude.sonnet,
    systemPrompt: `Tu es un expert en qualité logicielle et review de code.
Tu identifies : bugs potentiels, failles de sécurité, problèmes de performance.
Tu proposes des améliorations concrètes avec exemples.
Tu vérifies : lisibilité, maintenabilité, respect des bonnes pratiques.
Format : liste de points avec sévérité (critique/majeur/mineur).`,
    triggers: [
      /\b(review|relire|vérifier|tester)\b/i,
      /\b(qualité|qa|test|unittest)\b/i,
      /\b(sécurité|security|vulnérabilité)\b/i
    ]
  },

  optimize: {
    id: 'optimize',
    name: 'Agent Optimisation',
    description: 'Optimisation de performance et coûts',
    model: MODELS.claude.sonnet,
    systemPrompt: `Tu es un expert en optimisation de performance.
Domaines : requêtes SQL, algorithmes, code Python/JS, infrastructure.
Tu analyses : complexité, goulets d'étranglement, utilisation mémoire.
Tu proposes des solutions mesurables avec benchmarks attendus.
Tu considères aussi l'optimisation des coûts (API, cloud, etc.).`,
    triggers: [
      /\b(optimiser|performance|lent|slow|rapide)\b/i,
      /\b(mémoire|memory|cpu|ressources)\b/i,
      /\b(coût|cost|économie|budget)\b/i
    ]
  }
};

/**
 * Identifie les sub-agents pertinents pour une tâche
 * @param {string} message - Le message utilisateur
 * @returns {Array} Liste des IDs de sub-agents pertinents
 */
function identifyRelevantAgents(message) {
  const relevant = [];

  for (const [id, agent] of Object.entries(SUB_AGENTS)) {
    for (const trigger of agent.triggers) {
      if (trigger.test(message)) {
        relevant.push(id);
        break; // Un seul match suffit pour cet agent
      }
    }
  }

  // Si aucun agent spécifique trouvé, retourner vide (l'agent principal gère)
  return relevant;
}

/**
 * Génère le prompt système enrichi avec les capacités des sub-agents
 * @param {Array} activeAgents - Liste des agents actifs
 * @returns {string} Prompt système enrichi
 */
function generateEnrichedSystemPrompt(activeAgents = []) {
  let prompt = `Tu es GeoBrain, l'assistant IA spécialisé en géodonnées et SIT de la commune de Bussigny.

## Tes capacités
Tu disposes de plusieurs modules spécialisés que tu peux activer selon les besoins :

`;

  for (const [id, agent] of Object.entries(SUB_AGENTS)) {
    const isActive = activeAgents.includes(id);
    prompt += `### ${agent.name} ${isActive ? '(ACTIF)' : ''}
${agent.description}
${isActive ? `\nDirectives : ${agent.systemPrompt}\n` : ''}
`;
  }

  prompt += `
## Comportement
- Analyse la demande et identifie les modules pertinents
- Utilise les compétences spécialisées quand nécessaire
- Fournis des réponses précises et actionnables
- Code dans des blocs avec langage spécifié
- Contexte géospatial suisse (EPSG:2056, standards ASIT-VD)

## Mémoire
Tu as accès à la mémoire de GeoBrain dans C:\\Users\\zema\\GeoBrain\\memory\\
- context.md : infrastructure et contexte professionnel
- sessions.md : historique des travaux
- corrections.md : erreurs à éviter
`;

  return prompt;
}

/**
 * Crée une tâche pour un sub-agent
 * @param {string} agentId - ID du sub-agent
 * @param {string} task - Description de la tâche
 * @param {Object} context - Contexte additionnel
 * @returns {Object} Configuration de la tâche
 */
function createSubAgentTask(agentId, task, context = {}) {
  const agent = SUB_AGENTS[agentId];
  if (!agent) {
    throw new Error(`Sub-agent inconnu: ${agentId}`);
  }

  return {
    agentId,
    agentName: agent.name,
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    task,
    context,
    status: 'pending'
  };
}

/**
 * Orchestre l'exécution de plusieurs sub-agents
 * @param {string} message - Message utilisateur
 * @param {Object} options - Options d'orchestration
 * @returns {Object} Plan d'exécution
 */
function orchestrate(message, options = {}) {
  const relevantAgents = identifyRelevantAgents(message);

  // Si mode auto et plusieurs agents détectés
  if (relevantAgents.length > 1 && options.parallel !== false) {
    return {
      mode: 'parallel',
      agents: relevantAgents,
      enrichedPrompt: generateEnrichedSystemPrompt(relevantAgents),
      tasks: relevantAgents.map(id => createSubAgentTask(id, message))
    };
  }

  // Mode séquentiel ou agent unique
  return {
    mode: relevantAgents.length > 0 ? 'single' : 'main',
    agents: relevantAgents,
    enrichedPrompt: generateEnrichedSystemPrompt(relevantAgents),
    tasks: relevantAgents.map(id => createSubAgentTask(id, message))
  };
}

/**
 * Retourne les infos d'un sub-agent
 * @param {string} agentId - ID du sub-agent
 * @returns {Object|null} Infos de l'agent
 */
function getAgent(agentId) {
  return SUB_AGENTS[agentId] || null;
}

/**
 * Liste tous les sub-agents disponibles
 * @returns {Array} Liste des agents
 */
function listAgents() {
  return Object.entries(SUB_AGENTS).map(([id, agent]) => ({
    id,
    name: agent.name,
    description: agent.description,
    model: agent.model
  }));
}

export {
  SUB_AGENTS,
  identifyRelevantAgents,
  generateEnrichedSystemPrompt,
  createSubAgentTask,
  orchestrate,
  getAgent,
  listAgents
};
