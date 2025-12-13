<script lang="ts">
  import { onMount } from 'svelte';
  import { getConnections, executeSQL } from '$lib/services/api';

  // Props
  interface Props {
    onSelectTable?: (schema: string, table: string) => void;
    onInsertQuery?: (query: string) => void;
  }

  let { onSelectTable, onInsertQuery }: Props = $props();

  // State
  let connections = $state<Array<{ id: string; name: string; type: string }>>([]);
  let selectedConnection = $state<string | null>(null);
  let schemas = $state<Array<{ name: string; tables: TableInfo[] }>>([]);
  let expandedSchemas = $state<Set<string>>(new Set());
  let expandedTables = $state<Set<string>>(new Set());
  let loading = $state(false);
  let error = $state<string | null>(null);
  let searchQuery = $state('');

  interface TableInfo {
    name: string;
    type: 'table' | 'view';
    rowCount?: number;
    columns?: ColumnInfo[];
  }

  interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    isGeometry: boolean;
  }

  // Load connections on mount
  onMount(async () => {
    try {
      const result = await getConnections();
      connections = result.filter((c: { type: string }) => c.type === 'postgresql');
    } catch (e) {
      console.error('Failed to load connections:', e);
    }
  });

  // Load schemas when connection selected
  async function loadSchemas() {
    if (!selectedConnection) return;

    loading = true;
    error = null;

    try {
      const result = await executeSQL(selectedConnection, `
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
      `);

      if (result.success && result.rows) {
        schemas = result.rows.map((row: { schema_name: string }) => ({
          name: row.schema_name,
          tables: []
        }));
      } else {
        error = result.error || 'Erreur lors du chargement des schémas';
      }
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  // Load tables for a schema
  async function loadTables(schemaName: string) {
    if (!selectedConnection) return;

    const schema = schemas.find(s => s.name === schemaName);
    if (!schema || schema.tables.length > 0) return; // Already loaded

    try {
      const result = await executeSQL(selectedConnection, `
        SELECT
          t.table_name,
          t.table_type,
          (SELECT reltuples::bigint FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = t.table_schema AND c.relname = t.table_name) as row_estimate
        FROM information_schema.tables t
        WHERE t.table_schema = '${schemaName}'
        ORDER BY t.table_name
      `);

      if (result.success && result.rows) {
        schema.tables = result.rows.map((row: { table_name: string; table_type: string; row_estimate: number }) => ({
          name: row.table_name,
          type: row.table_type === 'VIEW' ? 'view' : 'table',
          rowCount: row.row_estimate
        }));
        schemas = [...schemas]; // Trigger reactivity
      }
    } catch (e) {
      console.error('Failed to load tables:', e);
    }
  }

  // Load columns for a table
  async function loadColumns(schemaName: string, tableName: string) {
    if (!selectedConnection) return;

    const schema = schemas.find(s => s.name === schemaName);
    const table = schema?.tables.find(t => t.name === tableName);
    if (!table || table.columns) return; // Already loaded

    try {
      const result = await executeSQL(selectedConnection, `
        SELECT
          c.column_name,
          c.data_type,
          c.udt_name,
          c.is_nullable,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_fk
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = '${schemaName}' AND tc.table_name = '${tableName}' AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON pk.column_name = c.column_name
        LEFT JOIN (
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = '${schemaName}' AND tc.table_name = '${tableName}' AND tc.constraint_type = 'FOREIGN KEY'
        ) fk ON fk.column_name = c.column_name
        WHERE c.table_schema = '${schemaName}' AND c.table_name = '${tableName}'
        ORDER BY c.ordinal_position
      `);

      if (result.success && result.rows) {
        table.columns = result.rows.map((row: {
          column_name: string;
          data_type: string;
          udt_name: string;
          is_nullable: string;
          is_pk: boolean;
          is_fk: boolean;
        }) => ({
          name: row.column_name,
          type: row.data_type === 'USER-DEFINED' ? row.udt_name : row.data_type,
          nullable: row.is_nullable === 'YES',
          isPrimaryKey: row.is_pk,
          isForeignKey: row.is_fk,
          isGeometry: row.udt_name === 'geometry' || row.udt_name === 'geography'
        }));
        schemas = [...schemas]; // Trigger reactivity
      }
    } catch (e) {
      console.error('Failed to load columns:', e);
    }
  }

  // Toggle schema expansion
  function toggleSchema(schemaName: string) {
    if (expandedSchemas.has(schemaName)) {
      expandedSchemas.delete(schemaName);
    } else {
      expandedSchemas.add(schemaName);
      loadTables(schemaName);
    }
    expandedSchemas = new Set(expandedSchemas);
  }

  // Toggle table expansion
  function toggleTable(schemaName: string, tableName: string) {
    const key = `${schemaName}.${tableName}`;
    if (expandedTables.has(key)) {
      expandedTables.delete(key);
    } else {
      expandedTables.add(key);
      loadColumns(schemaName, tableName);
    }
    expandedTables = new Set(expandedTables);
  }

  // Handle table click
  function handleTableClick(schemaName: string, tableName: string) {
    if (onSelectTable) {
      onSelectTable(schemaName, tableName);
    }
  }

  // Generate SELECT query
  function generateSelect(schemaName: string, table: TableInfo) {
    const cols = table.columns?.map(c => c.name).join(', ') || '*';
    const query = `SELECT ${cols}\nFROM ${schemaName}.${table.name}\nLIMIT 100;`;
    if (onInsertQuery) {
      onInsertQuery(query);
    }
  }

  // Generate COUNT query
  function generateCount(schemaName: string, tableName: string) {
    const query = `SELECT COUNT(*) FROM ${schemaName}.${tableName};`;
    if (onInsertQuery) {
      onInsertQuery(query);
    }
  }

  // Filter schemas/tables by search
  let filteredSchemas = $derived(() => {
    if (!searchQuery) return schemas;

    const q = searchQuery.toLowerCase();
    return schemas
      .map(schema => ({
        ...schema,
        tables: schema.tables.filter(t =>
          t.name.toLowerCase().includes(q) ||
          schema.name.toLowerCase().includes(q)
        )
      }))
      .filter(schema =>
        schema.name.toLowerCase().includes(q) ||
        schema.tables.length > 0
      );
  });

  // Get type icon
  function getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'integer': '123',
      'bigint': '123',
      'smallint': '123',
      'numeric': '123',
      'real': '123',
      'double precision': '123',
      'text': 'Aa',
      'character varying': 'Aa',
      'varchar': 'Aa',
      'char': 'Aa',
      'boolean': '?',
      'date': 'D',
      'timestamp': 'T',
      'timestamptz': 'T',
      'time': 'T',
      'geometry': 'G',
      'geography': 'G',
      'json': '{}',
      'jsonb': '{}',
      'uuid': '#',
      'bytea': 'B'
    };
    return icons[type] || '?';
  }
