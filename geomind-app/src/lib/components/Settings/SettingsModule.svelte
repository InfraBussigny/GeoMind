<script lang="ts">
  import { onMount } from 'svelte';
  import { providers, backendConnected, appMode, glitchSettings, moduleConfig, ALL_MODULES, type ModuleType } from '$lib/stores/app';
  import { portalConfig, type PortalConfig } from '$lib/stores/portalConfig';
  import { getProviders, saveProviderConfig } from '$lib/services/api';
  import ThemeToggle from '../ThemeToggle.svelte';

  // Portal configuration drag state
  let draggedPortalIndex = $state<number | null>(null);

  // Système d'onglets pour organiser les paramètres
  type SettingsTab = 'general' | 'ia' | 'connections' | 'advanced';
  let activeTab = $state<SettingsTab>('general');

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'general', label: 'Général', icon: '⚙️' },
    { id: 'ia', label: 'Intelligence Artificielle', icon: '🤖' },
    { id: 'connections', label: 'Connexions', icon: '🔌' },
    { id: 'advanced', label: 'Avancé', icon: '🔧' }
  ];

  // Types
  interface Connection {
    id: string;
    name: string;
    type: string;
    host?: string;
    url?: string;
    port?: number;
    database?: string;
    username?: string;
    lastUsed?: string;
    status: 'connected' | 'disconnected';
  }

  interface ConnectionType {
    name: string;
    icon: string;
    defaultPort: number;
    fields: string[];
  }

  let apiKeys = $state<Record<string, string>>({});
  let saving = $state<Record<string, boolean>>({});
  let saved = $state<Record<string, boolean>>({});
  let memorySummary = $state<any>(null);
  let serverStatus = $state<any>(null);
  let restarting = $state(false);
  let restartError = $state<string | null>(null);

  // Connexions DB
  let connections = $state<Connection[]>([]);
  let connectionTypes = $state<Record<string, ConnectionType>>({});
  let showConnectionForm = $state(false);
  let editingConnection = $state<Connection | null>(null);
  let connectionForm = $state({
    name: '',
    type: 'postgresql',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    url: '',
    ssl: false
  });
  let testingConnection = $state(false);
  let testResult = $state<{ success: boolean; message: string; info?: any } | null>(null);
  let savingConnection = $state(false);
  let connectingId = $state<string | null>(null);

  // Module visibility configuration
  let configMode = $state<'expert' | 'god' | 'bfsa'>('expert');

  onMount(async () => {
    await loadProviders();
    await loadMemorySummary();
    await loadServerStatus();
    await loadConnections();
    await loadConnectionTypes();
  });

  async function loadProviders() {
    try {
      const loaded = await getProviders();
      providers.set(loaded);
      backendConnected.set(true);
    } catch (error) {
      backendConnected.set(false);
    }
  }

  async function loadMemorySummary() {
    try {
      const response = await fetch('http://localhost:3001/api/memory');
      if (response.ok) {
        memorySummary = await response.json();
      }
    } catch (error) {
      console.error('Error loading memory:', error);
    }
  }

  async function saveApiKey(providerId: string) {
    const key = apiKeys[providerId];
    if (!key?.trim()) return;

    saving[providerId] = true;
    saved[providerId] = false;

    try {
      await saveProviderConfig(providerId, key.trim());
      await loadProviders();
      saved[providerId] = true;
      setTimeout(() => { saved[providerId] = false; }, 3000);
    } catch (error) {
      console.error('Error saving API key:', error);
    } finally {
      saving[providerId] = false;
    }
  }

  async function reloadMemory() {
    try {
      await fetch('http://localhost:3001/api/memory/reload', { method: 'POST' });
      await loadMemorySummary();
    } catch (error) {
      console.error('Error reloading memory:', error);
    }
  }

  async function loadServerStatus() {
    try {
      const response = await fetch('http://localhost:3001/api/server/status');
      if (response.ok) {
        serverStatus = await response.json();
      }
    } catch (error) {
      console.error('Error loading server status:', error);
      serverStatus = null;
    }
  }

  async function restartServer() {
    if ($appMode === 'standard') {
      restartError = 'Mode expert ou god requis pour redémarrer le serveur';
      return;
    }

    restarting = true;
    restartError = null;

    try {
      const response = await fetch('http://localhost:3001/api/server/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: $appMode })
      });

      if (response.ok) {
        // Attendre que le serveur redémarre
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Polling pour vérifier que le serveur est de retour
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
          try {
            await loadServerStatus();
            if (serverStatus) {
              backendConnected.set(true);
              break;
            }
          } catch {
            // Serveur pas encore prêt
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }

        if (attempts >= maxAttempts) {
          restartError = 'Le serveur n\'a pas redémarré. Vérifiez la console.';
          backendConnected.set(false);
        }
      } else {
        const data = await response.json();
        restartError = data.error || 'Erreur lors du redémarrage';
      }
    } catch (error) {
      restartError = 'Connexion perdue. Redémarrage en cours...';
      // C'est normal, le serveur s'est arrêté
      backendConnected.set(false);

      // Attendre et vérifier que le serveur revient
      await new Promise(resolve => setTimeout(resolve, 3000));

      let attempts = 0;
      while (attempts < 10) {
        try {
          await loadServerStatus();
          if (serverStatus) {
            backendConnected.set(true);
            restartError = null;
            break;
          }
        } catch {
          // Pas encore prêt
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    } finally {
      restarting = false;
    }
  }

  function formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  function formatMemory(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function getProviderColor(providerId: string): string {
    const colors: Record<string, string> = {
      claude: '#D97706',
      openai: '#10A37F',
      mistral: '#FF6B35',
      deepseek: '#0066FF',
      perplexity: '#6366F1',
      groq: '#F55036'
    };
    return colors[providerId] || '#666';
  }

  function getProviderIcon(providerId: string): string {
    const icons: Record<string, string> = {
      claude: 'C',
      openai: 'O',
      mistral: 'M',
      deepseek: 'D',
      perplexity: 'P',
      groq: 'G'
    };
    return icons[providerId] || '?';
  }

  // === Connexions DB ===
  async function loadConnections() {
    try {
      const response = await fetch('http://localhost:3001/api/connections');
      if (response.ok) {
        connections = await response.json();
      }
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  }

  async function loadConnectionTypes() {
    try {
      const response = await fetch('http://localhost:3001/api/connections/types');
      if (response.ok) {
        connectionTypes = await response.json();
      }
    } catch (error) {
      console.error('Error loading connection types:', error);
    }
  }

  function openNewConnectionForm() {
    editingConnection = null;
    connectionForm = {
      name: '',
      type: 'postgresql',
      host: '',
      port: 5432,
      database: '',
      username: '',
      password: '',
      url: '',
      ssl: false
    };
    testResult = null;
    showConnectionForm = true;
  }

  function openEditConnectionForm(conn: Connection) {
    editingConnection = conn;
    connectionForm = {
      name: conn.name,
      type: conn.type,
      host: conn.host || '',
      port: conn.port || connectionTypes[conn.type]?.defaultPort || 5432,
      database: conn.database || '',
      username: conn.username || '',
      password: '',
      url: conn.url || '',
      ssl: false
    };
    testResult = null;
    showConnectionForm = true;
  }

  function closeConnectionForm() {
    showConnectionForm = false;
    editingConnection = null;
    testResult = null;
  }

  function onTypeChange() {
    const type = connectionForm.type;
    if (connectionTypes[type]) {
      connectionForm.port = connectionTypes[type].defaultPort;
    }
  }

  async function testCurrentConnection() {
    testingConnection = true;
    testResult = null;

    try {
      const response = await fetch('http://localhost:3001/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionForm)
      });

      testResult = await response.json();
    } catch (error) {
      testResult = { success: false, message: 'Erreur de connexion au backend' };
    } finally {
      testingConnection = false;
    }
  }

  async function saveConnection() {
    savingConnection = true;

    try {
      const url = editingConnection
        ? `http://localhost:3001/api/connections/${editingConnection.id}`
        : 'http://localhost:3001/api/connections';

      const method = editingConnection ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionForm)
      });

      if (response.ok) {
        await loadConnections();
        closeConnectionForm();
      } else {
        const data = await response.json();
        testResult = { success: false, message: data.error || 'Erreur lors de la sauvegarde' };
      }
    } catch (error) {
      testResult = { success: false, message: 'Erreur de connexion au backend' };
    } finally {
      savingConnection = false;
    }
  }

  async function deleteConnection(id: string) {
    if (!confirm('Supprimer cette connexion ?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/connections/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadConnections();
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
    }
  }

  async function toggleConnection(conn: Connection) {
    connectingId = conn.id;

    try {
      const endpoint = conn.status === 'connected' ? 'disconnect' : 'connect';
      const response = await fetch(`http://localhost:3001/api/connections/${conn.id}/${endpoint}`, {
        method: 'POST'
      });

      if (response.ok) {
        await loadConnections();
      }
    } catch (error) {
      console.error('Error toggling connection:', error);
    } finally {
      connectingId = null;
    }
  }

  function getConnectionIcon(type: string): string {
    const icons: Record<string, string> = {
      postgresql: '🐘',
      ssh: '🔐',
      wms: '🗺️',
      wfs: '📍'
    };
    return icons[type] || '💾';
  }

  function formatLastUsed(dateStr?: string): string {
    if (!dateStr) return 'Jamais';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<div class="settings-module">
  <header class="settings-header">
    <h1>Parametres</h1>
    <p>Configuration de GeoMind</p>
  </header>

  <!-- Barre d'onglets -->
  <div class="settings-tabs">
    {#each tabs as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.id}
        onclick={() => activeTab = tab.id}
      >
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-label">{tab.label}</span>
      </button>
    {/each}
  </div>

  <div class="settings-content">
    <!-- ================================================ -->
    <!-- ONGLET GÉNÉRAL -->
    <!-- ================================================ -->
    {#if activeTab === 'general'}
    <!-- A Propos Section - Always visible -->
    <section class="settings-section about-section">
      <h2>A propos</h2>
      <div class="about-info">
        <div class="about-logo">
          <img src="/images/Logo_GeoMind.png" alt="GeoMind" class="about-logo-img" />
        </div>
        <div class="about-details">
          <h3>GeoMind</h3>
          <p class="about-subtitle">Spatial Intelligence</p>
          <p class="about-version">Version 1.0.0</p>
          <p class="about-description">
            Assistant IA specialise en geodonnees et systemes d'information du territoire (SIT).
          </p>
          <p class="about-mode">
            Mode actuel : <span class="mode-badge {$appMode}">{$appMode}</span>
          </p>
        </div>
      </div>
    </section>

    <!-- Theme Section - Always visible -->
    <section class="settings-section theme-section">
      <h2>Apparence</h2>
      <div class="theme-options">
        <p class="section-description">Choisissez le theme de l'interface</p>
        <div class="theme-toggle-container">
          <span class="theme-label">Theme clair/sombre</span>
          <div class="theme-toggle-wrapper">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </section>
    {/if}

    <!-- ================================================ -->
    <!-- ONGLET IA -->
    <!-- ================================================ -->
    {#if activeTab === 'ia'}
    <!-- Ollama Models Section -->
    <section class="settings-section ollama-section">
      <h2>Modele IA Local</h2>
      <p class="section-description">
        GeoMind utilise Ollama pour l'IA locale. Selectionnez le modele a utiliser.
      </p>
      <div class="ollama-info">
        <div class="ollama-status">
          <span class="status-label">Provider actif :</span>
          <span class="status-value">Ollama (Local)</span>
        </div>
        <div class="ollama-model">
          <span class="status-label">Modele par defaut :</span>
          <span class="status-value">qwen2.5:14b</span>
        </div>
        <p class="ollama-note">
          Les modeles Ollama s'executent localement sur votre machine, sans envoi de donnees vers le cloud.
        </p>
      </div>
    </section>

    <!-- API Keys Section -->
    <section class="settings-section">
      <h2>Cles API Providers</h2>
      <p class="section-description">
        Configurez vos cles API pour chaque provider cloud. Les cles sont stockees localement de maniere securisee.
      </p>

      <div class="providers-list">
        {#each $providers as provider}
          <div class="provider-card" class:configured={provider.isConfigured}>
            <div class="provider-header">
              <span class="provider-badge" style="background: {getProviderColor(provider.id)}">
                {getProviderIcon(provider.id)}
              </span>
              <div class="provider-info">
                <h3>{provider.name}</h3>
                {#if provider.isConfigured}
                  <span class="status-badge configured">{provider.authMethod}</span>
                {:else}
                  <span class="status-badge">Non configure</span>
                {/if}
              </div>
            </div>

            {#if provider.authType === 'apikey'}
              <div class="api-key-form">
                <input
                  type="password"
                  placeholder="sk-..."
                  bind:value={apiKeys[provider.id]}
                  class="api-key-input"
                />
                <button
                  class="btn-primary"
                  onclick={() => saveApiKey(provider.id)}
                  disabled={saving[provider.id] || !apiKeys[provider.id]?.trim()}
                >
                  {#if saving[provider.id]}
                    Enregistrement...
                  {:else if saved[provider.id]}
                    Enregistre !
                  {:else}
                    Enregistrer
                  {/if}
                </button>
              </div>
              <p class="provider-help">
                {#if provider.id === 'claude'}
                  Obtenez votre cle sur <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>
                {:else if provider.id === 'openai'}
                  Obtenez votre cle sur <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>
                {:else if provider.id === 'mistral'}
                  Obtenez votre cle sur <a href="https://console.mistral.ai" target="_blank">console.mistral.ai</a>
                {:else if provider.id === 'deepseek'}
                  Obtenez votre cle sur <a href="https://platform.deepseek.com" target="_blank">platform.deepseek.com</a>
                {:else if provider.id === 'perplexity'}
                  Obtenez votre cle sur <a href="https://www.perplexity.ai/settings/api" target="_blank">perplexity.ai/settings/api</a>
                {:else if provider.id === 'groq'}
                  <strong>GRATUIT!</strong> Obtenez votre cle sur <a href="https://console.groq.com/keys" target="_blank">console.groq.com</a> - Inference ultra-rapide avec tool use
                {/if}
              </p>
            {:else}
              <p class="provider-help oauth-note">
                Ce provider utilise l'authentification OAuth. Lancez <code>claude login</code> dans le terminal.
              </p>
            {/if}

            <div class="provider-models">
              <span class="models-label">Modeles disponibles :</span>
              {#each provider.models as model}
                <span class="model-tag" class:default={model.default}>{model.name}</span>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </section>
    {/if}

    <!-- ================================================ -->
    <!-- ONGLET CONNEXIONS -->
    <!-- ================================================ -->
    {#if activeTab === 'connections'}
    <!-- Connections Status -->
    <section class="settings-section connections-status-section">
      <h2>Etat des connexions</h2>
      <p class="section-description">
        Statut des connexions aux serveurs de donnees
        {#if $appMode === 'standard'}
          <span class="readonly-badge">(lecture seule)</span>
        {/if}
      </p>
      {#if connections.length > 0}
        <div class="connections-status-list">
          {#each connections as conn}
            <div class="connection-status-item">
              <span class="conn-icon">{getConnectionIcon(conn.type)}</span>
              <span class="conn-name">{conn.name}</span>
              <span class="conn-type">{conn.type}</span>
              <span class="conn-status" class:connected={conn.status === 'connected'}>
                {conn.status === 'connected' ? 'Connecte' : 'Deconnecte'}
              </span>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-muted">Aucune connexion configuree</p>
      {/if}
    </section>

    <!-- Server Section - Expert/God only -->
    {#if $appMode !== 'standard'}
      <section class="settings-section server-section">
        <div class="section-header">
          <h2>Serveur Backend</h2>
          <button
            class="btn-restart"
            onclick={restartServer}
            disabled={restarting}
          >
            {#if restarting}
              <span class="spinner"></span>
              Redemarrage...
            {:else}
              Redemarrer
            {/if}
          </button>
        </div>

        {#if restartError}
          <div class="restart-error">{restartError}</div>
        {/if}

        {#if serverStatus}
          <div class="server-info">
            <div class="server-stat">
              <span class="stat-label">Statut</span>
              <span class="stat-value status-running">En ligne</span>
            </div>
            <div class="server-stat">
              <span class="stat-label">Uptime</span>
              <span class="stat-value">{formatUptime(serverStatus.uptime)}</span>
            </div>
            <div class="server-stat">
              <span class="stat-label">Memoire</span>
              <span class="stat-value">{formatMemory(serverStatus.memoryUsage?.heapUsed || 0)}</span>
            </div>
            <div class="server-stat">
              <span class="stat-label">Node.js</span>
              <span class="stat-value">{serverStatus.nodeVersion}</span>
            </div>
            <div class="server-stat">
              <span class="stat-label">PID</span>
              <span class="stat-value">{serverStatus.pid}</span>
            </div>
          </div>
        {:else}
          <div class="server-offline">
            <span class="offline-icon">&#x26A0;</span>
            Serveur hors ligne ou inaccessible
          </div>
        {/if}

        <p class="server-note">
          Le redemarrage applique les modifications du code backend (security, endpoints, etc.)
        </p>
      </section>
    {/if}

    <!-- Connections Management Section - Expert/God only -->
    {#if $appMode !== 'standard'}
      <section class="settings-section connections-section">
        <div class="section-header">
          <h2>Gestion des connexions</h2>
          <button class="btn-primary" onclick={openNewConnectionForm}>
            + Nouvelle
          </button>
        </div>

        {#if connections.length === 0}
          <div class="no-connections">
            <span class="no-conn-icon">🔌</span>
            <p>Aucune connexion configuree</p>
            <p class="hint">Ajoutez des connexions PostgreSQL, SSH ou WMS/WFS</p>
          </div>
        {:else}
          <div class="connections-list">
            {#each connections as conn}
              <div class="connection-card" class:connected={conn.status === 'connected'}>
                <div class="conn-header">
                  <span class="conn-icon">{getConnectionIcon(conn.type)}</span>
                  <div class="conn-info">
                    <h4>{conn.name}</h4>
                    <span class="conn-type">{connectionTypes[conn.type]?.name || conn.type}</span>
                  </div>
                  <span class="conn-status" class:online={conn.status === 'connected'}>
                    {conn.status === 'connected' ? 'Connecte' : 'Deconnecte'}
                  </span>
                </div>

                <div class="conn-details">
                  {#if conn.host}
                    <span class="conn-detail"><strong>Hote:</strong> {conn.host}:{conn.port}</span>
                  {/if}
                  {#if conn.database}
                    <span class="conn-detail"><strong>Base:</strong> {conn.database}</span>
                  {/if}
                  {#if conn.url}
                    <span class="conn-detail"><strong>URL:</strong> {conn.url}</span>
                  {/if}
                  <span class="conn-detail"><strong>Dernier usage:</strong> {formatLastUsed(conn.lastUsed)}</span>
                </div>

                <div class="conn-actions">
                  <button
                    class="btn-conn"
                    class:btn-connect={conn.status !== 'connected'}
                    class:btn-disconnect={conn.status === 'connected'}
                    onclick={() => toggleConnection(conn)}
                    disabled={connectingId === conn.id}
                  >
                    {#if connectingId === conn.id}
                      <span class="spinner-sm"></span>
                    {:else if conn.status === 'connected'}
                      Deconnecter
                    {:else}
                      Connecter
                    {/if}
                  </button>
                  <button class="btn-icon" onclick={() => openEditConnectionForm(conn)} title="Modifier">
                    ✏️
                  </button>
                  <button class="btn-icon btn-danger" onclick={() => deleteConnection(conn.id)} title="Supprimer">
                    🗑️
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
    {/if}

    <!-- ================================================ -->
    <!-- ONGLET AVANCÉ -->
    <!-- ================================================ -->
    {#if activeTab === 'advanced'}
    <!-- Module Visibility Configuration - Expert/God/BFSA only -->
    {#if $appMode !== 'standard'}
      <section class="settings-section modules-config-section">
        <h2>Modules visibles par mode</h2>
        <p class="section-description">
          Configurez quels modules sont disponibles dans chaque mode d'utilisation.
          Le mode Standard (professionnel) a des modules fixes et ne peut pas etre modifie.
        </p>

        <div class="mode-selector">
          <button
            class="mode-btn"
            class:active={configMode === 'expert'}
            onclick={() => configMode = 'expert'}
          >Expert</button>
          <button
            class="mode-btn"
            class:active={configMode === 'god'}
            onclick={() => configMode = 'god'}
          >God</button>
          <button
            class="mode-btn"
            class:active={configMode === 'bfsa'}
            onclick={() => configMode = 'bfsa'}
          >BFSA</button>
        </div>

        <div class="modules-grid">
          {#each ALL_MODULES as mod}
            <label class="module-toggle" class:disabled={mod.alwaysVisible}>
              <input
                type="checkbox"
                checked={$moduleConfig[configMode]?.includes(mod.id) || mod.alwaysVisible}
                disabled={mod.alwaysVisible}
                onchange={() => moduleConfig.toggleModule(configMode, mod.id)}
              />
              <span class="module-info">
                <span class="module-label">{mod.label}</span>
                <span class="module-desc">{mod.description}</span>
              </span>
              {#if mod.alwaysVisible}
                <span class="always-visible-badge">obligatoire</span>
              {/if}
            </label>
          {/each}
        </div>

        <div class="config-actions">
          <button class="btn-reset-config" onclick={() => moduleConfig.reset(configMode)}>
            Reinitialiser {configMode}
          </button>
          <button class="btn-reset-all" onclick={() => moduleConfig.reset()}>
            Tout reinitialiser
          </button>
        </div>
      </section>
    {/if}

    <!-- Portal Search Configuration -->
    <section class="settings-section portal-config-section">
      <h2>Configuration des portails de recherche</h2>
      <p class="section-description">
        Configurez l'ordre et l'activation des portails dans la recherche universelle du module Cartes.
        Glissez-deposez pour reordonner. Le portail par defaut s'ouvre avec Entree.
      </p>

      <div class="portal-list">
        {#each $portalConfig as portal, index (portal.id)}
          <div
            class="portal-item"
            class:dragging={draggedPortalIndex === index}
            class:disabled={!portal.enabled}
            draggable="true"
            ondragstart={(e) => {
              draggedPortalIndex = index;
              e.dataTransfer?.setData('text/plain', index.toString());
            }}
            ondragend={() => { draggedPortalIndex = null; }}
            ondragover={(e) => { e.preventDefault(); }}
            ondrop={(e) => {
              e.preventDefault();
              const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') || '0');
              if (fromIndex !== index) {
                portalConfig.reorder(fromIndex, index);
              }
              draggedPortalIndex = null;
            }}
          >
            <span class="drag-handle" title="Glisser pour reordonner">≡</span>

            <label class="portal-checkbox">
              <input
                type="checkbox"
                checked={portal.enabled}
                onchange={() => portalConfig.toggle(portal.id)}
              />
            </label>

            <span class="portal-name" class:is-default={portal.isDefault}>
              {#if portal.isDefault}
                <span class="default-star" title="Portail par defaut">★</span>
              {/if}
              {portal.name}
            </span>

            <span class="portal-types">
              {portal.relevantFor.slice(0, 3).join(', ')}
              {#if portal.relevantFor.length > 3}...{/if}
            </span>

            <button
              class="btn-set-default"
              class:active={portal.isDefault}
              onclick={() => portalConfig.setDefault(portal.id)}
              title={portal.isDefault ? 'Portail par defaut' : 'Definir par defaut'}
              disabled={!portal.enabled}
            >
              {portal.isDefault ? '★' : '☆'}
            </button>
          </div>
        {/each}
      </div>

      <div class="portal-actions">
        <button class="btn-reset-portals" onclick={() => portalConfig.reset()}>
          Reinitialiser l'ordre
        </button>
      </div>
    </section>

    <!-- Glitch Effects Section - God mode or Easter Egg unlocked -->
    {#if $appMode === 'god' || $glitchSettings.unlockedByEasterEgg}
      <section class="settings-section glitch-section">
        <div class="section-header">
          <h2>Effets Visuels</h2>
          <button
            class="btn-toggle"
            class:active={$glitchSettings.enabled}
            onclick={() => glitchSettings.toggle()}
          >
            {$glitchSettings.enabled ? 'Actif' : 'Inactif'}
          </button>
        </div>

        <p class="section-description">
          Controle des effets glitch de l'interface. Ces effets ajoutent une atmosphere cyberpunk.
          {#if $glitchSettings.unlockedByEasterEgg && $appMode !== 'god'}
            <span class="easter-egg-badge">Easter egg</span>
          {/if}
        </p>

        <div class="glitch-controls" class:disabled={!$glitchSettings.enabled}>
          <div class="glitch-control">
            <label>
              <span class="control-label">Frequence</span>
              <span class="control-value">{$glitchSettings.frequency}/10</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={$glitchSettings.frequency}
              oninput={(e) => glitchSettings.setFrequency(parseInt(e.currentTarget.value))}
              disabled={!$glitchSettings.enabled}
            />
            <div class="control-hints">
              <span>Rare</span>
              <span>Frequent</span>
            </div>
          </div>

          <div class="glitch-control">
            <label>
              <span class="control-label">Intensite</span>
              <span class="control-value">{$glitchSettings.intensity}/10</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={$glitchSettings.intensity}
              oninput={(e) => glitchSettings.setIntensity(parseInt(e.currentTarget.value))}
              disabled={!$glitchSettings.enabled}
            />
            <div class="control-hints">
              <span>Subtil</span>
              <span>Intense</span>
            </div>
          </div>
        </div>

        <button class="btn-reset" onclick={() => glitchSettings.reset()}>
          Reinitialiser
        </button>
      </section>
    {/if}

    <!-- Memory Section -->
    <section class="settings-section">
      <div class="section-header">
        <h2>Memoire GeoMind</h2>
        <button class="btn-secondary" onclick={reloadMemory}>Recharger</button>
      </div>

      {#if memorySummary}
        <div class="memory-info">
          <div class="memory-stat">
            <span class="stat-label">Derniere mise a jour</span>
            <span class="stat-value">{new Date(memorySummary.lastUpdate).toLocaleString('fr-CH')}</span>
          </div>
          <div class="memory-stat">
            <span class="stat-label">Fichiers charges</span>
            <span class="stat-value">{memorySummary.files?.join(', ') || 'Aucun'}</span>
          </div>
          <div class="memory-stat">
            <span class="stat-label">Mots-cles indexes</span>
            <span class="stat-value keywords">{memorySummary.keywords?.slice(0, 10).join(', ')}{memorySummary.keywords?.length > 10 ? '...' : ''}</span>
          </div>
        </div>
        <p class="memory-path">
          Dossier memoire : <code>C:\Users\zema\GeoMind\memory\</code>
        </p>
      {:else}
        <p class="text-muted">Chargement de la memoire...</p>
      {/if}
    </section>

    <!-- Storage Location -->
    <section class="settings-section">
      <h2>Stockage</h2>
      <div class="storage-info">
        <div class="storage-item">
          <span class="storage-label">Configuration GeoMind</span>
          <code>~/.geomind/config.json</code>
        </div>
        <div class="storage-item">
          <span class="storage-label">Memoire et contexte</span>
          <code>C:\Users\zema\GeoMind\memory\</code>
        </div>
        <div class="storage-item">
          <span class="storage-label">Credentials Claude Code</span>
          <code>~/.claude/.credentials.json</code>
        </div>
      </div>
    </section>
    {/if}

    <!-- Connection Form Modal (outside tabs) -->
    {#if showConnectionForm}
      <div class="modal-overlay" onclick={closeConnectionForm} onkeydown={(e) => e.key === 'Escape' && closeConnectionForm()} role="button" tabindex="-1">
        <div class="modal-content" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
          <div class="modal-header">
            <h3>{editingConnection ? 'Modifier la connexion' : 'Nouvelle connexion'}</h3>
            <button class="btn-close" onclick={closeConnectionForm}>×</button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label for="conn-name">Nom</label>
              <input
                id="conn-name"
                type="text"
                bind:value={connectionForm.name}
                placeholder="Ma connexion PostgreSQL"
              />
            </div>

            <div class="form-group">
              <label for="conn-type">Type</label>
              <select id="conn-type" bind:value={connectionForm.type} onchange={onTypeChange}>
                {#each Object.entries(connectionTypes) as [key, type]}
                  <option value={key}>{type.name}</option>
                {/each}
              </select>
            </div>

            {#if connectionForm.type === 'postgresql' || connectionForm.type === 'ssh'}
              <div class="form-row">
                <div class="form-group flex-grow">
                  <label for="conn-host">Hote</label>
                  <input
                    id="conn-host"
                    type="text"
                    bind:value={connectionForm.host}
                    placeholder="localhost"
                  />
                </div>
                <div class="form-group" style="width: 100px;">
                  <label for="conn-port">Port</label>
                  <input
                    id="conn-port"
                    type="number"
                    bind:value={connectionForm.port}
                  />
                </div>
              </div>

              {#if connectionForm.type === 'postgresql'}
                <div class="form-group">
                  <label for="conn-database">Base de donnees</label>
                  <input
                    id="conn-database"
                    type="text"
                    bind:value={connectionForm.database}
                    placeholder="geomind"
                  />
                </div>
              {/if}

              <div class="form-row">
                <div class="form-group flex-grow">
                  <label for="conn-username">Utilisateur</label>
                  <input
                    id="conn-username"
                    type="text"
                    bind:value={connectionForm.username}
                    placeholder="postgres"
                  />
                </div>
                <div class="form-group flex-grow">
                  <label for="conn-password">Mot de passe</label>
                  <input
                    id="conn-password"
                    type="password"
                    bind:value={connectionForm.password}
                    placeholder={editingConnection ? '(inchange)' : ''}
                  />
                </div>
              </div>

              {#if connectionForm.type === 'postgresql'}
                <div class="form-group checkbox-group">
                  <input
                    id="conn-ssl"
                    type="checkbox"
                    bind:checked={connectionForm.ssl}
                  />
                  <label for="conn-ssl">Utiliser SSL</label>
                </div>
              {/if}
            {:else}
              <!-- WMS/WFS -->
              <div class="form-group">
                <label for="conn-url">URL du service</label>
                <input
                  id="conn-url"
                  type="url"
                  bind:value={connectionForm.url}
                  placeholder="https://geo.example.ch/wms"
                />
              </div>

              <div class="form-row">
                <div class="form-group flex-grow">
                  <label for="conn-username">Utilisateur (optionnel)</label>
                  <input
                    id="conn-username"
                    type="text"
                    bind:value={connectionForm.username}
                  />
                </div>
                <div class="form-group flex-grow">
                  <label for="conn-password">Mot de passe</label>
                  <input
                    id="conn-password"
                    type="password"
                    bind:value={connectionForm.password}
                  />
                </div>
              </div>
            {/if}

            {#if testResult}
              <div class="test-result" class:success={testResult.success} class:error={!testResult.success}>
                <span class="test-icon">{testResult.success ? '✓' : '✗'}</span>
                <div class="test-message">
                  <strong>{testResult.message}</strong>
                  {#if testResult.info?.version}
                    <br><small>{testResult.info.version}</small>
                  {/if}
                  {#if testResult.info?.postgis}
                    <br><small>PostGIS {testResult.info.postgis}</small>
                  {/if}
                </div>
              </div>
            {/if}
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" onclick={closeConnectionForm}>Annuler</button>
            <button
              class="btn-test"
              onclick={testCurrentConnection}
              disabled={testingConnection || !connectionForm.name}
            >
              {testingConnection ? 'Test en cours...' : 'Tester'}
            </button>
            <button
              class="btn-primary"
              onclick={saveConnection}
              disabled={savingConnection || !connectionForm.name}
            >
              {savingConnection ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .settings-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    overflow: auto;
  }

  .settings-header {
    padding: var(--spacing-lg);
    background: var(--noir-surface);
    border-bottom: none;
  }

  .settings-header h1 {
    font-size: var(--font-size-xl);
    font-family: var(--font-mono);
    color: var(--cyber-green);
    margin-bottom: var(--spacing-xs);
  }

  .settings-header p {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
  }

  /* === TABS === */
  .settings-tabs {
    display: flex;
    gap: 4px;
    padding: 0 var(--spacing-lg);
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    margin-bottom: -1px;
  }

  .tab-btn:hover {
    color: var(--text-primary);
    background: rgba(0, 255, 136, 0.05);
  }

  .tab-btn.active {
    color: var(--cyber-green);
    border-bottom-color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.08);
  }

  .tab-icon {
    font-size: 16px;
  }

  .tab-label {
    font-weight: 500;
  }

  .settings-content {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
    max-width: 900px;
    overflow-y: auto;
    flex: 1;
  }

  .settings-section {
    background: var(--noir-card);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .settings-section h2 {
    font-size: var(--font-size-lg);
    font-family: var(--font-mono);
    color: var(--text-primary);
    margin-bottom: var(--spacing-md);
  }

  .section-description {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-lg);
  }

  .memory-info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    background: var(--noir-surface);
    padding: var(--spacing-md);
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--border-color);
  }

  .memory-stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat-label {
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }

  .stat-value {
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    color: var(--text-primary);
    font-weight: 500;
  }

  .stat-value.keywords {
    font-size: var(--font-size-xs);
    color: var(--cyber-green);
  }

  .memory-path {
    margin-top: var(--spacing-md);
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .memory-path code {
    background: var(--noir-surface);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: var(--font-mono);
    color: var(--cyber-green);
  }

  .providers-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .provider-card {
    padding: var(--spacing-lg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--noir-surface);
  }

  .provider-card.configured {
    border-color: var(--success);
    background: rgba(0, 255, 136, 0.05);
  }

  .provider-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }

  .provider-badge {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 16px;
    font-weight: 700;
    font-family: var(--font-mono);
  }

  .provider-info h3 {
    font-size: var(--font-size-md);
    font-family: var(--font-mono);
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .status-badge {
    font-size: 10px;
    font-family: var(--font-mono);
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--noir-card);
    color: var(--text-muted);
    border: 1px solid var(--border-color);
  }

  .status-badge.configured {
    background: rgba(0, 255, 136, 0.15);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .api-key-form {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  .api-key-input {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    background: var(--noir-card);
    color: var(--text-primary);
  }

  .api-key-input::placeholder {
    color: var(--text-muted);
  }

  .api-key-input:focus {
    outline: none;
    border-color: var(--cyber-green);
    box-shadow: 0 0 8px var(--cyber-green-glow);
    background: var(--noir-elevated);
  }

  .btn-primary, .btn-secondary {
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background: var(--cyber-green);
    color: var(--noir-profond);
    border: 1px solid var(--cyber-green);
    box-shadow: 0 0 8px var(--cyber-green-glow);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--cyber-green-light);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--noir-card);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .provider-help {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-bottom: var(--spacing-md);
  }

  .provider-help a {
    color: var(--cyber-green);
  }

  .provider-help a:hover {
    text-shadow: 0 0 8px var(--cyber-green-glow);
  }

  .oauth-note {
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid var(--info);
    padding: var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    color: var(--text-primary);
  }

  .oauth-note code {
    background: var(--noir-card);
    padding: 1px 4px;
    border-radius: 3px;
    color: var(--info);
  }

  .provider-models {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    align-items: center;
  }

  .models-label {
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    color: var(--text-muted);
    margin-right: var(--spacing-xs);
  }

  .model-tag {
    font-size: 10px;
    font-family: var(--font-mono);
    padding: 2px 8px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    color: var(--text-secondary);
  }

  .model-tag.default {
    background: var(--cyber-green);
    border-color: var(--cyber-green);
    color: var(--noir-profond);
  }

  .storage-info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .storage-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm);
    background: var(--noir-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
  }

  .storage-label {
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }

  .storage-item code {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--cyber-green);
  }

  .text-muted {
    color: var(--text-muted);
    font-style: italic;
  }

  /* Server Section Styles */
  .server-section {
    border-color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.03);
  }

  .btn-restart {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--warning);
    border-radius: var(--border-radius-sm);
    background: rgba(255, 170, 0, 0.15);
    color: var(--warning);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .btn-restart:hover:not(:disabled) {
    background: rgba(255, 170, 0, 0.25);
    box-shadow: 0 0 10px rgba(255, 170, 0, 0.3);
  }

  .btn-restart:disabled {
    opacity: 0.7;
    cursor: wait;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 170, 0, 0.3);
    border-top-color: var(--warning);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .restart-error {
    background: rgba(255, 68, 68, 0.15);
    border: 1px solid var(--error);
    color: var(--error);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-md);
  }

  .server-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-sm);
    background: var(--noir-surface);
    padding: var(--spacing-md);
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--border-color);
  }

  .server-stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .status-running {
    color: var(--cyber-green) !important;
    font-weight: 600;
  }

  .server-offline {
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid var(--error);
    border-radius: var(--border-radius-sm);
    padding: var(--spacing-md);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: var(--error);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .offline-icon {
    font-size: 1.2rem;
  }

  .server-note {
    margin-top: var(--spacing-md);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-style: italic;
  }

  /* === Connections Section === */
  .connections-section {
    border-color: var(--info);
    background: rgba(0, 212, 255, 0.03);
  }

  .no-connections {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--text-muted);
  }

  .no-conn-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .no-connections .hint {
    font-size: var(--font-size-xs);
    margin-top: var(--spacing-sm);
  }

  .connections-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .connection-card {
    background: var(--noir-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
  }

  .connection-card.connected {
    border-color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.05);
  }

  .conn-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-sm);
  }

  .conn-icon {
    font-size: 1.5rem;
  }

  .conn-info {
    flex: 1;
  }

  .conn-info h4 {
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
    color: var(--text-primary);
    margin: 0;
  }

  .conn-type {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .conn-status {
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--noir-card);
    color: var(--text-muted);
    border: 1px solid var(--border-color);
  }

  .conn-status.online {
    background: rgba(0, 255, 136, 0.15);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .conn-details {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm) var(--spacing-lg);
    margin-bottom: var(--spacing-md);
    padding: var(--spacing-sm);
    background: var(--noir-card);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }

  .conn-detail strong {
    color: var(--text-muted);
  }

  .conn-actions {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .btn-conn {
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .btn-connect {
    background: rgba(0, 255, 136, 0.15);
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .btn-connect:hover:not(:disabled) {
    background: rgba(0, 255, 136, 0.25);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  .btn-disconnect {
    background: rgba(255, 170, 0, 0.15);
    border-color: var(--warning);
    color: var(--warning);
  }

  .btn-disconnect:hover:not(:disabled) {
    background: rgba(255, 170, 0, 0.25);
  }

  .btn-icon {
    background: transparent;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    padding: var(--spacing-xs);
    border-radius: var(--border-radius-sm);
    transition: all var(--transition-fast);
  }

  .btn-icon:hover {
    background: var(--bg-hover);
  }

  .btn-icon.btn-danger:hover {
    background: rgba(255, 68, 68, 0.2);
  }

  .spinner-sm {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(0, 255, 136, 0.3);
    border-top-color: var(--cyber-green);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* === Modal === */
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

  .modal-content {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    font-family: var(--font-mono);
    font-size: var(--font-size-lg);
    color: var(--text-primary);
    margin: 0;
  }

  .btn-close {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    color: var(--text-muted);
    cursor: pointer;
  }

  .btn-close:hover {
    color: var(--error);
  }

  .modal-body {
    padding: var(--spacing-lg);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--border-color);
  }

  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .form-group label {
    display: block;
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    background: var(--noir-surface);
    color: var(--text-primary);
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--cyber-green);
    box-shadow: 0 0 8px var(--cyber-green-glow);
  }

  .form-row {
    display: flex;
    gap: var(--spacing-md);
  }

  .flex-grow {
    flex: 1;
  }

  .checkbox-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .checkbox-group input {
    width: auto;
  }

  .checkbox-group label {
    margin-bottom: 0;
  }

  .btn-test {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--info);
    border-radius: var(--border-radius-sm);
    background: rgba(0, 212, 255, 0.15);
    color: var(--info);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-test:hover:not(:disabled) {
    background: rgba(0, 212, 255, 0.25);
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
  }

  .btn-test:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .test-result {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    border-radius: var(--border-radius-sm);
    margin-top: var(--spacing-md);
  }

  .test-result.success {
    background: rgba(0, 255, 136, 0.1);
    border: 1px solid var(--cyber-green);
  }

  .test-result.error {
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid var(--error);
  }

  .test-icon {
    font-size: 1.2rem;
  }

  .test-result.success .test-icon {
    color: var(--cyber-green);
  }

  .test-result.error .test-icon {
    color: var(--error);
  }

  .test-message {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .test-message small {
    color: var(--text-muted);
  }

  /* === Glitch Section === */
  .glitch-section {
    border-color: var(--accent-pink);
    background: rgba(255, 0, 128, 0.03);
  }

  .btn-toggle {
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: 20px;
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid var(--border-color);
    background: var(--noir-surface);
    color: var(--text-muted);
  }

  .btn-toggle.active {
    background: linear-gradient(135deg, var(--accent-pink), var(--accent-purple));
    border-color: var(--accent-pink);
    color: white;
    box-shadow: 0 0 15px rgba(255, 0, 128, 0.4);
  }

  .btn-toggle:hover {
    border-color: var(--accent-pink);
  }

  .easter-egg-badge {
    display: inline-block;
    padding: 2px 8px;
    margin-left: var(--spacing-sm);
    font-size: 10px;
    font-family: var(--font-mono);
    background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
    color: white;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .glitch-controls {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    margin-top: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--noir-surface);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .glitch-controls.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .glitch-control {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .glitch-control label {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .control-label {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .control-value {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--accent-pink);
  }

  .glitch-control input[type="range"] {
    width: 100%;
    height: 6px;
    appearance: none;
    background: var(--noir-card);
    border-radius: 3px;
    cursor: pointer;
  }

  .glitch-control input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent-pink), var(--accent-purple));
    cursor: pointer;
    box-shadow: 0 0 10px rgba(255, 0, 128, 0.5);
    border: 2px solid var(--noir-profond);
  }

  .glitch-control input[type="range"]::-webkit-slider-thumb:hover {
    box-shadow: 0 0 15px rgba(255, 0, 128, 0.7);
    transform: scale(1.1);
  }

  .glitch-control input[type="range"]:disabled {
    opacity: 0.5;
  }

  .glitch-control input[type="range"]:disabled::-webkit-slider-thumb {
    background: var(--text-muted);
    box-shadow: none;
  }

  .control-hints {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .btn-reset {
    margin-top: var(--spacing-md);
    padding: var(--spacing-xs) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-reset:hover {
    border-color: var(--error);
    color: var(--error);
    background: rgba(255, 68, 68, 0.1);
  }

  /* About Section */
  .about-section .about-info {
    display: flex;
    gap: var(--spacing-lg);
    align-items: center;
    padding: var(--spacing-lg);
    background: var(--noir-surface);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .about-logo-img {
    width: 270px;
    height: auto;
    border-radius: var(--border-radius);
  }

  .about-details h3 {
    font-size: var(--font-size-xl);
    font-family: var(--font-mono);
    color: var(--cyber-green);
    margin-bottom: var(--spacing-xs);
  }

  .about-subtitle {
    font-size: var(--font-size-md);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  .about-version {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin-bottom: var(--spacing-md);
  }

  .about-description {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: var(--spacing-md);
  }

  .about-mode {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .mode-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    font-weight: 600;
  }

  .mode-badge.standard {
    background: rgba(0, 200, 255, 0.15);
    color: var(--accent-cyan);
    border: 1px solid var(--accent-cyan);
  }

  .mode-badge.expert {
    background: rgba(0, 255, 136, 0.15);
    color: var(--cyber-green);
    border: 1px solid var(--cyber-green);
  }

  .mode-badge.god {
    background: rgba(255, 0, 128, 0.15);
    color: var(--accent-pink);
    border: 1px solid var(--accent-pink);
  }

  .mode-badge.bfsa {
    background: rgba(255, 170, 0, 0.15);
    color: #ffaa00;
    border: 1px solid #ffaa00;
  }

  /* Theme Section */
  .theme-section .theme-toggle-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    background: var(--noir-surface);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .theme-label {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }

  /* Ollama Section */
  .ollama-section .ollama-info {
    padding: var(--spacing-md);
    background: var(--noir-surface);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .ollama-status, .ollama-model {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid var(--border-color);
  }

  .ollama-model {
    border-bottom: none;
  }

  .status-label {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .status-value {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--cyber-green);
    font-weight: 500;
  }

  .ollama-note {
    margin-top: var(--spacing-md);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-style: italic;
  }

  /* Connections Status Section */
  .connections-status-section .readonly-badge {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-style: italic;
  }

  .connections-status-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .connection-status-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--noir-surface);
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--border-color);
  }

  .conn-icon {
    font-size: 18px;
  }

  .conn-name {
    flex: 1;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }

  .conn-type {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .conn-status {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(255, 68, 68, 0.15);
    color: var(--error);
  }

  .conn-status.connected {
    background: rgba(0, 255, 136, 0.15);
    color: var(--cyber-green);
  }

  /* Module Visibility Configuration */
  .modules-config-section .mode-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }

  .mode-btn {
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-surface);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .mode-btn:hover {
    background: var(--bg-hover);
    color: var(--text-bright);
  }

  .mode-btn.active {
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-color: var(--cyber-green);
  }

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .module-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: var(--noir-surface);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .module-toggle:hover:not(.disabled) {
    border-color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.05);
  }

  .module-toggle.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .module-toggle input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--cyber-green);
    cursor: pointer;
  }

  .module-toggle input[type="checkbox"]:disabled {
    cursor: not-allowed;
  }

  .module-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .module-label {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .module-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .always-visible-badge {
    font-size: 0.65rem;
    padding: 2px 6px;
    background: rgba(255, 193, 7, 0.15);
    color: #ffc107;
    border-radius: 4px;
    font-family: var(--font-mono);
    text-transform: uppercase;
  }

  .config-actions {
    display: flex;
    gap: 12px;
  }

  .btn-reset-config,
  .btn-reset-all {
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .btn-reset-config:hover {
    background: var(--bg-hover);
    color: var(--text-bright);
    border-color: var(--text-muted);
  }

  .btn-reset-all:hover {
    background: rgba(255, 68, 68, 0.1);
    color: var(--error);
    border-color: var(--error);
  }

  /* Portal Configuration Styles */
  .portal-config-section {
    margin-top: 24px;
  }

  .portal-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .portal-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--noir-surface);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: grab;
    transition: all 0.2s;
  }

  .portal-item:hover:not(.disabled) {
    border-color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.05);
  }

  .portal-item.dragging {
    opacity: 0.5;
    border-color: var(--cyber-green);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  .portal-item.disabled {
    opacity: 0.5;
  }

  .drag-handle {
    font-size: 18px;
    color: var(--text-muted);
    cursor: grab;
    user-select: none;
  }

  .portal-item:active .drag-handle {
    cursor: grabbing;
  }

  .portal-checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--cyber-green);
    cursor: pointer;
  }

  .portal-name {
    flex: 1;
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .portal-name.is-default {
    color: var(--cyber-green);
  }

  .default-star {
    color: var(--warning);
    font-size: 14px;
  }

  .portal-types {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-set-default {
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-set-default:hover:not(:disabled) {
    border-color: var(--warning);
    color: var(--warning);
    background: rgba(255, 193, 7, 0.1);
  }

  .btn-set-default.active {
    border-color: var(--warning);
    color: var(--warning);
    background: rgba(255, 193, 7, 0.15);
  }

  .btn-set-default:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .portal-actions {
    display: flex;
    gap: 12px;
  }

  .btn-reset-portals {
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .btn-reset-portals:hover {
    background: var(--bg-hover);
    color: var(--text-bright);
    border-color: var(--text-muted);
  }
</style>
