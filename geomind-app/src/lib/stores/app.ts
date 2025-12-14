import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type ModuleType = 'chat' | 'canvas' | 'editor' | 'docgen' | 'settings' | 'connexions' | 'comm' | 'databases' | 'timepro' | 'wip' | 'cad' | 'converter' | 'wakelock' | 'kdrive' | 'intercapi';

export const currentModule = writable<ModuleType>('chat');
export const sidebarCollapsed = writable(false);

// ============================================
// THEME & MODE SYSTEM
// ============================================

export type ThemeMode = 'light' | 'dark' | 'god' | 'bfsa';
export type AppMode = 'standard' | 'expert' | 'god' | 'bfsa';

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
  },
  bfsa: {
    // Mode BFSA = mêmes permissions que expert (mode professionnel)
    canRead: true,
    canWrite: true,
    sandboxOnly: false,
    canExecute: true,
    canAccessSecrets: false,
    canQueryDB: true,
    canModifyDB: true,
    canDeleteFiles: true,
    canUseGeoportal: true,
    dangerousCommandsNeedConfirm: true,
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
export const SANDBOX_PATH = 'C:/Users/zema/GeoMind/sandbox';

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
  const { subscribe, set, update } = writable<ThemeMode>(loadPreference('geomind-theme', 'dark'));

  return {
    subscribe,
    set: (value: ThemeMode) => {
      savePreference('geomind-theme', value);
      set(value);
    },
    toggle: () => {
      update(current => {
        // Le thème god ne peut pas être toggle (il faut sortir du god mode)
        if (current === 'god') return current;
        const newValue = current === 'light' ? 'dark' : 'light';
        savePreference('geomind-theme', newValue);
        return newValue;
      });
    }
  };
}

// App mode store (expert par défaut)
function createAppModeStore() {
  const { subscribe, set, update } = writable<AppMode>(loadPreference('geomind-mode', 'standard'));

  return {
    subscribe,
    set: (value: AppMode) => {
      savePreference('geomind-mode', value);
      set(value);
    },
    activateExpert: () => {
      savePreference('geomind-mode', 'expert');
      set('expert');
    },
    activateGod: () => {
      savePreference('geomind-mode', 'god');
      set('god');
    },
    activateBfsa: () => {
      savePreference('geomind-mode', 'bfsa');
      set('bfsa');
    },
    deactivateToStandard: () => {
      savePreference('geomind-mode', 'standard');
      set('standard');
    },
    deactivateToExpert: () => {
      savePreference('geomind-mode', 'expert');
      set('expert');
    },
    // Alias pour rétrocompatibilité
    deactivateExpert: () => {
      savePreference('geomind-mode', 'standard');
      set('standard');
    }
  };
}

export const theme = createThemeStore();
export const appMode = createAppModeStore();

// ============================================
// MODULE VISIBILITY CONFIGURATION
// ============================================

// Tous les modules disponibles avec leurs métadonnées
export const ALL_MODULES: { id: ModuleType; label: string; description: string; alwaysVisible?: boolean }[] = [
  { id: 'chat', label: 'Assistant', description: 'Chat IA', alwaysVisible: true },
  { id: 'canvas', label: 'Cartes', description: 'Visualisation carto' },
  { id: 'editor', label: 'Editeur', description: 'SQL & Python' },
  { id: 'databases', label: 'Databases', description: 'Schema & ERD' },
  { id: 'converter', label: 'Convertisseur', description: 'Conversion fichiers', alwaysVisible: true },
  { id: 'wakelock', label: 'Anti-veille', description: 'Empeche la veille' },
  { id: 'timepro', label: 'TimePro', description: 'Pointage & Timer' },
  { id: 'connexions', label: 'Connexions', description: 'VPN & Serveurs DB' },
  { id: 'comm', label: 'Communications', description: 'Outlook, Teams, 3CX' },
  { id: 'docgen', label: 'DocGen', description: 'Generation docs' },
  { id: 'intercapi', label: 'Intercapi', description: 'Registre Foncier VD' },
  { id: 'settings', label: 'Parametres', description: 'Configuration', alwaysVisible: true },
  { id: 'wip', label: 'WIP', description: 'En developpement' },
  { id: 'cad', label: 'CAD', description: 'Viewer DXF/DWG' },
  { id: 'kdrive', label: 'kDrive', description: 'Partage fichiers' }
];

