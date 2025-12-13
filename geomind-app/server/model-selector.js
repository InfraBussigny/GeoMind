/**
 * Model Selector - Sélection automatique du modèle selon la tâche
 *
 * Logique :
 * - Haiku (rapide, économique) : questions simples, reformulation, traduction, chat casual
 * - Sonnet (équilibré) : code, analyse, raisonnement, tâches complexes
 * - Opus (puissant) : tâches critiques, architecture, décisions importantes
 */

// Définition des modèles disponibles
export const MODELS = {
  claude: {
    haiku: 'claude-3-5-haiku-20241022',
    sonnet: 'claude-sonnet-4-20250514',
    opus: 'claude-opus-4-20250514'
  },
  groq: {
    fast: 'llama-3.3-70b-versatile',      // Rapide et polyvalent
    default: 'llama-3.3-70b-versatile',   // Par défaut
    mixtral: 'mixtral-8x7b-32768'         // Alternative
  }
};

// Patterns pour détecter le type de tâche
const TASK_PATTERNS = {
  // Tâches simples → Haiku
  simple: [
    /^(bonjour|salut|hello|hi|coucou|hey)/i,
    /^(merci|thanks|ok|d'accord|parfait|super)/i,
    /qu'est-ce que (c'est|signifie)/i,
    /c'est quoi/i,
    /tradui(s|re|t)/i,
    /reformule/i,
    /résume en (une|quelques) phrase/i,
    /^(oui|non|peut-être)/i,
    /comment (ça va|vas-tu)/i,
    /quelle heure/i,
    /rappelle-moi/i
  ],

  // Tâches complexes → Sonnet
  complex: [
    /\b(code|script|fonction|class|import|def |function |const |let |var )\b/i,
    /\b(sql|select|insert|update|delete|join|where)\b/i,
    /\b(python|javascript|typescript|rust|java|c\+\+)\b/i,
    /\b(bug|erreur|error|debug|fix|corriger)\b/i,
    /\b(analyse|analyzer|explain|expliquer en détail)\b/i,
    /\b(créer|implémenter|développer|coder)\b/i,
    /\b(algorithme|optimiser|performance)\b/i,
    /\b(api|endpoint|route|backend|frontend)\b/i,
    /\b(base de données|database|postgis|postgresql|oracle)\b/i,
    /\b(fme|workbench|transformer)\b/i,
    /\b(qgis|arcgis|mapbox|leaflet)\b/i,
    /\b(geojson|shapefile|wms|wfs|interlis)\b/i,
    /pourquoi .{20,}/i,  // Questions longues commençant par "pourquoi"
    /comment .{30,}/i    // Questions longues commençant par "comment"
  ],

  // Tâches critiques → Opus
  critical: [
    /\b(architecture|conception|design system)\b/i,
    /\b(sécurité|security|vulnérabilité|authentification)\b/i,
    /\b(migration|refactoring majeur|restructurer)\b/i,
    /\b(décision importante|stratégie|planification)\b/i,
    /\b(audit|review complet|analyse approfondie)\b/i,
    /\b(production|déploiement|mise en prod)\b/i
  ]
};

// Indicateurs de complexité dans le contexte
const COMPLEXITY_INDICATORS = {
  // Augmentent la complexité
  increase: [
    { pattern: /```[\s\S]*```/, weight: 2 },           // Blocs de code
    { pattern: /\b(fichier|file|path|chemin)\b/gi, weight: 1 },  // Manipulation fichiers
    { pattern: /\b(erreur|error|exception)\b/gi, weight: 1 },    // Debugging
    { pattern: /\?\s*$/, weight: 0.5 },                // Questions
    { pattern: /\b(pourquoi|comment|explain)\b/gi, weight: 0.5 } // Explications
  ],
  // Diminuent la complexité
  decrease: [
    { pattern: /^.{0,50}$/, weight: -1 },              // Messages courts
    { pattern: /^(ok|oui|non|merci|super)/i, weight: -2 }  // Réponses simples
  ]
};

/**
 * Analyse un message et retourne un score de complexité
 * @param {string} message - Le message à analyser
 * @returns {number} Score de complexité (0-10)
 */
