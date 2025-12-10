/**
 * GeoBrain Security Module
 * Gestion des permissions selon le mode (standard/expert/god)
 * Avec gardes-fous même pour le God mode
 */

// ============================================
// GARDES-FOUS GOD MODE - COMMANDES BLOQUÉES
// ============================================

// Commandes TOUJOURS bloquées, même en God mode (pourraient endommager le poste)
const ALWAYS_BLOCKED_COMMANDS = [
  // Formatage et destruction de disques
  'format c:', 'format d:', 'format e:',
  'diskpart', 'fdisk', 'mkfs',
  'dd if=/dev/zero', 'dd if=/dev/random',
  // Suppression système Windows
  'del /s /q c:\\windows', 'rd /s /q c:\\windows',
  'del /s /q c:\\users', 'rd /s /q c:\\users',
  'del /s /q c:\\program', 'rd /s /q c:\\program',
  // Suppression système Linux
  'rm -rf /', 'rm -rf /*', 'rm -rf /home', 'rm -rf /usr', 'rm -rf /etc',
  // Registre Windows critique
  'reg delete hklm', 'reg delete hkcr', 'reg delete hkcu\\software\\microsoft\\windows',
  // Boot/BIOS
  'bcdedit /delete', 'bootrec', 'bcdboot',
  // Shutdown forcé sans confirmation
  'shutdown /r /t 0', 'shutdown /s /t 0',
  // Fork bombs et déni de service
  ':(){ :|:& };:', '%0|%0', 'for /l %',
  // Écriture MBR/secteur de démarrage
  'fixmbr', 'fixboot', 'bootsect'
];

// Patterns regex pour commandes toujours bloquées
const ALWAYS_BLOCKED_PATTERNS = [
  /format\s+[a-z]:/i,
  /del\s+\/[sfq]+.*[a-z]:\\(windows|users|program)/i,
  /rd\s+\/[sfq]+.*[a-z]:\\(windows|users|program)/i,
  /rm\s+-rf?\s+\/(bin|boot|dev|etc|home|lib|opt|root|sbin|srv|sys|usr|var)/i,
  /reg\s+delete\s+hk(lm|cr|cu)\\software\\microsoft\\windows/i,
  />\s*\/dev\/(sda|hda|nvme)/i
];

// ============================================
// NIVEAUX DE DANGEROSITÉ
// ============================================

const DANGER_LEVELS = {
  SAFE: { level: 0, label: 'Sûr', color: 'green', needsConfirmation: false },
  LOW: { level: 1, label: 'Faible', color: 'yellow', needsConfirmation: false },
  MEDIUM: { level: 2, label: 'Moyen', color: 'orange', needsConfirmation: true },
  HIGH: { level: 3, label: 'Élevé', color: 'red', needsConfirmation: true },
  CRITICAL: { level: 4, label: 'Critique', color: 'darkred', needsConfirmation: true },
  BLOCKED: { level: 5, label: 'Bloqué', color: 'black', needsConfirmation: false, blocked: true }
};

// Commandes avec niveau de risque (pour God mode)
const COMMAND_RISK_PATTERNS = [
  // CRITICAL - Confirmation obligatoire avec avertissement fort
  { pattern: /drop\s+(database|table|schema)/i, level: 'CRITICAL', consequence: 'Suppression définitive de données de la base' },
  { pattern: /truncate\s+table/i, level: 'CRITICAL', consequence: 'Suppression de toutes les données de la table' },
  { pattern: /delete\s+from\s+\w+\s*(;|$)/i, level: 'CRITICAL', consequence: 'Suppression de TOUTES les lignes de la table (pas de WHERE)' },
  { pattern: /rm\s+-rf?\s+[^\s]+/i, level: 'CRITICAL', consequence: 'Suppression récursive irréversible de fichiers' },
  { pattern: /del\s+\/[sfq]/i, level: 'CRITICAL', consequence: 'Suppression forcée de fichiers Windows' },

  // HIGH - Confirmation obligatoire
  { pattern: /update\s+\w+\s+set\s+.*where/i, level: 'HIGH', consequence: 'Modification de données existantes' },
  { pattern: /alter\s+table/i, level: 'HIGH', consequence: 'Modification de la structure de la table' },
  { pattern: /grant|revoke/i, level: 'HIGH', consequence: 'Modification des permissions de la base' },
  { pattern: /chmod\s+-R/i, level: 'HIGH', consequence: 'Changement récursif de permissions' },
  { pattern: /chown\s+-R/i, level: 'HIGH', consequence: 'Changement récursif de propriétaire' },
  { pattern: /kill\s+-9/i, level: 'HIGH', consequence: 'Arrêt forcé d\'un processus' },
  { pattern: /taskkill\s+\/f/i, level: 'HIGH', consequence: 'Arrêt forcé d\'un processus Windows' },
  { pattern: /net\s+stop/i, level: 'HIGH', consequence: 'Arrêt d\'un service Windows' },

  // MEDIUM - Confirmation recommandée
  { pattern: /insert\s+into/i, level: 'MEDIUM', consequence: 'Insertion de nouvelles données' },
  { pattern: /create\s+(table|database|index)/i, level: 'MEDIUM', consequence: 'Création d\'objets dans la base' },
  { pattern: /npm\s+(install|uninstall)/i, level: 'MEDIUM', consequence: 'Modification des dépendances du projet' },
  { pattern: /pip\s+install/i, level: 'MEDIUM', consequence: 'Installation de packages Python' },
  { pattern: /git\s+(push|force|reset\s+--hard)/i, level: 'MEDIUM', consequence: 'Modification de l\'historique Git' },

  // LOW - Information seulement
  { pattern: /git\s+commit/i, level: 'LOW', consequence: 'Enregistrement des modifications' },
  { pattern: /select.*from/i, level: 'SAFE', consequence: 'Lecture de données' }
];