// Modules par défaut pour chaque mode (excluant standard qui est fixe)
const DEFAULT_MODULE_CONFIG: Record<string, ModuleType[]> = {
  expert: ['chat', 'canvas', 'editor', 'databases', 'converter', 'wakelock', 'timepro', 'connexions', 'comm', 'docgen', 'intercapi', 'settings', 'cad', 'kdrive'],
  god: ['chat', 'canvas', 'editor', 'databases', 'converter', 'wakelock', 'timepro', 'connexions', 'comm', 'docgen', 'intercapi', 'settings', 'wip', 'cad', 'kdrive'],
  bfsa: ['chat', 'canvas', 'editor', 'databases', 'converter', 'wakelock', 'timepro', 'connexions', 'comm', 'docgen', 'intercapi', 'settings', 'cad', 'kdrive']
};

// Modules fixes pour le mode standard (non modifiable)
const STANDARD_MODULES: ModuleType[] = ['chat', 'canvas', 'databases', 'converter', 'wakelock', 'connexions', 'settings'];

// Store pour la configuration personnalisée des modules par mode
function createModuleConfigStore() {
  const stored = browser ? localStorage.getItem('geomind-module-config') : null;

  // Merger la config sauvegardée avec les nouveaux modules par défaut
  // Cela permet d'ajouter automatiquement les nouveaux modules sans reset
  let initial: Record<string, ModuleType[]>;

  if (stored) {
    const savedConfig = JSON.parse(stored) as Record<string, ModuleType[]>;
    initial = { ...DEFAULT_MODULE_CONFIG };

    // Pour chaque mode, on garde les modules sauvegardés ET on ajoute les nouveaux
    for (const mode of Object.keys(DEFAULT_MODULE_CONFIG)) {
      const savedModules = savedConfig[mode] || [];
      const defaultModules = DEFAULT_MODULE_CONFIG[mode] || [];

      // Trouver les nouveaux modules (dans default mais pas dans saved)
      const newModules = defaultModules.filter(m => !savedModules.includes(m));

      // Garder la config utilisateur + ajouter les nouveaux modules
      initial[mode] = [...savedModules, ...newModules];
    }

    // Sauvegarder la config mergée si elle a changé
    if (browser && JSON.stringify(initial) !== stored) {
      localStorage.setItem('geomind-module-config', JSON.stringify(initial));
    }
  } else {
    initial = { ...DEFAULT_MODULE_CONFIG };
  }

  const { subscribe, set, update } = writable(initial);

  return {
    subscribe,
    setModulesForMode: (mode: string, modules: ModuleType[]) => {
      if (mode === 'standard') return; // Standard n'est pas modifiable
      update(config => {
        // S'assurer que chat et settings sont toujours inclus
        const safeModules = [...new Set([...modules, 'chat', 'settings'])] as ModuleType[];
        config[mode] = safeModules;
        if (browser) {
          localStorage.setItem('geomind-module-config', JSON.stringify(config));
        }
        return config;
      });
    },
    toggleModule: (mode: string, moduleId: ModuleType) => {
      if (mode === 'standard') return;
      // Chat et settings ne peuvent pas être désactivés
      if (moduleId === 'chat' || moduleId === 'settings') return;

      update(config => {
        const modules = config[mode] || DEFAULT_MODULE_CONFIG[mode] || [];
        if (modules.includes(moduleId)) {
          config[mode] = modules.filter(m => m !== moduleId);
        } else {
          config[mode] = [...modules, moduleId];
        }
        if (browser) {
          localStorage.setItem('geomind-module-config', JSON.stringify(config));
        }
        return config;
      });
    },
    reset: (mode?: string) => {
      update(config => {
        if (mode && mode !== 'standard') {
          config[mode] = [...DEFAULT_MODULE_CONFIG[mode]];
        } else {
          // Reset all
          Object.keys(DEFAULT_MODULE_CONFIG).forEach(m => {
            config[m] = [...DEFAULT_MODULE_CONFIG[m]];
          });
        }
        if (browser) {
          localStorage.setItem('geomind-module-config', JSON.stringify(config));
        }
        return config;
      });
    }
  };
}

export const moduleConfig = createModuleConfigStore();

// ============================================
// MODULE ORDER CONFIGURATION (Drag & Drop)
// ============================================

// Ordre par défaut des modules
const DEFAULT_MODULE_ORDER: ModuleType[] = [
  'chat', 'canvas', 'cad', 'editor', 'databases', 'converter',
  'connexions', 'kdrive', 'intercapi', 'wakelock', 'timepro', 'comm', 'docgen',
  'settings', 'wip'
];

