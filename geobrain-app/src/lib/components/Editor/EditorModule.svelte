<script lang="ts">
  import { browser } from '$app/environment';
  import { editorContent, currentFile } from '$lib/stores/app';
  import CollapsiblePanel from './CollapsiblePanel.svelte';
  import FileExplorer from './FileExplorer.svelte';
  import EditorChat from './EditorChat.svelte';
  import OutputPanel from './OutputPanel.svelte';

  // Dynamic import for Monaco (SSR safety)
  let MonacoEditor: any = $state(null);
  let monacoRef: any = $state(null);

  $effect(() => {
    if (browser) {
      import('./MonacoEditor.svelte').then(module => {
        MonacoEditor = module.default;
      });
    }
  });

  // Editor state
  let editorValue = $state(`-- Requete SQL spatiale exemple
-- Selection des parcelles dans un rayon de 500m

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

  let currentLanguage = $state('sql');
  let currentFilePath = $state<string | null>(null);
  let selectedCode = $state('');
  let isDirty = $state(false);

  // Panel states
  let leftCollapsed = $state(false);
  let rightCollapsed = $state(true);
  let bottomCollapsed = $state(false);

  // Output state
  let consoleOutput = $state<string[]>([]);
  let sqlResults = $state<{ columns: any[]; data: any[] } | null>(null);
  let jsonPreview = $state('');
  let problems = $state<Array<{ line: number; message: string; severity: 'error' | 'warning' | 'info' }>>([]);

  // Language options
  const languages = [
    { value: 'sql', label: 'SQL' },
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'shell', label: 'Shell' },
    { value: 'yaml', label: 'YAML' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'plaintext', label: 'Text' },
  ];

  // Detect language from file extension
  function detectLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      sql: 'sql',
      py: 'python',
      js: 'javascript',
      ts: 'typescript',
      json: 'json',
      geojson: 'json',
      xml: 'xml',
      html: 'html',
      htm: 'html',
      css: 'css',
      sh: 'shell',
      bash: 'shell',
      bat: 'shell',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      fmw: 'xml',
      qgs: 'xml',
    };
    return langMap[ext] || 'plaintext';
  }

  // Handle file selection from explorer
  function handleFileSelect(path: string, content: string) {
    currentFilePath = path;
    editorValue = content;
    currentLanguage = detectLanguageFromPath(path);
    isDirty = false;
    currentFile.set(path.split('/').pop() || path.split('\\').pop() || path);
  }

  // Handle editor changes
  function handleEditorChange(value: string) {
    editorValue = value;
    isDirty = true;
    editorContent.set(value);

    // Auto-detect JSON for preview
    if (currentLanguage === 'json') {
      jsonPreview = value;
    }
  }

  // Handle selection changes
  function handleSelectionChange(selection: string) {
    selectedCode = selection;
  }

  // Insert code from AI chat
  function handleInsertCode(code: string) {
    if (monacoRef) {
      monacoRef.insertText(code);
      monacoRef.focus();
    }
  }

  // Go to specific line (from problems panel)
  function handleGoToLine(line: number) {
    if (monacoRef) {
      const editor = monacoRef.getEditor();
      if (editor) {
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.focus();
      }
    }
  }

  // Toolbar actions
  function formatCode() {
    monacoRef?.format();
  }

  async function saveFile() {
    if (!currentFilePath) {
      consoleOutput = [...consoleOutput, '[INFO] Aucun fichier selectionne'];
      return;
    }

    try {
      const { writeFile } = await import('$lib/services/api');
      const result = await writeFile(currentFilePath, editorValue);
      if (result.success) {
        isDirty = false;
        consoleOutput = [...consoleOutput, `[OK] Fichier sauvegarde: ${currentFilePath}`];
      } else {
        consoleOutput = [...consoleOutput, `[ERREUR] Echec sauvegarde: ${result.error}`];
      }
    } catch (e) {
      consoleOutput = [...consoleOutput, `[ERREUR] ${e}`];
    }
  }

  async function runCode() {
    consoleOutput = [...consoleOutput, `[EXEC] Execution ${currentLanguage}...`];

    try {
      const { executeCommand } = await import('$lib/services/api');

      if (currentLanguage === 'sql') {
        // For SQL, we could connect to PostGIS
        consoleOutput = [...consoleOutput, '[INFO] Execution SQL (simulation)'];
        // Simulate SQL results
        sqlResults = {
          columns: [
            { key: 'egrid', label: 'EGRID', type: 'string' },
            { key: 'numero', label: 'Numero', type: 'string' },
            { key: 'surface', label: 'Surface', type: 'number' },
            { key: 'distance', label: 'Distance (m)', type: 'number' },
          ],
          data: [
            { egrid: 'CH123456789', numero: '1234', surface: 2500, distance: 45.2 },
            { egrid: 'CH987654321', numero: '5678', surface: 1800, distance: 123.5 },
            { egrid: 'CH456789123', numero: '9012', surface: 3200, distance: 234.8 },
          ]
        };
        consoleOutput = [...consoleOutput, `[OK] 3 resultats trouves`];
      } else if (currentLanguage === 'python') {
        // Execute Python script
        const result = await executeCommand(`python -c "${editorValue.replace(/"/g, '\\"').replace(/\n/g, ';')}"`);
        if (result.success) {
          consoleOutput = [...consoleOutput, result.output || '[OK] Script execute'];
        } else {
          consoleOutput = [...consoleOutput, `[ERREUR] ${result.error}`];
        }
      } else {
        consoleOutput = [...consoleOutput, `[INFO] Execution ${currentLanguage} non implementee`];
      }
    } catch (e) {
      consoleOutput = [...consoleOutput, `[ERREUR] ${e}`];
    }
  }

  function newFile() {
    currentFilePath = null;
    editorValue = '';
    currentLanguage = 'plaintext';
    isDirty = false;
    currentFile.set('nouveau-fichier');
  }

  // Toggle panels
  function toggleLeftPanel() {
    leftCollapsed = !leftCollapsed;
  }

  function toggleRightPanel() {
    rightCollapsed = !rightCollapsed;
  }

  function toggleBottomPanel() {
    bottomCollapsed = !bottomCollapsed;
  }
