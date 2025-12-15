<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { calageStore } from '$lib/stores/calageStore';
  import { exportGeoreferencedData, downloadWorldFile, downloadAsJSON, exportCalibrationPointsToGeoJSON, exportImageBoundsToGeoJSON } from '$lib/services/calage';

  // Props
  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  // Store state
  let storeState: any = $state({
    transform: null,
    transformType: 'helmert',
    calibrationPoints: [],
    importedFile: null
  });

  // Store subscription
  let unsubscribeStore: (() => void) | null = null;

  onMount(() => {
    unsubscribeStore = calageStore.subscribe(s => {
      storeState = s;
    });
  });

  onDestroy(() => {
    unsubscribeStore?.();
  });

  // Export state
  let selectedFormat = $state<'geojson' | 'worldfile' | 'shapefile' | 'geopackage'>('geojson');
  let filename = $state('calage_export');
  let includeMetadata = $state(true);
  let exporting = $state(false);
  let error = $state<string | null>(null);

  // Handle export
  async function handleExport() {
    if (!storeState.transform) {
      error = 'Aucune transformation calculée';
      return;
    }

    exporting = true;
    error = null;

    try {
      switch (selectedFormat) {
        case 'geojson':
          // Export points GeoJSON
          const pointsGeoJSON = exportCalibrationPointsToGeoJSON(
            storeState.calibrationPoints,
            'EPSG:2056',
            includeMetadata ? {
              transform_type: storeState.transformType,
              rms: storeState.transform.rms,
              export_date: new Date().toISOString()
            } : undefined
          );
          downloadAsJSON(pointsGeoJSON, `${filename}_points.geojson`);

          // Export bounds if image available
          if (storeState.importedFile?.width && storeState.importedFile?.height) {
            const boundsGeoJSON = exportImageBoundsToGeoJSON(
              storeState.transform,
              storeState.importedFile.width,
              storeState.importedFile.height,
              storeState.importedFile.name,
              'EPSG:2056'
            );
            downloadAsJSON(boundsGeoJSON, `${filename}_bounds.geojson`);
          }
          break;

        case 'worldfile':
          if (!storeState.importedFile?.width || !storeState.importedFile?.height) {
            throw new Error('Dimensions de l\'image requises');
          }
          downloadWorldFile(
            storeState.transform,
            storeState.importedFile.width,
            storeState.importedFile.height,
            storeState.importedFile.name
          );
          break;

        case 'shapefile':
        case 'geopackage':
          // These require backend support - show message for now
          error = `Export ${selectedFormat.toUpperCase()} nécessite le backend. Utilisez GeoJSON pour l'instant.`;
          exporting = false;
          return;
      }

      onClose();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur lors de l\'export';
    } finally {
      exporting = false;
    }
  }

  // Format options
  const formats = [
    { id: 'geojson', name: 'GeoJSON', desc: 'Points + contour de l\'image', available: true },
    { id: 'worldfile', name: 'World File', desc: 'Fichier de géoréférencement (.pgw, .jgw)', available: !!storeState.importedFile },
    { id: 'shapefile', name: 'Shapefile', desc: 'Format ESRI (nécessite backend)', available: false },
    { id: 'geopackage', name: 'GeoPackage', desc: 'Format OGC (nécessite backend)', available: false },
  ];
</script>

{#if open}
  <div class="dialog-overlay" onclick={onClose} role="presentation">
    <div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="dialog-header">
        <h3>Exporter les données géoréférencées</h3>
        <button class="close-btn" onclick={onClose} aria-label="Fermer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="dialog-content">
        <!-- Transform info -->
        {#if storeState.transform}
          <div class="info-box">
            <div class="info-row">
              <span class="info-label">Transformation:</span>
              <span class="info-value">{storeState.transformType === 'helmert' ? 'Helmert (4 params)' : 'Affine (6 params)'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">RMS:</span>
              <span class="info-value">{(storeState.transform.rms * 100).toFixed(2)} cm</span>
            </div>
            <div class="info-row">
              <span class="info-label">Points:</span>
              <span class="info-value">{storeState.calibrationPoints.length}</span>
            </div>
          </div>
        {:else}
          <div class="warning-box">
            Aucune transformation calculée. Veuillez d'abord appliquer une transformation.
          </div>
        {/if}

        <!-- Format selection -->
        <div class="form-group">
          <label class="form-label">Format d'export</label>
          <div class="format-options">
            {#each formats as format}
              <label
                class="format-option"
                class:selected={selectedFormat === format.id}
                class:disabled={!format.available}
              >
                <input
                  type="radio"
                  name="format"
                  value={format.id}
                  bind:group={selectedFormat}
                  disabled={!format.available}
                />
                <div class="format-info">
                  <span class="format-name">{format.name}</span>
                  <span class="format-desc">{format.desc}</span>
                </div>
              </label>
            {/each}
          </div>
        </div>

        <!-- Filename -->
        <div class="form-group">
          <label class="form-label" for="filename">Nom du fichier</label>
          <input
            type="text"
            id="filename"
            class="form-input"
            bind:value={filename}
            placeholder="calage_export"
          />
        </div>

        <!-- Include metadata -->
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={includeMetadata} />
            <span>Inclure les métadonnées (RMS, transformation, date)</span>
          </label>
        </div>

        <!-- Error -->
        {#if error}
          <div class="error-box">{error}</div>
        {/if}
      </div>

      <div class="dialog-footer">
        <button class="btn btn-secondary" onclick={onClose}>Annuler</button>
        <button
          class="btn btn-primary"
          onclick={handleExport}
          disabled={!storeState.transform || exporting}
        >
          {#if exporting}
            Export en cours...
          {:else}
            Exporter
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background: var(--noir-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 480px;
    max-width: 90vw;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .dialog-content {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .info-box {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
  }

  .info-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .info-value {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .warning-box {
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid #ffc107;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
    font-size: 12px;
    color: #ffc107;
  }

  .error-box {
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid #ff4444;
    border-radius: 8px;
    padding: 12px;
    margin-top: 16px;
    font-size: 12px;
    color: #ff4444;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .format-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .format-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .format-option:hover:not(.disabled) {
    border-color: var(--cyber-green);
  }

  .format-option.selected {
    background: rgba(0, 255, 136, 0.1);
    border-color: var(--cyber-green);
  }

  .format-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .format-option input {
    margin-top: 2px;
    accent-color: var(--cyber-green);
  }

  .format-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .format-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .format-desc {
    font-size: 11px;
    color: var(--text-muted);
  }

  .form-input {
    width: 100%;
    padding: 10px 12px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: var(--font-mono);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--cyber-green);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .checkbox-label input {
    accent-color: var(--cyber-green);
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-color);
  }

  .btn {
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn-secondary:hover {
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .btn-primary {
    background: var(--cyber-green);
    border: 1px solid var(--cyber-green);
    color: var(--noir-profond);
  }

  .btn-primary:hover:not(:disabled) {
    box-shadow: 0 0 12px var(--cyber-green-glow);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