// Store pour l'ordre personnalisé des modules
function createModuleOrderStore() {
  const stored = browser ? localStorage.getItem('geomind-module-order') : null;
  let initial: ModuleType[] = stored ? JSON.parse(stored) : [...DEFAULT_MODULE_ORDER];

  // Ajouter les modules manquants (nouveaux modules ajoutés au code)
  const missingModules = DEFAULT_MODULE_ORDER.filter(m => !initial.includes(m));
  if (missingModules.length > 0) {
    initial = [...initial, ...missingModules];
    if (browser) {
      localStorage.setItem('geomind-module-order', JSON.stringify(initial));
    }
  }

  const { subscribe, set, update } = writable<ModuleType[]>(initial);

  return {
    subscribe,
    set: (order: ModuleType[]) => {
      if (browser) {
        localStorage.setItem('geomind-module-order', JSON.stringify(order));
      }
      set(order);
    },
    reorder: (fromIndex: number, toIndex: number) => {
      update(order => {
        const newOrder = [...order];
        const [moved] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, moved);
        if (browser) {
          localStorage.setItem('geomind-module-order', JSON.stringify(newOrder));
        }
        return newOrder;
      });
    },
    moveModule: (moduleId: ModuleType, direction: 'up' | 'down') => {
      update(order => {
        const index = order.indexOf(moduleId);
        if (index === -1) return order;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= order.length) return order;

        const newOrder = [...order];
        [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];

        if (browser) {
          localStorage.setItem('geomind-module-order', JSON.stringify(newOrder));
        }
        return newOrder;
      });
    },
    reset: () => {
      const defaultOrder = [...DEFAULT_MODULE_ORDER];
      if (browser) {
        localStorage.setItem('geomind-module-order', JSON.stringify(defaultOrder));
      }
      set(defaultOrder);
    }
  };
}

export const moduleOrder = createModuleOrderStore();

// Derived: liste des modules visibles selon le mode et la configuration (sans ordre)
const visibleModulesUnordered = derived([appMode, moduleConfig], ([$mode, $config]) => {
  // Modules qui doivent toujours être visibles (alwaysVisible: true)
  const alwaysVisibleModules = ALL_MODULES
    .filter(m => m.alwaysVisible)
    .map(m => m.id);

  if ($mode === 'standard') {
    // Mode standard: modules fixes + alwaysVisible
    return [...new Set([...STANDARD_MODULES, ...alwaysVisibleModules])];
  }
  // Modes expert/god/bfsa: utiliser la configuration personnalisée + alwaysVisible
  const configModules = $config[$mode] || DEFAULT_MODULE_CONFIG[$mode] || DEFAULT_MODULE_CONFIG.expert;
  return [...new Set([...configModules, ...alwaysVisibleModules])];
});

// Derived: liste des modules visibles ORDONNÉE selon les préférences utilisateur
export const visibleModules = derived(
  [visibleModulesUnordered, moduleOrder],
  ([$visible, $order]) => {
    // Trier les modules visibles selon l'ordre personnalisé
    const orderedVisible = $order.filter(id => $visible.includes(id));
    // Ajouter les modules visibles qui ne sont pas dans l'ordre (nouveaux modules)
    const remaining = $visible.filter(id => !$order.includes(id));
    return [...orderedVisible, ...remaining];
  }
);

