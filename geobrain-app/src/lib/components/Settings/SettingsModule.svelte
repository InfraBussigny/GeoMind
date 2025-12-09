<script lang="ts">
  import { onMount } from 'svelte';
  import { providers, backendConnected } from '$lib/stores/app';
  import { getProviders, saveProviderConfig } from '$lib/services/api';

  let apiKeys = $state<Record<string, string>>({});
  let saving = $state<Record<string, boolean>>({});
  let saved = $state<Record<string, boolean>>({});
  let memorySummary = $state<any>(null);

  onMount(async () => {
    await loadProviders();
    await loadMemorySummary();
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
    background: var(--bg-secondary);
    overflow: auto;
  }

  .settings-header {
    padding: var(--spacing-lg);
    background: white;
    border-bottom: 1px solid var(--border-color);
  }

  .settings-header h1 {
    font-size: var(--font-size-xl);
    color: var(--bleu-bussigny);
    margin-bottom: var(--spacing-xs);
  }

  .settings-header p {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .settings-content {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
    max-width: 900px;
  }

  .settings-section {
    background: white;
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
    background: var(--bg-secondary);
    padding: var(--spacing-md);
    border-radius: var(--border-radius-sm);
  }

  .memory-stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .stat-value {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: 500;
  }

  .stat-value.keywords {
    font-size: var(--font-size-xs);
    color: var(--bleu-bussigny);
  }

  .memory-path {
    margin-top: var(--spacing-md);
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .memory-path code {
    background: var(--bg-secondary);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: var(--font-mono);
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
    background: var(--bg-secondary);
  }

  .provider-card.configured {
    border-color: var(--success);
    background: rgba(39, 174, 96, 0.05);
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
    margin-bottom: 4px;
  }

  .status-badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--bg-primary);
    color: var(--text-muted);
  }

  .status-badge.configured {
    background: var(--success-light);
    color: var(--success);
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
  }

  .api-key-input:focus {
    outline: none;
    border-color: var(--bleu-bussigny);
  }

  .btn-primary, .btn-secondary {
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background: var(--bleu-bussigny);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--bleu-bussigny-dark);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--gris-tres-clair);
  }

  .provider-help {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-bottom: var(--spacing-md);
  }

  .provider-help a {
    color: var(--bleu-bussigny);
  }

  .oauth-note {
    background: var(--info-light);
    padding: var(--spacing-sm);
    border-radius: var(--border-radius-sm);
  }

  .oauth-note code {
    background: rgba(0,0,0,0.1);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .provider-models {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    align-items: center;
  }

  .models-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-right: var(--spacing-xs);
  }

  .model-tag {
    font-size: 10px;
    padding: 2px 8px;
    background: var(--bg-primary);
    border-radius: 10px;
    color: var(--text-secondary);
  }

  .model-tag.default {
    background: var(--bleu-bussigny);
    color: white;
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
    background: var(--bg-secondary);
    border-radius: var(--border-radius-sm);
  }

  .storage-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .storage-item code {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--text-primary);
  }

  .text-muted {
    color: var(--text-muted);
    font-style: italic;
  }
</style>
