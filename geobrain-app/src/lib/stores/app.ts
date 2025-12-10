import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type ModuleType = 'chat' | 'canvas' | 'editor' | 'docgen' | 'settings';

export const currentModule = writable<ModuleType>('chat');
export const sidebarCollapsed = writable(false);

// ============================================
// THEME & MODE SYSTEM
// ============================================

export type ThemeMode = 'light' | 'dark';
export type AppMode = 'standard' | 'expert';

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

// Theme store (clair par défaut)
function createThemeStore() {
  const { subscribe, set, update } = writable<ThemeMode>(loadPreference('geobrain-theme', 'light'));

  return {
    subscribe,
    set: (value: ThemeMode) => {
      savePreference('geobrain-theme', value);
      set(value);
    },
    toggle: () => {
      update(current => {
        const newValue = current === 'light' ? 'dark' : 'light';
        savePreference('geobrain-theme', newValue);
        return newValue;
      });
    }
  };
}

// App mode store (standard par défaut)
function createAppModeStore() {
  const { subscribe, set, update } = writable<AppMode>(loadPreference('geobrain-mode', 'standard'));

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
  if ($mode === 'expert') {
    return ['chat', 'canvas', 'editor', 'docgen', 'settings'] as ModuleType[];
  }
  // Mode standard: seulement Assistant et Cartes
  return ['chat', 'canvas'] as ModuleType[];
});

// Phrases secrètes pour activer/désactiver le mode expert
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
  'full power',
  'god mode',
  'sudo',
  'root access'
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

// Fonction pour détecter les phrases d'activation
export function checkExpertActivation(message: string): 'activate' | 'deactivate' | null {
  const normalized = message.toLowerCase().trim();

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
