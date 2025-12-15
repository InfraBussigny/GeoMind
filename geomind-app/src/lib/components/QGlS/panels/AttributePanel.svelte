<script lang="ts">
  import { onMount } from 'svelte';
  import type QGlSMap from '../QGlSMap.svelte';
  import type { Feature } from 'ol';
  import type { Geometry } from 'ol/geom';
  import { getArea, getLength } from 'ol/sphere';

  // Props
  interface Props {
    mapRef: QGlSMap | undefined;
  }
  let { mapRef }: Props = $props();

  // Feature data
  interface FeatureRow {
    id: string;
    feature: Feature<Geometry>;
    type: string;
    area: number | null;
    length: number | null;
    properties: Record<string, any>;
  }

  let features = $state<FeatureRow[]>([]);
  let selectedIds = $state<Set<string>>(new Set());
  let editingCell = $state<{ id: string; prop: string } | null>(null);
  let editValue = $state('');

  // Pagination
  let currentPage = $state(1);
  let pageSize = $state(25);
  let totalPages = $derived(Math.ceil(features.length / pageSize));
  let paginatedFeatures = $derived(
    features.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  );

  // Column management
  let propertyColumns = $derived(() => {
    const allProps = new Set<string>();
    features.forEach(f => {
      Object.keys(f.properties).forEach(k => allProps.add(k));
    });
    return Array.from(allProps).sort();
  });

  // Refresh features from map
  function refreshFeatures() {
    if (!mapRef) return;

    const source = mapRef.getSketchSource();
    if (!source) return;

    const olFeatures = source.getFeatures();
    features = olFeatures.map((f, idx) => {
      const geom = f.getGeometry();
      const type = geom?.getType() || 'Unknown';
      let area: number | null = null;
      let length: number | null = null;

      if (type === 'Polygon' || type === 'MultiPolygon') {
        try {
          area = getArea(geom!, { projection: 'EPSG:2056' });
        } catch {}
      }

      if (type === 'LineString' || type === 'MultiLineString') {
        try {
          length = getLength(geom!, { projection: 'EPSG:2056' });
        } catch {}
      }

      // Get feature ID or create one
      let id = f.getId() as string;
      if (!id) {
        id = `feature_${idx}`;
        f.setId(id);
      }

      // Get custom properties
      const props: Record<string, any> = {};
      f.getKeys().forEach(key => {
        if (key !== 'geometry' && !key.startsWith('_')) {
          props[key] = f.get(key);
        }
      });

      return {
        id,
        feature: f,
        type,
        area,
        length,
        properties: props
      };
    });
  }

  // Auto-refresh on mount and periodically
  onMount(() => {
    refreshFeatures();
    const interval = setInterval(refreshFeatures, 2000);
    return () => clearInterval(interval);
  });

  // Handle row click - select feature on map
  function handleRowClick(row: FeatureRow, event: MouseEvent) {
    if (!mapRef) return;

    if (event.ctrlKey || event.metaKey) {
      // Multi-select
      if (selectedIds.has(row.id)) {
        selectedIds.delete(row.id);
      } else {
        selectedIds.add(row.id);
      }
      selectedIds = new Set(selectedIds);
    } else {
      // Single select
      selectedIds = new Set([row.id]);
    }

    // Sync with map selection
    // TODO: Implement map selection sync
  }

  // Handle double-click to edit
  function handleCellDoubleClick(row: FeatureRow, prop: string) {
    editingCell = { id: row.id, prop };
    editValue = String(row.properties[prop] ?? '');
  }

  // Save edited value
  function saveEdit() {
    if (!editingCell) return;

    const row = features.find(f => f.id === editingCell!.id);
    if (row) {
      // Update feature property
      row.feature.set(editingCell.prop, editValue);
      row.properties[editingCell.prop] = editValue;
    }

    editingCell = null;
    editValue = '';
  }

  // Cancel edit
  function cancelEdit() {
    editingCell = null;
    editValue = '';
  }

  // Handle key press in edit mode
  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }

  // Add new property column
  let newPropName = $state('');
  let showAddProp = $state(false);

  function addProperty() {
    if (!newPropName.trim()) return;

    // Add property to all features with empty value
    features.forEach(row => {
      row.feature.set(newPropName, '');
      row.properties[newPropName] = '';
    });

    newPropName = '';
    showAddProp = false;
  }

  // Zoom to feature
  function zoomToFeature(row: FeatureRow) {
    if (!mapRef) return;

    const geom = row.feature.getGeometry();
    if (geom) {
      const extent = geom.getExtent();
      mapRef.zoomToExtent(extent as [number, number, number, number]);
    }
  }

  // Delete selected features
  function deleteSelected() {
    if (!mapRef || selectedIds.size === 0) return;

    const source = mapRef.getSketchSource();
    if (!source) return;

    selectedIds.forEach(id => {
      const feature = source.getFeatureById(id);
      if (feature) {
        source.removeFeature(feature);
      }
    });

    selectedIds = new Set();
    refreshFeatures();
  }

  // Export to CSV
  function exportCSV() {
    const cols = propertyColumns();
    const header = ['id', 'type', 'area_m2', 'length_m', ...cols].join(';');

    const rows = features.map(f => {
      const values = [
        f.id,
        f.type,
        f.area?.toFixed(2) ?? '',
        f.length?.toFixed(2) ?? '',
        ...cols.map(c => String(f.properties[c] ?? ''))
      ];
      return values.join(';');
    });

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `sketches_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Format number for display
  function formatNumber(val: number | null, decimals: number = 2): string {
    if (val === null) return '-';
    return val.toLocaleString('fr-CH', { maximumFractionDigits: decimals });
  }
</script>

<div class="attribute-panel">
  <!-- Toolbar -->
  <div class="panel-toolbar">
    <button class="tool-btn" onclick={refreshFeatures} title="Rafraîchir">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    </button>

    <button
      class="tool-btn"
      onclick={() => showAddProp = true}
      title="Ajouter colonne"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    </button>

    <button
      class="tool-btn danger"
      onclick={deleteSelected}
      disabled={selectedIds.size === 0}
      title="Supprimer sélection"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    </button>

    <div class="toolbar-spacer"></div>

    <button class="tool-btn" onclick={exportCSV} title="Exporter CSV">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </button>

    <span class="feature-count">{features.length} entité{features.length !== 1 ? 's' : ''}</span>
  </div>

  <!-- Add property dialog -->
  {#if showAddProp}
    <div class="add-prop-dialog">
      <input
        type="text"
        bind:value={newPropName}
        placeholder="Nom de la colonne"
        onkeydown={(e) => e.key === 'Enter' && addProperty()}
      />
      <button class="btn-add" onclick={addProperty}>Ajouter</button>
      <button class="btn-cancel" onclick={() => showAddProp = false}>Annuler</button>
    </div>
  {/if}

  <!-- Table -->
  {#if features.length === 0}
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
      <p>Aucune entité</p>
      <span>Dessinez des formes sur la carte</span>
    </div>
  {:else}
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th class="col-actions"></th>
            <th class="col-id">ID</th>
            <th class="col-type">Type</th>
            <th class="col-number">Surface (m²)</th>
            <th class="col-number">Longueur (m)</th>
            {#each propertyColumns() as col}
              <th>{col}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each paginatedFeatures as row (row.id)}
            <tr
              class:selected={selectedIds.has(row.id)}
              onclick={(e) => handleRowClick(row, e)}
            >
              <td class="col-actions">
                <button
                  class="zoom-btn"
                  onclick={(e) => { e.stopPropagation(); zoomToFeature(row); }}
                  title="Zoomer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </button>
              </td>
              <td class="col-id">{row.id}</td>
              <td class="col-type">
                <span class="geom-badge" data-type={row.type.toLowerCase()}>
                  {row.type}
                </span>
              </td>
              <td class="col-number">{formatNumber(row.area)}</td>
              <td class="col-number">{formatNumber(row.length)}</td>
              {#each propertyColumns() as col}
                <td
                  class="editable"
                  ondblclick={() => handleCellDoubleClick(row, col)}
                >
                  {#if editingCell?.id === row.id && editingCell?.prop === col}
                    <input
                      type="text"
                      class="cell-input"
                      bind:value={editValue}
                      onkeydown={handleEditKeydown}
                      onblur={saveEdit}
                    />
                  {:else}
                    {row.properties[col] ?? ''}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="pagination">
        <button
          class="page-btn"
          disabled={currentPage === 1}
          onclick={() => currentPage = 1}
        >
          ««
        </button>
        <button
          class="page-btn"
          disabled={currentPage === 1}
          onclick={() => currentPage--}
        >
          «
        </button>
        <span class="page-info">
          Page {currentPage} / {totalPages}
        </span>
        <button
          class="page-btn"
          disabled={currentPage === totalPages}
          onclick={() => currentPage++}
        >
          »
        </button>
        <button
          class="page-btn"
          disabled={currentPage === totalPages}
          onclick={() => currentPage = totalPages}
        >
          »»
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .attribute-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Toolbar */
  .panel-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-tertiary, rgba(0, 0, 0, 0.2));
  }

  .tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tool-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
  }

  .tool-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tool-btn.danger:hover:not(:disabled) {
    background: rgba(255, 107, 107, 0.2);
    border-color: #ff6b6b;
    color: #ff6b6b;
  }

  .tool-btn svg {
    width: 14px;
    height: 14px;
  }

  .toolbar-spacer {
    flex: 1;
  }

  .feature-count {
    font-size: 11px;
    color: var(--text-muted);
    padding: 0 8px;
  }

  /* Add property dialog */
  .add-prop-dialog {
    display: flex;
    gap: 8px;
    padding: 8px;
    background: var(--bg-tertiary, rgba(0, 0, 0, 0.3));
    border-bottom: 1px solid var(--border-color);
  }

  .add-prop-dialog input {
    flex: 1;
    padding: 6px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 12px;
  }

  .btn-add, .btn-cancel {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }

  .btn-add {
    background: var(--cyber-green, #00ff88);
    color: #000;
  }

  .btn-cancel {
    background: var(--bg-secondary);
    color: var(--text-secondary);
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
  }

  .empty-state svg {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0 0 4px;
    font-weight: 500;
  }

  .empty-state span {
    font-size: 11px;
  }

  /* Table */
  .table-container {
    flex: 1;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  th, td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
    white-space: nowrap;
  }

  th {
    position: sticky;
    top: 0;
    background: var(--bg-secondary);
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
    z-index: 1;
  }

  tr:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  tr.selected {
    background: rgba(0, 255, 136, 0.1);
  }

  .col-actions {
    width: 32px;
    padding: 2px 4px;
  }

  .col-id {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--text-muted);
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .col-type {
    width: 80px;
  }

  .col-number {
    text-align: right;
    font-family: var(--font-mono, monospace);
    color: var(--text-secondary);
  }

  .geom-badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 500;
    text-transform: uppercase;
    background: var(--bg-tertiary);
    color: var(--text-muted);
  }

  .geom-badge[data-type="point"] {
    background: rgba(255, 200, 0, 0.2);
    color: #ffc800;
  }

  .geom-badge[data-type="linestring"] {
    background: rgba(0, 150, 255, 0.2);
    color: #0096ff;
  }

  .geom-badge[data-type="polygon"] {
    background: rgba(0, 255, 136, 0.2);
    color: var(--cyber-green, #00ff88);
  }

  .geom-badge[data-type="circle"] {
    background: rgba(255, 100, 200, 0.2);
    color: #ff64c8;
  }

  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: none;
    border: none;
    border-radius: 3px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .zoom-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
  }

  .zoom-btn svg {
    width: 12px;
    height: 12px;
  }

  /* Editable cells */
  .editable {
    cursor: text;
  }

  .editable:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .cell-input {
    width: 100%;
    padding: 2px 4px;
    background: var(--bg-primary);
    border: 1px solid var(--cyber-green, #00ff88);
    border-radius: 2px;
    color: var(--text-primary);
    font-size: 11px;
    outline: none;
  }

  /* Pagination */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-tertiary, rgba(0, 0, 0, 0.2));
  }

  .page-btn {
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
  }

  .page-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
  }

  .page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .page-info {
    font-size: 11px;
    color: var(--text-muted);
    padding: 0 8px;
  }
</style>
