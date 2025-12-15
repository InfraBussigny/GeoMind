<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { calageStore } from '$lib/stores/calageStore';
  import type { CalibrationPoint, ImportedFile } from '$lib/stores/calageStore';

  // Fabric.js types (loaded dynamically)
  type FabricCanvas = any;
  type FabricImage = any;
  let fabric: any = null;

  // PDF.js (loaded dynamically)
  let pdfjsLib: any = null;

  // State
  let canvasContainer: HTMLDivElement;
  let canvasElement: HTMLCanvasElement;
  let fabricCanvas: FabricCanvas | null = null;
  let imageObject: FabricImage | null = null;

  // UI state
  let zoom = $state(1);
  let rotation = $state(0);
  let mouseCoords = $state<{ x: number; y: number } | null>(null);

  // Store state
  let storeState: any = $state({
    editMode: 'none',
    pendingStep: null,
    calibrationPoints: [],
    selectedPointId: null,
    importedFile: null,
    sourceOpacity: 1,
    tempPoint: null
  });

  // Store subscription - handled in onMount
  let unsubscribeStore: (() => void) | null = null;

  // Initialize Fabric canvas
  async function initCanvas() {
    if (!canvasElement || fabricCanvas) return;

    // Dynamic import of Fabric.js
    const fabricModule = await import('fabric') as any;
    fabric = fabricModule.fabric || fabricModule;

    const container = canvasContainer;
    const width = container.clientWidth;
    const height = container.clientHeight;

    fabricCanvas = new fabric.Canvas(canvasElement, {
      width: width,
      height: height,
      backgroundColor: '#1a1a2e',
      selection: false,
      renderOnAddRemove: true,
    });

    // Mouse move handler
    fabricCanvas.on('mouse:move', (e) => {
      if (e.absolutePointer) {
        mouseCoords = {
          x: Math.round(e.absolutePointer.x),
          y: Math.round(e.absolutePointer.y)
        };
      }
    });

    // Click handler for adding points
    fabricCanvas.on('mouse:down', handleCanvasClick);

    // Mouse wheel for zoom
    fabricCanvas.on('mouse:wheel', handleWheel);

    // Load image if already in store
    if (storeState.importedFile) {
      loadImageFromStore();
    }

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      if (fabricCanvas && container) {
        fabricCanvas.setDimensions({
          width: container.clientWidth,
          height: container.clientHeight
        });
        fabricCanvas.renderAll();
      }
    });
    resizeObserver.observe(container);

    console.log('[Calage] Source panel canvas initialized');
  }

  // Load image from store
  async function loadImageFromStore() {
    if (!fabricCanvas || !storeState.importedFile || !fabric) return;

    const file = storeState.importedFile;

    if (file.type === 'image' && typeof file.data === 'string') {
      try {
        // Fabric.js v6 uses Promise-based API
        const img = await fabric.Image.fromURL(file.data);
        if (!fabricCanvas) return;

        // Remove old image
        if (imageObject) {
          fabricCanvas.remove(imageObject);
        }

        // Configure image
        img.set({
          selectable: false,
          evented: false,
          originX: 'center',
          originY: 'center',
        });

        // Scale to fit canvas
        const canvasWidth = fabricCanvas.getWidth();
        const canvasHeight = fabricCanvas.getHeight();
        const imgWidth = img.width || 1;
        const imgHeight = img.height || 1;

        const scaleX = (canvasWidth * 0.9) / imgWidth;
        const scaleY = (canvasHeight * 0.9) / imgHeight;
        const scale = Math.min(scaleX, scaleY);

        img.scale(scale);
        img.set({
          left: canvasWidth / 2,
          top: canvasHeight / 2,
        });

        imageObject = img;
        fabricCanvas.add(img);
        fabricCanvas.sendToBack(img);
        fabricCanvas.renderAll();

        console.log('[Calage] Image loaded:', file.name);
      } catch (err) {
        console.error('[Calage] Image loading error:', err);
      }
    } else if (file.type === 'pdf') {
      loadPdfFromStore(file);
    } else if (file.type === 'dxf') {
      // TODO: Implement DXF rendering
      console.log('[Calage] DXF import not yet implemented');
    }
  }

  // Load PDF from store using pdfjs-dist
  async function loadPdfFromStore(file: ImportedFile) {
    if (!fabricCanvas || !fabric) return;

    try {
      // Dynamic import of pdfjs-dist
      if (!pdfjsLib) {
        const pdfjs = await import('pdfjs-dist');
        pdfjsLib = pdfjs;
        // Set worker source for pdfjs-dist v5.x
        const workerSrc = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc.default;
      }

      // Load PDF document
      const pdfData = file.data as ArrayBuffer;
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
      const pdf = await loadingTask.promise;

      console.log('[Calage] PDF loaded, pages:', pdf.numPages);

      // Get the page to render (default first page)
      const pageNum = file.currentPage || 1;
      const page = await pdf.getPage(pageNum);

      // Render at high resolution for quality
      const scale = 2.0; // 2x for better quality
      const viewport = page.getViewport({ scale });

      // Create off-screen canvas for rendering
      const offCanvas = document.createElement('canvas');
      const context = offCanvas.getContext('2d');
      offCanvas.width = viewport.width;
      offCanvas.height = viewport.height;

      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Convert canvas to data URL
      const dataUrl = offCanvas.toDataURL('image/png');

      // Update store with dimensions
      calageStore.updateImportedFileDimensions(viewport.width / scale, viewport.height / scale);

      // Load as Fabric.js image (v6 Promise-based API)
      const img = await fabric.Image.fromURL(dataUrl);
      if (!fabricCanvas) return;

      // Remove old image
      if (imageObject) {
        fabricCanvas.remove(imageObject);
      }

      // Configure image
      img.set({
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center',
      });

      // Scale to fit canvas
      const canvasWidth = fabricCanvas.getWidth();
      const canvasHeight = fabricCanvas.getHeight();
      const imgWidth = viewport.width / scale;
      const imgHeight = viewport.height / scale;

      const scaleX = (canvasWidth * 0.9) / imgWidth;
      const scaleY = (canvasHeight * 0.9) / imgHeight;
      const fitScale = Math.min(scaleX, scaleY);

      img.scale(fitScale);
      img.set({
        left: canvasWidth / 2,
        top: canvasHeight / 2,
      });

      imageObject = img;
      fabricCanvas.add(img);
      fabricCanvas.sendToBack(img);
      fabricCanvas.renderAll();

      console.log('[Calage] PDF page rendered:', file.name, 'page', pageNum);

    } catch (err) {
      console.error('[Calage] PDF loading error:', err);
    }
  }

  // Handle canvas click
  function handleCanvasClick(e: fabric.IEvent<MouseEvent>) {
    if (!storeState.editMode || storeState.editMode === 'none') return;
    if (storeState.pendingStep !== 'image') return;
    if (!e.absolutePointer) return;

    const x = e.absolutePointer.x;
    const y = e.absolutePointer.y;

    // Set temp image point and switch to world step
    calageStore.setTempImagePoint(x, y);

    console.log('[Calage] Image point set:', x, y);
  }

  // Handle mouse wheel zoom
  function handleWheel(e: fabric.IEvent<WheelEvent>) {
    if (!fabricCanvas || !e.e) return;

    const delta = e.e.deltaY;
    let newZoom = zoom * (delta > 0 ? 0.9 : 1.1);
    newZoom = Math.max(0.1, Math.min(10, newZoom));

    const point = new fabric.Point(e.e.offsetX, e.e.offsetY);
    fabricCanvas.zoomToPoint(point, newZoom);
    zoom = newZoom;

    e.e.preventDefault();
    e.e.stopPropagation();
  }

  // Update calibration points on canvas
  function updateCalibrationPoints() {
    if (!fabricCanvas || !fabric) return;

    // Remove old point markers
    const objects = fabricCanvas.getObjects();
    objects.forEach(obj => {
      if (obj.data?.type === 'calibrationPoint') {
        fabricCanvas!.remove(obj);
      }
    });

    // Add current points
    for (const point of storeState.calibrationPoints) {
      if (point.imageX !== undefined && point.imageY !== undefined) {
        addPointMarker(point);
      }
    }

    // Add temp point if in creation
    if (storeState.tempPoint && storeState.tempPoint.imageX !== undefined) {
      addTempPointMarker(storeState.tempPoint.imageX, storeState.tempPoint.imageY!);
    }

    fabricCanvas.renderAll();
  }

  // Add a calibration point marker
  function addPointMarker(point: CalibrationPoint) {
    if (!fabricCanvas || !fabric) return;

    const isSelected = point.id === storeState.selectedPointId;
    const color = isSelected ? '#ff4444' : '#00ff88';
    const radius = isSelected ? 12 : 10;

    // Circle marker
    const circle = new fabric.Circle({
      radius: radius,
      fill: color,
      stroke: '#ffffff',
      strokeWidth: 2,
      left: point.imageX - radius,
      top: point.imageY - radius,
      selectable: false,
      evented: false,
      data: { type: 'calibrationPoint', pointId: point.id },
    });

    // Label
    const label = point.label || `P${storeState.calibrationPoints.indexOf(point) + 1}`;
    const text = new fabric.Text(label, {
      left: point.imageX,
      top: point.imageY - 25,
      fontSize: 12,
      fontWeight: 'bold',
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 1,
      originX: 'center',
      selectable: false,
      evented: false,
      data: { type: 'calibrationPoint', pointId: point.id },
    });

    fabricCanvas.add(circle);
    fabricCanvas.add(text);
  }

  // Add temp point marker (during creation)
  function addTempPointMarker(x: number, y: number) {
    if (!fabricCanvas || !fabric) return;

    const circle = new fabric.Circle({
      radius: 10,
      fill: 'rgba(255, 255, 0, 0.7)',
      stroke: '#ffffff',
      strokeWidth: 2,
      strokeDashArray: [4, 4],
      left: x - 10,
      top: y - 10,
      selectable: false,
      evented: false,
      data: { type: 'calibrationPoint', temp: true },
    });

    fabricCanvas.add(circle);
  }

  // Rotation functions
  function rotateLeft() {
    rotation -= 90;
    applyRotation();
  }

  function rotateRight() {
    rotation += 90;
    applyRotation();
  }

  function applyRotation() {
    if (!imageObject || !fabricCanvas) return;
    imageObject.rotate(rotation);
    fabricCanvas.renderAll();
    calageStore.setSourceRotation(rotation);
  }

  // Flip functions
  function flipHorizontal() {
    if (!imageObject || !fabricCanvas) return;
    imageObject.set('flipX', !imageObject.flipX);
    fabricCanvas.renderAll();
  }

  function flipVertical() {
    if (!imageObject || !fabricCanvas) return;
    imageObject.set('flipY', !imageObject.flipY);
    fabricCanvas.renderAll();
  }

  // Reset view
  function resetView() {
    if (!fabricCanvas) return;
    zoom = 1;
    rotation = 0;
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    if (imageObject) {
      imageObject.rotate(0);
      imageObject.set({ flipX: false, flipY: false });
    }
    fabricCanvas.renderAll();
  }

  // Zoom controls
  function zoomIn() {
    if (!fabricCanvas) return;
    zoom = Math.min(10, zoom * 1.2);
    fabricCanvas.setZoom(zoom);
    fabricCanvas.renderAll();
  }

  function zoomOut() {
    if (!fabricCanvas) return;
    zoom = Math.max(0.1, zoom / 1.2);
    fabricCanvas.setZoom(zoom);
    fabricCanvas.renderAll();
  }

  // Apply opacity
  $effect(() => {
    if (imageObject && storeState.sourceOpacity !== undefined) {
      imageObject.set('opacity', storeState.sourceOpacity);
      fabricCanvas?.renderAll();
    }
  });

  onMount(() => {
    // Subscribe to store
    unsubscribeStore = calageStore.subscribe(s => {
      storeState = s;
      updateCalibrationPoints();

      // Update image if changed
      if (storeState.importedFile && fabricCanvas && fabric) {
        loadImageFromStore();
      }
    });

    // Small delay to ensure container is sized
    setTimeout(initCanvas, 100);
  });

  onDestroy(() => {
    unsubscribeStore?.();
    if (fabricCanvas) {
      fabricCanvas.dispose();
      fabricCanvas = null;
    }
  });
