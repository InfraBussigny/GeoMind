<script lang="ts">
  import { onMount } from 'svelte';
  import { calageStore } from '$lib/stores/calageStore';
  import { getConnections, getActiveConnection, type DBConnection } from '$lib/services/api';
  import bdcoLayersConfig from '$lib/config/bdcoLayers.json';

  interface BDCOLayer {
    id: string;
    name: string;
    table: string;
    schema: string;
    geometryType: string;
    style: {
      fillColor?: string;
      strokeColor?: string;
      shape?: string;
    };
    interactive?: boolean;
    snapTypes?: string[];
    snapPriority?: number;
    defaultVisible: boolean;
  }

  // Database connections
  let dbConnections = $state<DBConnection[]>([]);
  let selectedConnectionId = $state<string | null>(null);
  let loadingLayers = $state(false);

  // Store state
  let activeLayers = $state<string[]>([]);
  let unsubscribe: (() => void) | null = null;

  // BDCO layers from config
  const bdcoLayers: BDCOLayer[] = bdcoLayersConfig.layers as BDCOLayer[];

  // Categorize layers
  const interactiveLayers = bdcoLayers.filter(l => l.interactive);
  const backgroundLayers = bdcoLayers.filter(l => !l.interactive);

  // Event to notify parent of connection change
  function dispatchConnectionChange() {
    window.dispatchEvent(new CustomEvent('bdco-connection-change', {
      detail: { connectionId: selectedConnectionId }
    }));
  }

  // Toggle layer visibility
  function toggleLayer(layerId: string) {
    calageStore.toggleLayer(layerId);
    // Dispatch event to notify ReferencePanel
    window.dispatchEvent(new CustomEvent('bdco-layer-toggle', {
      detail: { layerId, connectionId: selectedConnectionId }
    }));
  }

  // Reload all layers
  function reloadAllLayers() {
    window.dispatchEvent(new CustomEvent('bdco-reload-layers', {
      detail: { connectionId: selectedConnectionId }
    }));
  }

  onMount(async () => {
    // Subscribe to store for active layers
    unsubscribe = calageStore.subscribe(s => {
      activeLayers = s.activeLayers;
    });

    // Load database connections
    try {
      dbConnections = await getConnections();
      const active = await getActiveConnection();
      if (active) {
        selectedConnectionId = active.id;
      } else if (dbConnections.length > 0) {
        selectedConnectionId = dbConnections[0].id;
      }
    } catch (err) {
      console.warn('[LayersSidebar] Could not load database connections:', err);
    }

    return () => {
      unsubscribe?.();
    };
  });
</script>

