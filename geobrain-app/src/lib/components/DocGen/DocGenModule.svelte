<script lang="ts">
  let selectedTemplate = $state('pv');
  let isGenerating = $state(false);

  const templates = [
    { id: 'pv', name: 'Procès-verbal', icon: '📋', description: 'PV de séance avec sections structurées' },
    { id: 'note', name: 'Note de synthèse', icon: '📝', description: 'Note interne pour séance de service' },
    { id: 'rapport', name: 'Rapport technique', icon: '📊', description: 'Rapport avec tableaux et graphiques' },
    { id: 'documentation', name: 'Documentation', icon: '📖', description: 'Guide ou procédure technique' },
  ];

  const recentDocs = [
    { name: '2025-12-08_Note_Geoportail_Seance_Service.pdf', date: '08.12.2025', type: 'note' },
    { name: '2025-12-08_SDOL_GT.md', date: '08.12.2025', type: 'pv' },
    { name: 'Notice_plugin_assainissement.pdf', date: '05.12.2025', type: 'documentation' },
  ];

  function generateDocument() {
    isGenerating = true;
    setTimeout(() => {
      isGenerating = false;
      // TODO: Intégrer la génération via scripts Python
    }, 2000);
  }

  function openDocument(name: string) {
    console.log('Ouverture:', name);
    // TODO: Ouvrir via Tauri
  }
</script>

<div class="docgen-module">
  <header class="docgen-header">
    <h1>📄 Génération de documents</h1>
    <p>Créez des documents professionnels aux couleurs de Bussigny</p>
  </header>

  <div class="docgen-content">
    <section class="templates-section">
      <h2>Modèles disponibles</h2>
      <div class="templates-grid">
        {#each templates as template}
          <button
            class="template-card"
            class:selected={selectedTemplate === template.id}
            on:click={() => selectedTemplate = template.id}
          >
            <span class="template-icon">{template.icon}</span>
            <h3>{template.name}</h3>
            <p>{template.description}</p>
          </button>
        {/each}
      </div>
    </section>

    <section class="generator-section">
      <h2>Nouveau document</h2>
      <div class="generator-form">
        <div class="form-group">
          <label>Titre du document</label>
          <input type="text" placeholder="Ex: Séance GT SDOL - Décembre 2025" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Date</label>
            <input type="date" value="2025-12-08" />
          </div>
          <div class="form-group">
            <label>Auteur</label>
            <input type="text" value="Marc Zermatten" />
          </div>
        </div>

        <div class="form-group">
          <label>Contenu / Notes</label>
          <textarea rows="6" placeholder="Entrez le contenu brut ou les notes à transformer en document..."></textarea>
        </div>

        <div class="form-actions">
          <button class="btn-secondary">Aperçu</button>
          <button class="btn-primary" on:click={generateDocument} disabled={isGenerating}>
            {#if isGenerating}
              <span class="spinner"></span> Génération...
            {:else}
              ✨ Générer le PDF
            {/if}
          </button>
        </div>
      </div>
    </section>

    <section class="recent-section">
      <h2>Documents récents</h2>
      <div class="recent-list">
        {#each recentDocs as doc}
          <button class="recent-item" on:click={() => openDocument(doc.name)}>
            <span class="doc-icon">
              {doc.type === 'pv' ? '📋' : doc.type === 'note' ? '📝' : '📖'}
            </span>
            <div class="doc-info">
              <span class="doc-name">{doc.name}</span>
              <span class="doc-date">{doc.date}</span>
            </div>
            <span class="doc-action">📂</span>
          </button>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .docgen-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    overflow: auto;
  }

  .docgen-header {
    padding: var(--spacing-lg);
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
  }

  .docgen-header h1 {
    font-size: var(--font-size-xl);
    font-family: var(--font-mono);
    color: var(--cyber-green);
    margin-bottom: var(--spacing-xs);
  }

  .docgen-header p {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
  }

  .docgen-content {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
    max-width: 1200px;
  }

  section h2 {
    font-size: var(--font-size-lg);
    font-family: var(--font-mono);
    color: var(--text-primary);
    margin-bottom: var(--spacing-md);
  }

  .templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }

  .template-card {
    padding: var(--spacing-lg);
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .template-card:hover {
    border-color: var(--cyber-green);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .template-card.selected {
    border-color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.08);
    box-shadow: 0 0 20px var(--cyber-green-glow);
  }

  .template-icon {
    font-size: 32px;
    display: block;
    margin-bottom: var(--spacing-sm);
  }

  .template-card h3 {
    font-size: var(--font-size-md);
    font-family: var(--font-mono);
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .template-card.selected h3 {
    color: var(--cyber-green);
  }

  .template-card p {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .generator-section {
    background: var(--noir-card);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .generator-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .form-group label {
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--text-label);
  }

  .form-group input,
  .form-group textarea {
    padding: var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-md);
    font-family: var(--font-mono);
    background: var(--noir-surface);
    color: var(--text-primary);
  }

  .form-group input::placeholder,
  .form-group textarea::placeholder {
    color: var(--text-muted);
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--cyber-green);
    box-shadow: 0 0 0 3px var(--cyber-green-glow);
    background: var(--noir-elevated);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }

  .form-actions {
    display: flex;
    gap: var(--spacing-md);
    justify-content: flex-end;
    margin-top: var(--spacing-md);
  }

  .btn-secondary,
  .btn-primary {
    padding: var(--spacing-md) var(--spacing-xl);
    border: none;
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-md);
    font-family: var(--font-mono);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    transition: all var(--transition-fast);
  }

  .btn-secondary {
    background: var(--noir-surface);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .btn-primary {
    background: var(--cyber-green);
    color: var(--noir-profond);
    border: 1px solid var(--cyber-green);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--cyber-green-light);
    box-shadow: 0 0 20px var(--cyber-green-glow);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(0, 0, 0, 0.3);
    border-top-color: var(--noir-profond);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .recent-section {
    background: var(--noir-card);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--noir-surface);
    border: 1px solid transparent;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .recent-item:hover {
    background: var(--bg-hover);
    border-color: var(--border-color);
  }

  .doc-icon {
    font-size: 24px;
  }

  .doc-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .doc-name {
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .doc-date {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .doc-action {
    opacity: 0;
    color: var(--cyber-green);
    transition: opacity var(--transition-fast);
  }

  .recent-item:hover .doc-action {
    opacity: 1;
  }
</style>
