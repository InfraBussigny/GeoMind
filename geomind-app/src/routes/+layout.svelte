<script lang="ts">
  import '$lib/styles/theme.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import StatusBar from '$lib/components/StatusBar/StatusBar.svelte';
  import GlitchEngine from '$lib/components/GlitchEngine.svelte';
  import { CarloProvider } from '$lib/components/Carlo';
  import { theme, appMode, type AppMode } from '$lib/stores/app';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { initializeMemory } from '$lib/services/memory';

  // Mode switcher modal state
  let showModeSwitcher = $state(false);

  // Mode cycling order
  const MODE_ORDER: AppMode[] = ['standard', 'expert', 'god', 'bfsa'];

  // Keyboard shortcut handler
  function handleKeydown(e: KeyboardEvent) {
    // Ctrl+Shift+M to open mode switcher
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      showModeSwitcher = !showModeSwitcher;
      return;
    }

    // When modal is open, handle key presses
    if (showModeSwitcher) {
      // Number keys 1-4 to select mode directly
      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        selectMode(MODE_ORDER[index]);
        return;
      }

      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        showModeSwitcher = false;
        return;
      }

      // Arrow keys to navigate
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        cycleMode(1);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        cycleMode(-1);
        return;
      }

      // Enter to confirm and close
      if (e.key === 'Enter') {
        e.preventDefault();
        showModeSwitcher = false;
        return;
      }
    }
  }

  function cycleMode(direction: number) {
    const currentIndex = MODE_ORDER.indexOf($appMode);
    const newIndex = (currentIndex + direction + MODE_ORDER.length) % MODE_ORDER.length;
    selectMode(MODE_ORDER[newIndex]);
  }

  function selectMode(mode: AppMode) {
    switch (mode) {
      case 'standard':
        appMode.deactivateToStandard();
        break;
      case 'expert':
        appMode.activateExpert();
        break;
      case 'god':
        appMode.activateGod();
        break;
      case 'bfsa':
        appMode.activateBfsa();
        break;
    }
  }

  function getModeInfo(mode: AppMode) {
    const info: Record<AppMode, { icon: string; name: string; key: string }> = {
      standard: { icon: '🔒', name: 'Standard', key: '1' },
      expert: { icon: '⚡', name: 'Expert', key: '2' },
      god: { icon: '👑', name: 'God', key: '3' },
      bfsa: { icon: '🔧', name: 'BFK', key: '4' }
    };
    return info[mode];
  }

  // Initialiser le système de mémoire au montage
  onMount(() => {
    initializeMemory();
    if (browser) {
      window.addEventListener('keydown', handleKeydown);
    }
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('keydown', handleKeydown);
    }
  });

  let { children } = $props();

  // Appliquer le thème au document
  $effect(() => {
    if (browser) {
      document.documentElement.setAttribute('data-theme', $theme);
    }
  });

  // Synchronisation du thème avec le mode app
  // - god et bfsa ont des thèmes fixes (god, bfsa)
  // - standard et expert permettent de choisir light ou dark
  let previousMode: string | null = null;

  $effect(() => {
    if (!browser) return;

    const currentMode = $appMode;

    // God et BFSA ont des thèmes fixes
    if (currentMode === 'god' && $theme !== 'god') {
      theme.set('god');
    } else if (currentMode === 'bfsa' && $theme !== 'bfsa') {
      theme.set('bfsa');
    }
    // Pour standard et expert, on définit le thème par défaut uniquement lors du changement de mode
    else if (previousMode !== currentMode) {
      if (currentMode === 'standard' && $theme !== 'light' && $theme !== 'dark') {
        theme.set('light');
      } else if (currentMode === 'expert' && $theme !== 'light' && $theme !== 'dark') {
        theme.set('dark');
      }
      // Si le thème était god ou bfsa, on le reset au thème par défaut du mode
      if ($theme === 'god' || $theme === 'bfsa') {
        theme.set(currentMode === 'standard' ? 'light' : 'dark');
      }
    }

    previousMode = currentMode;
  });
