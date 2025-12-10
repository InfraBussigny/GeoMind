<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    sshStore,
    tunnelsStore,
    connectSSH,
    disconnectSSH,
    executeSSHCommand,
    sftpList,
    startTunnel,
    stopTunnel,
    type SSHConnection,
    type SSHTunnel,
    type SFTPEntry,
    formatBytes,
    TUNNEL_TEMPLATES
  } from '$lib/services/ssh';

  // Props
  interface Props {
    connectionId?: string;
  }

  let { connectionId }: Props = $props();

  // State
  let connections = $state<SSHConnection[]>([]);
  let tunnels = $state<SSHTunnel[]>([]);
  let selectedConnection = $state<SSHConnection | null>(null);
  let activeTab = $state<'terminal' | 'sftp' | 'tunnels'>('terminal');

  // Terminal state
  let commandHistory = $state<string[]>([]);
  let historyIndex = $state(-1);
  let currentCommand = $state('');
  let terminalOutput = $state<Array<{ type: 'command' | 'output' | 'error'; text: string }>>([]);
  let isExecuting = $state(false);

  // SFTP state
  let currentPath = $state('/home');
  let sftpEntries = $state<SFTPEntry[]>([]);
  let sftpLoading = $state(false);

  // Connection form
  let showConnectForm = $state(false);
  let connectPassword = $state('');

  // New tunnel form
  let showTunnelForm = $state(false);
  let newTunnelName = $state('');
  let newTunnelLocalPort = $state(0);
  let newTunnelRemoteHost = $state('localhost');
  let newTunnelRemotePort = $state(0);

  let terminalRef: HTMLDivElement;

  // Subscribe to stores
  $effect(() => {
    const unsubConn = sshStore.subscribe(c => {
      connections = c;
      if (connectionId) {
        selectedConnection = c.find(conn => conn.id === connectionId) || null;
      }
    });
    const unsubTunnels = tunnelsStore.subscribe(t => tunnels = t);

    return () => {
      unsubConn();
      unsubTunnels();
    };
  });

  // Auto-scroll terminal
  $effect(() => {
    if (terminalRef && terminalOutput.length > 0) {
      terminalRef.scrollTop = terminalRef.scrollHeight;
    }
  });

  // Select connection
  function selectConnection(conn: SSHConnection) {
    selectedConnection = conn;
    terminalOutput = [];
    commandHistory = [];

    if (conn.status === 'connected') {
      loadSFTP();
    }
  }

  // Connect
  async function connect() {
    if (!selectedConnection) return;

    const result = await connectSSH(selectedConnection.id, {
      password: connectPassword
    });

    if (result.success) {
      terminalOutput = [...terminalOutput, {
        type: 'output',
        text: `Connected to ${selectedConnection.host}`
      }];
      showConnectForm = false;
      connectPassword = '';
      loadSFTP();
    } else {
      terminalOutput = [...terminalOutput, {
        type: 'error',
        text: `Connection failed: ${result.error}`
      }];
    }
  }

  // Disconnect
  async function disconnect() {
    if (!selectedConnection) return;
    await disconnectSSH(selectedConnection.id);
    terminalOutput = [...terminalOutput, {
      type: 'output',
      text: 'Disconnected'
    }];
  }

  // Execute command
  async function executeCommand() {
    if (!selectedConnection || !currentCommand.trim() || isExecuting) return;

    const cmd = currentCommand.trim();
    terminalOutput = [...terminalOutput, { type: 'command', text: `$ ${cmd}` }];

    // Add to history
    if (commandHistory[commandHistory.length - 1] !== cmd) {
      commandHistory = [...commandHistory, cmd];
    }
    historyIndex = commandHistory.length;
    currentCommand = '';
    isExecuting = true;

    const result = await executeSSHCommand(selectedConnection.id, cmd);

    if (result.success) {
      if (result.stdout) {
        terminalOutput = [...terminalOutput, { type: 'output', text: result.stdout }];
      }
      if (result.stderr) {
        terminalOutput = [...terminalOutput, { type: 'error', text: result.stderr }];
      }
    } else {
      terminalOutput = [...terminalOutput, {
        type: 'error',
        text: result.error || 'Command execution failed'
      }];
    }

    isExecuting = false;
  }

  // Handle terminal keydown
  function handleTerminalKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        currentCommand = commandHistory[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        currentCommand = commandHistory[historyIndex];
      } else {
        historyIndex = commandHistory.length;
        currentCommand = '';
      }
    }
  }

  // Load SFTP directory
  async function loadSFTP(path?: string) {
    if (!selectedConnection || selectedConnection.status !== 'connected') return;

    const targetPath = path || currentPath;
    sftpLoading = true;

    const result = await sftpList(selectedConnection.id, targetPath);

    if (result.success && result.entries) {
      sftpEntries = result.entries.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      currentPath = targetPath;
    }

    sftpLoading = false;
  }

  // Navigate SFTP
  function navigateSFTP(entry: SFTPEntry) {
    if (entry.type === 'directory') {
      loadSFTP(entry.path);
    }
  }

  // Go to parent directory
  function goToParent() {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    loadSFTP('/' + parts.join('/') || '/');
  }

  // Get tunnels for selected connection
  let connectionTunnels = $derived(() => {
    if (!selectedConnection) return [];
    return tunnels.filter(t => t.connectionId === selectedConnection.id);
  });

  // Add tunnel
  function addTunnel() {
    if (!selectedConnection || !newTunnelName || !newTunnelLocalPort || !newTunnelRemotePort) return;

    tunnelsStore.add({
      connectionId: selectedConnection.id,
      name: newTunnelName,
      type: 'local',
      localPort: newTunnelLocalPort,
      remoteHost: newTunnelRemoteHost,
      remotePort: newTunnelRemotePort,
      autoConnect: false
    });

    newTunnelName = '';
    newTunnelLocalPort = 0;
    newTunnelRemoteHost = 'localhost';
    newTunnelRemotePort = 0;
    showTunnelForm = false;
  }

  // Apply tunnel template
  function applyTemplate(template: typeof TUNNEL_TEMPLATES[0]) {
    newTunnelName = template.name;
    newTunnelLocalPort = template.localPort;
    newTunnelRemoteHost = template.remoteHost;
    newTunnelRemotePort = template.remotePort;
    showTunnelForm = true;
  }

  // Toggle tunnel
  async function toggleTunnel(tunnel: SSHTunnel) {
    if (tunnel.status === 'active') {
      await stopTunnel(tunnel.id);
    } else {
      await startTunnel(tunnel.id);
    }
  }

  // Get status color
  function getStatusColor(status: string): string {
    switch (status) {
      case 'connected':
      case 'active':
        return 'var(--accent-primary)';
      case 'connecting':
        return '#ffd700';
      case 'error':
        return '#ff6b6b';
      default:
        return 'var(--text-secondary)';
    }
  }
