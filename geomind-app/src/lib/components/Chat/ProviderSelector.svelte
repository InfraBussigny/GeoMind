<script lang="ts">
  import { currentProvider, currentModel, providers, backendConnected } from '$lib/stores/app';

  let isOpen = $state(false);

  function selectProvider(providerId: string) {
    const provider = $providers.find(p => p.id === providerId);
    if (!provider?.isConfigured) return;

    currentProvider.set(providerId);
    const defaultModel = provider.models.find(m => m.default) || provider.models[0];
    if (defaultModel) {
      currentModel.set(defaultModel.id);
    }
    isOpen = false;
  }

  function selectModel(modelId: string) {
    currentModel.set(modelId);
    isOpen = false;
  }

  function getProviderIcon(providerId: string): string {
    const icons: Record<string, string> = {
      claude: 'C',
      openai: 'O',
      mistral: 'M',
      deepseek: 'D',
      perplexity: 'P',
      ollama: '🦙',
      lmstudio: 'L',
      google: 'G'
    };
    return icons[providerId] || '?';
  }

  function getProviderColor(providerId: string): string {
    const colors: Record<string, string> = {
      claude: '#D97706',
      openai: '#10A37F',
      mistral: '#FF6B35',
      deepseek: '#0066FF',
      perplexity: '#6366F1',
      ollama: '#FFFFFF',
      lmstudio: '#00D9FF',
      google: '#4285F4'
    };
    return colors[providerId] || '#666';
  }

  $effect(() => {
    // Close dropdown when clicking outside
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.provider-selector')) {
        isOpen = false;
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  });

  // Get current provider object
  const currentProviderObj = $derived($providers.find(p => p.id === $currentProvider));
  const currentModelObj = $derived(currentProviderObj?.models.find(m => m.id === $currentModel));
</script>

<div class="provider-selector">
  <button
    class="selector-button"
    onclick={() => isOpen = !isOpen}
    disabled={!$backendConnected}
  >
    <span
      class="provider-badge"
      style="background: {getProviderColor($currentProvider)}"
    >
      {getProviderIcon($currentProvider)}
    </span>
    <span class="selector-text">
      <span class="provider-name">{currentProviderObj?.name.split(' ')[0] || 'Claude'}</span>
      <span class="model-name">{currentModelObj?.name || 'Sonnet'}</span>
    </span>
    <svg class="chevron" class:open={isOpen} width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    </svg>
  </button>

  {#if isOpen}
    <div class="dropdown">
      <div class="dropdown-section">
        <div class="section-title">Provider</div>
        {#each $providers as provider}
          <button
            class="dropdown-item"
            class:active={$currentProvider === provider.id}
            class:disabled={!provider.isConfigured}
            onclick={() => selectProvider(provider.id)}
            disabled={!provider.isConfigured}
          >
            <span
              class="item-badge"
              style="background: {provider.isConfigured ? getProviderColor(provider.id) : '#ccc'}"
            >
              {getProviderIcon(provider.id)}
            </span>
            <span class="item-content">
              <span class="item-name">{provider.name}</span>
              {#if provider.isConfigured}
                <span class="item-status configured">{provider.authMethod}</span>
              {:else}
                <span class="item-status">Non configure</span>
              {/if}
            </span>
            {#if $currentProvider === provider.id}
              <svg class="check" width="14" height="14" viewBox="0 0 14 14" fill="var(--cyber-green)">
                <path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
            {/if}
          </button>
        {/each}
      </div>

      {#if currentProviderObj?.isConfigured}
        <div class="dropdown-divider"></div>
        <div class="dropdown-section">
          <div class="section-title">Modele</div>
          {#each currentProviderObj.models as model}
            <button
              class="dropdown-item model-item"
              class:active={$currentModel === model.id}
              onclick={() => selectModel(model.id)}
            >
              <span class="item-name">{model.name}</span>
              {#if model.default}
                <span class="default-badge">Par defaut</span>
              {/if}
              {#if $currentModel === model.id}
                <svg class="check" width="14" height="14" viewBox="0 0 14 14" fill="var(--cyber-green)">
                  <path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
                </svg>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .provider-selector {
    position: relative;
  }

  .selector-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .selector-button:hover:not(:disabled) {
    background: var(--noir-elevated);
    border-color: var(--cyber-green);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  .selector-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .provider-badge {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    font-weight: 700;
    font-family: var(--font-mono);
    box-shadow: 0 0 8px currentColor;
  }

  .selector-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.2;
  }

  .provider-name {
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .model-name {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .chevron {
    color: var(--text-muted);
    transition: transform var(--transition-fast);
  }

  .chevron.open {
    transform: rotate(180deg);
    color: var(--cyber-green);
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 280px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-lg), 0 0 20px var(--cyber-green-glow);
    z-index: 100;
    overflow: hidden;
  }

  /* Green line on top of dropdown */
  .dropdown::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--cyber-green), transparent);
  }

  .dropdown-section {
    padding: 8px;
  }

  .section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--cyber-green);
    padding: 4px 8px;
    letter-spacing: 1px;
    font-family: var(--font-mono);
  }

  .dropdown-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-color), transparent);
    margin: 0;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px;
    border: 1px solid transparent;
    background: transparent;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
  }

  .dropdown-item:hover:not(:disabled) {
    background: var(--noir-elevated);
    border-color: var(--border-color);
  }

  .dropdown-item.active {
    background: var(--cyber-green-glow);
    border-color: var(--cyber-green);
  }

  .dropdown-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .item-badge {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    font-weight: 700;
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .item-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-name {
    font-size: 13px;
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .item-status {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .item-status.configured {
    color: var(--success);
  }

  .model-item {
    padding-left: 16px;
  }

  .model-item .item-name {
    flex: 1;
  }

  .default-badge {
    font-size: 9px;
    padding: 2px 8px;
    background: var(--noir-elevated);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .check {
    flex-shrink: 0;
    color: var(--cyber-green);
  }
</style>
