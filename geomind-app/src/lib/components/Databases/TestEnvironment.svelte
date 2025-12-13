<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    connectionId: string;
  }
  let { connectionId }: Props = $props();

  // State
  let dockerStatus = $state<'checking' | 'available' | 'unavailable' | 'error'>('checking');
  let dockerVersion = $state<string | null>(null);
  let environments = $state<any[]>([]);
  let creating = $state(false);
  let error = $state<string | null>(null);

  // Check if Docker is available via backend
  async function checkDockerStatus() {
    dockerStatus = 'checking';
    try {
      const res = await fetch('http://localhost:3001/api/system/docker-status');
      if (res.ok) {
        const data = await res.json();
        if (data.available) {
          dockerStatus = 'available';
          dockerVersion = data.version || 'Version inconnue';
        } else {
          dockerStatus = 'unavailable';
        }
      } else {
        // API doesn't exist yet - show as unavailable
        dockerStatus = 'unavailable';
      }
    } catch (err) {
      // Backend doesn't have this endpoint yet
      dockerStatus = 'unavailable';
    }
  }

  // Alternative: Create a pg_dump export for testing
  async function exportForTesting() {
    creating = true;
    error = null;
    try {
      const res = await fetch(`http://localhost:3001/api/databases/${connectionId}/export-schema`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schema_export_${new Date().toISOString().split('T')[0]}.sql`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur export';
    } finally {
      creating = false;
    }
  }

  onMount(() => {
    checkDockerStatus();
  });
</script>

<div class="test-environment">
  <!-- Docker Status Card -->
  <div class="status-card">
    <div class="status-header">
      <h2>Environnement de Test</h2>
      <p>Testez vos modifications en toute securite</p>
    </div>

    <div class="docker-status">
      <div class="docker-icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.186.186 0 00-.185.186v1.887c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.186.186 0 00-.185.185v1.888c0 .102.082.186.185.186m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.186.186 0 00-.185.185v1.888c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.186.186 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.186v1.887c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.186v1.887c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.186.186 0 00-.185.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.186v1.887c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z"/>
        </svg>
      </div>
      <div class="docker-info">
        {#if dockerStatus === 'checking'}
          <span class="status-label">Verification de Docker...</span>
          <span class="status-value checking">
            <span class="spinner small"></span>
          </span>
        {:else if dockerStatus === 'available'}
          <span class="status-label">Docker disponible</span>
          <span class="status-value available">{dockerVersion}</span>
        {:else}
          <span class="status-label">Docker non detecte</span>
          <span class="status-value unavailable">Non installe ou arrete</span>
        {/if}
      </div>
      <button class="refresh-status" onclick={checkDockerStatus} title="Verifier a nouveau">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Main Content -->
  <div class="content-grid">
    <!-- Docker Option -->
    <div class="option-card" class:disabled={dockerStatus !== 'available'}>
      <div class="option-header">
        <h3>Clone Docker</h3>
        {#if dockerStatus === 'available'}
          <span class="badge available">Disponible</span>
        {:else}
          <span class="badge unavailable">Indisponible</span>
        {/if}
      </div>
      <p>Clone complet de la base dans un conteneur Docker isole.</p>

      <ul class="feature-list">
        <li>Isolation complete</li>
        <li>Snapshots instantanes</li>
        <li>Destruction automatique</li>
      </ul>

      <button class="action-btn primary" disabled={dockerStatus !== 'available'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        Creer environnement
      </button>
    </div>

    <!-- SQL Export Option (always available) -->
    <div class="option-card">
      <div class="option-header">
        <h3>Export SQL</h3>
        <span class="badge available">Disponible</span>
      </div>
      <p>Exportez le schema et les donnees pour restauration manuelle.</p>

      <ul class="feature-list">
        <li>Schema + donnees (pg_dump)</li>
        <li>Compatible tout PostgreSQL</li>
        <li>Archivage possible</li>
      </ul>

      {#if error}
        <div class="error-msg">{error}</div>
      {/if}

      <button class="action-btn" onclick={exportForTesting} disabled={creating}>
        {#if creating}
          <span class="spinner small"></span>
          Export en cours...
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exporter le schema
        {/if}
      </button>
    </div>

    <!-- Manual Instructions -->
    <div class="option-card instructions">
      <div class="option-header">
        <h3>Test manuel</h3>
        <span class="badge info">Guide</span>
      </div>
      <p>Instructions pour creer un environnement de test manuellement.</p>

      <div class="instructions-content">
        <div class="step">
          <span class="step-num">1</span>
          <span>Installer Docker Desktop et l'image PostGIS:</span>
          <code>docker pull postgis/postgis:15-3.3</code>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <span>Creer un conteneur:</span>
          <code>docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=test postgis/postgis</code>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <span>Restaurer l'export SQL</span>
        </div>
      </div>
    </div>
  </div>

  {#if environments.length > 0}
    <div class="environments-section">
      <h3>Environnements actifs</h3>
      <div class="env-list">
        {#each environments as env}
          <div class="env-card">
            <div class="env-info">
              <span class="env-name">{env.name}</span>
              <span class="env-status">{env.status}</span>
            </div>
            <div class="env-actions">
              <button>Connexion</button>
              <button>Snapshot</button>
              <button class="danger">Detruire</button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .test-environment {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
  }

  .status-card {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
  }

  .status-header {
    margin-bottom: 16px;
  }

  .status-header h2 {
    margin: 0 0 4px;
    font-size: 1.2rem;
    color: var(--text-bright);
  }

  .status-header p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .docker-status {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--noir-surface);
    border-radius: 8px;
  }

  .docker-icon {
    width: 48px;
    height: 48px;
    color: #2496ED;
  }

  .docker-icon svg {
    width: 100%;
    height: 100%;
  }

  .docker-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .status-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .status-value {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .status-value.available {
    color: var(--cyber-green);
  }

  .status-value.unavailable {
    color: var(--text-muted);
  }

  .status-value.checking {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
  }

  .refresh-status {
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-status:hover {
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .refresh-status svg {
    width: 18px;
    height: 18px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 14px;
    height: 14px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .content-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  .option-card {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
  }

  .option-card.disabled {
    opacity: 0.6;
  }

  .option-card.instructions {
    grid-column: 1 / -1;
  }

  .option-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .option-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-bright);
  }

  .badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .badge.available {
    background: rgba(0, 255, 136, 0.15);
    color: var(--cyber-green);
  }

  .badge.unavailable {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-muted);
  }

  .badge.info {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .option-card > p {
    margin: 0 0 16px;
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .feature-list {
    margin: 0 0 16px;
    padding-left: 20px;
    flex: 1;
  }

  .feature-list li {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 6px 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--noir-surface);
    color: var(--text-secondary);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: auto;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-bright);
    border-color: var(--text-muted);
  }

  .action-btn.primary {
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-color: var(--cyber-green);
  }

  .action-btn.primary:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn svg {
    width: 18px;
    height: 18px;
  }

  .error-msg {
    margin-bottom: 12px;
    padding: 8px 12px;
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid var(--danger);
    border-radius: 6px;
    color: var(--danger);
    font-size: 0.85rem;
  }

  .instructions-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .step {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .step-num {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-radius: 50%;
    font-size: 0.8rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .step code {
    display: block;
    width: 100%;
    margin-top: 6px;
    margin-left: 34px;
    padding: 8px 12px;
    background: var(--noir-profond);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--cyber-green);
  }

  .environments-section {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
  }

  .environments-section h3 {
    margin: 0 0 16px;
    font-size: 1rem;
    color: var(--text-bright);
  }

  .env-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .env-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: var(--noir-surface);
    border-radius: 8px;
  }

  .env-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .env-name {
    font-weight: 600;
    color: var(--text-bright);
  }

  .env-status {
    padding: 4px 8px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .env-actions {
    display: flex;
    gap: 8px;
  }

  .env-actions button {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .env-actions button:hover {
    background: var(--bg-hover);
    color: var(--text-bright);
  }

  .env-actions button.danger:hover {
    background: rgba(255, 0, 0, 0.1);
    color: var(--danger);
    border-color: var(--danger);
  }
</style>
