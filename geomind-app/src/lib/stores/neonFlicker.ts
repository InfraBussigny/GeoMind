import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { appMode } from './app';

// Types
export interface NeonFlickerSettings {
  enabled: boolean;
  intensity: 'low' | 'medium' | 'high' | 'extreme';
  speed: 'slow' | 'normal' | 'fast' | 'chaotic';
}

// Default settings
const defaultSettings: NeonFlickerSettings = {
  enabled: true,
  intensity: 'medium',
  speed: 'normal'
};

// Load from localStorage
function loadSettings(): NeonFlickerSettings {
  if (!browser) return defaultSettings;
  const saved = localStorage.getItem('geomind_neon_flicker');
  if (saved) {
    try {
      return { ...defaultSettings, ...JSON.parse(saved) };
    } catch {
      return defaultSettings;
    }
  }
  return defaultSettings;
}

// Store
export const neonFlickerSettings = writable<NeonFlickerSettings>(loadSettings());

// Save to localStorage on change
if (browser) {
  neonFlickerSettings.subscribe(settings => {
    localStorage.setItem('geomind_neon_flicker', JSON.stringify(settings));
  });
}

// Derived: is flicker active (only in BFSA mode and enabled)
export const isFlickerActive = derived(
  [neonFlickerSettings, appMode],
  ([$settings, $mode]) => $settings.enabled && $mode === 'bfsa'
);

// Timing configurations based on speed
// Clignotements rapides avec pauses de repos entre les séries
const speedConfigs = {
  slow: { flickerDelay: 150, flickerDuration: 120, restMin: 8000, restMax: 20000 },
  normal: { flickerDelay: 100, flickerDuration: 80, restMin: 3000, restMax: 15000 },
  fast: { flickerDelay: 60, flickerDuration: 50, restMin: 1500, restMax: 6000 },
  chaotic: { flickerDelay: 40, flickerDuration: 30, restMin: 500, restMax: 2000 }
};

// Intensity configurations - nombre de flickers par série
const intensityConfigs = {
  low: { maxFlickers: 2 },
  medium: { maxFlickers: 4 },
  high: { maxFlickers: 6 },
  extreme: { maxFlickers: 10 }
};

// Flicker controller class
class NeonFlickerController {
  private isRunning = false;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentTheme: 'bfsa' | 'bfsa-dark' = 'bfsa';

  start() {
    if (this.isRunning || !browser) return;
    this.isRunning = true;
    this.scheduleFlickerBurst();
    console.log('[NeonFlicker] Started');
  }

  stop() {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    // Reset to light theme
    this.setTheme('bfsa');
    console.log('[NeonFlicker] Stopped');
  }

  private setTheme(theme: 'bfsa' | 'bfsa-dark') {
    if (!browser) return;
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
  }

  private toggleTheme() {
    this.setTheme(this.currentTheme === 'bfsa' ? 'bfsa-dark' : 'bfsa');
  }

  // Programme une série de clignotements
  private scheduleFlickerBurst() {
    if (!this.isRunning) return;

    const settings = get(neonFlickerSettings);
    const speedConfig = speedConfigs[settings.speed];
    const intensityConfig = intensityConfigs[settings.intensity];

    // Nombre de clignotements dans cette série (selon l'intensité)
    const burstCount = 1 + Math.floor(Math.random() * intensityConfig.maxFlickers);

    // Exécuter la série de clignotements rapides
    this.doFlickerBurst(burstCount, speedConfig, () => {
      if (!this.isRunning) return;

      // Pause de repos entre 3-15 sec (selon la vitesse)
      const restDuration = speedConfig.restMin + Math.random() * (speedConfig.restMax - speedConfig.restMin);

      this.timeoutId = setTimeout(() => {
        this.scheduleFlickerBurst();
      }, restDuration);
    });
  }

  // Série de clignotements rapides
  private doFlickerBurst(count: number, config: typeof speedConfigs.normal, onComplete: () => void) {
    let i = 0;

    const flicker = () => {
      if (!this.isRunning) return;

      if (i >= count) {
        // S'assurer qu'on termine en mode clair
        if (this.currentTheme === 'bfsa-dark') {
          this.setTheme('bfsa');
        }
        onComplete();
        return;
      }

      // Passer en dark (néon éteint)
      this.setTheme('bfsa-dark');

      // Durée du flash sombre (irrégulière pour réalisme)
      const darkDuration = config.flickerDuration * (0.5 + Math.random());

      setTimeout(() => {
        if (!this.isRunning) return;

        // Revenir en clair (néon allumé)
        this.setTheme('bfsa');
        i++;

        // Petit délai avant le prochain flash (si pas le dernier)
        if (i < count) {
          const gap = config.flickerDelay * (0.3 + Math.random() * 0.7);
          setTimeout(flicker, gap);
        } else {
          onComplete();
        }
      }, darkDuration);
    };

    flicker();
  }
}

// Singleton controller
export const flickerController = new NeonFlickerController();

// Auto-start/stop based on active state
if (browser) {
  isFlickerActive.subscribe(active => {
    if (active) {
      flickerController.start();
    } else {
      flickerController.stop();
    }
  });
}
