<script lang="ts">
  import { onMount } from 'svelte';
  import {
    aiConfigStore,
    usageStore,
    testProvider,
    getAvailableModels,
    formatCost,
    getProviderInfo,
    addCustomProvider,
    AVAILABLE_MODELS,
    type AIProvider,
    type AIModel,
    type AIProviderConfig
  } from '$lib/services/aiRouter';

  // State
  let configState = $state({
    providers: [] as AIProviderConfig[],
    activeProvider: 'anthropic' as AIProvider,
    activeModel: '',
    autoRoute: false,
    routingRules: [] as Array<{
      id: string;
      name: string;
      condition: string;
      value: string;
      targetProvider: AIProvider;
      targetModel: string;
      priority: number;
    }>
  });

  let activeTab = $state<'providers' | 'models' | 'routing' | 'usage'>('providers');
  let testingProvider = $state<AIProvider | null>(null);
  let testResults = $state<Record<string, { success: boolean; error?: string }>>({});
  let availableModels = $state<Record<string, AIModel[]>>({});
  let usageRecords = $state<Array<{
    timestamp: Date;
    provider: AIProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }>>([]);

  // New rule form
  let showNewRule = $state(false);
  let newRule = $state({
    name: '',
    condition: 'contains' as 'contains' | 'starts_with' | 'task_type' | 'context_length',
    value: '',
    targetProvider: 'anthropic' as AIProvider,
    targetModel: '',
    priority: 1
  });

  // Custom provider form
  let showCustomForm = $state(false);
  let customProviderForm = $state({
    name: '',
    baseUrl: '',
    apiKey: '',
    defaultModel: '',
    icon: '⚙️'
  });

  // All providers list
  const ALL_PROVIDERS: AIProvider[] = ['anthropic', 'google', 'openai', 'mistral', 'deepseek', 'perplexity', 'ollama', 'lmstudio', 'custom'];

  // Subscribe to stores
  $effect(() => {
    const unsub1 = aiConfigStore.subscribe(s => configState = s);
    const unsub2 = usageStore.subscribe(r => usageRecords = r);

    return () => {
      unsub1();
      unsub2();
    };
  });

  onMount(() => {
    // Load available models for each provider
    loadModels();
  });

  async function loadModels() {
    for (const provider of ALL_PROVIDERS) {
      availableModels[provider] = await getAvailableModels(provider);
    }
  }

  // Add custom provider
  function handleAddCustomProvider() {
    if (!customProviderForm.name || !customProviderForm.baseUrl) return;

    addCustomProvider({
      name: customProviderForm.name,
      baseUrl: customProviderForm.baseUrl,
      apiKey: customProviderForm.apiKey,
      defaultModel: customProviderForm.defaultModel || 'custom-model',
      icon: customProviderForm.icon
    });

    // Reset form
    customProviderForm = { name: '', baseUrl: '', apiKey: '', defaultModel: '', icon: '⚙️' };
    showCustomForm = false;
  }

  // Toggle auth type
  function toggleAuthType(provider: AIProvider) {
    const config = getConfig(provider);
    const newAuthType = config?.authType === 'oauth' ? 'api_key' : 'oauth';
    aiConfigStore.setProvider(provider, { authType: newAuthType });
  }

  // Check if provider supports OAuth
  function supportsOAuth(provider: AIProvider): boolean {
    return ['anthropic', 'google'].includes(provider);
  }

  // Check if provider is local
  function isLocalProvider(provider: AIProvider): boolean {
    return ['ollama', 'lmstudio', 'custom'].includes(provider);
  }

  // Test provider connection
  async function handleTestProvider(provider: AIProvider) {
    testingProvider = provider;
    const result = await testProvider(provider);
    testResults[provider] = result;
    testingProvider = null;
  }

  // Toggle provider
  function toggleProvider(provider: AIProvider, enabled: boolean) {
    aiConfigStore.setProvider(provider, { enabled });
  }

  // Update API key
  function updateApiKey(provider: AIProvider, apiKey: string) {
    aiConfigStore.setProvider(provider, { apiKey });
  }

  // Update base URL
  function updateBaseUrl(provider: AIProvider, baseUrl: string) {
    aiConfigStore.setProvider(provider, { baseUrl });
  }

  // Set active provider/model
  function selectProvider(provider: AIProvider) {
    const providerConfig = configState.providers.find(p => p.provider === provider);
    aiConfigStore.setActiveProvider(provider, providerConfig?.defaultModel);
  }

  function selectModel(model: string) {
    aiConfigStore.setActiveModel(model);
  }

  // Add routing rule
  function addRule() {
    if (!newRule.name || !newRule.value) return;

    aiConfigStore.addRoutingRule({
      name: newRule.name,
      condition: newRule.condition,
      value: newRule.value,
      targetProvider: newRule.targetProvider,
      targetModel: newRule.targetModel || AVAILABLE_MODELS.find(m => m.provider === newRule.targetProvider)?.id || '',
      priority: newRule.priority
    });

    newRule = { name: '', condition: 'contains', value: '', targetProvider: 'anthropic', targetModel: '', priority: 1 };
    showNewRule = false;
  }

  // Get provider config
  function getConfig(provider: AIProvider): AIProviderConfig | undefined {
    return configState.providers.find(p => p.provider === provider);
  }

  // Calculate total usage
  let totalCost = $derived(usageRecords.reduce((sum, r) => sum + r.cost, 0));
  let totalTokens = $derived(usageRecords.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0));

  // Get models for provider
  function getModelsForProvider(provider: AIProvider): AIModel[] {
    return availableModels[provider] || AVAILABLE_MODELS.filter(m => m.provider === provider);
  }
