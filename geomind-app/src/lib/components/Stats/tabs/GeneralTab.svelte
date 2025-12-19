<script lang="ts">
  import { generalData, isLoading, statsError } from '$lib/stores/statsStore';
  import StatsChart from '../widgets/StatsChart.svelte';

  export let connectionId: string;

  let selectedSchema = '';
  let selectedTable = '';
  let schemas: string[] = [];
  let tables: string[] = [];
  let columns: { name: string; type: string }[] = [];
  let selectedColumns: string[] = [];
  let groupByColumn = '';
  let aggregation: 'COUNT' | 'SUM' | 'AVG' = 'COUNT';
  let aggregationColumn = '';

  $: if (connectionId) {
    loadSchemas();
  }

  async function loadSchemas() {
    try {
      const response = await fetch(`http://localhost:3001/api/databases/${connectionId}/schemas`);
      if (response.ok) {
        const data = await response.json();
        schemas = data.schemas || [];
      }
    } catch (error) {
      console.error('Erreur chargement schemas:', error);
    }
  }

  async function loadTables() {
    if (!selectedSchema) return;
    try {
      const response = await fetch(`http://localhost:3001/api/databases/${connectionId}/schema/${selectedSchema}/tables`);
      if (response.ok) {
        const data = await response.json();
        tables = data.tables || [];
      }
    } catch (error) {
      console.error('Erreur chargement tables:', error);
    }
  }

  async function loadColumns() {
    if (!selectedSchema || !selectedTable) return;
    try {
      const response = await fetch(`http://localhost:3001/api/databases/${connectionId}/schema/${selectedSchema}/table/${selectedTable}/columns`);
      if (response.ok) {
        const data = await response.json();
        columns = data.columns || [];
      }
    } catch (error) {
      console.error('Erreur chargement colonnes:', error);
    }
  }

  async function executeQuery() {
    if (!selectedSchema || !selectedTable || !groupByColumn) {
      alert('Veuillez sélectionner un schéma, une table et une colonne de groupement');
      return;
    }

    $isLoading = true;
    $statsError = null;

    try {
      const response = await fetch(`http://localhost:3001/api/stats/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          schema: selectedSchema,
          table: selectedTable,
          groupBy: groupByColumn,
          aggregation,
          aggregationColumn: aggregationColumn || null
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      $generalData = data;
    } catch (error) {
      $statsError = error instanceof Error ? error.message : 'Erreur';
    } finally {
      $isLoading = false;
    }
  }
</script>

<div class="general-tab">
  <div class="tab-header">
    <h2>Statistiques personnalisées</h2>
  </div>

  <div class="query-builder">
    <div class="builder-row">
      <div class="field">
        <label for="schema">Schéma</label>
        <select id="schema" bind:value={selectedSchema} onchange={loadTables}>
          <option value="">-- Sélectionner --</option>
          {#each schemas as schema}
            <option value={schema}>{schema}</option>
          {/each}
        </select>
      </div>

      <div class="field">
        <label for="table">Table</label>
        <select id="table" bind:value={selectedTable} onchange={loadColumns} disabled={!selectedSchema}>
          <option value="">-- Sélectionner --</option>
          {#each tables as table}
            <option value={table}>{table}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="builder-row">
      <div class="field">
        <label for="groupby">Grouper par</label>
        <select id="groupby" bind:value={groupByColumn} disabled={columns.length === 0}>
          <option value="">-- Sélectionner --</option>
          {#each columns as col}
            <option value={col.name}>{col.name} ({col.type})</option>
          {/each}
        </select>
      </div>

      <div class="field">
        <label for="agg">Agrégation</label>
        <select id="agg" bind:value={aggregation}>
          <option value="COUNT">COUNT</option>
          <option value="SUM">SUM</option>
          <option value="AVG">AVG</option>
        </select>
      </div>

      <div class="field">
        <label for="aggcol">Colonne (pour SUM/AVG)</label>
        <select id="aggcol" bind:value={aggregationColumn} disabled={aggregation === 'COUNT' || columns.length === 0}>
          <option value="">-- Optionnel --</option>
          {#each columns.filter(c => ['integer', 'numeric', 'real', 'double precision', 'bigint'].includes(c.type.toLowerCase())) as col}
            <option value={col.name}>{col.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <button class="execute-btn" onclick={executeQuery} disabled={$isLoading}>
      {$isLoading ? 'Exécution...' : 'Exécuter'}
    </button>
  </div>

  {#if $generalData}
    <div class="results">
      {#if $generalData.chartData}
        <div class="chart-card">
          <StatsChart type="bar" data={$generalData.chartData} />
        </div>
      {/if}

      {#if $generalData.results && $generalData.results.length > 0}
        <div class="table-card">
          <table>
            <thead>
              <tr>
                {#each $generalData.columns as col}
                  <th>{col}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each $generalData.results as row}
                <tr>
                  {#each $generalData.columns as col}
                    <td>{row[col]}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .general-tab {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .tab-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .query-builder {
    background: var(--noir-card, #1a2332);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid var(--border-color, #2d3748);
  }

  .builder-row {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
  }

  .field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field label {
    font-size: 0.85rem;
    color: var(--text-secondary, #a0aac0);
  }

  .field select {
    padding: 10px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-color, #2d3748);
    background: var(--noir-surface, #151b26);
    color: var(--text-primary, #e0e6ff);
    font-size: 0.9rem;
  }

  .field select:disabled {
    opacity: 0.5;
  }

  .execute-btn {
    padding: 12px 24px;
    border-radius: 8px;
    border: none;
    background: var(--cyber-green, #00ff88);
    color: #000;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .execute-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
  }

  .execute-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .chart-card,
  .table-card {
    background: var(--noir-card, #1a2332);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid var(--border-color, #2d3748);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-color, #2d3748);
  }

  th {
    font-weight: 600;
    color: var(--text-secondary, #a0aac0);
    font-size: 0.85rem;
  }

  td {
    font-size: 0.9rem;
  }
</style>
