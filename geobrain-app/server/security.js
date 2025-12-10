/**
 * GeoBrain Security Module
 * Gestion des permissions selon le mode (standard/expert/god)
 */

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
      // Vérifier commandes dangereuses en mode expert (pas god)
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
      // Vérifier si c'est une requête de modification
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
  validateOperation,
  filterToolsForMode,
  getStandardModeWarning,
  SANDBOX_PATH
};
