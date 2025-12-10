import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type ModuleType = 'chat' | 'canvas' | 'editor' | 'docgen' | 'settings';

export const currentModule = writable<ModuleType>('chat');
export const sidebarCollapsed = writable(false);

// ============================================
// THEME & MODE SYSTEM
// ============================================

export type ThemeMode = 'light' | 'dark' | 'god';
export type AppMode = 'standard' | 'expert' | 'god';

// Définition des permissions par mode
export interface ModePermissions {
  canRead: boolean;
  canWrite: boolean;
  sandboxOnly: boolean;  // Si true, écriture uniquement dans sandbox
  canExecute: boolean;
  canAccessSecrets: boolean;
  canQueryDB: boolean;      // SELECT
  canModifyDB: boolean;     // INSERT/UPDATE/DELETE
  canDeleteFiles: boolean;
  canUseGeoportal: boolean; // Login Carto Ouest
  dangerousCommandsNeedConfirm: boolean;
  allowedTools: string[];   // Liste des outils autorisés
}

export const MODE_PERMISSIONS: Record<AppMode, ModePermissions> = {
  standard: {
    canRead: true,
    canWrite: true,
    sandboxOnly: true,  // Écriture uniquement dans sandbox
    canExecute: false,
    canAccessSecrets: false,
    canQueryDB: true,    // SELECT autorisé
    canModifyDB: false,  // Pas d'INSERT/UPDATE/DELETE
    canDeleteFiles: false,
    canUseGeoportal: true,  // Login dispo
    dangerousCommandsNeedConfirm: true,
    allowedTools: [
      'read_file',
      'list_directory',
      'write_file',  // Mais sandboxOnly!
      'web_search',
      'web_fetch',
      'sql_query'    // SELECT uniquement
    ]
  },
  expert: {
    canRead: true,
    canWrite: true,
    sandboxOnly: false,
    canExecute: true,
    canAccessSecrets: false,  // Pas les mots de passe
    canQueryDB: true,
    canModifyDB: true,
    canDeleteFiles: true,
    canUseGeoportal: true,
    dangerousCommandsNeedConfirm: true,  // Confirmation pour rm, drop, etc.
    allowedTools: [
      'read_file',
      'list_directory',
      'write_file',
      'create_directory',
      'execute_command',
      'web_search',
      'web_fetch',
      'sql_query',
      'sql_execute'
    ]
  },
  god: {
    canRead: true,
    canWrite: true,
    sandboxOnly: false,
    canExecute: true,
    canAccessSecrets: true,  // Accès aux secrets
    canQueryDB: true,
    canModifyDB: true,
    canDeleteFiles: true,
    canUseGeoportal: true,
    dangerousCommandsNeedConfirm: false,  // Full power
    allowedTools: ['*']  // Tous les outils
  }
};

// Commandes SQL dangereuses (nécessitent expert+ ou confirmation)
export const DANGEROUS_SQL_KEYWORDS = [
  'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'UPDATE', 'INSERT',
  'CREATE', 'GRANT', 'REVOKE', 'EXECUTE'
];

// Commandes shell dangereuses
export const DANGEROUS_SHELL_COMMANDS = [
  'rm ', 'del ', 'rmdir', 'format', 'fdisk',
  'sudo', 'chmod', 'chown', 'kill',
  'DROP', 'TRUNCATE', 'DELETE FROM',
  '> /dev/', 'mkfs', 'dd if='
];

// Chemins protégés (secrets)
export const PROTECTED_PATHS = [
  '.env',
  'credentials',
  'secrets',
  'password',
  '.key',
  '.pem',
  'config/db',
  'apikey'
];

// Dossier sandbox pour le mode standard
export const SANDBOX_PATH = 'C:/Users/zema/GeoBrain/sandbox';

