<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { calageStore, canComputeHelmert, canComputeAffine, pointCount } from '$lib/stores/calageStore';
  import type { CalibrationPoint, TransformResult, SidebarTab } from '$lib/stores/calageStore';
  import { computeTransform, getRMSColor as getTransformRMSColor } from '$lib/services/calage';

  // Sub-components
  import ReferencePanel from './ReferencePanel.svelte';
  import SourcePanel from './SourcePanel.svelte';
  import PointsList from './PointsList.svelte';
  import ExportDialog from './ExportDialog.svelte';
  import LayersSidebar from './LayersSidebar.svelte';

  // State
  let containerEl: HTMLDivElement;
  let leftPanelWidth = $state(50); // Percentage
  let isDraggingDivider = $state(false);
  let showExportDialog = $state(false);

  // Reactive state from store
  let state = $state($calageStore);
  $effect(() => {
    state = $calageStore;
  });

  // Sidebar tab helpers
  function toggleSidebarTab(tab: SidebarTab) {
    calageStore.toggleSidebar(tab);
  }

  // File input
  let fileInput: HTMLInputElement;

  // ============================================
  // FILE IMPORT
  // ============================================

  function triggerFileImport() {
    fileInput?.click();
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (['png', 'jpg', 'jpeg', 'tiff', 'tif'].includes(ext || '')) {
      await importImage(file);
    } else if (ext === 'pdf') {
      await importPdf(file);
    } else if (ext === 'dxf') {
      await importDxf(file);
    } else {
      alert('Format non supporté. Utilisez: PNG, JPG, TIFF, PDF ou DXF');
    }

    input.value = '';
  }

  async function importImage(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        calageStore.setImportedFile({
          id: crypto.randomUUID(),
          name: file.name,
          type: 'image',
          data: e.target?.result as string,
          width: img.width,
          height: img.height
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function importPdf(file: File) {
    // TODO: Implement PDF import with pdfjs-dist
    const reader = new FileReader();
    reader.onload = (e) => {
      calageStore.setImportedFile({
        id: crypto.randomUUID(),
        name: file.name,
        type: 'pdf',
        data: e.target?.result as ArrayBuffer,
        pages: 1,
        currentPage: 1
      });
    };
    reader.readAsArrayBuffer(file);
  }

  async function importDxf(file: File) {
    // TODO: Implement DXF import with dxf-parser
    const reader = new FileReader();
    reader.onload = (e) => {
      calageStore.setImportedFile({
        id: crypto.randomUUID(),
        name: file.name,
        type: 'dxf',
        data: e.target?.result as string
      });
    };
    reader.readAsText(file);
  }

  // ============================================
  // DIVIDER RESIZE
  // ============================================

  function startDrag(e: MouseEvent) {
    isDraggingDivider = true;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
  }

  function onDrag(e: MouseEvent) {
    if (!isDraggingDivider || !containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
    leftPanelWidth = Math.max(20, Math.min(80, newWidth));
  }

  function stopDrag() {
    isDraggingDivider = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  // ============================================
  // POINT MANAGEMENT
  // ============================================

  function startAddPoint() {
    calageStore.setEditMode('addPoint');
  }

  function cancelAddPoint() {
    calageStore.cancelTempPoint();
  }

  // ============================================
  // TRANSFORMATION
  // ============================================

  function applyTransformation() {
    if (state.calibrationPoints.length < 2) {
      alert('Il faut au moins 2 points de calage');
      return;
    }

    if (state.transformType === 'affine' && state.calibrationPoints.length < 3) {
      alert('Il faut au moins 3 points pour une transformation affine');
      return;
    }

    const result = computeTransform(state.calibrationPoints, state.transformType);

    if (!result) {
      alert('Erreur lors du calcul de la transformation');
      return;
    }

    calageStore.setTransform(result);
    console.log('[Calage] Transformation applied:', state.transformType, 'RMS:', result.rms.toFixed(4), 'm');
  }

  // ============================================
  // EXPORT
  // ============================================

  function openExportDialog() {
    showExportDialog = true;
  }

  function closeExportDialog() {
    showExportDialog = false;
  }

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (state.editMode !== 'none') {
        calageStore.setEditMode('none');
      }
    }
    if (e.ctrlKey && e.key === 'z') {
      calageStore.undo();
      e.preventDefault();
    }
    if (e.ctrlKey && e.key === 'y') {
      calageStore.redo();
      e.preventDefault();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  // RMS color based on value
  function getRmsColor(rms: number | undefined): string {
    if (!rms) return 'var(--text-muted)';
    return getTransformRMSColor(rms);
  }
</script>

<div class="calage-module" bind:this={containerEl}>
  <!-- Hidden file input -->
  <input
    type="file"
    bind:this={fileInput}
    accept=".png,.jpg,.jpeg,.tiff,.tif,.pdf,.dxf"
    onchange={handleFileSelect}
    style="display: none"
  />

  <!-- ============================================ -->
  <!-- CONTROL BAR (TOP) -->
  <!-- ============================================ -->
  <div class="control-bar">
    <div class="control-section">
      <!-- Import -->
      <button class="control-btn" onclick={triggerFileImport} title="Importer un fichier">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span>Importer</span>
      </button>

      {#if state.importedFile}
        <span class="file-name" title={state.importedFile.name}>
          {state.importedFile.name}
        </span>
      {/if}
    </div>

    <div class="control-section">
      <!-- Points -->
      <button
        class="control-btn"
        class:active={state.editMode === 'addPoint'}
        onclick={startAddPoint}
        disabled={!state.importedFile}
        title="Ajouter un point de calage"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <span>Ajouter point</span>
      </button>

      <button
        class="points-badge"
        class:has-points={$pointCount > 0}
        class:active={state.sidebarOpen && state.sidebarTab === 'points'}
        onclick={() => toggleSidebarTab('points')}
        title="Voir la liste des points"
      >
        {$pointCount} point{$pointCount !== 1 ? 's' : ''}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
    </div>

    <div class="control-section">
      <!-- Transform type -->
      <select
        class="transform-select"
        bind:value={state.transformType}
        onchange={(e) => calageStore.setTransformType((e.target as HTMLSelectElement).value as 'helmert' | 'affine')}
      >
        <option value="helmert">Helmert (2+ pts)</option>
        <option value="affine">Affine (3+ pts)</option>
      </select>

      <!-- RMS display -->
      {#if state.transform}
        <div class="rms-display" style="color: {getRmsColor(state.transform.rms)}">
          RMS: {state.transform.rms.toFixed(3)}m
          {#if state.transform.rms < 0.05}
            <span class="rms-icon">✓</span>
          {:else if state.transform.rms < 0.15}
            <span class="rms-icon">⚠</span>
          {:else}
            <span class="rms-icon">✗</span>
          {/if}
        </div>
      {/if}
    </div>

    <div class="control-section actions">
      <!-- Layers toggle -->
      <button
        class="control-btn"
        class:active={state.sidebarOpen && state.sidebarTab === 'layers'}
        onclick={() => toggleSidebarTab('layers')}
        title="Couches BDCO"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <span>Couches</span>
      </button>

      <!-- Apply -->
      <button
        class="control-btn primary"
        onclick={applyTransformation}
        disabled={state.transformType === 'helmert' ? !$canComputeHelmert : !$canComputeAffine}
        title="Appliquer la transformation"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Appliquer</span>
      </button>

      <!-- Export -->
      <button
        class="control-btn"
        onclick={openExportDialog}
        disabled={!state.transform}
        title="Exporter"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>Exporter</span>
      </button>
    </div>

    <!-- Status message -->
    {#if state.editMode === 'addPoint'}
      <div class="status-message">
        {#if state.pendingStep === 'image'}
          <span class="step-badge">1/2</span> Cliquez sur le <strong>plan à caler</strong> (point source)
        {:else if state.pendingStep === 'world'}
          <span class="step-badge">2/2</span> Cliquez sur la <strong>référence</strong> (point MN95)
        {/if}
        <button class="cancel-btn" onclick={cancelAddPoint}>Annuler</button>
      </div>
    {/if}
  </div>

  <!-- ============================================ -->
  <!-- MAIN CONTENT WITH SIDEBAR IN CENTER -->
  <!-- ============================================ -->
  <div class="main-area" bind:this={containerEl}>
    <!-- LEFT PANEL: Reference -->
    <div class="panel reference-panel-wrapper" style="flex: {state.sidebarOpen ? leftPanelWidth * 0.85 : leftPanelWidth}">
      <ReferencePanel />
    </div>

    <!-- Divider 1 -->
    <div
      class="divider"
      class:dragging={isDraggingDivider}
      onmousedown={startDrag}
      role="separator"
      aria-orientation="vertical"
    >
      <div class="divider-handle"></div>
    </div>

    <!-- ============================================ -->
    <!-- CENTER SIDEBAR (between panels) -->
    <!-- ============================================ -->
    {#if state.sidebarOpen}
      <div class="center-sidebar">
        <!-- Tabs -->
        <div class="sidebar-tabs">
          <button
            class="sidebar-tab"
            class:active={state.sidebarTab === 'points'}
            onclick={() => calageStore.setSidebarTab('points')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
            </svg>
            <span>Points</span>
          </button>
          <button
            class="sidebar-tab"
            class:active={state.sidebarTab === 'layers'}
            onclick={() => calageStore.setSidebarTab('layers')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <span>Couches</span>
          </button>
          <button class="close-btn" onclick={() => calageStore.closeSidebar()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="sidebar-content">
          {#if state.sidebarTab === 'points'}
            <PointsList />
          {:else if state.sidebarTab === 'layers'}
            <LayersSidebar />
          {/if}
        </div>
      </div>

      <!-- Divider 2 (after sidebar) -->
      <div class="divider-thin"></div>
    {/if}

    <!-- RIGHT PANEL: Source -->
    <div class="panel source-panel-wrapper" style="flex: {state.sidebarOpen ? (100 - leftPanelWidth) * 0.85 : (100 - leftPanelWidth)}">
      <SourcePanel />
    </div>
  </div>

  <!-- Export Dialog -->
  <ExportDialog open={showExportDialog} onClose={closeExportDialog} />
</div>

<style>
  .calage-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--noir-profond);
    color: var(--text-primary);
    position: relative;
  }

  /* ============================================ */
  /* CONTROL BAR */
  /* ============================================ */

  .control-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
    min-height: 48px;
  }

  .control-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-section.actions {
    margin-left: auto;
  }

  .control-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 12px;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all 0.2s;
  }

  .control-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .control-btn.active {
    background: rgba(0, 255, 136, 0.15);
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .control-btn.primary {
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-color: var(--cyber-green);
  }

  .control-btn.primary:hover:not(:disabled) {
    background: var(--cyber-green-bright);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  .file-name {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .points-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .points-badge:hover {
    border-color: var(--cyber-green);
    color: var(--text-primary);
  }

  .points-badge.has-points {
    background: rgba(0, 255, 136, 0.1);
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .transform-select {
    padding: 6px 10px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 12px;
    font-family: var(--font-mono);
    cursor: pointer;
  }

  .rms-display {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 12px;
    font-family: var(--font-mono);
    font-weight: 600;
  }

  .rms-icon {
    font-size: 14px;
  }

  .status-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(0, 255, 136, 0.1);
    border: 1px solid var(--cyber-green);
    border-radius: 6px;
    font-size: 12px;
    color: var(--cyber-green);
  }

  .step-badge {
    padding: 2px 6px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-radius: 4px;
    font-weight: 700;
    font-size: 10px;
  }

  .cancel-btn {
    padding: 2px 8px;
    background: transparent;
    border: 1px solid var(--cyber-green);
    border-radius: 4px;
    color: var(--cyber-green);
    font-size: 11px;
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: rgba(0, 255, 136, 0.2);
  }

  /* ============================================ */
  /* MAIN AREA (with center sidebar) */
  /* ============================================ */

  .main-area {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .panel {
    display: flex;
    flex-direction: column;
    min-width: 200px;
    overflow: hidden;
    flex-basis: 0;
    flex-grow: 1;
  }

  .reference-panel-wrapper {
    display: flex;
    flex-direction: column;
  }

  .reference-panel-wrapper :global(.reference-panel) {
    flex: 1;
  }

  .source-panel-wrapper {
    display: flex;
    flex-direction: column;
  }

  .source-panel-wrapper :global(.source-panel) {
    flex: 1;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
  }

  .panel-header h3 {
    font-size: 12px;
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0;
  }

  .panel-btn {
    padding: 4px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .panel-btn:hover {
    background: var(--bg-hover);
    border-color: var(--border-color);
    color: var(--text-primary);
  }

  .source-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .opacity-slider {
    width: 60px;
    height: 4px;
    margin-left: 8px;
    accent-color: var(--cyber-green);
  }

  .panel-content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  /* ============================================ */
  /* DIVIDER */
  /* ============================================ */

  .divider {
    width: 6px;
    background: var(--noir-surface);
    border-left: 1px solid var(--border-color);
    border-right: 1px solid var(--border-color);
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .divider:hover,
  .divider.dragging {
    background: var(--bg-hover);
  }

  .divider-handle {
    width: 2px;
    height: 40px;
    background: var(--border-color);
    border-radius: 1px;
  }

  .divider:hover .divider-handle,
  .divider.dragging .divider-handle {
    background: var(--cyber-green);
  }

  /* ============================================ */
  /* PLACEHOLDERS */
  /* ============================================ */

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    text-align: center;
  }

  .placeholder svg {
    opacity: 0.3;
    margin-bottom: 12px;
  }

  .placeholder p {
    margin: 4px 0;
    font-size: 14px;
  }

  .placeholder .hint {
    font-size: 11px;
    opacity: 0.6;
  }

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    border: 2px dashed var(--border-color);
    border-radius: 12px;
    margin: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .drop-zone:hover {
    border-color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.05);
  }

  .drop-zone:hover svg {
    color: var(--cyber-green);
    opacity: 0.6;
  }

  .drop-zone svg {
    color: var(--text-muted);
    opacity: 0.3;
    margin-bottom: 16px;
  }

  .drop-zone p {
    margin: 4px 0;
    color: var(--text-muted);
  }

  .drop-zone .formats {
    margin-top: 12px;
    padding: 4px 12px;
    background: var(--noir-card);
    border-radius: 4px;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  /* ============================================ */
  /* CENTER SIDEBAR (between panels) */
  /* ============================================ */

  .center-sidebar {
    width: 280px;
    flex-shrink: 0;
    background: var(--noir-surface);
    border-left: 1px solid var(--border-color);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
  }

  .divider-thin {
    width: 4px;
    background: var(--noir-card);
    border-right: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .sidebar-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 8px 8px 0 8px;
    border-bottom: 1px solid var(--border-color);
    background: var(--noir-card);
  }

  .sidebar-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: -1px;
  }

  .sidebar-tab:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.03);
  }

  .sidebar-tab.active {
    color: var(--cyber-green);
    border-bottom-color: var(--cyber-green);
    background: var(--noir-surface);
  }

  .sidebar-tabs .close-btn {
    margin-left: auto;
    padding: 6px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .sidebar-tabs .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }

  .placeholder-text {
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
    padding: 20px;
  }
</style>
