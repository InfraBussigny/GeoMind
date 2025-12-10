<script lang="ts">
  import '$lib/styles/theme.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import StatusBar from '$lib/components/StatusBar/StatusBar.svelte';
  import { theme, appMode } from '$lib/stores/app';
  import { browser } from '$app/environment';

  let { children } = $props();

  // Appliquer le thème au document
  $effect(() => {
    if (browser) {
      document.documentElement.setAttribute('data-theme', $theme);
    }
  });

  // Basculer automatiquement en mode sombre lors de l'activation du mode expert
  $effect(() => {
    if (browser && $appMode === 'expert') {
      // Ne basculer que si on vient d'activer le mode expert
      const wasStandard = localStorage.getItem('geobrain-previous-mode') !== 'expert';
      if (wasStandard) {
        theme.set('dark');
      }
      localStorage.setItem('geobrain-previous-mode', 'expert');
    } else if (browser) {
      localStorage.setItem('geobrain-previous-mode', 'standard');
    }
  });
</script>

<svelte:head>
  <title>GeoBrain - Bussigny SIT</title>
</svelte:head>

<div class="app-container" data-mode={$appMode}>
  <Sidebar />
  <div class="main-wrapper">
    <main class="main-content">
      {@render children()}
    </main>
    <StatusBar currentProject="GeoBrain Bussigny" />
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
