<script lang="ts">
  import {
    mapSourcesStore,
    layersStore,
    getWMSCapabilities,
    geocodeSwiss,
    type MapSource,
    type MapLayer,
    type WMSLayer,
    type GeocodingResult
  } from '$lib/services/mapSources';

  // Props
  interface Props {
    onLayerChange?: (layers: MapLayer[]) => void;
    onZoomTo?: (bbox: [number, number, number, number]) => void;
  }

  let { onLayerChange, onZoomTo }: Props = $props();

  // State
  let activeTab = $state<'layers' | 'sources' | 'search'>('layers');
  let sources = $state<MapSource[]>([]);
  let layers = $state<MapLayer[]>([]);

  // WMS browser
  let selectedSource = $state<MapSource | null>(null);
  let wmsLayers = $state<WMSLayer[]>([]);
  let loadingCapabilities = $state(false);
  let capabilitiesError = $state<string | null>(null);

  // Search
  let searchQuery = $state('');
  let searchResults = $state<GeocodingResult[]>([]);
  let searchLoading = $state(false);

  // Add source form
  let showAddSource = $state(false);
  let newSourceName = $state('');
  let newSourceUrl = $state('');
  let newSourceType = $state<'wms' | 'wfs' | 'xyz'>('wms');

  // Subscribe to stores
  $effect(() => {
    const unsubSources = mapSourcesStore.subscribe(s => sources = s);
    const unsubLayers = layersStore.subscribe(l => {
      layers = l;
      if (onLayerChange) onLayerChange(l);
    });

    return () => {
      unsubSources();
      unsubLayers();
    };
  });

  // Load WMS capabilities
  async function loadCapabilities(source: MapSource) {
    if (source.type !== 'wms') return;

    selectedSource = source;
    loadingCapabilities = true;
    capabilitiesError = null;
    wmsLayers = [];

    try {
      const caps = await getWMSCapabilities(source.url, source.version);
      wmsLayers = caps.layers;
    } catch (e) {
      capabilitiesError = String(e);
    } finally {
      loadingCapabilities = false;
    }
  }

  // Add layer from WMS
  function addWMSLayer(wmsLayer: WMSLayer) {
    if (!selectedSource) return;

    layersStore.addLayer({
      sourceId: selectedSource.id,
      name: wmsLayer.name,
      title: wmsLayer.title,
      abstract: wmsLayer.abstract,
      visible: true,
      opacity: 1,
      queryable: wmsLayer.queryable,
      styles: wmsLayer.styles.map(s => s.name),
      legendUrl: wmsLayer.styles[0]?.legendUrl
    });
  }

  // Remove layer
  function removeLayer(id: string) {
    layersStore.removeLayer(id);
  }

  // Toggle layer visibility
  function toggleLayerVisibility(id: string) {
    layersStore.toggleVisibility(id);
  }

  // Change opacity
  function changeOpacity(id: string, e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    layersStore.setOpacity(id, value);
  }

  // Move layer up/down
  function moveLayer(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= layers.length) return;
    layersStore.reorder(index, newIndex);
  }

  // Add custom source
  function addCustomSource() {
    if (!newSourceName || !newSourceUrl) return;

    mapSourcesStore.addSource({
      name: newSourceName,
      type: newSourceType,
      url: newSourceUrl,
      isActive: true,
      isDefault: false,
      category: 'Personnalisé'
    });

    newSourceName = '';
    newSourceUrl = '';
    showAddSource = false;
  }

  // Search location
  async function search() {
    if (!searchQuery.trim()) return;

    searchLoading = true;
    searchResults = [];

    try {
      searchResults = await geocodeSwiss(searchQuery);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      searchLoading = false;
    }
  }

  // Zoom to result
  function zoomToResult(result: GeocodingResult) {
    if (onZoomTo && result.bbox) {
      onZoomTo(result.bbox);
    }
  }

  // Get source by ID
  function getSourceName(sourceId: string): string {
    return sources.find(s => s.id === sourceId)?.name || 'Unknown';
  }

  // Group sources by category
  let sourcesByCategory = $derived(() => {
    const grouped = new Map<string, MapSource[]>();
    for (const source of sources) {
      const cat = source.category || 'Autres';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(source);
    }
    return grouped;
  });
</script>

