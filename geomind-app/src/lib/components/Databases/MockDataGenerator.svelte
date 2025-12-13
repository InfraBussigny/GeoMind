<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    connectionId: string;
  }
  let { connectionId }: Props = $props();

  // Types
  interface Column {
    name: string;
    type: string;
    dataType: string;
    nullable: boolean;
    defaultValue: string | null;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    foreignKey: {
      foreignSchema: string;
      foreignTable: string;
      foreignColumn: string;
    } | null;
    isGeometry: boolean;
    geometry: {
      geometryType: string;
      srid: number;
    } | null;
  }

  interface Table {
    schema: string;
    name: string;
    fullName: string;
    columns: Column[];
  }

  // State
  let tables = $state<Table[]>([]);
  let selectedTable = $state<Table | null>(null);
  let rowCount = $state(50);
  let generating = $state(false);
  let executing = $state(false);
  let generatedSql = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let excludedColumns = $state<Set<string>>(new Set());
  let useNullForOptional = $state(true);
  let respectForeignKeys = $state(true);
  let copySuccess = $state(false);

  // Swiss data for realistic generation
  const SWISS_FIRST_NAMES = ['Marc', 'Pierre', 'Jean', 'Michel', 'Claude', 'André', 'François', 'Laurent', 'Nicolas', 'Stéphane', 'Marie', 'Anne', 'Sophie', 'Isabelle', 'Nathalie', 'Christine', 'Catherine', 'Françoise', 'Sylvie', 'Monique'];
  const SWISS_LAST_NAMES = ['Müller', 'Meier', 'Schmid', 'Keller', 'Weber', 'Huber', 'Schneider', 'Meyer', 'Steiner', 'Fischer', 'Dubois', 'Martin', 'Favre', 'Rochat', 'Blanc', 'Bonvin', 'Moret', 'Roux', 'Girard', 'Berset'];
  const SWISS_CITIES = [
    { name: 'Lausanne', npa: 1000 },
    { name: 'Renens', npa: 1020 },
    { name: 'Prilly', npa: 1008 },
    { name: 'Ecublens', npa: 1024 },
    { name: 'Crissier', npa: 1023 },
    { name: 'Chavannes-près-Renens', npa: 1022 },
    { name: 'Morges', npa: 1110 },
    { name: 'Yverdon-les-Bains', npa: 1400 },
    { name: 'Nyon', npa: 1260 },
    { name: 'Genève', npa: 1200 }
  ];
  const SWISS_STREETS = ['Rue de Lausanne', 'Avenue de la Gare', 'Chemin des Vignes', 'Route de Genève', 'Place du Marché', 'Rue du Centre', 'Avenue du Léman', 'Chemin de la Forêt', 'Rue de l\'Industrie', 'Avenue des Sports'];

  // Default Swiss bounds (Lausanne area, MN95)
  const DEFAULT_BOUNDS = {
    minX: 2533000, maxX: 2540000,
    minY: 1150000, maxY: 1156000
  };

  // Load tables from schema
  async function loadTables() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`http://localhost:3001/api/databases/${connectionId}/schema?schemas=public,bdco`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      tables = data.tables || [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur chargement';
    } finally {
      loading = false;
    }
  }

  // Generate random value based on column type
  function generateValue(col: Column, rowIndex: number): string {
    // Skip excluded columns
    if (excludedColumns.has(col.name)) return 'DEFAULT';

    // Handle nullable with null option
    if (col.nullable && useNullForOptional && Math.random() > 0.7) {
      return 'NULL';
    }

    // Primary key - sequential
    if (col.isPrimaryKey && (col.type.includes('int') || col.type.includes('serial'))) {
      return String(1000 + rowIndex);
    }

    // Geometry columns
    if (col.isGeometry && col.geometry) {
      const x = DEFAULT_BOUNDS.minX + Math.random() * (DEFAULT_BOUNDS.maxX - DEFAULT_BOUNDS.minX);
      const y = DEFAULT_BOUNDS.minY + Math.random() * (DEFAULT_BOUNDS.maxY - DEFAULT_BOUNDS.minY);
      const srid = col.geometry.srid || 2056;

      switch (col.geometry.geometryType.toUpperCase()) {
        case 'POINT':
          return `ST_SetSRID(ST_MakePoint(${x.toFixed(2)}, ${y.toFixed(2)}), ${srid})`;
        case 'POLYGON':
          const size = 50 + Math.random() * 200;
          return `ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[ST_MakePoint(${x.toFixed(2)}, ${y.toFixed(2)}), ST_MakePoint(${(x+size).toFixed(2)}, ${y.toFixed(2)}), ST_MakePoint(${(x+size).toFixed(2)}, ${(y+size).toFixed(2)}), ST_MakePoint(${x.toFixed(2)}, ${(y+size).toFixed(2)}), ST_MakePoint(${x.toFixed(2)}, ${y.toFixed(2)})])), ${srid})`;
        case 'LINESTRING':
          const dx = 50 + Math.random() * 200;
          const dy = 50 + Math.random() * 200;
          return `ST_SetSRID(ST_MakeLine(ST_MakePoint(${x.toFixed(2)}, ${y.toFixed(2)}), ST_MakePoint(${(x+dx).toFixed(2)}, ${(y+dy).toFixed(2)})), ${srid})`;
        default:
          return `ST_SetSRID(ST_MakePoint(${x.toFixed(2)}, ${y.toFixed(2)}), ${srid})`;
      }
    }

    const lowerName = col.name.toLowerCase();
    const lowerType = col.type.toLowerCase();

    // Name-based guessing
    if (lowerName.includes('prenom') || lowerName.includes('first_name') || lowerName.includes('firstname')) {
      return `'${SWISS_FIRST_NAMES[Math.floor(Math.random() * SWISS_FIRST_NAMES.length)]}'`;
    }
    if (lowerName.includes('nom') || lowerName.includes('last_name') || lowerName.includes('lastname') || lowerName.includes('name')) {
      return `'${SWISS_LAST_NAMES[Math.floor(Math.random() * SWISS_LAST_NAMES.length)]}'`;
    }
    if (lowerName.includes('email') || lowerName.includes('mail')) {
      const first = SWISS_FIRST_NAMES[Math.floor(Math.random() * SWISS_FIRST_NAMES.length)].toLowerCase();
      const last = SWISS_LAST_NAMES[Math.floor(Math.random() * SWISS_LAST_NAMES.length)].toLowerCase().replace('ü', 'u');
      return `'${first}.${last}@example.ch'`;
    }
    if (lowerName.includes('phone') || lowerName.includes('tel')) {
      return `'+41 ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10}'`;
    }
    if (lowerName.includes('npa') || lowerName.includes('zip') || lowerName.includes('postal')) {
      return String(SWISS_CITIES[Math.floor(Math.random() * SWISS_CITIES.length)].npa);
    }
    if (lowerName.includes('ville') || lowerName.includes('city') || lowerName.includes('localite')) {
      return `'${SWISS_CITIES[Math.floor(Math.random() * SWISS_CITIES.length)].name}'`;
    }
    if (lowerName.includes('rue') || lowerName.includes('street') || lowerName.includes('adresse') || lowerName.includes('address')) {
      const street = SWISS_STREETS[Math.floor(Math.random() * SWISS_STREETS.length)];
      const num = Math.floor(Math.random() * 150) + 1;
      return `'${street} ${num}'`;
    }
    if (lowerName.includes('surface') || lowerName.includes('area')) {
      return String(Math.floor(Math.random() * 5000) + 100);
    }
    if (lowerName.includes('date') || lowerName.includes('created') || lowerName.includes('updated')) {
      const year = 2020 + Math.floor(Math.random() * 5);
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      return `'${year}-${month}-${day}'`;
    }
    if (lowerName.includes('actif') || lowerName.includes('active') || lowerName.includes('enabled')) {
      return Math.random() > 0.2 ? 'true' : 'false';
    }
    if (lowerName.includes('description') || lowerName.includes('comment') || lowerName.includes('remarque')) {
      return `'Donnée de test générée automatiquement #${rowIndex + 1}'`;
    }

    // Type-based generation
    if (lowerType.includes('serial') || lowerType.includes('identity')) {
      return 'DEFAULT';
    }
    if (lowerType.includes('int') || lowerType.includes('numeric') || lowerType.includes('decimal')) {
      return String(Math.floor(Math.random() * 1000));
    }
    if (lowerType.includes('float') || lowerType.includes('double') || lowerType.includes('real')) {
      return (Math.random() * 1000).toFixed(2);
    }
    if (lowerType.includes('bool')) {
      return Math.random() > 0.5 ? 'true' : 'false';
    }
    if (lowerType.includes('date')) {
      const year = 2020 + Math.floor(Math.random() * 5);
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      return `'${year}-${month}-${day}'`;
    }
    if (lowerType.includes('time') && !lowerType.includes('stamp')) {
      const h = String(Math.floor(Math.random() * 24)).padStart(2, '0');
      const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');
      return `'${h}:${m}:00'`;
    }
    if (lowerType.includes('timestamp')) {
      const year = 2020 + Math.floor(Math.random() * 5);
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const h = String(Math.floor(Math.random() * 24)).padStart(2, '0');
      const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');
      return `'${year}-${month}-${day} ${h}:${m}:00'`;
    }
    if (lowerType.includes('uuid')) {
      return 'gen_random_uuid()';
    }
    if (lowerType.includes('json')) {
      return `'{"test": true, "index": ${rowIndex}}'`;
    }
    if (lowerType.includes('text') || lowerType.includes('varchar') || lowerType.includes('char')) {
      return `'Valeur test ${rowIndex + 1}'`;
    }

    return 'NULL';
  }

  // Generate SQL INSERT statements
  function generateMockData() {
    if (!selectedTable) return;

    generating = true;
    error = null;

    try {
      const cols = selectedTable.columns.filter(c => !excludedColumns.has(c.name));
      const colNames = cols.map(c => `"${c.name}"`).join(', ');

      let sql = `-- Données mock pour ${selectedTable.fullName}\n`;
      sql += `-- Générées le ${new Date().toLocaleString('fr-CH')}\n`;
      sql += `-- ${rowCount} lignes\n\n`;
      sql += `INSERT INTO ${selectedTable.fullName} (${colNames}) VALUES\n`;

      const rows: string[] = [];
      for (let i = 0; i < rowCount; i++) {
        const values = cols.map(col => generateValue(col, i)).join(', ');
        rows.push(`  (${values})`);
      }

      sql += rows.join(',\n') + ';\n';
      generatedSql = sql;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur génération';
    } finally {
      generating = false;
    }
  }

  // Execute the generated SQL
  async function executeSql() {
    if (!generatedSql) return;

    executing = true;
    error = null;

    try {
      const res = await fetch(`http://localhost:3001/api/connections/${connectionId}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: generatedSql })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }

      const result = await res.json();
      error = null;
      alert(`✓ ${rowCount} lignes insérées avec succès dans ${selectedTable?.fullName}`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur exécution';
    } finally {
      executing = false;
    }
  }

  // Copy to clipboard
  function copyToClipboard() {
    navigator.clipboard.writeText(generatedSql);
    copySuccess = true;
    setTimeout(() => copySuccess = false, 2000);
  }

  // Toggle column exclusion
  function toggleColumn(colName: string) {
    const newSet = new Set(excludedColumns);
    if (newSet.has(colName)) {
      newSet.delete(colName);
    } else {
      newSet.add(colName);
    }
    excludedColumns = newSet;
  }

  // Auto-exclude serial/identity columns
  function autoExcludeSerials() {
    if (!selectedTable) return;
    const serials = selectedTable.columns
      .filter(c => c.type.toLowerCase().includes('serial') || c.defaultValue?.includes('nextval'))
      .map(c => c.name);
    excludedColumns = new Set(serials);
  }

  onMount(() => {
    loadTables();
  });

  // When table selection changes, auto-exclude serials
  $effect(() => {
    if (selectedTable) {
      autoExcludeSerials();
      generatedSql = '';
    }
  });
</script>

<div class="mock-generator">
  <!-- Header -->
  <div class="header">
    <div class="title-section">
      <h2>Generateur de Donnees Mock</h2>
      <p>Donnees suisses realistes, support PostGIS, detection intelligente des types</p>
    </div>
    <button class="refresh-btn" onclick={loadTables} disabled={loading}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spinning={loading}>
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    </button>
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Chargement des tables...</p>
    </div>
  {:else if error && !selectedTable}
    <div class="error-box">
      <p>{error}</p>
      <button onclick={loadTables}>Reessayer</button>
    </div>
  {:else}
    <div class="content">
      <!-- Left: Table Selection -->
      <div class="table-selector">
        <h3>1. Selectionner une table</h3>
        <div class="table-list">
          {#each tables as table}
            <button
              class="table-item"
              class:selected={selectedTable?.fullName === table.fullName}
              onclick={() => selectedTable = table}
            >
              <span class="table-schema">{table.schema}.</span>
              <span class="table-name">{table.name}</span>
              <span class="col-count">{table.columns.length} cols</span>
            </button>
          {/each}
          {#if tables.length === 0}
            <p class="empty">Aucune table trouvee</p>
          {/if}
        </div>
      </div>

      <!-- Middle: Column Configuration -->
      <div class="column-config">
        <h3>2. Configurer les colonnes</h3>
        {#if selectedTable}
          <div class="options-row">
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={useNullForOptional} />
              <span>NULL pour colonnes optionnelles (30%)</span>
            </label>
          </div>
          <div class="columns-list">
            {#each selectedTable.columns as col}
              <label class="column-item" class:excluded={excludedColumns.has(col.name)}>
                <input
                  type="checkbox"
                  checked={!excludedColumns.has(col.name)}
                  onchange={() => toggleColumn(col.name)}
                />
                <span class="col-name" class:pk={col.isPrimaryKey} class:geo={col.isGeometry}>
                  {col.name}
                </span>
                <span class="col-type">{col.type}</span>
                {#if col.isPrimaryKey}
                  <span class="badge pk">PK</span>
                {/if}
                {#if col.isGeometry}
                  <span class="badge geo">{col.geometry?.geometryType || 'GEO'}</span>
                {/if}
                {#if !col.nullable}
                  <span class="badge req">*</span>
                {/if}
              </label>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7"/>
              <ellipse cx="12" cy="7" rx="8" ry="4"/>
              <path d="M4 12c0 2.21 3.582 4 8 4s8-1.79 8-4"/>
            </svg>
            <p>Selectionnez une table</p>
          </div>
        {/if}
      </div>

      <!-- Right: Generation -->
      <div class="generation-panel">
        <h3>3. Generer</h3>
        <div class="gen-form">
          <div class="form-group">
            <label for="row-count">Nombre de lignes</label>
            <input
              type="number"
              id="row-count"
              bind:value={rowCount}
              min="1"
              max="10000"
            />
          </div>

          <button
            class="generate-btn"
            onclick={generateMockData}
            disabled={!selectedTable || generating}
          >
            {#if generating}
              <span class="spinner small"></span>
              Generation...
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Generer SQL
            {/if}
          </button>
        </div>

        {#if generatedSql}
          <div class="sql-output">
            <div class="sql-header">
              <span>SQL genere ({rowCount} lignes)</span>
              <div class="sql-actions">
                <button class="action-btn" onclick={copyToClipboard} title="Copier">
                  {#if copySuccess}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  {:else}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  {/if}
                </button>
              </div>
            </div>
            <pre class="sql-code"><code>{generatedSql}</code></pre>

            {#if error}
              <div class="error-msg">{error}</div>
            {/if}

            <button
              class="execute-btn"
              onclick={executeSql}
              disabled={executing}
            >
              {#if executing}
                <span class="spinner small"></span>
                Execution...
              {:else}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                </svg>
                Executer dans la base
              {/if}
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .mock-generator {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .title-section h2 {
    margin: 0 0 4px;
    font-size: 1.2rem;
    color: var(--text-bright);
  }

  .title-section p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .refresh-btn {
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-card);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-btn:hover:not(:disabled) {
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .refresh-btn svg {
    width: 18px;
    height: 18px;
  }

  .refresh-btn svg.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading, .error-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 12px;
    color: var(--text-muted);
  }

  .error-box {
    color: var(--danger);
  }

  .error-box button {
    padding: 8px 16px;
    border: 1px solid var(--danger);
    border-radius: 6px;
    background: transparent;
    color: var(--danger);
    cursor: pointer;
  }

  .content {
    display: grid;
    grid-template-columns: 250px 300px 1fr;
    gap: 16px;
    flex: 1;
    overflow: hidden;
  }

  .table-selector, .column-config, .generation-panel {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  h3 {
    margin: 0 0 12px;
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .table-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .table-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-surface);
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .table-item:hover {
    border-color: var(--cyber-green);
    background: var(--bg-hover);
  }

  .table-item.selected {
    border-color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.1);
  }

  .table-schema {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .table-name {
    flex: 1;
    font-weight: 500;
    color: var(--text-bright);
  }

  .col-count {
    font-size: 0.7rem;
    color: var(--text-muted);
    background: var(--bg-hover);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .empty {
    text-align: center;
    color: var(--text-muted);
    padding: 20px;
  }

  .options-row {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .checkbox-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .checkbox-option input {
    accent-color: var(--cyber-green);
  }

  .columns-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .column-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: var(--font-mono);
    transition: background 0.15s;
  }

  .column-item:hover {
    background: var(--bg-hover);
  }

  .column-item.excluded {
    opacity: 0.4;
  }

  .column-item input {
    accent-color: var(--cyber-green);
  }

  .col-name {
    flex: 1;
    color: var(--text-primary);
  }

  .col-name.pk {
    color: #ffd700;
    font-weight: 600;
  }

  .col-name.geo {
    color: #90EE90;
  }

  .col-type {
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .badge {
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
    background: var(--bg-hover);
    color: var(--text-muted);
  }

  .badge.pk {
    background: #ffd700;
    color: #000;
  }

  .badge.geo {
    background: #90EE90;
    color: #000;
  }

  .badge.req {
    background: var(--danger);
    color: white;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--text-muted);
    text-align: center;
  }

  .empty-state svg {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    opacity: 0.4;
  }

  .gen-form {
    margin-bottom: 16px;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .form-group input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-surface);
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--cyber-green);
  }

  .generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 6px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
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
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 14px;
    height: 14px;
  }

  .sql-output {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sql-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .sql-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    padding: 6px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--noir-surface);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover {
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }

  .sql-code {
    flex: 1;
    margin: 0;
    padding: 12px;
    background: var(--noir-profond);
    border-radius: 6px;
    overflow: auto;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--cyber-green);
    max-height: 300px;
  }

  .error-msg {
    margin: 8px 0;
    padding: 8px 12px;
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid var(--danger);
    border-radius: 4px;
    color: var(--danger);
    font-size: 0.85rem;
  }

  .execute-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    margin-top: 12px;
    padding: 10px;
    border: 1px solid var(--primary);
    border-radius: 6px;
    background: var(--primary);
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .execute-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .execute-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .execute-btn svg {
    width: 16px;
    height: 16px;
  }
</style>
