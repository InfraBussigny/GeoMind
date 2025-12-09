<script lang="ts">
  import { onMount } from 'svelte';
  import {
    geoportalLogin,
    geoportalLogout,
    getGeoportalSession,
    getGeoportalThemes,
    type GeoportalSession,
    type GeoportalTheme
  } from '$lib/services/api';

  // Onglets disponibles
  type TabType = 'geoportail' | 'uzuverse';
  let activeTab = $state<TabType>('geoportail');

  // Configuration du géoportail
  const GEOPORTAIL_BASE = 'https://geo.bussigny.ch';
  const UZUVERSE_URL = 'https://ouest-lausannois.uzuverse.com/';

  // Thèmes disponibles (chargés dynamiquement depuis l'API)
  let themes = $state<GeoportalTheme[]>([]);
  let themesLoading = $state(false);

  // Icons par défaut pour les thèmes connus
  const themeIcons: Record<string, string> = {
    'route': '🛣️',
    'cadastre': '📐',
    'assainissement': '💧',
    'nature': '🌳',
    'urbanisme': '🏗️',
    'energie': '⚡',
    'pts_interet': '📍',
    'default': '🗺️'
  };

  // Fonds de plan disponibles (géoportail)
  const baseLayers = [
    { id: 'asit_vd', name: 'ASIT VD (defaut)' },
    { id: 'orthophoto', name: 'Orthophoto' },
    { id: 'plan_cadastral', name: 'Plan cadastral' },
    { id: 'osm', name: 'OpenStreetMap' },
  ];

  let selectedTheme = $state('route');
  let selectedBaseLayer = $state('asit_vd');
  let showSidebar = $state(true);
  let iframeKey = $state(0);
  let uzuverseKey = $state(0);

  // Authentification
  let showLoginModal = $state(false);
  let session = $state<GeoportalSession | null>(null);
  let loginUsername = $state('');
  let loginPassword = $state('');
  let loginRemember = $state(false);
  let loginError = $state('');
  let loginLoading = $state(false);

  // Coordonnées par défaut (centre de Bussigny)
  let centerX = $state(2531969);
  let centerY = $state(1155963);
  let scale = $state(15304);

  // Charger la session et les thèmes au démarrage
  onMount(async () => {
    await checkSession();
    await loadThemes();
  });

  async function checkSession() {
    try {
      session = await getGeoportalSession();
    } catch (error) {
      console.error('Error checking session:', error);
    }
  }

  async function loadThemes() {
    themesLoading = true;
    try {
      const response = await getGeoportalThemes();
      themes = response.themes;
      console.log(`[Canvas] Loaded ${themes.length} themes (authenticated: ${response.isAuthenticated})`);

      // Sélectionner le premier thème si aucun n'est sélectionné ou si le thème actuel n'existe plus
      if (themes.length > 0 && (!selectedTheme || !themes.find(t => t.id === selectedTheme))) {
        selectedTheme = themes[0].id;
      }
    } catch (error) {
      console.error('Error loading themes:', error);
    } finally {
      themesLoading = false;
    }
  }

  async function handleLogin() {
    if (!loginUsername || !loginPassword) {
      loginError = 'Veuillez remplir tous les champs';
      return;
    }

    loginLoading = true;
    loginError = '';

    try {
      const result = await geoportalLogin(loginUsername, loginPassword, loginRemember);

      if (result.success) {
        session = await getGeoportalSession();
        showLoginModal = false;
        loginPassword = ''; // Clear password for security

        // Recharger les thèmes après login (pour obtenir les thèmes privés)
        await loadThemes();

        iframeKey++; // Reload map with auth
      } else {
        loginError = result.message || 'Echec de la connexion';
      }
    } catch (error) {
      loginError = 'Erreur de connexion au serveur';
      console.error('Login error:', error);
    } finally {
      loginLoading = false;
    }
  }

  async function handleLogout() {
    try {
      await geoportalLogout();
      session = null;

      // Recharger les thèmes après logout (revenir aux thèmes publics)
      await loadThemes();

      iframeKey++;
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Construire l'URL du géoportail
  function buildGeoportailUrl(): string {
    const params = new URLSearchParams();
    params.set('t', selectedTheme);
    params.set('bl', selectedBaseLayer);
    params.set('c', `${centerX},${centerY}`);
    params.set('s', scale.toString());

    return `${GEOPORTAIL_BASE}/?${params.toString()}`;
  }

  function changeTheme(themeId: string) {
    selectedTheme = themeId;
    iframeKey++;
  }

  function changeBaseLayer(layerId: string) {
    selectedBaseLayer = layerId;
    iframeKey++;
  }

  function openInNewTab() {
    window.open(buildGeoportailUrl(), '_blank');
  }

  function refreshMap() {
    iframeKey++;
  }

  // Raccourcis de navigation
  const quickLocations = [
    { name: 'Centre-ville', x: 2531969, y: 1155963, s: 5000 },
    { name: 'Zone industrielle', x: 2532500, y: 1156200, s: 8000 },
    { name: 'Gare', x: 2531800, y: 1155500, s: 3000 },
    { name: 'Vue generale', x: 2531969, y: 1155963, s: 25000 },
  ];

  function goToLocation(loc: { x: number; y: number; s: number }) {
    centerX = loc.x;
    centerY = loc.y;
    scale = loc.s;
    iframeKey++;
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
  </div>

  <!-- Toolbar (contextuel selon l'onglet) -->
  <div class="canvas-toolbar">
    <div class="toolbar-left">
      {#if activeTab === 'geoportail'}
        <button class="toolbar-btn" class:active={showSidebar} onclick={() => showSidebar = !showSidebar} title="Panneau lateral">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </button>

        <div class="toolbar-separator"></div>

        <select class="theme-select" bind:value={selectedTheme} onchange={() => iframeKey++} disabled={themesLoading}>
          {#if themesLoading}
            <option>Chargement...</option>
          {:else if themes.length === 0}
            <option>Aucun theme</option>
          {:else}
            {#each themes as theme}
              <option value={theme.id}>{themeIcons[theme.id] || themeIcons['default']} {theme.name}{!theme.isPublic ? ' 🔒' : ''}</option>
            {/each}
          {/if}
        </select>

        <select class="baselayer-select" bind:value={selectedBaseLayer} onchange={() => iframeKey++}>
          {#each baseLayers as bl}
            <option value={bl.id}>{bl.name}</option>
          {/each}
        </select>
      {:else}
        <span class="toolbar-info">Jumeau numerique - Ouest Lausannois</span>
      {/if}
    </div>

    <div class="toolbar-center">
      {#if activeTab === 'geoportail'}
        <span class="portal-title">geo.bussigny.ch</span>
      {:else}
        <span class="portal-title">ouest-lausannois.uzuverse.com</span>
      {/if}
    </div>

    <div class="toolbar-right">
      {#if activeTab === 'geoportail'}
        {#if session?.isAuthenticated}
          <div class="user-status">
            <span class="user-badge connected">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              {session.username}
            </span>
            <button class="toolbar-btn logout-btn" onclick={handleLogout} title="Deconnexion">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        {:else}
          <button class="toolbar-btn login-btn" onclick={() => showLoginModal = true} title="Connexion geoportail">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Connexion</span>
          </button>
        {/if}
        <div class="toolbar-separator"></div>
      {/if}

      <button class="toolbar-btn" onclick={() => activeTab === 'geoportail' ? refreshMap() : uzuverseKey++} title="Actualiser">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>

      <button class="toolbar-btn" onclick={() => window.open(activeTab === 'geoportail' ? buildGeoportailUrl() : UZUVERSE_URL, '_blank')} title="Ouvrir dans un nouvel onglet">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Main content -->
  <div class="canvas-content">
    {#if activeTab === 'geoportail'}
      <!-- Sidebar (geoportail only) -->
      {#if showSidebar}
        <aside class="map-sidebar">
          <div class="sidebar-section">
            <h3>Themes {#if themesLoading}<span class="loading-indicator">...</span>{/if}</h3>
            <div class="theme-list">
              {#if themes.length === 0 && !themesLoading}
                <p class="no-themes">Aucun theme disponible</p>
              {:else}
                {#each themes as theme}
                  <button
                    class="theme-item"
                    class:active={selectedTheme === theme.id}
                    class:private={!theme.isPublic}
                    onclick={() => changeTheme(theme.id)}
                  >
                    <span class="theme-icon">{themeIcons[theme.id] || themeIcons['default']}</span>
                    <span class="theme-name">{theme.name}</span>
                    {#if !theme.isPublic}<span class="private-badge">🔒</span>{/if}
                  </button>
                {/each}
              {/if}
            </div>
          </div>

          <div class="sidebar-section">
            <h3>Navigation rapide</h3>
            <div class="quick-nav">
              {#each quickLocations as loc}
                <button class="quick-nav-btn" onclick={() => goToLocation(loc)}>
                  {loc.name}
                </button>
              {/each}
            </div>
          </div>

          <div class="sidebar-section">
            <h3>Fond de plan</h3>
            <div class="baselayer-list">
              {#each baseLayers as bl}
                <label class="baselayer-item">
                  <input
                    type="radio"
                    name="baselayer"
                    value={bl.id}
                    checked={selectedBaseLayer === bl.id}
                    onchange={() => changeBaseLayer(bl.id)}
                  />
                  <span>{bl.name}</span>
                </label>
              {/each}
            </div>
          </div>

          <div class="sidebar-section auth-notice" class:auth-connected={session?.isAuthenticated}>
            {#if session?.isAuthenticated}
              <div class="auth-status connected">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>Connecte en tant que <strong>{session.username}</strong></span>
              </div>
              <p>Vous avez acces aux couches protegees</p>
            {:else}
              <div class="auth-status disconnected">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Non connecte</span>
              </div>
              <p>Connectez-vous pour acceder aux couches protegees du geoportail</p>
              <button class="btn-primary" onclick={() => showLoginModal = true}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Se connecter
              </button>
            {/if}
          </div>
        </aside>
      {/if}

      <!-- Geoportail iframe -->
      <div class="map-container">
        {#key iframeKey}
          <iframe
            src={buildGeoportailUrl()}
            title="Geoportail Bussigny"
            class="geoportail-iframe"
            allow="geolocation"
          ></iframe>
        {/key}
      </div>
    {:else}
      <!-- Uzuverse iframe -->
      <div class="map-container uzuverse-container">
        {#key uzuverseKey}
          <iframe
            src={UZUVERSE_URL}
            title="Uzuverse Ouest Lausannois"
            class="uzuverse-iframe"
            allow="geolocation; fullscreen"
          ></iframe>
        {/key}
      </div>
    {/if}
  </div>

  <!-- Login Modal -->
  {#if showLoginModal}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="login-modal-title" onclick={() => showLoginModal = false}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 id="login-modal-title">Connexion Geoportail</h2>
          <button class="modal-close" onclick={() => showLoginModal = false}>&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-info">
            Connectez-vous avec vos identifiants geo.bussigny.ch pour acceder aux couches protegees.
          </p>

          {#if loginError}
            <div class="error-message">{loginError}</div>
          {/if}

          <form onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <div class="form-group">
              <label for="username">Nom d'utilisateur</label>
              <input
                type="text"
                id="username"
                bind:value={loginUsername}
                placeholder="Votre identifiant"
                disabled={loginLoading}
                autocomplete="username"
              />
            </div>

            <div class="form-group">
              <label for="password">Mot de passe</label>
              <input
                type="password"
                id="password"
                bind:value={loginPassword}
                placeholder="Votre mot de passe"
                disabled={loginLoading}
                autocomplete="current-password"
              />
            </div>

            <div class="form-group checkbox-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={loginRemember}
                  disabled={loginLoading}
                />
                <span>Se souvenir de moi</span>
              </label>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-secondary" onclick={() => showLoginModal = false} disabled={loginLoading}>
                Annuler
              </button>
              <button type="submit" class="btn-primary" disabled={loginLoading}>
                {#if loginLoading}
                  <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
                  </svg>
                  Connexion...
                {:else}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Se connecter
                {/if}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}
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

  .toolbar-info {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-style: italic;
  }

  .canvas-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md);
    background: white;
    border-bottom: 1px solid var(--border-color);
    gap: var(--spacing-md);
  }

  .toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .toolbar-center {
    flex: 1;
    text-align: center;
  }

  .portal-title {
    font-weight: 600;
    color: var(--bleu-bussigny);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    border: none;
    background: transparent;
    color: var(--text-secondary);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .toolbar-btn:hover {
    background: var(--bg-secondary);
    color: var(--bleu-bussigny);
  }

  .toolbar-btn.active {
    background: var(--bleu-bussigny);
    color: white;
  }

  .toolbar-btn.auth-btn {
    background: rgba(39, 174, 96, 0.1);
    border: 1px solid var(--success);
    color: var(--success);
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .toolbar-btn.auth-btn:hover {
    background: var(--success);
    color: white;
  }

  .toolbar-separator {
    width: 1px;
    height: 24px;
    background: var(--border-color);
  }

  .theme-select, .baselayer-select {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    background: white;
    cursor: pointer;
  }

  .user-badge {
    font-size: var(--font-size-xs);
    padding: 2px 8px;
    background: var(--success-light);
    color: var(--success);
    border-radius: 10px;
  }

  .canvas-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .map-sidebar {
    width: 260px;
    background: white;
    border-right: 1px solid var(--border-color);
    overflow-y: auto;
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .sidebar-section h3 {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: var(--spacing-sm);
  }

  .theme-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .theme-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    border: none;
    background: transparent;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .theme-item:hover {
    background: var(--bg-secondary);
  }

  .theme-item.active {
    background: var(--bleu-bussigny);
    color: white;
  }

  .theme-icon {
    font-size: 18px;
  }

  .theme-name {
    font-size: var(--font-size-sm);
  }

  .quick-nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .quick-nav-btn {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-size-xs);
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .quick-nav-btn:hover {
    background: var(--bleu-bussigny);
    color: white;
    border-color: var(--bleu-bussigny);
  }

  .baselayer-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .baselayer-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs);
    cursor: pointer;
    font-size: var(--font-size-sm);
  }

  .no-themes {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    text-align: center;
    padding: var(--spacing-md);
  }

  .loading-indicator {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .theme-item.private {
    border-left: 3px solid var(--warning);
  }

  .private-badge {
    margin-left: auto;
    font-size: 10px;
  }

  .auth-notice {
    background: var(--warning-light);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    margin-top: auto;
  }

  .auth-notice.auth-connected {
    background: rgba(39, 174, 96, 0.1);
    border: 1px solid var(--success);
  }

  .auth-notice p {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-sm);
  }

  .auth-status {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
    font-size: var(--font-size-sm);
  }

  .auth-status.connected {
    color: var(--success);
  }

  .auth-status.disconnected {
    color: var(--text-muted);
  }

  .auth-status strong {
    font-weight: 600;
  }

  /* User status in toolbar */
  .user-status {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .user-badge {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-sm);
    padding: 4px 10px;
    border-radius: 12px;
  }

  .user-badge.connected {
    background: rgba(39, 174, 96, 0.1);
    color: var(--success);
    border: 1px solid var(--success);
  }

  .login-btn {
    background: rgba(39, 174, 96, 0.1) !important;
    border: 1px solid var(--success) !important;
    color: var(--success) !important;
    padding: var(--spacing-sm) var(--spacing-md) !important;
  }

  .login-btn:hover {
    background: var(--success) !important;
    color: white !important;
  }

  .logout-btn {
    color: var(--text-muted) !important;
  }

  .logout-btn:hover {
    color: var(--error) !important;
    background: rgba(231, 76, 60, 0.1) !important;
  }

  .map-container {
    flex: 1;
    position: relative;
    background: #e8e8e8;
  }

  .geoportail-iframe,
  .uzuverse-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  .uzuverse-container {
    background: #0a0a0a;
  }

  /* Login Frame Modal */
  .login-frame-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }

  .login-frame-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin: 20px;
    background: white;
    border-radius: var(--border-radius);
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .login-frame-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    background: linear-gradient(135deg, var(--bleu-bussigny) 0%, var(--bleu-bussigny-dark) 100%);
    color: white;
  }

  .login-frame-header h2 {
    font-size: var(--font-size-lg);
    margin: 0;
  }

  .login-frame-header p {
    flex: 1;
    font-size: var(--font-size-sm);
    opacity: 0.9;
    margin: 0;
  }

  .close-login-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: white;
    color: var(--bleu-bussigny);
    border: none;
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .close-login-btn:hover {
    background: var(--bg-secondary);
    transform: scale(1.02);
  }

  .login-iframe {
    flex: 1;
    width: 100%;
    border: none;
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: var(--border-radius);
    width: 100%;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h2 {
    font-size: var(--font-size-lg);
    color: var(--bleu-bussigny);
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-muted);
  }

  .modal-body {
    padding: var(--spacing-lg);
  }

  .modal-info {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-md);
  }

  .error-message {
    background: var(--error-light);
    color: var(--error);
    padding: var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-md);
  }

  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .form-group label {
    display: block;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  .form-group input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-md);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--bleu-bussigny);
  }

  .modal-actions {
    display: flex;
    gap: var(--spacing-sm);
    justify-content: flex-end;
    margin-top: var(--spacing-lg);
  }

  .btn-primary, .btn-secondary {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background: var(--bleu-bussigny);
    color: white;
  }

  .btn-primary:hover {
    background: var(--bleu-bussigny-dark);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .login-steps {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    margin: var(--spacing-lg) 0;
  }

  .step {
    display: flex;
    gap: var(--spacing-md);
    align-items: flex-start;
  }

  .step-number {
    width: 32px;
    height: 32px;
    background: var(--bleu-bussigny);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
  }

  .step-content {
    flex: 1;
  }

  .step-content p {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-sm);
  }

  .btn-success {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    background: var(--success);
    color: white;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .btn-success:hover {
    background: #1e8449;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .modal-footer {
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
  }

  /* Checkbox styles */
  .checkbox-group {
    margin-top: var(--spacing-sm);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
  }

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--bleu-bussigny);
  }

  /* Spinner animation */
  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Button disabled state */
  .btn-primary:disabled,
  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Form input disabled state */
  .form-group input:disabled {
    background: var(--bg-secondary);
    cursor: not-allowed;
  }
</style>
