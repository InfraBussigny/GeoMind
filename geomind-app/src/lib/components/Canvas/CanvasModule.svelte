<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import PostGISViewer from './PostGISViewer.svelte';
  import MapAssistant from './MapAssistant.svelte';
  import UniversalSearchBar from './UniversalSearchBar.svelte';
  import { setMapController, type MapContext, type MapController } from '$lib/services/mapAssistant';

  // Dynamic URLs for search (overrides default map URLs)
  let dynamicUrls = $state<Record<string, string>>({});

  // Handle search navigation
  function handleSearchNavigate(event: CustomEvent<{ tabId: string; url: string }>) {
    const { tabId, url } = event.detail;
    console.log('[Search] Navigate to:', tabId, 'URL:', url);
    // Force reactivity by creating new object
    dynamicUrls = { ...dynamicUrls, [tabId]: url };
    iframeKeys = { ...iframeKeys, [tabId]: (iframeKeys[tabId] || 0) + 1 };
    handleTabChange(tabId as MapId);
  }


  // Get URL for a map (dynamic if set, otherwise default)
  function getMapUrl(mapId: string): string {
    const url = dynamicUrls[mapId] || maps.find(m => m.id === mapId)?.url || '';
    console.log('[getMapUrl]', mapId, '->', url);
    return url;
  }

  // Assistant state
  let showAssistant = $state(true);
  let postGISViewerRef: PostGISViewer | null = null;

  // Map context for assistant (not reactive to avoid loops)
  let mapContext: MapContext = {
    activeTab: 'geoportail',
    connectionId: null,
    activeLayers: [],
    availableTables: [],
    currentZoom: 10,
    currentCenter: [2538000, 1152000],
    selectedFeature: null
  };

  // Periodic context sync interval
  let contextSyncInterval: ReturnType<typeof setInterval> | null = null;

  // Setup map controller when PostGISViewer reports ready
  function handleViewerReady() {
    if (postGISViewerRef) {
      const controller: MapController = {
        zoomTo: (x, y, zoom) => postGISViewerRef?.zoomTo(x, y, zoom),
        zoomToExtent: (minX, minY, maxX, maxY) => postGISViewerRef?.zoomToExtent(minX, minY, maxX, maxY),
        toggleLayer: (name, visible) => postGISViewerRef?.toggleLayerByName(name, visible),
        addLayer: (name) => postGISViewerRef?.addLayerByName(name),
        removeLayer: (name) => postGISViewerRef?.removeLayerByName(name),
        getActiveLayers: () => postGISViewerRef?.getActiveLayers() ?? [],
        executeSQL: (query) => postGISViewerRef?.executeSQL(query) ?? Promise.resolve(null),
        highlightFeature: (geojson) => postGISViewerRef?.highlightFeature(geojson)
      };
      setMapController(controller);
      syncMapContext();
    }
  }

  // Sync context from viewer (called manually, not in $effect)
  function syncMapContext() {
    if (postGISViewerRef) {
      const state = postGISViewerRef.getMapState();
      const tables = postGISViewerRef.getAvailableTables();
      mapContext = {
        ...mapContext,
        connectionId: state.connectionId,
        activeLayers: state.activeLayers,
        availableTables: tables,
        currentZoom: state.zoom,
        currentCenter: state.center as [number, number]
      };
    }
  }

  // Configuration des cartes disponibles
  const maps = [
    {
      id: 'postgis',
      name: 'PostGIS',
      url: '',
      icon: 'database',
      hasLogin: false,
      isComponent: true
    },
    {
      id: 'geoportail',
      name: 'Géoportail Bussigny',
      url: 'https://geo.bussigny.ch',
      icon: 'globe',
      hasLogin: true
    },
    {
      id: 'uzuverse',
      name: 'Uzuverse',
      url: 'https://ouest-lausannois.uzuverse.com/',
      icon: 'cube',
      hasLogin: false
    },
    {
      id: 'sdol',
      name: 'Carto Ouest',
      url: 'https://demo-sdol.geocommunes.ch/',
      icon: 'layers',
      hasLogin: false,
      noIframe: true
    },
    {
      id: 'geovd',
      name: 'Geoportail VD Pro',
      url: 'https://www.geoportail.vd.ch/map.htm',
      icon: 'map',
      hasLogin: false
    },
    {
      id: 'swisstopo',
      name: 'Swisstopo',
      url: 'https://map.geo.admin.ch/#/map?lang=fr&center=2538245,1152890&z=9&topic=ech&bgLayer=ch.swisstopo.pixelkarte-farbe',
      icon: 'mountain',
      hasLogin: false
    },
    {
      id: 'rdppf',
      name: 'RDPPF VD',
      url: 'https://www.rdppf.vd.ch/portail.aspx',
      icon: 'document',
      hasLogin: false
    },
    {
      id: 'rf',
      name: 'Registre foncier',
      url: 'https://www.intercapi.ch',
      icon: 'building',
      hasLogin: false
    },
    {
      id: 'capitastra',
      name: 'Capitastra VD',
      url: 'https://www.capitastra.vd.ch',
      icon: 'file-text',
      hasLogin: false
    },
  ];

  type MapId = typeof maps[number]['id'];
  let activeTab = $state<MapId>('geoportail');

  // Handle tab change (moved after MapId declaration)
  function handleTabChange(newTab: MapId) {
    activeTab = newTab;
    mapContext.activeTab = newTab;

    // Start/stop context sync based on tab
    if (newTab === 'postgis') {
      if (!contextSyncInterval) {
        contextSyncInterval = setInterval(syncMapContext, 2000);
      }
    } else {
      if (contextSyncInterval) {
        clearInterval(contextSyncInterval);
        contextSyncInterval = null;
      }
    }
  }

  onDestroy(() => {
    if (contextSyncInterval) {
      clearInterval(contextSyncInterval);
    }
  });

  // Keys pour forcer le rechargement des iframes
  let iframeKeys = $state<Record<string, number>>(
    Object.fromEntries(maps.map(m => [m.id, 0]))
  );

  // Login popup state
  let loginWindow: Window | null = null;
  let showLoginHint = $state(false);

  function getActiveMap() {
    return maps.find(m => m.id === activeTab)!;
  }

  function refreshCurrentMap() {
    iframeKeys[activeTab]++;
    showLoginHint = false;
  }

  function openInNewTab() {
    window.open(getActiveMap().url, '_blank');
  }

  function openLoginPopup() {
    const map = getActiveMap();
    loginWindow = window.open(map.url, '_blank');
    showLoginHint = true;
  }

  function toggleAssistant() {
    showAssistant = !showAssistant;
  }

  // Handle action from assistant
  function handleAssistantAction(event: CustomEvent) {
    const { action, result } = event.detail;
    console.log('Map action executed:', action, result);
    // Refresh context after action
    if (activeTab === 'postgis' && postGISViewerRef) {
      // Update context from PostGISViewer state
    }
  }
