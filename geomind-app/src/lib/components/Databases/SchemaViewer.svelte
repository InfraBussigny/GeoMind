<script lang="ts">
  import { onMount } from 'svelte';
  import ERDCanvas from './ERD/ERDCanvas.svelte';

  // Props
  interface Props {
    connectionId: string;
  }
  let { connectionId }: Props = $props();

  // Types - alignés avec l'API backend
  interface Column {
    name: string;
    type: string;
    dataType: string;
    maxLength: number | null;
    precision: number | null;
    scale: number | null;
    nullable: boolean;
    defaultValue: string | null;
    comment: string | null;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    foreignKey: {
      foreignSchema: string;
      foreignTable: string;
      foreignColumn: string;
      constraintName: string;
    } | null;
    isGeometry: boolean;
    geometry: {
      geometryType: string;
      srid: number;
      coordDimension: number;
    } | null;
    position: number;
  }

  interface Table {
    schema: string;
    name: string;
    fullName: string;
    comment: string | null;
    sizeBytes: number;
    columnCount: number;
    columns: Column[];
    indexes: { name: string; definition: string }[];
    hasGeometry: boolean;
  }

  interface Relation {
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    constraintName: string;
  }

  interface DatabaseSchema {
    success: boolean;
    database: string;
    availableSchemas: string[];
    requestedSchemas: string[];
    tables: Table[];
    relations: Relation[];
    stats: {
      tableCount: number;
      totalColumns: number;
      foreignKeyCount: number;
      geometryColumns: number;
    };
  }

  // State
  let schema = $state<DatabaseSchema | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let selectedSchemas = $state<string[]>([]);
  let searchQuery = $state('');
  let selectedTable = $state<string | null>(null);
  let viewMode = $state<'list' | 'erd'>('list');

  // Load schema from database
  async function loadSchema() {
    loading = true;
    error = null;
    try {
      const schemasParam = selectedSchemas.length > 0 ? selectedSchemas.join(',') : 'public';
      const res = await fetch(`http://localhost:3001/api/databases/${connectionId}/schema?schemas=${schemasParam}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }
      schema = await res.json();
      if (schema?.availableSchemas && schema.availableSchemas.length > 0 && selectedSchemas.length === 0) {
        // Try to load saved default schemas first
        const savedDefaults = getDefaultSchemas(connectionId);
        if (savedDefaults && savedDefaults.length > 0) {
          selectedSchemas = savedDefaults.filter(s => schema.availableSchemas.includes(s));
        }
        // If no saved defaults or none valid, use 'bdco' as default, then 'public', then first schema
        if (selectedSchemas.length === 0) {
          if (schema.availableSchemas.includes('bdco')) {
            selectedSchemas = ['bdco'];
          } else if (schema.availableSchemas.includes('public')) {
            selectedSchemas = ['public'];
          } else {
            selectedSchemas = [schema.availableSchemas[0]];
          }
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur inconnue';
    } finally {
      loading = false;
    }
  }

  // Filtered tables based on selected schemas and search
  let filteredTables = $derived(() => {
    if (!schema) return [];
    return schema.tables
      .filter((table) => {
        // Filter by schema
        if (selectedSchemas.length > 0 && !selectedSchemas.includes(table.schema)) {
          return false;
        }
        // Filter by search query
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            table.name.toLowerCase().includes(q) ||
            table.schema.toLowerCase().includes(q) ||
            table.columns.some(c => c.name.toLowerCase().includes(q))
          );
        }
        return true;
      });
  });

  // Toggle schema selection - allows deselecting all
  function toggleSchema(schemaName: string) {
    if (selectedSchemas.includes(schemaName)) {
      // Allow deselecting even the last one
      selectedSchemas = selectedSchemas.filter(s => s !== schemaName);
    } else {
      selectedSchemas = [...selectedSchemas, schemaName];
    }
  }

  // Select/deselect all schemas
  function selectAllSchemas() {
    if (schema?.availableSchemas) {
      selectedSchemas = [...schema.availableSchemas];
    }
  }

  function deselectAllSchemas() {
    selectedSchemas = [];
  }

  // ERD sidebar state
  let erdSidebarCollapsed = $state(false);

  // Default schema persistence
  const STORAGE_KEY = 'geomind-default-schema';

  function getDefaultSchemas(connId: string): string[] | null {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${connId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  function setDefaultSchemas(connId: string, schemas: string[]): void {
    try {
      localStorage.setItem(`${STORAGE_KEY}-${connId}`, JSON.stringify(schemas));
    } catch (e) {
      console.warn('[SchemaViewer] Failed to save default schemas:', e);
    }
  }

  let defaultSaved = $state(false);

  function saveAsDefault(): void {
    setDefaultSchemas(connectionId, selectedSchemas);
    defaultSaved = true;
    setTimeout(() => defaultSaved = false, 2000);
  }

  function loadDefaultSchemas(): void {
    const defaults = getDefaultSchemas(connectionId);
    if (defaults && defaults.length > 0) {
      selectedSchemas = defaults.filter(s => schema?.availableSchemas.includes(s));
    }
  }

  // Get badge type for column
  function getColumnBadges(col: Column): string[] {
    const badges: string[] = [];
    if (col.isPrimaryKey) badges.push('PK');
    if (col.isForeignKey) badges.push('FK');
    if (col.geometry?.geometryType) badges.push(col.geometry.geometryType);
    if (!col.nullable) badges.push('NOT NULL');
    return badges;
  }

  // Format bytes to human readable
  function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  $effect(() => {
    if (connectionId) {
      loadSchema();
    }
  });
</script>

<div class="schema-viewer">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        type="text"
        placeholder="Rechercher tables, colonnes..."
        bind:value={searchQuery}
      />
    </div>

<!-- Filtres de schema retirés - utiliser la sidebar ERD pour la sélection -->

    <div class="view-toggle">
      <button
        class:active={viewMode === 'list'}
        onclick={() => viewMode = 'list'}
        title="Vue liste"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </button>
      <button
        class:active={viewMode === 'erd'}
        onclick={() => viewMode = 'erd'}
        title="Vue ERD"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <path d="M10 6h4M17 10v4M10 17h4M7 10v4"/>
        </svg>
      </button>
    </div>

    <button class="refresh-btn" onclick={loadSchema} disabled={loading}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spinning={loading}>
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
      Rafraichir
    </button>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Chargement du schema...</p>
    </div>
  {:else if error}
    <div class="error">
      <p>Erreur: {error}</p>
      <button onclick={loadSchema}>Reessayer</button>
    </div>
  {:else if !schema}
    <div class="empty">
      <p>Aucun schema charge</p>
    </div>
  {:else}
    <!-- Content with Sidebar -->
    <div class="content-container">
      <!-- Sidebar pour sélection des schemas (visible dans tous les modes) -->
      <aside class="schema-sidebar" class:collapsed={erdSidebarCollapsed}>
        <div class="sidebar-header">
          <h3>Schemas</h3>
          <button
            class="collapse-btn"
            onclick={() => erdSidebarCollapsed = !erdSidebarCollapsed}
            title={erdSidebarCollapsed ? 'Ouvrir' : 'Fermer'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              {#if erdSidebarCollapsed}
                <path d="M9 18l6-6-6-6"/>
              {:else}
                <path d="M15 18l-6-6 6-6"/>
              {/if}
            </svg>
          </button>
        </div>

        {#if !erdSidebarCollapsed}
          <div class="sidebar-content">
            <!-- Selection controls -->
            <div class="selection-controls">
              <button class="select-btn" onclick={selectAllSchemas} title="Tout selectionner">
                Tout
              </button>
              <button class="select-btn" onclick={deselectAllSchemas} title="Tout deselectionner">
                Aucun
              </button>
              <button
                class="select-btn default-btn"
                class:saved={defaultSaved}
                onclick={saveAsDefault}
                title="Definir comme selection par defaut"
              >
                {#if defaultSaved}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                {:else}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                {/if}
              </button>
            </div>

            <!-- Schema list -->
            <div class="schema-list">
              {#if schema?.availableSchemas}
                {#each schema.availableSchemas as schemaName}
                  <label class="schema-item">
                    <input
                      type="checkbox"
                      checked={selectedSchemas.includes(schemaName)}
                      onchange={() => toggleSchema(schemaName)}
                    />
                    <span class="schema-label">{schemaName}</span>
                    <span class="table-count">
                      {schema.tables.filter(t => t.schema === schemaName).length}
                    </span>
                  </label>
                {/each}
              {/if}
            </div>

            <!-- Stats -->
            <div class="sidebar-stats">
              <div class="stat-row">
                <span>Tables</span>
                <span class="stat-value">{filteredTables().length}</span>
              </div>
              <div class="stat-row">
                <span>Relations</span>
                <span class="stat-value">{schema?.relations.filter(r =>
                  filteredTables().some(t => t.fullName === r.sourceTable) &&
                  filteredTables().some(t => t.fullName === r.targetTable)
                ).length || 0}</span>
              </div>
              {#if schema?.stats?.geometryColumns > 0}
                <div class="stat-row postgis">
                  <span>PostGIS</span>
                  <span class="stat-value">{schema.stats.geometryColumns} geo</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </aside>

      <!-- Main Content Area -->
      <div class="main-content">
        {#if viewMode === 'list'}
          <!-- List View -->
          <div class="table-list">
            <div class="stats-bar">
              <span>{filteredTables().length} tables</span>
              <span>{schema.relations.length} relations</span>
              {#if schema.stats?.geometryColumns > 0}
                <span class="postgis-badge">PostGIS ({schema.stats.geometryColumns} geo)</span>
              {/if}
            </div>

            <div class="tables-grid">
              {#each filteredTables() as table}
                <div
                  class="table-card"
                  class:selected={selectedTable === table.fullName}
                  onclick={() => selectedTable = selectedTable === table.fullName ? null : table.fullName}
                >
                  <div class="table-header">
                    <span class="table-schema">{table.schema}.</span>
                    <span class="table-name">{table.name}</span>
                    {#if table.sizeBytes}
                      <span class="row-count">{formatBytes(table.sizeBytes)}</span>
                    {/if}
                  </div>

                  {#if table.comment}
                    <p class="table-comment">{table.comment}</p>
                  {/if}

                  <div class="columns-list">
                    {#each table.columns as col}
                      <div class="column-row">
                        <span class="col-name" class:pk={col.isPrimaryKey} class:fk={col.isForeignKey}>
                          {col.name}
                        </span>
                        <span class="col-type">{col.type}</span>
                        <div class="col-badges">
                          {#each getColumnBadges(col) as badge}
                            <span class="badge" class:pk={badge === 'PK'} class:fk={badge === 'FK'} class:geo={col.isGeometry}>
                              {badge}
                            </span>
                          {/each}
                        </div>
                      </div>
                    {/each}
                  </div>

                  {#if selectedTable === table.fullName && schema.relations.filter(r =>
                    r.sourceTable === table.fullName || r.targetTable === table.fullName
                  ).length > 0}
                    <div class="relations-section">
                      <h4>Relations</h4>
                      {#each schema.relations.filter(r =>
                        r.sourceTable === table.fullName || r.targetTable === table.fullName
                      ) as rel}
                        <div class="relation-row">
                          {#if rel.sourceTable === table.fullName}
                            <span class="rel-local">{rel.sourceColumn}</span>
                            <span class="rel-arrow">→</span>
                            <span class="rel-foreign">{rel.targetTable}.{rel.targetColumn}</span>
                          {:else}
                            <span class="rel-foreign">{rel.sourceTable}.{rel.sourceColumn}</span>
                            <span class="rel-arrow">→</span>
                            <span class="rel-local">{rel.targetColumn}</span>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <!-- ERD View -->
          <div class="erd-view">
            {#if schema && filteredTables().length > 0}
              <ERDCanvas
                tables={filteredTables()}
                relations={schema.relations.filter(r =>
                  filteredTables().some(t => t.fullName === r.sourceTable) &&
                  filteredTables().some(t => t.fullName === r.targetTable)
                )}
                {connectionId}
              />
            {:else}
              <div class="erd-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                <p>Selectionnez au moins un schema</p>
                <button class="select-all-btn" onclick={selectAllSchemas}>
                  Afficher tous les schemas
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .schema-viewer {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    flex: 1;
    max-width: 300px;
  }

  .search-box svg {
    width: 18px;
    height: 18px;
    color: var(--text-muted);
  }

  .search-box input {
    flex: 1;
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: 0.9rem;
    outline: none;
  }

  .search-box input::placeholder {
    color: var(--text-muted);
  }

  .view-toggle {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--noir-card);
    border-radius: 6px;
  }

  .view-toggle button {
    padding: 8px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .view-toggle button:hover {
    background: var(--bg-hover);
    color: var(--text-bright);
  }

  .view-toggle button.active {
    background: var(--cyber-green);
    color: var(--noir-profond);
  }

  .view-toggle button svg {
    width: 18px;
    height: 18px;
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-card);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-btn svg {
    width: 16px;
    height: 16px;
  }

  .refresh-btn svg.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading, .error, .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 12px;
    color: var(--text-muted);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--cyber-green);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .error button {
    padding: 8px 16px;
    border: 1px solid var(--cyber-green);
    border-radius: 6px;
    background: transparent;
    color: var(--cyber-green);
    cursor: pointer;
  }

  .table-list {
    flex: 1;
    overflow: auto;
  }

  .stats-bar {
    display: flex;
    gap: 16px;
    padding: 8px 0;
    font-size: 0.85rem;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 16px;
  }

  .postgis-badge {
    padding: 2px 8px;
    background: #90EE90;
    color: #000;
    border-radius: 4px;
    font-weight: 600;
  }

  .tables-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 16px;
  }

  .table-card {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .table-card:hover {
    border-color: var(--cyber-green);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  .table-card.selected {
    border-color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.05);
  }

  .table-header {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 8px;
  }

  .table-schema {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .table-name {
    font-weight: 600;
    color: var(--cyber-green);
    font-size: 1.1rem;
  }

  .row-count {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--text-muted);
    background: var(--bg-hover);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .table-comment {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0 0 12px;
    font-style: italic;
  }

  .columns-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow: auto;
  }

  .column-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.85rem;
    font-family: var(--font-mono);
  }

  .column-row:hover {
    background: var(--bg-hover);
  }

  .col-name {
    flex: 1;
    color: var(--text-primary);
  }

  .col-name.pk {
    font-weight: 600;
    color: #ffd700;
  }

  .col-name.fk {
    color: #87ceeb;
  }

  .col-type {
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .col-badges {
    display: flex;
    gap: 4px;
  }

  .badge {
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 600;
    background: var(--bg-hover);
    color: var(--text-muted);
  }

  .badge.pk {
    background: #ffd700;
    color: #000;
  }

  .badge.fk {
    background: #87ceeb;
    color: #000;
  }

  .badge.geo {
    background: #90EE90;
    color: #000;
  }

  .relations-section {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }

  .relations-section h4 {
    margin: 0 0 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .relation-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    font-family: var(--font-mono);
    padding: 4px 0;
  }

  .rel-local {
    color: var(--cyber-green);
  }

  .rel-arrow {
    color: var(--text-muted);
  }

  .rel-foreign {
    color: #87ceeb;
  }

  /* Content Container with Sidebar */
  .content-container {
    flex: 1;
    display: flex;
    min-height: 500px;
    height: calc(100vh - 280px);
    gap: 0;
  }

  .schema-sidebar {
    width: 240px;
    background: var(--noir-card);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    transition: width 0.2s ease;
    overflow: hidden;
  }

  .schema-sidebar.collapsed {
    width: 40px;
  }

  .schema-sidebar.collapsed .sidebar-header h3 {
    display: none;
  }

  .main-content {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }

  .main-content .table-list {
    flex: 1;
    padding: 16px;
    overflow: auto;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
    background: var(--noir-surface);
  }

  .sidebar-header h3 {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-primary);
    font-weight: 600;
  }

  .collapse-btn {
    padding: 4px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .collapse-btn:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
  }

  .collapse-btn svg {
    width: 18px;
    height: 18px;
  }

  .sidebar-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .selection-controls {
    display: flex;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .select-btn {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--noir-surface);
    color: var(--text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .select-btn:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .select-btn.default-btn {
    flex: 0;
    padding: 6px 8px;
  }

  .select-btn.default-btn svg {
    width: 14px;
    height: 14px;
  }

  .select-btn.default-btn:hover {
    color: #ffd700;
    border-color: #ffd700;
  }

  .select-btn.default-btn.saved {
    color: var(--cyber-green);
    border-color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.1);
  }

  .schema-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .schema-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .schema-item:hover {
    background: var(--bg-hover);
  }

  .schema-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--cyber-green);
    cursor: pointer;
  }

  .schema-label {
    flex: 1;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .table-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    background: var(--bg-hover);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .sidebar-stats {
    border-top: 1px solid var(--border-color);
    padding: 12px;
    background: var(--noir-surface);
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .stat-row.postgis {
    color: #90EE90;
  }

  .stat-value {
    font-weight: 600;
    color: var(--text-primary);
  }

  .stat-row.postgis .stat-value {
    color: #90EE90;
  }

  .erd-view {
    flex: 1;
    display: flex;
    min-height: 500px;
  }

  .erd-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    text-align: center;
    color: var(--text-muted);
    background: var(--bg-primary);
  }

  .erd-empty svg {
    width: 80px;
    height: 80px;
    margin-bottom: 16px;
    opacity: 0.4;
  }

  .erd-empty p {
    margin: 0 0 16px;
  }

  .select-all-btn {
    padding: 10px 20px;
    border: 1px solid var(--cyber-green);
    border-radius: 6px;
    background: transparent;
    color: var(--cyber-green);
    font-family: var(--font-mono);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .select-all-btn:hover {
    background: var(--cyber-green);
    color: var(--noir-profond);
  }
</style>