</script>

<div class="schema-browser">
  <!-- Connection selector -->
  <div class="browser-header">
    <select
      class="connection-select"
      bind:value={selectedConnection}
      onchange={loadSchemas}
    >
      <option value={null}>Sélectionner une connexion...</option>
      {#each connections as conn}
        <option value={conn.id}>{conn.name}</option>
      {/each}
    </select>
  </div>

  {#if selectedConnection}
    <!-- Search -->
    <div class="search-box">
      <input
        type="text"
        placeholder="Rechercher table/schéma..."
        bind:value={searchQuery}
      />
    </div>

    <!-- Schema tree -->
    <div class="schema-tree">
      {#if loading}
        <div class="loading">Chargement...</div>
      {:else if error}
        <div class="error">{error}</div>
      {:else}
        {#each filteredSchemas() as schema}
          <div class="schema-item">
            <button
              class="schema-header"
              onclick={() => toggleSchema(schema.name)}
            >
              <span class="expand-icon">{expandedSchemas.has(schema.name) ? '▼' : '▶'}</span>
              <span class="schema-icon">📁</span>
              <span class="schema-name">{schema.name}</span>
              <span class="table-count">{schema.tables.length || ''}</span>
            </button>

            {#if expandedSchemas.has(schema.name)}
              <div class="tables-list">
                {#each schema.tables as table}
                  <div class="table-item">
                    <button
                      class="table-header"
                      onclick={() => toggleTable(schema.name, table.name)}
                      ondblclick={() => handleTableClick(schema.name, table.name)}
                    >
                      <span class="expand-icon">{expandedTables.has(`${schema.name}.${table.name}`) ? '▼' : '▶'}</span>
                      <span class="table-icon">{table.type === 'view' ? '👁️' : '📋'}</span>
                      <span class="table-name">{table.name}</span>
                      {#if table.rowCount !== undefined && table.rowCount > 0}
                        <span class="row-count">~{table.rowCount.toLocaleString()}</span>
                      {/if}
                    </button>

                    <!-- Quick actions -->
                    <div class="table-actions">
                      <button
                        class="action-btn"
                        title="SELECT *"
                        onclick={() => generateSelect(schema.name, table)}
                      >
                        S
                      </button>
                      <button
                        class="action-btn"
                        title="COUNT(*)"
                        onclick={() => generateCount(schema.name, table.name)}
                      >
                        #
                      </button>
                    </div>

                    {#if expandedTables.has(`${schema.name}.${table.name}`) && table.columns}
                      <div class="columns-list">
                        {#each table.columns as col}
                          <div
                            class="column-item"
                            class:pk={col.isPrimaryKey}
                            class:fk={col.isForeignKey}
                            class:geo={col.isGeometry}
                          >
                            <span class="col-icon" title={col.type}>{getTypeIcon(col.type)}</span>
                            <span class="col-name">{col.name}</span>
                            <span class="col-type">{col.type}</span>
                            {#if col.isPrimaryKey}
                              <span class="col-badge pk">PK</span>
                            {/if}
                            {#if col.isForeignKey}
                              <span class="col-badge fk">FK</span>
                            {/if}
                            {#if col.isGeometry}
                              <span class="col-badge geo">GEO</span>
                            {/if}
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {:else}
                  <div class="empty-tables">Aucune table</div>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <div class="empty-message">Aucun schéma trouvé</div>
        {/each}
      {/if}
    </div>
  {:else}
    <div class="no-connection">
      <p>Sélectionnez une connexion PostgreSQL pour explorer la base de données.</p>
    </div>
  {/if}
</div>

<style>
  .schema-browser {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
    font-size: 13px;
  }

  .browser-header {
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .connection-select {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 12px;
  }

  .search-box {
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .search-box input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 12px;
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--accent-primary);
  }

  .schema-tree {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }

  .loading,
  .error,
  .empty-message,
  .no-connection {
    padding: 16px;
    text-align: center;
    color: var(--text-secondary);
  }

  .error {
    color: #ff6b6b;
  }

  .schema-item {
    margin-bottom: 2px;
  }

  .schema-header,
  .table-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .schema-header:hover,
  .table-header:hover {
    background: var(--bg-hover);
  }

  .expand-icon {
    font-size: 8px;
    color: var(--text-secondary);
    width: 10px;
  }

  .schema-icon,
  .table-icon {
    font-size: 14px;
  }

  .schema-name {
    font-weight: 600;
    color: var(--accent-primary);
  }

  .table-name {
    flex: 1;
  }

  .table-count,
  .row-count {
    font-size: 10px;
    color: var(--text-secondary);
    background: var(--bg-primary);
    padding: 1px 6px;
    border-radius: 10px;
  }

  .tables-list {
    margin-left: 16px;
    border-left: 1px solid var(--border-color);
    padding-left: 4px;
  }

  .table-item {
    position: relative;
  }

  .table-actions {
    position: absolute;
    right: 8px;
    top: 4px;
    display: none;
    gap: 2px;
  }

  .table-item:hover .table-actions {
    display: flex;
  }

  .action-btn {
    padding: 2px 6px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    font-size: 10px;
    font-weight: bold;
    cursor: pointer;
  }

  .action-btn:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .columns-list {
    margin-left: 20px;
    padding: 4px 0;
  }

  .column-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    font-size: 11px;
    border-radius: 3px;
  }

  .column-item:hover {
    background: var(--bg-hover);
  }

  .column-item.pk {
    background: rgba(255, 215, 0, 0.1);
  }

  .column-item.geo {
    background: rgba(0, 255, 136, 0.1);
  }

  .col-icon {
    font-family: monospace;
    font-size: 9px;
    font-weight: bold;
    color: var(--text-secondary);
    background: var(--bg-primary);
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
  }

  .col-name {
    flex: 1;
    color: var(--text-primary);
  }

  .col-type {
    color: var(--text-secondary);
    font-size: 10px;
  }

  .col-badge {
    font-size: 8px;
    font-weight: bold;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .col-badge.pk {
    background: #ffd700;
    color: #000;
  }

  .col-badge.fk {
    background: #6b7fff;
    color: #fff;
  }

  .col-badge.geo {
    background: var(--accent-primary);
    color: #000;
  }

  .empty-tables {
    padding: 8px 16px;
    font-size: 11px;
    color: var(--text-secondary);
    font-style: italic;
  }
</style>