<div class="layer-panel">
  <!-- Tabs -->
  <div class="tabs">
    <button
      class="tab"
      class:active={activeTab === 'layers'}
      onclick={() => activeTab = 'layers'}
    >
      Couches
    </button>
    <button
      class="tab"
      class:active={activeTab === 'sources'}
      onclick={() => activeTab = 'sources'}
    >
      Sources
    </button>
    <button
      class="tab"
      class:active={activeTab === 'search'}
      onclick={() => activeTab = 'search'}
    >
      Recherche
    </button>
  </div>

  <!-- Content -->
  <div class="panel-content">
    {#if activeTab === 'layers'}
      <!-- Active layers -->
      <div class="layers-list">
        {#if layers.length === 0}
          <p class="empty-message">Aucune couche active. Ajoutez des couches depuis l'onglet Sources.</p>
        {:else}
          {#each layers as layer, index}
            <div class="layer-item" class:hidden={!layer.visible}>
              <div class="layer-header">
                <button
                  class="visibility-btn"
                  onclick={() => toggleLayerVisibility(layer.id)}
                  title={layer.visible ? 'Masquer' : 'Afficher'}
                >
                  {layer.visible ? '👁️' : '👁️‍🗨️'}
                </button>
                <div class="layer-info">
                  <span class="layer-title">{layer.title}</span>
                  <span class="layer-source">{getSourceName(layer.sourceId)}</span>
                </div>
                <div class="layer-actions">
                  <button
                    class="action-btn"
                    onclick={() => moveLayer(index, 'up')}
                    disabled={index === 0}
                    title="Monter"
                  >
                    ▲
                  </button>
                  <button
                    class="action-btn"
                    onclick={() => moveLayer(index, 'down')}
                    disabled={index === layers.length - 1}
                    title="Descendre"
                  >
                    ▼
                  </button>
                  <button
                    class="action-btn delete"
                    onclick={() => removeLayer(layer.id)}
                    title="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div class="layer-controls">
                <label class="opacity-label">Opacité</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={layer.opacity}
                  oninput={(e) => changeOpacity(layer.id, e)}
                />
                <span class="opacity-value">{Math.round(layer.opacity * 100)}%</span>
              </div>
              {#if layer.legendUrl}
                <div class="layer-legend">
                  <img src={layer.legendUrl} alt="Légende" />
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

    {:else if activeTab === 'sources'}
      <!-- Sources browser -->
      <div class="sources-browser">
        <!-- Add source button -->
        <button class="add-source-btn" onclick={() => showAddSource = !showAddSource}>
          {showAddSource ? '✕ Annuler' : '+ Ajouter une source'}
        </button>

        {#if showAddSource}
          <div class="add-source-form">
            <input
              type="text"
              placeholder="Nom de la source"
              bind:value={newSourceName}
            />
            <select bind:value={newSourceType}>
              <option value="wms">WMS</option>
              <option value="wfs">WFS</option>
              <option value="xyz">XYZ Tiles</option>
            </select>
            <input
              type="text"
              placeholder="URL du service"
              bind:value={newSourceUrl}
            />
            <button class="save-btn" onclick={addCustomSource}>
              Ajouter
            </button>
          </div>
        {/if}

        <!-- Sources by category -->
        {#each [...sourcesByCategory()] as [category, categorySources]}
          <div class="source-category">
            <h4>{category}</h4>
            {#each categorySources as source}
              <div class="source-item" class:active={source.isActive}>
                <div class="source-info">
                  <span class="source-name">{source.name}</span>
                  <span class="source-type">{source.type.toUpperCase()}</span>
                </div>
                <div class="source-actions">
                  {#if source.type === 'wms'}
                    <button
                      class="browse-btn"
                      onclick={() => loadCapabilities(source)}
                      title="Parcourir les couches"
                    >
                      📂
                    </button>
                  {/if}
                  <button
                    class="toggle-btn"
                    class:active={source.isActive}
                    onclick={() => mapSourcesStore.toggleActive(source.id)}
                    title={source.isActive ? 'Désactiver' : 'Activer'}
                  >
                    {source.isActive ? '✓' : '○'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/each}

        <!-- WMS Layers browser -->
        {#if selectedSource}
          <div class="wms-browser">
            <div class="wms-header">
              <h4>Couches: {selectedSource.name}</h4>
              <button onclick={() => selectedSource = null}>✕</button>
            </div>

            {#if loadingCapabilities}
              <div class="loading">Chargement...</div>
            {:else if capabilitiesError}
              <div class="error">{capabilitiesError}</div>
            {:else}
              <div class="wms-layers">
                {#each wmsLayers as wmsLayer}
                  <div class="wms-layer-item">
                    <div class="wms-layer-info">
                      <span class="wms-layer-title">{wmsLayer.title}</span>
                      <span class="wms-layer-name">{wmsLayer.name}</span>
                    </div>
                    <button
                      class="add-layer-btn"
                      onclick={() => addWMSLayer(wmsLayer)}
                      title="Ajouter à la carte"
                    >
                      +
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'search'}
      <!-- Geocoding search -->
      <div class="search-panel">
        <div class="search-box">
          <input
            type="text"
            placeholder="Rechercher un lieu en Suisse..."
            bind:value={searchQuery}
            onkeydown={(e) => e.key === 'Enter' && search()}
          />
          <button class="search-btn" onclick={search} disabled={searchLoading}>
            {searchLoading ? '...' : '🔍'}
          </button>
        </div>

        <div class="search-results">
          {#each searchResults as result}
            <button
              class="result-item"
              onclick={() => zoomToResult(result)}
            >
              <span class="result-label">{result.label}</span>
              <span class="result-type">{result.type}</span>
            </button>
          {:else}
            {#if searchQuery && !searchLoading}
              <p class="empty-message">Aucun résultat</p>
            {:else}
              <p class="empty-message">Entrez une adresse ou un lieu pour rechercher</p>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .layer-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
    font-size: 13px;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
  }

  .tab {
    flex: 1;
    padding: 10px;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab:hover {
    background: var(--bg-hover);
  }

  .tab.active {
    color: var(--accent-primary);
    border-bottom: 2px solid var(--accent-primary);
    margin-bottom: -1px;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .empty-message {
    text-align: center;
    color: var(--text-secondary);
    font-size: 12px;
    padding: 16px;
  }

  /* Layers */
  .layers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .layer-item {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px;
  }

  .layer-item.hidden {
    opacity: 0.5;
  }

  .layer-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .visibility-btn {
    padding: 4px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 16px;
  }

  .layer-info {
    flex: 1;
    min-width: 0;
  }

  .layer-title {
    display: block;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layer-source {
    font-size: 10px;
    color: var(--text-secondary);
  }

  .layer-actions {
    display: flex;
    gap: 2px;
  }

  .action-btn {
    padding: 2px 6px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 10px;
    cursor: pointer;
  }

  .action-btn:hover:not(:disabled) {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .action-btn.delete:hover {
    border-color: #ff6b6b;
    color: #ff6b6b;
  }

  .layer-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color);
  }

  .opacity-label {
    font-size: 10px;
    color: var(--text-secondary);
  }

  .layer-controls input[type="range"] {
    flex: 1;
    height: 4px;
  }

  .opacity-value {
    font-size: 10px;
    color: var(--text-secondary);
    width: 30px;
    text-align: right;
  }

  .layer-legend {
    margin-top: 8px;
  }

  .layer-legend img {
    max-width: 100%;
    border-radius: 4px;
  }

  /* Sources */
  .sources-browser {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .add-source-btn {
    padding: 8px;
    border: 1px dashed var(--accent-primary);
    border-radius: 6px;
    background: transparent;
    color: var(--accent-primary);
    font-size: 12px;
    cursor: pointer;
  }

  .add-source-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
  }

  .add-source-form input,
  .add-source-form select {
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 12px;
  }

  .save-btn {
    padding: 8px;
    border: none;
    border-radius: 4px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    font-weight: 500;
    cursor: pointer;
  }

  .source-category h4 {
    margin: 0 0 8px 0;
    font-size: 11px;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .source-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    margin-bottom: 4px;
  }

  .source-item.active {
    border-color: var(--accent-primary);
  }

  .source-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .source-name {
    font-weight: 500;
  }

  .source-type {
    font-size: 10px;
    color: var(--text-secondary);
  }

  .source-actions {
    display: flex;
    gap: 4px;
  }

  .browse-btn,
  .toggle-btn {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background: var(--bg-secondary);
    cursor: pointer;
  }

  .toggle-btn.active {
    background: var(--accent-primary);
    color: var(--bg-primary);
    border-color: var(--accent-primary);
  }

  .wms-browser {
    margin-top: 12px;
    padding: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
  }

  .wms-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .wms-header h4 {
    margin: 0;
    font-size: 12px;
    color: var(--accent-primary);
  }

  .wms-header button {
    padding: 2px 8px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .loading,
  .error {
    padding: 16px;
    text-align: center;
    color: var(--text-secondary);
  }

  .error {
    color: #ff6b6b;
  }

  .wms-layers {
    max-height: 300px;
    overflow-y: auto;
  }

  .wms-layer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .wms-layer-item:last-child {
    border-bottom: none;
  }

  .wms-layer-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .wms-layer-title {
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wms-layer-name {
    font-size: 10px;
    color: var(--text-secondary);
    font-family: monospace;
  }

  .add-layer-btn {
    padding: 4px 12px;
    border: none;
    border-radius: 3px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    font-weight: bold;
    cursor: pointer;
  }

  /* Search */
  .search-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .search-box {
    display: flex;
    gap: 8px;
  }

  .search-box input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 13px;
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--accent-primary);
  }

  .search-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    cursor: pointer;
  }

  .search-btn:disabled {
    opacity: 0.5;
  }

  .search-results {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    cursor: pointer;
    text-align: left;
  }

  .result-item:hover {
    border-color: var(--accent-primary);
    background: var(--bg-hover);
  }

  .result-label {
    flex: 1;
    font-size: 12px;
  }

  .result-type {
    font-size: 10px;
    color: var(--text-secondary);
    padding: 2px 6px;
    background: var(--bg-secondary);
    border-radius: 3px;
  }
</style>