// Derived: mode lecture seule pour le module Databases (true en mode standard)
export const databasesReadOnly = derived(appMode, ($mode) => {
  return $mode === 'standard';
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

// Mode BFSA - Bovard & Fritsché SA (thème corporate)
export const BFSA_ACTIVATION_PHRASES = [
  'mode bfsa',
  'bfsa mode',
  'bovard',
  'fritsche',
  'fritsché',
  'bovard et fritsche',
  'bovard & fritsche',
  'bfing',
  'mode géomètre',
  'mode geometre',
  'nyon',
  'route de saint-cergue'
];

export const BFSA_DEACTIVATION_PHRASES = [
  'exit bfsa',
  'quit bfsa',
  'sortir bfsa',
  'quitter bfsa',
  'mode expert',
  'retour expert',
  'back to expert'
];

// Type de changement de mode détecté
export type ModeChangeAction =
  | 'activate_expert'
  | 'activate_god'
  | 'activate_bfsa'
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

  // 2. Vérifier mode BFSA
  if (BFSA_ACTIVATION_PHRASES.some(phrase => normalized.includes(phrase))) {
    if (currentMode !== 'bfsa') {
      return 'activate_bfsa';
    }
    return null; // Déjà en mode BFSA
  }

  // 3. Vérifier désactivation depuis BFSA
  if (currentMode === 'bfsa') {
    if (BFSA_DEACTIVATION_PHRASES.some(phrase => normalized.includes(phrase))) {
      return 'deactivate_to_expert';
    }
  }

  // 4. Vérifier désactivation depuis God mode
  if (currentMode === 'god') {
    if (GOD_DEACTIVATION_PHRASES.some(phrase => normalized.includes(phrase))) {
      return 'deactivate_to_expert';
    }
    if (EXPERT_DEACTIVATION_PHRASES.some(phrase => normalized.includes(phrase))) {
      return 'deactivate_to_standard';
    }
  }

  // 5. Vérifier activation Expert
  if (EXPERT_ACTIVATION_PHRASES.some(phrase => normalized.includes(phrase))) {
    if (currentMode === 'standard') {
      return 'activate_expert';
    }
    return null; // Déjà en expert ou god ou bfsa
  }

  // 6. Vérifier désactivation Expert → Standard
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
export const currentProvider = writable<string>('groq');
export const currentModel = writable<string>('llama-3.3-70b-versatile');
export const providers = writable<Provider[]>([]);
export const backendConnected = writable(false);

// ============================================
// UNIFIED CHAT SYSTEM
// ============================================

export type ChatContextType = 'assistant' | 'editor' | 'map' | 'sql' | 'databases';

export interface ChatContext {
  type: ChatContextType;
  // Contexte spécifique selon le type
  editorContext?: {
    currentFile: string;
    language: string;
    selectedCode: string;
  };
  mapContext?: {
    availableLayers: string[];
    currentExtent: { minx: number; miny: number; maxx: number; maxy: number };
    activeLayers: string[];
  };
  sqlContext?: {
    currentConnection: string;
    schema: string;
    availableTables: string[];
  };
}

// Store pour le contexte de chat actif
export const chatContext = writable<ChatContext>({ type: 'assistant' });

// Helper pour mettre à jour le contexte
export function setChatContext(context: Partial<ChatContext> & { type: ChatContextType }) {
  chatContext.set(context as ChatContext);
}

// System prompts par type de contexte
export const CHAT_SYSTEM_PROMPTS: Record<ChatContextType, string> = {
  assistant: `Tu es GeoBrain, l'assistant spécialisé en géodonnées et SIT de la commune de Bussigny.
Tu maîtrises QGIS, PostgreSQL/PostGIS, Oracle Spatial, FME, Python/PyQGIS.
Référentiel: EPSG:2056 (MN95). Tu réponds en français, de manière technique et précise.`,

  editor: `Tu es l'assistant de code GeoMind, spécialisé en:
- SQL spatial (PostGIS, Oracle Spatial)
- Python/PyQGIS pour les scripts de géotraitement
- FME workbenches
- GeoJSON/JSON manipulation
- Scripts shell et automatisation
Tu fournis du code fonctionnel, bien commenté et optimisé. Tu réponds en français.`,

  map: `Tu es l'assistant cartographique GeoMind. Tu aides à:
- Naviguer sur la carte (zoom, pan, extent)
- Ajouter/retirer des couches
- Exécuter des requêtes spatiales
- Rechercher des adresses ou parcelles
Tu peux contrôler la carte via des actions JSON. Tu réponds en français.`,

  sql: `Tu es l'assistant SQL GeoMind, expert en:
- PostgreSQL/PostGIS (fonctions spatiales ST_*)
- Requêtes sur les données cadastrales (RF Vaud)
- Optimisation de requêtes
- Modélisation de données géospatiales
Tu génères des requêtes SQL optimisées et commentées. Tu réponds en français.`,

  databases: `Tu es l'assistant bases de données GeoMind, expert en:
- PostgreSQL/PostGIS et Oracle Spatial
- Modélisation de données territoriales
- Migration et synchronisation de données
- Documentation de schémas
Tu aides à gérer et comprendre les bases de données géospatiales. Tu réponds en français.`
};

// Fonction pour obtenir le system prompt complet avec contexte
export function getSystemPromptWithContext(context: ChatContext): string {
  let basePrompt = CHAT_SYSTEM_PROMPTS[context.type];

  if (context.type === 'editor' && context.editorContext) {
    const { currentFile, language, selectedCode } = context.editorContext;
    if (currentFile) basePrompt += `\n\nFichier actuel: ${currentFile}`;
    if (language && language !== 'plaintext') basePrompt += `\nLangage: ${language}`;
    if (selectedCode) basePrompt += `\n\nCode sélectionné:\n\`\`\`${language}\n${selectedCode}\n\`\`\``;
  }

  if (context.type === 'map' && context.mapContext) {
    const { availableLayers, activeLayers } = context.mapContext;
    basePrompt += `\n\nCouches disponibles: ${availableLayers.join(', ')}`;
    basePrompt += `\nCouches actives: ${activeLayers.join(', ')}`;
  }

  if (context.type === 'sql' && context.sqlContext) {
    const { currentConnection, schema, availableTables } = context.sqlContext;
    basePrompt += `\n\nConnexion: ${currentConnection}`;
    basePrompt += `\nSchéma: ${schema}`;
    basePrompt += `\nTables disponibles: ${availableTables.slice(0, 20).join(', ')}${availableTables.length > 20 ? '...' : ''}`;
  }

  return basePrompt;
}

// Helper pour ajouter un message
export function addMessage(message: Omit<Message, 'id' | 'timestamp'>) {
  messages.update(m => [...m, {
    ...message,
    id: crypto.randomUUID(),
    timestamp: new Date()
  }]);
}

// Helper pour effacer les messages
export function clearMessages() {
  messages.set([]);
}

// Editor state
export const currentFile = writable<string | null>(null);
export const editorContent = writable('');

// Canvas state
export const canvasLayers = writable<string[]>([]);

// Settings
export const settingsOpen = writable(false);

// ============================================
// GLITCH EFFECTS SYSTEM
// ============================================

export interface GlitchSettings {
  enabled: boolean;            // Glitchs activés
  frequency: number;           // 1-10, fréquence des glitchs
  intensity: number;           // 1-10, intensité des effets
  unlockedByEasterEgg: boolean; // Si débloqué par easter egg dans mode non-god
}

const defaultGlitchSettings: GlitchSettings = {
  enabled: true,              // Activé par défaut en god mode
  frequency: 5,               // Moyen
  intensity: 5,               // Moyen
  unlockedByEasterEgg: false
};

function createGlitchStore() {
  const stored = loadPreference<GlitchSettings>('geomind-glitch', defaultGlitchSettings);
  const { subscribe, set, update } = writable<GlitchSettings>(stored);

  return {
    subscribe,
    set: (value: GlitchSettings) => {
      savePreference('geomind-glitch', value);
      set(value);
    },
    toggle: () => {
      update(current => {
        const updated = { ...current, enabled: !current.enabled };
        savePreference('geomind-glitch', updated);
        return updated;
      });
    },
    setFrequency: (freq: number) => {
      update(current => {
        const updated = { ...current, frequency: Math.max(1, Math.min(10, freq)) };
        savePreference('geomind-glitch', updated);
        return updated;
      });
    },
    setIntensity: (intensity: number) => {
      update(current => {
        const updated = { ...current, intensity: Math.max(1, Math.min(10, intensity)) };
        savePreference('geomind-glitch', updated);
        return updated;
      });
    },
    unlockEasterEgg: () => {
      update(current => {
        const updated = { ...current, unlockedByEasterEgg: true, enabled: true };
        savePreference('geomind-glitch', updated);
        return updated;
      });
    },
    reset: () => {
      savePreference('geomind-glitch', defaultGlitchSettings);
      set(defaultGlitchSettings);
    }
  };
}

export const glitchSettings = createGlitchStore();

// Séquence Konami pour easter egg (haut, haut, bas, bas, gauche, droite, gauche, droite, b, a)
export const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

// Phrases easter egg pour activer les glitchs en mode non-god
// Doivent être dites à l'assistant
export const GLITCH_EASTER_EGG_PHRASES = [
  'there is no spoon',       // Matrix
  'il n\'y a pas de cuillère',
  'wake up neo',
  'follow the white rabbit',
  'suis le lapin blanc',
  'the matrix has you',
  'je vois la matrice',
  'red pill',                // Pilule rouge
  'pilule rouge',
  'hack the planet',         // Hackers
  'access mainframe',
  'sudo rm -rf reality',     // Blague geek
  'glitch in the matrix',
  'bug dans la matrice'
];

// Vérifier si un message contient une phrase easter egg glitch
export function checkGlitchEasterEgg(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return GLITCH_EASTER_EGG_PHRASES.some(phrase => normalized.includes(phrase));
}

// État dérivé: est-ce que les glitchs doivent s'afficher?
export const shouldShowGlitch = derived(
  [appMode, glitchSettings],
  ([$mode, $glitch]) => {
    // En god mode: selon les paramètres
    if ($mode === 'god') {
      return $glitch.enabled;
    }
    // En mode standard/expert: seulement si débloqué par easter egg ET activé
    return $glitch.unlockedByEasterEgg && $glitch.enabled;
  }
);

// ============================================
// GLOBAL WAKELOCK STORE
// ============================================
// Persiste entre les changements de module

export interface WakeLockState {
  isActive: boolean;
  activeTime: number;
  useSimulation: boolean;
  isSupported: boolean;
}

const defaultWakeLockState: WakeLockState = {
  isActive: false,
  activeTime: 0,
  useSimulation: false,
  isSupported: false
};

function createWakeLockStore() {
  let wakeLockRef: WakeLockSentinel | null = null;
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let simulationInterval: ReturnType<typeof setInterval> | null = null;

  const initial: WakeLockState = {
    ...defaultWakeLockState,
    useSimulation: loadPreference('geomind_wakelock_simulation', false)
  };

  const { subscribe, set, update } = writable<WakeLockState>(initial);

  // Initialize support check
  if (browser) {
    update(s => ({ ...s, isSupported: 'wakeLock' in navigator }));

    // Re-acquire on visibility change
    document.addEventListener('visibilitychange', async () => {
      let state: WakeLockState = defaultWakeLockState;
      const unsub = subscribe(s => state = s);
      unsub();

      if (document.visibilityState === 'visible' && state.isActive && !wakeLockRef && !state.useSimulation) {
        try {
          wakeLockRef = await navigator.wakeLock.request('screen');
        } catch {}
      }
    });
  }

  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      update(s => ({ ...s, activeTime: s.activeTime + 1 }));
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function startSimulation() {
    if (simulationInterval) return;
    simulationInterval = setInterval(() => {
      if (browser) {
        const event = new MouseEvent('mousemove', {
          bubbles: true, cancelable: true,
          clientX: Math.random() * window.innerWidth,
          clientY: Math.random() * window.innerHeight
        });
        document.dispatchEvent(event);
      }
    }, 30000);
  }

  function stopSimulation() {
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
  }

  return {
    subscribe,
    activate: async () => {
      let state: WakeLockState = defaultWakeLockState;
      const unsub = subscribe(s => state = s);
      unsub();

      if (state.isSupported && !state.useSimulation) {
        try {
          wakeLockRef = await navigator.wakeLock.request('screen');
          wakeLockRef.addEventListener('release', () => {
            // Will be re-acquired on visibility change if needed
          });
          update(s => ({ ...s, isActive: true }));
          startTimer();
        } catch {
          // Fallback to simulation
          update(s => ({ ...s, useSimulation: true }));
          savePreference('geomind_wakelock_simulation', true);
          startSimulation();
          update(s => ({ ...s, isActive: true }));
          startTimer();
        }
      } else {
        startSimulation();
        update(s => ({ ...s, isActive: true }));
        startTimer();
      }
    },
    deactivate: () => {
      if (wakeLockRef) {
        wakeLockRef.release();
        wakeLockRef = null;
      }
      stopSimulation();
      stopTimer();
      update(s => ({ ...s, isActive: false, activeTime: 0 }));
    },
    toggle: async () => {
      let state: WakeLockState = defaultWakeLockState;
      const unsub = subscribe(s => state = s);
      unsub();

      if (state.isActive) {
        if (wakeLockRef) {
          wakeLockRef.release();
          wakeLockRef = null;
        }
        stopSimulation();
        stopTimer();
        set({ ...state, isActive: false, activeTime: 0 });
      } else {
        if (state.isSupported && !state.useSimulation) {
          try {
            wakeLockRef = await navigator.wakeLock.request('screen');
            set({ ...state, isActive: true });
            startTimer();
          } catch {
            startSimulation();
            set({ ...state, isActive: true, useSimulation: true });
            savePreference('geomind_wakelock_simulation', true);
            startTimer();
          }
        } else {
          startSimulation();
          set({ ...state, isActive: true });
          startTimer();
        }
      }
    },
    toggleSimulation: () => {
      update(s => {
        const newUseSimulation = !s.useSimulation;
        savePreference('geomind_wakelock_simulation', newUseSimulation);
        return { ...s, useSimulation: newUseSimulation };
      });
    }
  };
}

export const wakeLockStore = createWakeLockStore();