</script>

<div class="ssh-terminal">
  <!-- Sidebar: Connections list -->
  <div class="connections-sidebar">
    <h3>Connexions SSH</h3>

    <div class="connections-list">
      {#each connections as conn}
        <button
          class="connection-item"
          class:selected={selectedConnection?.id === conn.id}
          onclick={() => selectConnection(conn)}
        >
          <span
            class="status-dot"
            style="background: {getStatusColor(conn.status)}"
          ></span>
          <div class="conn-info">
            <span class="conn-name">{conn.name}</span>
            <span class="conn-host">{conn.username}@{conn.host}</span>
          </div>
        </button>
      {:else}
        <p class="empty-message">Aucune connexion configurée</p>
      {/each}
    </div>
  </div>

  <!-- Main content -->
  <div class="main-content">
    {#if selectedConnection}
      <!-- Connection header -->
      <div class="connection-header">
        <div class="conn-title">
          <span
            class="status-indicator"
            style="background: {getStatusColor(selectedConnection.status)}"
          ></span>
          <h2>{selectedConnection.name}</h2>
          <span class="conn-details">{selectedConnection.username}@{selectedConnection.host}:{selectedConnection.port}</span>
        </div>

        <div class="conn-actions">
          {#if selectedConnection.status === 'connected'}
            <button class="action-btn disconnect" onclick={disconnect}>
              Déconnecter
            </button>
          {:else}
            <button
              class="action-btn connect"
              onclick={() => showConnectForm = true}
            >
              Connecter
            </button>
          {/if}
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          class="tab"
          class:active={activeTab === 'terminal'}
          onclick={() => activeTab = 'terminal'}
        >
          Terminal
        </button>
        <button
          class="tab"
          class:active={activeTab === 'sftp'}
          onclick={() => activeTab = 'sftp'}
        >
          SFTP
        </button>
        <button
          class="tab"
          class:active={activeTab === 'tunnels'}
          onclick={() => activeTab = 'tunnels'}
        >
          Tunnels ({connectionTunnels().length})
        </button>
      </div>

      <!-- Tab content -->
      <div class="tab-content">
        {#if activeTab === 'terminal'}
          <div class="terminal-container">
            <div class="terminal-output" bind:this={terminalRef}>
              {#each terminalOutput as line}
                <div class="terminal-line {line.type}">
                  {line.text}
                </div>
              {/each}
            </div>

            <div class="terminal-input">
              <span class="prompt">$</span>
              <input
                type="text"
                bind:value={currentCommand}
                onkeydown={handleTerminalKeydown}
                disabled={selectedConnection.status !== 'connected' || isExecuting}
                placeholder={selectedConnection.status !== 'connected' ? 'Non connecté...' : 'Entrez une commande...'}
              />
            </div>
          </div>

        {:else if activeTab === 'sftp'}
          <div class="sftp-container">
            <div class="sftp-toolbar">
              <button onclick={goToParent} disabled={currentPath === '/'}>
                ⬆️ Parent
              </button>
              <span class="current-path">{currentPath}</span>
              <button onclick={() => loadSFTP()}>🔄 Rafraîchir</button>
            </div>

            <div class="sftp-list">
              {#if sftpLoading}
                <div class="loading">Chargement...</div>
              {:else}
                {#each sftpEntries as entry}
                  <button
                    class="sftp-entry"
                    class:directory={entry.type === 'directory'}
                    onclick={() => navigateSFTP(entry)}
                  >
                    <span class="entry-icon">
                      {entry.type === 'directory' ? '📁' : '📄'}
                    </span>
                    <span class="entry-name">{entry.name}</span>
                    <span class="entry-size">{formatBytes(entry.size)}</span>
                    <span class="entry-perms">{entry.permissions}</span>
                  </button>
                {:else}
                  <p class="empty-message">Dossier vide</p>
                {/each}
              {/if}
            </div>
          </div>

        {:else if activeTab === 'tunnels'}
          <div class="tunnels-container">
            <button
              class="add-tunnel-btn"
              onclick={() => showTunnelForm = !showTunnelForm}
            >
              {showTunnelForm ? '✕ Annuler' : '+ Nouveau tunnel'}
            </button>

            {#if showTunnelForm}
              <div class="tunnel-form">
                <div class="templates">
                  <span class="templates-label">Templates:</span>
                  {#each TUNNEL_TEMPLATES as template}
                    <button
                      class="template-btn"
                      onclick={() => applyTemplate(template)}
                    >
                      {template.name}
                    </button>
                  {/each}
                </div>

                <input
                  type="text"
                  placeholder="Nom du tunnel"
                  bind:value={newTunnelName}
                />
                <div class="tunnel-ports">
                  <input
                    type="number"
                    placeholder="Port local"
                    bind:value={newTunnelLocalPort}
                  />
                  <span>→</span>
                  <input
                    type="text"
                    placeholder="Hôte distant"
                    bind:value={newTunnelRemoteHost}
                  />
                  <span>:</span>
                  <input
                    type="number"
                    placeholder="Port distant"
                    bind:value={newTunnelRemotePort}
                  />
                </div>
                <button class="save-btn" onclick={addTunnel}>
                  Créer le tunnel
                </button>
              </div>
            {/if}

            <div class="tunnels-list">
              {#each connectionTunnels() as tunnel}
                <div class="tunnel-item">
                  <div class="tunnel-info">
                    <span class="tunnel-name">{tunnel.name}</span>
                    <span class="tunnel-mapping">
                      localhost:{tunnel.localPort} → {tunnel.remoteHost}:{tunnel.remotePort}
                    </span>
                  </div>
                  <div class="tunnel-actions">
                    <span
                      class="tunnel-status"
                      style="color: {getStatusColor(tunnel.status)}"
                    >
                      {tunnel.status}
                    </span>
                    <button
                      class="toggle-btn"
                      class:active={tunnel.status === 'active'}
                      onclick={() => toggleTunnel(tunnel)}
                    >
                      {tunnel.status === 'active' ? '⏹ Stop' : '▶ Start'}
                    </button>
                    <button
                      class="delete-btn"
                      onclick={() => tunnelsStore.remove(tunnel.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              {:else}
                <p class="empty-message">Aucun tunnel configuré</p>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="no-selection">
        <p>Sélectionnez une connexion SSH pour commencer</p>
      </div>
    {/if}
  </div>

  <!-- Connect dialog -->
  {#if showConnectForm && selectedConnection}
    <div
      class="modal-overlay"
      onclick={() => showConnectForm = false}
      onkeydown={(e) => e.key === 'Escape' && (showConnectForm = false)}
      role="button"
      tabindex="-1"
    >
      <div
        class="modal"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>Connexion à {selectedConnection.name}</h3>
        <p>{selectedConnection.username}@{selectedConnection.host}</p>

        <input
          type="password"
          placeholder="Mot de passe"
          bind:value={connectPassword}
          onkeydown={(e) => e.key === 'Enter' && connect()}
        />

        <div class="modal-actions">
          <button class="cancel-btn" onclick={() => showConnectForm = false}>
            Annuler
          </button>
          <button class="connect-btn" onclick={connect}>
            Connecter
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .ssh-terminal {
    display: flex;
    height: 100%;
    background: var(--bg-primary);
  }

  .connections-sidebar {
    width: 250px;
    border-right: 1px solid var(--border-color);
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
  }

  .connections-sidebar h3 {
    padding: 12px;
    margin: 0;
    font-size: 14px;
    border-bottom: 1px solid var(--border-color);
  }

  .connections-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .connection-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    text-align: left;
    margin-bottom: 4px;
  }

  .connection-item:hover {
    background: var(--bg-hover);
  }

  .connection-item.selected {
    background: var(--bg-hover);
    border-color: var(--accent-primary);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .conn-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .conn-name {
    font-weight: 500;
    font-size: 13px;
  }

  .conn-host {
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .connection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .conn-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .conn-title h2 {
    margin: 0;
    font-size: 16px;
  }

  .conn-details {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .action-btn {
    padding: 6px 16px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }

  .action-btn.connect {
    background: var(--accent-primary);
    color: var(--bg-primary);
  }

  .action-btn.disconnect {
    background: #ff6b6b;
    color: white;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
  }

  .tab {
    padding: 10px 20px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
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
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Terminal */
  .terminal-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #1e1e1e;
    font-family: 'Consolas', 'Monaco', monospace;
  }

  .terminal-output {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    font-size: 13px;
    line-height: 1.4;
  }

  .terminal-line {
    white-space: pre-wrap;
    word-break: break-all;
  }

  .terminal-line.command {
    color: var(--accent-primary);
  }

  .terminal-line.output {
    color: #d4d4d4;
  }

  .terminal-line.error {
    color: #ff6b6b;
  }

  .terminal-input {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-top: 1px solid #333;
    background: #2d2d2d;
  }

  .prompt {
    color: var(--accent-primary);
    margin-right: 8px;
    font-weight: bold;
  }

  .terminal-input input {
    flex: 1;
    border: none;
    background: none;
    color: #d4d4d4;
    font-family: inherit;
    font-size: 13px;
    outline: none;
  }

  /* SFTP */
  .sftp-container {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .sftp-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .sftp-toolbar button {
    padding: 4px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    cursor: pointer;
  }

  .current-path {
    flex: 1;
    font-family: monospace;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .sftp-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .sftp-entry {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: none;
    cursor: pointer;
    text-align: left;
  }

  .sftp-entry:hover {
    background: var(--bg-hover);
  }

  .sftp-entry.directory {
    font-weight: 500;
  }

  .entry-name {
    flex: 1;
    font-size: 13px;
  }

  .entry-size,
  .entry-perms {
    font-size: 11px;
    color: var(--text-secondary);
  }

  /* Tunnels */
  .tunnels-container {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .add-tunnel-btn {
    width: 100%;
    padding: 10px;
    border: 1px dashed var(--accent-primary);
    border-radius: 6px;
    background: none;
    color: var(--accent-primary);
    cursor: pointer;
    margin-bottom: 12px;
  }

  .tunnel-form {
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    margin-bottom: 12px;
  }

  .templates {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .templates-label {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .template-btn {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    font-size: 11px;
    cursor: pointer;
  }

  .tunnel-form input {
    width: 100%;
    padding: 8px;
    margin-bottom: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .tunnel-ports {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tunnel-ports input {
    flex: 1;
    width: auto;
  }

  .save-btn {
    width: 100%;
    padding: 8px;
    border: none;
    border-radius: 4px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    cursor: pointer;
  }

  .tunnels-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tunnel-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
  }

  .tunnel-name {
    font-weight: 500;
    display: block;
  }

  .tunnel-mapping {
    font-size: 11px;
    color: var(--text-secondary);
    font-family: monospace;
  }

  .tunnel-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tunnel-status {
    font-size: 11px;
    text-transform: uppercase;
  }

  .toggle-btn {
    padding: 4px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    font-size: 11px;
    cursor: pointer;
  }

  .toggle-btn.active {
    background: var(--accent-primary);
    color: var(--bg-primary);
    border-color: var(--accent-primary);
  }

  .delete-btn {
    padding: 4px 8px;
    border: none;
    background: none;
    cursor: pointer;
    opacity: 0.5;
  }

  .delete-btn:hover {
    opacity: 1;
  }

  .no-selection,
  .empty-message,
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
    font-size: 14px;
  }

  /* Modal */
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

  .modal {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 20px;
    width: 350px;
  }

  .modal h3 {
    margin: 0 0 4px 0;
  }

  .modal p {
    margin: 0 0 16px 0;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .modal input {
    width: 100%;
    padding: 10px;
    margin-bottom: 16px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .cancel-btn,
  .connect-btn {
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  }

  .cancel-btn {
    border: 1px solid var(--border-color);
    background: none;
    color: var(--text-secondary);
  }

  .connect-btn {
    border: none;
    background: var(--accent-primary);
    color: var(--bg-primary);
  }
</style>
