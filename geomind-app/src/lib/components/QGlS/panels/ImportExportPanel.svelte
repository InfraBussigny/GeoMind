<script lang="ts">
  import type QGlSMap from '../QGlSMap.svelte';

  // Props
  interface Props {
    mapRef: QGlSMap | undefined;
  }
  let { mapRef }: Props = $props();

  // Import state
  let importStatus = $state<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  let importing = $state(false);

  // Export state
  let exportFormat = $state<'geojson' | 'kml' | 'gpx'>('geojson');
  let exportSelectedOnly = $state(false);

  // Supported formats
  const importFormats = [
    { ext: '.geojson', label: 'GeoJSON', desc: 'Format standard web' },
    { ext: '.json', label: 'JSON', desc: 'GeoJSON alternatif' },
    { ext: '.kml', label: 'KML', desc: 'Google Earth' },
    { ext: '.gpx', label: 'GPX', desc: 'GPS Exchange' }
  ];

  const exportFormats = [
    { value: 'geojson', label: 'GeoJSON', ext: '.geojson', desc: 'Format standard web' },
    { value: 'kml', label: 'KML', ext: '.kml', desc: 'Google Earth' },
    { value: 'gpx', label: 'GPX', ext: '.gpx', desc: 'GPS Exchange' }
  ];

  // Handle file import
  async function handleFileImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !mapRef) return;

    importing = true;
    importStatus = { message: `Import de ${file.name}...`, type: 'info' };

    try {
      const result = await mapRef.importFile(file);

      if (result.success) {
        importStatus = {
          message: `${result.count} entité${result.count > 1 ? 's' : ''} importée${result.count > 1 ? 's' : ''}`,
          type: 'success'
        };
      } else {
        importStatus = { message: result.error || 'Erreur inconnue', type: 'error' };
      }
    } catch (error) {
      importStatus = {
        message: `Erreur: ${error instanceof Error ? error.message : 'Inconnue'}`,
        type: 'error'
      };
    } finally {
      importing = false;
      input.value = ''; // Reset input
    }
  }

  // Handle export
  function handleExport() {
    if (!mapRef) return;

    const content = mapRef.exportFeatures(exportFormat, exportSelectedOnly);
    if (!content) {
      importStatus = { message: 'Aucune entité à exporter', type: 'error' };
      return;
    }

    // Create download
    const formatInfo = exportFormats.find(f => f.value === exportFormat);
    const filename = `sketches_${new Date().toISOString().slice(0, 10)}${formatInfo?.ext || '.txt'}`;
    const mimeType = exportFormat === 'geojson' ? 'application/geo+json' :
                     exportFormat === 'kml' ? 'application/vnd.google-earth.kml+xml' :
                     'application/gpx+xml';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    importStatus = { message: `Exporté vers ${filename}`, type: 'success' };
  }

  // Get counts
  $effect(() => {
    // Reactive to mapRef changes
  });

  function getTotalCount(): number {
    return mapRef?.getTotalCount() || 0;
  }

  function getSelectedCount(): number {
    return mapRef?.getSelectedCount() || 0;
  }

  // Clear status after 3s
  $effect(() => {
    if (importStatus) {
      const timeout = setTimeout(() => {
        importStatus = null;
      }, 4000);
      return () => clearTimeout(timeout);
    }
  });
</script>

