<script lang="ts">
  import { onMount } from 'svelte';
  import { carloMode, isCarloModeActive, getRandomEffect, type CarloEffect } from '$lib/stores/carloMode';
  import CarloOverlay from './CarloOverlay.svelte';

  // Props
  export let onclick: () => void = () => {};
  export let isWobbly: boolean = false; // Ce bouton oscille-t-il?
  export let variant: 'normal' | 'nailed' | 'taped' = 'normal';

  // State
  let showOverlay = false;
  let overlayType: 'bsod' | 'loading' = 'bsod';
  let overlayDuration = 4000;

  // Rotation aleatoire legere (-3 a +3 degres)
  let rotation = 0;
  let nailPositions: { top?: string; left?: string; right?: string; bottom?: string; rotation: number }[] = [];

  onMount(() => {
    // Rotation aleatoire pour effet "mal monte"
    rotation = (Math.random() - 0.5) * 6;

    // Positions des clous (2-4 clous par bouton)
    const numNails = Math.floor(Math.random() * 3) + 2;
    const corners = [
      { top: '-4px', left: '-4px', rotation: Math.random() * 20 - 10 },
      { top: '-4px', right: '-4px', rotation: Math.random() * 20 - 10 },
      { bottom: '-4px', left: '-4px', rotation: Math.random() * 20 - 10 },
      { bottom: '-4px', right: '-4px', rotation: Math.random() * 20 - 10 }
    ];
    nailPositions = corners.slice(0, numNails);
  });

  // Gerer le clic avec potentiel effet Carlo
  function handleClick() {
    if (!$isCarloModeActive) {
      onclick();
      return;
    }

    const effect = getRandomEffect($carloMode, $isCarloModeActive);

    if (effect === 'none') {
      onclick();
    } else {
      // Afficher l'overlay
      overlayType = effect;
      overlayDuration = effect === 'bsod' ? 4000 : 6000;
      showOverlay = true;
    }
  }

  // Callback quand l'overlay est termine
  function onOverlayComplete() {
    showOverlay = false;
    onclick(); // Executer l'action originale
  }
</script>

<div
  class="carlo-button-wrapper"
  class:carlo-active={$isCarloModeActive}
  class:wobbly={isWobbly && $isCarloModeActive && $carloMode.visualChaos.wobblyButton}
  style="transform: rotate({$isCarloModeActive ? rotation : 0}deg)"
>
  <!-- Clous aux coins -->
  {#if $isCarloModeActive && $carloMode.visualChaos.nails && variant !== 'taped'}
    {#each nailPositions as nail}
      <div
        class="nail"
        style="
          {nail.top ? `top: ${nail.top};` : ''}
          {nail.bottom ? `bottom: ${nail.bottom};` : ''}
          {nail.left ? `left: ${nail.left};` : ''}
          {nail.right ? `right: ${nail.right};` : ''}
          transform: rotate({nail.rotation}deg);
        "
      >
        <svg viewBox="0 0 16 24" width="10" height="15">
          <circle cx="8" cy="4" r="4" fill="#8B8B8B"/>
          <rect x="6" y="4" width="4" height="18" fill="#666"/>
          <ellipse cx="8" cy="22" rx="2" ry="1" fill="#444"/>
        </svg>
      </div>
    {/each}
  {/if}

  <!-- Scotch -->
  {#if $isCarloModeActive && $carloMode.visualChaos.tape && variant === 'taped'}
    <div class="tape tape-horizontal"></div>
  {/if}

  <!-- Slot pour le contenu du bouton -->
  <div class="button-content" on:click={handleClick} on:keydown={(e) => e.key === 'Enter' && handleClick()} role="button" tabindex="0">
    <slot />
  </div>

  <!-- Texture usee -->
  {#if $isCarloModeActive && $carloMode.visualChaos.wornTextures}
    <div class="worn-overlay"></div>
  {/if}
</div>

<!-- Overlay BSOD ou Loading -->
{#if showOverlay}
  <CarloOverlay
    type={overlayType}
    duration={overlayDuration}
    onComplete={onOverlayComplete}
  />
{/if}

<style>
  .carlo-button-wrapper {
    position: relative;
    display: inline-block;
    transition: transform 0.3s ease;
  }

  .carlo-active {
    /* Effet subtil de vieillissement */
    filter: sepia(0.05) contrast(0.98);
  }

  .button-content {
    position: relative;
    z-index: 1;
    cursor: pointer;
  }

  /* Animation oscillante pour un bouton */
  .wobbly {
    animation: wobble 2.5s ease-in-out infinite;
    transform-origin: top left;
  }

  @keyframes wobble {
    0%, 100% { transform: rotate(-4deg); }
    50% { transform: rotate(4deg); }
  }

  /* Clou SVG */
  .nail {
    position: absolute;
    z-index: 10;
    pointer-events: none;
    filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.4));
  }

  /* Scotch */
  .tape {
    position: absolute;
    z-index: 5;
    pointer-events: none;
  }

  .tape-horizontal {
    top: 50%;
    left: -10px;
    right: -10px;
    height: 18px;
    transform: translateY(-50%) rotate(-2deg);
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(255, 235, 180, 0.6) 10%,
      rgba(255, 235, 180, 0.7) 50%,
      rgba(255, 235, 180, 0.6) 90%,
      transparent 100%
    );
    border-radius: 2px;
  }

  /* Texture usee */
  .worn-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 2;
    background:
      radial-gradient(circle at 20% 30%, rgba(139, 90, 43, 0.05) 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(139, 90, 43, 0.03) 0%, transparent 40%);
    mix-blend-mode: multiply;
  }
</style>
