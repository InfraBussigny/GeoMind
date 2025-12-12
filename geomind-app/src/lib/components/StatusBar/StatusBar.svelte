<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    currentProvider,
    currentModel,
    backendConnected,
    isLoading
  } from '$lib/stores/app';
  import { getUsageStats, type UsageStats } from '$lib/services/api';

  // Props
  let { currentProject = 'GeoMind' }: { currentProject?: string } = $props();

  // State
  let usageStats = $state<UsageStats | null>(null);
  let systemStats = $state({ cpu: 0, memory: 0 });
  let currentTime = $state(new Date());
  let sessionStart = $state(new Date());
  let refreshInterval: ReturnType<typeof setInterval>;
  let timeInterval: ReturnType<typeof setInterval>;

  onMount(() => {
    loadUsageStats();
    // Rafraichir les stats toutes les 30 secondes
    refreshInterval = setInterval(loadUsageStats, 30000);
    // Mettre a jour l'heure chaque seconde
    timeInterval = setInterval(() => {
      currentTime = new Date();
    }, 1000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (timeInterval) clearInterval(timeInterval);
  });

  async function loadUsageStats() {
    try {
      usageStats = await getUsageStats();
    } catch (e) {
      // Silently fail - backend might not have this endpoint yet
      console.debug('Usage stats not available');
    }
  }

  // Formater le nom du modele
  function formatModelName(modelId: string): string {
    const modelNames: Record<string, string> = {
      'claude-sonnet-4-20250514': 'Sonnet 4',
      'claude-opus-4-20250514': 'Opus 4',
      'claude-3-5-haiku-20241022': 'Haiku 3.5',
      'claude-3-5-sonnet-20241022': 'Sonnet 3.5',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'mistral-large-latest': 'Mistral Large',
      'deepseek-chat': 'DeepSeek'
    };
    return modelNames[modelId] || modelId.split('-').slice(0, 2).join(' ');
  }

  // Formater les tokens
  function formatTokens(count: number): string {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  }

  // Formater le cout
  function formatCost(cost: number): string {
    return `$${cost.toFixed(2)}`;
  }

  // Calculer le temps de session
  function getSessionDuration(): string {
    const diff = currentTime.getTime() - sessionStart.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  // Formater l'heure
  function formatTime(date: Date): string {
    return date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  }

  // Status de connexion
  function getConnectionStatus(): { text: string; class: string } {
    if (!$backendConnected) return { text: 'Deconnecte', class: 'disconnected' };
    if ($isLoading) return { text: 'Generation...', class: 'loading' };
    return { text: 'Connecte', class: 'connected' };
  }

  const connectionStatus = $derived(getConnectionStatus());
</script>

<footer class="status-bar">
  <!-- Section gauche: Projet et statut -->
  <div class="status-section left">
    <div class="status-item project">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="value">{currentProject}</span>
    </div>

    <div class="status-divider"></div>

    <div class="status-item connection {connectionStatus.class}">
      <span class="status-dot"></span>
      <span class="value">{connectionStatus.text}</span>
    </div>
  </div>

  <!-- Section centrale: Modele et tokens -->
  <div class="status-section center">
    {#if $backendConnected}
      <div class="status-item model">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v10"/>
          <path d="M1 12h6m6 0h10"/>
        </svg>
        <span class="label">Modele:</span>
        <span class="value highlight">{formatModelName($currentModel)}</span>
      </div>

      <div class="status-divider"></div>

      <div class="status-item tokens">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <span class="label">Session:</span>
        <span class="value">{usageStats ? formatTokens(usageStats.sessionTokens) : '0'} tok</span>
        {#if usageStats && usageStats.sessionCost > 0}
          <span class="cost">({formatCost(usageStats.sessionCost)})</span>
        {/if}
      </div>

      {#if usageStats && usageStats.monthlyTokens > 0}
        <div class="status-divider"></div>

        <div class="status-item monthly">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span class="label">Mois:</span>
          <span class="value">{formatTokens(usageStats.monthlyTokens)}</span>
          {#if usageStats.monthlyLimit}
            <span class="quota">/ {formatTokens(usageStats.monthlyLimit)}</span>
            <div class="quota-bar">
              <div
                class="quota-fill"
                class:warning={usageStats.monthlyTokens / usageStats.monthlyLimit > 0.8}
                class:danger={usageStats.monthlyTokens / usageStats.monthlyLimit > 0.95}
                style="width: {Math.min(100, (usageStats.monthlyTokens / usageStats.monthlyLimit) * 100)}%"
              ></div>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>

  <!-- Section droite: Temps et systeme -->
  <div class="status-section right">
    <div class="status-item session-time">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span class="label">Session:</span>
      <span class="value">{getSessionDuration()}</span>
    </div>

    <div class="status-divider"></div>

    <div class="status-item time">
      <span class="value">{formatTime(currentTime)}</span>
    </div>
  </div>
</footer>

<style>
  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 28px;
    padding: 0 var(--spacing-md);
    background: var(--noir-profond);
    color: var(--text-secondary);
    font-size: 11px;
    font-family: var(--font-mono);
    border-top: 1px solid var(--border-color);
    user-select: none;
    position: relative;
  }

  /* Ligne verte subtile en haut */
  .status-bar::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--cyber-green), transparent);
    opacity: 0.3;
  }

  .status-section {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .status-section.left {
    flex: 0 0 auto;
  }

  .status-section.center {
    flex: 1;
    justify-content: center;
  }

  .status-section.right {
    flex: 0 0 auto;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 3px;
    transition: all var(--transition-fast);
    border: 1px solid transparent;
  }

  .status-item:hover {
    background: var(--noir-card);
    border-color: var(--border-color);
  }

  .status-divider {
    width: 1px;
    height: 12px;
    background: var(--border-color);
  }

  .icon {
    width: 12px;
    height: 12px;
    opacity: 0.6;
  }

  .label {
    opacity: 0.5;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .value {
    font-weight: 500;
    color: var(--text-primary);
  }

  .value.highlight {
    color: var(--cyber-green);
    text-shadow: 0 0 8px var(--cyber-green-glow);
  }

  .cost, .quota {
    opacity: 0.5;
    font-size: 10px;
  }

  /* Connection status */
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--gris-light);
  }

  .connection.connected .status-dot {
    background: var(--cyber-green);
    box-shadow: 0 0 8px var(--cyber-green-glow);
    animation: pulse-glow-dot 2s infinite;
  }

  .connection.disconnected .status-dot {
    background: var(--error);
    box-shadow: 0 0 6px var(--error-glow);
  }

  .connection.loading .status-dot {
    background: var(--accent-cyan);
    animation: pulse-dot 0.8s infinite;
    box-shadow: 0 0 8px var(--info-glow);
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.8); }
  }

  @keyframes pulse-glow-dot {
    0%, 100% { box-shadow: 0 0 4px var(--cyber-green-glow); }
    50% { box-shadow: 0 0 10px var(--cyber-green-glow); }
  }

  /* Quota bar */
  .quota-bar {
    width: 40px;
    height: 3px;
    background: var(--noir-card);
    border-radius: 2px;
    overflow: hidden;
    margin-left: 4px;
    border: 1px solid var(--border-color);
  }

  .quota-fill {
    height: 100%;
    background: var(--cyber-green);
    transition: width 0.3s ease;
    box-shadow: 0 0 6px var(--cyber-green-glow);
  }

  .quota-fill.warning {
    background: var(--warning);
    box-shadow: 0 0 6px var(--warning-glow);
  }

  .quota-fill.danger {
    background: var(--error);
    box-shadow: 0 0 6px var(--error-glow);
    animation: pulse-danger 1s infinite;
  }

  @keyframes pulse-danger {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  /* Project */
  .project {
    color: var(--cyber-green);
  }

  .project .icon {
    opacity: 1;
    color: var(--cyber-green);
  }

  .project .value {
    color: var(--cyber-green);
    text-shadow: 0 0 8px var(--cyber-green-glow);
  }

  /* Model */
  .model .value.highlight {
    color: var(--accent-cyan);
    text-shadow: 0 0 8px var(--info-glow);
  }

  /* Time */
  .time .value {
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }

  .session-time .value {
    color: var(--text-secondary);
  }
</style>
