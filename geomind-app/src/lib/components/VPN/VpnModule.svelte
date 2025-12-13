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

  onMount(() => {
    if (!browser) return;
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
        status = data.status;
        lastError = null;
      } else {
        lastError = data.error || 'Erreur de statut VPN';
      }
    } catch (err) {
      lastError = 'Impossible de contacter le serveur';
    } finally {
      isLoading = false;
    }
  }

  async function launchConsole() {
    try {
      await fetch(`${API_BASE}/vpn/launch`, { method: 'POST' });
    } catch (err) {
      lastError = 'Impossible de lancer FortiClient';
    }
  }
</script>

<div class="vpn-module">
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
</div>

<style>
  .vpn-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 2rem;
    background: var(--bg-primary);
    color: var(--text-primary);
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
</style>
