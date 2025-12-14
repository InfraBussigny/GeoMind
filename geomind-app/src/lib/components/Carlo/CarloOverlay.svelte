<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import {
    getRandomBsodError,
    getRandomBsodQuote,
    getRandomLoadingMessage,
    generateBsodCode,
    generateMemoryAddress
  } from './carloMessages';

  // Props
  export let type: 'bsod' | 'loading' = 'bsod';
  export let duration: number = 10000; // ms avant fermeture auto (10s par defaut)
  export let onComplete: () => void = () => {};

  // State
  let progress = 0;
  let bsodError = '';
  let bsodQuote = '';
  let bsodCode = '';
  let memoryAddress = '';
  let loadingMessage = '';
  let progressInterval: ReturnType<typeof setInterval> | null = null;
  let closeTimeout: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    if (type === 'bsod') {
      // Generer les messages BSOD
      bsodError = getRandomBsodError();
      bsodQuote = getRandomBsodQuote();
      bsodCode = generateBsodCode();
      memoryAddress = generateMemoryAddress();

      // Simuler une progression de collecte d'erreur (lente pour laisser lire)
      progress = 0;
      progressInterval = setInterval(() => {
        // Progression lente et erratique typique de Carlo
        const increment = Math.random() * 5 + 1; // Entre 1% et 6%
        progress += increment;

        // Parfois ça recule un peu (bug Carlo)
        if (Math.random() < 0.08) {
          progress -= Math.random() * 3;
        }

        if (progress >= 100) {
          progress = 100;
          if (progressInterval) clearInterval(progressInterval);
        }
      }, 500);

      // Fermer apres le delai
      closeTimeout = setTimeout(() => {
        onComplete();
      }, duration);

    } else if (type === 'loading') {
      // Loading infini (mais pas vraiment)
      loadingMessage = getRandomLoadingMessage();
      progress = 0;

      // Progression tres lente qui n'atteint jamais 100%
      let messageCounter = 0;
      progressInterval = setInterval(() => {
        // Progression qui ralentit asymptotiquement
        const remaining = 95 - progress;
        progress += remaining * 0.008; // Plus lent

        // Parfois ça bloque ou recule (classique Carlo)
        if (Math.random() < 0.05) {
          progress -= Math.random() * 2;
          if (progress < 0) progress = 0;
        }

        messageCounter++;
        // Changer le message toutes les ~3 secondes pour laisser lire
        if (messageCounter % 6 === 0) {
          loadingMessage = getRandomLoadingMessage();
        }
      }, 500);

      // Mais on finit quand meme par fermer
      closeTimeout = setTimeout(() => {
        progress = 100;
        loadingMessage = "C'est bon, ça devrait marcher maintenant...";
        setTimeout(() => onComplete(), 1500);
      }, duration);
    }
  });

  onDestroy(() => {
    if (progressInterval) clearInterval(progressInterval);
    if (closeTimeout) clearTimeout(closeTimeout);
  });

  // Permettre de fermer avec Escape
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onComplete();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if type === 'bsod'}
  <div class="bsod-overlay" transition:fade={{ duration: 200 }}>
    <div class="bsod-content">
      <div class="bsod-header">
        <span class="bsod-sad">:(</span>
        <p>A problem has been detected and Windows has been shut down to prevent damage to your computer.</p>
      </div>

      <div class="bsod-error">
        <p class="error-name">{bsodError}</p>
      </div>

      <div class="bsod-technical">
        <p>Technical information:</p>
        <p class="error-code">*** STOP: {bsodCode} ({memoryAddress}, 0x00000000)</p>
        <p class="error-file">*** carlo.sys - Address {memoryAddress}</p>
      </div>

      <div class="bsod-quote">
        <p>"{bsodQuote}"</p>
        <p class="quote-author">- Carlo Perono, 2024</p>
      </div>

      <div class="bsod-progress">
        <p>Collecting error info...</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {Math.min(progress, 100)}%"></div>
        </div>
        <span class="progress-text">{Math.floor(progress)}%</span>
      </div>

      <p class="bsod-hint">Press ESC to skip (or wait...)</p>
    </div>
  </div>
{:else if type === 'loading'}
  <div class="loading-overlay" transition:fade={{ duration: 200 }}>
    <div class="loading-content">
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>

      <p class="loading-message">{loadingMessage}</p>

      <div class="loading-progress">
        <div class="progress-bar">
          <div class="progress-fill loading-fill" style="width: {progress}%"></div>
        </div>
        <span class="progress-text">{Math.floor(progress)}%</span>
      </div>

      <p class="loading-hint">Please wait... or press ESC</p>

      <div class="loading-footer">
        <p>Perono IT Solutions - "Ca marche... parfois"</p>
      </div>
    </div>
  </div>
{/if}

<style>
  /* BSOD Overlay */
  .bsod-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #0078D7;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Segoe UI', sans-serif;
    color: white;
  }

  .bsod-content {
    max-width: 800px;
    padding: 40px;
  }

  .bsod-header {
    margin-bottom: 30px;
  }

  .bsod-sad {
    font-size: 120px;
    font-weight: 200;
    display: block;
    margin-bottom: 20px;
  }

  .bsod-header p {
    font-size: 24px;
    line-height: 1.4;
  }

  .bsod-error {
    margin: 30px 0;
  }

  .error-name {
    font-size: 20px;
    font-weight: 600;
    color: #fff;
  }

  .bsod-technical {
    font-family: 'Consolas', monospace;
    font-size: 14px;
    margin: 20px 0;
    opacity: 0.9;
  }

  .error-code, .error-file {
    margin: 5px 0;
  }

  .bsod-quote {
    margin: 40px 0;
    padding: 20px;
    border-left: 4px solid rgba(255,255,255,0.5);
    font-style: italic;
  }

  .bsod-quote p {
    margin: 5px 0;
  }

  .quote-author {
    font-size: 14px;
    opacity: 0.8;
    text-align: right;
  }

  .bsod-progress {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-top: 30px;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: rgba(255,255,255,0.2);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: white;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 14px;
    min-width: 40px;
  }

  .bsod-hint {
    margin-top: 20px;
    font-size: 12px;
    opacity: 0.6;
  }

  /* Loading Overlay */
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Segoe UI', sans-serif;
    color: white;
  }

  .loading-content {
    text-align: center;
    max-width: 500px;
    padding: 40px;
  }

  .loading-spinner {
    position: relative;
    width: 80px;
    height: 80px;
    margin: 0 auto 30px;
  }

  .spinner-ring {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: 3px solid transparent;
    border-radius: 50%;
  }

  .spinner-ring:nth-child(1) {
    border-top-color: #00d9ff;
    animation: spin 1.5s linear infinite;
  }

  .spinner-ring:nth-child(2) {
    border-right-color: #ff6b6b;
    animation: spin 2s linear infinite reverse;
  }

  .spinner-ring:nth-child(3) {
    border-bottom-color: #ffd93d;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .loading-message {
    font-size: 18px;
    margin-bottom: 30px;
    min-height: 50px;
    transition: opacity 0.3s;
  }

  .loading-progress {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 20px;
  }

  .loading-progress .progress-bar {
    flex: 1;
    background: rgba(255,255,255,0.1);
  }

  .loading-fill {
    background: linear-gradient(90deg, #00d9ff, #ff6b6b, #ffd93d);
    background-size: 200% 100%;
    animation: gradient 2s linear infinite;
  }

  @keyframes gradient {
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
  }

  .loading-hint {
    font-size: 12px;
    opacity: 0.5;
    margin-bottom: 40px;
  }

  .loading-footer {
    font-size: 11px;
    opacity: 0.3;
    font-style: italic;
  }
</style>
