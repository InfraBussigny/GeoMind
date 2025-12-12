<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { TableNodeData, Column } from './erd-utils';

  interface Props {
    id: string;
    data: TableNodeData;
    selected?: boolean;
  }

  let { id, data, selected = false }: Props = $props();

  // Column visibility
  const MAX_VISIBLE = 10;
  let showAllColumns = $state(false);

  let visibleColumns = $derived(
    showAllColumns
      ? data.table.columns
      : data.table.columns.slice(0, MAX_VISIBLE)
  );

  let hiddenCount = $derived(
    Math.max(0, data.table.columns.length - MAX_VISIBLE)
  );

  // Check if table has PK or FK columns
  let hasPrimaryKey = $derived(data.table.columns.some(c => c.isPrimaryKey));
  let hasForeignKey = $derived(data.table.columns.some(c => c.isForeignKey));

  // Get column badges
  function getColumnBadges(col: Column): { type: string; label: string }[] {
    const badges: { type: string; label: string }[] = [];
    if (col.isPrimaryKey) badges.push({ type: 'pk', label: 'PK' });
    if (col.isForeignKey) badges.push({ type: 'fk', label: 'FK' });
    if (col.isGeometry && col.geometry) {
      badges.push({ type: 'geo', label: col.geometry.geometryType });
    }
    return badges;
  }
</script>

<div class="table-node" class:selected>
  <!-- Handles at node level for simpler connections -->
  <Handle
    type="target"
    position={Position.Left}
    class="handle handle-left"
  />
  <Handle
    type="source"
    position={Position.Right}
    class="handle handle-right"
  />

  <!-- Header -->
  <div class="node-header">
    <span class="schema-name">{data.table.schema}.</span>
    <span class="table-name">{data.table.name}</span>
    {#if data.table.hasGeometry}
      <span class="geo-indicator" title="PostGIS">G</span>
    {/if}
  </div>

  <!-- Columns -->
  <div class="columns-container">
    {#each visibleColumns as col, i (col.name)}
      <div
        class="column-row"
        class:highlighted={data.highlightedColumns.includes(col.name)}
        class:pk={col.isPrimaryKey}
        class:fk={col.isForeignKey}
      >
        <!-- Column content -->
        <div class="col-badges">
          {#each getColumnBadges(col) as badge}
            <span class="badge {badge.type}">{badge.label}</span>
          {/each}
        </div>

        <span class="col-name" class:pk={col.isPrimaryKey} class:fk={col.isForeignKey}>
          {col.name}
        </span>

        <span class="col-type">{col.type}</span>
      </div>
    {/each}

    <!-- Show more button -->
    {#if hiddenCount > 0 && !showAllColumns}
      <button class="show-more" onclick={() => showAllColumns = true}>
        + {hiddenCount} colonnes...
      </button>
    {:else if showAllColumns && hiddenCount > 0}
      <button class="show-more" onclick={() => showAllColumns = false}>
        Reduire
      </button>
    {/if}
  </div>
</div>

<style>
  .table-node {
    background: var(--noir-card, #1e1e2e);
    border: 1px solid var(--border-color, #3a3a4a);
    border-radius: 8px;
    min-width: 250px;
    max-width: 320px;
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .table-node:hover {
    border-color: var(--cyber-green, #00ff88);
  }

  .table-node.selected {
    border-color: var(--cyber-green, #00ff88);
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
  }

  .node-header {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: white;
    padding: 10px 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .schema-name {
    opacity: 0.7;
    font-size: 11px;
  }

  .table-name {
    flex: 1;
  }

  .geo-indicator {
    background: #90EE90;
    color: #000;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
  }

  .columns-container {
    max-height: 350px;
    overflow-y: auto;
  }

  .column-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-color, #3a3a4a);
    position: relative;
    background: var(--noir-card, #1e1e2e);
    transition: background 0.15s;
  }

  .column-row:last-child {
    border-bottom: none;
  }

  .column-row:hover {
    background: var(--bg-hover, #2a2a3a);
  }

  .column-row.highlighted {
    background: rgba(135, 206, 235, 0.15);
  }

  .col-badges {
    display: flex;
    gap: 3px;
    min-width: 50px;
  }

  .badge {
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
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
    font-size: 8px;
  }

  .col-name {
    flex: 1;
    color: var(--text-primary, #e0e0e0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-name.pk {
    font-weight: 600;
    color: #ffd700;
  }

  .col-name.fk {
    color: #87ceeb;
  }

  .col-type {
    color: var(--text-muted, #888);
    font-size: 10px;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .show-more {
    width: 100%;
    padding: 8px;
    border: none;
    background: var(--bg-hover, #2a2a3a);
    color: var(--cyber-green, #00ff88);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .show-more:hover {
    background: var(--noir-surface, #252535);
  }

  /* Handle styling */
  :global(.handle) {
    width: 12px !important;
    height: 12px !important;
    border-radius: 50% !important;
    background: #87ceeb !important;
    border: 2px solid #4682b4 !important;
  }

  :global(.handle-left) {
    left: -6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
  }

  :global(.handle-right) {
    right: -6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
  }

  :global(.handle:hover) {
    background: var(--cyber-green, #00ff88) !important;
    border-color: #00cc6a !important;
  }
</style>
