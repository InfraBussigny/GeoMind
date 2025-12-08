<script lang="ts">
  import { onMount } from 'svelte';

  let mapContainer: HTMLDivElement;
  let selectedTool = $state('pan');

  const tools = [
    { id: 'pan', icon: '✋', label: 'Déplacer' },
    { id: 'select', icon: '🔍', label: 'Sélectionner' },
    { id: 'measure', icon: '📏', label: 'Mesurer' },
    { id: 'draw', icon: '✏️', label: 'Dessiner' },
  ];

  const layers = [
    { id: 'cadastre', name: 'Cadastre', visible: true, color: '#366092' },
    { id: 'batiments', name: 'Bâtiments', visible: true, color: '#e67e22' },
    { id: 'routes', name: 'Routes', visible: false, color: '#888888' },
    { id: 'parcelles', name: 'Parcelles', visible: true, color: '#27ae60' },
  ];

  let layerState = $state(layers.map(l => ({ ...l })));

  function toggleLayer(id: string) {
    layerState = layerState.map(l =>
      l.id === id ? { ...l, visible: !l.visible } : l
    );
  }
</script>

<div class="canvas-module">
  <div class="canvas-toolbar">
    <div class="toolbar-section">
      <span class="toolbar-label">Outils</span>
      <div class="tool-group">
        {#each tools as tool}
          <button
            class="tool-btn"
            class:active={selectedTool === tool.id}
            on:click={() => selectedTool = tool.id}
            title={tool.label}
          >
            {tool.icon}
          </button>
        {/each}
      </div>
    </div>
    <div class="toolbar-section">
      <span class="toolbar-label">Zoom</span>
      <div class="tool-group">
        <button class="tool-btn" title="Zoom +">➕</button>
        <button class="tool-btn" title="Zoom -">➖</button>
        <button class="tool-btn" title="Tout afficher">🔲</button>
      </div>
    </div>
    <div class="toolbar-spacer"></div>
    <div class="toolbar-section">
      <span class="coordinates">X: 2'538'245 | Y: 1'152'890</span>
    </div>
  </div>

  <div class="canvas-content">
    <aside class="layers-panel">
      <h3>📚 Couches</h3>
      <div class="layers-list">
        {#each layerState as layer}
          <label class="layer-item">
            <input
              type="checkbox"
              checked={layer.visible}
              on:change={() => toggleLayer(layer.id)}
            />
            <span class="layer-color" style="background: {layer.color}"></span>
            <span class="layer-name">{layer.name}</span>
          </label>
        {/each}
      </div>
      <button class="add-layer-btn">+ Ajouter une couche</button>
    </aside>

    <div class="map-container" bind:this={mapContainer}>
      <div class="map-placeholder">
        <div class="placeholder-icon">🗺️</div>
        <h2>Visualisation cartographique</h2>
        <p>Intégration OpenLayers / Leaflet à venir</p>
        <p class="hint">Les couches WMS/WFS du géoportail seront affichées ici</p>
      </div>
    </div>
  </div>
</div>

<style>
  .canvas-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .canvas-toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    background: white;
    border-bottom: 1px solid var(--border-color);
  }

  .toolbar-section {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .toolbar-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tool-group {
    display: flex;
    gap: 2px;
    background: var(--bg-secondary);
    padding: 2px;
    border-radius: var(--border-radius-sm);
  }

  .tool-btn {
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    font-size: 18px;
    transition: all var(--transition-fast);
  }

  .tool-btn:hover {
    background: white;
  }

  .tool-btn.active {
    background: var(--bleu-bussigny);
    color: white;
  }

  .toolbar-spacer {
    flex: 1;
  }

  .coordinates {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background: var(--bg-secondary);
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--border-radius-sm);
  }

  .canvas-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .layers-panel {
    width: 250px;
    background: white;
    border-right: 1px solid var(--border-color);
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
  }

  .layers-panel h3 {
    font-size: var(--font-size-md);
    color: var(--bleu-bussigny);
    margin-bottom: var(--spacing-md);
  }

  .layers-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .layer-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .layer-item:hover {
    background: var(--bg-secondary);
  }

  .layer-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
  }

  .layer-name {
    font-size: var(--font-size-sm);
  }

  .add-layer-btn {
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm);
    border: 1px dashed var(--border-color);
    background: transparent;
    border-radius: var(--border-radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .add-layer-btn:hover {
    border-color: var(--bleu-bussigny);
    color: var(--bleu-bussigny);
  }

  .map-container {
    flex: 1;
    background: #e8e8e8;
    position: relative;
  }

  .map-placeholder {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--text-secondary);
  }

  .placeholder-icon {
    font-size: 80px;
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .map-placeholder h2 {
    color: var(--bleu-bussigny);
    margin-bottom: var(--spacing-sm);
  }

  .map-placeholder .hint {
    font-size: var(--font-size-sm);
    margin-top: var(--spacing-md);
    opacity: 0.7;
  }
</style>
