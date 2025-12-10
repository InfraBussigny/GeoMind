<script lang="ts">
  import { onMount } from 'svelte';
  import { providers, backendConnected, mode } from '$lib/stores/app';
  import { getProviders, saveProviderConfig } from '$lib/services/api';

  let apiKeys = $state<Record<string, string>>({});
  let saving = $state<Record<string, boolean>>({});
  let saved = $state<Record<string, boolean>>({});
  let memorySummary = $state<any>(null);
  let serverStatus = $state<any>(null);
  let restarting = $state(false);
  let restartError = $state<string | null>(null);

  onMount(async () => {
    await loadProviders();
    await loadMemorySummary();
    await loadServerStatus();
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
    if ($mode === 'standard') {
      restartError = 'Mode expert ou god requis pour redémarrer le serveur';
      return;
    }

    restarting = true;
    restartError = null;

    try {
      const response = await fetch('http://localhost:3001/api/server/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: $mode })
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
      perplexity: '#6366F1'
    };
    return colors[providerId] || '#666';
  }

  function getProviderIcon(providerId: string): string {
    const icons: Record<string, string> = {
      claude: 'C',
      openai: 'O',
      mistral: 'M',
      deepseek: 'D',
      perplexity: 'P'
    };
    return icons[providerId] || '?';
  }
</script>

<div class="settings-module">
  <header class="settings-header">
    <h1>Parametres</h1>
    <p>Configuration des providers IA et de la memoire</p>
  </header>

  <div class="settings-content">
    <!-- Server Section - Expert/God only -->
    {#if $mode !== 'standard'}
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

    <!-- Memory Section -->
    <section class="settings-section">
      <div class="section-header">
        <h2>Memoire GeoBrain</h2>
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
          Dossier memoire : <code>C:\Users\zema\GeoBrain\memory\</code>
        </p>
      {:else}
        <p class="text-muted">Chargement de la memoire...</p>
      {/if}
    </section>

    <!-- API Keys Section -->
    <section class="settings-section">
      <h2>Cles API</h2>
      <p class="section-description">
        Configurez vos cles API pour chaque provider. Les cles sont stockees localement de maniere securisee.
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

    <!-- Storage Location -->
    <section class="settings-section">
      <h2>Stockage</h2>
      <div class="storage-info">
        <div class="storage-item">
          <span class="storage-label">Configuration GeoBrain</span>
          <code>~/.geobrain/config.json</code>
        </div>
        <div class="storage-item">
          <span class="storage-label">Memoire et contexte</span>
          <code>C:\Users\zema\GeoBrain\memory\</code>
        </div>
        <div class="storage-item">
          <span class="storage-label">Credentials Claude Code</span>
          <code>~/.claude/.credentials.json</code>
        </div>
      </div>
    </section>
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
    border-bottom: 1px solid var(--border-color);
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

  .settings-content {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
    max-width: 900px;
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
</style>
