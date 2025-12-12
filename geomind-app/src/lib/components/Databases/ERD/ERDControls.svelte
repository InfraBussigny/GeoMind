<script lang="ts">
  import { toPng, toSvg } from 'html-to-image';
  import { downloadDataUrl, generateExportFilename, type LayoutDirection } from './erd-utils';

  interface Props {
    layoutDirection: LayoutDirection;
    connectionId: string;
    onLayoutChange: (direction: LayoutDirection) => void;
    onFitView: () => void;
    onResetPositions: () => void;
  }

  let { layoutDirection, connectionId, onLayoutChange, onFitView, onResetPositions }: Props = $props();

  let exporting = $state(false);

  // Export to PNG
  async function exportPng() {
    const element = document.querySelector('.svelte-flow') as HTMLElement;
    if (!element) return;

    exporting = true;
    try {
      const dataUrl = await toPng(element, {
        backgroundColor: '#1a1a2e',
        quality: 1,
        pixelRatio: 2
      });
      downloadDataUrl(dataUrl, generateExportFilename(connectionId, 'png'));
    } catch (e) {
      console.error('[ERD] Export PNG failed:', e);
    } finally {
      exporting = false;
    }
  }

  // Export to SVG
  async function exportSvg() {
    const element = document.querySelector('.svelte-flow') as HTMLElement;
    if (!element) return;

    exporting = true;
    try {
      const dataUrl = await toSvg(element, {
        backgroundColor: '#1a1a2e'
      });
      downloadDataUrl(dataUrl, generateExportFilename(connectionId, 'svg'));
    } catch (e) {
      console.error('[ERD] Export SVG failed:', e);
    } finally {
      exporting = false;
    }
  }
</script>

<div class="erd-controls">
  <!-- Layout direction -->
  <div class="control-group">
    <span class="group-label">Layout</span>
    <div class="button-group">
      <button
        class="ctrl-btn"
        class:active={layoutDirection === 'GRID'}
        onclick={() => onLayoutChange('GRID')}
        title="Matrice (compact)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
        Grid
      </button>
      <button
        class="ctrl-btn"
        class:active={layoutDirection === 'LR'}
        onclick={() => onLayoutChange('LR')}
        title="Horizontal (gauche a droite)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
        LR
      </button>
      <button
        class="ctrl-btn"
        class:active={layoutDirection === 'TB'}
        onclick={() => onLayoutChange('TB')}
        title="Vertical (haut en bas)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12l7 7 7-7"/>
        </svg>
        TB
      </button>
    </div>
  </div>

  <!-- View controls -->
  <div class="control-group">
    <button class="ctrl-btn" onclick={onFitView} title="Ajuster la vue">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
      </svg>
      Fit
    </button>
    <button class="ctrl-btn" onclick={onResetPositions} title="Reinitialiser les positions">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
      Reset
    </button>
  </div>

  <!-- Export controls -->
  <div class="control-group">
    <span class="group-label">Export</span>
    <div class="button-group">
      <button
        class="ctrl-btn export"
        onclick={exportPng}
        disabled={exporting}
        title="Exporter en PNG"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        PNG
      </button>
      <button
        class="ctrl-btn export"
        onclick={exportSvg}
        disabled={exporting}
        title="Exporter en SVG"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        SVG
      </button>
    </div>
  </div>
</div>

<style>
  .erd-controls {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    gap: 12px;
    z-index: 10;
    background: var(--noir-card, #1e1e2e);
    border: 1px solid var(--border-color, #3a3a4a);
    border-radius: 8px;
    padding: 8px 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-group:not(:last-child) {
    padding-right: 12px;
    border-right: 1px solid var(--border-color, #3a3a4a);
  }

  .group-label {
    font-size: 10px;
    color: var(--text-muted, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .button-group {
    display: flex;
    gap: 4px;
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border: 1px solid var(--border-color, #3a3a4a);
    border-radius: 6px;
    background: var(--noir-surface, #252535);
    color: var(--text-secondary, #aaa);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .ctrl-btn:hover:not(:disabled) {
    background: var(--bg-hover, #2a2a3a);
    color: var(--cyber-green, #00ff88);
    border-color: var(--cyber-green, #00ff88);
  }

  .ctrl-btn.active {
    background: var(--cyber-green, #00ff88);
    color: var(--noir-profond, #0a0a14);
    border-color: var(--cyber-green, #00ff88);
  }

  .ctrl-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ctrl-btn svg {
    width: 14px;
    height: 14px;
  }

  .ctrl-btn.export {
    background: rgba(37, 99, 235, 0.2);
    border-color: #2563eb;
    color: #60a5fa;
  }

  .ctrl-btn.export:hover:not(:disabled) {
    background: #2563eb;
    color: white;
  }
</style>