// Configuration des permissions par mode
export const MODE_PERMISSIONS = {
  standard: {
    canRead: true,
    canWrite: true,
    sandboxOnly: true,
    canExecute: false,
    canAccessSecrets: false,
    canQueryDB: true,
    canModifyDB: false,
    canDeleteFiles: false,
    allowedTools: ['read_file', 'list_directory', 'write_file', 'web_search', 'web_fetch', 'sql_query']
  },
  expert: {
    canRead: true,
    canWrite: true,
    sandboxOnly: false,
    canExecute: true,
    canAccessSecrets: false,
    canQueryDB: true,
    canModifyDB: true,
    canDeleteFiles: true,
    allowedTools: ['read_file', 'list_directory', 'write_file', 'create_directory', 'execute_command', 'web_search', 'web_fetch', 'sql_query', 'sql_execute']
  },
  god: {
    canRead: true,
    canWrite: true,
    sandboxOnly: false,
    canExecute: true,
    canAccessSecrets: true,
    canQueryDB: true,
    canModifyDB: true,
    canDeleteFiles: true,
    allowedTools: ['*']
  }
};

// Chemins protégés contenant des secrets
const PROTECTED_PATHS = [
  '.env',
  'credentials',
  'secrets',
  'password',
  '.key',
  '.pem',
  'config/db',
  'apikey',
  '.ssh',
  'private'
];

// Dossier sandbox
const SANDBOX_PATH = 'C:/Users/zema/GeoBrain/sandbox';

