<script lang="ts">
  import '$lib/styles/theme.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import StatusBar from '$lib/components/StatusBar/StatusBar.svelte';
  import GlitchEngine from '$lib/components/GlitchEngine.svelte';
  import { theme, appMode } from '$lib/stores/app';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { initializeMemory } from '$lib/services/memory';

  // Initialiser le système de mémoire au montage
  onMount(() => {
    initializeMemory();
  });

  let { children } = $props();

  // Appliquer le thème au document
  $effect(() => {
    if (browser) {
      document.documentElement.setAttribute('data-theme', $theme);
    }
  });

  // Synchronisation automatique : chaque mode a son thème associé
  // standard → light, expert → dark, god → god, bfsa → bfsa
  $effect(() => {
    if (!browser) return;

    const modeToTheme = {
      standard: 'light',
      expert: 'dark',
      god: 'god',
      bfsa: 'bfsa'
    } as const;

    const expectedTheme = modeToTheme[$appMode];

    // Forcer le thème associé au mode
    if ($theme !== expectedTheme) {
      theme.set(expectedTheme);
    }
  });
</script>

<svelte:head>
  <title>{$appMode === 'bfsa' ? 'GeoBFSA - Nyon' : 'GeoMind - Spatial Intelligence'}</title>
</svelte:head>

<!-- Moteur de glitch pour le God Mode -->
<GlitchEngine />

<div class="app-container" data-mode={$appMode}>
  <Sidebar />
  <div class="main-wrapper">
    <main class="main-content">
      {@render children()}
    </main>
    <StatusBar currentProject={$appMode === 'bfsa' ? 'GeoBFSA Nyon' : 'GeoMind Bussigny'} />
  </div>
</div>

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
</style>