function analyzeComplexity(message) {
  let score = 5; // Score de base

  // Vérifier les patterns de complexité
  for (const indicator of COMPLEXITY_INDICATORS.increase) {
    const matches = message.match(indicator.pattern);
    if (matches) {
      score += indicator.weight * (Array.isArray(matches) ? Math.min(matches.length, 3) : 1);
    }
  }

  for (const indicator of COMPLEXITY_INDICATORS.decrease) {
    if (indicator.pattern.test(message)) {
      score += indicator.weight;
    }
  }

  // Facteur longueur du message
  if (message.length > 500) score += 2;
  else if (message.length > 200) score += 1;
  else if (message.length < 50) score -= 1;

  // Limiter entre 0 et 10
  return Math.max(0, Math.min(10, score));
}

/**
 * Détermine le type de tâche à partir du message
 * @param {string} message - Le message utilisateur
 * @returns {'simple'|'complex'|'critical'} Type de tâche
 */
function detectTaskType(message) {
  // Vérifier d'abord les tâches critiques
  for (const pattern of TASK_PATTERNS.critical) {
    if (pattern.test(message)) {
      return 'critical';
    }
  }

  // Vérifier les tâches complexes
  for (const pattern of TASK_PATTERNS.complex) {
    if (pattern.test(message)) {
      return 'complex';
    }
  }

  // Vérifier les tâches simples
  for (const pattern of TASK_PATTERNS.simple) {
    if (pattern.test(message)) {
      return 'simple';
    }
  }

  // Par défaut, utiliser le score de complexité
  const complexity = analyzeComplexity(message);
  if (complexity <= 3) return 'simple';
  if (complexity >= 7) return 'critical';
  return 'complex';
}

/**
 * Sélectionne automatiquement le meilleur modèle pour une tâche
 * @param {string} provider - Le provider (claude, openai, etc.)
 * @param {string} message - Le dernier message utilisateur
 * @param {Array} conversationHistory - Historique de la conversation (optionnel)
 * @param {Object} options - Options supplémentaires
 * @returns {Object} { model, reason, taskType, complexity }
 */
function selectModel(provider, message, conversationHistory = [], options = {}) {
  // Si un modèle est forcé, le retourner
  if (options.forceModel) {
    return {
      model: options.forceModel,
      reason: 'Modèle forcé par l\'utilisateur',
      taskType: 'forced',
      complexity: null
    };
  }

  // Support des différents providers
  if (!MODELS[provider]) {
    return {
      model: null,
      reason: `Provider ${provider} non supporté pour la sélection auto`,
      taskType: 'unknown',
      complexity: null
    };
  }

  // Analyser le message
  const taskType = detectTaskType(message);
  const complexity = analyzeComplexity(message);

  // Prendre en compte l'historique (si conversation longue, potentiellement plus complexe)
  let adjustedTaskType = taskType;
  if (conversationHistory.length > 10 && taskType === 'simple') {
    adjustedTaskType = 'complex'; // Conversations longues nécessitent plus de contexte
  }

  // Sélectionner le modèle selon le provider
  let model, reason;
  const providerModels = MODELS[provider];

  if (provider === 'claude') {
    switch (adjustedTaskType) {
      case 'simple':
        model = providerModels.haiku;
        reason = 'Tâche simple détectée - utilisation de Haiku (rapide et économique)';
        break;

      case 'critical':
        // Pour l'instant, on utilise Sonnet même pour critical (Opus coûte cher)
        model = providerModels.sonnet;
        reason = 'Tâche critique détectée - utilisation de Sonnet (puissant)';
        break;

      case 'complex':
      default:
        model = providerModels.sonnet;
        reason = 'Tâche complexe détectée - utilisation de Sonnet (équilibré)';
        break;
    }
  } else if (provider === 'groq') {
    // Groq n'a qu'un seul modèle principal, on l'utilise toujours
    model = providerModels.default;
    reason = 'Groq - utilisation de Llama 3.3 70B';
  } else {
    // Fallback pour autres providers
    model = providerModels.default || Object.values(providerModels)[0];
    reason = `Modèle par défaut pour ${provider}`;
  }

  return {
    model,
    reason,
    taskType: adjustedTaskType,
    complexity,
    originalTaskType: taskType
  };
}

/**
 * Version simplifiée pour sélection rapide
 * @param {string} message - Le message utilisateur
 * @returns {string} ID du modèle
 */
function quickSelect(message) {
  const result = selectModel('claude', message);
  return result.model;
}

export {
  selectModel,
  quickSelect,
  detectTaskType,
  analyzeComplexity,
  TASK_PATTERNS
};
