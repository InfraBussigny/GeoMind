<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    connectionId: string;
  }
  let { connectionId }: Props = $props();

  // State
  let naturalQuery = $state('');
  let generatedSql = $state('');
  let explanation = $state('');
  let queryResult = $state<any[] | null>(null);
  let loading = $state(false);
  let executing = $state(false);
  let error = $state<string | null>(null);
  let history = $state<{ query: string; sql: string; timestamp: Date }[]>([]);

  // Generate SQL from natural language
  async function generateSql() {
    if (!naturalQuery.trim()) return;

    loading = true;
    error = null;
    generatedSql = '';
    explanation = '';

    try {
      const res = await fetch('http://localhost:3001/api/databases/text-to-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          query: naturalQuery
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      generatedSql = data.sql || '';
      explanation = data.explanation || '';

      // Add to history
      history = [
        { query: naturalQuery, sql: generatedSql, timestamp: new Date() },
        ...history.slice(0, 19) // Keep last 20
      ];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur inconnue';
    } finally {
      loading = false;
    }
  }

  // Execute the generated SQL
  async function executeSql() {
    if (!generatedSql.trim()) return;

    executing = true;
    error = null;
    queryResult = null;

    try {
      const res = await fetch(`http://localhost:3001/api/connections/${connectionId}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: generatedSql })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      queryResult = data.rows || data;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur execution';
    } finally {
      executing = false;
    }
  }

  // Copy SQL to clipboard
  function copySql() {
    navigator.clipboard.writeText(generatedSql);
  }

  // Handle keyboard shortcut
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      generateSql();
    }
  }
</script>

<div class="sql-assistant">
  <!-- Input Section -->
  <div class="input-section">
    <div class="input-header">
      <h3>Question en langage naturel</h3>
      <span class="hint">Ctrl+Enter pour generer</span>
    </div>
    <div class="input-box">
      <textarea
        bind:value={naturalQuery}
        placeholder="Ex: Montre-moi toutes les parcelles dont la surface est superieure a 1000m2 dans le secteur centre..."
        onkeydown={handleKeydown}
        rows="3"
      ></textarea>
      <button class="generate-btn" onclick={generateSql} disabled={loading || !naturalQuery.trim()}>
        {#if loading}
          <span class="spinner"></span>
          Generation...
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          Generer SQL
        {/if}
      </button>
    </div>
  </div>

  <!-- Generated SQL Section -->
  {#if generatedSql}
    <div class="sql-section">
      <div class="sql-header">
        <h3>SQL Genere</h3>
        <div class="sql-actions">
          <button onclick={copySql} title="Copier">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
          <button onclick={executeSql} disabled={executing} class="execute-btn">
            {#if executing}
              <span class="spinner small"></span>
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            {/if}
            Executer
          </button>
        </div>
      </div>
      <pre class="sql-code"><code>{generatedSql}</code></pre>

      {#if explanation}
        <div class="explanation">
          <h4>Explication</h4>
          <p>{explanation}</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Error Display -->
  {#if error}
    <div class="error-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <span>{error}</span>
    </div>
  {/if}

  <!-- Results Section -->
  {#if queryResult}
    <div class="results-section">
      <div class="results-header">
        <h3>Resultats ({queryResult.length} lignes)</h3>
      </div>
      <div class="results-table-wrapper">
        <table class="results-table">
          <thead>
            <tr>
              {#each Object.keys(queryResult[0] || {}) as col}
                <th>{col}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each queryResult.slice(0, 100) as row}
              <tr>
                {#each Object.values(row) as val}
                  <td>{val !== null ? val : '<null>'}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
        {#if queryResult.length > 100}
          <p class="truncated-notice">... {queryResult.length - 100} lignes supplementaires non affichees</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- History Section -->
  {#if history.length > 0}
    <div class="history-section">
      <h3>Historique</h3>
      <div class="history-list">
        {#each history as item}
          <div class="history-item" onclick={() => { naturalQuery = item.query; generatedSql = item.sql; }}>
            <span class="history-query">{item.query.slice(0, 60)}...</span>
            <span class="history-time">{item.timestamp.toLocaleTimeString()}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .sql-assistant {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
    overflow: auto;
  }

  .input-section,
  .sql-section,
  .results-section,
  .history-section {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
  }

  .input-header,
  .sql-header,
  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-bright);
  }

  .hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .input-box {
    display: flex;
    gap: 12px;
  }

  .input-box textarea {
    flex: 1;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-surface);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.95rem;
    resize: vertical;
    line-height: 1.5;
  }

  .input-box textarea:focus {
    outline: none;
    border-color: var(--cyber-green);
    box-shadow: 0 0 0 2px var(--cyber-green-glow);
  }

  .generate-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: 6px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .generate-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .generate-btn svg {
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

  .sql-actions {
    display: flex;
    gap: 8px;
  }

  .sql-actions button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-surface);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  .sql-actions button:hover {
    background: var(--bg-hover);
    color: var(--text-bright);
    border-color: var(--text-muted);
  }

  .sql-actions button svg {
    width: 16px;
    height: 16px;
  }

  .execute-btn {
    background: var(--primary) !important;
    color: white !important;
    border-color: var(--primary) !important;
  }

  .execute-btn:hover {
    filter: brightness(1.1);
  }

  .sql-code {
    margin: 0;
    padding: 16px;
    background: var(--noir-profond);
    border-radius: 6px;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--cyber-green);
  }

  .explanation {
    margin-top: 12px;
    padding: 12px;
    background: rgba(0, 255, 136, 0.05);
    border-left: 3px solid var(--cyber-green);
    border-radius: 0 6px 6px 0;
  }

  .explanation h4 {
    margin: 0 0 8px;
    font-size: 0.85rem;
    color: var(--cyber-green);
  }

  .explanation p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .error-box {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid var(--danger);
    border-radius: 6px;
    color: var(--danger);
  }

  .error-box svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .results-table-wrapper {
    max-height: 400px;
    overflow: auto;
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .results-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    font-family: var(--font-mono);
  }

  .results-table th {
    position: sticky;
    top: 0;
    background: var(--noir-surface);
    padding: 10px 12px;
    text-align: left;
    border-bottom: 2px solid var(--border-color);
    color: var(--text-bright);
    font-weight: 600;
  }

  .results-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  .results-table tr:hover td {
    background: var(--bg-hover);
  }

  .truncated-notice {
    text-align: center;
    padding: 12px;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .history-section h3 {
    margin-bottom: 12px;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow: auto;
  }

  .history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--noir-surface);
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .history-item:hover {
    background: var(--bg-hover);
  }

  .history-query {
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .history-time {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }
</style>
