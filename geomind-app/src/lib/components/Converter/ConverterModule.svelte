<script lang="ts">
  import {
    detectFormat,
    autoConvert,
    downloadConversion,
    getAvailableConversions,
    FORMAT_LABELS,
    FORMAT_CATEGORIES,
    dwgToGeojson,
    checkDwgSupport,
    type AllFormat,
    type ConversionResult
  } from '$lib/services/converter';

  // State
  let inputContent = $state('');
  let inputFilename = $state('');
  let inputFile = $state<File | null>(null); // Keep original file for binary formats
  let detectedFormat = $state<AllFormat | null>(null);
  let selectedTargetFormat = $state<AllFormat | null>(null);
  let conversionResult = $state<ConversionResult | null>(null);
  let isDragging = $state(false);
  let isConverting = $state(false);
  let error = $state<string | null>(null);
  let showPreview = $state(false);
  let copied = $state(false);
  let dwgSupported = $state<boolean | null>(null);

  // Available conversions based on detected format
  let availableTargets = $derived(
    detectedFormat ? getAvailableConversions(detectedFormat) : []
  );

  // Handle file drop
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) loadFile(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) loadFile(file);
  }

  async function loadFile(file: File) {
    error = null;
    conversionResult = null;
    inputFilename = file.name;
    inputFile = file; // Keep original for binary formats

    try {
      // Check file extension for binary formats
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'dwg') {
        // DWG is binary - don't read as text
        inputContent = `[Fichier binaire DWG - ${(file.size / 1024).toFixed(1)} KB]`;
        detectedFormat = 'dwg';

        // Check if ODA is installed
        const support = await checkDwgSupport();
        dwgSupported = support.installed;
        if (!support.installed) {
          error = `ODA File Converter requis. Téléchargez-le sur: ${support.downloadUrl}`;
        }
      } else {
        inputContent = await file.text();
        detectedFormat = detectFormat(inputContent, file.name);
      }

      selectedTargetFormat = null;
      // Auto-select first available conversion
      setTimeout(() => {
        if (availableTargets.length > 0) {
          selectedTargetFormat = availableTargets[0].to;
        }
      }, 0);
    } catch (err) {
      error = `Erreur de lecture: ${err}`;
    }
  }

  function handleTextInput() {
    if (inputContent.trim()) {
      detectedFormat = detectFormat(inputContent);
      selectedTargetFormat = null;
      conversionResult = null;
      inputFilename = '';
      if (availableTargets.length > 0) {
        selectedTargetFormat = availableTargets[0].to;
      }
    } else {
      detectedFormat = null;
    }
  }

  async function convert() {
    if (!detectedFormat || !selectedTargetFormat || !inputContent) return;
    isConverting = true;
    error = null;

    try {
      let result: ConversionResult;

      // DWG needs special handling via backend
      if (detectedFormat === 'dwg' && inputFile) {
        result = await dwgToGeojson(inputFile, inputFilename);
      } else {
        result = autoConvert(inputContent, detectedFormat!, selectedTargetFormat!, {
          filename: inputFilename ? inputFilename.replace(/\.\w+$/, `.${selectedTargetFormat}`) : `converted.${selectedTargetFormat}`,
          styling: true
        });
      }

      conversionResult = result;
      if (!result.success) {
        error = result.error || 'Erreur de conversion';
      }
    } catch (err) {
      error = `Erreur: ${err}`;
    } finally {
      isConverting = false;
    }
  }

  function download() {
    if (conversionResult?.success) {
      downloadConversion(conversionResult);
    }
  }

  async function copyToClipboard() {
    if (conversionResult?.content) {
      await navigator.clipboard.writeText(conversionResult.content);
      copied = true;
      setTimeout(() => copied = false, 2000);
    }
  }

  function clear() {
    inputContent = '';
    inputFilename = '';
    inputFile = null;
    detectedFormat = null;
    selectedTargetFormat = null;
    conversionResult = null;
    error = null;
    showPreview = false;
    dwgSupported = null;
  }

  function getFormatIcon(format: AllFormat): string {
    const icons: Record<string, string> = {
      txt: '📄', md: '📝', html: '🌐', json: '{}', csv: '📊', sql: '🗃️', py: '🐍', yaml: '⚙️', xml: '📋',
      geojson: '🗺️', wkt: '📍', kml: '🌍', gml: '🗺️', gpx: '📡', dxf: '📐', dwg: '🏗️', itf: '🇨🇭', xtf: '🇨🇭',
      pdf: '📕', docx: '📘', xlsx: '📗'
    };
    return icons[format] || '📁';
  }

  function getFormatColor(format: AllFormat): string {
    const colors: Record<string, string> = {
      geojson: '#00ff88', wkt: '#00ff88', kml: '#ff6b6b', gml: '#4ecdc4', gpx: '#45b7d1',
      json: '#ffeaa7', csv: '#a29bfe', xml: '#fd79a8', html: '#e17055',
      md: '#6c5ce7', txt: '#636e72', sql: '#0984e3', py: '#00b894',
      dxf: '#ff9f43', dwg: '#e74c3c', itf: '#ee5a24', xtf: '#ea8685'
    };
    return colors[format] || '#00ff88';
  }
