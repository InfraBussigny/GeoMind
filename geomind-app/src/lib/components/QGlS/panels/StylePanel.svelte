<script lang="ts">
  import {
    currentStyle,
    stylePresets,
    strokeDashPresets,
    recentColors,
    setFillColor,
    setStrokeColor,
    setFillOpacity,
    setStrokeWidth,
    setStrokeDash,
    setPointRadius,
    setPointShape,
    applyPreset,
    type SketchStyle
  } from '$lib/stores/qgls/styleStore';

  // Color picker state
  let showFillPicker = $state(false);
  let showStrokePicker = $state(false);

  // Common colors palette
  const colorPalette = [
    '#00ff88', '#00cc66', '#009944', // Greens
    '#ff4444', '#cc0000', '#990000', // Reds
    '#4488ff', '#2266cc', '#004499', // Blues
    '#ff9900', '#ff6600', '#cc4400', // Oranges
    '#9944ff', '#7722dd', '#5500aa', // Purples
    '#ffff00', '#ffcc00', '#ff9900', // Yellows
    '#ffffff', '#cccccc', '#888888', '#444444', '#000000' // Grays
  ];

  function handleFillColorChange(color: string) {
    setFillColor(color);
    showFillPicker = false;
  }

  function handleStrokeColorChange(color: string) {
    setStrokeColor(color);
    showStrokePicker = false;
  }

  function getDashPreviewStyle(dash: number[]): string {
    if (dash.length === 0) return 'none';
    return dash.join(',');
  }
</script>