</script>

<svelte:head>
  <title>{$appMode === 'bfsa' ? 'GeoBFK - Carlo Perono Edition' : 'GeoMind - Spatial Intelligence'}</title>
</svelte:head>

<!-- Moteur de glitch pour le God Mode -->
<GlitchEngine />

<!-- Mode Switcher Modal (Ctrl+Shift+M) -->
{#if showModeSwitcher}
  <div class="mode-switcher-overlay" onclick={() => showModeSwitcher = false}>
    <div class="mode-switcher-modal" onclick={(e) => e.stopPropagation()}>
      <div class="mode-switcher-header">
        <span class="mode-switcher-title">Changer de mode</span>
        <span class="mode-switcher-hint">Appuyez sur 1-4 ou utilisez les flèches</span>
      </div>
      <div class="mode-switcher-options">
        {#each MODE_ORDER as mode}
          {@const info = getModeInfo(mode)}
          <button
            class="mode-switcher-option"
            class:active={$appMode === mode}
            onclick={() => { selectMode(mode); showModeSwitcher = false; }}
          >
            <span class="mode-switcher-key">{info.key}</span>
            <span class="mode-switcher-icon">{info.icon}</span>
            <span class="mode-switcher-name">{info.name}</span>
            {#if $appMode === mode}
              <span class="mode-switcher-check">✓</span>
            {/if}
          </button>
        {/each}
      </div>
      <div class="mode-switcher-footer">
        <kbd>Esc</kbd> fermer · <kbd>←</kbd><kbd>→</kbd> naviguer · <kbd>Enter</kbd> confirmer
      </div>
    </div>
  </div>
{/if}

<!-- Provider Carlo pour le mode BFSA -->
<CarloProvider>
  <div class="app-container" data-mode={$appMode}>
    <Sidebar />
    <div class="main-wrapper">
      <main class="main-content">
        {@render children()}
      </main>
      <StatusBar currentProject={$appMode === 'bfsa' ? 'GeoBFK - Carlo IT Solutions' : 'GeoMind'} />
    </div>
  </div>
</CarloProvider>

<style>
  .app-container {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  .main-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    overflow: auto;
    background: var(--bg-secondary);
  }

  /* Mode Switcher Modal */
  .mode-switcher-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .mode-switcher-modal {
    background: var(--noir-card, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    padding: 20px;
    min-width: 400px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.15s ease-out;
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .mode-switcher-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .mode-switcher-title {
    font-family: var(--font-mono, monospace);
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .mode-switcher-hint {
    font-size: 12px;
    color: var(--text-muted, #666);
  }

  .mode-switcher-options {
    display: flex;
    gap: 8px;
  }

  .mode-switcher-option {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 12px;
    background: var(--noir-surface, #252525);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .mode-switcher-option:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--text-muted, #666);
  }

  .mode-switcher-option.active {
    background: rgba(0, 255, 136, 0.1);
    border-color: var(--cyber-green, #00ff88);
  }

  .mode-switcher-key {
    position: absolute;
    top: 6px;
    left: 6px;
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    color: var(--text-muted, #666);
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .mode-switcher-icon {
    font-size: 24px;
  }

  .mode-switcher-name {
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .mode-switcher-option.active .mode-switcher-name {
    color: var(--cyber-green, #00ff88);
  }

  .mode-switcher-check {
    position: absolute;
    top: 6px;
    right: 6px;
    font-size: 12px;
    color: var(--cyber-green, #00ff88);
  }

  .mode-switcher-footer {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color, #333);
    font-size: 11px;
    color: var(--text-muted, #666);
    text-align: center;
    font-family: var(--font-mono, monospace);
  }

  .mode-switcher-footer kbd {
    display: inline-block;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    font-size: 10px;
    margin: 0 2px;
  }
</style>
