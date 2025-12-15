<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  // Types
  interface CommunicationService {
    id: string;
    name: string;
    icon: string;
    url: string;
    color: string;
    description: string;
  }

  // Available services
  const services: CommunicationService[] = [
    {
      id: 'outlook',
      name: 'Outlook',
      icon: '📧',
      url: 'https://outlook.office.com/mail/',
      color: '#0078d4',
      description: 'Emails & Calendrier Microsoft 365'
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: '💬',
      url: 'https://web.whatsapp.com',
      color: '#25d366',
      description: 'WhatsApp Web'
    },
    {
      id: 'teams',
      name: 'Teams',
      icon: '👥',
      url: 'https://teams.microsoft.com',
      color: '#6264a7',
      description: 'Microsoft Teams'
    },
    {
      id: 'threecx',
      name: '3CX',
      icon: '📞',
      url: '',
      color: '#f7931e',
      description: 'Téléphonie 3CX'
    }
  ];

  // State
  let activeService = $state<CommunicationService | null>(null);
  let webviewContainer: HTMLDivElement;
  let isLoading = $state(false);
  let isTauri = $state(false);
  let webviewReady = $state(false);
  let currentWebview: any = null;
  let threeCXUrl = $state('');
  let showSettings = $state(false);
  let resizeObserver: ResizeObserver | null = null;

  // Check if running in Tauri
  onMount(async () => {
    if (browser) {
      // Load 3CX URL from localStorage
      threeCXUrl = localStorage.getItem('geomind_3cx_url') || '';

      // Update 3CX service URL
      const threecxService = services.find(s => s.id === 'threecx');
      if (threecxService) {
        threecxService.url = threeCXUrl;
      }

      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = await getCurrentWindow();
        if (win) {
          isTauri = true;
        }
      } catch {
        isTauri = false;
      }
    }
  });

  onDestroy(() => {
    destroyCurrentWebview();
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

  // Destroy current webview
  async function destroyCurrentWebview() {
    if (currentWebview) {
      try {
        await currentWebview.close();
      } catch (e) {
        console.log('Error closing webview:', e);
      }
      currentWebview = null;
      webviewReady = false;
    }
  }

  // Get webview container bounds
  function getContainerBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!webviewContainer) return null;

    const rect = webviewContainer.getBoundingClientRect();
    // Account for window scaling
    const scaleFactor = window.devicePixelRatio || 1;

    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  // Select and load a service
  async function selectService(service: CommunicationService) {
    if (!service.url) {
      if (service.id === 'threecx') {
        showSettings = true;
      }
      return;
    }

    if (activeService?.id === service.id) return;

    isLoading = true;
    activeService = service;

    // Destroy previous webview
    await destroyCurrentWebview();

    if (isTauri) {
      await createTauriWebview(service);
    } else {
      // Browser fallback - just show iframe (might be blocked by some services)
      webviewReady = true;
      isLoading = false;
    }
  }

  // Create Tauri webview
  async function createTauriWebview(service: CommunicationService) {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const { getCurrentWindow } = await import('@tauri-apps/api/window');

      const bounds = getContainerBounds();
      if (!bounds) {
        console.error('Could not get container bounds');
        isLoading = false;
        return;
      }

const mainWindow = await getCurrentWindow();      const mainPos = await mainWindow.outerPosition();      const absoluteX = mainPos.x + bounds.x;      const absoluteY = mainPos.y + bounds.y;      console.log("[Comm] Creating webview at:", absoluteX, absoluteY);      const webviewLabel = `comm-${service.id}-${Date.now()}`;      currentWebview = new WebviewWindow(webviewLabel, {        url: service.url,        x: absoluteX,        y: absoluteY,        width: bounds.width,        height: bounds.height,        decorations: false,        skipTaskbar: true,        focus: true,        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"      });      currentWebview.once("tauri://created", () => {        console.log("[Comm] Webview created");        webviewReady = true;        isLoading = false;        setupResizeObserver();      });      currentWebview.once("tauri://error", (e: any) => {        console.error("[Comm] Webview error:", e);        isLoading = false;        webviewReady = true;      });

    } catch (e) {
      console.error('Error creating Tauri webview:', e);
      isLoading = false;
      // Fallback to iframe
      webviewReady = true;
    }
  }

  // Setup resize observer
  function setupResizeObserver() {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }

    resizeObserver = new ResizeObserver(async () => {
      if (currentWebview && webviewContainer) {
        const bounds = getContainerBounds();
        if (bounds) {
          try {
            const mainWindow = await getCurrentWindow();
          const mainPos = await mainWindow.outerPosition();
          await currentWebview.setPosition({ x: mainPos.x + bounds.x, y: mainPos.y + bounds.y });
            await currentWebview.setSize({ width: bounds.width, height: bounds.height });
          } catch (e) {
            console.log('Error resizing webview:', e);
          }
        }
      }
    });

    resizeObserver.observe(webviewContainer);
  }

  // Save 3CX URL
  function save3CXUrl() {
    if (browser) {
      localStorage.setItem('geomind_3cx_url', threeCXUrl);
      const threecxService = services.find(s => s.id === 'threecx');
      if (threecxService) {
        threecxService.url = threeCXUrl;
      }
      showSettings = false;
    }
  }

  // Close service
  async function closeService() {
    await destroyCurrentWebview();
    activeService = null;
    webviewReady = false;
  }

  // Refresh current service
  async function refreshService() {
    if (activeService && currentWebview) {
      try {
        // Reload by destroying and recreating
        const service = activeService;
        await destroyCurrentWebview();
        isLoading = true;
        await createTauriWebview(service);
      } catch (e) {
        console.log('Error refreshing:', e);
      }
    }
  }

  // Open in external browser
  async function openExternal() {
    if (activeService?.url) {
      if (browser) {
        try {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(activeService.url);
        } catch {
          window.open(activeService.url, '_blank');
        }
      }
    }
  }
</script>

<div class="communications-module">
  <!-- Sidebar -->
  <div class="comm-sidebar">
    <div class="sidebar-header">
      <h3>Communications</h3>
    </div>

    <div class="services-list">
      {#each services as service}
        <button
          class="service-btn"
          class:active={activeService?.id === service.id}
          class:disabled={!service.url && service.id !== 'threecx'}
          style="--service-color: {service.color}"
          onclick={() => selectService(service)}
          title={service.description}
        >
          <span class="service-icon">{service.icon}</span>
          <span class="service-name">{service.name}</span>
          {#if !service.url && service.id === 'threecx'}
            <span class="config-badge">!</span>
          {/if}
        </button>
      {/each}
    </div>

    <div class="sidebar-footer">
      <button class="settings-btn" onclick={() => showSettings = !showSettings} title="Parametres">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Main content area -->
  <div class="comm-main">
    {#if !activeService}
      <!-- Welcome screen -->
      <div class="welcome-screen">
        <div class="welcome-icon">📡</div>
        <h2>Communications</h2>
        <p>Selectionnez un service dans la barre laterale pour l'ouvrir ici.</p>

        <div class="quick-services">
          {#each services.filter(s => s.url || s.id === 'threecx') as service}
            <button
              class="quick-service-btn"
              style="--service-color: {service.color}"
              onclick={() => selectService(service)}
            >
              <span class="qs-icon">{service.icon}</span>
              <span class="qs-name">{service.name}</span>
              <span class="qs-desc">{service.description}</span>
            </button>
          {/each}
        </div>

        {#if !isTauri}
          <div class="browser-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>Mode navigateur - Certains services peuvent etre bloques. Utilisez l'application compilee pour une meilleure experience.</span>
          </div>
        {/if}
      </div>

    {:else}
      <!-- Service toolbar -->
      <div class="service-toolbar" style="--service-color: {activeService.color}">
        <div class="toolbar-left">
          <span class="toolbar-icon">{activeService.icon}</span>
          <span class="toolbar-title">{activeService.name}</span>
        </div>
        <div class="toolbar-actions">
          <button class="toolbar-btn" onclick={refreshService} title="Rafraichir">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <button class="toolbar-btn" onclick={openExternal} title="Ouvrir dans le navigateur">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
          <button class="toolbar-btn close-btn" onclick={closeService} title="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Webview container -->
      <div class="webview-container" bind:this={webviewContainer}>
        {#if isLoading}
          <div class="loading-overlay">
            <div class="spinner"></div>
            <p>Chargement de {activeService.name}...</p>
          </div>
        {/if}

        {#if !isTauri && webviewReady}
          <!-- Browser fallback: iframe (may be blocked) -->
          <iframe
            src={activeService.url}
            title={activeService.name}
            class="service-iframe"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
          ></iframe>
        {:else if isTauri && webviewReady}
          <!-- Tauri: webview is rendered natively, container is just for positioning -->
          <div class="webview-placeholder"></div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Settings modal -->
  {#if showSettings}
    <div class="settings-modal" onclick={() => showSettings = false}>
      <div class="settings-content" onclick={(e) => e.stopPropagation()}>
        <div class="settings-header">
          <h3>Parametres Communications</h3>
          <button class="close-settings" onclick={() => showSettings = false}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="settings-body">
          <div class="setting-group">
            <label>
              <span class="setting-label">📞 URL 3CX Web Client</span>
              <input
                type="url"
                bind:value={threeCXUrl}
                placeholder="https://votre-3cx.example.com"
                class="setting-input"
              />
            </label>
            <p class="setting-help">L'URL de votre client web 3CX</p>
          </div>
        </div>

        <div class="settings-footer">
          <button class="btn-cancel" onclick={() => showSettings = false}>Annuler</button>
          <button class="btn-save" onclick={save3CXUrl}>Enregistrer</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .communications-module {
    height: 100%;
    display: flex;
    background: var(--noir-surface, #0d1117);
    overflow: hidden;
  }

  /* Sidebar */
  .comm-sidebar {
    width: 200px;
    min-width: 200px;
    display: flex;
    flex-direction: column;
    background: var(--noir-card, #161b22);
    border-right: 1px solid var(--border-color, #30363d);
  }

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #30363d);
  }

  .sidebar-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #e6edf3);
  }

  .services-list {
    flex: 1;
    padding: 8px;
    overflow-y: auto;
  }

  .service-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px;
    margin-bottom: 4px;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .service-btn:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .service-btn.active {
    background: color-mix(in srgb, var(--service-color) 20%, transparent);
    border-left: 3px solid var(--service-color);
  }

  .service-btn.disabled {
    opacity: 0.5;
  }

  .service-icon {
    font-size: 20px;
  }

  .service-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #e6edf3);
  }

  .config-badge {
    position: absolute;
    right: 8px;
    width: 18px;
    height: 18px;
    background: var(--warning, #f0ad4e);
    color: #000;
    font-size: 12px;
    font-weight: bold;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sidebar-footer {
    padding: 12px;
    border-top: 1px solid var(--border-color, #30363d);
    display: flex;
    justify-content: center;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    border: 1px solid var(--border-color, #30363d);
    border-radius: 8px;
    color: var(--text-secondary, #8b949e);
    cursor: pointer;
    transition: all 0.2s;
  }

  .settings-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary, #e6edf3);
    border-color: var(--cyber-green, #00ff88);
  }

  /* Main content */
  .comm-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  /* Welcome screen */
  .welcome-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
  }

  .welcome-icon {
    font-size: 64px;
    margin-bottom: 20px;
    opacity: 0.8;
  }

  .welcome-screen h2 {
    margin: 0 0 12px;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary, #e6edf3);
  }

  .welcome-screen p {
    margin: 0 0 32px;
    font-size: 14px;
    color: var(--text-secondary, #8b949e);
  }

  .quick-services {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    max-width: 800px;
    width: 100%;
  }

  .quick-service-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 16px;
    background: var(--noir-card, #161b22);
    border: 1px solid var(--border-color, #30363d);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .quick-service-btn:hover {
    background: color-mix(in srgb, var(--service-color) 10%, var(--noir-card, #161b22));
    border-color: var(--service-color);
    transform: translateY(-2px);
  }

  .qs-icon {
    font-size: 32px;
  }

  .qs-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #e6edf3);
  }

  .qs-desc {
    font-size: 11px;
    color: var(--text-secondary, #8b949e);
  }

  .browser-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 32px;
    padding: 12px 16px;
    background: rgba(240, 173, 78, 0.1);
    border: 1px solid rgba(240, 173, 78, 0.3);
    border-radius: 8px;
    color: var(--warning, #f0ad4e);
    font-size: 12px;
    max-width: 600px;
  }

  /* Service toolbar */
  .service-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: color-mix(in srgb, var(--service-color) 15%, var(--noir-card, #161b22));
    border-bottom: 1px solid var(--border-color, #30363d);
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .toolbar-icon {
    font-size: 20px;
  }

  .toolbar-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #e6edf3);
  }

  .toolbar-actions {
    display: flex;
    gap: 4px;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary, #8b949e);
    cursor: pointer;
    transition: all 0.2s;
  }

  .toolbar-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary, #e6edf3);
  }

  .toolbar-btn.close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  /* Webview container */
  .webview-container {
    flex: 1;
    position: relative;
    background: #fff;
    overflow: hidden;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--noir-surface, #0d1117);
    z-index: 10;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color, #30363d);
    border-top-color: var(--cyber-green, #00ff88);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-overlay p {
    color: var(--text-secondary, #8b949e);
    font-size: 14px;
  }

  .webview-placeholder {
    width: 100%;
    height: 100%;
  }

  .service-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  /* Settings modal */
  .settings-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .settings-content {
    width: 90%;
    max-width: 500px;
    background: var(--noir-card, #161b22);
    border: 1px solid var(--border-color, #30363d);
    border-radius: 12px;
    overflow: hidden;
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #30363d);
  }

  .settings-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #e6edf3);
  }

  .close-settings {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary, #8b949e);
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-settings:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary, #e6edf3);
  }

  .settings-body {
    padding: 20px;
  }

  .setting-group {
    margin-bottom: 20px;
  }

  .setting-group:last-child {
    margin-bottom: 0;
  }

  .setting-label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #e6edf3);
  }

  .setting-input {
    width: 100%;
    padding: 10px 12px;
    background: var(--noir-surface, #0d1117);
    border: 1px solid var(--border-color, #30363d);
    border-radius: 6px;
    color: var(--text-primary, #e6edf3);
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }

  .setting-input:focus {
    border-color: var(--cyber-green, #00ff88);
  }

  .setting-help {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--text-secondary, #8b949e);
  }

  .settings-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-color, #30363d);
  }

  .btn-cancel,
  .btn-save {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border-color, #30363d);
    color: var(--text-secondary, #8b949e);
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary, #e6edf3);
  }

  .btn-save {
    background: var(--cyber-green, #00ff88);
    border: none;
    color: #000;
  }

  .btn-save:hover {
    background: color-mix(in srgb, var(--cyber-green, #00ff88) 80%, #fff);
  }
</style>