<div class="style-panel">
  <!-- Presets -->
  <div class="style-section">
    <div class="section-header">Presets</div>
    <div class="presets-grid">
      {#each stylePresets as preset}
        <button
          class="preset-btn"
          title={preset.name}
          onclick={() => applyPreset(preset.name)}
        >
          <div
            class="preset-preview"
            style="
              background: {preset.style.fillColor};
              opacity: {preset.style.fillOpacity + 0.3};
              border: {preset.style.strokeWidth}px solid {preset.style.strokeColor};
            "
          ></div>
          <span class="preset-name">{preset.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Fill Style -->
  <div class="style-section">
    <div class="section-header">Remplissage</div>

    <div class="style-row">
      <span class="style-label">Couleur</span>
      <div class="color-control">
        <button
          class="color-swatch"
          style="background: {$currentStyle.fillColor}"
          onclick={() => showFillPicker = !showFillPicker}
        ></button>
        <input
          type="text"
          class="color-input"
          value={$currentStyle.fillColor}
          onchange={(e) => setFillColor(e.currentTarget.value)}
        />
      </div>
    </div>

    {#if showFillPicker}
      <div class="color-picker">
        <div class="recent-colors">
          {#each $recentColors as color}
            <button
              class="color-chip"
              style="background: {color}"
              onclick={() => handleFillColorChange(color)}
            ></button>
          {/each}
        </div>
        <div class="color-palette">
          {#each colorPalette as color}
            <button
              class="color-chip"
              style="background: {color}"
              onclick={() => handleFillColorChange(color)}
            ></button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="style-row">
      <span class="style-label">Opacité</span>
      <div class="slider-control">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={$currentStyle.fillOpacity}
          oninput={(e) => setFillOpacity(parseFloat(e.currentTarget.value))}
        />
        <span class="slider-value">{Math.round($currentStyle.fillOpacity * 100)}%</span>
      </div>
    </div>
  </div>

  <!-- Stroke Style -->
  <div class="style-section">
    <div class="section-header">Contour</div>

    <div class="style-row">
      <span class="style-label">Couleur</span>
      <div class="color-control">
        <button
          class="color-swatch"
          style="background: {$currentStyle.strokeColor}"
          onclick={() => showStrokePicker = !showStrokePicker}
        ></button>
        <input
          type="text"
          class="color-input"
          value={$currentStyle.strokeColor}
          onchange={(e) => setStrokeColor(e.currentTarget.value)}
        />
      </div>
    </div>

    {#if showStrokePicker}
      <div class="color-picker">
        <div class="recent-colors">
          {#each $recentColors as color}
            <button
              class="color-chip"
              style="background: {color}"
              onclick={() => handleStrokeColorChange(color)}
            ></button>
          {/each}
        </div>
        <div class="color-palette">
          {#each colorPalette as color}
            <button
              class="color-chip"
              style="background: {color}"
              onclick={() => handleStrokeColorChange(color)}
            ></button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="style-row">
      <span class="style-label">Épaisseur</span>
      <div class="slider-control">
        <input
          type="range"
          min="0.5"
          max="10"
          step="0.5"
          value={$currentStyle.strokeWidth}
          oninput={(e) => setStrokeWidth(parseFloat(e.currentTarget.value))}
        />
        <span class="slider-value">{$currentStyle.strokeWidth}px</span>
      </div>
    </div>

    <div class="style-row">
      <span class="style-label">Style</span>
      <div class="dash-presets">
        {#each strokeDashPresets as preset}
          <button
            class="dash-btn"
            class:active={JSON.stringify($currentStyle.strokeDash) === JSON.stringify(preset.dash)}
            title={preset.name}
            onclick={() => setStrokeDash(preset.dash)}
          >
            <svg width="40" height="10" viewBox="0 0 40 10">
              <line
                x1="0" y1="5" x2="40" y2="5"
                stroke="currentColor"
                stroke-width="2"
                stroke-dasharray={getDashPreviewStyle(preset.dash)}
              />
            </svg>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Point Style -->
  <div class="style-section">
    <div class="section-header">Points</div>

    <div class="style-row">
      <span class="style-label">Taille</span>
      <div class="slider-control">
        <input
          type="range"
          min="2"
          max="20"
          step="1"
          value={$currentStyle.pointRadius}
          oninput={(e) => setPointRadius(parseInt(e.currentTarget.value))}
        />
        <span class="slider-value">{$currentStyle.pointRadius}px</span>
      </div>
    </div>

    <div class="style-row">
      <span class="style-label">Forme</span>
      <div class="shape-presets">
        <button
          class="shape-btn"
          class:active={$currentStyle.pointShape === 'circle'}
          title="Cercle"
          onclick={() => setPointShape('circle')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="6" fill="currentColor"/>
          </svg>
        </button>
        <button
          class="shape-btn"
          class:active={$currentStyle.pointShape === 'square'}
          title="Carré"
          onclick={() => setPointShape('square')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <rect x="4" y="4" width="12" height="12" fill="currentColor"/>
          </svg>
        </button>
        <button
          class="shape-btn"
          class:active={$currentStyle.pointShape === 'triangle'}
          title="Triangle"
          onclick={() => setPointShape('triangle')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <polygon points="10,3 17,17 3,17" fill="currentColor"/>
          </svg>
        </button>
        <button
          class="shape-btn"
          class:active={$currentStyle.pointShape === 'cross'}
          title="Croix"
          onclick={() => setPointShape('cross')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M8,4 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 v-4 h4 z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Preview -->
  <div class="style-section">
    <div class="section-header">Aperçu</div>
    <div class="style-preview">
      <svg width="100%" height="80" viewBox="0 0 200 80">
        <!-- Polygon preview -->
        <polygon
          points="20,60 50,20 100,30 90,70"
          fill={$currentStyle.fillColor}
          fill-opacity={$currentStyle.fillOpacity}
          stroke={$currentStyle.strokeColor}
          stroke-width={$currentStyle.strokeWidth}
          stroke-dasharray={$currentStyle.strokeDash.join(',')}
        />
        <!-- Line preview -->
        <line
          x1="110" y1="60" x2="180" y2="20"
          stroke={$currentStyle.strokeColor}
          stroke-width={$currentStyle.strokeWidth}
          stroke-dasharray={$currentStyle.strokeDash.join(',')}
        />
        <!-- Point preview -->
        {#if $currentStyle.pointShape === 'circle'}
          <circle
            cx="150" cy="55"
            r={$currentStyle.pointRadius}
            fill={$currentStyle.fillColor}
            stroke={$currentStyle.strokeColor}
            stroke-width="2"
          />
        {:else if $currentStyle.pointShape === 'square'}
          <rect
            x={150 - $currentStyle.pointRadius}
            y={55 - $currentStyle.pointRadius}
            width={$currentStyle.pointRadius * 2}
            height={$currentStyle.pointRadius * 2}
            fill={$currentStyle.fillColor}
            stroke={$currentStyle.strokeColor}
            stroke-width="2"
          />
        {:else if $currentStyle.pointShape === 'triangle'}
          <polygon
            points="{150},{55 - $currentStyle.pointRadius} {150 + $currentStyle.pointRadius},{55 + $currentStyle.pointRadius} {150 - $currentStyle.pointRadius},{55 + $currentStyle.pointRadius}"
            fill={$currentStyle.fillColor}
            stroke={$currentStyle.strokeColor}
            stroke-width="2"
          />
        {:else}
          <path
            d="M{150-$currentStyle.pointRadius/2},{55-$currentStyle.pointRadius} h{$currentStyle.pointRadius} v{$currentStyle.pointRadius/2} h{$currentStyle.pointRadius/2} v{$currentStyle.pointRadius} h-{$currentStyle.pointRadius/2} v{$currentStyle.pointRadius/2} h-{$currentStyle.pointRadius} v-{$currentStyle.pointRadius/2} h-{$currentStyle.pointRadius/2} v-{$currentStyle.pointRadius} h{$currentStyle.pointRadius/2} z"
            fill={$currentStyle.fillColor}
            stroke={$currentStyle.strokeColor}
            stroke-width="1"
          />
        {/if}
      </svg>
    </div>
  </div>
</div>

<style>
  .style-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    font-size: 12px;
  }

  .style-section {
    background: var(--bg-tertiary, rgba(0,0,0,0.2));
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px;
  }

  .section-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-color);
  }

  .presets-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .preset-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    background: rgba(255,255,255,0.05);
    border-color: var(--cyber-green);
  }

  .preset-preview {
    width: 28px;
    height: 20px;
    border-radius: 3px;
  }

  .preset-name {
    font-size: 9px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .style-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .style-row:last-child {
    margin-bottom: 0;
  }

  .style-label {
    flex: 0 0 60px;
    color: var(--text-secondary);
    font-size: 11px;
  }

  .color-control {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
  }

  .color-swatch {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    border: 2px solid var(--border-color);
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .color-swatch:hover {
    border-color: var(--text-primary);
  }

  .color-input {
    flex: 1;
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .color-picker {
    margin-top: 8px;
    padding: 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }

  .recent-colors {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .color-palette {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
  }

  .color-chip {
    width: 20px;
    height: 20px;
    border-radius: 3px;
    border: 1px solid rgba(255,255,255,0.2);
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .color-chip:hover {
    transform: scale(1.2);
    z-index: 1;
  }

  .slider-control {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .slider-control input[type="range"] {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    background: var(--bg-secondary);
    border-radius: 2px;
  }

  .slider-control input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--cyber-green);
    cursor: pointer;
  }

  .slider-value {
    flex: 0 0 40px;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-secondary);
  }

  .dash-presets, .shape-presets {
    display: flex;
    gap: 4px;
  }

  .dash-btn, .shape-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .dash-btn:hover, .shape-btn:hover {
    background: rgba(255,255,255,0.1);
    color: var(--text-primary);
  }

  .dash-btn.active, .shape-btn.active {
    background: var(--cyber-green);
    border-color: var(--cyber-green);
    color: #000;
  }

  .style-preview {
    background: var(--bg-secondary);
    border-radius: 4px;
    padding: 8px;
  }

  .style-preview svg {
    display: block;
  }
</style>
