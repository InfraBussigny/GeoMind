<script lang="ts">
  import { onMount } from 'svelte';
  import type QGlSMap from '../QGlSMap.svelte';

  // Props
  interface Props {
    mapRef: QGlSMap | undefined;
  }
  let { mapRef }: Props = $props();

  // Page formats (dimensions in mm)
  const pageFormats = [
    { id: 'a4-landscape', label: 'A4 Paysage', width: 297, height: 210 },
    { id: 'a4-portrait', label: 'A4 Portrait', width: 210, height: 297 },
    { id: 'a3-landscape', label: 'A3 Paysage', width: 420, height: 297 },
    { id: 'a3-portrait', label: 'A3 Portrait', width: 297, height: 420 },
  ];

  // Layout state
  let selectedFormat = $state('a4-landscape');
  let title = $state('Plan de situation');
  let subtitle = $state('');
  let showLegend = $state(true);
  let showScaleBar = $state(true);
  let showNorthArrow = $state(true);
  let showDate = $state(true);
  let showProjection = $state(true);
  let margin = $state(15); // mm

  // Preview state
  let previewCanvas: HTMLCanvasElement;
  let generating = $state(false);
  let previewUrl = $state<string | null>(null);

  // Get current format
  let currentFormat = $derived(pageFormats.find(f => f.id === selectedFormat) || pageFormats[0]);

  // Scale for preview (fit in container)
  let previewScale = $derived(0.3); // 30% of actual size

  // Generate preview
  async function generatePreview() {
    if (!mapRef || !previewCanvas) return;

    generating = true;

    try {
      const map = mapRef.getMap();
      if (!map) return;

      const format = currentFormat;
      const ctx = previewCanvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size (preview scale)
      const canvasWidth = format.width * previewScale * 3.78; // mm to px at 96dpi * scale
      const canvasHeight = format.height * previewScale * 3.78;
      previewCanvas.width = canvasWidth;
      previewCanvas.height = canvasHeight;

      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Draw border
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

      // Calculate map area (with margins)
      const marginPx = margin * previewScale * 3.78;
      const headerHeight = 40 * previewScale;
      const footerHeight = 25 * previewScale;

      const mapX = marginPx;
      const mapY = marginPx + headerHeight;
      const mapWidth = canvasWidth - (2 * marginPx) - (showLegend ? 80 * previewScale : 0);
      const mapHeight = canvasHeight - (2 * marginPx) - headerHeight - footerHeight;

      // Draw map placeholder
      ctx.fillStyle = '#e8f4e8';
      ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);

      // Draw map content from OpenLayers
      const mapCanvas = map.getViewport().querySelector('canvas');
      if (mapCanvas) {
        ctx.drawImage(mapCanvas, mapX, mapY, mapWidth, mapHeight);
      }

      // Draw header
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(marginPx, marginPx, canvasWidth - 2 * marginPx, headerHeight);

      ctx.fillStyle = '#00ff88';
      ctx.font = `bold ${14 * previewScale}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(title, marginPx + 10 * previewScale, marginPx + 18 * previewScale);

      if (subtitle) {
        ctx.fillStyle = '#888';
        ctx.font = `${10 * previewScale}px Arial`;
        ctx.fillText(subtitle, marginPx + 10 * previewScale, marginPx + 32 * previewScale);
      }

      // Draw commune logo placeholder
      ctx.fillStyle = '#333';
      ctx.font = `${8 * previewScale}px Arial`;
      ctx.textAlign = 'right';
      ctx.fillText('Commune de Bussigny', canvasWidth - marginPx - 10 * previewScale, marginPx + 18 * previewScale);

      // Draw legend if enabled
      if (showLegend) {
        const legendX = canvasWidth - marginPx - 70 * previewScale;
        const legendY = mapY;
        const legendWidth = 70 * previewScale;
        const legendHeight = 100 * previewScale;

        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
        ctx.strokeStyle = '#ddd';
        ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

        ctx.fillStyle = '#333';
        ctx.font = `bold ${8 * previewScale}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('Légende', legendX + 5 * previewScale, legendY + 12 * previewScale);

        // Sample legend items
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(legendX + 5 * previewScale, legendY + 20 * previewScale, 10 * previewScale, 10 * previewScale);
        ctx.fillStyle = '#333';
        ctx.font = `${6 * previewScale}px Arial`;
        ctx.fillText('Sketches', legendX + 20 * previewScale, legendY + 28 * previewScale);
      }

      // Draw footer
      const footerY = canvasHeight - marginPx - footerHeight;
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(marginPx, footerY, canvasWidth - 2 * marginPx, footerHeight);

      ctx.fillStyle = '#666';
      ctx.font = `${7 * previewScale}px Arial`;
      ctx.textAlign = 'left';

      let footerText = [];
      if (showDate) footerText.push(`Date: ${new Date().toLocaleDateString('fr-CH')}`);
      if (showProjection) footerText.push('Projection: EPSG:2056 (MN95)');

      ctx.fillText(footerText.join(' | '), marginPx + 5 * previewScale, footerY + 15 * previewScale);

      // Draw scale bar if enabled
      if (showScaleBar) {
        const scaleX = marginPx + 5 * previewScale;
        const scaleY = footerY - 15 * previewScale;
        const scaleWidth = 50 * previewScale;

        ctx.fillStyle = '#000';
        ctx.fillRect(scaleX, scaleY, scaleWidth, 3 * previewScale);
        ctx.fillRect(scaleX, scaleY, 2, 8 * previewScale);
        ctx.fillRect(scaleX + scaleWidth, scaleY, 2, 8 * previewScale);

        ctx.font = `${6 * previewScale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('100m', scaleX + scaleWidth / 2, scaleY - 3 * previewScale);
      }

      // Draw north arrow if enabled
      if (showNorthArrow) {
        const arrowX = canvasWidth - marginPx - 20 * previewScale;
        const arrowY = footerY - 25 * previewScale;
        const arrowSize = 15 * previewScale;

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY - arrowSize);
        ctx.lineTo(arrowX - arrowSize / 3, arrowY);
        ctx.lineTo(arrowX, arrowY - arrowSize / 3);
        ctx.lineTo(arrowX + arrowSize / 3, arrowY);
        ctx.closePath();
        ctx.fillStyle = '#333';
        ctx.fill();

        ctx.font = `bold ${8 * previewScale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('N', arrowX, arrowY - arrowSize - 3 * previewScale);
      }

      // Create preview URL
      previewUrl = previewCanvas.toDataURL('image/png');

    } catch (err) {
      console.error('Preview generation error:', err);
    } finally {
      generating = false;
    }
  }

  // Export to PDF
  async function exportPDF() {
    if (!mapRef) return;

    generating = true;

    try {
      // Dynamic import jsPDF
      const { jsPDF } = await import('jspdf');

      const format = currentFormat;
      const isLandscape = format.width > format.height;
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [format.width, format.height]
      });

      // Get map canvas
      const map = mapRef.getMap();
      if (!map) return;

      const mapCanvas = map.getViewport().querySelector('canvas');
      if (!mapCanvas) return;

      // Calculate dimensions
      const headerHeight = 15;
      const footerHeight = 10;
      const legendWidth = showLegend ? 40 : 0;

      const mapX = margin;
      const mapY = margin + headerHeight;
      const mapWidth = format.width - (2 * margin) - legendWidth;
      const mapHeight = format.height - (2 * margin) - headerHeight - footerHeight;

      // Header background
      pdf.setFillColor(26, 26, 46);
      pdf.rect(margin, margin, format.width - 2 * margin, headerHeight, 'F');

      // Title
      pdf.setTextColor(0, 255, 136);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin + 5, margin + 10);

      // Subtitle
      if (subtitle) {
        pdf.setTextColor(136, 136, 136);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(subtitle, margin + 5, margin + 14);
      }

      // Commune info
      pdf.setTextColor(51, 51, 51);
      pdf.setFontSize(8);
      pdf.text('Commune de Bussigny', format.width - margin - 5, margin + 10, { align: 'right' });

      // Map image
      const mapDataUrl = mapCanvas.toDataURL('image/png');
      pdf.addImage(mapDataUrl, 'PNG', mapX, mapY, mapWidth, mapHeight);

      // Map border
      pdf.setDrawColor(0, 255, 136);
      pdf.setLineWidth(0.5);
      pdf.rect(mapX, mapY, mapWidth, mapHeight);

      // Legend
      if (showLegend) {
        const legendX = format.width - margin - legendWidth + 2;
        const legendY = mapY;

        pdf.setFillColor(245, 245, 245);
        pdf.rect(legendX, legendY, legendWidth - 2, 50, 'F');
        pdf.setDrawColor(221, 221, 221);
        pdf.rect(legendX, legendY, legendWidth - 2, 50);

        pdf.setTextColor(51, 51, 51);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Légende', legendX + 2, legendY + 6);

        // Legend items
        pdf.setFillColor(0, 255, 136);
        pdf.rect(legendX + 2, legendY + 10, 5, 5, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Sketches', legendX + 10, legendY + 14);
      }

      // Footer
      const footerY = format.height - margin - footerHeight;
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, footerY, format.width - 2 * margin, footerHeight, 'F');

      pdf.setTextColor(102, 102, 102);
      pdf.setFontSize(7);

      let footerParts = [];
      if (showDate) footerParts.push(`Date: ${new Date().toLocaleDateString('fr-CH')}`);
      if (showProjection) footerParts.push('Projection: EPSG:2056 (MN95)');
      pdf.text(footerParts.join(' | '), margin + 2, footerY + 6);

      // Scale bar
      if (showScaleBar) {
        const scaleX = margin + 2;
        const scaleY = footerY - 5;

        pdf.setFillColor(0, 0, 0);
        pdf.rect(scaleX, scaleY, 30, 1, 'F');
        pdf.rect(scaleX, scaleY - 2, 0.5, 3, 'F');
        pdf.rect(scaleX + 30, scaleY - 2, 0.5, 3, 'F');

        pdf.setFontSize(6);
        pdf.text('100m', scaleX + 15, scaleY - 3, { align: 'center' });
      }

      // North arrow
      if (showNorthArrow) {
        const arrowX = format.width - margin - 10;
        const arrowY = footerY - 10;

        pdf.setFillColor(51, 51, 51);
        pdf.triangle(arrowX, arrowY - 8, arrowX - 3, arrowY, arrowX + 3, arrowY, 'F');

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text('N', arrowX, arrowY - 10, { align: 'center' });
      }

      // GeoMind footer
      pdf.setTextColor(153, 153, 153);
      pdf.setFontSize(6);
      pdf.text('Généré par GeoMind QGlS', format.width - margin - 2, footerY + 6, { align: 'right' });

      // Save PDF
      const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);

    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      generating = false;
    }
  }

  // Generate preview on mount and when settings change
  $effect(() => {
    if (mapRef && previewCanvas) {
      // Delay to ensure map is ready
      setTimeout(generatePreview, 100);
    }
  });

  // Re-generate on settings change
  $effect(() => {
    // Track all settings
    const _ = [selectedFormat, title, subtitle, showLegend, showScaleBar, showNorthArrow, showDate, showProjection, margin];
    if (previewCanvas) {
      generatePreview();
    }
  });
