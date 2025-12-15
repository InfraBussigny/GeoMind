<script lang="ts">
  import { dndzone } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import {
    layers,
    selectedLayerId,
    toggleLayerVisibility,
    removeLayer,
    setLayerOpacity,
    type QGlSLayer
  } from '$lib/stores/qgls/layerStore';

  // DnD settings
  const flipDurationMs = 200;
  let dragDisabled = false;

  // Local copy for DnD
  let items = $state<QGlSLayer[]>([]);

  // Sync with store
  $effect(() => {
    items = [...$layers].reverse(); // Reverse for visual top-to-bottom = high-to-low z-index
  });

  function handleDndConsider(e: CustomEvent<{ items: QGlSLayer[] }>) {
    items = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: QGlSLayer[] }>) {
    // Reverse back and update store
    const reordered = [...e.detail.items].reverse();
    layers.set(reordered.map((l, i) => ({ ...l, zIndex: i })));
  }

  function selectLayer(id: string) {
    selectedLayerId.set(id);
  }

  function handleOpacityChange(id: string, e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    setLayerOpacity(id, value);
  }

  function getGeometryIcon(type: string): string {
    switch (type) {
      case 'postgis': return 'database';
      case 'geojson': return 'file';
      case 'wms':
      case 'wmts': return 'globe';
      case 'sketching': return 'edit';
      default: return 'layers';
    }
  }

  // Context menu state
  let contextMenu = $state<{ x: number; y: number; layerId: string } | null>(null);

  function showContextMenu(e: MouseEvent, layerId: string) {
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY, layerId };
  }

  function hideContextMenu() {
    contextMenu = null;
  }

  function handleContextAction(action: string) {
    if (!contextMenu) return;
    const id = contextMenu.layerId;

    switch (action) {
      case 'zoom':
        // TODO: Zoom to layer extent
        break;
      case 'properties':
        // TODO: Open properties dialog
        break;
      case 'remove':
        removeLayer(id);
        break;
    }

    hideContextMenu();
  }
</script>

<svelte:window onclick={hideContextMenu} />

<div class="layer-panel">
  <header class="panel-header">
    <h3>Couches</h3>
    <div class="header-actions">
      <button class="add-btn" title="Ajouter une couche">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  </header>

  {#if items.length === 0}
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <p>Aucune couche</p>
      <span>Ajoutez une couche PostGIS ou importez un fichier</span>
    </div>
  {:else}
    <div
      class="layer-list"
      use:dndzone={{ items, flipDurationMs, dragDisabled }}
      onconsider={handleDndConsider}
      onfinalize={handleDndFinalize}
    >
      {#each items as layer (layer.id)}
        <div
          class="layer-item"
          class:selected={$selectedLayerId === layer.id}
          class:hidden={!layer.visible}
          animate:flip={{ duration: flipDurationMs }}
          onclick={() => selectLayer(layer.id)}
          oncontextmenu={(e) => showContextMenu(e, layer.id)}
          role="button"
          tabindex="0"
        >
          <button
            class="visibility-btn"
            onclick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
            title={layer.visible ? 'Masquer' : 'Afficher'}
          >
            {#if layer.visible}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            {/if}
          </button>

          <span class="layer-icon" title={layer.type}>
            {#if layer.type === 'postgis'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
            {:else if layer.type === 'sketching'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                <path d="M2 2l7.586 7.586"/>
                <circle cx="11" cy="11" r="2"/>
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            {/if}
          </span>

          <div class="layer-info">
            <span class="layer-name">{layer.name}</span>
            {#if layer.source.schema && layer.source.table}
              <span class="layer-source">{layer.source.schema}.{layer.source.table}</span>
            {/if}
          </div>

          <div class="layer-actions">
            <input
              type="range"
              class="opacity-slider"
              min="0"
              max="1"
              step="0.1"
              value={layer.opacity}
              oninput={(e) => handleOpacityChange(layer.id, e)}
              onclick={(e) => e.stopPropagation()}
              title="Opacité: {Math.round(layer.opacity * 100)}%"
            />
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Context menu -->
{#if contextMenu}
  <div
    class="context-menu"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
  >
    <button onclick={() => handleContextAction('zoom')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        <line x1="11" y1="8" x2="11" y2="14"/>
        <line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
      Zoomer sur l'étendue
    </button>
    <button onclick={() => handleContextAction('properties')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
      Propriétés
    </button>
    <div class="context-separator"></div>
    <button class="danger" onclick={() => handleContextAction('remove')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      Supprimer
    </button>
  </div>
{/if}

<style>
  .layer-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--cyber-green, #00ff88);
    border: none;
    border-radius: 4px;
    color: #000;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .add-btn:hover {
    opacity: 0.8;
  }

  .add-btn svg {
    width: 16px;
    height: 16px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
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

  .layer-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .layer-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    margin-bottom: 4px;
    background: var(--bg-tertiary, rgba(0,0,0,0.2));
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .layer-item:hover {
    background: rgba(255,255,255,0.05);
  }

  .layer-item.selected {
    border-color: var(--cyber-green, #00ff88);
    background: rgba(0, 255, 136, 0.1);
  }

  .layer-item.hidden {
    opacity: 0.5;
  }

  .visibility-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
  }

  .visibility-btn:hover {
    color: var(--text-primary);
  }

  .visibility-btn svg {
    width: 16px;
    height: 16px;
  }

  .layer-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    color: var(--text-muted);
  }

  .layer-icon svg {
    width: 16px;
    height: 16px;
  }

  .layer-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .layer-name {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layer-source {
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layer-actions {
    display: flex;
    align-items: center;
  }

  .opacity-slider {
    width: 50px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--border-color);
    border-radius: 2px;
    cursor: pointer;
  }

  .opacity-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: var(--cyber-green, #00ff88);
    border-radius: 50%;
    cursor: pointer;
  }

  /* Context menu */
  .context-menu {
    position: fixed;
    z-index: 9999;
    background: var(--bg-secondary, #1e1e2e);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 4px;
    min-width: 160px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }

  .context-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .context-menu button:hover {
    background: rgba(255,255,255,0.1);
  }

  .context-menu button.danger {
    color: #ff6b6b;
  }

  .context-menu button.danger:hover {
    background: rgba(255, 107, 107, 0.15);
  }

  .context-menu button svg {
    width: 14px;
    height: 14px;
  }

  .context-separator {
    height: 1px;
    background: var(--border-color);
    margin: 4px 0;
  }
</style>