</script>

<div class="editor-module">
  <!-- Toolbar -->
  <div class="editor-toolbar">
    <div class="toolbar-left">
      <button class="toolbar-btn icon-btn" onclick={toggleLeftPanel} title="Fichiers">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      <div class="separator"></div>

      <select bind:value={currentLanguage} class="language-select">
        {#each languages as lang}
          <option value={lang.value}>{lang.label}</option>
        {/each}
      </select>

      {#if currentFilePath}
        <span class="current-file" class:dirty={isDirty}>
          {currentFilePath.split('/').pop() || currentFilePath.split('\\').pop()}
          {#if isDirty}<span class="dirty-dot">*</span>{/if}
        </span>
      {/if}
    </div>

    <div class="toolbar-center">
      <button class="toolbar-btn" onclick={newFile} title="Nouveau fichier">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        Nouveau
      </button>

      <button class="toolbar-btn" onclick={formatCode} title="Formater le code">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="21" y1="10" x2="3" y2="10"/>
          <line x1="21" y1="6" x2="3" y2="6"/>
          <line x1="21" y1="14" x2="3" y2="14"/>
          <line x1="21" y1="18" x2="3" y2="18"/>
        </svg>
        Formater
      </button>

      <button class="toolbar-btn" onclick={saveFile} title="Sauvegarder (Ctrl+S)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        Sauvegarder
      </button>

      <button class="toolbar-btn primary" onclick={runCode} title="Executer (F5)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Executer
      </button>
    </div>

    <div class="toolbar-right">
      <button class="toolbar-btn icon-btn" onclick={toggleBottomPanel} title="Console/Resultats">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 17 10 11 4 5"/>
          <line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
      </button>

      <button class="toolbar-btn icon-btn" class:active={!rightCollapsed} onclick={toggleRightPanel} title="Assistant IA">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v10"/>
          <path d="M12 12h10"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Main content area -->
  <div class="editor-content">
    <!-- Left Panel: File Explorer -->
    <CollapsiblePanel
      position="left"
      bind:collapsed={leftCollapsed}
      size={220}
      minSize={150}
      maxSize={400}
      storageKey="editor-left"
      title="Fichiers"
    >
      <FileExplorer onFileSelect={handleFileSelect} />
    </CollapsiblePanel>

    <!-- Center: Monaco Editor -->
    <div class="editor-center">
      <div class="monaco-wrapper">
        {#if MonacoEditor}
          <svelte:component
            this={MonacoEditor}
            bind:this={monacoRef}
            bind:value={editorValue}
            bind:language={currentLanguage}
            onchange={handleEditorChange}
            onselectionchange={handleSelectionChange}
          />
        {:else}
          <div class="editor-loading">
            <div class="loading-spinner"></div>
            <span>Chargement de l'editeur...</span>
          </div>
        {/if}
      </div>

      <!-- Bottom Panel: Output -->
      <CollapsiblePanel
        position="bottom"
        bind:collapsed={bottomCollapsed}
        size={200}
        minSize={100}
        maxSize={500}
        storageKey="editor-bottom"
        title="Output"
      >
        <OutputPanel
          {consoleOutput}
          {sqlResults}
          {jsonPreview}
          {problems}
          onGoToLine={handleGoToLine}
        />
      </CollapsiblePanel>
    </div>

    <!-- Right Panel: AI Chat -->
    <CollapsiblePanel
      position="right"
      bind:collapsed={rightCollapsed}
      size={350}
      minSize={250}
      maxSize={600}
      storageKey="editor-right"
      title="Assistant IA"
    >
      <EditorChat
        currentFile={currentFilePath}
        currentLanguage={currentLanguage}
        selectedCode={selectedCode}
        onInsertCode={handleInsertCode}
      />
    </CollapsiblePanel>
  </div>
</div>

<style>
  .editor-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--noir-profond);
    overflow: hidden;
  }

  /* Toolbar */
  .editor-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: var(--noir-card);
    border-bottom: 1px solid var(--border-color);
    gap: 12px;
    flex-shrink: 0;
  }

  .toolbar-left,
  .toolbar-center,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar-center {
    flex: 1;
    justify-content: center;
  }

  .separator {
    width: 1px;
    height: 20px;
    background: var(--border-color);
  }

  .language-select {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 11px;
    font-family: var(--font-mono);
    background: var(--noir-surface);
    color: var(--text-primary);
    cursor: pointer;
    outline: none;
  }

  .language-select:focus {
    border-color: var(--cyber-green);
  }

  .current-file {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    padding: 4px 8px;
    background: var(--noir-surface);
    border-radius: 4px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .current-file.dirty {
    color: var(--warning);
  }

  .dirty-dot {
    color: var(--warning);
    margin-left: 2px;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    background: var(--noir-surface);
    color: var(--text-secondary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-family: var(--font-mono);
    transition: all 0.15s;
    white-space: nowrap;
  }

  .toolbar-btn:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .toolbar-btn.icon-btn {
    padding: 6px;
  }

  .toolbar-btn.icon-btn.active {
    background: rgba(0, 255, 136, 0.1);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .toolbar-btn.primary {
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-color: var(--cyber-green);
    font-weight: 600;
  }

  .toolbar-btn.primary:hover {
    background: var(--cyber-green-light);
    box-shadow: 0 0 12px var(--cyber-green-glow);
  }

  /* Editor content */
  .editor-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .editor-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .monaco-wrapper {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  /* Loading state */
  .editor-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--cyber-green);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Keyboard shortcuts hint */
  @media (min-width: 1200px) {
    .toolbar-btn:not(.icon-btn)::after {
      content: attr(title);
      display: none;
    }
  }
</style>
