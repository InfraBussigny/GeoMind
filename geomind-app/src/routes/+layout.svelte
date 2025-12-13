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
    <StatusBar currentProject={$appMode === 'bfsa' ? 'GeoBFSA Nyon' : 'GeoMind'} />
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