</script>

<div class="print-panel">
  <header class="panel-header">
    <h4>Composeur d'impression</h4>
  </header>

  <div class="panel-content">
    <!-- Page format -->
    <div class="form-group">
      <label>Format de page</label>
      <select bind:value={selectedFormat}>
        {#each pageFormats as format}
          <option value={format.id}>{format.label}</option>
        {/each}
      </select>
    </div>

    <!-- Title -->
    <div class="form-group">
      <label>Titre</label>
      <input type="text" bind:value={title} placeholder="Titre du plan" />
    </div>

    <!-- Subtitle -->
    <div class="form-group">
      <label>Sous-titre</label>
      <input type="text" bind:value={subtitle} placeholder="Sous-titre (optionnel)" />
    </div>

    <!-- Options -->
    <div class="form-group">
      <label>Éléments</label>
      <div class="checkbox-group">
        <label class="checkbox">
          <input type="checkbox" bind:checked={showLegend} />
          <span>Légende</span>
        </label>
        <label class="checkbox">
          <input type="checkbox" bind:checked={showScaleBar} />
          <span>Barre d'échelle</span>
        </label>
        <label class="checkbox">
          <input type="checkbox" bind:checked={showNorthArrow} />
          <span>Flèche nord</span>
        </label>
        <label class="checkbox">
          <input type="checkbox" bind:checked={showDate} />
          <span>Date</span>
        </label>
        <label class="checkbox">
          <input type="checkbox" bind:checked={showProjection} />
          <span>Projection</span>
        </label>
      </div>
    </div>

    <!-- Margin -->
    <div class="form-group">
      <label>Marge: {margin}mm</label>
      <input type="range" min="5" max="30" bind:value={margin} />
    </div>

    <!-- Preview -->
    <div class="preview-section">
      <label>Aperçu</label>
      <div class="preview-container">
        <canvas bind:this={previewCanvas} class="preview-canvas"></canvas>
        {#if generating}
          <div class="preview-loading">
            <div class="spinner"></div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Export button -->
    <button class="export-btn" onclick={exportPDF} disabled={generating}>
      {#if generating}
        <div class="spinner small"></div>
        Génération...
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        Exporter PDF
      {/if}
    </button>
  </div>
</div>

<style>
  .print-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .panel-header {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .panel-header h4 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group > label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .form-group input[type="text"],
  .form-group select {
    padding: 8px 10px;
    background: var(--bg-tertiary, rgba(0, 0, 0, 0.2));
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 12px;
  }

  .form-group input[type="text"]:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--cyber-green, #00ff88);
  }

  .form-group input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: var(--border-color);
    border-radius: 2px;
    cursor: pointer;
  }

  .form-group input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: var(--cyber-green, #00ff88);
    border-radius: 50%;
    cursor: pointer;
  }

  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--bg-tertiary, rgba(0, 0, 0, 0.2));
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .checkbox:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .checkbox input {
    accent-color: var(--cyber-green, #00ff88);
  }

  .preview-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .preview-section > label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .preview-container {
    position: relative;
    background: var(--bg-tertiary, rgba(0, 0, 0, 0.2));
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
  }

  .preview-canvas {
    max-width: 100%;
    max-height: 150px;
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .preview-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 6px;
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--cyber-green, #00ff88);
    border: none;
    border-radius: 6px;
    color: #000;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .export-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .export-btn svg {
    width: 18px;
    height: 18px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: var(--cyber-green, #00ff88);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner.small {
    width: 16px;
    height: 16px;
    border-width: 2px;
    border-top-color: #000;
    border-color: rgba(0, 0, 0, 0.2);
    border-top-color: #000;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
