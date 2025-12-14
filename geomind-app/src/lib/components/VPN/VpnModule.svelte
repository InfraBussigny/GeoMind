<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  const API_BASE = 'http://localhost:3001/api';

  // State
  let isLoading = $state(false);
  let status = $state<{
    fortiClientInstalled: boolean;
    fortiClientRunning: boolean;
    vpnConnected: boolean;
    vpnName: string | null;
    vpnIp: string | null;
  }>({
    fortiClientInstalled: false,
    fortiClientRunning: false,
    vpnConnected: false,
    vpnName: null,
    vpnIp: null
  });

  let lastError = $state<string | null>(null);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let lastConnectedTime = $state<Date | null>(null);
  let connectionHistory = $state<Array<{time: Date, connected: boolean}>>([]);

  onMount(() => {
    if (!browser) return;

    // Load connection history
    try {
      const saved = localStorage.getItem('geomind_vpn_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        connectionHistory = parsed.map((h: any) => ({ ...h, time: new Date(h.time) })).slice(0, 10);
      }
    } catch (e) {
      console.warn('Failed to load VPN history:', e);
    }

    fetchStatus();
    refreshInterval = setInterval(() => fetchStatus(), 10000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });

  async function fetchStatus() {
    isLoading = true;
    try {
      const res = await fetch(`${API_BASE}/vpn/status`);
      const data = await res.json();
      if (data.success) {
        const wasConnected = status.vpnConnected;
        status = data.status;
        lastError = null;

        // Track connection changes
        if (status.vpnConnected && !wasConnected) {
          lastConnectedTime = new Date();
          addToHistory(true);
        } else if (!status.vpnConnected && wasConnected) {
          addToHistory(false);
        }
      } else {
        lastError = data.error || 'Erreur de statut VPN';
      }
    } catch (err) {
      lastError = 'Impossible de contacter le serveur';
    } finally {
      isLoading = false;
    }
  }

  function addToHistory(connected: boolean) {
    const entry = { time: new Date(), connected };
    connectionHistory = [entry, ...connectionHistory].slice(0, 10);
    if (browser) {
      localStorage.setItem('geomind_vpn_history', JSON.stringify(connectionHistory));
    }
  }

  async function launchConsole() {
    try {
      await fetch(`${API_BASE}/vpn/launch`, { method: 'POST' });
    } catch (err) {
      lastError = 'Impossible de lancer FortiClient';
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(date: Date): string {
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui " + formatTime(date);
    }
    return date.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }) + ' ' + formatTime(date);
  }
</script>

