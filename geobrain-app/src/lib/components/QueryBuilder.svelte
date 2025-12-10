<script lang="ts">
  import { executeQuery, listConnections } from '$lib/services/api';

  // Props
  interface Props {
    initialQuery?: string;
    connectionId?: string;
  }

  let { initialQuery = '', connectionId }: Props = $props();

  // State
  let query = $state(initialQuery);
  let connections = $state<Array<{ id: string; name: string; type: string }>>([]);
  let selectedConnection = $state(connectionId || '');
  let results = $state<{
    rows: Array<Record<string, unknown>>;
    columns: string[];
    rowCount: number;
    executionTime: number;
  } | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let page = $state(0);
  let pageSize = $state(50);
  let queryHistory = $state<string[]>([]);

  // Load connections
  $effect(() => {
    loadConnections();
  });

  async function loadConnections() {
    try {
      const result = await listConnections();
      if (result.success) {
        connections = result.connections.filter((c: { type: string }) => c.type === 'postgresql');
        if (connections.length > 0 && !selectedConnection) {
          selectedConnection = connections[0].id;
        }
      }
    } catch (e) {
      console.error('Failed to load connections:', e);
    }
  }

  // Execute query
  async function runQuery() {
    if (!query.trim() || !selectedConnection) return;

    loading = true;
    error = null;
    results = null;

    const startTime = Date.now();

    try {
      const result = await executeQuery(selectedConnection, query);
      const executionTime = Date.now() - startTime;

      if (result.success) {
        const rows = result.rows || [];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        results = {
          rows,
          columns,
          rowCount: rows.length,
          executionTime
        };

        // Add to history
        if (!queryHistory.includes(query)) {
          queryHistory = [query, ...queryHistory.slice(0, 19)];
        }
      } else {
        error = result.error || 'Erreur lors de l\'exécution';
      }
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  // Format value for display
  function formatValue(value: unknown): string {
    if (value === null) return 'NULL';
    if (value === undefined) return '';
    if (typeof value === 'object') {
      // Check if it's a geometry
      if ('type' in (value as object) && 'coordinates' in (value as object)) {
        return `[GeoJSON: ${(value as { type: string }).type}]`;
      }
      return JSON.stringify(value);
    }
    return String(value);
  }

  // Paginated rows
  let paginatedRows = $derived(() => {
    if (!results) return [];
    const start = page * pageSize;
    return results.rows.slice(start, start + pageSize);
  });

  let totalPages = $derived(() => {
    if (!results) return 0;
    return Math.ceil(results.rowCount / pageSize);
  });

  // Keyboard shortcut
  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  }

  // Insert query from history
  function insertFromHistory(q: string) {
    query = q;
  }

  // Export results
  function exportResults(format: 'csv' | 'json') {
    if (!results) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'csv') {
      const header = results.columns.join(',');
      const rows = results.rows.map(row =>
        results!.columns.map(col => {
          const val = row[col];
          if (val === null) return '';
          if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
          return String(val);
        }).join(',')
      );
      content = [header, ...rows].join('\n');
      filename = 'query_results.csv';
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(results.rows, null, 2);
      filename = 'query_results.json';
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="query-builder">
  <!-- Toolbar -->
  <div class="toolbar">
    <select class="connection-select" bind:value={selectedConnection}>
      {#each connections as conn}
        <option value={conn.id}>{conn.name}</option>
      {/each}
    </select>

    <button
      class="run-btn"
      onclick={runQuery}
      disabled={loading || !query.trim()}
    >
      {loading ? '...' : '▶ Exécuter'}
    </button>

    <span class="shortcut-hint">Ctrl+Enter</span>

    {#if results}
      <div class="result-info">
        <span>{results.rowCount} lignes</span>
        <span>({results.executionTime}ms)</span>
      </div>

      <div class="export-btns">
        <button onclick={() => exportResults('csv')}>CSV</button>
        <button onclick={() => exportResults('json')}>JSON</button>
      </div>
    {/if}
  </div>

  <!-- Query editor -->
  <div class="query-editor">
    <textarea
      bind:value={query}
      placeholder="SELECT * FROM schema.table WHERE condition..."
      onkeydown={handleKeydown}
      spellcheck="false"
    ></textarea>
  </div>

  <!-- Results -->
  <div class="results-panel">
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Exécution en cours...</span>
      </div>
    {:else if error}
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <pre>{error}</pre>
      </div>
    {:else if results}
      {#if results.rowCount === 0}
        <div class="empty-state">
          <span>Aucun résultat</span>
        </div>
      {:else}
        <div class="results-table-wrapper">
          <table class="results-table">
            <thead>
              <tr>
                <th class="row-num">#</th>
                {#each results.columns as col}
                  <th>{col}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each paginatedRows() as row, i}
                <tr>
                  <td class="row-num">{page * pageSize + i + 1}</td>
                  {#each results.columns as col}
                    <td class:null-value={row[col] === null}>
                      {formatValue(row[col])}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        {#if totalPages() > 1}
          <div class="pagination">
            <button
              disabled={page === 0}
              onclick={() => page = 0}
            >
              ⏮
            </button>
            <button
              disabled={page === 0}
              onclick={() => page--}
            >
              ◀
            </button>
            <span>Page {page + 1} / {totalPages()}</span>
            <button
              disabled={page >= totalPages() - 1}
              onclick={() => page++}
            >
              ▶
            </button>
            <button
              disabled={page >= totalPages() - 1}
              onclick={() => page = totalPages() - 1}
            >
              ⏭
            </button>

            <select bind:value={pageSize} onchange={() => page = 0}>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={500}>500 / page</option>
            </select>
          </div>
        {/if}
      {/if}
    {:else}
      <div class="empty-state">
        <p>Écrivez une requête SQL et cliquez sur Exécuter</p>
        {#if queryHistory.length > 0}
          <div class="history-section">
            <h4>Historique</h4>
            {#each queryHistory.slice(0, 5) as q}
              <button
                class="history-item"
                onclick={() => insertFromHistory(q)}
              >
                {q.length > 80 ? q.slice(0, 80) + '...' : q}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .query-builder {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .connection-select {
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 12px;
  }

  .run-btn {
    padding: 6px 16px;
    border: none;
    border-radius: 4px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .run-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .run-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shortcut-hint {
    font-size: 10px;
    color: var(--text-secondary);
    padding: 2px 6px;
    background: var(--bg-primary);
    border-radius: 3px;
  }

  .result-info {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-secondary);
    display: flex;
    gap: 8px;
  }

  .export-btns {
    display: flex;
    gap: 4px;
  }

  .export-btns button {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    font-size: 10px;
    cursor: pointer;
  }

  .export-btns button:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .query-editor {
    height: 150px;
    border-bottom: 1px solid var(--border-color);
  }

  .query-editor textarea {
    width: 100%;
    height: 100%;
    padding: 12px;
    border: none;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.5;
    resize: none;
  }

  .query-editor textarea:focus {
    outline: none;
  }

  .results-panel {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    color: var(--text-secondary);
    height: 100%;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 8px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-state {
    color: #ff6b6b;
  }

  .error-state pre {
    margin-top: 8px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 4px;
    font-size: 12px;
    max-width: 100%;
    overflow-x: auto;
  }

  .results-table-wrapper {
    flex: 1;
    overflow: auto;
  }

  .results-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .results-table th,
  .results-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
    white-space: nowrap;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .results-table th {
    background: var(--bg-secondary);
    font-weight: 600;
    color: var(--accent-primary);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .results-table tr:hover td {
    background: var(--bg-hover);
  }

  .row-num {
    color: var(--text-secondary);
    font-size: 10px;
    width: 40px;
    text-align: center;
  }

  .null-value {
    color: var(--text-secondary);
    font-style: italic;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .pagination button {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
  }

  .pagination button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .pagination button:hover:not(:disabled) {
    border-color: var(--accent-primary);
  }

  .pagination select {
    padding: 4px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 11px;
  }

  .history-section {
    margin-top: 16px;
    width: 100%;
    max-width: 500px;
  }

  .history-section h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .history-item {
    display: block;
    width: 100%;
    padding: 8px;
    margin-bottom: 4px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: monospace;
    font-size: 11px;
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .history-item:hover {
    border-color: var(--accent-primary);
  }
</style>
