<script lang="ts">
  import { onMount } from 'svelte';
  import { appMode, databasesReadOnly } from '$lib/stores/app';

  // Sub-components (will be created)
  import SchemaViewer from './SchemaViewer.svelte';
  import SqlAssistant from './SqlAssistant.svelte';
  import TestEnvironment from './TestEnvironment.svelte';
  import MockDataGenerator from './MockDataGenerator.svelte';
  import DocGenerator from './DocGenerator.svelte';

  // Types
  interface Connection {
    id: string;
    name: string;
    type: string;
    host: string;
    port: number;
    database: string;
    status: 'connected' | 'disconnected' | 'error';
  }

  type TabType = 'schema' | 'sql' | 'test' | 'mock' | 'docs';

  // State
  let activeTab = $state<TabType>('schema');
  let connections = $state<Connection[]>([]);
  let selectedConnection = $state<string | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Mode lecture seule (mode standard/professionnel)
  let readOnly = $derived($databasesReadOnly);

  // Tabs configuration - certains onglets masqués en mode lecture seule
  const allTabs: { id: TabType; label: string; icon: string; description: string; requiresWrite: boolean }[] = [
    { id: 'schema', label: 'Schema', icon: '🗂️', description: 'Visualisation ERD', requiresWrite: false },
    { id: 'sql', label: 'SQL Assistant', icon: '🤖', description: 'Text-to-SQL', requiresWrite: true },
    { id: 'test', label: 'Test Env', icon: '🧪', description: 'Clone & Sandbox', requiresWrite: true },
    { id: 'mock', label: 'Mock Data', icon: '🎲', description: 'Generateur', requiresWrite: true },
    { id: 'docs', label: 'Documentation', icon: '📚', description: 'Auto-doc', requiresWrite: false },
  ];

  // Tabs visibles selon le mode
  let tabs = $derived(readOnly ? allTabs.filter(t => !t.requiresWrite) : allTabs);

  // Load PostgreSQL connections
  async function loadConnections() {
    loading = true;
    error = null;
    try {
      const res = await fetch('http://localhost:3001/api/connections');
      if (!res.ok) throw new Error('Failed to load connections');
      const data = await res.json();
      // Filter only PostgreSQL connections
      connections = data.filter((c: any) => c.type === 'postgresql');
      if (connections.length > 0 && !selectedConnection) {
        selectedConnection = connections[0].id;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadConnections();
  });
</script>

<div class="databases-module">
  <!-- Header -->
  <header class="module-header">
    <div class="header-title">
      <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 5v6c0 1.66-4 3-9 3s-9-1.34-9-3V5"/>
        <path d="M21 11v6c0 1.66-4 3-9 3s-9-1.34-9-3v-6"/>
      </svg>
      <div>
        <h1>
          Databases
          {#if readOnly}
            <span class="readonly-badge">LECTURE SEULE</span>
          {/if}
        </h1>
        <span class="subtitle">Schema{#if !readOnly}, SQL Assistant{/if} & Documentation</span>
      </div>
    </div>

    <!-- Connection selector -->
    <div class="connection-selector">
      <label for="db-connection">Connexion:</label>
      <select id="db-connection" bind:value={selectedConnection} disabled={loading}>
        {#if connections.length === 0}
          <option value="">Aucune connexion PostgreSQL</option>
        {:else}
          {#each connections as conn}
            <option value={conn.id}>{conn.name} ({conn.database})</option>
          {/each}
        {/if}
      </select>
      <button class="refresh-btn" onclick={loadConnections} title="Rafraichir les connexions">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- Tabs -->
  <nav class="tabs-nav">
    {#each tabs as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.id}
        onclick={() => activeTab = tab.id}
        title={tab.description}
      >
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-label">{tab.label}</span>
      </button>
    {/each}
  </nav>

  <!-- Content -->
  <main class="module-content">
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Chargement des connexions...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>{error}</p>
        <button onclick={loadConnections}>Reessayer</button>
      </div>
    {:else if !selectedConnection}
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M21 5v6c0 1.66-4 3-9 3s-9-1.34-9-3V5"/>
          <path d="M21 11v6c0 1.66-4 3-9 3s-9-1.34-9-3v-6"/>
        </svg>
        <h2>Aucune connexion PostgreSQL</h2>
        <p>Ajoutez une connexion PostgreSQL dans le module Connexions pour commencer.</p>
      </div>
    {:else}
      {#if activeTab === 'schema'}
        <SchemaViewer connectionId={selectedConnection} />
      {:else if activeTab === 'sql'}
        <SqlAssistant connectionId={selectedConnection} />
      {:else if activeTab === 'test'}
        <TestEnvironment connectionId={selectedConnection} />
      {:else if activeTab === 'mock'}
        <MockDataGenerator connectionId={selectedConnection} />
      {:else if activeTab === 'docs'}
        <DocGenerator connectionId={selectedConnection} />
      {/if}
    {/if}
  </main>
</div>

<style>
  .databases-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .module-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-icon {
    width: 40px;
    height: 40px;
    color: var(--cyber-green);
    filter: drop-shadow(0 0 8px var(--cyber-green-glow));
  }

  .header-title h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-bright);
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .readonly-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 12px;
    padding: 4px 10px;
    background: rgba(255, 193, 7, 0.15);
    border: 1px solid rgba(255, 193, 7, 0.4);
    border-radius: 4px;
    font-size: 0.75rem;
    color: #ffc107;
    font-family: var(--font-mono);
  }

  .connection-selector {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .connection-selector label {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .connection-selector select {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-card);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 0.9rem;
    min-width: 200px;
  }

  .connection-selector select:focus {
    outline: none;
    border-color: var(--cyber-green);
    box-shadow: 0 0 0 2px var(--cyber-green-glow);
  }

  .refresh-btn {
    width: 36px;
    height: 36px;
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-card);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-btn:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .refresh-btn svg {
    width: 100%;
    height: 100%;
  }

  .tabs-nav {
    display: flex;
    gap: 4px;
    padding: 8px 24px;
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    font-family: var(--font-mono);
    font-size: 0.9rem;
  }

  .tab-btn:hover {
    background: var(--bg-hover);
    color: var(--text-bright);
  }

  .tab-btn.active {
    background: rgba(0, 255, 136, 0.1);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .tab-icon {
    font-size: 1.1rem;
  }

  .module-content {
    flex: 1;
    overflow: auto;
    padding: 24px;
  }

  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--text-muted);
  }

  .loading-state svg,
  .error-state svg,
  .empty-state svg {
    width: 64px;
    height: 64px;
    opacity: 0.5;
  }

  .error-state svg {
    color: var(--danger);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--cyber-green);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state h2 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--text-secondary);
  }

  .empty-state p {
    margin: 0;
    max-width: 400px;
    text-align: center;
  }

  .error-state button {
    padding: 8px 16px;
    border: 1px solid var(--cyber-green);
    border-radius: 6px;
    background: transparent;
    color: var(--cyber-green);
    cursor: pointer;
    font-family: var(--font-mono);
    transition: all 0.2s;
  }

  .error-state button:hover {
    background: var(--cyber-green);
    color: var(--noir-profond);
  }
</style>
