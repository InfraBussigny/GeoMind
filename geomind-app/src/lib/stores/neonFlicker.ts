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
const speedConfigs = {
  slow: { minDelay: 3000, maxDelay: 8000, flickerDuration: 150 },
  normal: { minDelay: 1500, maxDelay: 5000, flickerDuration: 100 },
  fast: { minDelay: 500, maxDelay: 2000, flickerDuration: 60 },
  chaotic: { minDelay: 100, maxDelay: 800, flickerDuration: 30 }
};

// Intensity configurations (probability of multi-flicker)
const intensityConfigs = {
  low: { multiFlickerChance: 0.1, maxFlickers: 2 },
  medium: { multiFlickerChance: 0.3, maxFlickers: 4 },
  high: { multiFlickerChance: 0.5, maxFlickers: 6 },
  extreme: { multiFlickerChance: 0.7, maxFlickers: 10 }
};

// Flicker controller class
class NeonFlickerController {
  private isRunning = false;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentTheme: 'bfsa' | 'bfsa-dark' = 'bfsa';

  start() {
    if (this.isRunning || !browser) return;
    this.isRunning = true;
    this.scheduleNextFlicker();
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

  private scheduleNextFlicker() {
    if (!this.isRunning) return;

    const settings = get(neonFlickerSettings);
    const speedConfig = speedConfigs[settings.speed];
    const intensityConfig = intensityConfigs[settings.intensity];

    // Random delay before next flicker event
    const delay = speedConfig.minDelay + Math.random() * (speedConfig.maxDelay - speedConfig.minDelay);

    this.timeoutId = setTimeout(() => {
      if (!this.isRunning) return;

      // Decide if we do a single flicker or multiple rapid flickers
      const doMultiFlicker = Math.random() < intensityConfig.multiFlickerChance;

      if (doMultiFlicker) {
        // Multiple rapid flickers (like a dying neon)
        const flickerCount = 2 + Math.floor(Math.random() * (intensityConfig.maxFlickers - 1));
        this.doRapidFlickers(flickerCount, speedConfig.flickerDuration);
      } else {
        // Single flicker
        this.doSingleFlicker(speedConfig.flickerDuration);
      }

      // Schedule next flicker event
      this.scheduleNextFlicker();
    }, delay);
  }

  private doSingleFlicker(duration: number) {
    this.toggleTheme();
    setTimeout(() => {
      if (this.isRunning) this.toggleTheme();
    }, duration + Math.random() * duration);
  }

  private doRapidFlickers(count: number, baseDuration: number) {
    let i = 0;
    const flicker = () => {
      if (!this.isRunning || i >= count) return;
      this.toggleTheme();
      i++;
      // Irregular timing for realistic effect
      const nextDelay = baseDuration * (0.5 + Math.random());
      setTimeout(flicker, nextDelay);
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