</script>

<div class="source-panel">
  <!-- Toolbar -->
  <div class="panel-toolbar">
    <div class="toolbar-left">
      <span class="panel-title">Plan à caler</span>
      {#if storeState.importedFile}
        <span class="file-name" title={storeState.importedFile.name}>
          {storeState.importedFile.name}
        </span>
      {/if}
    </div>

    <div class="toolbar-right">
      {#if storeState.importedFile}
        <!-- Rotation -->
        <button class="toolbar-btn" onclick={rotateLeft} title="Rotation -90°">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/>
          </svg>
        </button>
        <button class="toolbar-btn" onclick={rotateRight} title="Rotation +90°">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="transform: scaleX(-1)">
            <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/>
          </svg>
        </button>

        <!-- Flip -->
        <button class="toolbar-btn" onclick={flipHorizontal} title="Flip horizontal">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 20v2M12 14v2M12 8v2M12 2v2"/>
          </svg>
        </button>
        <button class="toolbar-btn" onclick={flipVertical} title="Flip vertical">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 8V5a2 2 0 0 1 2-2h14c1.1 0 2 .9 2 2v3M3 16v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M20 12h2M14 12h2M8 12h2M2 12h2"/>
          </svg>
        </button>

        <div class="separator"></div>

        <!-- Zoom -->
        <button class="toolbar-btn" onclick={zoomOut} title="Zoom -">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35M8 11h6"/>
          </svg>
        </button>
        <span class="zoom-value">{Math.round(zoom * 100)}%</span>
        <button class="toolbar-btn" onclick={zoomIn} title="Zoom +">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
          </svg>
        </button>

        <!-- Reset -->
        <button class="toolbar-btn" onclick={resetView} title="Réinitialiser">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <!-- Canvas container -->
  <div class="canvas-wrapper" bind:this={canvasContainer}>
    <canvas bind:this={canvasElement}></canvas>

    <!-- Coordinates display -->
    {#if mouseCoords && storeState.importedFile}
      <div class="coords-display">
        <span>X: {mouseCoords.x}</span>
        <span>Y: {mouseCoords.y}</span>
      </div>
    {/if}

    <!-- Edit mode indicator -->
    {#if storeState.editMode === 'addPoint' && storeState.pendingStep === 'image'}
      <div class="edit-mode-indicator">
        Cliquez sur le plan pour placer le point source
      </div>
    {/if}

    <!-- Empty state -->
    {#if !storeState.importedFile}
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <p>Aucun fichier importé</p>
        <p class="hint">Utilisez le bouton "Importer" dans la barre de contrôle</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .source-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--noir-surface);
    border-radius: 8px;
    overflow: hidden;
  }

  .panel-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--noir-card);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--primary);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 1px;
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

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--noir-surface);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .toolbar-btn:hover {
    border-color: var(--primary);
    color: var(--primary);
  }

  .separator {
    width: 1px;
    height: 20px;
    background: var(--border-color);
    margin: 0 4px;
  }

  .zoom-value {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    min-width: 45px;
    text-align: center;
  }

  .canvas-wrapper {
    flex: 1;
    position: relative;
    min-height: 0;
    overflow: hidden;
  }

  .canvas-wrapper canvas {
    display: block;
  }

  .coords-display {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: rgba(0, 0, 0, 0.8);
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--primary);
    display: flex;
    gap: 16px;
    z-index: 50;
  }

  .edit-mode-indicator {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--primary);
    color: var(--noir-profond);
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    z-index: 50;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
  }

  .empty-state {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    text-align: center;
  }

  .empty-state svg {
    opacity: 0.3;
    margin-bottom: 16px;
  }

  .empty-state p {
    margin: 4px 0;
    font-size: 14px;
  }

  .empty-state .hint {
    font-size: 11px;
    opacity: 0.6;
  }
</style>
