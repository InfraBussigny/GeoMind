/**
 * Store de configuration du mode Carlo Perono
 * Mode BFSA = Mode Carlo automatiquement actif
 * Interface "bricolee" par un informaticien incompetent
 */
import { writable, derived, get } from 'svelte/store';
import { appMode } from './app';

// Configuration des effets visuels
export interface VisualChaosConfig {
  nails: boolean;           // Clous visibles aux coins
  tape: boolean;            // Scotch sur les elements
  wornTextures: boolean;    // Textures usees
  hangingWires: boolean;    // Fils qui pendent
  sparks: boolean;          // Etincelles aleatoires
  wobblyButton: boolean;    // Un bouton qui oscille
}

// Configuration complete du mode Carlo (sans 'enabled' qui vient de appMode)
export interface CarloModeConfig {
  chaosLevel: number;        // 1-10
  soundEnabled: boolean;
  bsodChance: number;        // % de chance BSOD au clic (0-100)
  infiniteLoadChance: number; // % de chance loading infini (0-100)
  visualChaos: VisualChaosConfig;
}

// Configuration par defaut
const DEFAULT_CONFIG: CarloModeConfig = {
  chaosLevel: 5,
  soundEnabled: false,
  bsodChance: 30,
  infiniteLoadChance: 20,
  visualChaos: {
    nails: true,
    tape: true,
    wornTextures: true,
    hangingWires: false,
    sparks: false,
    wobblyButton: true
  }
};

const STORAGE_KEY = 'geomind-carlo-config';

// Charger la config depuis localStorage
function loadConfig(): CarloModeConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<CarloModeConfig>;
      // Merger avec les defauts pour les nouvelles options
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        visualChaos: {
          ...DEFAULT_CONFIG.visualChaos,
          ...(parsed.visualChaos || {})
        }
      };
    }
  } catch (e) {
    console.warn('Failed to load Carlo mode config:', e);
  }
  return DEFAULT_CONFIG;
}

// Sauvegarder la config
function saveConfig(config: CarloModeConfig) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save Carlo mode config:', e);
  }
}

// Creer le store pour la configuration (sans le toggle enabled)
function createCarloConfigStore() {
  const { subscribe, set, update } = writable<CarloModeConfig>(loadConfig());

  return {
    subscribe,

    // Definir le niveau de chaos (1-10)
    setChaosLevel: (level: number) => {
      update(config => {
        const clampedLevel = Math.max(1, Math.min(10, level));
        // Ajuster les chances selon le niveau
        const updated = {
          ...config,
          chaosLevel: clampedLevel,
          bsodChance: calculateBsodChance(clampedLevel),
          infiniteLoadChance: calculateLoadingChance(clampedLevel),
          visualChaos: calculateVisualChaos(clampedLevel, config.visualChaos)
        };
        saveConfig(updated);
        return updated;
      });
    },

    // Toggle son
    toggleSound: () => {
      update(config => {
        const updated = { ...config, soundEnabled: !config.soundEnabled };
        saveConfig(updated);
        return updated;
      });
    },

    // Toggle un effet visuel specifique
    toggleVisualEffect: (effect: keyof VisualChaosConfig) => {
      update(config => {
        const updated = {
          ...config,
          visualChaos: {
            ...config.visualChaos,
            [effect]: !config.visualChaos[effect]
          }
        };
        saveConfig(updated);
        return updated;
      });
    },

    // Reset aux valeurs par defaut
    reset: () => {
      set(DEFAULT_CONFIG);
      saveConfig(DEFAULT_CONFIG);
    },

    // Obtenir la config actuelle (synchrone)
    getConfig: () => get({ subscribe })
  };
}

// Calculer la chance de BSOD selon le niveau
function calculateBsodChance(level: number): number {
  if (level <= 3) return 10;
  if (level <= 6) return 30;
  if (level <= 9) return 50;
  return 70; // niveau 10
}

// Calculer la chance de loading infini selon le niveau
function calculateLoadingChance(level: number): number {
  if (level <= 3) return 5;
  if (level <= 6) return 20;
  if (level <= 9) return 30;
  return 40; // niveau 10
}

// Calculer les effets visuels actifs selon le niveau
function calculateVisualChaos(level: number, current: VisualChaosConfig): VisualChaosConfig {
  return {
    nails: level >= 1,           // toujours actif
    tape: level >= 4,            // a partir du niveau 4
    wornTextures: level >= 4,    // a partir du niveau 4
    hangingWires: level >= 7,    // a partir du niveau 7
    sparks: level >= 10,         // seulement niveau 10
    wobblyButton: level >= 1     // toujours actif
  };
}

// Export du store de configuration
export const carloConfig = createCarloConfigStore();

// Store derive: mode Carlo actif? (lie au mode BFSA de l'app)
export const isCarloModeActive = derived(appMode, $mode => $mode === 'bfsa');

// Store derive: niveau de chaos
export const chaosLevel = derived(carloConfig, $config => $config.chaosLevel);

// Store combine pour faciliter l'acces (config + enabled)
export const carloMode = derived(
  [carloConfig, isCarloModeActive],
  ([$config, $isActive]) => ({
    ...$config,
    enabled: $isActive
  })
);

// Fonction utilitaire: declencher un effet aleatoire selon les chances
export function shouldTriggerBsod(config: CarloModeConfig, isActive: boolean): boolean {
  if (!isActive) return false;
  return Math.random() * 100 < config.bsodChance;
}

export function shouldTriggerLoading(config: CarloModeConfig, isActive: boolean): boolean {
  if (!isActive) return false;
  return Math.random() * 100 < config.infiniteLoadChance;
}

// Fonction pour obtenir un effet aleatoire (BSOD, loading, ou rien)
export type CarloEffect = 'bsod' | 'loading' | 'none';

export function getRandomEffect(config: CarloModeConfig, isActive: boolean): CarloEffect {
  if (!isActive) return 'none';

  const roll = Math.random() * 100;

  if (roll < config.bsodChance) {
    return 'bsod';
  } else if (roll < config.bsodChance + config.infiniteLoadChance) {
    return 'loading';
  }

  return 'none';
}

// Re-export pour compatibilite avec les anciens imports
export { appMode };
