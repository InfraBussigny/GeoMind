<script lang="ts">
  interface Props {
    connectionId: string;
  }
  let { connectionId }: Props = $props();

  // State
  let includeAiDescriptions = $state(true);
  let includeSampleData = $state(false);
  let outputFormat = $state<'html' | 'markdown' | 'pdf'>('html');
  let selectedSchemas = $state<string[]>(['public']);
  let generating = $state(false);
  let progress = $state(0);

  async function generateDocumentation() {
    generating = true;
    progress = 0;

    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      progress = i;
      await new Promise(r => setTimeout(r, 200));
    }

    // TODO: Call API to generate documentation
    generating = false;
  }
</script>

<div class="doc-generator">
  <div class="feature-card">
    <div class="feature-icon">📚</div>
    <h2>Documentation Automatique</h2>
    <p>Generez une documentation complete et interactive de votre base de donnees.</p>

    <div class="features-list">
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Extraction automatique du schema et des commentaires</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Descriptions generees par IA pour chaque table</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Diagramme ERD integre</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Export HTML interactif, Markdown ou PDF</span>
      </div>
      <div class="feature-item">
        <span class="check">✓</span>
        <span>Recherche integree dans la documentation</span>
      </div>
    </div>

    <div class="generator-form">
      <div class="form-group">
        <label>Schemas a documenter</label>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" checked={selectedSchemas.includes('public')} />
            <span>public</span>
          </label>
          <!-- More schemas will be populated dynamically -->
        </div>
      </div>

      <div class="form-group">
        <label>Options</label>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={includeAiDescriptions} />
            <span>Descriptions IA pour les tables</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={includeSampleData} />
            <span>Inclure des exemples de donnees</span>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="output-format">Format de sortie</label>
        <select id="output-format" bind:value={outputFormat}>
          <option value="html">HTML interactif</option>
          <option value="markdown">Markdown</option>
          <option value="pdf">PDF</option>
        </select>
      </div>

      {#if generating}
        <div class="progress-bar">
          <div class="progress-fill" style="width: {progress}%"></div>
        </div>
        <p class="progress-text">Generation en cours... {progress}%</p>
      {/if}

      <button class="generate-btn" onclick={generateDocumentation} disabled={generating}>
        {#if generating}
          <span class="spinner"></span>
          Generation...
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          Generer la documentation
        {/if}
      </button>
    </div>

    <div class="preview-section">
      <h4>Apercu de la documentation</h4>
      <div class="preview-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
        <p>La documentation generee apparaitra ici</p>
      </div>
    </div>

    <div class="status-check">
      <span class="status-indicator warning"></span>
      <span>Fonctionnalite en cours de developpement</span>
    </div>
  </div>
</div>

<style>
  .doc-generator {
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

  .form-group > label {
    display: block;
    margin-bottom: 8px;
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .form-group select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-card);
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .form-group select:focus {
    outline: none;
    border-color: var(--cyber-green);
  }

  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--cyber-green);
  }

  .progress-bar {
    height: 8px;
    background: var(--noir-card);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-fill {
    height: 100%;
    background: var(--cyber-green);
    transition: width 0.3s ease;
  }

  .progress-text {
    text-align: center;
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 0 0 16px;
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

  .preview-section {
    margin-top: 20px;
    padding: 16px;
    background: var(--noir-surface);
    border-radius: 8px;
  }

  .preview-section h4 {
    margin: 0 0 12px;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .preview-placeholder {
    padding: 40px;
    text-align: center;
    color: var(--text-muted);
    border: 2px dashed var(--border-color);
    border-radius: 8px;
  }

  .preview-placeholder svg {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .preview-placeholder p {
    margin: 0;
    font-size: 0.9rem;
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
