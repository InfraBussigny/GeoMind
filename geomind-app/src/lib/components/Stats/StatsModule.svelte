<script lang="ts">
  import { onMount } from 'svelte';
  import {
    activeStatsTab,
    selectedConnection,
    isLoading,
    statsError,
    clearStats,
    type StatsTab
  } from '$lib/stores/statsStore';
  import AssainissementTab from './tabs/AssainissementTab.svelte';
  import CadastreTab from './tabs/CadastreTab.svelte';
  import GeneralTab from './tabs/GeneralTab.svelte';

  interface Connection {
    id: string;
    name: string;
    host: string;
    database: string;
  }

  let connections: Connection[] = [];
  let loadingConnections = true;

  const tabs: { id: StatsTab; label: string; icon: string; description: string }[] = [
    { id: 'assainissement', label: 'Assainissement', icon: '🚰', description: 'Collecteurs & Chambres' },
    { id: 'cadastre', label: 'Cadastre', icon: '🗺️', description: 'Parcelles & Propriétaires' },
    { id: 'general', label: 'Général', icon: '📊', description: 'Requêtes personnalisées' }
  ];

  onMount(async () => {
    await loadConnections();
  });

  async function loadConnections() {
    loadingConnections = true;
    try {
      const response = await fetch('http://localhost:3001/api/connections');
      if (response.ok) {
        connections = await response.json();
        // Sélectionner la première connexion par défaut si aucune n'est sélectionnée
        if (connections.length > 0 && !$selectedConnection) {
          $selectedConnection = connections[0].id;
        }
      }
    } catch (error) {
      console.error('Erreur chargement connexions:', error);
    } finally {
      loadingConnections = false;
    }
  }

  function handleConnectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    $selectedConnection = target.value || null;
    clearStats();
  }

  function handleTabChange(tabId: StatsTab) {
    $activeStatsTab = tabId;
  }
</script>

<div class="stats-module">
  <header class="module-header">
    <div class="header-left">
      <h1>
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 20V10M12 20V4M6 20v-6"/>
        </svg>
        Statistiques
      </h1>
      <span class="subtitle">Analyse des géodonnées</span>
    </div>

    <div class="header-right">
      <div class="connection-selector">
        <label for="conn-select">Base de données:</label>
        {#if loadingConnections}
          <span class="loading-text">Chargement...</span>
        {:else}
          <select
            id="conn-select"
            value={$selectedConnection || ''}
            onchange={handleConnectionChange}
            disabled={connections.length === 0}
          >
            {#if connections.length === 0}
              <option value="">Aucune connexion</option>
            {:else}
              {#each connections as conn}
                <option value={conn.id}>{conn.name} ({conn.database})</option>
              {/each}
            {/if}
          </select>
        {/if}

        <button class="refresh-btn" onclick={loadConnections} title="Rafraîchir">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </button>
      </div>
    </div>
  </header>

  <nav class="tabs-nav">
    {#each tabs as tab}
      <button
        class="tab-btn"
        class:active={$activeStatsTab === tab.id}
        onclick={() => handleTabChange(tab.id)}
      >
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-label">{tab.label}</span>
        <span class="tab-desc">{tab.description}</span>
      </button>
    {/each}
  </nav>

  <main class="module-content">
    {#if !$selectedConnection}
      <div class="no-connection">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
        <p>Sélectionnez une connexion pour afficher les statistiques</p>
      </div>
    {:else if $isLoading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Chargement des données...</p>
      </div>
    {:else if $statsError}
      <div class="error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M15 9l-6 6M9 9l6 6"/>
        </svg>
        <p>{$statsError}</p>
        <button onclick={() => $statsError = null}>Réessayer</button>
      </div>
    {:else}
      {#if $activeStatsTab === 'assainissement'}
        <AssainissementTab connectionId={$selectedConnection} />
      {:else if $activeStatsTab === 'cadastre'}
        <CadastreTab connectionId={$selectedConnection} />
      {:else if $activeStatsTab === 'general'}
        <GeneralTab connectionId={$selectedConnection} />
      {/if}
    {/if}
  </main>
</div>

<style>
  .stats-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary, #0f1419);
    color: var(--text-primary, #e0e6ff);
  }

  .module-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: var(--noir-surface, #151b26);
    border-bottom: 1px solid var(--border-color, #2d3748);
  }

  .header-left h1 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .header-icon {
    width: 24px;
    height: 24px;
    stroke: var(--cyber-green, #00ff88);
  }

  .subtitle {
    display: block;
    font-size: 0.85rem;
    color: var(--text-muted, #606d8a);
    margin-top: 4px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .connection-selector {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .connection-selector label {
    font-size: 0.85rem;
    color: var(--text-secondary, #a0aac0);
  }

  .connection-selector select {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-color, #2d3748);
    background: var(--noir-card, #1a2332);
    color: var(--text-primary, #e0e6ff);
    font-size: 0.9rem;
    min-width: 200px;
  }

  .loading-text {
    font-size: 0.85rem;
    color: var(--text-muted, #606d8a);
  }

  .refresh-btn {
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--border-color, #2d3748);
    background: var(--noir-card, #1a2332);
    color: var(--text-secondary, #a0aac0);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-btn:hover {
    background: var(--noir-surface, #151b26);
    color: var(--cyber-green, #00ff88);
  }

  .refresh-btn svg {
    width: 16px;
    height: 16px;
  }

  .tabs-nav {
    display: flex;
    gap: 4px;
    padding: 12px 24px;
    background: var(--noir-surface, #151b26);
    border-bottom: 1px solid var(--border-color, #2d3748);
  }

  .tab-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 12px 20px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary, #a0aac0);
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    background: var(--noir-card, #1a2332);
  }

  .tab-btn.active {
    background: var(--noir-card, #1a2332);
    border-color: var(--cyber-green, #00ff88);
    color: var(--text-primary, #e0e6ff);
  }

  .tab-icon {
    font-size: 1.2rem;
    margin-bottom: 4px;
  }

  .tab-label {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .tab-desc {
    font-size: 0.75rem;
    color: var(--text-muted, #606d8a);
    margin-top: 2px;
  }

  .tab-btn.active .tab-desc {
    color: var(--text-secondary, #a0aac0);
  }

  .module-content {
    flex: 1;
    overflow: auto;
    padding: 24px;
  }

  .no-connection,
  .loading,
  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--text-muted, #606d8a);
  }

  .no-connection svg,
  .error svg {
    width: 48px;
    height: 48px;
    opacity: 0.5;
  }

  .error svg {
    stroke: #e74c3c;
  }

  .error button {
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    background: var(--cyber-green, #00ff88);
    color: #000;
    font-weight: 600;
    cursor: pointer;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color, #2d3748);
    border-top-color: var(--cyber-green, #00ff88);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
