<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import {
    layerSources,
    activeLayers,
    isLoadingLayers,
    layerError,
    initExternalLayers,
    toggleLayer,
    removeLayer,
    updateLayerOpacity,
    updateLayerVisibility,
    reorderLayers,
    clearAllLayers,
    type Source,
    type Category,
    type Layer,
    type ActiveLayer
  } from '$lib/services/externalLayers';

  // Map state
  let mapContainer: HTMLDivElement;
  let map: L.Map | null = null;

  // UI state
  let searchTerm = $state('');
  let showCatalog = $state(true);
  let expandedSources = $state<Set<string>>(new Set(['geo-admin']));
  let expandedCategories = $state<Set<string>>(new Set());
  let draggedIndex = $state<number | null>(null);

  // Initialize map
  onMount(() => {
    map = L.map(mapContainer, {
      center: [46.5547, 6.5547],
      zoom: 13,
      zoomControl: true
    });

    // Default basemap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    initExternalLayers(map);
  });

  onDestroy(() => {
    clearAllLayers();
    if (map) {
      map.remove();
      map = null;
    }
  });

  // Filter layers by search
  function filterLayers(layers: Layer[]): Layer[] {
    if (!searchTerm) return layers;
    const term = searchTerm.toLowerCase();
    return layers.filter(l =>
      l.name.toLowerCase().includes(term) ||
      l.description?.toLowerCase().includes(term)
    );
  }

  // Check if source has matching layers
  function hasMatchingLayers(source: Source): boolean {
    if (!searchTerm) return true;
    return source.categories.some(cat => filterLayers(cat.layers).length > 0);
  }

  // Toggle source expansion
  function toggleSource(sourceId: string) {
    const newSet = new Set(expandedSources);
    if (newSet.has(sourceId)) {
      newSet.delete(sourceId);
    } else {
      newSet.add(sourceId);
    }
    expandedSources = newSet;
  }

  // Toggle category expansion
  function toggleCategory(catId: string) {
    const newSet = new Set(expandedCategories);
    if (newSet.has(catId)) {
      newSet.delete(catId);
    } else {
      newSet.add(catId);
    }
    expandedCategories = newSet;
  }

  // Handle layer toggle
  function handleLayerToggle(layer: Layer, source: Source) {
    toggleLayer(layer, source);
  }

  // Handle visibility toggle
  function handleVisibilityToggle(layerId: string) {
    const layer = $activeLayers.find(l => l.id === layerId);
    if (layer) {
      updateLayerVisibility(layerId, !layer.visible);
    }
  }

  // Drag and drop handlers
  function handleDragStart(index: number) {
    draggedIndex = index;
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const layers = [...$activeLayers];
    const [removed] = layers.splice(draggedIndex, 1);
    layers.splice(index, 0, removed);

    const reindexed = layers.map((layer, idx) => ({
      ...layer,
      zIndex: layers.length - idx
    }));

    reorderLayers(reindexed);
    draggedIndex = index;
  }

  function handleDragEnd() {
    draggedIndex = null;
  }

  // Check if layer is active
  function isLayerActive(layerId: string): boolean {
    return $activeLayers.some(al => al.id === layerId);
  }

  // Get active layer data
  function getActiveLayer(layerId: string): ActiveLayer | undefined {
    return $activeLayers.find(al => al.id === layerId);
  }

  // Count active layers per source
  function countActiveLayers(sourceId: string): number {
    return $activeLayers.filter(al => al.sourceId === sourceId).length;
  }
</script>

