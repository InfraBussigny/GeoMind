<script lang="ts">
  import DataTable from './DataTable.svelte';
  import JsonNode from './JsonNode.svelte';

  interface Props {
    consoleOutput?: string[];
    sqlResults?: { columns: any[]; data: any[] } | null;
    jsonPreview?: string;
    problems?: Array<{ line: number; message: string; severity: 'error' | 'warning' | 'info' }>;
    onGoToLine?: (line: number) => void;
  }

  let {
    consoleOutput = [],
    sqlResults = null,
    jsonPreview = '',
    problems = [],
    onGoToLine
  }: Props = $props();

  type TabId = 'console' | 'results' | 'preview' | 'problems';
  let activeTab = $state<TabId>('console');

  // Parse JSON for tree view
  let parsedJson = $derived(() => {
    if (!jsonPreview) return null;
    try {
      return JSON.parse(jsonPreview);
    } catch {
      return null;
    }
  });

  // Check if GeoJSON
  let isGeoJson = $derived(() => {
    const json = parsedJson();
    return json && (json.type === 'FeatureCollection' || json.type === 'Feature' || json.type === 'GeometryCollection');
  });

  function getSeverityIcon(severity: string) {
    switch (severity) {
      case 'error': return '✕';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'error': return 'var(--error)';
      case 'warning': return 'var(--warning)';
      default: return 'var(--accent-cyan)';
    }
  }

  function formatJsonValue(value: any, depth: number = 0): string {
    if (value === null) return '<span class="json-null">null</span>';
    if (typeof value === 'boolean') return `<span class="json-boolean">${value}</span>`;
    if (typeof value === 'number') return `<span class="json-number">${value}</span>`;
    if (typeof value === 'string') return `<span class="json-string">"${escapeHtml(value)}"</span>`;
    return '';
  }

  function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Console color parsing (basic ANSI)
  function parseAnsiColors(text: string): string {
    return text
      .replace(/\x1b\[31m/g, '<span class="ansi-red">')
      .replace(/\x1b\[32m/g, '<span class="ansi-green">')
      .replace(/\x1b\[33m/g, '<span class="ansi-yellow">')
      .replace(/\x1b\[34m/g, '<span class="ansi-blue">')
      .replace(/\x1b\[35m/g, '<span class="ansi-magenta">')
      .replace(/\x1b\[36m/g, '<span class="ansi-cyan">')
      .replace(/\x1b\[0m/g, '</span>')
      .replace(/\x1b\[\d+m/g, '');
  }

  function clearConsole() {
    consoleOutput = [];
  }
</script>

<div class="output-panel">
  <!-- Tabs -->
  <div class="output-tabs">
    <button
      class="output-tab"
      class:active={activeTab === 'console'}
      onclick={() => activeTab = 'console'}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="4 17 10 11 4 5"/>
        <line x1="12" y1="19" x2="20" y2="19"/>
      </svg>
      Console
      {#if consoleOutput.length > 0}
        <span class="badge">{consoleOutput.length}</span>
      {/if}
    </button>

    <button
      class="output-tab"
      class:active={activeTab === 'results'}
      onclick={() => activeTab = 'results'}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
      Resultats
      {#if sqlResults?.data?.length}
        <span class="badge">{sqlResults.data.length}</span>
      {/if}
    </button>

    <button
      class="output-tab"
      class:active={activeTab === 'preview'}
      onclick={() => activeTab = 'preview'}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/>
        <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>
      </svg>
      Preview
      {#if isGeoJson()}
        <span class="badge geo">GeoJSON</span>
      {/if}
    </button>

    <button
      class="output-tab"
      class:active={activeTab === 'problems'}
      onclick={() => activeTab = 'problems'}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Problemes
      {#if problems.length > 0}
        <span class="badge" class:error={problems.some(p => p.severity === 'error')}>
          {problems.length}
        </span>
      {/if}
    </button>

    <div class="tab-spacer"></div>

    {#if activeTab === 'console'}
      <button class="action-btn" onclick={clearConsole} title="Effacer la console">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    {/if}
  </div>

  <!-- Tab content -->
  <div class="output-content">
    {#if activeTab === 'console'}
      <div class="console-output">
        {#if consoleOutput.length === 0}
          <div class="empty-state">
            <span class="prompt">$</span> En attente de sortie...
          </div>
        {:else}
          {#each consoleOutput as line, i}
            <div class="console-line">
              <span class="line-number">{i + 1}</span>
              <span class="line-content">{@html parseAnsiColors(line)}</span>
            </div>
          {/each}
        {/if}
      </div>

    {:else if activeTab === 'results'}
      <div class="results-container">
        {#if sqlResults && sqlResults.columns.length > 0}
          <DataTable columns={sqlResults.columns} data={sqlResults.data} />
        {:else}
          <div class="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
            <p>Executez une requete SQL pour voir les resultats</p>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'preview'}
      <div class="preview-container">
        {#if parsedJson()}
          {#if isGeoJson()}
            <div class="geojson-info">
              <div class="geojson-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cyber-green)" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>
                </svg>
                <span>GeoJSON detecte</span>
              </div>
              {#if parsedJson().type === 'FeatureCollection'}
                <div class="geojson-stat">
                  <span class="stat-label">Features:</span>
                  <span class="stat-value">{parsedJson().features?.length || 0}</span>
                </div>
              {/if}
              <p class="geojson-hint">Visualisation cartographique disponible dans l'onglet Canvas</p>
            </div>
          {/if}
          <div class="json-tree">
            <JsonNode value={parsedJson()} nodeKey="root" expanded={true} />
          </div>
        {:else if jsonPreview}
          <div class="preview-error">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <p>JSON invalide</p>
          </div>
        {:else}
          <div class="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/>
              <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>
            </svg>
            <p>Aucun JSON a previsualiser</p>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'problems'}
      <div class="problems-list">
        {#if problems.length === 0}
          <div class="empty-state success">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyber-green)" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p>Aucun probleme detecte</p>
          </div>
        {:else}
          {#each problems as problem}
            <button
              class="problem-item"
              onclick={() => onGoToLine?.(problem.line)}
            >
              <span class="problem-icon" style="color: {getSeverityColor(problem.severity)}">
                {getSeverityIcon(problem.severity)}
              </span>
              <span class="problem-line">Ligne {problem.line}</span>
              <span class="problem-message">{problem.message}</span>
            </button>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .output-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--noir-surface);
  }

  .output-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    background: var(--noir-card);
    border-bottom: 1px solid var(--border-color);
    overflow-x: auto;
  }

  .output-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .output-tab:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .output-tab.active {
    background: rgba(0, 255, 136, 0.1);
    color: var(--cyber-green);
  }

  .badge {
    padding: 1px 6px;
    background: var(--border-color);
    border-radius: 10px;
    font-size: 10px;
    color: var(--text-secondary);
  }

  .badge.error {
    background: var(--error);
    color: white;
  }

  .badge.geo {
    background: var(--cyber-green);
    color: var(--noir-profond);
  }

  .tab-spacer {
    flex: 1;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .action-btn:hover {
    background: var(--bg-hover);
    color: var(--error);
  }

  .output-content {
    flex: 1;
    overflow: auto;
  }

  /* Console */
  .console-output {
    padding: 8px;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .console-line {
    display: flex;
    gap: 12px;
    padding: 2px 0;
    line-height: 1.5;
  }

  .console-line:hover {
    background: var(--bg-hover);
  }

  .line-number {
    color: var(--text-muted);
    min-width: 30px;
    text-align: right;
    user-select: none;
  }

  .line-content {
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* ANSI colors */
  :global(.ansi-red) { color: var(--error); }
  :global(.ansi-green) { color: var(--cyber-green); }
  :global(.ansi-yellow) { color: var(--warning); }
  :global(.ansi-blue) { color: var(--accent-cyan); }
  :global(.ansi-magenta) { color: var(--accent-pink); }
  :global(.ansi-cyan) { color: var(--accent-cyan); }

  .prompt {
    color: var(--cyber-green);
    margin-right: 8px;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px;
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
  }

  .empty-state svg {
    opacity: 0.5;
  }

  .empty-state.success svg {
    opacity: 1;
  }

  /* Results */
  .results-container {
    height: 100%;
  }

  /* Preview */
  .preview-container {
    padding: 8px;
    overflow: auto;
    height: 100%;
  }

  .geojson-info {
    padding: 12px;
    background: rgba(0, 255, 136, 0.05);
    border: 1px solid rgba(0, 255, 136, 0.2);
    border-radius: 6px;
    margin-bottom: 12px;
  }

  .geojson-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--cyber-green);
    margin-bottom: 8px;
  }

  .geojson-stat {
    display: flex;
    gap: 8px;
    font-size: 12px;
    margin-bottom: 4px;
  }

  .stat-label {
    color: var(--text-muted);
  }

  .stat-value {
    color: var(--accent-purple);
    font-weight: 600;
  }

  .geojson-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 8px;
    font-style: italic;
  }

  .preview-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px;
    color: var(--error);
  }

  /* JSON Tree */
  .json-tree {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
  }

  /* Problems */
  .problems-list {
    padding: 4px;
  }

  .problem-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 12px;
    border-radius: 4px;
    transition: background 0.15s;
  }

  .problem-item:hover {
    background: var(--bg-hover);
  }

  .problem-icon {
    font-size: 14px;
    width: 16px;
    text-align: center;
  }

  .problem-line {
    color: var(--text-muted);
    white-space: nowrap;
  }

  .problem-message {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