</script>

<div class="ai-settings">
  <!-- Tabs -->
  <div class="tabs">
    <button class="tab" class:active={activeTab === 'providers'} onclick={() => activeTab = 'providers'}>
      Fournisseurs
    </button>
    <button class="tab" class:active={activeTab === 'models'} onclick={() => activeTab = 'models'}>
      Modèles
    </button>
    <button class="tab" class:active={activeTab === 'routing'} onclick={() => activeTab = 'routing'}>
      Routage auto
    </button>
    <button class="tab" class:active={activeTab === 'usage'} onclick={() => activeTab = 'usage'}>
      Usage
    </button>
  </div>

  <div class="tab-content">
    {#if activeTab === 'providers'}
      <div class="providers-list">
        {#each ALL_PROVIDERS.filter(p => p !== 'custom') as provider}
          {@const config = getConfig(provider as AIProvider)}
          {@const info = getProviderInfo(provider as AIProvider, config?.customName, config?.customIcon)}
          {@const isActive = configState.activeProvider === provider}

          <div class="provider-card" class:active={isActive} class:enabled={config?.enabled}>
            <div class="provider-header">
              <span class="provider-icon">{info.icon}</span>
              <span class="provider-name">{info.name}</span>
              <label class="toggle">
                <input
                  type="checkbox"
                  checked={config?.enabled}
                  onchange={(e) => toggleProvider(provider as AIProvider, (e.target as HTMLInputElement).checked)}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>

            {#if config?.enabled}
              <div class="provider-config">
                {#if isLocalProvider(provider)}
                  <div class="config-field">
                    <label>URL du serveur</label>
                    <input
                      type="text"
                      value={config?.baseUrl || ''}
                      placeholder={provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234'}
                      oninput={(e) => updateBaseUrl(provider as AIProvider, (e.target as HTMLInputElement).value)}
                    />
                  </div>
                {:else}
                  <!-- Auth type selector for providers that support OAuth -->
                  {#if supportsOAuth(provider)}
                    <div class="auth-type-selector">
                      <button
                        class="auth-type-btn"
                        class:active={config?.authType !== 'oauth'}
                        onclick={() => aiConfigStore.setProvider(provider as AIProvider, { authType: 'api_key' })}
                      >
                        🔑 Clé API
                      </button>
                      <button
                        class="auth-type-btn"
                        class:active={config?.authType === 'oauth'}
                        onclick={() => aiConfigStore.setProvider(provider as AIProvider, { authType: 'oauth' })}
                      >
                        🔐 OAuth
                      </button>
                    </div>
                  {/if}

                  {#if config?.authType === 'oauth'}
                    <div class="oauth-section">
                      <button class="oauth-btn">
                        Se connecter avec {info.name}
                      </button>
                      <p class="hint">Utilisez votre compte {info.name} pour accéder à l'API</p>
                    </div>
                  {:else}
                    <div class="config-field">
                      <label>Clé API</label>
                      <input
                        type="password"
                        value={config?.apiKey || ''}
                        placeholder={provider === 'anthropic' ? 'sk-ant-...' : provider === 'openai' ? 'sk-...' : 'Clé API'}
                        oninput={(e) => updateApiKey(provider as AIProvider, (e.target as HTMLInputElement).value)}
                      />
                    </div>
                  {/if}
                {/if}

                <div class="provider-actions">
                  <button
                    class="test-btn"
                    onclick={() => handleTestProvider(provider as AIProvider)}
                    disabled={testingProvider === provider}
                  >
                    {testingProvider === provider ? '...' : 'Tester'}
                  </button>

                  {#if testResults[provider]}
                    <span class="test-result" class:success={testResults[provider].success}>
                      {testResults[provider].success ? '✓ OK' : `✗ ${testResults[provider].error}`}
                    </span>
                  {/if}

                  {#if !isActive}
                    <button class="use-btn" onclick={() => selectProvider(provider as AIProvider)}>
                      Utiliser
                    </button>
                  {:else}
                    <span class="active-badge">Actif</span>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/each}

        <!-- Custom provider section -->
        {#if getConfig('custom')?.enabled}
          {@const customConfig = getConfig('custom')}
          <div class="provider-card enabled" class:active={configState.activeProvider === 'custom'}>
            <div class="provider-header">
              <span class="provider-icon">{customConfig?.customIcon || '⚙️'}</span>
              <span class="provider-name">{customConfig?.customName || 'Custom'}</span>
              <label class="toggle">
                <input
                  type="checkbox"
                  checked={customConfig?.enabled}
                  onchange={(e) => toggleProvider('custom', (e.target as HTMLInputElement).checked)}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="provider-config">
              <div class="config-field">
                <label>URL du serveur</label>
                <input
                  type="text"
                  value={customConfig?.baseUrl || ''}
                  placeholder="http://localhost:8080"
                  oninput={(e) => updateBaseUrl('custom', (e.target as HTMLInputElement).value)}
                />
              </div>
              <div class="config-field">
                <label>Clé API (optionnel)</label>
                <input
                  type="password"
                  value={customConfig?.apiKey || ''}
                  placeholder="Clé API"
                  oninput={(e) => updateApiKey('custom', (e.target as HTMLInputElement).value)}
                />
              </div>
              <div class="provider-actions">
                <button class="test-btn" onclick={() => handleTestProvider('custom')} disabled={testingProvider === 'custom'}>
                  {testingProvider === 'custom' ? '...' : 'Tester'}
                </button>
                {#if testResults['custom']}
                  <span class="test-result" class:success={testResults['custom'].success}>
                    {testResults['custom'].success ? '✓ OK' : `✗ ${testResults['custom'].error}`}
                  </span>
                {/if}
                {#if configState.activeProvider !== 'custom'}
                  <button class="use-btn" onclick={() => selectProvider('custom')}>Utiliser</button>
                {:else}
                  <span class="active-badge">Actif</span>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- Add custom provider button -->
        {#if showCustomForm}
          <div class="custom-provider-form">
            <h4>Ajouter un fournisseur personnalisé</h4>
            <div class="form-grid">
              <div class="config-field">
                <label>Nom</label>
                <input type="text" placeholder="Mon Provider" bind:value={customProviderForm.name} />
              </div>
              <div class="config-field">
                <label>Icône (emoji)</label>
                <input type="text" placeholder="⚙️" bind:value={customProviderForm.icon} maxlength="2" />
              </div>
              <div class="config-field full-width">
                <label>URL de base (OpenAI-compatible)</label>
                <input type="text" placeholder="http://localhost:8080" bind:value={customProviderForm.baseUrl} />
              </div>
              <div class="config-field">
                <label>Clé API (optionnel)</label>
                <input type="password" placeholder="API Key" bind:value={customProviderForm.apiKey} />
              </div>
              <div class="config-field">
                <label>Modèle par défaut</label>
                <input type="text" placeholder="model-name" bind:value={customProviderForm.defaultModel} />
              </div>
            </div>
            <div class="form-actions">
              <button onclick={() => showCustomForm = false}>Annuler</button>
              <button class="save-btn" onclick={handleAddCustomProvider}>Ajouter</button>
            </div>
          </div>
        {:else}
          <button class="add-provider-btn" onclick={() => showCustomForm = true}>
            + Ajouter un fournisseur personnalisé
          </button>
        {/if}
      </div>

    {:else if activeTab === 'models'}
      <div class="models-section">
        <div class="current-model">
          <span class="label">Modèle actif:</span>
          <span class="model-name">{configState.activeModel}</span>
        </div>

        <div class="models-by-provider">
          {#each ALL_PROVIDERS as provider}
            {@const models = getModelsForProvider(provider as AIProvider)}
            {@const config = getConfig(provider as AIProvider)}
            {@const info = getProviderInfo(provider as AIProvider, config?.customName, config?.customIcon)}

            {#if config?.enabled && models.length > 0}
              <div class="provider-models">
                <h4>{info.icon} {info.name}</h4>
                <div class="models-grid">
                  {#each models as model}
                    <button
                      class="model-card"
                      class:selected={configState.activeModel === model.id}
                      onclick={() => { selectProvider(provider as AIProvider); selectModel(model.id); }}
                    >
                      <div class="model-name">{model.name}</div>
                      <div class="model-meta">
                        <span class="context">{(model.contextLength / 1000).toFixed(0)}K ctx</span>
                        {#if model.isLocal}
                          <span class="local-badge">Local</span>
                        {:else}
                          <span class="price">{formatCost(model.inputPrice / 1000000)}/1K</span>
                        {/if}
                      </div>
                      <div class="capabilities">
                        {#each model.capabilities as cap}
                          <span class="cap-badge">{cap}</span>
                        {/each}
                      </div>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>

    {:else if activeTab === 'routing'}
      <div class="routing-section">
        <div class="auto-route-toggle">
          <label class="toggle-label">
            <input
              type="checkbox"
              checked={configState.autoRoute}
              onchange={(e) => aiConfigStore.toggleAutoRoute((e.target as HTMLInputElement).checked)}
            />
            <span class="toggle-slider"></span>
            <span>Routage automatique activé</span>
          </label>
          <p class="hint">Redirige automatiquement les requêtes vers le meilleur modèle selon les règles.</p>
        </div>

        <div class="rules-list">
          <h4>Règles de routage</h4>

          {#each configState.routingRules as rule}
            <div class="rule-card">
              <div class="rule-header">
                <span class="rule-name">{rule.name}</span>
                <span class="rule-priority">Priorité: {rule.priority}</span>
              </div>
              <div class="rule-condition">
                Si message <strong>{rule.condition}</strong>: "{rule.value}"
              </div>
              <div class="rule-target">
                → {getProviderInfo(rule.targetProvider).icon} {rule.targetModel}
              </div>
              <button class="remove-btn" onclick={() => aiConfigStore.removeRoutingRule(rule.id)}>
                ✕
              </button>
            </div>
          {:else}
            <p class="empty">Aucune règle configurée</p>
          {/each}

          {#if showNewRule}
            <div class="new-rule-form">
              <input type="text" placeholder="Nom de la règle" bind:value={newRule.name} />

              <select bind:value={newRule.condition}>
                <option value="contains">Contient</option>
                <option value="starts_with">Commence par</option>
                <option value="task_type">Type de tâche</option>
                <option value="context_length">Longueur contexte ></option>
              </select>

              <input
                type="text"
                placeholder={newRule.condition === 'task_type' ? 'code, long_context' : 'valeur...'}
                bind:value={newRule.value}
              />

              <select bind:value={newRule.targetProvider}>
                {#each configState.providers.filter(p => p.enabled) as p}
                  <option value={p.provider}>{getProviderInfo(p.provider).name}</option>
                {/each}
              </select>

              <select bind:value={newRule.targetModel}>
                {#each getModelsForProvider(newRule.targetProvider) as model}
                  <option value={model.id}>{model.name}</option>
                {/each}
              </select>

              <input type="number" min="1" max="10" bind:value={newRule.priority} />

              <div class="form-actions">
                <button onclick={() => showNewRule = false}>Annuler</button>
                <button class="save-btn" onclick={addRule}>Ajouter</button>
              </div>
            </div>
          {:else}
            <button class="add-rule-btn" onclick={() => showNewRule = true}>
              + Nouvelle règle
            </button>
          {/if}
        </div>
      </div>

    {:else if activeTab === 'usage'}
      <div class="usage-section">
        <div class="usage-summary">
          <div class="stat-card">
            <span class="stat-label">Coût total</span>
            <span class="stat-value">{formatCost(totalCost)}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Tokens utilisés</span>
            <span class="stat-value">{totalTokens.toLocaleString()}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Requêtes</span>
            <span class="stat-value">{usageRecords.length}</span>
          </div>
        </div>

        <div class="usage-by-provider">
          {#each ALL_PROVIDERS as provider}
            {@const records = usageRecords.filter(r => r.provider === provider)}
            {@const providerCost = records.reduce((sum, r) => sum + r.cost, 0)}
            {@const config = getConfig(provider as AIProvider)}
            {@const info = getProviderInfo(provider as AIProvider, config?.customName, config?.customIcon)}

            {#if records.length > 0}
              <div class="provider-usage">
                <span class="provider-icon">{info.icon}</span>
                <span class="provider-name">{info.name}</span>
                <span class="provider-cost">{formatCost(providerCost)}</span>
                <span class="provider-count">{records.length} requêtes</span>
              </div>
            {/if}
          {/each}
        </div>

        <div class="usage-history">
          <h4>Historique récent</h4>
          <div class="history-list">
            {#each usageRecords.slice(0, 20) as record}
              <div class="history-item">
                <span class="history-time">
                  {record.timestamp.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span class="history-provider">{getProviderInfo(record.provider).icon}</span>
                <span class="history-model">{record.model}</span>
                <span class="history-tokens">{record.inputTokens + record.outputTokens} tokens</span>
                <span class="history-cost">{formatCost(record.cost)}</span>
              </div>
            {:else}
              <p class="empty">Aucun historique</p>
            {/each}
          </div>
        </div>

        <button class="clear-btn" onclick={() => usageStore.clear()}>
          Effacer l'historique
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .ai-settings {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .tab {
    flex: 1;
    padding: 10px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
  }

  .tab:hover {
    background: var(--bg-hover);
  }

  .tab.active {
    color: var(--accent-primary);
    border-bottom: 2px solid var(--accent-primary);
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  /* Providers */
  .providers-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .provider-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
  }

  .provider-card.active {
    border-color: var(--accent-primary);
  }

  .provider-card.enabled {
    opacity: 1;
  }

  .provider-card:not(.enabled) {
    opacity: 0.6;
  }

  .provider-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .provider-icon {
    font-size: 20px;
  }

  .provider-name {
    flex: 1;
    font-weight: 500;
  }

  .toggle {
    position: relative;
    width: 40px;
    height: 20px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--border-color);
    border-radius: 20px;
    transition: 0.3s;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    border-radius: 50%;
    transition: 0.3s;
  }

  .toggle input:checked + .toggle-slider {
    background-color: var(--accent-primary);
  }

  .toggle input:checked + .toggle-slider:before {
    transform: translateX(20px);
  }

  .provider-config {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }

  .config-field {
    margin-bottom: 8px;
  }

  .config-field label {
    display: block;
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .config-field input {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 13px;
  }

  .provider-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .test-btn,
  .use-btn {
    padding: 4px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: none;
    font-size: 12px;
    cursor: pointer;
  }

  .use-btn {
    background: var(--accent-primary);
    color: var(--bg-primary);
    border-color: var(--accent-primary);
  }

  .test-result {
    font-size: 11px;
  }

  .test-result.success {
    color: #22c55e;
  }

  .test-result:not(.success) {
    color: #ef4444;
  }

  .active-badge {
    padding: 2px 8px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    border-radius: 10px;
    font-size: 11px;
  }

  /* Models */
  .models-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .current-model {
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .current-model .label {
    color: var(--text-secondary);
    font-size: 12px;
  }

  .current-model .model-name {
    font-weight: 500;
    color: var(--accent-primary);
  }

  .provider-models h4 {
    margin: 0 0 8px 0;
    font-size: 13px;
  }

  .models-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
    margin-bottom: 16px;
  }

  .model-card {
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    cursor: pointer;
    text-align: left;
  }

  .model-card:hover {
    border-color: var(--accent-primary);
  }

  .model-card.selected {
    border-color: var(--accent-primary);
    background: rgba(var(--accent-primary-rgb), 0.1);
  }

  .model-card .model-name {
    font-weight: 500;
    font-size: 13px;
    margin-bottom: 4px;
  }

  .model-meta {
    display: flex;
    gap: 8px;
    font-size: 10px;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .local-badge {
    background: #22c55e;
    color: white;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .cap-badge {
    font-size: 9px;
    padding: 2px 4px;
    background: var(--bg-primary);
    border-radius: 3px;
    color: var(--text-secondary);
  }

  /* Routing */
  .routing-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .auto-route-toggle {
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 6px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }

  .hint {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .rules-list h4 {
    margin: 0 0 12px 0;
  }

  .rule-card {
    position: relative;
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .rule-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .rule-name {
    font-weight: 500;
  }

  .rule-priority {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .rule-condition,
  .rule-target {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .remove-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 2px 6px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .new-rule-form {
    display: grid;
    gap: 8px;
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px dashed var(--accent-primary);
    border-radius: 6px;
  }

  .new-rule-form input,
  .new-rule-form select {
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .form-actions button {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: none;
    cursor: pointer;
  }

  .save-btn {
    background: var(--accent-primary) !important;
    color: var(--bg-primary) !important;
    border-color: var(--accent-primary) !important;
  }

  .add-rule-btn {
    width: 100%;
    padding: 10px;
    border: 1px dashed var(--accent-primary);
    border-radius: 6px;
    background: none;
    color: var(--accent-primary);
    cursor: pointer;
  }

  /* Usage */
  .usage-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .usage-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .stat-card {
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
    text-align: center;
  }

  .stat-label {
    display: block;
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--accent-primary);
  }

  .usage-by-provider {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .provider-usage {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: 6px;
  }

  .provider-usage .provider-name {
    flex: 1;
  }

  .provider-cost {
    font-weight: 500;
    color: var(--accent-primary);
  }

  .provider-count {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .usage-history h4 {
    margin: 0 0 8px 0;
  }

  .history-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    font-size: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .history-time {
    color: var(--text-secondary);
    width: 50px;
  }

  .history-model {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .history-tokens,
  .history-cost {
    color: var(--text-secondary);
  }

  .clear-btn {
    padding: 8px 16px;
    border: 1px solid #ef4444;
    border-radius: 4px;
    background: none;
    color: #ef4444;
    cursor: pointer;
  }

  .empty {
    text-align: center;
    color: var(--text-secondary);
    padding: 24px;
  }

  /* Auth type selector */
  .auth-type-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .auth-type-btn {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .auth-type-btn:hover {
    border-color: var(--accent-primary);
  }

  .auth-type-btn.active {
    background: var(--accent-primary);
    color: var(--bg-primary);
    border-color: var(--accent-primary);
  }

  /* OAuth section */
  .oauth-section {
    text-align: center;
    padding: 12px;
  }

  .oauth-btn {
    padding: 10px 20px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    border: none;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .oauth-btn:hover {
    opacity: 0.9;
  }

  /* Custom provider form */
  .custom-provider-form {
    background: var(--bg-secondary);
    border: 1px dashed var(--accent-primary);
    border-radius: 8px;
    padding: 16px;
  }

  .custom-provider-form h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: var(--accent-primary);
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .form-grid .full-width {
    grid-column: 1 / -1;
  }

  .add-provider-btn {
    width: 100%;
    padding: 12px;
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .add-provider-btn:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
</style>
