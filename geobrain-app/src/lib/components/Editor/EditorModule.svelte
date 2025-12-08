<script lang="ts">
  import { editorContent, currentFile } from '$lib/stores/app';

  let selectedLanguage = $state('sql');
  let files = $state([
    { name: 'requete_parcelles.sql', language: 'sql' },
    { name: 'export_cadastre.py', language: 'python' },
    { name: 'analyse_batiments.sql', language: 'sql' },
  ]);

  let editorValue = $state(`-- Requête SQL spatiale exemple
-- Sélection des parcelles dans un rayon de 500m

SELECT
    p.egrid,
    p.numero,
    p.surface,
    ST_Area(p.geometry) as surface_calc,
    ST_Distance(p.geometry, ST_SetSRID(ST_MakePoint(2538245, 1152890), 2056)) as distance
FROM
    cadastre.parcelles p
WHERE
    ST_DWithin(
        p.geometry,
        ST_SetSRID(ST_MakePoint(2538245, 1152890), 2056),
        500
    )
ORDER BY
    distance ASC;`);

  function runCode() {
    console.log('Exécution du code:', editorValue);
    // TODO: Intégrer l'exécution via Tauri
  }

  function formatCode() {
    // TODO: Formatter le code SQL/Python
    console.log('Formatage du code');
  }

  function saveFile() {
    // TODO: Sauvegarder via Tauri
    console.log('Sauvegarde');
  }
</script>

<div class="editor-module">
  <div class="editor-toolbar">
    <div class="toolbar-section">
      <select bind:value={selectedLanguage} class="language-select">
        <option value="sql">SQL</option>
        <option value="python">Python</option>
        <option value="json">JSON/GeoJSON</option>
        <option value="fme">FME</option>
      </select>
    </div>
    <div class="toolbar-actions">
      <button class="toolbar-btn" on:click={formatCode} title="Formater">
        <span>🔧</span> Formater
      </button>
      <button class="toolbar-btn" on:click={saveFile} title="Sauvegarder">
        <span>💾</span> Sauvegarder
      </button>
      <button class="toolbar-btn primary" on:click={runCode} title="Exécuter">
        <span>▶️</span> Exécuter
      </button>
    </div>
  </div>

  <div class="editor-content">
    <aside class="files-panel">
      <h3>📁 Fichiers</h3>
      <div class="files-list">
        {#each files as file}
          <button class="file-item" class:active={$currentFile === file.name}>
            <span class="file-icon">
              {file.language === 'sql' ? '🔷' : file.language === 'python' ? '🐍' : '📄'}
            </span>
            <span class="file-name">{file.name}</span>
          </button>
        {/each}
      </div>
      <button class="new-file-btn">+ Nouveau fichier</button>
    </aside>

    <div class="editor-main">
      <div class="editor-area">
        <div class="line-numbers">
          {#each editorValue.split('\n') as _, i}
            <span>{i + 1}</span>
          {/each}
        </div>
        <textarea
          bind:value={editorValue}
          class="code-editor"
          spellcheck="false"
        ></textarea>
      </div>

      <div class="output-panel">
        <div class="output-header">
          <span>📤 Résultats</span>
          <button class="clear-btn">Effacer</button>
        </div>
        <div class="output-content">
          <p class="output-placeholder">Les résultats d'exécution s'afficheront ici...</p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .editor-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .editor-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    background: white;
    border-bottom: 1px solid var(--border-color);
  }

  .language-select {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-md);
    background: white;
  }

  .toolbar-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    background: white;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: all var(--transition-fast);
  }

  .toolbar-btn:hover {
    background: var(--bg-secondary);
  }

  .toolbar-btn.primary {
    background: var(--bleu-bussigny);
    color: white;
    border-color: var(--bleu-bussigny);
  }

  .toolbar-btn.primary:hover {
    background: var(--bleu-bussigny-dark);
  }

  .editor-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .files-panel {
    width: 220px;
    background: white;
    border-right: 1px solid var(--border-color);
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
  }

  .files-panel h3 {
    font-size: var(--font-size-md);
    color: var(--bleu-bussigny);
    margin-bottom: var(--spacing-md);
  }

  .files-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    border: none;
    background: transparent;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    text-align: left;
    transition: background var(--transition-fast);
  }

  .file-item:hover {
    background: var(--bg-secondary);
  }

  .file-item.active {
    background: var(--bleu-bussigny);
    color: white;
  }

  .file-name {
    font-size: var(--font-size-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .new-file-btn {
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm);
    border: 1px dashed var(--border-color);
    background: transparent;
    border-radius: var(--border-radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: var(--font-size-sm);
  }

  .new-file-btn:hover {
    border-color: var(--bleu-bussigny);
    color: var(--bleu-bussigny);
  }

  .editor-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor-area {
    flex: 1;
    display: flex;
    background: #1e1e1e;
    overflow: hidden;
  }

  .line-numbers {
    padding: var(--spacing-md);
    background: #252526;
    color: #858585;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    line-height: 1.6;
    text-align: right;
    user-select: none;
    display: flex;
    flex-direction: column;
    min-width: 50px;
  }

  .code-editor {
    flex: 1;
    padding: var(--spacing-md);
    border: none;
    background: #1e1e1e;
    color: #d4d4d4;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    line-height: 1.6;
    resize: none;
    outline: none;
  }

  .output-panel {
    height: 200px;
    border-top: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    background: white;
  }

  .output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .clear-btn {
    padding: 2px 8px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: var(--font-size-xs);
  }

  .clear-btn:hover {
    color: var(--bleu-bussigny);
  }

  .output-content {
    flex: 1;
    padding: var(--spacing-md);
    overflow: auto;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .output-placeholder {
    color: var(--text-muted);
    font-style: italic;
  }
</style>
