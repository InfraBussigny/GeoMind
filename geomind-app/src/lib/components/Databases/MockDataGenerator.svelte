<script lang="ts">
  interface Props {
    connectionId: string;
  }
  let { connectionId }: Props = $props();

  // State
  let tables = $state<string[]>([]);
  let selectedTable = $state<string | null>(null);
  let rowCount = $state(100);
  let generating = $state(false);
  let generatedSql = $state('');

  // Placeholder for mock data generation
  async function generateMockData() {
    if (!selectedTable) return;
    generating = true;
    // TODO: Call API to generate mock data
    await new Promise(r => setTimeout(r, 1500));
    generatedSql = `-- Mock data pour ${selectedTable}\n-- ${rowCount} lignes generees\nINSERT INTO ${selectedTable} (...) VALUES\n  (...),\n  (...),\n  ...;`;
    generating = false;
  }
</script>

<div class="mock-generator">
  <div class="feature-card">
    <div class="feature-icon">🎲</div>
    <h2>Generateur de Donnees Mock</h2>
    <p>Generez des donnees realistes pour vos tests et developpements.</p>

    <div class="features-list">
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Donnees suisses realistes (NPA, villes, noms)</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Support PostGIS (geometries dans le perimetre Bussigny)</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Respect des contraintes FK et UNIQUE</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Detection intelligente des types de colonnes</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Export SQL ou insertion directe</span>
      </div>
    </div>

    <div class="generator-form">
      <div class="form-group">
        <label for="table-select">Table cible</label>
        <select id="table-select" bind:value={selectedTable}>
          <option value="">Selectionner une table...</option>
          <!-- Tables will be populated from schema -->
        </select>
      </div>

      <div class="form-group">
        <label for="row-count">Nombre de lignes</label>
        <input
          type="number"
          id="row-count"
          bind:value={rowCount}
          min="1"
          max="10000"
        />
      </div>

      <button class="generate-btn" onclick={generateMockData} disabled={!selectedTable || generating}>
        {#if generating}
          <span class="spinner"></span>
          Generation en cours...
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
          </svg>
          Generer les donnees
        {/if}
      </button>
    </div>

    {#if generatedSql}
      <div class="generated-output">
        <h4>SQL genere</h4>
        <pre><code>{generatedSql}</code></pre>
        <div class="output-actions">
          <button>Copier</button>
          <button class="primary">Executer</button>
        </div>
      </div>
    {/if}

    <div class="status-check">
      <span class="status-indicator warning"></span>
      <span>Fonctionnalite en cours de developpement</span>
    </div>
  </div>
</div>

<style>
  .mock-generator {
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

  .generator-form {
    text-align: left;
    padding: 20px;
    background: var(--noir-surface);
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .form-group select,
  .form-group input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-card);
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .form-group select:focus,
  .form-group input:focus {
    outline: none;
    border-color: var(--cyber-green);
  }

  .generate-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 0 20px var(--cyber-green-glow);
  }

  .generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .generate-btn svg {
    width: 20px;
    height: 20px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .generated-output {
    text-align: left;
    margin: 20px 0;
    padding: 16px;
    background: var(--noir-surface);
    border-radius: 8px;
  }

  .generated-output h4 {
    margin: 0 0 12px;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .generated-output pre {
    margin: 0 0 12px;
    padding: 12px;
    background: var(--noir-profond);
    border-radius: 6px;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--cyber-green);
  }

  .output-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .output-actions button {
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-card);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .output-actions button:hover {
    background: var(--bg-hover);
    color: var(--text-bright);
  }

  .output-actions button.primary {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .status-check {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 20px;
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
</style>
