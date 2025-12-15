<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import QGlSMap from './QGlSMap.svelte';
  import QGlSToolbar from './QGlSToolbar.svelte';
  import LayerPanel from './panels/LayerPanel.svelte';
  import StylePanel from './panels/StylePanel.svelte';
  import ProcessingPanel from './panels/ProcessingPanel.svelte';
  import ImportExportPanel from './panels/ImportExportPanel.svelte';
  import { layers, selectedLayerId } from '$lib/stores/qgls/layerStore';
  import { currentTool } from '$lib/stores/qgls/toolStore';

  // Handle processing operations
  function handleProcess(operation: string, params: any) {
    mapComponent?.runProcessing(operation, params);
  }

  // Panel state
  type PanelType = 'layers' | 'style' | 'processing' | 'export';
  let activePanel = $state<PanelType>('layers');
  let panelCollapsed = $state(false);

  // Map reference
  let mapComponent: QGlSMap;

  // Panel tabs
  const panels: { id: PanelType; label: string; icon: string }[] = [
    { id: 'layers', label: 'Couches', icon: 'layers' },
    { id: 'style', label: 'Style', icon: 'palette' },
    { id: 'processing', label: 'Analyse', icon: 'settings' },
    { id: 'export', label: 'I/O', icon: 'export' },
  ];

  function togglePanel() {
    panelCollapsed = !panelCollapsed;
  }
</script>

<div class="qgls-module">
  <!-- Header -->
  <header class="module-header">
    <div class="header-title">
      <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <div>
        <h1>QGlS</h1>
        <span class="subtitle">SKETCHY SKETCHING</span>
      </div>
    </div>
    <div class="header-controls">
      <span class="layer-count">{$layers.length} couche{$layers.length !== 1 ? 's' : ''}</span>
    </div>
  </header>

  <!-- Toolbar -->
  <QGlSToolbar bind:mapRef={mapComponent} />

  <!-- Main content -->
  <div class="qgls-content">
    <!-- Side panel -->
    <aside class="qgls-panel" class:collapsed={panelCollapsed}>
      <div class="panel-tabs">
        {#each panels as panel}
          <button
            class="panel-tab"
            class:active={activePanel === panel.id}
            onclick={() => activePanel = panel.id}
            title={panel.label}
          >
            {#if panel.id === 'layers'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            {:else if panel.id === 'style'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="13.5" cy="6.5" r="2.5"/>
                <circle cx="17.5" cy="10.5" r="2.5"/>
                <circle cx="8.5" cy="7.5" r="2.5"/>
                <circle cx="6.5" cy="12.5" r="2.5"/>
                <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/>
              </svg>
            {:else if panel.id === 'processing'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            {:else if panel.id === 'export'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            {/if}
            <span class="tab-label">{panel.label}</span>
          </button>
        {/each}
      </div>

      <div class="panel-content">
        {#if activePanel === 'layers'}
          <LayerPanel />
        {:else if activePanel === 'style'}
          <StylePanel />
        {:else if activePanel === 'processing'}
          <ProcessingPanel onProcess={handleProcess} />
        {:else if activePanel === 'export'}
          <ImportExportPanel mapRef={mapComponent} />
        {/if}
      </div>

      <button class="panel-toggle" onclick={togglePanel}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if panelCollapsed}
            <polyline points="9 18 15 12 9 6"/>
          {:else}
            <polyline points="15 18 9 12 15 6"/>
          {/if}
        </svg>
      </button>
    </aside>

    <!-- Map -->
    <main class="qgls-map-container">
      <QGlSMap bind:this={mapComponent} />
    </main>
  </div>
</div>

<style>
  .qgls-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  /* Header */
  .module-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon {
    width: 32px;
    height: 32px;
    color: var(--cyber-green, #00ff88);
  }

  .header-title h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    font-family: var(--font-mono, monospace);
  }

  .subtitle {
    font-size: 11px;
    color: var(--text-muted);
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .layer-count {
    font-size: 12px;
    color: var(--text-secondary);
    background: var(--bg-tertiary, rgba(0,0,0,0.2));
    padding: 4px 8px;
    border-radius: 4px;
  }

  /* Content layout */
  .qgls-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* Side panel */
  .qgls-panel {
    display: flex;
    flex-direction: column;
    width: 280px;
    min-width: 280px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    transition: width 0.2s ease, min-width 0.2s ease;
    position: relative;
  }

  .qgls-panel.collapsed {
    width: 48px;
    min-width: 48px;
  }

  .qgls-panel.collapsed .panel-content,
  .qgls-panel.collapsed .tab-label {
    display: none;
  }

  /* Panel tabs */
  .panel-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
  }

  .panel-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .panel-tab:hover {
    color: var(--text-primary);
    background: rgba(255,255,255,0.05);
  }

  .panel-tab.active {
    color: var(--cyber-green, #00ff88);
    border-bottom: 2px solid var(--cyber-green, #00ff88);
  }

  .panel-tab svg {
    width: 18px;
    height: 18px;
  }

  .tab-label {
    font-size: 10px;
  }

  /* Panel content */
  .panel-content {
    flex: 1;
    overflow: auto;
  }

  /* Panel toggle */
  .panel-toggle {
    position: absolute;
    right: -12px;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 48px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0 6px 6px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    color: var(--text-muted);
    transition: color 0.15s ease;
  }

  .panel-toggle:hover {
    color: var(--text-primary);
  }

  .panel-toggle svg {
    width: 14px;
    height: 14px;
  }

  /* Map container */
  .qgls-map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
</style>