// Mots-clés SQL dangereux
const DANGEROUS_SQL = ['DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'UPDATE', 'INSERT', 'CREATE', 'GRANT', 'REVOKE'];

// Commandes shell dangereuses
const DANGEROUS_COMMANDS = ['rm ', 'del ', 'rmdir', 'format', 'fdisk', 'sudo', 'chmod', 'chown', 'kill', '> /dev/', 'mkfs', 'dd if='];

/**
 * Vérifie si un outil est autorisé pour le mode donné
 */
export function isToolAllowed(toolName, mode) {
  const perms = MODE_PERMISSIONS[mode];
  if (!perms) return false;

  if (perms.allowedTools.includes('*')) return true;
  return perms.allowedTools.includes(toolName);
}

/**
 * Vérifie si un chemin est protégé (contient des secrets)
 */
export function isProtectedPath(filePath) {
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
  return PROTECTED_PATHS.some(p => normalizedPath.includes(p.toLowerCase()));
}

/**
 * Vérifie si un chemin est dans la sandbox
 */
export function isInSandbox(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  const normalizedSandbox = SANDBOX_PATH.replace(/\\/g, '/').toLowerCase();
  return normalizedPath.startsWith(normalizedSandbox);
}

/**
 * Vérifie si une requête SQL est dangereuse
 */
export function isDangerousSQL(query) {
  const upperQuery = query.toUpperCase().trim();
  return DANGEROUS_SQL.some(keyword => upperQuery.startsWith(keyword) || upperQuery.includes(` ${keyword} `));
}

/**
 * Vérifie si une commande shell est dangereuse
 */
export function isDangerousCommand(command) {
  const lowerCommand = command.toLowerCase();
  return DANGEROUS_COMMANDS.some(cmd => lowerCommand.includes(cmd.toLowerCase()));
}

/**
 * Vérifie si une commande est TOUJOURS bloquée (même en God mode)
 */
export function isAlwaysBlocked(command) {
  const lowerCommand = command.toLowerCase();

  // Vérifier les commandes textuelles
  if (ALWAYS_BLOCKED_COMMANDS.some(blocked => lowerCommand.includes(blocked.toLowerCase()))) {
    return true;
  }

  // Vérifier les patterns regex
  if (ALWAYS_BLOCKED_PATTERNS.some(pattern => pattern.test(command))) {
    return true;
  }

  return false;
}

/**
 * Évalue le niveau de dangerosité d'une commande/requête
 * Retourne un objet avec le niveau, la description et si confirmation requise
 */
export function evaluateDangerLevel(commandOrQuery) {
  // D'abord vérifier si c'est toujours bloqué
  if (isAlwaysBlocked(commandOrQuery)) {
    return {
      ...DANGER_LEVELS.BLOCKED,
      command: commandOrQuery,
      consequence: 'Cette commande pourrait endommager votre système de manière irréversible.',
      blocked: true
    };
  }

  // Chercher le niveau de risque dans les patterns
  for (const risk of COMMAND_RISK_PATTERNS) {
    if (risk.pattern.test(commandOrQuery)) {
      return {
        ...DANGER_LEVELS[risk.level],
        command: commandOrQuery,
        consequence: risk.consequence
      };
    }
  }

  // Par défaut, niveau sûr
  return {
    ...DANGER_LEVELS.SAFE,
    command: commandOrQuery,
    consequence: 'Opération standard sans risque identifié'
  };
}

/**
 * Génère un message d'avertissement formaté pour l'UI
 */
export function generateWarningMessage(dangerEval) {
  const icons = {
    SAFE: '✅',
    LOW: '📝',
    MEDIUM: '⚠️',
    HIGH: '🔶',
    CRITICAL: '🚨',
    BLOCKED: '🚫'
  };

  const levelName = Object.keys(DANGER_LEVELS).find(
    key => DANGER_LEVELS[key].level === dangerEval.level
  );

  if (dangerEval.blocked) {
    return {
      title: `${icons.BLOCKED} COMMANDE BLOQUÉE`,
      message: `Cette opération est **interdite** même en God mode car elle pourrait endommager votre système.`,
      consequence: dangerEval.consequence,
      color: 'darkred',
      canProceed: false
    };
  }

  if (dangerEval.level >= 3) { // HIGH ou CRITICAL
    return {
      title: `${icons[levelName]} ATTENTION - Risque ${dangerEval.label}`,
      message: `Cette opération nécessite votre **confirmation explicite**.`,
      consequence: dangerEval.consequence,
      color: dangerEval.color,
      canProceed: true,
      requiresConfirmation: true
    };
  }

  if (dangerEval.level === 2) { // MEDIUM
    return {
      title: `${icons.MEDIUM} Confirmation recommandée`,
      message: `Cette opération peut modifier des données.`,
      consequence: dangerEval.consequence,
      color: dangerEval.color,
      canProceed: true,
      requiresConfirmation: true
    };
  }

  return {
    title: `${icons.SAFE} Opération sûre`,
    message: dangerEval.consequence,
    color: 'green',
    canProceed: true,
    requiresConfirmation: false
  };
}

/**
 * Valide une opération selon le mode et retourne une erreur si non autorisé
 */
export function validateOperation(operation, mode) {
  const perms = MODE_PERMISSIONS[mode];
  if (!perms) {
    return { allowed: false, error: 'Mode inconnu' };
  }

  switch (operation.type) {
    case 'read_file':
      // Vérifier l'accès aux secrets
      if (isProtectedPath(operation.path) && !perms.canAccessSecrets) {
        return {
          allowed: false,
          error: `Accès refusé: fichier protégé. Mode "god" requis pour accéder aux secrets.`
        };
      }
      return { allowed: true };

    case 'write_file':
      // Vérifier sandbox
      if (perms.sandboxOnly && !isInSandbox(operation.path)) {
        return {
          allowed: false,
          error: `Écriture refusée: en mode "${mode}", vous ne pouvez écrire que dans le dossier sandbox (${SANDBOX_PATH}). Conseil: utilisez ce chemin ou passez en mode expert.`
        };
      }
      // Vérifier fichiers protégés
      if (isProtectedPath(operation.path) && !perms.canAccessSecrets) {
        return {
          allowed: false,
          error: `Écriture refusée: fichier protégé.`
        };
      }
      return { allowed: true };

    case 'execute_command':
      if (!perms.canExecute) {
        return {
          allowed: false,
          error: `Exécution de commandes non autorisée en mode "${mode}". Passez en mode expert.`
        };
      }

      // === GARDES-FOUS GOD MODE ===
      // Vérifier si commande TOUJOURS bloquée (même en god mode)
      if (isAlwaysBlocked(operation.command)) {
        const warning = generateWarningMessage(evaluateDangerLevel(operation.command));
        return {
          allowed: false,
          blocked: true,
          error: `🚫 COMMANDE BLOQUÉE: ${warning.consequence}`,
          dangerLevel: 'BLOCKED',
          warning
        };
      }

      // En god mode, évaluer la dangerosité et demander confirmation si nécessaire
      if (mode === 'god') {
        const dangerEval = evaluateDangerLevel(operation.command);
        const warning = generateWarningMessage(dangerEval);

        if (dangerEval.needsConfirmation && !operation.confirmed) {
          return {
            allowed: false,
            needsConfirmation: true,
            dangerLevel: dangerEval.label,
            dangerColor: dangerEval.color,
            warning,
            error: `⚠️ Confirmation requise (Risque: ${dangerEval.label})`
          };
        }
        return { allowed: true, dangerLevel: dangerEval.label };
      }

      // Vérifier commandes dangereuses en mode expert
      if (mode === 'expert' && isDangerousCommand(operation.command)) {
        return {
          allowed: false,
          error: `Commande potentiellement dangereuse détectée. Mode "god" requis ou confirmation manuelle.`,
          needsConfirmation: true
        };
      }
      return { allowed: true };

    case 'sql_query':
      if (!perms.canQueryDB) {
        return { allowed: false, error: 'Requêtes DB non autorisées dans ce mode.' };
      }

      // === GARDES-FOUS GOD MODE POUR SQL ===
      if (mode === 'god') {
        const dangerEval = evaluateDangerLevel(operation.query);
        const warning = generateWarningMessage(dangerEval);

        // Bloquer les commandes SQL destructrices sans WHERE (DROP DATABASE, etc.)
        if (dangerEval.blocked) {
          return {
            allowed: false,
            blocked: true,
            error: `🚫 REQUÊTE SQL BLOQUÉE: ${warning.consequence}`,
            dangerLevel: 'BLOCKED',
            warning
          };
        }

        // Demander confirmation pour les requêtes risquées
        if (dangerEval.needsConfirmation && !operation.confirmed) {
          return {
            allowed: false,
            needsConfirmation: true,
            dangerLevel: dangerEval.label,
            dangerColor: dangerEval.color,
            warning,
            error: `⚠️ Confirmation requise (Risque SQL: ${dangerEval.label})`
          };
        }
        return { allowed: true, dangerLevel: dangerEval.label };
      }

      // Vérifier si c'est une requête de modification (modes non-god)
      if (isDangerousSQL(operation.query) && !perms.canModifyDB) {
        return {
          allowed: false,
          error: `Requête de modification non autorisée en mode "${mode}". Seules les requêtes SELECT sont permises.`
        };
      }
      return { allowed: true };

    case 'delete_file':
      if (!perms.canDeleteFiles) {
        return {
          allowed: false,
          error: `Suppression de fichiers non autorisée en mode "${mode}".`
        };
      }
      return { allowed: true };

    default:
      // Vérifier si l'outil est dans la liste
      if (!isToolAllowed(operation.type, mode)) {
        return {
          allowed: false,
          error: `Outil "${operation.type}" non autorisé en mode "${mode}".`
        };
      }
      return { allowed: true };
  }
}

/**
 * Filtre les outils disponibles selon le mode
 */
export function filterToolsForMode(allTools, mode) {
  const perms = MODE_PERMISSIONS[mode];
  if (!perms) return [];

  if (perms.allowedTools.includes('*')) return allTools;

  return allTools.filter(tool => perms.allowedTools.includes(tool.name));
}

/**
 * Génère un message d'avertissement pour le mode standard
 */
export function getStandardModeWarning() {
  return `⚠️ **Mode Professionnel actif**

Vous êtes en mode sécurisé. Certaines fonctionnalités sont limitées :
- Écriture uniquement dans le dossier sandbox
- Pas d'exécution de commandes système
- Requêtes DB en lecture seule (SELECT)
- Fichiers de configuration protégés

Pour débloquer toutes les fonctionnalités, demandez à activer le mode expert.`;
}

export default {
  MODE_PERMISSIONS,
  isToolAllowed,
  isProtectedPath,
  isInSandbox,
  isDangerousSQL,
  isDangerousCommand,
  isAlwaysBlocked,
  evaluateDangerLevel,
  generateWarningMessage,
  validateOperation,
  filterToolsForMode,
  getStandardModeWarning,
  SANDBOX_PATH
};
