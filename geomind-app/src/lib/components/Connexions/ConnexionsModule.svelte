<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  const API_BASE = 'http://localhost:3001/api';

  // ============================================
  // TYPES
  // ============================================

  interface VpnStatus {
    fortiClientInstalled: boolean;
    fortiClientRunning: boolean;
    vpnConnected: boolean;
    vpnName: string | null;
    vpnIp: string | null;
  }

  interface Connection {
    id: string;
    name: string;
    type: 'postgresql' | 'ssh' | 'wms' | 'wfs';
    host?: string;
    url?: string;
    port?: number;
    database?: string;
    username?: string;
    status: 'connected' | 'disconnected';
    lastUsed?: string;
  }

  interface ConnectionType {
    name: string;
    icon: string;
    defaultPort: number;
    fields: string[];
  }

  // ============================================
  // VPN STATE
  // ============================================

  let vpnStatus = $state<VpnStatus>({
    fortiClientInstalled: false,
    fortiClientRunning: false,
    vpnConnected: false,
    vpnName: null,
    vpnIp: null
  });
  let vpnLoading = $state(false);
  let vpnError = $state<string | null>(null);
  let vpnRefreshInterval: ReturnType<typeof setInterval> | null = null;

  // ============================================
  // CONNECTIONS STATE
  // ============================================

  let connections = $state<Connection[]>([]);
  let connectionTypes = $state<Record<string, ConnectionType>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Modal state
  let showModal = $state(false);
  let modalMode = $state<'add' | 'edit'>('add');
  let editingConnection = $state<Connection | null>(null);

  // Form state
  let formType = $state<string>('postgresql');
  let formName = $state('');
  let formHost = $state('');
  let formUrl = $state('');
  let formPort = $state<number | undefined>(undefined);
  let formDatabase = $state('');
  let formUsername = $state('');
  let formPassword = $state('');
  let formSsl = $state(false);
  let formVersion = $state('');
  let formPrivateKey = $state('');

  let testing = $state(false);
  let testResult = $state<{success: boolean; message: string; info?: any} | null>(null);

  // ============================================
  // LIFECYCLE
  // ============================================

  onMount(async () => {
    if (!browser) return;
    await Promise.all([fetchTypes(), fetchConnections(), fetchVpnStatus()]);
    vpnRefreshInterval = setInterval(fetchVpnStatus, 15000);
  });

  onDestroy(() => {
    if (vpnRefreshInterval) clearInterval(vpnRefreshInterval);
  });

  // ============================================
  // VPN FUNCTIONS
  // ============================================

  async function fetchVpnStatus() {
    vpnLoading = true;
    try {
      const res = await fetch(`${API_BASE}/vpn/status`);
      const data = await res.json();
      if (data.success) {
        vpnStatus = data.status;
        vpnError = null;
      } else {
        vpnError = data.error || 'Erreur VPN';
      }
    } catch {
      vpnError = 'Serveur indisponible';
    } finally {
      vpnLoading = false;
    }
  }

  async function launchFortiClient() {
    try {
      await fetch(`${API_BASE}/vpn/launch`, { method: 'POST' });
    } catch {
      vpnError = 'Impossible de lancer FortiClient';
    }
  }

  // ============================================
  // CONNECTIONS FUNCTIONS
  // ============================================

  async function fetchConnections() {
    try {
      loading = true;
      error = null;
      const res = await fetch(`${API_BASE}/connections`);
      if (!res.ok) throw new Error('Erreur chargement connexions');
      connections = await res.json();
    } catch (e: any) {
      error = e.message;
      connections = [];
    } finally {
      loading = false;
    }
  }

  async function fetchTypes() {
    try {
      const res = await fetch(`${API_BASE}/connections/types`);
      if (res.ok) {
        connectionTypes = await res.json();
      }
    } catch {
      connectionTypes = {
        postgresql: { name: 'PostgreSQL/PostGIS', icon: 'database', defaultPort: 5432, fields: ['host', 'port', 'database', 'username', 'password', 'ssl'] },
        ssh: { name: 'SSH', icon: 'terminal', defaultPort: 22, fields: ['host', 'port', 'username', 'password', 'privateKey'] },
        wms: { name: 'WMS', icon: 'map', defaultPort: 443, fields: ['url', 'username', 'password', 'version'] },
        wfs: { name: 'WFS', icon: 'layers', defaultPort: 443, fields: ['url', 'username', 'password', 'version'] }
      };
    }
  }

  function openAddModal() {
    modalMode = 'add';
    editingConnection = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(conn: Connection) {
    modalMode = 'edit';
    editingConnection = conn;
    formType = conn.type;
    formName = conn.name;
    formHost = conn.host || '';
    formUrl = conn.url || '';
    formPort = conn.port;
    formDatabase = conn.database || '';
    formUsername = conn.username || '';
    formPassword = '';
    formSsl = false;
    formVersion = '';
    formPrivateKey = '';
    showModal = true;
  }

  function resetForm() {
    formType = 'postgresql';
    formName = '';
    formHost = '';
    formUrl = '';
    formPort = undefined;
    formDatabase = '';
    formUsername = '';
    formPassword = '';
    formSsl = false;
    formVersion = '';
    formPrivateKey = '';
    testResult = null;
  }

  function closeModal() {
    showModal = false;
    resetForm();
  }

  function getFormData() {
    return {
      type: formType,
      name: formName,
      host: formHost || undefined,
      url: formUrl || undefined,
      port: formPort || connectionTypes[formType]?.defaultPort,
      database: formDatabase || undefined,
      username: formUsername || undefined,
      password: formPassword || undefined,
      ssl: formSsl,
      version: formVersion || undefined,
      privateKey: formPrivateKey || undefined
    };
  }

  async function testConnection() {
    testing = true;
    testResult = null;
    try {
      const res = await fetch(`${API_BASE}/connections/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getFormData())
      });
      testResult = await res.json();
    } catch (e: any) {
      testResult = { success: false, message: e.message };
    } finally {
      testing = false;
    }
  }

  async function saveConnection() {
    try {
      const data = getFormData();
      let res;
      if (modalMode === 'add') {
        res = await fetch(`${API_BASE}/connections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else if (editingConnection) {
        res = await fetch(`${API_BASE}/connections/${editingConnection.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      if (res && res.ok) {
        closeModal();
        await fetchConnections();
      } else {
        const err = await res?.json();
        error = err?.error || 'Erreur sauvegarde';
      }
    } catch (e: any) {
      error = e.message;
    }
  }

  async function deleteConnection(id: string) {
    if (!confirm('Supprimer cette connexion ?')) return;
    try {
      const res = await fetch(`${API_BASE}/connections/${id}`, { method: 'DELETE' });
      if (res.ok) await fetchConnections();
    } catch (e: any) {
      error = e.message;
    }
  }

  async function toggleConnection(conn: Connection) {
    try {
      error = null;
      const endpoint = conn.status === 'connected' ? 'disconnect' : 'connect';
      const res = await fetch(`${API_BASE}/connections/${conn.id}/${endpoint}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        error = data.error || `Erreur ${endpoint}`;
        return;
      }
      await fetchConnections();
    } catch (e: any) {
      error = e.message || 'Erreur de connexion';
    }
  }

  function getTypeIcon(type: string): string {
    const icons: Record<string, string> = { postgresql: '🗄️', ssh: '💻', wms: '🗺️', wfs: '📍' };
    return icons[type] || '🔌';
  }

  const typeOrder: Record<string, number> = { postgresql: 1, wms: 2, wfs: 3, ssh: 4 };

  function sortedConnections(conns: Connection[]): Connection[] {
    return [...conns].sort((a, b) => {
      const typeA = typeOrder[a.type] || 99;
      const typeB = typeOrder[b.type] || 99;
      if (typeA !== typeB) return typeA - typeB;
      if (a.status === 'connected' && b.status !== 'connected') return -1;
      if (b.status === 'connected' && a.status !== 'connected') return 1;
      return a.name.localeCompare(b.name, 'fr');
    });
  }

  let connectedCount = $derived(connections.filter(c => c.status === 'connected').length);
</script>

<div class="connexions-module">
  <!-- ==================== LEFT: VPN PANEL ==================== -->
  <aside class="vpn-panel" class:connected={vpnStatus.vpnConnected}>
    <div class="vpn-header">
      <div class="vpn-indicator" class:active={vpnStatus.vpnConnected}></div>
      <h2>VPN</h2>
      <button class="btn-refresh" onclick={fetchVpnStatus} disabled={vpnLoading} title="Actualiser">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spinning={vpnLoading}>
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
      </button>
    </div>

    <div class="vpn-status-card">
      <svg class="vpn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        {#if vpnStatus.vpnConnected}
          <path d="M9 12l2 2 4-4" stroke-width="2"/>
        {/if}
      </svg>
      <div class="vpn-status-label">
        {#if vpnStatus.vpnConnected}
          <span class="status-text connected">Connecte</span>
          {#if vpnStatus.vpnName}
            <span class="vpn-name">{vpnStatus.vpnName}</span>
          {/if}
        {:else}
          <span class="status-text disconnected">Deconnecte</span>
        {/if}
      </div>
      {#if vpnStatus.vpnIp}
        <span class="vpn-ip">{vpnStatus.vpnIp}</span>
      {/if}
    </div>

    <div class="vpn-info">
      <div class="info-row">
        <span class="info-label">FortiClient</span>
        <span class="info-value" class:ok={vpnStatus.fortiClientInstalled}>
          {vpnStatus.fortiClientInstalled ? '✓' : '✗'}
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">Service</span>
        <span class="info-value" class:ok={vpnStatus.fortiClientRunning}>
          {vpnStatus.fortiClientRunning ? '✓' : '✗'}
        </span>
      </div>
    </div>

    <button class="btn-launch" onclick={launchFortiClient} disabled={!vpnStatus.fortiClientInstalled}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
      Ouvrir FortiClient
    </button>

    {#if !vpnStatus.vpnConnected}
      <p class="vpn-warning">Acces aux serveurs internes restreint sans VPN</p>
    {/if}

    {#if vpnError}
      <div class="vpn-error">{vpnError}</div>
    {/if}
  </aside>

  <!-- ==================== RIGHT: SERVERS PANEL ==================== -->
  <main class="servers-panel">
    <div class="servers-header">
      <div class="header-info">
        <h2>Serveurs & Connexions</h2>
        <span class="server-count">
          {connections.length} connexion{connections.length !== 1 ? 's' : ''}
          {#if connectedCount > 0}
            <span class="active-badge">{connectedCount} active{connectedCount !== 1 ? 's' : ''}</span>
          {/if}
        </span>
      </div>
      <button class="btn-add" onclick={openAddModal}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Ajouter
      </button>
    </div>

    {#if error}
      <div class="error-banner">{error} <button onclick={() => error = null}>×</button></div>
    {/if}

    <div class="servers-content">
      {#if loading}
        <div class="loading">Chargement...</div>
      {:else if connections.length === 0}
        <div class="empty-state">
          <div class="empty-icon">🔌</div>
          <p>Aucune connexion configuree</p>
          <p class="hint">Ajoutez PostgreSQL, SSH, WMS ou WFS</p>
        </div>
      {:else}
        <div class="connections-list">
          {#each sortedConnections(connections) as conn (conn.id)}
            <div class="connection-row" class:connected={conn.status === 'connected'}>
              <div class="conn-icon">{getTypeIcon(conn.type)}</div>
              <div class="conn-main">
                <div class="conn-name">{conn.name}</div>
                <div class="conn-details">
                  <span class="conn-type">{connectionTypes[conn.type]?.name || conn.type}</span>
                  <span class="conn-host">{conn.host || conn.url}{conn.database ? `/${conn.database}` : ''}</span>
                </div>
              </div>
              <div class="conn-status" class:online={conn.status === 'connected'}>
                {conn.status === 'connected' ? '●' : '○'}
              </div>
              <div class="conn-actions">
                <button class="btn-icon" class:active={conn.status === 'connected'} onclick={() => toggleConnection(conn)} title={conn.status === 'connected' ? 'Deconnecter' : 'Connecter'}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                    <line x1="12" y1="2" x2="12" y2="12"/>
                  </svg>
                </button>
                <button class="btn-icon" onclick={() => openEditModal(conn)} title="Modifier">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn-icon delete" onclick={() => deleteConnection(conn.id)} title="Supprimer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </main>

  <!-- ==================== MODAL ==================== -->
  {#if showModal}
    <div class="modal-backdrop" onclick={closeModal}>
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>{modalMode === 'add' ? 'Nouvelle connexion' : 'Modifier connexion'}</h3>
          <button class="modal-close" onclick={closeModal}>×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Type</label>
            <select bind:value={formType}>
              {#each Object.entries(connectionTypes) as [key, type]}
                <option value={key}>{type.name}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label>Nom</label>
            <input type="text" bind:value={formName} placeholder="Ma connexion" />
          </div>
          {#if connectionTypes[formType]?.fields.includes('host')}
            <div class="form-row">
              <div class="form-group flex-2">
                <label>Hote</label>
                <input type="text" bind:value={formHost} placeholder="localhost" />
              </div>
              <div class="form-group flex-1">
                <label>Port</label>
                <input type="number" bind:value={formPort} placeholder={String(connectionTypes[formType]?.defaultPort)} />
              </div>
            </div>
          {/if}
          {#if connectionTypes[formType]?.fields.includes('url')}
            <div class="form-group">
              <label>URL</label>
              <input type="text" bind:value={formUrl} placeholder="https://..." />
            </div>
          {/if}
          {#if connectionTypes[formType]?.fields.includes('database')}
            <div class="form-group">
              <label>Base de donnees</label>
              <input type="text" bind:value={formDatabase} placeholder="postgres" />
            </div>
          {/if}
          {#if connectionTypes[formType]?.fields.includes('username')}
            <div class="form-group">
              <label>Utilisateur</label>
              <input type="text" bind:value={formUsername} placeholder="postgres" />
            </div>
          {/if}
          {#if connectionTypes[formType]?.fields.includes('password')}
            <div class="form-group">
              <label>Mot de passe</label>
              <input type="password" bind:value={formPassword} placeholder="••••••••" />
            </div>
          {/if}
          {#if connectionTypes[formType]?.fields.includes('ssl')}
            <div class="form-group checkbox">
              <label><input type="checkbox" bind:checked={formSsl} /> Utiliser SSL</label>
            </div>
          {/if}

          {#if testResult}
            <div class="test-result" class:success={testResult.success}>
              {testResult.success ? '✓' : '✗'} {testResult.message}
            </div>
          {/if}
        </div>
        <div class="modal-footer">
          <button class="btn-test" onclick={testConnection} disabled={testing}>
            {testing ? 'Test...' : 'Tester'}
          </button>
          <button class="btn-cancel" onclick={closeModal}>Annuler</button>
          <button class="btn-save" onclick={saveConnection}>Enregistrer</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .connexions-module {
    height: 100%;
    display: flex;
    background: var(--bg-primary);
    color: var(--text-primary);
    overflow: hidden;
  }

  /* ==================== VPN PANEL (LEFT) ==================== */

  .vpn-panel {
    flex: 1;
    min-width: 220px;
    max-width: 350px;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    gap: 1rem;
  }

  .vpn-panel.connected {
    border-right: 2px solid var(--accent-color, #00ff88);
    background: linear-gradient(135deg, rgba(0, 255, 136, 0.05), var(--bg-secondary));
  }

  .vpn-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .vpn-header h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    flex: 1;
  }

  .vpn-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ff4444;
    box-shadow: 0 0 8px rgba(255, 68, 68, 0.5);
  }

  .vpn-indicator.active {
    background: var(--accent-color, #00ff88);
    box-shadow: 0 0 12px rgba(0, 255, 136, 0.6);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 12px rgba(0, 255, 136, 0.6); }
    50% { opacity: 0.8; box-shadow: 0 0 20px rgba(0, 255, 136, 0.8); }
  }

  .btn-refresh {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .btn-refresh:hover:not(:disabled) {
    border-color: var(--accent-color);
    color: var(--text-primary);
  }

  .btn-refresh svg {
    width: 14px;
    height: 14px;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    100% { transform: rotate(360deg); }
  }

  .vpn-status-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
  }

  .vpn-panel.connected .vpn-status-card {
    border-color: var(--accent-color, #00ff88);
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.1);
  }

  .vpn-icon {
    width: 48px;
    height: 48px;
    color: var(--text-secondary);
  }

  .vpn-panel.connected .vpn-icon {
    color: var(--accent-color, #00ff88);
  }

  .vpn-status-label {
    text-align: center;
  }

  .status-text {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .status-text.connected {
    color: var(--accent-color, #00ff88);
  }

  .status-text.disconnected {
    color: var(--text-secondary);
  }

  .vpn-name {
    display: block;
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.2rem;
  }

  .vpn-ip {
    font-family: monospace;
    font-size: 0.8rem;
    padding: 0.25rem 0.6rem;
    background: rgba(0, 255, 136, 0.15);
    border-radius: 4px;
    color: var(--accent-color, #00ff88);
  }

  .vpn-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.4rem 0.6rem;
    background: var(--bg-primary);
    border-radius: 5px;
    font-size: 0.8rem;
  }

  .info-label {
    color: var(--text-secondary);
  }

  .info-value {
    font-weight: 600;
    color: #ff4444;
  }

  .info-value.ok {
    color: var(--accent-color, #00ff88);
  }

  .btn-launch {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.6rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-launch:hover:not(:disabled) {
    border-color: var(--accent-color);
  }

  .btn-launch:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-launch svg {
    width: 16px;
    height: 16px;
  }

  .vpn-warning {
    font-size: 0.7rem;
    color: #f0ad4e;
    text-align: center;
    padding: 0.5rem;
    background: rgba(240, 173, 78, 0.1);
    border-radius: 5px;
    margin: 0;
  }

  .vpn-error {
    font-size: 0.75rem;
    color: #ff4444;
    padding: 0.5rem;
    background: rgba(255, 68, 68, 0.1);
    border-radius: 5px;
    text-align: center;
  }

  /* ==================== SERVERS PANEL (RIGHT) ==================== */

  .servers-panel {
    flex: 3;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .servers-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .header-info h2 {
    margin: 0 0 0.25rem;
    font-size: 1.15rem;
    font-weight: 600;
  }

  .server-count {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .active-badge {
    margin-left: 0.5rem;
    padding: 0.2rem 0.6rem;
    background: rgba(0, 255, 136, 0.2);
    color: var(--accent-color, #00ff88);
    border-radius: 10px;
    font-size: 0.8rem;
  }

  .btn-add {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: var(--accent-color, #00ff88);
    border: none;
    border-radius: 8px;
    color: #000;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-add:hover {
    filter: brightness(1.1);
  }

  .btn-add svg {
    width: 16px;
    height: 16px;
  }

  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background: rgba(255, 68, 68, 0.1);
    border-bottom: 1px solid #ff4444;
    color: #ff4444;
    font-size: 0.8rem;
  }

  .error-banner button {
    background: none;
    border: none;
    color: #ff4444;
    font-size: 1.2rem;
    cursor: pointer;
  }

  .servers-content {
    flex: 1;
    overflow: auto;
    padding: 1.25rem;
  }

  .loading, .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .empty-icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
  }

  .hint {
    font-size: 0.8rem;
    opacity: 0.7;
  }

  /* ==================== CONNECTION ROWS ==================== */

  .connections-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .connection-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    transition: all 0.2s;
  }

  .connection-row.connected {
    border-color: var(--accent-color, #00ff88);
    box-shadow: 0 0 15px rgba(0, 255, 136, 0.1);
  }

  .connection-row:hover {
    border-color: var(--text-secondary);
  }

  .conn-icon {
    font-size: 1.75rem;
    flex-shrink: 0;
  }

  .conn-main {
    flex: 1;
    min-width: 0;
  }

  .conn-name {
    font-weight: 600;
    font-size: 1.05rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 0.3rem;
  }

  .conn-details {
    display: flex;
    gap: 0.75rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .conn-type {
    padding: 0.15rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 4px;
  }

  .conn-host {
    font-family: monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conn-status {
    font-size: 1rem;
    color: var(--text-secondary);
    flex-shrink: 0;
    padding: 0 0.5rem;
  }

  .conn-status.online {
    color: var(--accent-color, #00ff88);
  }

  .conn-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-icon:hover {
    border-color: var(--accent-color);
    color: var(--text-primary);
  }

  .btn-icon.active {
    background: rgba(0, 255, 136, 0.2);
    border-color: var(--accent-color, #00ff88);
    color: var(--accent-color, #00ff88);
  }

  .btn-icon.delete:hover {
    border-color: #ff4444;
    color: #ff4444;
    background: rgba(255, 68, 68, 0.1);
  }

  .btn-icon svg {
    width: 18px;
    height: 18px;
  }

  /* ==================== MODAL ==================== */

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    width: 90%;
    max-width: 480px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .modal-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1.5rem;
    cursor: pointer;
  }

  .modal-body {
    padding: 1.25rem;
    max-height: 60vh;
    overflow-y: auto;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.4rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .form-group.checkbox label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .flex-1 { flex: 1; }
  .flex-2 { flex: 2; }

  .test-result {
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    background: rgba(255, 68, 68, 0.1);
    color: #ff4444;
  }

  .test-result.success {
    background: rgba(0, 255, 136, 0.1);
    color: var(--accent-color, #00ff88);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border-color);
  }

  .btn-test,
  .btn-cancel,
  .btn-save {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-test {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    margin-right: auto;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn-save {
    background: var(--accent-color, #00ff88);
    border: none;
    color: #000;
  }

  .btn-test:hover,
  .btn-cancel:hover {
    background: var(--bg-tertiary);
  }

  .btn-save:hover {
    filter: brightness(1.1);
  }
</style>
