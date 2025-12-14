<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    intercapiStore,
    intercapiHistory,
    intercapiFavorites,
    intercapiConfig,
    buildIntercapiUrl,
    parseSearchQuery,
    COMMUNES_VD,
    type IntercapiSearch,
    type IntercapiFavorite
  } from '$lib/stores/intercapiStore';

  // Détection Tauri
  let isTauri = $state(false);
  let iframeLoaded = $state(false);
  let iframeError = $state(false);

  // État local
  let searchQuery = $state('');
  let communeInput = $state('');
  let activeTab = $state<'browser' | 'history' | 'favorites'>('browser');
  let iframeUrl = $state('');
  let iframeRef: HTMLIFrameElement | null = $state(null);

  // Liste des communes pour l'autocomplete
  const communesList = Object.keys(COMMUNES_VD).map(c =>
    c.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')
  ).sort();

  // Initialisation
  onMount(() => {
    // Détecter si on est en mode Tauri
    isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
    communeInput = $intercapiConfig.lastCommune;
    iframeUrl = $intercapiConfig.baseUrl;
  });

  // Navigation dans l'iframe
  function navigateTo(url: string) {
    iframeUrl = url;
    iframeLoaded = false;
    iframeError = false;
    activeTab = 'browser';
  }

  // Recherche
  function handleSearch() {
    if (!searchQuery.trim() && !communeInput.trim()) return;

    const parsed = parseSearchQuery(searchQuery);
    let url: string;
    let search: Omit<IntercapiSearch, 'id' | 'timestamp'>;

    if (parsed.type === 'egrid') {
      url = buildIntercapiUrl('egrid', { egrid: parsed.egrid });
      search = {
        type: 'egrid',
        query: searchQuery,
        label: `E-GRID: ${parsed.egrid}`
      };
    } else if (parsed.type === 'parcelle' || parsed.parcelle) {
      const commune = parsed.commune || communeInput;
      url = buildIntercapiUrl('parcelle', {
        commune,
        parcelle: parsed.parcelle || searchQuery
      });
      search = {
        type: 'parcelle',
        query: searchQuery,
        commune,
        parcelle: parsed.parcelle || searchQuery,
        label: `${commune} - Parcelle ${parsed.parcelle || searchQuery}`
      };
      if (commune) {
        intercapiStore.setLastCommune(commune);
        communeInput = commune;
      }
    } else if (parsed.type === 'adresse') {
      url = buildIntercapiUrl('adresse', {
        adresse: parsed.adresse,
        commune: communeInput
      });
      search = {
        type: 'adresse',
        query: searchQuery,
        commune: communeInput,
        label: `Adresse: ${parsed.adresse}`
      };
    } else {
      url = $intercapiConfig.baseUrl;
      search = {
        type: 'parcelle',
        query: searchQuery || communeInput,
        commune: communeInput,
        label: searchQuery || `Commune: ${communeInput}`
      };
    }

    // Ajouter à l'historique
    intercapiStore.addToHistory(search);

    // Si mode Tauri ou iframe OK, naviguer dans l'iframe
    if (isTauri || !iframeError) {
      navigateTo(url);
    } else {
      // Sinon ouvrir dans un nouvel onglet
      window.open(url, '_blank');
    }
  }

  // Recherche depuis l'historique
  function searchFromHistory(item: IntercapiSearch) {
    searchQuery = item.parcelle || item.query;
    if (item.commune) communeInput = item.commune;

    const url = buildIntercapiUrl(item.type, {
      commune: item.commune,
      parcelle: item.parcelle,
      adresse: item.type === 'adresse' ? item.query : undefined,
      egrid: item.type === 'egrid' ? item.query : undefined
    });

    if (isTauri || !iframeError) {
      navigateTo(url);
    } else {
      window.open(url, '_blank');
    }
  }

  // Recherche depuis les favoris
  function searchFromFavorite(fav: IntercapiFavorite) {
    searchQuery = fav.parcelle;
    communeInput = fav.commune;

    const url = buildIntercapiUrl('parcelle', {
      commune: fav.commune,
      parcelle: fav.parcelle
    });

    if (isTauri || !iframeError) {
      navigateTo(url);
    } else {
      window.open(url, '_blank');
    }
  }

  // Ouvrir dans un nouvel onglet
  function openInNewTab() {
    window.open(iframeUrl, '_blank');
  }

  // Raccourcis
  function goHome() {
    navigateTo($intercapiConfig.baseUrl);
  }

  function goToCapitastra() {
    navigateTo('https://www.capitastra.vd.ch');
  }

  function refreshIframe() {
    if (iframeRef) {
      iframeLoaded = false;
      iframeRef.src = iframeUrl;
    }
  }

  // Gestion iframe
  function handleIframeLoad() {
    iframeLoaded = true;
    iframeError = false;
  }

  function handleIframeError() {
    iframeLoaded = true;
    iframeError = true;
  }

  // Ajouter aux favoris
  function addToFavorites() {
    if (!searchQuery.trim() || !communeInput.trim()) return;

    const parsed = parseSearchQuery(searchQuery);
    intercapiStore.addFavorite({
      type: 'parcelle',
      commune: communeInput,
      parcelle: parsed.parcelle || searchQuery,
      label: `${communeInput} - Parcelle ${parsed.parcelle || searchQuery}`
    });
  }

  // Raccourcis clavier
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  }

  // Formater la date
  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
