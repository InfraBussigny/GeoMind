<script lang="ts">
  import { onMount } from 'svelte';

  // Onglets disponibles
  type TabType = 'geoportail' | 'uzuverse';
  let activeTab = $state<TabType>('geoportail');

  // URLs des portails
  const GEOPORTAIL_URL = 'https://geo.bussigny.ch';
  const UZUVERSE_URL = 'https://ouest-lausannois.uzuverse.com/';

  // Keys pour forcer le rechargement des iframes
  let geoportailKey = $state(0);
  let uzuverseKey = $state(0);

  // Login popup state
  let loginWindow: Window | null = null;
  let showLoginHint = $state(false);

  function refreshCurrentMap() {
    if (activeTab === 'geoportail') {
      geoportailKey++;
    } else {
      uzuverseKey++;
    }
    showLoginHint = false;
  }

  function openInNewTab() {
    const url = activeTab === 'geoportail' ? GEOPORTAIL_URL : UZUVERSE_URL;
    window.open(url, '_blank');
  }

  function openLoginPopup() {
    // En mode dev (localhost), ouvre dans un nouvel onglet
    // En mode Tauri (.exe), la WebView gère les cookies nativement
    loginWindow = window.open(GEOPORTAIL_URL, '_blank');
    showLoginHint = true;
  }
</script>

<div class="canvas-module">
  <!-- Tab bar -->
  <div class="tab-bar">
    <button
      class="tab-btn"
      class:active={activeTab === 'geoportail'}
      onclick={() => activeTab = 'geoportail'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <span>Geoportail Bussigny</span>
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'uzuverse'}
      onclick={() => activeTab = 'uzuverse'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
      <span>Uzuverse</span>
    </button>

    <!-- Spacer -->
    <div class="tab-spacer"></div>

    <!-- Toolbar actions -->
    <div class="tab-actions">
      {#if activeTab === 'geoportail'}
        <button class="action-btn login-btn" onclick={openLoginPopup} title="Se connecter au geoportail">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span class="btn-label">Connexion</span>
        </button>
        <div class="action-separator"></div>
      {/if}
      <button class="action-btn" onclick={refreshCurrentMap} title="Actualiser">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>
      <button class="action-btn" onclick={openInNewTab} title="Ouvrir dans un nouvel onglet">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Login hint banner -->
  {#if showLoginHint && activeTab === 'geoportail'}
    <div class="login-hint">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <span><strong>Mode dev :</strong> L'authentification dans l'iframe ne fonctionne pas en localhost. Utilisez le geoportail dans l'onglet ouvert, ou compilez l'app en .exe pour une experience complete.</span>
      <button class="hint-close" onclick={() => showLoginHint = false}>&times;</button>
    </div>
  {/if}

  <!-- Iframe container -->
  <div class="iframe-container">
    {#if activeTab === 'geoportail'}
      {#key geoportailKey}
        <iframe
          src={GEOPORTAIL_URL}
          title="Geoportail Bussigny"
          class="portal-iframe"
          allow="geolocation"
        ></iframe>
      {/key}
    {:else}
      {#key uzuverseKey}
        <iframe
          src={UZUVERSE_URL}
          title="Uzuverse Ouest Lausannois"
          class="portal-iframe"
          allow="geolocation; fullscreen"
        ></iframe>
      {/key}
    {/if}
  </div>
</div>

<style>
  .canvas-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .tab-bar {
    display: flex;
    align-items: center;
    background: linear-gradient(180deg, #1a2634 0%, #2c3e50 100%);
    padding: 0 var(--spacing-md);
    gap: 2px;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all var(--transition-fast);
    border-radius: 8px 8px 0 0;
    margin-top: 6px;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .tab-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .tab-btn.active {
    background: white;
    color: var(--bleu-bussigny);
  }

  .tab-btn svg {
    opacity: 0.8;
  }

  .tab-btn.active svg {
    opacity: 1;
    stroke: var(--bleu-bussigny);
  }

  .tab-spacer {
    flex: 1;
  }

  .tab-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .action-btn.login-btn {
    width: auto;
    padding: 0 12px;
    gap: 6px;
    background: rgba(39, 174, 96, 0.2);
    border: 1px solid rgba(39, 174, 96, 0.5);
    color: #2ecc71;
  }

  .action-btn.login-btn:hover {
    background: rgba(39, 174, 96, 0.4);
    color: white;
  }

  .btn-label {
    font-size: 12px;
    font-weight: 500;
  }

  .action-separator {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.2);
    margin: 0 4px;
  }

  .login-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
    color: white;
    font-size: 13px;
  }

  .login-hint svg {
    flex-shrink: 0;
  }

  .login-hint span {
    flex: 1;
  }

  .login-hint strong {
    font-weight: 600;
  }

  .hint-close {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .hint-close:hover {
    opacity: 1;
  }

  .iframe-container {
    flex: 1;
    position: relative;
    background: #e8e8e8;
  }

  .portal-iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