<div class="external-layers-module">
  <!-- Sidebar -->
  <div class="elm-sidebar">
    <!-- Header -->
    <div class="elm-header">
      <h3>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
        Geodonnees externes
      </h3>
      <button
        class="elm-btn"
        onclick={() => showCatalog = !showCatalog}
        title={showCatalog ? 'Masquer le catalogue' : 'Afficher le catalogue'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>

    <!-- Active layers panel -->
    <div class="active-layers-panel">
      <div class="active-layers-header">
        <h4>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          Couches actives ({$activeLayers.length})
        </h4>
        {#if $activeLayers.length > 0}
          <small>Glisser pour reordonner</small>
        {/if}
      </div>

      {#if $activeLayers.length === 0}
        <div class="active-layers-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          <p>Aucune couche externe active</p>
          <small>Activez des couches depuis le catalogue ci-dessous</small>
        </div>
      {:else}
        <div class="active-layers-list">
          {#each $activeLayers as layer, index (layer.id)}
            <div
              class="active-layer-item"
              class:dragging={draggedIndex === index}
              draggable="true"
              ondragstart={() => handleDragStart(index)}
              ondragover={(e) => handleDragOver(e, index)}
              ondragend={handleDragEnd}
              style="border-left-color: {layer.sourceColor}"
            >
              <div class="active-layer-drag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                  <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                </svg>
              </div>

              <button
                class="visibility-toggle"
                class:visible={layer.visible}
                onclick={() => handleVisibilityToggle(layer.id)}
              >
                {#if layer.visible}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                {:else}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                {/if}
              </button>

              <div class="active-layer-info">
                <span class="active-layer-name">{layer.name}</span>
                <span class="active-layer-source">{layer.sourceName}</span>
              </div>

              <div class="active-layer-controls">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={layer.opacity}
                  oninput={(e) => updateLayerOpacity(layer.id, parseInt(e.currentTarget.value))}
                  class="mini-opacity-slider"
                  title="Opacite: {layer.opacity}%"
                />
                <button
                  class="remove-layer-btn"
                  onclick={() => removeLayer(layer.id)}
                  title="Retirer la couche"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Error message -->
    {#if $layerError}
      <div class="layer-error">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {$layerError}
      </div>
    {/if}

    <!-- Catalog -->
    {#if showCatalog}
      <div class="elm-catalog">
        <!-- Search -->
        <div class="elm-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Rechercher une couche..."
            bind:value={searchTerm}
            class="search-input"
          />
          {#if searchTerm}
            <button class="search-clear" onclick={() => searchTerm = ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          {/if}
        </div>

        <!-- Sources list -->
        <div class="elm-sources-list">
          {#each layerSources as source}
            {#if hasMatchingLayers(source)}
              <div class="source-section">
                <button
                  class="source-header"
                  onclick={() => toggleSource(source.id)}
                  style="border-left-color: {source.color}"
                >
                  <div class="source-header-left">
                    {#if expandedSources.has(source.id)}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    {:else}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    {/if}
                    <span class="source-icon">{source.icon}</span>
                    <span class="source-name">{source.name}</span>
                  </div>
                  <div class="source-header-right">
                    {#if countActiveLayers(source.id) > 0}
                      <span class="source-active-count" style="background-color: {source.color}">
                        {countActiveLayers(source.id)}
                      </span>
                    {/if}
                  </div>
                </button>

                {#if expandedSources.has(source.id)}
                  <div class="source-content">
                    <p class="source-description">{source.description}</p>

                    {#each source.categories as category}
                      {@const filteredLayers = filterLayers(category.layers)}
                      {#if filteredLayers.length > 0}
                        <div class="category-section">
                          <button
                            class="category-header"
                            onclick={() => toggleCategory(category.id)}
                          >
                            {#if expandedCategories.has(category.id)}
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            {:else}
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"/>
                              </svg>
                            {/if}
                            <span class="category-name">{category.name}</span>
                            {#if filteredLayers.filter(l => isLayerActive(l.id)).length > 0}
                              <span class="category-badge" style="background-color: {source.color}">
                                {filteredLayers.filter(l => isLayerActive(l.id)).length}
                              </span>
                            {/if}
                          </button>

                          {#if expandedCategories.has(category.id)}
                            <div class="category-layers">
                              {#each filteredLayers as layer}
                                {@const active = isLayerActive(layer.id)}
                                {@const activeLayer = getActiveLayer(layer.id)}
                                <div class="layer-item">
                                  <div class="layer-item-main">
                                    <button
                                      class="layer-toggle"
                                      class:active={active}
                                      onclick={() => handleLayerToggle(layer, source)}
                                      style="border-color: {active ? source.color : 'transparent'}; background-color: {active ? source.color + '20' : 'transparent'}"
                                    >
                                      {#if active}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={source.color} stroke-width="2">
                                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                          <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                      {:else}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted">
                                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                          <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                      {/if}
                                    </button>

                                    <span class="layer-name" title={layer.name}>{layer.name}</span>

                                    <div class="layer-actions">
                                      <span class="layer-type-badge">{layer.type}</span>
                                    </div>
                                  </div>

                                  {#if active && activeLayer}
                                    <div class="layer-opacity-control">
                                      <span class="opacity-label">Opacite</span>
                                      <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={activeLayer.opacity}
                                        oninput={(e) => updateLayerOpacity(layer.id, parseInt(e.currentTarget.value))}
                                        class="opacity-slider"
                                        style="accent-color: {source.color}"
                                      />
                                      <span class="opacity-value">{activeLayer.opacity}%</span>
                                    </div>
                                  {/if}
                                </div>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {/if}
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Loading indicator -->
    {#if $isLoadingLayers}
      <div class="loading-indicator">
        <div class="spinner"></div>
        Chargement...
      </div>
    {/if}
  </div>

  <!-- Map container -->
  <div class="elm-map" bind:this={mapContainer}></div>
</div>

<style>
  .external-layers-module {
    height: 100%;
    display: flex;
    background: var(--bg-primary);
  }

  .elm-sidebar {
    width: 340px;
    min-width: 340px;
    display: flex;
    flex-direction: column;
    background: var(--noir-surface);
    border-right: 1px solid var(--border-color);
    overflow: hidden;
  }

  .elm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    background: var(--noir-card);
  }

  .elm-header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .elm-header h3 svg {
    color: var(--cyber-green);
  }

  .elm-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .elm-btn:hover {
    background: var(--bg-hover);
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  /* Active layers panel */
  .active-layers-panel {
    border-bottom: 1px solid var(--border-color);
    max-height: 300px;
    overflow-y: auto;
  }

  .active-layers-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--noir-card);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
  }

  .active-layers-header h4 {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .active-layers-header small {
    font-size: 10px;
    color: var(--text-muted);
  }

  .active-layers-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    text-align: center;
    color: var(--text-muted);
  }

  .active-layers-empty svg {
    margin-bottom: 12px;
    opacity: 0.4;
  }

  .active-layers-empty p {
    margin: 0 0 4px;
    font-size: 13px;
  }

  .active-layers-empty small {
    font-size: 11px;
  }

  .active-layers-list {
    padding: 4px 0;
  }

  .active-layer-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-left: 3px solid transparent;
    transition: all 0.2s;
    cursor: grab;
  }

  .active-layer-item:hover {
    background: var(--bg-hover);
  }

  .active-layer-item.dragging {
    opacity: 0.5;
    background: var(--bg-hover);
  }

  .active-layer-drag {
    color: var(--text-muted);
    cursor: grab;
  }

  .visibility-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.2s;
  }

  .visibility-toggle.visible {
    color: var(--cyber-green);
  }

  .active-layer-info {
    flex: 1;
    min-width: 0;
  }

  .active-layer-name {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .active-layer-source {
    display: block;
    font-size: 10px;
    color: var(--text-muted);
  }

  .active-layer-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .mini-opacity-slider {
    width: 50px;
    height: 4px;
    cursor: pointer;
  }

  .remove-layer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.2s;
  }

  .remove-layer-btn:hover {
    color: var(--error);
  }

  /* Error */
  .layer-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(239, 68, 68, 0.1);
    border-bottom: 1px solid var(--error);
    color: var(--error);
    font-size: 12px;
  }

  /* Catalog */
  .elm-catalog {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .elm-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--noir-card);
    border-bottom: 1px solid var(--border-color);
  }

  .elm-search svg {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .search-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
  }

  .search-clear:hover {
    color: var(--text-primary);
  }

  .elm-sources-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  /* Source section */
  .source-section {
    margin-bottom: 4px;
  }

  .source-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-left: 3px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }

  .source-header:hover {
    background: var(--bg-hover);
  }

  .source-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .source-icon {
    font-size: 16px;
  }

  .source-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .source-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .source-active-count {
    font-size: 10px;
    font-weight: 600;
    color: white;
    padding: 2px 6px;
    border-radius: 10px;
  }

  .source-content {
    padding: 0 12px 8px 24px;
  }

  .source-description {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0 0 8px;
    padding-left: 8px;
  }

  /* Category section */
  .category-section {
    margin-bottom: 4px;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }

  .category-header:hover {
    background: var(--bg-hover);
  }

  .category-name {
    flex: 1;
    text-align: left;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .category-badge {
    font-size: 9px;
    font-weight: 600;
    color: white;
    padding: 1px 5px;
    border-radius: 8px;
  }

  .category-layers {
    padding-left: 16px;
  }

  /* Layer item */
  .layer-item {
    padding: 4px 0;
  }

  .layer-item-main {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .layer-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .layer-toggle .text-muted {
    color: var(--text-muted);
  }

  .layer-name {
    flex: 1;
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layer-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .layer-type-badge {
    font-size: 9px;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--bg-hover);
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .layer-opacity-control {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0 4px 36px;
  }

  .opacity-label {
    font-size: 10px;
    color: var(--text-muted);
  }

  .opacity-slider {
    flex: 1;
    height: 4px;
    cursor: pointer;
  }

  .opacity-value {
    font-size: 10px;
    color: var(--text-muted);
    min-width: 32px;
    text-align: right;
  }

  /* Loading */
  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color);
    border-top-color: var(--cyber-green);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Map container */
  .elm-map {
    flex: 1;
    min-width: 0;
  }

  /* Leaflet overrides */
  :global(.elm-map .leaflet-control-zoom) {
    border: 1px solid var(--border-color) !important;
    border-radius: 4px !important;
  }

  :global(.elm-map .leaflet-control-zoom a) {
    background: var(--noir-card) !important;
    color: var(--text-primary) !important;
    border-color: var(--border-color) !important;
  }

  :global(.elm-map .leaflet-control-zoom a:hover) {
    background: var(--bg-hover) !important;
    color: var(--cyber-green) !important;
  }

  :global(.elm-map .leaflet-control-attribution) {
    background: rgba(13, 17, 23, 0.9) !important;
    color: var(--text-muted) !important;
    font-size: 10px !important;
  }

  :global(.elm-map .leaflet-control-attribution a) {
    color: var(--cyber-green) !important;
  }
</style>
