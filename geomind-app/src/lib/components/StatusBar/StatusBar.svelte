<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import {
    currentModule,
    backendConnected,
    isLoading,
    appMode,
    wakeLockStore
  } from '$lib/stores/app';

  // State
  let currentTime = $state(new Date());
  let sessionStart = $state(new Date());
  let timeInterval: ReturnType<typeof setInterval>;

  // Connection states
  let vpnConnected = $state(false);
  let serverConnections = $state<{name: string; host: string; isConnected: boolean}[]>([]);
  let showServerDetails = $state(false);

  // VPN check interval
  let vpnCheckInterval: ReturnType<typeof setInterval>;
  let serverCheckInterval: ReturnType<typeof setInterval>;

  onMount(() => {
    if (!browser) return;

    // Update time every second
    timeInterval = setInterval(() => {
      currentTime = new Date();
    }, 1000);

    // Check VPN status periodically
    checkVpnStatus();
    vpnCheckInterval = setInterval(checkVpnStatus, 30000);

    // Check servers status periodically
    checkServersStatus();
    serverCheckInterval = setInterval(checkServersStatus, 10000);
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
    if (vpnCheckInterval) clearInterval(vpnCheckInterval);
    if (serverCheckInterval) clearInterval(serverCheckInterval);
  });

  async function checkVpnStatus() {
    try {
      const res = await fetch('http://localhost:3001/api/vpn/status');
      const data = await res.json();
      if (data.success) {
        vpnConnected = data.status.vpnConnected;
      }
    } catch {
      vpnConnected = false;
    }
  }

  async function checkServersStatus() {
    // Fetch connections from backend API
    try {
      const res = await fetch('http://localhost:3001/api/connections');
      if (res.ok) {
        const connections = await res.json();
        serverConnections = connections.map((c: any) => ({
          name: c.name || c.database || 'Sans nom',
          host: c.host || c.url || 'localhost',
          isConnected: c.status === 'connected'
        }));
      } else {
        serverConnections = [];
      }
    } catch {
      serverConnections = [];
    }
  }

  // Derived values for servers
  const connectedServersCount = $derived(serverConnections.filter(s => s.isConnected).length);
  const totalServersCount = $derived(serverConnections.length);

  // Module names
  const moduleNames: Record<string, string> = {
    chat: 'Assistant',
    canvas: 'Cartes',
    cad: 'CAD',
    editor: 'Editeur',
    databases: 'Databases',
    converter: 'Convertisseur',
    wakelock: 'Anti-veille',
    timepro: 'TimePro',
    comm: 'Communications',
    docgen: 'Documents',
    connections: 'Connexions',
    settings: 'Parametres',
    wip: 'WIP',
    vpn: 'VPN',
    kdrive: 'kDrive'
  };

  // Format time
  function formatTime(date: Date): string {
    return date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  }

  // Session duration
  function getSessionDuration(): string {
    const diff = currentTime.getTime() - sessionStart.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h${minutes.toString().padStart(2, '0')}`;
    return `${minutes}m`;
  }

  // Mode display
  function getModeDisplay(mode: string): { label: string; class: string } {
    switch (mode) {
      case 'expert': return { label: 'Expert', class: 'expert' };
      case 'god': return { label: 'GOD', class: 'god' };
      case 'bfsa': return { label: 'BFSA', class: 'bfsa' };
      default: return { label: 'Standard', class: 'standard' };
    }
  }

  const modeInfo = $derived(getModeDisplay($appMode));

  // Format wake lock time
  function formatWakeLockTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
    return `${m}m`;
  }
</script>

<footer class="status-bar">
  <!-- Section gauche: Module actif & Mode -->
  <div class="status-section left">
    <div class="status-item module-indicator">
      <span class="module-name">{moduleNames[$currentModule] || $currentModule}</span>
    </div>

    <div class="status-divider"></div>

    <div class="status-item mode-indicator {modeInfo.class}">
      <span class="mode-label">{modeInfo.label}</span>
    </div>
  </div>

  <!-- Section centrale: Indicateurs de connexion -->
  <div class="status-section center">
    <!-- Backend IA -->
    <div class="status-item connection-indicator" class:connected={$backendConnected} class:loading={$isLoading} title="Backend IA">
      <span class="indicator-dot"></span>
      <span class="indicator-label">Backend</span>
    </div>

    <div class="status-divider"></div>

    <!-- VPN -->
    <div class="status-item connection-indicator" class:connected={vpnConnected} title="VPN FortiClient">
      <span class="indicator-dot"></span>
      <span class="indicator-label">VPN</span>
    </div>

    <div class="status-divider"></div>

    <!-- Serveurs PostGIS -->
    <div
      class="status-item connection-indicator servers-indicator"
      class:connected={connectedServersCount > 0}
      class:has-servers={totalServersCount > 0}
      onmouseenter={() => showServerDetails = true}
      onmouseleave={() => showServerDetails = false}
      role="button"
      tabindex="0"
    >
      <span class="indicator-dot"></span>
      <span class="indicator-label">Serveurs</span>
      {#if totalServersCount > 0}
        <span class="indicator-count">{connectedServersCount}/{totalServersCount}</span>
      {/if}

      <!-- Server details dropdown -->
      {#if showServerDetails && serverConnections.length > 0}
        <div class="server-details-dropdown">
          <div class="dropdown-header">Connexions PostGIS</div>
          {#each serverConnections as server}
            <div class="server-item" class:connected={server.isConnected}>
              <span class="server-dot"></span>
              <span class="server-name">{server.name}</span>
              <span class="server-host">{server.host}</span>
            </div>
          {/each}
        </div>
      {:else if showServerDetails && serverConnections.length === 0}
        <div class="server-details-dropdown">
          <div class="dropdown-empty">Aucune connexion configuree</div>
        </div>
      {/if}
    </div>

    <div class="status-divider"></div>

    <!-- Anti-veille -->
    <div class="status-item connection-indicator" class:connected={$wakeLockStore.isActive} title="Anti-veille ecran">
      <span class="indicator-dot"></span>
      <span class="indicator-label">Veille</span>
      {#if $wakeLockStore.isActive}
        <span class="indicator-time">{formatWakeLockTime($wakeLockStore.activeTime)}</span>
      {/if}
    </div>
  </div>

  <!-- Section droite: Session & Heure -->
  <div class="status-section right">
    <div class="status-item session-info">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span class="session-duration">{getSessionDuration()}</span>
    </div>

    <div class="status-divider"></div>

    <div class="status-item time-display">
      <span class="time">{formatTime(currentTime)}</span>
    </div>
  </div>
</footer>

<style>
  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 26px;
    padding: 0 12px;
    background: var(--noir-profond, #0a0a0f);
    color: var(--text-secondary, #888);
    font-size: 11px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    border-top: 1px solid var(--border-color, #1a1a2e);
    user-select: none;
  }

  .status-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-section.left {
    flex: 0 0 auto;
  }

  .status-section.center {
    flex: 1;
    justify-content: center;
    gap: 12px;
  }

  .status-section.right {
    flex: 0 0 auto;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 2px 6px;
    border-radius: 3px;
    transition: all 0.15s;
  }

  .status-divider {
    width: 1px;
    height: 12px;
    background: var(--border-color, #1a1a2e);
    opacity: 0.5;
  }

  /* Module indicator */
  .module-indicator {
    background: rgba(0, 255, 136, 0.1);
    border: 1px solid rgba(0, 255, 136, 0.2);
  }

  .module-name {
    color: var(--cyber-green, #00ff88);
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Mode indicator */
  .mode-indicator {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .mode-indicator.standard {
    background: rgba(100, 100, 100, 0.2);
    color: #888;
    border: 1px solid rgba(100, 100, 100, 0.3);
  }

  .mode-indicator.expert {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .mode-indicator.god {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
    border: 1px solid rgba(168, 85, 247, 0.3);
    animation: god-glow 2s infinite;
  }

  .mode-indicator.bfsa {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }

  @keyframes god-glow {
    0%, 100% { box-shadow: 0 0 4px rgba(168, 85, 247, 0.3); }
    50% { box-shadow: 0 0 8px rgba(168, 85, 247, 0.5); }
  }

  /* Connection indicators */
  .connection-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .indicator-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
    transition: all 0.3s;
  }

  .connection-indicator.connected .indicator-dot {
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
  }

  .connection-indicator.loading .indicator-dot {
    background: #3b82f6;
    animation: pulse-loading 0.8s infinite;
  }

  @keyframes pulse-loading {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  .indicator-label {
    font-size: 10px;
    color: var(--text-secondary, #888);
    transition: color 0.2s;
  }

  .connection-indicator.connected .indicator-label {
    color: var(--text-primary, #fff);
  }

  .indicator-count {
    font-size: 9px;
    color: var(--text-secondary, #888);
    opacity: 0.7;
  }

  .indicator-time {
    font-size: 9px;
    color: #22c55e;
    font-weight: 500;
  }

  /* Session info */
  .session-info {
    color: var(--text-secondary, #888);
  }

  .session-info .icon {
    width: 12px;
    height: 12px;
    opacity: 0.6;
  }

  .session-duration {
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }

  /* Time display */
  .time-display {
    min-width: 40px;
    justify-content: flex-end;
  }

  .time {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted, #666);
  }

  /* Hover effects */
  .connection-indicator:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .connection-indicator:hover .indicator-label {
    color: var(--text-primary, #fff);
  }

  /* Server indicator with dropdown */
  .servers-indicator {
    position: relative;
    cursor: pointer;
  }

  .servers-indicator.has-servers:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  /* Server details dropdown */
  .server-details-dropdown {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    min-width: 200px;
    background: var(--noir-profond, #0a0a0f);
    border: 1px solid var(--border-color, #1a1a2e);
    border-radius: 6px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    overflow: hidden;
  }

  .dropdown-header {
    padding: 8px 12px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary, #888);
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid var(--border-color, #1a1a2e);
  }

  .dropdown-empty {
    padding: 12px;
    font-size: 11px;
    color: var(--text-secondary, #888);
    text-align: center;
  }

  .server-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    transition: background 0.15s;
  }

  .server-item:last-child {
    border-bottom: none;
  }

  .server-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .server-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
    flex-shrink: 0;
  }

  .server-item.connected .server-dot {
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
  }

  .server-name {
    flex: 1;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-primary, #fff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .server-host {
    font-size: 9px;
    color: var(--text-secondary, #888);
    font-family: var(--font-mono, monospace);
  }

  /* Arrow indicator */
  .server-details-dropdown::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid var(--border-color, #1a1a2e);
  }

  .server-details-dropdown::before {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid var(--noir-profond, #0a0a0f);
    z-index: 1;
  }
</style>