<div class="layers-sidebar-content">
  <!-- Database connection selector -->
  <div class="connection-section">
    <label class="section-label">Connexion Base de Donnees</label>
    {#if dbConnections.length > 0}
      <select
        bind:value={selectedConnectionId}
        onchange={dispatchConnectionChange}
        class="connection-select"
      >
        {#each dbConnections as conn}
          <option value={conn.id}>{conn.name} ({conn.database})</option>
        {/each}
      </select>
    {:else}
      <span class="no-connection">Aucune connexion configuree</span>
    {/if}
  </div>

  <!-- Layers list -->
  <div class="layers-list">
    {#if loadingLayers}
      <div class="loading-indicator">Chargement...</div>
    {/if}

    <!-- Interactive layers (for snapping) -->
    <div class="layer-group">
      <div class="layer-group-header">
        <span class="group-title">Couches d'accrochage</span>
        <span class="group-badge">{interactiveLayers.length}</span>
      </div>
      {#each interactiveLayers as layer}
        <label class="layer-item" class:active={activeLayers.includes(layer.id)}>
          <input
            type="checkbox"
            checked={activeLayers.includes(layer.id)}
            onchange={() => toggleLayer(layer.id)}
            disabled={!selectedConnectionId}
          />
          <span
            class="layer-color"
            class:triangle={layer.style.shape === 'triangle'}
            style="background-color: {layer.style.fillColor || layer.style.strokeColor}"
          ></span>
          <span class="layer-name">{layer.name}</span>
          {#if layer.snapTypes && layer.snapTypes.length > 0}
            <span class="snap-types" title={layer.snapTypes.join(', ')}>
              {layer.snapTypes.map(t => t === 'center' ? 'C' : t === 'node' ? 'N' : t === 'intersection' ? 'I' : t === 'lineEnd' ? 'E' : '').join('')}
            </span>
          {/if}
        </label>
      {/each}
    </div>

    <!-- Non-interactive layers (background) -->
    <div class="layer-group">
      <div class="layer-group-header">
        <span class="group-title">Fond de plan</span>
        <span class="group-badge">{backgroundLayers.length}</span>
      </div>
      {#each backgroundLayers as layer}
        <label class="layer-item" class:active={activeLayers.includes(layer.id)}>
          <input
            type="checkbox"
            checked={activeLayers.includes(layer.id)}
            onchange={() => toggleLayer(layer.id)}
            disabled={!selectedConnectionId}
          />
          <span
            class="layer-color"
            style="background-color: {layer.style.fillColor || layer.style.strokeColor}"
          ></span>
          <span class="layer-name">{layer.name}</span>
        </label>
      {/each}
    </div>
  </div>

  <!-- Actions -->
  <div class="layers-actions">
    <button
      class="reload-btn"
      onclick={reloadAllLayers}
      disabled={!selectedConnectionId || loadingLayers}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
      Recharger les couches
    </button>
  </div>

  <!-- Legend -->
  <div class="legend">
    <div class="legend-title">Types d'accrochage</div>
    <div class="legend-items">
      <span class="legend-item"><code>C</code> Centre</span>
      <span class="legend-item"><code>N</code> Noeud</span>
      <span class="legend-item"><code>I</code> Intersection</span>
      <span class="legend-item"><code>E</code> Fin de ligne</span>
    </div>
  </div>
</div>

<style>
  .layers-sidebar-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .connection-section {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .section-label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .connection-select {
    width: 100%;
    padding: 8px 10px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
  }

  .connection-select:hover {
    border-color: var(--cyber-green);
  }

  .no-connection {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
  }

  .layers-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .layer-group {
    margin-bottom: 12px;
  }

  .layer-group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    margin-bottom: 4px;
  }

  .group-title {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .group-badge {
    font-size: 9px;
    padding: 2px 5px;
    background: var(--noir-card);
    border-radius: 10px;
    color: var(--text-muted);
  }

  .layer-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-secondary);
    transition: all 0.15s;
  }

  .layer-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .layer-item.active {
    background: rgba(0, 255, 136, 0.08);
    color: var(--text-primary);
  }

  .layer-item input {
    width: 14px;
    height: 14px;
    accent-color: var(--cyber-green);
    flex-shrink: 0;
  }

  .layer-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .layer-color.triangle {
    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
    border: none;
  }

  .layer-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .snap-types {
    font-size: 9px;
    font-family: var(--font-mono);
    padding: 2px 4px;
    background: rgba(0, 255, 136, 0.15);
    color: var(--cyber-green);
    border-radius: 3px;
    letter-spacing: 1px;
  }

  .loading-indicator {
    padding: 16px;
    text-align: center;
    font-size: 11px;
    color: var(--cyber-green);
  }

  .layers-actions {
    padding: 12px;
    border-top: 1px solid var(--border-color);
  }

  .reload-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reload-btn:hover:not(:disabled) {
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .reload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .legend {
    padding: 10px 12px;
    background: var(--noir-card);
    border-top: 1px solid var(--border-color);
  }

  .legend-title {
    font-size: 9px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .legend-items {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .legend-item {
    font-size: 10px;
    color: var(--text-muted);
  }

  .legend-item code {
    display: inline-block;
    width: 14px;
    height: 14px;
    line-height: 14px;
    text-align: center;
    background: rgba(0, 255, 136, 0.15);
    color: var(--cyber-green);
    border-radius: 2px;
    font-size: 9px;
    margin-right: 2px;
  }
</style>
