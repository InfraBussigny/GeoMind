<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { calageStore } from '$lib/stores/calageStore';
  import type { CalibrationPoint, TransformResult } from '$lib/stores/calageStore';

  // Props
  interface Props {
    collapsed?: boolean;
  }

  let { collapsed = false }: Props = $props();

  // Store state
  let storeState: any = $state({
    calibrationPoints: [],
    selectedPointId: null,
    transform: null,
    transformType: 'helmert'
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

  // Get residual for a point
  function getResidual(pointId: string): { dx: number; dy: number; dist: number } | null {
    if (!storeState.transform?.residuals) return null;
    return storeState.transform.residuals.find((r: any) => r.pointId === pointId) || null;
  }

  // Get residual color based on distance
  function getResidualColor(dist: number): string {
    if (dist < 0.03) return '#00ff88';  // < 3cm - excellent
    if (dist < 0.10) return '#4ecdc4';  // < 10cm - good
    if (dist < 0.20) return '#ffc107';  // < 20cm - acceptable
    return '#ff4444';                    // > 20cm - poor
  }

  // Delete a point
  function deletePoint(pointId: string) {
    calageStore.removeCalibrationPoint(pointId);
  }

  // Select a point
  function selectPoint(pointId: string) {
    if (storeState.selectedPointId === pointId) {
      calageStore.setSelectedPoint(null);
    } else {
      calageStore.setSelectedPoint(pointId);
    }
  }

  // Format coordinate for display
  function formatCoord(value: number | undefined): string {
    if (value === undefined) return '-';
    return value.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
</script>

{#if !collapsed}
  <div class="points-list">
    <div class="list-header">
      <span class="header-title">Points de calage</span>
      <span class="point-count">{storeState.calibrationPoints.length}</span>
    </div>

    {#if storeState.calibrationPoints.length === 0}
      <div class="empty-state">
        <p>Aucun point de calage</p>
        <p class="hint">Utilisez le bouton "Ajouter point" pour créer des points</p>
      </div>
    {:else}
      <div class="points-table">
        <div class="table-header">
          <span class="col-label">Label</span>
          <span class="col-image">Image (px)</span>
          <span class="col-world">MN95 (m)</span>
          {#if storeState.transform}
            <span class="col-residual">Résidu</span>
          {/if}
          <span class="col-actions"></span>
        </div>

        {#each storeState.calibrationPoints as point, index}
          {@const residual = getResidual(point.id)}
          <div
            class="point-row"
            class:selected={point.id === storeState.selectedPointId}
            onclick={() => selectPoint(point.id)}
            role="button"
            tabindex="0"
            onkeypress={(e) => e.key === 'Enter' && selectPoint(point.id)}
          >
            <span class="col-label">
              <span class="point-number">{index + 1}</span>
              <span class="point-name">{point.label || `P${index + 1}`}</span>
            </span>

            <span class="col-image">
              <span class="coord-value">{formatCoord(point.imageX)}</span>
              <span class="coord-sep">/</span>
              <span class="coord-value">{formatCoord(point.imageY)}</span>
            </span>

            <span class="col-world">
              <span class="coord-value">{formatCoord(point.worldX)}</span>
              <span class="coord-sep">/</span>
              <span class="coord-value">{formatCoord(point.worldY)}</span>
            </span>

            {#if storeState.transform}
              <span class="col-residual">
                {#if residual}
                  <span
                    class="residual-value"
                    style="color: {getResidualColor(residual.dist)}"
                    title="dx: {residual.dx.toFixed(3)}m, dy: {residual.dy.toFixed(3)}m"
                  >
                    {(residual.dist * 100).toFixed(1)} cm
                  </span>
                {:else}
                  <span class="residual-value">-</span>
                {/if}
              </span>
            {/if}

            <span class="col-actions">
              <button
                class="action-btn delete"
                onclick={(e) => { e.stopPropagation(); deletePoint(point.id); }}
                title="Supprimer ce point"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </span>
          </div>
        {/each}
      </div>

      <!-- Summary -->
      {#if storeState.transform}
        <div class="summary">
          <div class="summary-row">
            <span class="summary-label">Transformation:</span>
            <span class="summary-value">{storeState.transformType === 'helmert' ? 'Helmert (4 params)' : 'Affine (6 params)'}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">RMS:</span>
            <span class="summary-value rms" style="color: {getResidualColor(storeState.transform.rms)}">
              {(storeState.transform.rms * 100).toFixed(2)} cm
            </span>
          </div>
          {#if storeState.transform.scale}
            <div class="summary-row">
              <span class="summary-label">Échelle:</span>
              <span class="summary-value">{storeState.transform.scale.toFixed(6)}</span>
            </div>
          {/if}
          {#if storeState.transform.rotation !== undefined}
            <div class="summary-row">
              <span class="summary-label">Rotation:</span>
              <span class="summary-value">{storeState.transform.rotation.toFixed(4)}°</span>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Actions -->
      <div class="list-actions">
        <button
          class="action-btn-full"
          onclick={() => calageStore.clearCalibrationPoints()}
          disabled={storeState.calibrationPoints.length === 0}
        >
          Tout supprimer
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .points-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--noir-card);
    border-radius: 8px;
    overflow: hidden;
  }

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
  }

  .header-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .point-count {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    text-align: center;
    color: var(--text-muted);
  }

  .empty-state p {
    margin: 4px 0;
    font-size: 13px;
  }

  .empty-state .hint {
    font-size: 11px;
    opacity: 0.7;
  }

  .points-table {
    flex: 1;
    overflow-y: auto;
  }

  .table-header {
    display: grid;
    grid-template-columns: 1fr 1.5fr 1.5fr auto 30px;
    gap: 8px;
    padding: 8px 12px;
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .table-header.with-residual {
    grid-template-columns: 1fr 1.5fr 1.5fr 80px 30px;
  }

  .point-row {
    display: grid;
    grid-template-columns: 1fr 1.5fr 1.5fr auto 30px;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
    font-size: 11px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .point-row:hover {
    background: var(--bg-hover);
  }

  .point-row.selected {
    background: rgba(0, 255, 136, 0.1);
    border-left: 2px solid var(--cyber-green);
  }

  .col-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .point-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: var(--noir-surface);
    border-radius: 50%;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .point-name {
    color: var(--text-primary);
    font-weight: 500;
  }

  .col-image, .col-world {
    display: flex;
    align-items: center;
    gap: 2px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }

  .coord-value {
    font-size: 10px;
  }

  .coord-sep {
    color: var(--text-muted);
    margin: 0 2px;
  }

  .col-residual {
    display: flex;
    align-items: center;
  }

  .residual-value {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
  }

  .col-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0.5;
    transition: all 0.2s;
  }

  .point-row:hover .action-btn {
    opacity: 1;
  }

  .action-btn:hover {
    background: var(--bg-hover);
    color: var(--error);
  }

  .summary {
    padding: 12px;
    background: var(--noir-surface);
    border-top: 1px solid var(--border-color);
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
  }

  .summary-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .summary-value {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .summary-value.rms {
    font-weight: 700;
  }

  .list-actions {
    padding: 8px 12px;
    border-top: 1px solid var(--border-color);
  }

  .action-btn-full {
    width: 100%;
    padding: 8px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn-full:hover:not(:disabled) {
    border-color: var(--error);
    color: var(--error);
    background: rgba(255, 68, 68, 0.1);
  }

  .action-btn-full:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