<div class="import-export-panel">
  <!-- Import Section -->
  <section class="panel-section">
    <h4 class="section-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Import
    </h4>

    <div class="import-area">
      <input
        type="file"
        id="file-import"
        accept=".geojson,.json,.kml,.gpx"
        onchange={handleFileImport}
        disabled={importing}
        hidden
      />
      <label for="file-import" class="import-dropzone" class:disabled={importing}>
        {#if importing}
          <div class="spinner"></div>
          <span>Import en cours...</span>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          <span>Cliquer pour importer</span>
          <span class="formats">GeoJSON, KML, GPX</span>
        {/if}
      </label>
    </div>

    <div class="format-list">
      {#each importFormats as format}
        <div class="format-item">
          <span class="format-ext">{format.ext}</span>
          <span class="format-desc">{format.desc}</span>
        </div>
      {/each}
    </div>
  </section>

  <!-- Export Section -->
  <section class="panel-section">
    <h4 class="section-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      Export
    </h4>

    <div class="export-options">
      <label class="option-label">Format</label>
      <div class="format-buttons">
        {#each exportFormats as format}
          <button
            class="format-btn"
            class:active={exportFormat === format.value}
            onclick={() => exportFormat = format.value as 'geojson' | 'kml' | 'gpx'}
          >
            {format.label}
          </button>
        {/each}
      </div>

      <label class="checkbox-option">
        <input
          type="checkbox"
          bind:checked={exportSelectedOnly}
        />
        <span>Sélection uniquement ({getSelectedCount()} entité{getSelectedCount() !== 1 ? 's' : ''})</span>
      </label>

      <button
        class="export-btn"
        onclick={handleExport}
        disabled={getTotalCount() === 0}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Télécharger {exportFormats.find(f => f.value === exportFormat)?.ext}
      </button>

      <span class="export-info">
        {getTotalCount()} entité{getTotalCount() !== 1 ? 's' : ''} au total
      </span>
    </div>
  </section>

  <!-- Status Message -->
  {#if importStatus}
    <div class="status-message" class:success={importStatus.type === 'success'} class:error={importStatus.type === 'error'}>
      {#if importStatus.type === 'success'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      {:else if importStatus.type === 'error'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      {/if}
      <span>{importStatus.message}</span>
    </div>
  {/if}
</div>

<style>
  .import-export-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px;
    height: 100%;
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .section-title svg {
    width: 16px;
    height: 16px;
    color: var(--cyber-green, #00ff88);
  }

  /* Import Area */
  .import-area {
    display: flex;
    flex-direction: column;
  }

  .import-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 16px;
    background: var(--bg-tertiary, rgba(0, 0, 0, 0.2));
    border: 2px dashed var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  .import-dropzone:hover:not(.disabled) {
    border-color: var(--cyber-green, #00ff88);
    background: rgba(0, 255, 136, 0.05);
  }

  .import-dropzone.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .import-dropzone svg {
    width: 32px;
    height: 32px;
    color: var(--text-muted);
  }

  .import-dropzone span {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .import-dropzone .formats {
    font-size: 10px;
    color: var(--text-muted);
  }

  .format-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }

  .format-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--bg-tertiary, rgba(0, 0, 0, 0.2));
    border-radius: 4px;
    font-size: 10px;
  }

  .format-ext {
    color: var(--cyber-green, #00ff88);
    font-family: var(--font-mono, monospace);
    font-weight: 500;
  }

  .format-desc {
    color: var(--text-muted);
  }

  /* Export Options */
  .export-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .option-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .format-buttons {
    display: flex;
    gap: 4px;
  }

  .format-btn {
    flex: 1;
    padding: 8px 12px;
    background: var(--bg-tertiary, rgba(0, 0, 0, 0.2));
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .format-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
  }

  .format-btn.active {
    background: rgba(0, 255, 136, 0.15);
    border-color: var(--cyber-green, #00ff88);
    color: var(--cyber-green, #00ff88);
  }

  .checkbox-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .checkbox-option input {
    accent-color: var(--cyber-green, #00ff88);
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--cyber-green, #00ff88);
    border: none;
    border-radius: 6px;
    color: #000;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .export-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .export-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .export-btn svg {
    width: 16px;
    height: 16px;
  }

  .export-info {
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
  }

  /* Status Message */
  .status-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    animation: slideIn 0.2s ease;
  }

  .status-message.success {
    background: rgba(0, 255, 136, 0.1);
    color: var(--cyber-green, #00ff88);
  }

  .status-message.error {
    background: rgba(255, 107, 107, 0.1);
    color: #ff6b6b;
  }

  .status-message svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Spinner */
  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-top-color: var(--cyber-green, #00ff88);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
