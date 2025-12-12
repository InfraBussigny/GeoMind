<script lang="ts">
  interface Props {
    connectionId: string;
  }
  let { connectionId }: Props = $props();

  // State
  let environments = $state<any[]>([]);
  let loading = $state(false);
  let creating = $state(false);

  // Placeholder - will be implemented with Docker integration
  async function createEnvironment() {
    creating = true;
    // TODO: Call API to create Docker container with pg clone
    await new Promise(r => setTimeout(r, 2000));
    creating = false;
  }
</script>

<div class="test-environment">
  <div class="feature-card">
    <div class="feature-icon">🧪</div>
    <h2>Environnement de Test</h2>
    <p>Creez des copies isolees de votre base de donnees pour tester en toute securite.</p>

    <div class="features-list">
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Clone complet de la base (schema + donnees)</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Isolation via Docker PostgreSQL</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Snapshots et restauration rapide</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Anonymisation automatique des donnees sensibles</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Destruction automatique (TTL configurable)</span>
      </div>
    </div>

    <div class="requirements">
      <h4>Pre-requis</h4>
      <ul>
        <li>Docker Desktop installe et en cours d'execution</li>
        <li>Image PostGIS disponible (postgis/postgis:15-3.3)</li>
      </ul>
    </div>

    <div class="status-check">
      <span class="status-indicator warning"></span>
      <span>Fonctionnalite en cours de developpement</span>
    </div>

    <button class="create-btn" disabled>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      Creer un environnement de test
    </button>
  </div>

  {#if environments.length > 0}
    <div class="environments-list">
      <h3>Environnements actifs</h3>
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
  {/if}
</div>

<style>
  .test-environment {
    padding: 20px;
  }

  .feature-card {
    max-width: 600px;
    margin: 0 auto;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 32px;
    text-align: center;
  }

  .feature-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  h2 {
    margin: 0 0 12px;
    color: var(--text-bright);
  }

  p {
    color: var(--text-secondary);
    margin: 0 0 24px;
    line-height: 1.6;
  }

  .features-list {
    text-align: left;
    margin-bottom: 24px;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .check {
    color: var(--cyber-green);
    font-weight: bold;
  }

  .requirements {
    text-align: left;
    padding: 16px;
    background: var(--noir-surface);
    border-radius: 8px;
    margin-bottom: 24px;
  }

  .requirements h4 {
    margin: 0 0 8px;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .requirements ul {
    margin: 0;
    padding-left: 20px;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .requirements li {
    margin: 4px 0;
  }

  .status-check {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 24px;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-indicator.warning {
    background: #ffc107;
    box-shadow: 0 0 8px rgba(255, 193, 7, 0.5);
  }

  .create-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .create-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 0 20px var(--cyber-green-glow);
  }

  .create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .create-btn svg {
    width: 20px;
    height: 20px;
  }

  .environments-list {
    margin-top: 24px;
  }

  .environments-list h3 {
    margin: 0 0 16px;
    color: var(--text-bright);
  }

  .env-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-bottom: 8px;
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
    background: var(--noir-surface);
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