// Charger les préférences depuis localStorage
function loadPreference<T>(key: string, defaultValue: T): T {
  if (!browser) return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

// Sauvegarder les préférences dans localStorage
function savePreference(key: string, value: any) {
  if (!browser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors
  }
}

// Theme store (sombre par défaut pour le mode expert)
function createThemeStore() {
  const { subscribe, set, update } = writable<ThemeMode>(loadPreference('geobrain-theme', 'dark'));

  return {
    subscribe,
    set: (value: ThemeMode) => {
      savePreference('geobrain-theme', value);
      set(value);
    },
    toggle: () => {
      update(current => {
        // Le thème god ne peut pas être toggle (il faut sortir du god mode)
        if (current === 'god') return current;
        const newValue = current === 'light' ? 'dark' : 'light';
        savePreference('geobrain-theme', newValue);
        return newValue;
      });
    }
  };
}

// App mode store (expert par défaut)
function createAppModeStore() {
  const { subscribe, set, update } = writable<AppMode>(loadPreference('geobrain-mode', 'expert'));

  return {
    subscribe,
    set: (value: AppMode) => {
      savePreference('geobrain-mode', value);
      set(value);
    },
    activateExpert: () => {
      savePreference('geobrain-mode', 'expert');
      set('expert');
    },
    activateGod: () => {
      savePreference('geobrain-mode', 'god');
      set('god');
    },
    deactivateToStandard: () => {
      savePreference('geobrain-mode', 'standard');
      set('standard');
    },
    deactivateToExpert: () => {
      savePreference('geobrain-mode', 'expert');
      set('expert');
    },
    // Alias pour rétrocompatibilité
    deactivateExpert: () => {
      savePreference('geobrain-mode', 'standard');
      set('standard');
    }
  };
}

export const theme = createThemeStore();
export const appMode = createAppModeStore();

// Derived: liste des modules visibles selon le mode
export const visibleModules = derived(appMode, ($mode) => {
  if ($mode === 'expert' || $mode === 'god') {
    // Expert et God: tous les modules
    return ['chat', 'canvas', 'editor', 'docgen', 'settings'] as ModuleType[];
  }
  // Mode standard: seulement Assistant et Cartes
  return ['chat', 'canvas'] as ModuleType[];
});

// Phrases secrètes pour activer/désactiver les modes
export const EXPERT_ACTIVATION_PHRASES = [
  'on passe aux choses sérieuses',
  'on passe aux choses serieuses',
  'choses sérieuses',
  'choses serieuses',
  'mode expert',
  'expert mode',
  'unlock',
  'power mode',
  'activate expert',
  'activer expert',
  'plein pouvoir',
  'full power'
];

// God mode - phrases très secrètes (accès aux secrets, full control)
export const GOD_MODE_PHRASES = [
  'god mode',
  'sudo su',
  'root access',
  'i am root',
  'je suis root',
  'override all',
  'master control',
  'konami'  // Easter egg classique
];

export const EXPERT_DEACTIVATION_PHRASES = [
  'mode normal',
  'mode standard',
  'mode pro',
  'mode professionnel',
  'retour normal',
  'standard mode',
  'lock',
  'désactiver expert',
  'desactiver expert',
  '22',  // 22 v'la les flics !
  'vingt-deux',
  'vingt deux'
];

// Pour quitter le God mode vers Expert
export const GOD_DEACTIVATION_PHRASES = [
  'exit god',
  'quit god',
  'downgrade',
  'mode expert',
  'retour expert',
  'back to expert',
  'sortir god',
  'quitter god',
  'exit root',
  'logout root',
  'su exit'
];

// Type de changement de mode détecté
export type ModeChangeAction =
  | 'activate_expert'
  | 'activate_god'
  | 'deactivate_to_standard'
  | 'deactivate_to_expert'
  | null;

// Fonction pour détecter les phrases d'activation (ordre de priorité important)
export function checkModeActivation(message: string, currentMode: AppMode): ModeChangeAction {
  const normalized = message.toLowerCase().trim();

  // 1. Vérifier God mode en premier (le plus restrictif)
  if (GOD_MODE_PHRASES.some(phrase => normalized.includes(phrase))) {
    if (currentMode !== 'god') {
      return 'activate_god';
    }
    return null; // Déjà en god mode
  }

  // 2. Vérifier désactivation depuis God mode
  if (currentMode === 'god') {
    if (GOD_DEACTIVATION_PHRASES.some(phrase => normalized.includes(phrase))) {
      return 'deactivate_to_expert';
    }
    if (EXPERT_DEACTIVATION_PHRASES.some(phrase => normalized.includes(phrase))) {
      return 'deactivate_to_standard';
    }
  }

  // 3. Vérifier activation Expert
  if (EXPERT_ACTIVATION_PHRASES.some(phrase => normalized.includes(phrase))) {
    if (currentMode === 'standard') {
      return 'activate_expert';
    }
    return null; // Déjà en expert ou god
  }

  // 4. Vérifier désactivation Expert → Standard
  if (EXPERT_DEACTIVATION_PHRASES.some(phrase => normalized.includes(phrase))) {
    if (currentMode === 'expert') {
      return 'deactivate_to_standard';
    }
  }

  return null;
}

// Alias pour rétrocompatibilité
export function checkExpertActivation(message: string): 'activate' | 'deactivate' | null {
  const normalized = message.toLowerCase().trim();

  // Vérifier God mode aussi (mais retourne 'activate' pour compatibilité)
  if (GOD_MODE_PHRASES.some(phrase => normalized.includes(phrase))) {
    return 'activate'; // Sera traité comme god dans le handler
  }

  if (EXPERT_ACTIVATION_PHRASES.some(phrase => normalized.includes(phrase))) {
    return 'activate';
  }

  if (EXPERT_DEACTIVATION_PHRASES.some(phrase => normalized.includes(phrase))) {
    return 'deactivate';
  }

  return null;
}

// Chat state
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  provider?: string;
}

export interface Provider {
  id: string;
  name: string;
  models: Model[];
  authType: 'oauth' | 'apikey';
  isConfigured: boolean;
  authMethod: string | null;
}

export interface Model {
  id: string;
  name: string;
  default?: boolean;
}

export const messages = writable<Message[]>([]);
export const isLoading = writable(false);
export const currentProvider = writable<string>('claude');
export const currentModel = writable<string>('claude-3-5-haiku-20241022');
export const providers = writable<Provider[]>([]);
export const backendConnected = writable(false);

// Editor state
export const currentFile = writable<string | null>(null);
export const editorContent = writable('');

// Canvas state
export const canvasLayers = writable<string[]>([]);

// Settings
export const settingsOpen = writable(false);
