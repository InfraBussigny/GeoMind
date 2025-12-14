<script lang="ts">
  import { onMount } from 'svelte';
  import { carloMode, isCarloModeActive } from '$lib/stores/carloMode';
  import CarloSparks from './CarloSparks.svelte';
  import CarloTeamsNotification from './CarloTeamsNotification.svelte';
  import { getRandomWelcome, getRandomGoodbye } from './carloMessages';

  // State pour le message toast
  let showToast = false;
  let toastMessage = '';
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  // Garder trace de l'etat precedent pour detecter les changements
  let wasCarloActive = false;

  // Observer les changements du mode BFSA/Carlo
  $: if ($isCarloModeActive !== wasCarloActive) {
    if ($isCarloModeActive && !wasCarloActive) {
      // Activation (passage en mode BFSA)
      showCarloToast(getRandomWelcome());
    } else if (!$isCarloModeActive && wasCarloActive) {
      // Desactivation (sortie du mode BFSA)
      showCarloToast(getRandomGoodbye());
    }
    wasCarloActive = $isCarloModeActive;
  }

  function showCarloToast(message: string) {
    toastMessage = message;
    showToast = true;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      showToast = false;
    }, 4000);
  }

  onMount(() => {
    wasCarloActive = $isCarloModeActive;
  });
</script>

<!-- Classes globales pour le mode Carlo -->
<div
  class="carlo-root"
  class:carlo-active={$isCarloModeActive}
  class:carlo-level-low={$isCarloModeActive && $carloMode.chaosLevel <= 3}
  class:carlo-level-mid={$isCarloModeActive && $carloMode.chaosLevel > 3 && $carloMode.chaosLevel <= 6}
  class:carlo-level-high={$isCarloModeActive && $carloMode.chaosLevel > 6 && $carloMode.chaosLevel <= 9}
  class:carlo-level-max={$isCarloModeActive && $carloMode.chaosLevel === 10}
>
  <slot />

  <!-- Etincelles (niveau max seulement) -->
  {#if $isCarloModeActive && $carloMode.visualChaos.sparks}
    <CarloSparks active={true} intensity={$carloMode.chaosLevel} />
  {/if}

  <!-- Notifications Teams de Carlo -->
  {#if $isCarloModeActive}
    <CarloTeamsNotification />
  {/if}

  <!-- Toast de message Carlo -->
  {#if showToast}
    <div class="carlo-toast" class:show={showToast}>
      <div class="carlo-toast-icon">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
          <line x1="9" y1="9" x2="9.01" y2="9"/>
          <line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
      </div>
      <div class="carlo-toast-content">
        <span class="carlo-toast-name">Carlo Perono</span>
        <p class="carlo-toast-message">{toastMessage}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .carlo-root {
    width: 100%;
    height: 100%;
    position: relative;
  }

  /* Effet global de vieillissement progressif */
  .carlo-active {
    --carlo-sepia: 0.03;
    --carlo-contrast: 0.99;
  }

  .carlo-level-mid {
    --carlo-sepia: 0.06;
    --carlo-contrast: 0.97;
  }

  .carlo-level-high {
    --carlo-sepia: 0.08;
    --carlo-contrast: 0.96;
  }

  .carlo-level-max {
    --carlo-sepia: 0.1;
    --carlo-contrast: 0.95;
  }

  .carlo-active :global(.sidebar),
  .carlo-active :global(.main-content) {
    filter: sepia(var(--carlo-sepia, 0)) contrast(var(--carlo-contrast, 1));
  }

  /* Toast Carlo */
  .carlo-toast {
    position: fixed;
    bottom: 20px;
    left: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 2px solid #ff6b6b;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(255, 107, 107, 0.3);
    z-index: 10000;
    transform: translateX(-120%);
    transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    max-width: 350px;
  }

  .carlo-toast.show {
    transform: translateX(0);
  }

  .carlo-toast-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    background: #ff6b6b;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .carlo-toast-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .carlo-toast-name {
    font-size: 14px;
    font-weight: 700;
    color: #ff6b6b;
    font-family: var(--font-mono, monospace);
  }

  .carlo-toast-message {
    font-size: 13px;
    color: white;
    margin: 0;
    line-height: 1.4;
  }
</style>