</script>

<div class="canvas-module">
  <!-- Tab bar -->
  <div class="tab-bar">
    <div class="tabs-scroll">
      {#each maps as map}
        <button
          class="tab-btn"
          class:active={activeTab === map.id}
          onclick={() => handleTabChange(map.id)}
          title={map.name}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            {#if map.icon === 'globe'}
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            {:else if map.icon === 'cube'}
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            {:else if map.icon === 'layers'}
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            {:else if map.icon === 'map'}
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            {:else if map.icon === 'mountain'}
              <path d="M8 3l4 8 5-5 7 14H0L8 3z"/>
            {:else if map.icon === 'document'}
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            {:else if map.icon === 'database'}
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            {:else if map.icon === 'layers-ext'}
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
              <circle cx="19" cy="5" r="3" fill="currentColor"/>
            {:else if map.icon === 'building'}
              <path d="M3 21h18"/>
              <path d="M5 21V7l8-4v18"/>
              <path d="M19 21V11l-6-4"/>
              <path d="M9 9v.01"/>
              <path d="M9 12v.01"/>
              <path d="M9 15v.01"/>
              <path d="M9 18v.01"/>
            {:else if map.icon === 'file-text'}
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <line x1="10" y1="9" x2="8" y2="9"/>
            {/if}
          </svg>
          <span class="tab-label">{map.name}</span>
        </button>
      {/each}
    </div>

    <!-- Universal Search Bar -->
    <UniversalSearchBar
      on:navigate={handleSearchNavigate}
    />

    <!-- Spacer -->
    <div class="tab-spacer"></div>

    <!-- Toolbar actions -->
    <div class="tab-actions">
      {#if getActiveMap().hasLogin}
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
      <div class="action-separator"></div>
      <button
        class="action-btn assistant-btn"
        class:active={showAssistant}
        onclick={toggleAssistant}
        title={showAssistant ? "Masquer l'assistant" : "Afficher l'assistant"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
        <span class="btn-label">IA</span>
      </button>
    </div>
  </div>

  <!-- Login hint banner -->
  {#if showLoginHint && getActiveMap().hasLogin}
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

  <!-- Main content area with map and assistant -->
  <div class="content-area" class:with-assistant={showAssistant}>
    <!-- Iframe/Map container -->
    <div class="iframe-container">
      {#each maps as map}
        {#if activeTab === map.id}
          {#if map.noIframe}
            <div class="no-iframe-message">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
              <h3>{map.name}</h3>
              <p>Ce site ne peut pas etre affiche dans l'application (restriction de securite du serveur).</p>
              <button class="open-external-btn" onclick={() => window.open(map.url, '_blank')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Ouvrir dans le navigateur
              </button>
            </div>
          {:else if map.isComponent}
            <div class="component-container">
              {#if map.id === 'postgis'}
                <PostGISViewer bind:this={postGISViewerRef} />
              {/if}
            </div>
          {:else}
            {#key iframeKeys[map.id]}
              <iframe
                src={getMapUrl(map.id)}
                title={map.name}
                class="portal-iframe"
                allow="geolocation; fullscreen"
              ></iframe>
            {/key}
          {/if}
        {/if}
      {/each}
    </div>

    <!-- Map Assistant Sidebar -->
    <MapAssistant
      isOpen={showAssistant}
      context={mapContext}
      on:close={() => showAssistant = false}
      on:action={handleAssistantAction}
    />
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
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
    padding: 0 var(--spacing-md);
    gap: 2px;
    min-height: 44px;
  }

  .tabs-scroll {
    display: flex;
    align-items: center;
    gap: 2px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .tabs-scroll::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid transparent;
    border-bottom: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    border-radius: 6px 6px 0 0;
    margin-top: 6px;
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tab-label {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-btn:hover {
    background: var(--bg-hover);
    color: var(--text-bright);
    border-color: var(--border-color);
  }

  .tab-btn.active {
    background: var(--noir-card);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  .tab-btn svg {
    opacity: 0.7;
  }

  .tab-btn:hover svg {
    opacity: 1;
  }

  .tab-btn.active svg {
    opacity: 1;
    stroke: var(--cyber-green);
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
    border: 1px solid var(--border-color);
    background: var(--noir-card);
    color: var(--text-secondary);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .action-btn:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
    box-shadow: 0 0 8px var(--cyber-green-glow);
  }

  .action-btn.login-btn {
    width: auto;
    padding: 0 12px;
    gap: 6px;
    background: rgba(0, 255, 136, 0.1);
    border: 1px solid var(--cyber-green);
    color: var(--cyber-green);
  }

  .action-btn.login-btn:hover {
    background: var(--cyber-green);
    color: var(--noir-profond);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .action-btn.assistant-btn {
    width: auto;
    padding: 0 12px;
    gap: 6px;
  }

  .action-btn.assistant-btn.active {
    background: rgba(0, 255, 136, 0.15);
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .action-btn.assistant-btn:hover {
    background: rgba(0, 255, 136, 0.2);
  }

  .btn-label {
    font-size: 12px;
    font-weight: 500;
    font-family: var(--font-mono);
  }

  .action-separator {
    width: 1px;
    height: 20px;
    background: var(--border-color);
    margin: 0 4px;
  }

  .login-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--noir-card);
    border-bottom: 1px solid var(--info);
    color: var(--text-primary);
    font-size: 13px;
    font-family: var(--font-mono);
  }

  .login-hint svg {
    flex-shrink: 0;
    color: var(--info);
  }

  .login-hint span {
    flex: 1;
  }

  .login-hint strong {
    font-weight: 600;
    color: var(--info);
  }

  .hint-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    transition: color var(--transition-fast);
  }

  .hint-close:hover {
    color: var(--text-bright);
  }

  .content-area {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .iframe-container {
    flex: 1;
    position: relative;
    background: var(--noir-profond);
    border-top: 1px solid var(--border-color);
  }

  .portal-iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }

  .no-iframe-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--text-secondary);
    max-width: 400px;
    padding: var(--spacing-xl);
  }

  .no-iframe-message svg {
    color: var(--cyber-green);
    margin-bottom: var(--spacing-md);
    opacity: 0.6;
  }

  .no-iframe-message h3 {
    font-family: var(--font-mono);
    font-size: var(--font-size-lg);
    color: var(--text-primary);
    margin-bottom: var(--spacing-sm);
  }

  .no-iframe-message p {
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-lg);
    line-height: 1.5;
  }

  .open-external-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--cyber-green);
    color: var(--noir-profond);
    border: 1px solid var(--cyber-green);
    border-radius: var(--border-radius-sm);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .open-external-btn:hover {
    background: var(--cyber-green-light);
    box-shadow: 0 0 25px var(--cyber-green-glow);
    transform: translateY(-2px);
  }

  .component-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
