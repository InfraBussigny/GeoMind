<script lang="ts">
  import { onMount } from 'svelte';

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

  const API_BASE = 'http://localhost:3001/api';

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
    } catch (e) {
      // Types par défaut si API non dispo
      connectionTypes = {
        postgresql: { name: 'PostgreSQL/PostGIS', icon: 'database', defaultPort: 5432, fields: ['host', 'port', 'database', 'username', 'password', 'ssl'] },
        ssh: { name: 'SSH', icon: 'terminal', defaultPort: 22, fields: ['host', 'port', 'username', 'password', 'privateKey'] },
        wms: { name: 'WMS', icon: 'map', defaultPort: 443, fields: ['url', 'username', 'password', 'version'] },
        wfs: { name: 'WFS', icon: 'layers', defaultPort: 443, fields: ['url', 'username', 'password', 'version'] }
      };
    }
  }

  onMount(async () => {
    await fetchTypes();
    await fetchConnections();
  });

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
      if (res.ok) {
        await fetchConnections();
      }
    } catch (e: any) {
      error = e.message;
    }
  }

  async function toggleConnection(conn: Connection) {
    try {
      const endpoint = conn.status === 'connected' ? 'disconnect' : 'connect';
      const res = await fetch(`${API_BASE}/connections/${conn.id}/${endpoint}`, { method: 'POST' });
      if (res.ok) {
        await fetchConnections();
      }
    } catch (e: any) {
      error = e.message;
    }
  }

  function getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      postgresql: '🗄️',
      ssh: '💻',
      wms: '🗺️',
      wfs: '📍'
    };
    return icons[type] || '🔌';
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return 'Jamais';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="connections-module">
  <div class="module-header">
    <h2>Connexions serveurs</h2>
    <button class="btn-add" onclick={openAddModal}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Nouvelle connexion
    </button>
  </div>

  {#if error}
    <div class="error-banner">
      {error}
      <button onclick={() => error = null}>×</button>
    </div>
  {/if}

  {#if loading}
    <div class="loading">Chargement...</div>
  {:else if connections.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🔌</div>
      <p>Aucune connexion configurée</p>
      <p class="hint">Ajoutez une connexion PostgreSQL, SSH ou WMS/WFS pour commencer</p>
    </div>
  {:else}
    <div class="connections-list">
      {#each connections as conn (conn.id)}
        <div class="connection-card" class:connected={conn.status === 'connected'}>
          <div class="conn-icon">{getTypeIcon(conn.type)}</div>
          <div class="conn-info">
            <div class="conn-name">{conn.name}</div>
            <div class="conn-details">
              <span class="conn-type">{connectionTypes[conn.type]?.name || conn.type}</span>
              <span class="conn-host">{conn.host || conn.url}</span>
              {#if conn.database}
                <span class="conn-db">/{conn.database}</span>
              {/if}
            </div>
            <div class="conn-meta">
              <span class="conn-status" class:online={conn.status === 'connected'}>
                {conn.status === 'connected' ? '● Connecté' : '○ Déconnecté'}
              </span>
              <span class="conn-last-used">Dernière utilisation: {formatDate(conn.lastUsed)}</span>
            </div>
          </div>
          <div class="conn-actions">
            <button
              class="btn-icon"
              class:btn-connect={conn.status !== 'connected'}
              class:btn-disconnect={conn.status === 'connected'}
              onclick={() => toggleConnection(conn)}
              title={conn.status === 'connected' ? 'Déconnecter' : 'Connecter'}
            >
              {#if conn.status === 'connected'}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                  <line x1="12" y1="2" x2="12" y2="12"></line>
                </svg>
              {:else}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                  <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                  <circle cx="12" cy="20" r="1"></circle>
                </svg>
              {/if}
            </button>
            <button class="btn-icon btn-edit" onclick={() => openEditModal(conn)} title="Modifier">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-icon btn-delete" onclick={() => deleteConnection(conn.id)} title="Supprimer">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showModal}
  <div class="modal-overlay" onclick={closeModal} onkeydown={(e) => e.key === 'Escape' && closeModal()} role="button" tabindex="-1">
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <h3>{modalMode === 'add' ? 'Nouvelle connexion' : 'Modifier la connexion'}</h3>
        <button class="btn-close" onclick={closeModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="conn-type">Type de connexion</label>
          <select id="conn-type" bind:value={formType} disabled={modalMode === 'edit'}>
            {#each Object.entries(connectionTypes) as [key, type]}
              <option value={key}>{type.name}</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label for="conn-name">Nom de la connexion</label>
          <input type="text" id="conn-name" bind:value={formName} placeholder="Ex: Production PostGIS" />
        </div>

        {#if formType === 'postgresql' || formType === 'ssh'}
          <div class="form-row">
            <div class="form-group flex-grow">
              <label for="conn-host">Hôte</label>
              <input type="text" id="conn-host" bind:value={formHost} placeholder="Ex: db.bussigny.ch" />
            </div>
            <div class="form-group" style="width: 100px;">
              <label for="conn-port">Port</label>
              <input type="number" id="conn-port" bind:value={formPort} placeholder={String(connectionTypes[formType]?.defaultPort)} />
            </div>
          </div>
        {/if}

        {#if formType === 'wms' || formType === 'wfs'}
          <div class="form-group">
            <label for="conn-url">URL du service</label>
            <input type="url" id="conn-url" bind:value={formUrl} placeholder="https://geo.bussigny.ch/geoserver/wms" />
          </div>
          <div class="form-group">
            <label for="conn-version">Version (optionnel)</label>
            <input type="text" id="conn-version" bind:value={formVersion} placeholder="1.3.0" />
          </div>
        {/if}

        {#if formType === 'postgresql'}
          <div class="form-group">
            <label for="conn-database">Base de données</label>
            <input type="text" id="conn-database" bind:value={formDatabase} placeholder="Ex: geodata" />
          </div>
        {/if}

        <div class="form-group">
          <label for="conn-username">Nom d'utilisateur</label>
          <input type="text" id="conn-username" bind:value={formUsername} placeholder="Ex: geoadmin" />
        </div>

        <div class="form-group">
          <label for="conn-password">Mot de passe</label>
          <input type="password" id="conn-password" bind:value={formPassword} placeholder={modalMode === 'edit' ? '(inchangé si vide)' : ''} />
        </div>

        {#if formType === 'ssh'}
          <div class="form-group">
            <label for="conn-privatekey">Clé privée SSH (optionnel)</label>
            <textarea id="conn-privatekey" bind:value={formPrivateKey} placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."></textarea>
          </div>
        {/if}

        {#if formType === 'postgresql'}
          <div class="form-group checkbox">
            <label>
              <input type="checkbox" bind:checked={formSsl} />
              Utiliser SSL
            </label>
          </div>
        {/if}

        {#if testResult}
          <div class="test-result" class:success={testResult.success} class:error={!testResult.success}>
            <strong>{testResult.success ? '✓' : '✗'}</strong>
            {testResult.message}
            {#if testResult.info}
              <div class="test-info">
                {#each Object.entries(testResult.info) as [key, value]}
                  {#if value}
                    <span>{key}: {value}</span>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeModal}>Annuler</button>
        <button class="btn-test" onclick={testConnection} disabled={testing}>
          {testing ? 'Test en cours...' : 'Tester'}
        </button>
        <button class="btn-primary" onclick={saveConnection}>
          {modalMode === 'add' ? 'Ajouter' : 'Enregistrer'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .connections-module {
    padding: var(--spacing-lg);
    height: 100%;
    overflow: auto;
  }

  .module-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }

  .module-header h2 {
    margin: 0;
    color: var(--text-primary);
  }

  .btn-add {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .btn-add:hover {
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .error-banner {
    background: rgba(255, 100, 100, 0.2);
    border: 1px solid #ff6464;
    color: #ff6464;
    padding: 12px;
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-md);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .error-banner button {
    background: none;
    border: none;
    color: inherit;
    font-size: 18px;
    cursor: pointer;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: var(--text-secondary);
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state p {
    margin: 8px 0;
  }

  .hint {
    font-size: 0.9em;
    opacity: 0.7;
  }

  .connections-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .connection-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    transition: all 0.2s;
  }

  .connection-card:hover {
    border-color: var(--cyber-green);
  }

  .connection-card.connected {
    border-color: var(--cyber-green);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  .conn-icon {
    font-size: 28px;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .conn-info {
    flex: 1;
  }

  .conn-name {
    font-weight: 600;
    font-size: 1.1em;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .conn-details {
    display: flex;
    gap: 8px;
    font-size: 0.9em;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .conn-type {
    background: var(--bg-secondary);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.85em;
  }

  .conn-meta {
    display: flex;
    gap: 16px;
    font-size: 0.85em;
    color: var(--text-tertiary);
  }

  .conn-status {
    color: var(--text-secondary);
  }

  .conn-status.online {
    color: var(--cyber-green);
  }

  .conn-actions {
    display: flex;
    gap: 8px;
  }

  .btn-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.2s;
  }

  .btn-icon:hover {
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .btn-connect:hover {
    background: rgba(0, 255, 136, 0.1);
  }

  .btn-disconnect:hover {
    background: rgba(255, 100, 100, 0.1);
    border-color: #ff6464;
    color: #ff6464;
  }

  .btn-delete:hover {
    background: rgba(255, 100, 100, 0.1);
    border-color: #ff6464;
    color: #ff6464;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 500px;
    max-width: 90vw;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0;
    color: var(--text-primary);
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 24px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .modal-body {
    padding: 20px;
    overflow-y: auto;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    color: var(--text-secondary);
    font-size: 0.9em;
  }

  .form-group.checkbox label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .form-row {
    display: flex;
    gap: 12px;
  }

  .flex-grow {
    flex: 1;
  }

  input, select, textarea {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
  }

  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--cyber-green);
  }

  textarea {
    min-height: 80px;
    resize: vertical;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  input[type="checkbox"] {
    width: auto;
  }

  .test-result {
    padding: 12px;
    border-radius: 6px;
    margin-top: 8px;
  }

  .test-result.success {
    background: rgba(0, 255, 136, 0.1);
    border: 1px solid var(--cyber-green);
    color: var(--cyber-green);
  }

  .test-result.error {
    background: rgba(255, 100, 100, 0.1);
    border: 1px solid #ff6464;
    color: #ff6464;
  }

  .test-info {
    margin-top: 8px;
    font-size: 0.9em;
    opacity: 0.8;
  }

  .test-info span {
    display: block;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-color);
  }

  .btn-secondary, .btn-test, .btn-primary {
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn-secondary:hover {
    border-color: var(--text-secondary);
  }

  .btn-test {
    background: transparent;
    border: 1px solid var(--cyber-green);
    color: var(--cyber-green);
  }

  .btn-test:hover:not(:disabled) {
    background: rgba(0, 255, 136, 0.1);
  }

  .btn-test:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--cyber-green);
    border: none;
    color: var(--noir-profond);
  }

  .btn-primary:hover {
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }
</style>
