<script lang="ts">
  import { theme, appMode, type ThemeMode } from '$lib/stores/app';

  // Cycle de thèmes selon le mode
  function toggleTheme() {
    const currentTheme = $theme;
    const currentMode = $appMode;

    // En God mode ou BFSA, on ne permet pas de changer le thème via le toggle
    if (currentMode === 'god' || currentMode === 'bfsa') {
      return;
    }

    // Cycle normal: light -> dark -> light
    if (currentTheme === 'light') {
      theme.set('dark');
    } else {
      theme.set('light');
    }
  }

  // Tooltip dynamique
  function getTooltip(t: ThemeMode, m: string): string {
    if (m === 'god') return 'Thème God mode actif';
    if (m === 'bfsa') return 'Theme BFK - Perono Edition';
    return t === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair';
  }
</script>

<button
  class="theme-toggle"
  class:expert={$appMode === 'expert'}
  class:god={$appMode === 'god'}
  class:bfsa={$appMode === 'bfsa'}
  onclick={toggleTheme}
  title={getTooltip($theme, $appMode)}
  disabled={$appMode === 'god' || $appMode === 'bfsa'}
>
  {#if $appMode === 'bfsa'}
    <!-- Icône BFSA - compas géomètre -->
    <svg class="icon bfsa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 3v18M3 12h18"/>
      <circle cx="12" cy="12" r="3" fill="currentColor"/>
    </svg>
  {:else if $theme === 'god' || $appMode === 'god'}
    <!-- Icône God mode - crâne/skull stylisé -->
    <svg class="icon god-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="10" r="7"/>
      <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="9" r="1.5" fill="currentColor"/>
      <path d="M8 13 L10 15 L12 13 L14 15 L16 13"/>
      <path d="M9 17 L9 20 M12 17 L12 21 M15 17 L15 20"/>
    </svg>
  {:else if $theme === 'light'}
    <!-- Icône soleil -->
    <svg class="icon sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  {:else}
    <!-- Icône lune -->
    <svg class="icon moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  {/if}
</button>

<style>
  .theme-toggle {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    color: var(--text-secondary);
  }

  .theme-toggle:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--primary);
    border-color: var(--primary);
  }

  .theme-toggle.expert:hover:not(:disabled) {
    box-shadow: 0 0 10px var(--primary-glow);
  }

  .theme-toggle.god {
    background: linear-gradient(135deg, rgba(0, 255, 255, 0.15), rgba(255, 0, 255, 0.15));
    border-color: #FF00FF;
    cursor: not-allowed;
    animation: god-toggle-pulse 2s ease-in-out infinite;
  }

  .theme-toggle:disabled {
    opacity: 0.9;
  }

  @keyframes god-toggle-pulse {
    0%, 100% {
      box-shadow: 0 0 5px rgba(0, 255, 255, 0.3);
    }
    50% {
      box-shadow: 0 0 15px rgba(255, 0, 255, 0.5), 0 0 25px rgba(0, 255, 255, 0.3);
    }
  }

  .icon {
    width: 18px;
    height: 18px;
    transition: transform var(--transition-fast);
  }

  .theme-toggle:hover:not(:disabled) .icon {
    transform: rotate(15deg);
  }

  .sun {
    color: var(--warning);
  }

  .moon {
    color: var(--accent-cyan);
  }

  .god-icon {
    color: #FF00FF;
    animation: god-icon-glow 1.5s ease-in-out infinite;
  }

  .bfsa-icon {
    color: #e30613;
  }

  .theme-toggle.bfsa {
    background: linear-gradient(135deg, rgba(227, 6, 19, 0.1), rgba(24, 99, 220, 0.1));
    border-color: #e30613;
    cursor: not-allowed;
  }

  @keyframes god-icon-glow {
    0%, 100% {
      filter: drop-shadow(0 0 2px rgba(255, 0, 255, 0.5));
    }
    33% {
      filter: drop-shadow(0 0 8px rgba(0, 255, 255, 0.8));
    }
    66% {
      filter: drop-shadow(0 0 8px rgba(255, 0, 255, 0.8)) drop-shadow(0 0 12px rgba(255, 255, 0, 0.5));
    }
  }
</style>