</script>

<div class="intercapi-module">
  <!-- Header avec barre de recherche -->
  <header class="intercapi-header">
    <div class="header-left">
      <div class="module-title">
        <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
        </svg>
        <span class="title">Intercapi</span>
      </div>
    </div>

    <!-- Barre de recherche compacte -->
    <div class="search-bar">
      <input
        type="text"
        class="commune-input"
        list="communes-list"
        bind:value={communeInput}
        placeholder="Commune"
      />
      <datalist id="communes-list">
        {#each communesList as commune}
          <option value={commune}></option>
        {/each}
      </datalist>

      <div class="search-divider"></div>

      <input
        type="text"
        class="search-input"
        bind:value={searchQuery}
        placeholder="Parcelle, adresse ou E-GRID..."
        onkeydown={handleKeydown}
      />

      <button class="search-btn" onclick={handleSearch} title="Rechercher (Enter)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
      </button>

      <button
        class="fav-btn"
        onclick={addToFavorites}
        disabled={!searchQuery.trim() || !communeInput.trim()}
        title="Ajouter aux favoris"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </button>
    </div>

    <div class="header-right">
      <button class="nav-btn" onclick={goHome} title="Accueil Intercapi">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </button>
      <button class="nav-btn" onclick={goToCapitastra} title="Capitastra">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9h6v6H9z"/>
        </svg>
      </button>
      <button class="nav-btn" onclick={refreshIframe} title="Rafraîchir">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
      </button>
      <button class="nav-btn" onclick={openInNewTab} title="Ouvrir dans un nouvel onglet">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- Tabs -->
  <div class="tabs-bar">
    <button
      class="tab"
      class:active={activeTab === 'browser'}
      onclick={() => activeTab = 'browser'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
      </svg>
      <span>Navigateur</span>
    </button>
    <button
      class="tab"
      class:active={activeTab === 'history'}
      onclick={() => activeTab = 'history'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span>Historique ({$intercapiHistory.length})</span>
    </button>
    <button
      class="tab"
      class:active={activeTab === 'favorites'}
      onclick={() => activeTab = 'favorites'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
      <span>Favoris ({$intercapiFavorites.length})</span>
    </button>

    {#if isTauri}
      <span class="mode-badge tauri">Desktop</span>
    {:else}
      <span class="mode-badge web">Web</span>
    {/if}
  </div>

  <!-- Content -->
  <main class="intercapi-content">
    {#if activeTab === 'browser'}
      <div class="browser-container">
        {#if !iframeLoaded && !iframeError}
          <div class="loading-overlay">
            <div class="spinner"></div>
            <span>Chargement d'Intercapi...</span>
          </div>
        {/if}

        {#if iframeError && !isTauri}
          <div class="error-overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <h3>Intercapi bloque l'affichage intégré</h3>
            <p>Le site Intercapi ne permet pas l'intégration dans un navigateur web.<br/>
               <strong>Utilisez l'application desktop GeoMind</strong> pour une intégration complète.</p>
            <div class="error-actions">
              <button class="primary-btn" onclick={openInNewTab}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Ouvrir Intercapi dans un nouvel onglet
              </button>
            </div>
            <p class="hint">💡 Astuce : Utilisez l'historique et les favoris pour un accès rapide à vos recherches</p>
          </div>
        {/if}

        <iframe
          bind:this={iframeRef}
          src={iframeUrl}
          title="Intercapi - Registre Foncier VD"
          class="intercapi-iframe"
          class:hidden={iframeError && !isTauri}
          onload={handleIframeLoad}
          onerror={handleIframeError}
        ></iframe>
      </div>

    {:else if activeTab === 'history'}
      <div class="list-container">
        {#if $intercapiHistory.length === 0}
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <p>Aucune recherche récente</p>
            <span>Vos recherches apparaîtront ici pour un accès rapide</span>
          </div>
        {:else}
          <div class="list-header">
            <span>Recherches récentes</span>
            <button class="clear-btn" onclick={() => intercapiStore.clearHistory()}>
              Effacer tout
            </button>
          </div>
          <div class="items-grid">
            {#each $intercapiHistory as item}
              <div class="item-card" onclick={() => searchFromHistory(item)} role="button" tabindex="0">
                <span class="item-icon">
                  {#if item.type === 'parcelle'}📍{:else if item.type === 'adresse'}🏠{:else}🔗{/if}
                </span>
                <div class="item-info">
                  <span class="item-label">{item.label || item.query}</span>
                  <span class="item-meta">{formatDate(item.timestamp)}</span>
                </div>
                <button
                  class="item-delete"
                  onclick={(e) => { e.stopPropagation(); intercapiStore.removeFromHistory(item.id); }}
                  title="Supprimer"
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'favorites'}
      <div class="list-container">
        {#if $intercapiFavorites.length === 0}
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <p>Aucun favori</p>
            <span>Ajoutez des parcelles pour un accès instantané</span>
          </div>
        {:else}
          <div class="items-grid favorites">
            {#each $intercapiFavorites as fav}
              <div class="item-card favorite" onclick={() => searchFromFavorite(fav)} role="button" tabindex="0">
                <span class="item-icon">⭐</span>
                <div class="item-info">
                  <span class="item-commune">{fav.commune}</span>
                  <span class="item-label">Parcelle {fav.parcelle}</span>
                  {#if fav.notes}
                    <span class="item-notes">{fav.notes}</span>
                  {/if}
                </div>
                <button
                  class="item-delete"
                  onclick={(e) => { e.stopPropagation(); intercapiStore.removeFavorite(fav.id); }}
                  title="Retirer"
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </main>

  <!-- Footer -->
  <footer class="intercapi-footer">
    <div class="footer-left">
      <span class="url-display">{iframeUrl}</span>
    </div>
    <div class="footer-right">
      <a href="https://www.vd.ch/territoire-et-construction/registre-foncier" target="_blank">
        Registre Foncier VD
      </a>
    </div>
  </footer>
</div>

<style>
  .intercapi-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
    overflow: hidden;
  }

  /* === Header === */
  .intercapi-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
  }

  .header-left {
    flex-shrink: 0;
  }

  .module-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title-icon {
    width: 24px;
    height: 24px;
    color: var(--primary);
  }

  .title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  /* === Search Bar === */
  .search-bar {
    flex: 1;
    display: flex;
    align-items: center;
    max-width: 600px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .search-bar:focus-within {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-glow);
  }

  .commune-input {
    width: 120px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 13px;
  }

  .search-divider {
    width: 1px;
    height: 24px;
    background: var(--border-color);
  }

  .search-input {
    flex: 1;
    padding: 10px 12px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 13px;
  }

  .commune-input::placeholder,
  .search-input::placeholder {
    color: var(--text-muted);
  }

  .search-btn, .fav-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .search-btn:hover {
    background: var(--primary);
    color: var(--noir-profond);
  }

  .fav-btn:hover:not(:disabled) {
    color: var(--warning);
  }

  .fav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .search-btn svg, .fav-btn svg {
    width: 18px;
    height: 18px;
  }

  /* === Header Right === */
  .header-right {
    display: flex;
    gap: 4px;
  }

  .nav-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .nav-btn:hover {
    background: var(--bg-hover);
    border-color: var(--primary);
    color: var(--primary);
  }

  .nav-btn svg {
    width: 16px;
    height: 16px;
  }

  /* === Tabs === */
  .tabs-bar {
    display: flex;
    align-items: center;
    padding: 0 16px;
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .tab:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .tab svg {
    width: 16px;
    height: 16px;
  }

  .mode-badge {
    margin-left: auto;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .mode-badge.tauri {
    background: rgba(0, 255, 136, 0.15);
    color: var(--primary);
    border: 1px solid var(--primary);
  }

  .mode-badge.web {
    background: rgba(255, 165, 0, 0.15);
    color: var(--warning);
    border: 1px solid var(--warning);
  }

  /* === Content === */
  .intercapi-content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  /* === Browser === */
  .browser-container {
    height: 100%;
    position: relative;
  }

  .intercapi-iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: white;
  }

  .intercapi-iframe.hidden {
    display: none;
  }

  .loading-overlay, .error-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: var(--noir-profond);
    z-index: 10;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-overlay span, .error-overlay p {
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
    max-width: 400px;
  }

  .error-overlay svg {
    width: 64px;
    height: 64px;
    color: var(--warning);
  }

  .error-overlay h3 {
    margin: 0;
    font-size: 18px;
    color: var(--text-primary);
  }

  .error-overlay p {
    margin: 0;
    line-height: 1.6;
  }

  .error-actions {
    margin-top: 16px;
  }

  .primary-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: var(--primary);
    border: none;
    border-radius: 8px;
    color: var(--noir-profond);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .primary-btn:hover {
    background: var(--primary-bright);
    transform: translateY(-1px);
  }

  .primary-btn svg {
    width: 18px;
    height: 18px;
  }

  .hint {
    margin-top: 24px;
    padding: 12px 16px;
    background: rgba(0, 255, 136, 0.1);
    border: 1px solid var(--primary);
    border-radius: 8px;
    color: var(--primary) !important;
    font-size: 12px !important;
  }

  /* === List Container === */
  .list-container {
    height: 100%;
    overflow-y: auto;
    padding: 20px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--text-muted);
  }

  .empty-state svg {
    width: 64px;
    height: 64px;
    margin-bottom: 16px;
    opacity: 0.4;
  }

  .empty-state p {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .empty-state span {
    font-size: 13px;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .clear-btn {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .clear-btn:hover {
    background: rgba(255, 0, 0, 0.1);
    border-color: var(--error);
    color: var(--error);
  }

  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .item-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    text-align: left;
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
  }

  .item-card:hover {
    border-color: var(--primary);
    background: var(--bg-hover);
  }

  .item-card.favorite {
    border-left: 3px solid var(--warning);
  }

  .item-icon {
    font-size: 20px;
  }

  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .item-commune {
    font-size: 10px;
    font-weight: 600;
    color: var(--primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .item-label {
    font-size: 14px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-meta, .item-notes {
    font-size: 11px;
    color: var(--text-muted);
  }

  .item-notes {
    font-style: italic;
  }

  .item-delete {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 16px;
    cursor: pointer;
    opacity: 0;
    transition: all var(--transition-fast);
  }

  .item-card:hover .item-delete {
    opacity: 1;
  }

  .item-delete:hover {
    background: rgba(255, 0, 0, 0.15);
    color: var(--error);
  }

  /* === Footer === */
  .intercapi-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--noir-surface);
    border-top: 1px solid var(--border-color);
    font-size: 11px;
  }

  .url-display {
    color: var(--text-muted);
    font-family: var(--font-mono);
    max-width: 400px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .footer-right a {
    color: var(--primary);
    text-decoration: none;
  }

  .footer-right a:hover {
    text-decoration: underline;
  }
</style>