<div class="vpn-module">
  <div class="vpn-content">
    <!-- Main Status Card -->
    <div class="status-card" class:connected={status.vpnConnected}>
      <div class="status-icon-large">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          {#if status.vpnConnected}
            <path d="M9 12l2 2 4-4" stroke-width="2"/>
          {/if}
        </svg>
      </div>

      <div class="status-text">
        <span class="status-label">{status.vpnConnected ? 'VPN Connecte' : 'VPN Deconnecte'}</span>
        {#if status.vpnConnected && status.vpnIp}
          <span class="status-ip">{status.vpnIp}</span>
        {/if}
      </div>

      <button class="refresh-btn" onclick={fetchStatus} disabled={isLoading} title="Actualiser">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spinning={isLoading}>
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
      </button>
    </div>

    <!-- Quick Status -->
    <div class="quick-status">
      <div class="status-dot" class:ok={status.fortiClientInstalled}></div>
      <span>FortiClient {status.fortiClientInstalled ? 'installe' : 'non installe'}</span>
      <div class="status-dot" class:ok={status.fortiClientRunning}></div>
      <span>Service {status.fortiClientRunning ? 'actif' : 'inactif'}</span>
    </div>

    <!-- Action -->
    <button class="launch-btn" onclick={launchConsole} disabled={!status.fortiClientInstalled}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
      Ouvrir FortiClient
    </button>

    <p class="note">Connexion manuelle via l'interface FortiClient (EMS)</p>

    {#if lastError}
      <div class="error-msg">{lastError}</div>
    {/if}

    <!-- Connection History -->
    {#if connectionHistory.length > 0}
      <div class="history-section">
        <h4>Historique des connexions</h4>
        <div class="history-list">
          {#each connectionHistory as entry}
            <div class="history-item" class:connected={entry.connected}>
              <span class="history-dot"></span>
              <span class="history-text">{entry.connected ? 'Connexion' : 'Deconnexion'}</span>
              <span class="history-time">{formatDate(entry.time)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Info Panel -->
  <div class="info-panel">
    <div class="info-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    </div>
    <div class="info-text">
      <strong>Integration limitee</strong>
      <p>FortiClient est une application Windows native geree par EMS (Endpoint Management Server).
         La connexion VPN doit etre etablie via l'interface FortiClient.</p>
      <p>GeoMind surveille le statut et vous permet de lancer rapidement FortiClient.</p>
    </div>
  </div>
</div>

<style>
  .vpn-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--text-primary);
    overflow: hidden;
  }

  .vpn-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 2rem;
    overflow-y: auto;
  }

  /* Main Status Card */
  .status-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem 3rem;
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 16px;
    position: relative;
    transition: all 0.3s ease;
  }

  .status-card.connected {
    border-color: var(--accent-color, #00ff88);
    box-shadow: 0 0 30px rgba(0, 255, 136, 0.15);
  }

  .status-icon-large {
    width: 80px;
    height: 80px;
    color: var(--text-secondary);
    transition: color 0.3s;
  }

  .status-card.connected .status-icon-large {
    color: var(--accent-color, #00ff88);
  }

  .status-icon-large svg {
    width: 100%;
    height: 100%;
  }

  .status-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .status-label {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .status-ip {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1rem;
    color: var(--accent-color, #00ff88);
    background: rgba(0, 255, 136, 0.1);
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
  }

  .refresh-btn {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 32px;
    height: 32px;
    padding: 6px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-btn:hover:not(:disabled) {
    border-color: var(--accent-color, #00ff88);
    color: var(--text-primary);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-btn svg {
    width: 100%;
    height: 100%;
  }

  .refresh-btn svg.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    100% { transform: rotate(360deg); }
  }

  /* Quick Status */
  .quick-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff6464;
  }

  .status-dot.ok {
    background: var(--accent-color, #00ff88);
  }

  .quick-status span:not(:last-child) {
    margin-right: 1rem;
  }

  /* Launch Button */
  .launch-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 2rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .launch-btn:hover:not(:disabled) {
    border-color: var(--accent-color, #00ff88);
    background: var(--bg-tertiary);
  }

  .launch-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .launch-btn svg {
    width: 18px;
    height: 18px;
  }

  /* Note */
  .note {
    font-size: 0.75rem;
    color: var(--text-secondary);
    opacity: 0.7;
    margin: 0;
  }

  /* Error */
  .error-msg {
    padding: 0.5rem 1rem;
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid #ff4444;
    border-radius: 6px;
    color: #ff4444;
    font-size: 0.8rem;
  }

  /* History Section */
  .history-section {
    width: 100%;
    max-width: 400px;
    margin-top: 1rem;
  }

  .history-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    font-size: 0.8rem;
  }

  .history-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff6464;
  }

  .history-item.connected .history-dot {
    background: var(--accent-color, #00ff88);
  }

  .history-text {
    flex: 1;
    color: var(--text-secondary);
  }

  .history-time {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* Info Panel */
  .info-panel {
    display: flex;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: rgba(0, 212, 255, 0.05);
    border-top: 1px solid var(--border-color);
  }

  .info-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    color: #00d4ff;
    opacity: 0.8;
  }

  .info-icon svg {
    width: 100%;
    height: 100%;
  }

  .info-text {
    flex: 1;
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .info-text strong {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .info-text p {
    margin: 0 0 0.5rem 0;
  }

  .info-text p:last-child {
    margin-bottom: 0;
  }
</style>