</script>

<div class="converter-module">
  <!-- Header compact -->
  <header class="header">
    <div class="header-content">
      <h1>🔄 Convertisseur</h1>
      <span class="subtitle">Glissez un fichier ou collez du contenu</span>
    </div>
  </header>

  <div class="main-content">
    <!-- Colonne gauche: Input -->
    <div class="column input-column">
      <div class="column-header">
        <span class="step-badge">1</span>
        <span>Source</span>
        {#if detectedFormat}
          <span class="format-tag" style="--tag-color: {getFormatColor(detectedFormat)}">
            {getFormatIcon(detectedFormat)} {FORMAT_LABELS[detectedFormat]}
          </span>
        {/if}
        {#if inputContent}
          <button class="clear-btn" onclick={clear} title="Effacer">✕</button>
        {/if}
      </div>

      <!-- Drop zone ou contenu -->
      {#if !inputContent}
        <div
          class="drop-zone"
          class:dragging={isDragging}
          ondrop={handleDrop}
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          role="button"
          tabindex="0"
        >
          <div class="drop-content">
            <span class="drop-icon">📂</span>
            <p class="drop-text">Glissez votre fichier ici</p>
            <p class="drop-or">— ou —</p>
            <label class="browse-btn">
              <input type="file" onchange={handleFileInput} />
              Parcourir
            </label>
          </div>
        </div>
      {:else}
        <div class="file-loaded">
          <div class="file-header">
            <span class="file-icon">{getFormatIcon(detectedFormat || 'txt')}</span>
            <span class="file-name">{inputFilename || 'Contenu collé'}</span>
            <span class="file-size">{(inputContent.length / 1024).toFixed(1)} KB</span>
          </div>
          <button class="toggle-preview" onclick={() => showPreview = !showPreview}>
            {showPreview ? '▼ Masquer' : '▶ Aperçu'}
          </button>
          {#if showPreview}
            <pre class="preview-content">{inputContent.slice(0, 1000)}{inputContent.length > 1000 ? '...' : ''}</pre>
          {/if}
        </div>
      {/if}

      <!-- Zone texte alternative -->
      <div class="text-input-wrapper">
        <textarea
          bind:value={inputContent}
          placeholder="Ou collez votre contenu ici..."
          oninput={handleTextInput}
          rows="4"
        ></textarea>
      </div>
    </div>

    <!-- Colonne centrale: Conversion -->
    <div class="column convert-column">
      <div class="column-header">
        <span class="step-badge">2</span>
        <span>Format cible</span>
      </div>

      {#if detectedFormat && availableTargets.length > 0}
        <div class="conversion-flow">
          <div class="arrow-down">↓</div>

          <div class="target-grid">
            {#each availableTargets as target}
              <button
                class="target-btn"
                class:selected={selectedTargetFormat === target.to}
                onclick={() => selectedTargetFormat = target.to}
                style="--btn-color: {getFormatColor(target.to)}"
              >
                <span class="target-icon">{getFormatIcon(target.to)}</span>
                <span class="target-name">{FORMAT_LABELS[target.to]}</span>
              </button>
            {/each}
          </div>

          <div class="arrow-down">↓</div>

          <button
            class="convert-btn"
            disabled={!selectedTargetFormat || isConverting}
            onclick={convert}
          >
            {#if isConverting}
              <span class="spinner"></span>
              Conversion...
            {:else}
              🔄 Convertir
            {/if}
          </button>
        </div>
      {:else if detectedFormat}
        <div class="no-conversion">
          <span class="warning-icon">⚠️</span>
          <p>Aucune conversion disponible pour {FORMAT_LABELS[detectedFormat]}</p>
        </div>
      {:else}
        <div class="waiting">
          <span class="waiting-icon">⏳</span>
          <p>En attente d'un fichier...</p>
        </div>
      {/if}
    </div>

    <!-- Colonne droite: Résultat -->
    <div class="column result-column">
      <div class="column-header">
        <span class="step-badge">3</span>
        <span>Résultat</span>
      </div>

      {#if conversionResult?.success}
        <div class="result-success">
          <div class="result-header">
            <span class="result-icon">{getFormatIcon(selectedTargetFormat || 'txt')}</span>
            <span class="result-name">{conversionResult.filename}</span>
          </div>

          <div class="result-actions">
            <button class="action-btn download" onclick={download}>
              💾 Télécharger
            </button>
            <button class="action-btn copy" onclick={copyToClipboard}>
              {copied ? '✓ Copié!' : '📋 Copier'}
            </button>
          </div>

          <pre class="result-preview">{conversionResult.content?.slice(0, 2000)}{conversionResult.content && conversionResult.content.length > 2000 ? '\n...(suite tronquée)' : ''}</pre>
        </div>
      {:else if conversionResult && !conversionResult.success}
        <div class="result-error">
          <span class="error-icon">❌</span>
          <p>{conversionResult.error}</p>
        </div>
      {:else}
        <div class="result-empty">
          <span class="empty-icon">📄</span>
          <p>Le résultat apparaîtra ici</p>
        </div>
      {/if}

      {#if error}
        <div class="error-banner">
          ⚠️ {error}
        </div>
      {/if}
    </div>
  </div>

  <!-- Footer avec formats supportés -->
  <footer class="formats-footer">
    <div class="format-group">
      <span class="group-label">📄 Texte</span>
      <div class="format-chips">
        {#each FORMAT_CATEGORIES.text as fmt}
          <span class="chip">{fmt.toUpperCase()}</span>
        {/each}
      </div>
    </div>
    <div class="format-group">
      <span class="group-label">🗺️ Géo</span>
      <div class="format-chips">
        {#each FORMAT_CATEGORIES.geo as fmt}
          <span class="chip geo">{fmt.toUpperCase()}</span>
        {/each}
      </div>
    </div>
  </footer>
</div>

<style>
  .converter-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--text-primary);
    overflow: hidden;
  }

  .header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .header-content {
    display: flex;
    align-items: baseline;
    gap: 1rem;
  }

  .header h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .subtitle {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .main-content {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 1px;
    background: var(--border-color);
    overflow: hidden;
  }

  .column {
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .column-header {
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    font-weight: 500;
    background: var(--bg-secondary);
  }

  .step-badge {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-color);
    color: var(--bg-primary);
    font-size: 0.75rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .format-tag {
    margin-left: auto;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    background: color-mix(in srgb, var(--tag-color) 15%, transparent);
    border: 1px solid var(--tag-color);
    color: var(--tag-color);
  }

  .clear-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1rem;
    line-height: 1;
  }

  .clear-btn:hover {
    color: #ff4444;
  }

  /* Drop Zone */
  .drop-zone {
    flex: 1;
    margin: 1rem;
    border: 2px dashed var(--border-color);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    cursor: pointer;
  }

  .drop-zone.dragging {
    border-color: var(--accent-color);
    background: rgba(0, 255, 136, 0.05);
  }

  .drop-content {
    text-align: center;
  }

  .drop-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .drop-text {
    color: var(--text-secondary);
    margin: 0.5rem 0;
  }

  .drop-or {
    color: var(--text-muted);
    font-size: 0.75rem;
    margin: 0.5rem 0;
  }

  .browse-btn {
    display: inline-block;
    padding: 0.5rem 1.5rem;
    background: var(--accent-color);
    color: var(--bg-primary);
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: transform 0.1s;
  }

  .browse-btn:hover {
    transform: scale(1.02);
  }

  .browse-btn input {
    display: none;
  }

  /* File loaded */
  .file-loaded {
    margin: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .file-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .file-icon {
    font-size: 1.5rem;
  }

  .file-name {
    flex: 1;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }

  .toggle-preview {
    margin-top: 0.5rem;
    background: none;
    border: none;
    color: var(--accent-color);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0.25rem 0;
  }

  .preview-content {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--bg-primary);
    border-radius: 4px;
    font-size: 0.7rem;
    max-height: 150px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Text input */
  .text-input-wrapper {
    padding: 0 1rem 1rem;
  }

  .text-input-wrapper textarea {
    width: 100%;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-family: 'Consolas', monospace;
    font-size: 0.8rem;
    resize: vertical;
  }

  /* Convert column */
  .convert-column {
    width: 200px;
    align-items: center;
  }

  .conversion-flow {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    gap: 0.75rem;
  }

  .arrow-down {
    font-size: 1.5rem;
    color: var(--accent-color);
  }

  .target-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .target-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .target-btn:hover {
    border-color: var(--btn-color);
  }

  .target-btn.selected {
    background: color-mix(in srgb, var(--btn-color) 15%, transparent);
    border-color: var(--btn-color);
    color: var(--btn-color);
  }

  .target-icon {
    font-size: 1rem;
  }

  .target-name {
    font-size: 0.8rem;
  }

  .convert-btn {
    width: 100%;
    padding: 0.75rem;
    background: var(--accent-color);
    color: var(--bg-primary);
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: opacity 0.2s;
  }

  .convert-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .no-conversion, .waiting {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    text-align: center;
    padding: 1rem;
  }

  .warning-icon, .waiting-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  /* Result column */
  .result-success, .result-error, .result-empty {
    flex: 1;
    margin: 1rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .result-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 8px 8px 0 0;
    border: 1px solid var(--border-color);
    border-bottom: none;
  }

  .result-icon {
    font-size: 1.25rem;
  }

  .result-name {
    font-weight: 500;
    flex: 1;
  }

  .result-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-top: none;
  }

  .action-btn {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: transform 0.1s;
  }

  .action-btn:hover {
    transform: scale(1.02);
  }

  .action-btn.download {
    background: var(--accent-color);
    color: var(--bg-primary);
  }

  .action-btn.copy {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  .result-preview {
    flex: 1;
    margin: 0;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-top: none;
    border-radius: 0 0 8px 8px;
    font-family: 'Consolas', monospace;
    font-size: 0.75rem;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .result-error {
    align-items: center;
    justify-content: center;
    color: #ff4444;
    text-align: center;
  }

  .error-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .result-empty {
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    text-align: center;
  }

  .empty-icon {
    font-size: 2rem;
    opacity: 0.5;
    margin-bottom: 0.5rem;
  }

  .error-banner {
    margin: 0 1rem 1rem;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid #ff4444;
    border-radius: 6px;
    color: #ff4444;
    font-size: 0.8rem;
  }

  /* Footer */
  .formats-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
    display: flex;
    gap: 2.5rem;
    flex-wrap: wrap;
  }

  .format-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .group-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .format-chips {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .chip {
    padding: 0.25rem 0.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: monospace;
    color: var(--text-secondary);
  }

  .chip.geo {
    border-color: var(--accent-color);
    color: var(--accent-color);
    background: rgba(0, 255, 136, 0.1);
  }

  /* Responsive */
  @media (max-width: 900px) {
    .main-content {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
    }

    .convert-column {
      width: 100%;
    }

    .conversion-flow {
      flex-direction: row;
      flex-wrap: wrap;
    }

    .arrow-down {
      transform: rotate(-90deg);
    }

    .target-grid {
      flex-direction: row;
      flex-wrap: wrap;
    }
  }
</style>
