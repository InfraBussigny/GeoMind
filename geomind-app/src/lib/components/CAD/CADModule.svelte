<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { appMode } from '$lib/stores/app';
  import DxfParser from 'dxf-parser';
  import proj4 from 'proj4';
  import * as pdfjsLib from 'pdfjs-dist';
  import { Matrix } from 'ml-matrix';
  import { DxfWriter, point3d } from '@tarikjabiri/dxf';
  import { jsPDF } from 'jspdf';
  import 'svg2pdf.js';

  // Configure pdf.js worker (use unpkg which has all npm versions)
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  // Register Swiss projections
  proj4.defs('EPSG:2056', '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs');
  proj4.defs('EPSG:21781', '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs');

  // Types
  interface CadLayer {
    name: string;
    color: number;
    visible: boolean;
    locked: boolean;
    opacity: number;
    strokeWidth: number;
    source: 'dxf' | 'postgis' | 'image';
    connectionId?: string;
    tableName?: string;
  }

  interface CadEntity {
    type: string;
    layer: string;
    color: number;
    handle: string;
    data: any;
  }

  interface DBConnection {
    id: string;
    name: string;
    type: string;
    host?: string;
    database?: string;
    status: string;
  }

  interface GeoTable {
    schema: string;
    table: string;
    fullName: string;
    geometryColumn: string;
    geometryType: string;
    srid: number;
  }

  interface GeorefPoint {
    imageX: number;
    imageY: number;
    worldX: number;
    worldY: number;
  }

  interface ImportedImage {
    id: string;
    name: string;
    fabricImage: any;
    georefPoints: GeorefPoint[];
    isGeoreferenced: boolean;
    transform?: { tx: number; ty: number; scale: number; rotation: number };
    originalWidth?: number;
    originalHeight?: number;
    rmsError?: number;  // Root Mean Square error in meters
    residuals?: { dx: number; dy: number; dist: number }[];  // Residuals per point
  }

  // State
  let canvasElement: HTMLCanvasElement;
  let fabricCanvas: any = null;
  let fabric: any = null;

  // CAD state
  let layers: CadLayer[] = $state([]);
  let entities: CadEntity[] = $state([]);
  let layerMap = $state<Map<string, CadLayer>>(new Map());
  let selectedTool = $state<'select' | 'pan' | 'measure-dist' | 'measure-area' | 'draw-line' | 'draw-polyline' | 'draw-rect' | 'draw-circle'>('select');
  let snapEnabled = $state(true);
  let gridEnabled = $state(false);
  let orthoEnabled = $state(false);

  // Drawing state
  let drawingPoints = $state<{x: number; y: number}[]>([]);
  let isDrawing = $state(false);
  let previewObject: any = null;
  let snapIndicator: any = null;
  let snapPoint = $state<{x: number; y: number} | null>(null);

  // Undo/Redo history
  let undoStack = $state<CadEntity[][]>([]);
  let redoStack = $state<CadEntity[][]>([]);

  // Color picker for drawing
  let currentDrawColor = $state('#00FF00');
  let currentStrokeWidth = $state(1);
  let currentDrawLayer = $state('Saisie');
  let cursorX = $state(0);
  let cursorY = $state(0);
  let zoom = $state(100);
  let fileName = $state('');
  let isDragging = $state(false);

  // Selection state
  let selectedEntities = $state<any[]>([]);
  let selectedEntityInfo = $state<{type: string; layer: string; coords: string; dimensions: string} | null>(null);

  // Layer context menu
  let contextMenuLayer = $state<string | null>(null);
  let contextMenuPos = $state({ x: 0, y: 0 });

  // Measurement state
  let measurePoints = $state<{x: number; y: number}[]>([]);
  let measureDistance = $state(0);
  let measureArea = $state(0);
  let measureLine: any = null;
  let measurePolygon: any = null;

  // Data sources state
  let activePanel = $state<'layers' | 'sources' | 'georef'>('layers');
  let connections = $state<DBConnection[]>([]);
  let selectedConnectionId = $state('');
  let geoTables = $state<GeoTable[]>([]);
  let loadingTables = $state(false);
  let expandedSchemas = $state<Set<string>>(new Set());
  let tableSearch = $state('');

  // Georeferencing state
  let importedImages = $state<ImportedImage[]>([]);
  let selectedImageId = $state<string | null>(null);
  let georefMode = $state(false);
  let currentGeorefPoint = $state<'image' | 'world' | null>(null);
  let tempGeorefPoint = $state<Partial<GeorefPoint>>({});

  // Split-screen georef canvas
  let georefCanvasElement: HTMLCanvasElement;
  let georefCanvas: any = null;
  let georefImageZoom = $state(1);
  let georefImageCenter = $state({ x: 0, y: 0 });

  // Default center in MN95
  const defaultCenter = { x: 2533500, y: 1152000 };
  let viewCenter = $state({ x: defaultCenter.x, y: defaultCenter.y });

  // ACI colors
  const aciColors: Record<number, string> = {
    1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF',
    5: '#0000FF', 6: '#FF00FF', 7: '#FFFFFF', 8: '#808080',
    9: '#C0C0C0', 10: '#FF0000', 30: '#FF7F00', 40: '#FFBF00',
    50: '#FFFF00', 70: '#7FFF00', 90: '#00FF7F', 110: '#00FFFF',
    130: '#007FFF', 150: '#7F00FF', 170: '#FF00FF',
  };

  const layerColors = [
    '#00ff88', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
    '#ffeaa7', '#fd79a8', '#a29bfe', '#6c5ce7', '#e17055'
  ];

  function getColor(colorIndex: number): string {
    return aciColors[colorIndex] || '#FFFFFF';
  }

  // Initialize
  onMount(async () => {
    const fabricModule = await import('fabric') as any;
    fabric = fabricModule.fabric || fabricModule.default || fabricModule;

    if (canvasElement) {
      fabricCanvas = new fabric.Canvas(canvasElement, {
        backgroundColor: '#1a1f2e',
        selection: true,
        preserveObjectStacking: true,
      });

      resizeCanvas();
      fabricCanvas.on('mouse:move', handleMouseMove);
      fabricCanvas.on('mouse:wheel', handleZoom);
      fabricCanvas.on('mouse:down', handleMouseDown);
      fabricCanvas.on('mouse:up', handleMouseUp);
      fabricCanvas.on('selection:created', handleSelection);
      fabricCanvas.on('selection:updated', handleSelection);
      fabricCanvas.on('selection:cleared', () => selectedEntityInfo = null);
      window.addEventListener('resize', resizeCanvas);

      // Load connections
      await loadConnections();

      // Keyboard shortcuts
      window.addEventListener('keydown', handleKeyDown);
    }
  });

  // Update layer map when layers change
  $effect(() => {
    const map = new Map<string, CadLayer>();
    for (const layer of layers) {
      map.set(layer.name, layer);
    }
    layerMap = map;
  });

  onDestroy(() => {
    if (fabricCanvas) fabricCanvas.dispose();
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('keydown', handleKeyDown);
  });

  function handleKeyDown(e: KeyboardEvent) {
    // Ignore if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key.toLowerCase()) {
      case 'v':
        setTool('select');
        break;
      case 'h':
        setTool('pan');
        break;
      case 'm':
        setTool('measure-dist');
        break;
      case 'a':
        if (e.ctrlKey) {
          e.preventDefault();
          selectAllEntities();
        } else {
          setTool('measure-area');
        }
        break;
      case 'l':
        setTool('draw-line');
        break;
      case 'p':
        if (e.ctrlKey) {
          e.preventDefault();
          printCanvas();
        } else {
          setTool('draw-polyline');
        }
        break;
      case 'r':
        setTool('draw-rect');
        break;
      case 'c':
        setTool('draw-circle');
        break;
      case 'f':
        zoomExtent();
        break;
      case 'g':
        gridEnabled = !gridEnabled;
        renderAllEntities();
        break;
      case 'z':
        if (e.ctrlKey) {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        }
        break;
      case 'y':
        if (e.ctrlKey) {
          e.preventDefault();
          redo();
        }
        break;
      case 'escape':
        cancelDrawing();
        cancelMeasurement();
        deselectAll();
        contextMenuLayer = null;
        break;
      case 'enter':
        if (isDrawing && selectedTool === 'draw-polyline' && drawingPoints.length >= 2) {
          finishPolyline();
        }
        break;
    }
  }

  function selectAllEntities() {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects().filter((o: any) => o.selectable);
    fabricCanvas.discardActiveObject();
    if (objects.length > 0) {
      const selection = new fabric.ActiveSelection(objects, { canvas: fabricCanvas });
      fabricCanvas.setActiveObject(selection);
      fabricCanvas.renderAll();
    }
  }

  function deselectAll() {
    if (!fabricCanvas) return;
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    selectedEntityInfo = null;
  }

  function cancelMeasurement() {
    measurePoints = [];
    measureDistance = 0;
    measureArea = 0;
    if (measureLine) {
      fabricCanvas?.remove(measureLine);
      measureLine = null;
    }
    if (measurePolygon) {
      fabricCanvas?.remove(measurePolygon);
      measurePolygon = null;
    }
    fabricCanvas?.renderAll();
  }

  function resizeCanvas() {
    if (!fabricCanvas || !canvasElement) return;
    const container = canvasElement.parentElement;
    if (container) {
      fabricCanvas.setWidth(container.clientWidth);
      fabricCanvas.setHeight(container.clientHeight);
      fabricCanvas.renderAll();
    }
  }

  // Mouse handlers
  function handleMouseMove(e: any) {
    const pointer = fabricCanvas.getPointer(e.e);
    // Convert canvas coords to world coords
    const scale = fabricCanvas.getZoom();
    const vpt = fabricCanvas.viewportTransform;
    cursorX = Math.round((pointer.x - vpt[4]) / scale + viewCenter.x);
    cursorY = Math.round(viewCenter.y - (pointer.y - vpt[5]) / scale);

    // Middle mouse drag pan (always available)
    if (isDragging && e.e.buttons === 4) {
      const delta = new fabric.Point(e.e.movementX, e.e.movementY);
      fabricCanvas.relativePan(delta);
    }

    // Pan tool drag
    if (isDragging && selectedTool === 'pan' && e.e.buttons === 1) {
      const delta = new fabric.Point(e.e.movementX, e.e.movementY);
      fabricCanvas.relativePan(delta);
    }

    // Update measurement preview
    if ((selectedTool === 'measure-dist' || selectedTool === 'measure-area') && measurePoints.length > 0) {
      updateMeasurementPreview(cursorX, cursorY);
    }

    // Update drawing preview
    if (isDrawing && selectedTool.startsWith('draw-')) {
      updateDrawingPreview(cursorX, cursorY);
    }
  }

  function handleMouseDown(e: any) {
    // Close context menu on any click
    contextMenuLayer = null;

    // Middle mouse button - start pan
    if (e.e.button === 1) {
      isDragging = true;
      fabricCanvas.selection = false;
      return;
    }

    // Left click
    if (e.e.button === 0) {
      // Pan tool
      if (selectedTool === 'pan') {
        isDragging = true;
        fabricCanvas.defaultCursor = 'grabbing';
        return;
      }

      // Measurement tools
      if (selectedTool === 'measure-dist' || selectedTool === 'measure-area') {
        addMeasurePoint(cursorX, cursorY);
        return;
      }

      // Drawing tools
      if (selectedTool.startsWith('draw-')) {
        if (!isDrawing) {
          startDrawing(cursorX, cursorY);
        } else {
          addDrawingPoint(cursorX, cursorY);
        }
        return;
      }

      // Georeferencing mode - capture world points (split screen mode)
      if (georefMode && currentGeorefPoint === 'world' && selectedImageId && georefCanvas) {
        handleGeorefWorldClick(cursorX, cursorY);
        return;
      }

      // Georeferencing mode - capture points (fallback single canvas mode)
      if (georefMode && currentGeorefPoint && selectedImageId && !georefCanvas) {
        const pointer = fabricCanvas.getPointer(e.e);
        if (currentGeorefPoint === 'image') {
          tempGeorefPoint.imageX = pointer.x;
          tempGeorefPoint.imageY = pointer.y;
          currentGeorefPoint = 'world';
        } else if (currentGeorefPoint === 'world') {
          tempGeorefPoint.worldX = cursorX;
          tempGeorefPoint.worldY = cursorY;
          addGeorefPoint();
        }
        return;
      }
    }

    // Right click - finish measurement
    if (e.e.button === 2 && (selectedTool === 'measure-dist' || selectedTool === 'measure-area')) {
      finishMeasurement();
    }
  }

  function handleMouseUp() {
    isDragging = false;
    if (selectedTool === 'pan') {
      fabricCanvas.defaultCursor = 'grab';
    }
    fabricCanvas.selection = selectedTool === 'select';
  }

  // Handle object selection for info panel
  function handleSelection(e: any) {
    const selected = e.selected;
    if (selected && selected.length === 1) {
      const obj = selected[0];
      const data = obj.data;
      if (data) {
        const bounds = obj.getBoundingRect();
        selectedEntityInfo = {
          type: data.type || 'Objet',
          layer: data.layer || entities.find(en => en.handle === data.handle)?.layer || '-',
          coords: `${cursorX.toLocaleString('fr-CH')}, ${cursorY.toLocaleString('fr-CH')}`,
          dimensions: `${Math.round(bounds.width)} x ${Math.round(bounds.height)}`
        };
      }
    } else {
      selectedEntityInfo = null;
    }
  }

  // Measurement functions
  function addMeasurePoint(x: number, y: number) {
    measurePoints = [...measurePoints, { x, y }];
    updateMeasurement();
  }

  function updateMeasurementPreview(x: number, y: number) {
    if (!fabricCanvas || !fabric || measurePoints.length === 0) return;

    const allPoints = [...measurePoints, { x, y }];
    const canvasPoints = allPoints.map(p => ({
      x: p.x - viewCenter.x,
      y: viewCenter.y - p.y
    }));

    // Remove old preview
    if (measureLine) fabricCanvas.remove(measureLine);
    if (measurePolygon) fabricCanvas.remove(measurePolygon);

    if (selectedTool === 'measure-dist' && canvasPoints.length >= 2) {
      measureLine = new fabric.Polyline(canvasPoints, {
        stroke: '#ffcc00',
        strokeWidth: 2,
        fill: 'transparent',
        selectable: false,
        evented: false,
        strokeDashArray: [5, 5]
      });
      fabricCanvas.add(measureLine);

      // Calculate distance
      let dist = 0;
      for (let i = 1; i < allPoints.length; i++) {
        const dx = allPoints[i].x - allPoints[i-1].x;
        const dy = allPoints[i].y - allPoints[i-1].y;
        dist += Math.sqrt(dx*dx + dy*dy);
      }
      measureDistance = dist;
    }

    if (selectedTool === 'measure-area' && canvasPoints.length >= 3) {
      measurePolygon = new fabric.Polygon(canvasPoints, {
        stroke: '#ffcc00',
        strokeWidth: 2,
        fill: 'rgba(255, 204, 0, 0.2)',
        selectable: false,
        evented: false,
        strokeDashArray: [5, 5]
      });
      fabricCanvas.add(measurePolygon);

      // Calculate area using shoelace formula
      let area = 0;
      for (let i = 0; i < allPoints.length; i++) {
        const j = (i + 1) % allPoints.length;
        area += allPoints[i].x * allPoints[j].y;
        area -= allPoints[j].x * allPoints[i].y;
      }
      measureArea = Math.abs(area / 2);
    }

    fabricCanvas.renderAll();
  }

  function updateMeasurement() {
    if (measurePoints.length < 2) return;
    updateMeasurementPreview(measurePoints[measurePoints.length - 1].x, measurePoints[measurePoints.length - 1].y);
  }

  function finishMeasurement() {
    // Keep the measurement visible
    if (measureLine) measureLine.set({ strokeDashArray: null });
    if (measurePolygon) measurePolygon.set({ strokeDashArray: null });
    fabricCanvas?.renderAll();
  }

  function copyMeasurement() {
    let text = '';
    if (selectedTool === 'measure-dist' && measureDistance > 0) {
      text = `Distance: ${measureDistance.toFixed(2)} m`;
    } else if (selectedTool === 'measure-area' && measureArea > 0) {
      text = `Surface: ${measureArea.toFixed(2)} m²`;
    }
    if (text) {
      navigator.clipboard.writeText(text);
    }
  }

  function handleZoom(opt: any) {
    const e = opt.e;
    const delta = e.deltaY;
    let newZoom = fabricCanvas.getZoom() * (0.999 ** delta);
    newZoom = Math.min(Math.max(newZoom, 0.001), 100);
    fabricCanvas.zoomToPoint({ x: e.offsetX, y: e.offsetY }, newZoom);
    zoom = Math.round(newZoom * 100);
    e.preventDefault();
    e.stopPropagation();
  }

  // Load PostGIS connections
  async function loadConnections() {
    try {
      const res = await fetch('http://localhost:3001/api/connections');
      const data = await res.json();
      connections = data.filter((c: DBConnection) => c.type === 'postgresql');
      if (connections.length > 0) {
        const srvFme = connections.find(c => c.host === 'srv-fme' && c.database === 'Prod');
        selectedConnectionId = srvFme?.id || connections[0].id;
        await loadGeoTables();
      }
    } catch (err) {
      console.error('Erreur chargement connexions:', err);
    }
  }

  // Load geo tables from selected connection
  async function loadGeoTables() {
    if (!selectedConnectionId) return;
    loadingTables = true;

    try {
      await fetch(`http://localhost:3001/api/connections/${selectedConnectionId}/connect`, { method: 'POST' });
      const res = await fetch(`http://localhost:3001/api/databases/${selectedConnectionId}/geotables`);
      const data = await res.json();
      if (data.success) {
        geoTables = data.tables;
      }
    } catch (err) {
      console.error('Erreur chargement tables:', err);
    } finally {
      loadingTables = false;
    }
  }

  // Group tables by schema
  function getTablesBySchema(): Record<string, GeoTable[]> {
    const filtered = tableSearch
      ? geoTables.filter(t => t.table.toLowerCase().includes(tableSearch.toLowerCase()))
      : geoTables;
    return filtered.reduce((acc, t) => {
      if (!acc[t.schema]) acc[t.schema] = [];
      acc[t.schema].push(t);
      return acc;
    }, {} as Record<string, GeoTable[]>);
  }

  function toggleSchema(schema: string) {
    const newSet = new Set(expandedSchemas);
    if (newSet.has(schema)) newSet.delete(schema);
    else newSet.add(schema);
    expandedSchemas = newSet;
  }

  // Load PostGIS layer to canvas
  async function loadPostGISLayer(table: GeoTable) {
    if (!selectedConnectionId) return;

    const layerName = `${table.schema}.${table.table}`;
    const existingLayer = layers.find(l => l.name === layerName && l.source === 'postgis');
    if (existingLayer) {
      existingLayer.visible = !existingLayer.visible;
      layers = [...layers];
      renderAllEntities();
      return;
    }

    try {
      // Query geometry as GeoJSON
      const query = `SELECT id, ST_AsGeoJSON(ST_Transform(${table.geometryColumn}, 2056)) as geom FROM ${table.schema}.${table.table} LIMIT 5000`;
      const res = await fetch('http://localhost:3001/api/sql/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: selectedConnectionId, query })
      });
      const data = await res.json();

      if (data.success && data.rows) {
        const colorIndex = layers.filter(l => l.source === 'postgis').length;
        const color = layerColors[colorIndex % layerColors.length];

        // Add layer
        const newLayer: CadLayer = {
          name: layerName,
          color: colorIndex + 10,
          visible: true,
          locked: false,
          opacity: 1,
          strokeWidth: 1,
          source: 'postgis',
          connectionId: selectedConnectionId,
          tableName: table.fullName
        };
        layers = [...layers, newLayer];

        // Convert GeoJSON to entities
        for (const row of data.rows) {
          if (!row.geom) continue;
          const geojson = JSON.parse(row.geom);
          const entity = geojsonToEntity(geojson, layerName, row.id, color);
          if (entity) entities = [...entities, entity];
        }

        renderAllEntities();
      }
    } catch (err) {
      console.error('Erreur chargement couche PostGIS:', err);
    }
  }

  // Convert GeoJSON to CAD entity
  function geojsonToEntity(geojson: any, layer: string, id: any, color: string): CadEntity | null {
    const base = {
      layer,
      color: 7,
      handle: `pg_${layer}_${id}`,
    };

    switch (geojson.type) {
      case 'Point':
        return { ...base, type: 'POINT', data: { position: { x: geojson.coordinates[0], y: geojson.coordinates[1] }, color } };
      case 'LineString':
        return { ...base, type: 'POLYLINE', data: { vertices: geojson.coordinates.map((c: number[]) => ({ x: c[0], y: c[1] })), closed: false, color } };
      case 'Polygon':
        return { ...base, type: 'POLYLINE', data: { vertices: geojson.coordinates[0].map((c: number[]) => ({ x: c[0], y: c[1] })), closed: true, color } };
      case 'MultiPolygon':
        // Just take first polygon for now
        return { ...base, type: 'POLYLINE', data: { vertices: geojson.coordinates[0][0].map((c: number[]) => ({ x: c[0], y: c[1] })), closed: true, color } };
      default:
        return null;
    }
  }

  // DXF File handling
  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    fileName = file.name;

    if (file.name.toLowerCase().endsWith('.dxf')) {
      const text = await file.text();
      parseDxfFile(text);
    }
  }

  function parseDxfFile(content: string) {
    try {
      const parser = new DxfParser();
      const dxf = parser.parseSync(content);
      if (!dxf) return;

      if (dxf.tables?.layer?.layers) {
        const dxfLayers = Object.values(dxf.tables.layer.layers).map((l: any) => ({
          name: l.name,
          color: l.color || 7,
          visible: true,
          locked: false,
          opacity: 1,
          strokeWidth: 1,
          source: 'dxf' as const
        }));
        layers = [...layers, ...dxfLayers];
      }

      if (dxf.entities) {
        for (const entity of dxf.entities) {
          entities = [...entities, {
            type: entity.type,
            layer: entity.layer || '0',
            color: entity.color || 256,
            handle: String(entity.handle || Math.random().toString(36)),
            data: entity,
          }];
        }
      }

      renderAllEntities();
    } catch (error) {
      console.error('Error parsing DXF:', error);
    }
  }

  // Image/PDF import
  let pdfLoadingProgress = $state(0);
  let pdfLoading = $state(false);

  async function handleImageImport(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !fabric) return;

    const file = input.files[0];
    const isPdf = file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      await loadPdfAsImage(file);
      return;
    }

    // Load regular image
    loadImageFile(file);
  }

  // Load PDF and convert to image
  async function loadPdfAsImage(file: File) {
    pdfLoading = true;
    pdfLoadingProgress = 0;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      // Get first page (or show selector for multi-page)
      const numPages = pdf.numPages;
      pdfLoadingProgress = 20;

      // For now, load first page. Could add page selector later.
      const page = await pdf.getPage(1);
      pdfLoadingProgress = 40;

      // Render at high DPI for quality (2x scale)
      const scale = 2;
      const viewport = page.getViewport({ scale });

      // Create off-screen canvas
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas context not available');

      pdfLoadingProgress = 60;

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      pdfLoadingProgress = 80;

      // Convert canvas to data URL
      const imgUrl = canvas.toDataURL('image/png');

      // Load into Fabric (v6+ uses Promises, not callbacks)
      const img = await fabric.Image.fromURL(imgUrl);

      // Scale down to original size (since we rendered at 2x)
      img.set({
        left: 100,
        top: 100,
        scaleX: 0.5,
        scaleY: 0.5,
        opacity: 0.8,
        selectable: true,
        _isImage: true,
      });

      const baseName = file.name.replace('.pdf', '');
      const newImage: ImportedImage = {
        id: Math.random().toString(36).substr(2, 9),
        name: `${baseName} (p.1/${numPages})`,
        fabricImage: img,
        georefPoints: [],
        isGeoreferenced: false,
        originalWidth: viewport.width / scale,
        originalHeight: viewport.height / scale,
      };

      importedImages = [...importedImages, newImage];
      fabricCanvas.add(img);
      fabricCanvas.renderAll();

      layers = [...layers, {
        name: `PDF: ${baseName}`,
        color: 7,
        visible: true,
        locked: false,
        opacity: 1,
        strokeWidth: 1,
        source: 'image'
      }];

      pdfLoadingProgress = 100;
      setTimeout(() => { pdfLoading = false; }, 500);

    } catch (err) {
      console.error('Erreur chargement PDF:', err);
      alert(`Erreur chargement PDF: ${err}`);
      pdfLoading = false;
    }
  }

  // Load regular image file
  async function loadImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imgUrl = e.target?.result as string;

      // Fabric.js v6+ uses Promises
      const img = await fabric.Image.fromURL(imgUrl);

      img.set({
        left: 100,
        top: 100,
        opacity: 0.7,
        selectable: true,
        _isImage: true,
      });

      const newImage: ImportedImage = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        fabricImage: img,
        georefPoints: [],
        isGeoreferenced: false,
        originalWidth: img.width,
        originalHeight: img.height,
      };

      importedImages = [...importedImages, newImage];
      fabricCanvas.add(img);
      fabricCanvas.renderAll();

      layers = [...layers, {
        name: `Image: ${file.name}`,
        color: 7,
        visible: true,
        locked: false,
        opacity: 1,
        strokeWidth: 1,
        source: 'image'
      }];
    };
    reader.readAsDataURL(file);
  }

  // Georeferencing functions
  function startGeoreferencing(imageId: string) {
    selectedImageId = imageId;
    georefMode = true;
    currentGeorefPoint = 'image';
    tempGeorefPoint = {};

    const image = importedImages.find(i => i.id === imageId);
    if (!image || !image.fabricImage || !fabricCanvas) return;

    // Hide the image from main canvas (it will show in split view)
    image.fabricImage.set({ opacity: 0.2 });
    fabricCanvas.renderAll();

    // Initialize the georef canvas after DOM updates
    setTimeout(() => {
      initGeorefCanvas(image);
    }, 50);
  }

  function initGeorefCanvas(image: ImportedImage) {
    if (!georefCanvasElement || !fabric) return;

    // Create canvas for image
    georefCanvas = new fabric.Canvas(georefCanvasElement, {
      backgroundColor: '#2d3748',
      selection: false,
    });

    // Resize to fit container
    const container = georefCanvasElement.parentElement;
    if (container) {
      georefCanvas.setWidth(container.clientWidth);
      georefCanvas.setHeight(container.clientHeight);
    }

    // Clone the image for the georef canvas
    const imgSrc = image.fabricImage.getSrc();
    fabric.Image.fromURL(imgSrc).then((img: any) => {
      // Scale image to fit
      const canvasW = georefCanvas.getWidth();
      const canvasH = georefCanvas.getHeight();
      const imgW = img.width || 100;
      const imgH = img.height || 100;

      const scale = Math.min(canvasW / imgW, canvasH / imgH) * 0.9;
      img.set({
        left: canvasW / 2,
        top: canvasH / 2,
        originX: 'center',
        originY: 'center',
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
      });

      georefCanvas.add(img);
      georefCanvas.renderAll();

      // Store image dimensions for point calculations
      georefImageCenter = { x: canvasW / 2, y: canvasH / 2 };
      georefImageZoom = scale;
    });

    // Handle clicks on image canvas
    georefCanvas.on('mouse:down', handleGeorefImageClick);

    // Handle zoom on image canvas
    georefCanvas.on('mouse:wheel', (opt: any) => {
      const delta = opt.e.deltaY;
      let newZoom = georefCanvas.getZoom() * (delta > 0 ? 0.9 : 1.1);
      newZoom = Math.max(0.1, Math.min(10, newZoom));
      georefCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, newZoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Handle pan on image canvas
    let isPanning = false;
    georefCanvas.on('mouse:down', (opt: any) => {
      if (opt.e.button === 1 || opt.e.ctrlKey) { // Middle click or Ctrl+click
        isPanning = true;
        georefCanvas.selection = false;
      }
    });
    georefCanvas.on('mouse:move', (opt: any) => {
      if (isPanning) {
        georefCanvas.relativePan(new fabric.Point(opt.e.movementX, opt.e.movementY));
      }
    });
    georefCanvas.on('mouse:up', () => {
      isPanning = false;
    });
  }

  function handleGeorefImageClick(opt: any) {
    if (currentGeorefPoint !== 'image') return;

    const pointer = georefCanvas.getPointer(opt.e);

    // Store image point (in image pixel coordinates)
    tempGeorefPoint.imageX = pointer.x;
    tempGeorefPoint.imageY = pointer.y;

    // Add marker on image canvas
    const marker = new fabric.Circle({
      left: pointer.x - 8,
      top: pointer.y - 8,
      radius: 8,
      fill: 'rgba(255, 204, 0, 0.5)',
      stroke: '#ffcc00',
      strokeWidth: 2,
      selectable: false,
      evented: false,
      data: { type: 'georef-marker' }
    });
    georefCanvas.add(marker);
    georefCanvas.renderAll();

    // Switch to world point mode
    currentGeorefPoint = 'world';
  }

  function handleGeorefWorldClick(x: number, y: number) {
    if (currentGeorefPoint !== 'world' || !selectedImageId) return;

    // Store world point (in MN95 coordinates)
    tempGeorefPoint.worldX = x;
    tempGeorefPoint.worldY = y;

    // Add marker on main canvas
    if (fabricCanvas && fabric) {
      const canvasX = x - viewCenter.x;
      const canvasY = viewCenter.y - y;
      const marker = new fabric.Circle({
        left: canvasX - 8,
        top: canvasY - 8,
        radius: 8,
        fill: 'rgba(0, 255, 136, 0.5)',
        stroke: '#00ff88',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        data: { type: 'georef-marker' }
      });
      fabricCanvas.add(marker);
      fabricCanvas.renderAll();
    }

    // Add the point pair
    addGeorefPoint();
  }

  function addGeorefPoint() {
    if (!selectedImageId || !tempGeorefPoint.imageX) return;

    const image = importedImages.find(i => i.id === selectedImageId);
    if (image) {
      image.georefPoints = [...image.georefPoints, tempGeorefPoint as GeorefPoint];
      importedImages = [...importedImages];
    }

    tempGeorefPoint = {};
    currentGeorefPoint = 'image';
  }

  function cancelGeoreferencing() {
    // Restore image opacity on main canvas
    if (selectedImageId) {
      const image = importedImages.find(i => i.id === selectedImageId);
      if (image && image.fabricImage) {
        image.fabricImage.set({ opacity: 1 });
      }
    }

    // Remove georef markers from main canvas
    if (fabricCanvas) {
      const markers = fabricCanvas.getObjects().filter((o: any) => o.data?.type === 'georef-marker');
      markers.forEach((m: any) => fabricCanvas.remove(m));
      fabricCanvas.renderAll();
    }

    // Dispose georef canvas
    if (georefCanvas) {
      georefCanvas.dispose();
      georefCanvas = null;
    }

    georefMode = false;
    currentGeorefPoint = null;
    selectedImageId = null;
    tempGeorefPoint = {};
  }

  // Helmert transformation (4 parameters: tx, ty, scale, rotation)
  function computeHelmertTransform(points: GeorefPoint[]): { tx: number; ty: number; scale: number; rotation: number } | null {
    if (points.length < 2) return null;

    // Compute centroids
    let sumImgX = 0, sumImgY = 0, sumWorldX = 0, sumWorldY = 0;
    for (const p of points) {
      sumImgX += p.imageX;
      sumImgY += p.imageY;
      sumWorldX += p.worldX;
      sumWorldY += p.worldY;
    }
    const n = points.length;
    const centImgX = sumImgX / n, centImgY = sumImgY / n;
    const centWorldX = sumWorldX / n, centWorldY = sumWorldY / n;

    // Compute scale and rotation using least squares
    let num1 = 0, num2 = 0, denom = 0;
    for (const p of points) {
      const dx_img = p.imageX - centImgX;
      const dy_img = p.imageY - centImgY;
      const dx_world = p.worldX - centWorldX;
      const dy_world = p.worldY - centWorldY;

      num1 += dx_img * dx_world + dy_img * dy_world;
      num2 += dx_img * dy_world - dy_img * dx_world;
      denom += dx_img * dx_img + dy_img * dy_img;
    }

    if (denom === 0) return null;

    const a = num1 / denom;
    const b = num2 / denom;
    const scale = Math.sqrt(a * a + b * b);
    const rotation = Math.atan2(b, a) * 180 / Math.PI;

    const tx = centWorldX - scale * (centImgX * Math.cos(rotation * Math.PI / 180) - centImgY * Math.sin(rotation * Math.PI / 180));
    const ty = centWorldY - scale * (centImgX * Math.sin(rotation * Math.PI / 180) + centImgY * Math.cos(rotation * Math.PI / 180));

    return { tx, ty, scale, rotation };
  }

  function applyGeoreferencing() {
    const image = importedImages.find(i => i.id === selectedImageId);
    if (!image || image.georefPoints.length < 2) {
      alert('Il faut au moins 2 points de calage');
      return;
    }

    const transform = computeHelmertTransform(image.georefPoints);
    if (!transform) {
      alert('Erreur de calcul de la transformation');
      return;
    }

    // Calculate residuals for each point
    const residuals: { dx: number; dy: number; dist: number }[] = [];
    const cosR = Math.cos(transform.rotation * Math.PI / 180);
    const sinR = Math.sin(transform.rotation * Math.PI / 180);

    let sumSquaredDist = 0;
    for (const p of image.georefPoints) {
      // Transform image point to world coordinates
      const transformedX = transform.tx + transform.scale * (p.imageX * cosR - p.imageY * sinR);
      const transformedY = transform.ty + transform.scale * (p.imageX * sinR + p.imageY * cosR);

      // Residual = difference between transformed and actual world point
      const dx = transformedX - p.worldX;
      const dy = transformedY - p.worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      residuals.push({ dx, dy, dist });
      sumSquaredDist += dist * dist;
    }

    // Calculate RMS error
    const rmsError = Math.sqrt(sumSquaredDist / image.georefPoints.length);

    image.transform = transform;
    image.residuals = residuals;
    image.rmsError = rmsError;
    image.isGeoreferenced = true;

    // Apply transform to fabric image
    const fabricImg = image.fabricImage;
    fabricImg.set({
      scaleX: transform.scale,
      scaleY: transform.scale,
      angle: -transform.rotation,
    });

    fabricCanvas.renderAll();
    importedImages = [...importedImages];
    cancelGeoreferencing();
  }

  // Export World File (.pgw, .jgw, .tfw)
  function exportWorldFile(imageId: string) {
    const image = importedImages.find(i => i.id === imageId);
    if (!image || !image.transform || !image.isGeoreferenced) {
      alert('Image non georeferencee');
      return;
    }

    const t = image.transform;
    const cosR = Math.cos(t.rotation * Math.PI / 180);
    const sinR = Math.sin(t.rotation * Math.PI / 180);

    // World file format:
    // Line 1: pixel size in x direction (scale * cos(rotation))
    // Line 2: rotation about y axis (scale * sin(rotation))
    // Line 3: rotation about x axis (-scale * sin(rotation))
    // Line 4: pixel size in y direction (-scale * cos(rotation)) - negative because Y is inverted
    // Line 5: x coordinate of center of upper left pixel
    // Line 6: y coordinate of center of upper left pixel

    const A = t.scale * cosR;      // x-scale
    const D = t.scale * sinR;      // rotation term
    const B = -t.scale * sinR;     // rotation term
    const E = -t.scale * cosR;     // y-scale (negative)
    const C = t.tx;                // x-translation (upper-left corner)
    const F = t.ty + (image.originalHeight || 0) * t.scale * cosR; // y-translation

    const worldFileContent = `${A.toFixed(10)}
${D.toFixed(10)}
${B.toFixed(10)}
${E.toFixed(10)}
${C.toFixed(2)}
${F.toFixed(2)}`;

    // Determine extension based on image name
    const name = image.name.toLowerCase();
    let ext = 'wld';
    if (name.includes('.png')) ext = 'pgw';
    else if (name.includes('.jpg') || name.includes('.jpeg')) ext = 'jgw';
    else if (name.includes('.tif') || name.includes('.tiff')) ext = 'tfw';
    else if (name.includes('.pdf')) ext = 'pgw'; // PDF -> PNG -> pgw

    const baseName = image.name.replace(/\.[^.]+$/, '').replace(/\s*\(p\.\d+\/\d+\)/, '');
    const fileName = `${baseName}.${ext}`;

    // Create download
    const blob = new Blob([worldFileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Delete a georef point
  function deleteGeorefPoint(imageId: string, pointIndex: number) {
    const image = importedImages.find(i => i.id === imageId);
    if (image) {
      image.georefPoints = image.georefPoints.filter((_, i) => i !== pointIndex);
      importedImages = [...importedImages];
    }
  }

  // Render all entities (optimized with layerMap)
  function renderAllEntities(autoZoom = true) {
    if (!fabricCanvas || !fabric) return;

    // Clear non-image and non-measurement objects
    const objectsToRemove = fabricCanvas.getObjects().filter((o: any) => !o._isImage && o !== measureLine && o !== measurePolygon);
    objectsToRemove.forEach((o: any) => fabricCanvas.remove(o));

    if (gridEnabled) drawGrid();

    // Collect bounds and create objects
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const objectsToAdd: any[] = [];

    for (const entity of entities) {
      // Use layerMap for O(1) lookup instead of O(n) find
      const layer = layerMap.get(entity.layer);
      if (layer && !layer.visible) continue;

      const color = entity.data?.color || getColor(entity.color === 256 ? (layer?.color || 7) : entity.color);
      const opacity = layer?.opacity ?? 1;
      const strokeWidth = layer?.strokeWidth ?? 1;
      const obj = createFabricObject(entity, color, layer?.locked || false, opacity, strokeWidth);

      if (obj) {
        objectsToAdd.push(obj);
        const bounds = obj.getBoundingRect();
        minX = Math.min(minX, bounds.left);
        minY = Math.min(minY, bounds.top);
        maxX = Math.max(maxX, bounds.left + bounds.width);
        maxY = Math.max(maxY, bounds.top + bounds.height);
      }
    }

    // Batch add for better performance
    if (objectsToAdd.length > 0) {
      fabricCanvas.add(...objectsToAdd);
    }

    // Auto zoom if we have entities and autoZoom is enabled
    if (autoZoom && entities.length > 0 && minX !== Infinity) {
      zoomToBounds(minX, minY, maxX, maxY);
    }

    fabricCanvas.renderAll();
  }

  // Zoom to specific bounds
  function zoomToBounds(minX: number, minY: number, maxX: number, maxY: number) {
    if (!fabricCanvas || !fabric) return;

    const padding = 50;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const scaleX = fabricCanvas.getWidth() / width;
    const scaleY = fabricCanvas.getHeight() / height;
    const scale = Math.min(scaleX, scaleY, 1);

    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fabricCanvas.setZoom(scale);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    viewCenter = { x: centerX, y: -centerY };

    const vpCenter = {
      x: fabricCanvas.getWidth() / 2 / scale - centerX,
      y: fabricCanvas.getHeight() / 2 / scale - centerY
    };
    fabricCanvas.relativePan(new fabric.Point(vpCenter.x * scale, vpCenter.y * scale));

    zoom = Math.round(scale * 100);
  }

  // Calculate bounds from entity data directly (not fabric objects)
  function calculateBounds(layerName?: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasData = false;

    for (const entity of entities) {
      if (layerName && entity.layer !== layerName) continue;
      const layer = layerMap.get(entity.layer);
      if (!layerName && layer && !layer.visible) continue;

      const data = entity.data;
      if (!data) continue;

      // Extract bounds from entity data
      switch (entity.type) {
        case 'LINE':
          if (data.startPoint && data.endPoint) {
            hasData = true;
            minX = Math.min(minX, data.startPoint.x, data.endPoint.x);
            maxX = Math.max(maxX, data.startPoint.x, data.endPoint.x);
            minY = Math.min(minY, -data.startPoint.y, -data.endPoint.y);
            maxY = Math.max(maxY, -data.startPoint.y, -data.endPoint.y);
          } else if (data.vertices?.length >= 2) {
            hasData = true;
            for (const v of data.vertices) {
              minX = Math.min(minX, v.x);
              maxX = Math.max(maxX, v.x);
              minY = Math.min(minY, -v.y);
              maxY = Math.max(maxY, -v.y);
            }
          }
          break;

        case 'LWPOLYLINE':
        case 'POLYLINE':
          if (data.vertices?.length >= 2) {
            hasData = true;
            for (const v of data.vertices) {
              minX = Math.min(minX, v.x);
              maxX = Math.max(maxX, v.x);
              minY = Math.min(minY, -v.y);
              maxY = Math.max(maxY, -v.y);
            }
          }
          break;

        case 'CIRCLE':
          if (data.center && data.radius) {
            hasData = true;
            minX = Math.min(minX, data.center.x - data.radius);
            maxX = Math.max(maxX, data.center.x + data.radius);
            minY = Math.min(minY, -data.center.y - data.radius);
            maxY = Math.max(maxY, -data.center.y + data.radius);
          }
          break;

        case 'ARC':
          if (data.center && data.radius) {
            hasData = true;
            minX = Math.min(minX, data.center.x - data.radius);
            maxX = Math.max(maxX, data.center.x + data.radius);
            minY = Math.min(minY, -data.center.y - data.radius);
            maxY = Math.max(maxY, -data.center.y + data.radius);
          }
          break;

        case 'TEXT':
        case 'MTEXT':
          const pos = data.startPoint || data.position;
          if (pos) {
            hasData = true;
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x + 50);
            minY = Math.min(minY, -pos.y - 20);
            maxY = Math.max(maxY, -pos.y);
          }
          break;

        case 'POINT':
          if (data.position) {
            hasData = true;
            minX = Math.min(minX, data.position.x - 5);
            maxX = Math.max(maxX, data.position.x + 5);
            minY = Math.min(minY, -data.position.y - 5);
            maxY = Math.max(maxY, -data.position.y + 5);
          }
          break;
      }
    }

    return hasData ? { minX, minY, maxX, maxY } : null;
  }

  function createFabricObject(entity: CadEntity, color: string, locked: boolean, opacity: number = 1, strokeWidth: number = 1): any {
    if (!fabric) return null;

    const commonProps = {
      stroke: color,
      strokeWidth: strokeWidth,
      fill: 'transparent',
      opacity: opacity,
      selectable: !locked && selectedTool === 'select',
      evented: !locked,
      data: { handle: entity.handle, type: entity.type, layer: entity.layer },
    };

    const data = entity.data;

    switch (entity.type) {
      case 'LINE':
        // DXF LINE entities have startPoint and endPoint, not vertices
        if (data.startPoint && data.endPoint) {
          return new fabric.Line(
            [data.startPoint.x, -data.startPoint.y, data.endPoint.x, -data.endPoint.y],
            commonProps
          );
        }
        // Fallback for vertices array (PostGIS entities)
        if (data.vertices?.length >= 2) {
          return new fabric.Line(
            [data.vertices[0].x, -data.vertices[0].y, data.vertices[1].x, -data.vertices[1].y],
            commonProps
          );
        }
        break;

      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (data.vertices?.length >= 2) {
          const points = data.vertices.map((v: any) => ({ x: v.x, y: -v.y }));
          if (data.closed || data.shape) {
            return new fabric.Polygon(points, { ...commonProps, fill: color + '20' });
          }
          return new fabric.Polyline(points, commonProps);
        }
        break;

      case 'CIRCLE':
        if (data.center && data.radius) {
          return new fabric.Circle({
            ...commonProps,
            left: data.center.x - data.radius,
            top: -data.center.y - data.radius,
            radius: data.radius,
          });
        }
        break;

      case 'ARC':
        if (data.center && data.radius) {
          const startAngle = (data.startAngle || 0) * Math.PI / 180;
          const endAngle = (data.endAngle || 360) * Math.PI / 180;
          const cx = data.center.x, cy = -data.center.y, r = data.radius;
          const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
          const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
          return new fabric.Path(`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`, commonProps);
        }
        break;

      case 'TEXT':
      case 'MTEXT':
        if (data.startPoint || data.position) {
          const pos = data.startPoint || data.position;
          return new fabric.Text(data.text || '', {
            ...commonProps,
            left: pos.x,
            top: -pos.y,
            fontSize: (data.textHeight || 2.5) * 4,
            fill: color,
            fontFamily: 'Arial',
          });
        }
        break;

      case 'POINT':
        if (data.position) {
          return new fabric.Circle({
            ...commonProps,
            left: data.position.x - 3,
            top: -data.position.y - 3,
            radius: 3,
            fill: color,
          });
        }
        break;
    }

    return null;
  }

  function drawGrid() {
    if (!fabricCanvas || !fabric) return;
    const gridSize = 100;
    for (let i = -5000; i <= 5000; i += gridSize) {
      fabricCanvas.add(new fabric.Line([i, -5000, i, 5000], {
        stroke: '#2d3548', strokeWidth: 0.5, selectable: false, evented: false,
      }));
      fabricCanvas.add(new fabric.Line([-5000, i, 5000, i], {
        stroke: '#2d3548', strokeWidth: 0.5, selectable: false, evented: false,
      }));
    }
  }

  // Tools
  function setTool(tool: typeof selectedTool) {
    // Cancel any active operations when switching tools
    if (selectedTool !== tool) {
      if (selectedTool === 'measure-dist' || selectedTool === 'measure-area') {
        cancelMeasurement();
      }
      if (selectedTool.startsWith('draw-')) {
        cancelDrawing();
      }
    }

    selectedTool = tool;
    if (fabricCanvas) {
      fabricCanvas.selection = tool === 'select';
      let cursor = 'default';
      if (tool === 'pan') cursor = 'grab';
      else if (tool.startsWith('draw-')) cursor = 'crosshair';
      else if (tool.startsWith('measure-')) cursor = 'crosshair';
      fabricCanvas.defaultCursor = cursor;
      fabricCanvas.forEachObject((obj: any) => {
        obj.selectable = tool === 'select' && !obj.data?.locked;
      });
    }
  }

  function zoomIn() {
    if (!fabricCanvas) return;
    fabricCanvas.setZoom(Math.min(fabricCanvas.getZoom() * 1.2, 100));
    zoom = Math.round(fabricCanvas.getZoom() * 100);
  }

  function zoomOut() {
    if (!fabricCanvas) return;
    fabricCanvas.setZoom(Math.max(fabricCanvas.getZoom() / 1.2, 0.001));
    zoom = Math.round(fabricCanvas.getZoom() * 100);
  }

  function zoomExtent() {
    const bounds = calculateBounds();
    if (bounds) {
      zoomToBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
      fabricCanvas?.renderAll();
    }
  }

  function zoomToLayer(layerName: string) {
    const bounds = calculateBounds(layerName);
    if (bounds) {
      zoomToBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
      fabricCanvas?.renderAll();
    }
    contextMenuLayer = null;
  }

  // Layer management functions
  function toggleLayerVisibility(layerName: string) {
    layers = layers.map(l => l.name === layerName ? { ...l, visible: !l.visible } : l);
    renderAllEntities(false);
  }

  function toggleLayerLock(layerName: string) {
    layers = layers.map(l => l.name === layerName ? { ...l, locked: !l.locked } : l);
    renderAllEntities(false);
    contextMenuLayer = null;
  }

  function setLayerOpacity(layerName: string, opacity: number) {
    layers = layers.map(l => l.name === layerName ? { ...l, opacity } : l);
    renderAllEntities(false);
  }

  function setLayerStrokeWidth(layerName: string, strokeWidth: number) {
    layers = layers.map(l => l.name === layerName ? { ...l, strokeWidth } : l);
    renderAllEntities(false);
  }

  function setLayerColor(layerName: string, color: string) {
    // Convert hex to ACI index (approximate)
    const colorMap: Record<string, number> = {
      '#FF0000': 1, '#FFFF00': 2, '#00FF00': 3, '#00FFFF': 4,
      '#0000FF': 5, '#FF00FF': 6, '#FFFFFF': 7, '#808080': 8,
      '#00ff88': 10, '#ff6b6b': 11, '#4ecdc4': 12, '#45b7d1': 13
    };
    const colorIndex = colorMap[color] || 7;
    layers = layers.map(l => l.name === layerName ? { ...l, color: colorIndex } : l);
    renderAllEntities(false);
    contextMenuLayer = null;
  }

  function showAllLayers() {
    layers = layers.map(l => ({ ...l, visible: true }));
    renderAllEntities(false);
  }

  function hideAllLayers() {
    layers = layers.map(l => ({ ...l, visible: false }));
    renderAllEntities(false);
  }

  function invertLayerVisibility() {
    layers = layers.map(l => ({ ...l, visible: !l.visible }));
    renderAllEntities(false);
  }

  function isolateLayer(layerName: string) {
    layers = layers.map(l => ({ ...l, visible: l.name === layerName }));
    renderAllEntities(false);
    contextMenuLayer = null;
  }

  function selectLayerEntities(layerName: string) {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects().filter((o: any) => o.data?.layer === layerName && o.selectable);
    fabricCanvas.discardActiveObject();
    if (objects.length > 0) {
      const selection = new fabric.ActiveSelection(objects, { canvas: fabricCanvas });
      fabricCanvas.setActiveObject(selection);
      fabricCanvas.renderAll();
    }
    contextMenuLayer = null;
  }

  function removeLayer(layerName: string) {
    layers = layers.filter(l => l.name !== layerName);
    entities = entities.filter(e => e.layer !== layerName);
    renderAllEntities(false);
    contextMenuLayer = null;
  }

  function getEntityCount(layerName: string): number {
    return entities.filter(e => e.layer === layerName).length;
  }

  function openLayerContextMenu(e: MouseEvent, layerName: string) {
    e.preventDefault();
    contextMenuLayer = layerName;
    contextMenuPos = { x: e.clientX, y: e.clientY };
  }

  // Check if layer is active
  function isLayerActive(table: GeoTable): boolean {
    return layers.some(l => l.name === `${table.schema}.${table.table}` && l.source === 'postgis');
  }

  // ============================================
  // SNAPPING FUNCTIONS
  // ============================================
  function findSnapPoint(x: number, y: number, threshold: number = 10): { x: number; y: number } | null {
    if (!snapEnabled) return null;

    const zoom = fabricCanvas?.getZoom() || 1;
    const snapDist = threshold / zoom;
    let closest: { x: number; y: number; dist: number } | null = null;

    // Snap to grid first if enabled
    if (gridEnabled) {
      const gridSize = 10; // meters
      const snapX = Math.round(x / gridSize) * gridSize;
      const snapY = Math.round(y / gridSize) * gridSize;
      const dist = Math.sqrt((x - snapX) ** 2 + (y - snapY) ** 2);
      if (dist < snapDist) {
        closest = { x: snapX, y: snapY, dist };
      }
    }

    // Snap to entity points
    for (const entity of entities) {
      const layer = layerMap.get(entity.layer);
      if (layer && !layer.visible) continue;

      const points = getEntitySnapPoints(entity);
      for (const pt of points) {
        const dist = Math.sqrt((x - pt.x) ** 2 + (y - pt.y) ** 2);
        if (dist < snapDist && (!closest || dist < closest.dist)) {
          closest = { x: pt.x, y: pt.y, dist };
        }
      }
    }

    // Also snap to current drawing points
    for (const pt of drawingPoints) {
      const dist = Math.sqrt((x - pt.x) ** 2 + (y - pt.y) ** 2);
      if (dist < snapDist && (!closest || dist < closest.dist)) {
        closest = { x: pt.x, y: pt.y, dist };
      }
    }

    return closest ? { x: closest.x, y: closest.y } : null;
  }

  function getEntitySnapPoints(entity: CadEntity): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const data = entity.data;
    if (!data) return points;

    switch (entity.type) {
      case 'LINE':
        if (data.startPoint) points.push({ x: data.startPoint.x, y: data.startPoint.y });
        if (data.endPoint) points.push({ x: data.endPoint.x, y: data.endPoint.y });
        // Midpoint
        if (data.startPoint && data.endPoint) {
          points.push({
            x: (data.startPoint.x + data.endPoint.x) / 2,
            y: (data.startPoint.y + data.endPoint.y) / 2
          });
        }
        break;
      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (data.vertices) {
          for (const v of data.vertices) {
            points.push({ x: v.x, y: v.y });
          }
          // Midpoints
          for (let i = 0; i < data.vertices.length - 1; i++) {
            points.push({
              x: (data.vertices[i].x + data.vertices[i + 1].x) / 2,
              y: (data.vertices[i].y + data.vertices[i + 1].y) / 2
            });
          }
        }
        break;
      case 'CIRCLE':
        if (data.center) {
          points.push({ x: data.center.x, y: data.center.y });
          // Quadrant points
          if (data.radius) {
            points.push({ x: data.center.x + data.radius, y: data.center.y });
            points.push({ x: data.center.x - data.radius, y: data.center.y });
            points.push({ x: data.center.x, y: data.center.y + data.radius });
            points.push({ x: data.center.x, y: data.center.y - data.radius });
          }
        }
        break;
      case 'POINT':
        if (data.position) points.push({ x: data.position.x, y: data.position.y });
        break;
    }
    return points;
  }

  function updateSnapIndicator(pt: { x: number; y: number } | null) {
    if (snapIndicator) {
      fabricCanvas?.remove(snapIndicator);
      snapIndicator = null;
    }

    if (pt && fabric) {
      const canvasX = pt.x - viewCenter.x;
      const canvasY = viewCenter.y - pt.y;
      snapIndicator = new fabric.Circle({
        left: canvasX - 6,
        top: canvasY - 6,
        radius: 6,
        fill: 'rgba(0, 255, 0, 0.3)',
        stroke: '#00ff00',
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      fabricCanvas?.add(snapIndicator);
      fabricCanvas?.renderAll();
    }
    snapPoint = pt;
  }

  // ============================================
  // DRAWING FUNCTIONS
  // ============================================
  function ensureDrawingLayer() {
    if (!layers.some(l => l.name === currentDrawLayer)) {
      const newLayer: CadLayer = {
        name: currentDrawLayer,
        color: 3, // green
        visible: true,
        locked: false,
        opacity: 1,
        strokeWidth: currentStrokeWidth,
        source: 'dxf'
      };
      layers = [...layers, newLayer];
    }
  }

  function saveUndoState() {
    undoStack = [...undoStack, [...entities]];
    redoStack = [];
    // Limit undo history
    if (undoStack.length > 50) undoStack = undoStack.slice(-50);
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack = [...redoStack, [...entities]];
    entities = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);
    renderAllEntities(false);
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack = [...undoStack, [...entities]];
    entities = redoStack[redoStack.length - 1];
    redoStack = redoStack.slice(0, -1);
    renderAllEntities(false);
  }

  function startDrawing(x: number, y: number) {
    ensureDrawingLayer();
    const snapped = findSnapPoint(x, y);
    const pt = snapped || { x, y };
    drawingPoints = [pt];
    isDrawing = true;

    if (selectedTool === 'draw-line') {
      // Line needs 2 points
    } else if (selectedTool === 'draw-polyline') {
      // Polyline accumulates points until Enter
    } else if (selectedTool === 'draw-rect') {
      // Rectangle needs 2 diagonal points
    } else if (selectedTool === 'draw-circle') {
      // Circle: first click = center, second = radius point
    }
  }

  function addDrawingPoint(x: number, y: number) {
    const snapped = findSnapPoint(x, y);
    const pt = snapped || { x, y };

    if (selectedTool === 'draw-line' && drawingPoints.length === 1) {
      // Finish line
      saveUndoState();
      createLineEntity(drawingPoints[0], pt);
      cancelDrawing();
      return;
    }

    if (selectedTool === 'draw-rect' && drawingPoints.length === 1) {
      // Finish rectangle
      saveUndoState();
      createRectEntity(drawingPoints[0], pt);
      cancelDrawing();
      return;
    }

    if (selectedTool === 'draw-circle' && drawingPoints.length === 1) {
      // Finish circle
      saveUndoState();
      const radius = Math.sqrt((pt.x - drawingPoints[0].x) ** 2 + (pt.y - drawingPoints[0].y) ** 2);
      createCircleEntity(drawingPoints[0], radius);
      cancelDrawing();
      return;
    }

    if (selectedTool === 'draw-polyline') {
      drawingPoints = [...drawingPoints, pt];
    }
  }

  function finishPolyline() {
    if (drawingPoints.length >= 2) {
      saveUndoState();
      createPolylineEntity(drawingPoints);
    }
    cancelDrawing();
  }

  function cancelDrawing() {
    drawingPoints = [];
    isDrawing = false;
    if (previewObject) {
      fabricCanvas?.remove(previewObject);
      previewObject = null;
    }
    updateSnapIndicator(null);
  }

  function updateDrawingPreview(x: number, y: number) {
    if (!isDrawing || !fabricCanvas || !fabric) return;

    const snapped = findSnapPoint(x, y);
    const pt = snapped || { x, y };
    updateSnapIndicator(snapped);

    // Apply ortho constraint
    let finalPt = pt;
    if (orthoEnabled && drawingPoints.length > 0) {
      const last = drawingPoints[drawingPoints.length - 1];
      const dx = Math.abs(pt.x - last.x);
      const dy = Math.abs(pt.y - last.y);
      if (dx > dy) {
        finalPt = { x: pt.x, y: last.y };
      } else {
        finalPt = { x: last.x, y: pt.y };
      }
    }

    if (previewObject) {
      fabricCanvas.remove(previewObject);
      previewObject = null;
    }

    const toCanvas = (p: {x: number; y: number}) => ({
      x: p.x - viewCenter.x,
      y: viewCenter.y - p.y
    });

    if (selectedTool === 'draw-line' && drawingPoints.length === 1) {
      const p1 = toCanvas(drawingPoints[0]);
      const p2 = toCanvas(finalPt);
      previewObject = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
        stroke: currentDrawColor,
        strokeWidth: currentStrokeWidth,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
      });
    } else if (selectedTool === 'draw-polyline' && drawingPoints.length >= 1) {
      const pts = [...drawingPoints, finalPt].map(toCanvas);
      previewObject = new fabric.Polyline(pts, {
        stroke: currentDrawColor,
        strokeWidth: currentStrokeWidth,
        fill: 'transparent',
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
      });
    } else if (selectedTool === 'draw-rect' && drawingPoints.length === 1) {
      const p1 = toCanvas(drawingPoints[0]);
      const p2 = toCanvas(finalPt);
      const left = Math.min(p1.x, p2.x);
      const top = Math.min(p1.y, p2.y);
      const width = Math.abs(p2.x - p1.x);
      const height = Math.abs(p2.y - p1.y);
      previewObject = new fabric.Rect({
        left, top, width, height,
        stroke: currentDrawColor,
        strokeWidth: currentStrokeWidth,
        fill: 'transparent',
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
      });
    } else if (selectedTool === 'draw-circle' && drawingPoints.length === 1) {
      const center = toCanvas(drawingPoints[0]);
      const radius = Math.sqrt((finalPt.x - drawingPoints[0].x) ** 2 + (finalPt.y - drawingPoints[0].y) ** 2);
      previewObject = new fabric.Circle({
        left: center.x - radius,
        top: center.y - radius,
        radius,
        stroke: currentDrawColor,
        strokeWidth: currentStrokeWidth,
        fill: 'transparent',
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
      });
    }

    if (previewObject) {
      fabricCanvas.add(previewObject);
      fabricCanvas.renderAll();
    }
  }

  function createLineEntity(p1: {x: number; y: number}, p2: {x: number; y: number}) {
    const entity: CadEntity = {
      type: 'LINE',
      layer: currentDrawLayer,
      color: 3,
      handle: `draw_${Date.now()}`,
      data: {
        startPoint: { x: p1.x, y: p1.y },
        endPoint: { x: p2.x, y: p2.y },
        color: currentDrawColor
      }
    };
    entities = [...entities, entity];
    renderAllEntities(false);
  }

  function createPolylineEntity(pts: {x: number; y: number}[]) {
    const entity: CadEntity = {
      type: 'LWPOLYLINE',
      layer: currentDrawLayer,
      color: 3,
      handle: `draw_${Date.now()}`,
      data: {
        vertices: pts.map(p => ({ x: p.x, y: p.y })),
        closed: false,
        color: currentDrawColor
      }
    };
    entities = [...entities, entity];
    renderAllEntities(false);
  }

  function createRectEntity(p1: {x: number; y: number}, p2: {x: number; y: number}) {
    const vertices = [
      { x: p1.x, y: p1.y },
      { x: p2.x, y: p1.y },
      { x: p2.x, y: p2.y },
      { x: p1.x, y: p2.y },
    ];
    const entity: CadEntity = {
      type: 'LWPOLYLINE',
      layer: currentDrawLayer,
      color: 3,
      handle: `draw_${Date.now()}`,
      data: {
        vertices,
        closed: true,
        shape: true,
        color: currentDrawColor
      }
    };
    entities = [...entities, entity];
    renderAllEntities(false);
  }

  function createCircleEntity(center: {x: number; y: number}, radius: number) {
    const entity: CadEntity = {
      type: 'CIRCLE',
      layer: currentDrawLayer,
      color: 3,
      handle: `draw_${Date.now()}`,
      data: {
        center: { x: center.x, y: center.y },
        radius,
        color: currentDrawColor
      }
    };
    entities = [...entities, entity];
    renderAllEntities(false);
  }

  // ============================================
  // AFFINE TRANSFORM (6 parameters)
  // ============================================
  function computeAffineTransform(points: GeorefPoint[]): { a: number; b: number; c: number; d: number; e: number; f: number } | null {
    if (points.length < 3) return null;

    // Build matrices for least squares: A * [a,b,c,d,e,f]^T = B
    // For each point: worldX = a*imgX + b*imgY + c
    //                 worldY = d*imgX + e*imgY + f
    const n = points.length;
    const A_data: number[][] = [];
    const Bx: number[] = [];
    const By: number[] = [];

    for (const p of points) {
      A_data.push([p.imageX, p.imageY, 1]);
      Bx.push(p.worldX);
      By.push(p.worldY);
    }

    try {
      const A = new Matrix(A_data);
      const Bx_mat = Matrix.columnVector(Bx);
      const By_mat = Matrix.columnVector(By);

      // Solve using pseudo-inverse (least squares)
      const At = A.transpose();
      const AtA = At.mmul(A);
      const AtA_inv = new Matrix(AtA.to2DArray()).pseudoInverse();

      const coeffsX = AtA_inv.mmul(At).mmul(Bx_mat);
      const coeffsY = AtA_inv.mmul(At).mmul(By_mat);

      return {
        a: coeffsX.get(0, 0),
        b: coeffsX.get(1, 0),
        c: coeffsX.get(2, 0),
        d: coeffsY.get(0, 0),
        e: coeffsY.get(1, 0),
        f: coeffsY.get(2, 0)
      };
    } catch (err) {
      console.error('Affine transform error:', err);
      return null;
    }
  }

  function applyAffineGeoreferencing() {
    const image = importedImages.find(i => i.id === selectedImageId);
    if (!image || image.georefPoints.length < 3) {
      alert('Il faut au moins 3 points de calage pour une transformation affine');
      return;
    }

    const affine = computeAffineTransform(image.georefPoints);
    if (!affine) {
      alert('Erreur de calcul de la transformation affine');
      return;
    }

    // Calculate residuals
    const residuals: { dx: number; dy: number; dist: number }[] = [];
    let sumSquaredDist = 0;

    for (const p of image.georefPoints) {
      const transformedX = affine.a * p.imageX + affine.b * p.imageY + affine.c;
      const transformedY = affine.d * p.imageX + affine.e * p.imageY + affine.f;

      const dx = transformedX - p.worldX;
      const dy = transformedY - p.worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      residuals.push({ dx, dy, dist });
      sumSquaredDist += dist * dist;
    }

    const rmsError = Math.sqrt(sumSquaredDist / image.georefPoints.length);

    // Extract scale and rotation from affine matrix
    const scaleX = Math.sqrt(affine.a * affine.a + affine.d * affine.d);
    const scaleY = Math.sqrt(affine.b * affine.b + affine.e * affine.e);
    const rotation = Math.atan2(affine.d, affine.a) * 180 / Math.PI;

    image.transform = { tx: affine.c, ty: affine.f, scale: (scaleX + scaleY) / 2, rotation };
    image.residuals = residuals;
    image.rmsError = rmsError;
    image.isGeoreferenced = true;

    // Apply transform to fabric image (approximation)
    const fabricImg = image.fabricImage;
    fabricImg.set({
      scaleX: scaleX,
      scaleY: scaleY,
      angle: -rotation,
    });

    fabricCanvas?.renderAll();
    importedImages = [...importedImages];
    cancelGeoreferencing();
  }

  // ============================================
  // DXF EXPORT
  // ============================================
  function exportDxf() {
    if (entities.length === 0) {
      alert('Aucune entité à exporter');
      return;
    }

    const dxf = new DxfWriter();

    // Add layers
    const uniqueLayers = new Set(entities.map(e => e.layer));
    for (const layerName of uniqueLayers) {
      const layer = layerMap.get(layerName);
      if (layer) {
        dxf.addLayer(layerName, layer.color, 'CONTINUOUS');
      }
    }

    // Add entities
    for (const entity of entities) {
      const layer = layerMap.get(entity.layer);
      if (layer && !layer.visible) continue;

      const data = entity.data;
      if (!data) continue;

      try {
        switch (entity.type) {
          case 'LINE':
            if (data.startPoint && data.endPoint) {
              dxf.addLine(
                point3d(data.startPoint.x, data.startPoint.y, 0),
                point3d(data.endPoint.x, data.endPoint.y, 0),
                { layerName: entity.layer }
              );
            }
            break;

          case 'LWPOLYLINE':
          case 'POLYLINE':
            if (data.vertices && data.vertices.length >= 2) {
              const pts = data.vertices.map((v: any) => point3d(v.x, v.y, 0));
              dxf.addPolyline2D(pts, { layerName: entity.layer, flags: data.closed ? 1 : 0 });
            }
            break;

          case 'CIRCLE':
            if (data.center && data.radius) {
              dxf.addCircle(point3d(data.center.x, data.center.y, 0), data.radius, { layerName: entity.layer });
            }
            break;

          case 'POINT':
            if (data.position) {
              dxf.addPoint(point3d(data.position.x, data.position.y, 0), { layerName: entity.layer });
            }
            break;
        }
      } catch (err) {
        console.warn('Error exporting entity:', entity.type, err);
      }
    }

    // Generate and download
    const dxfString = dxf.stringify();
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || 'export'}_${new Date().toISOString().slice(0, 10)}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================
  // PRINT FUNCTION
  // ============================================
  function printCanvas() {
    if (!fabricCanvas) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup bloqué. Autorisez les popups pour imprimer.');
      return;
    }

    // Get canvas as image
    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2
    });

    // Build print HTML (use string concatenation to avoid Svelte template issues)
    const title = fileName || 'Plan CAD';
    const dateStr = new Date().toLocaleDateString('fr-CH');
    const entityCount = entities.length;
    const zoomPercent = zoom;

    const printHtml = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '  <title>Impression CAD - ' + title + '</title>',
      '  <style>',
      '    @page { size: A4 landscape; margin: 10mm; }',
      '    body { margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; }',
      '    .header { width: 100%; display: flex; justify-content: space-between; padding: 5mm 0; border-bottom: 1px solid #333; margin-bottom: 5mm; font-family: Arial, sans-serif; font-size: 10pt; }',
      '    img { max-width: 100%; max-height: 85vh; object-fit: contain; }',
      '    .footer { margin-top: 5mm; font-family: Arial, sans-serif; font-size: 8pt; color: #666; }',
      '  </style>',
      '</head>',
      '<body>',
      '  <div class="header">',
      '    <span><strong>' + title + '</strong></span>',
      '    <span>Commune de Bussigny - ' + dateStr + '</span>',
      '    <span>EPSG:2056 (MN95)</span>',
      '  </div>',
      '  <img src="' + dataUrl + '" />',
      '  <div class="footer">',
      '    Genere par GeoMind - Module CAD | ' + entityCount + ' entites | Zoom: ' + zoomPercent + '%',
      '  </div>',
      '  <script>window.onload = function() { window.print(); };<\/script>',
      '</body>',
      '</html>'
    ].join('\n');

    printWindow.document.write(printHtml);
    printWindow.document.close();
  }

  // ============================================
  // EXPORT GEOJSON
  // ============================================
  function exportGeoJSON() {
    if (entities.length === 0) {
      alert('Aucune entité à exporter');
      return;
    }

    const features: any[] = [];

    for (const entity of entities) {
      const layer = layerMap.get(entity.layer);
      if (layer && !layer.visible) continue;

      const data = entity.data;
      if (!data) continue;

      let geometry: any = null;
      const properties: any = {
        type: entity.type,
        layer: entity.layer,
        color: entity.color,
        handle: entity.handle
      };

      try {
        switch (entity.type) {
          case 'LINE':
            if (data.startPoint && data.endPoint) {
              geometry = {
                type: 'LineString',
                coordinates: [
                  [data.startPoint.x, data.startPoint.y],
                  [data.endPoint.x, data.endPoint.y]
                ]
              };
            }
            break;

          case 'LWPOLYLINE':
          case 'POLYLINE':
            if (data.vertices && data.vertices.length >= 2) {
              const coords = data.vertices.map((v: any) => [v.x, v.y]);
              if (data.closed && coords.length >= 3) {
                // Fermer le polygone
                coords.push(coords[0]);
                geometry = {
                  type: 'Polygon',
                  coordinates: [coords]
                };
              } else {
                geometry = {
                  type: 'LineString',
                  coordinates: coords
                };
              }
            }
            break;

          case 'CIRCLE':
            if (data.center && data.radius) {
              // Approximer le cercle avec 64 points
              const points = 64;
              const coords = [];
              for (let i = 0; i <= points; i++) {
                const angle = (i / points) * 2 * Math.PI;
                coords.push([
                  data.center.x + data.radius * Math.cos(angle),
                  data.center.y + data.radius * Math.sin(angle)
                ]);
              }
              geometry = {
                type: 'Polygon',
                coordinates: [coords]
              };
              properties.radius = data.radius;
            }
            break;

          case 'POINT':
            if (data.position) {
              geometry = {
                type: 'Point',
                coordinates: [data.position.x, data.position.y]
              };
            }
            break;
        }

        if (geometry) {
          features.push({
            type: 'Feature',
            geometry,
            properties
          });
        }
      } catch (err) {
        console.warn('Error converting entity to GeoJSON:', entity.type, err);
      }
    }

    const geojson = {
      type: 'FeatureCollection',
      name: fileName || 'export',
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:EPSG::2056' }
      },
      features
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || 'export'}_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================
  // EXPORT SVG
  // ============================================
  function exportSVG() {
    if (!fabricCanvas) return;

    const svg = fabricCanvas.toSVG({
      width: fabricCanvas.width,
      height: fabricCanvas.height,
      viewBox: {
        x: 0,
        y: 0,
        width: fabricCanvas.width,
        height: fabricCanvas.height
      }
    });

    // Ajouter metadata et titre
    const title = fileName || 'Plan CAD';
    const dateStr = new Date().toISOString().slice(0, 10);
    const svgWithMeta = svg.replace(
      '<svg ',
      `<svg xmlns:dc="http://purl.org/dc/elements/1.1/" `
    ).replace(
      '</defs>',
      `</defs>
      <title>${title} - ${dateStr}</title>
      <desc>Exporté depuis GeoMind CAD - EPSG:2056 - ${entities.length} entités</desc>`
    );

    const blob = new Blob([svgWithMeta], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || 'export'}_${dateStr}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================
  // EXPORT PDF VECTORISE
  // ============================================
  function exportPDF() {
    if (!fabricCanvas) return;

    // Obtenir le SVG du canvas
    const svg = fabricCanvas.toSVG({
      width: fabricCanvas.width,
      height: fabricCanvas.height
    });

    // Créer un élément SVG temporaire
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    // Calculer les dimensions pour A4 paysage
    const pageWidth = 297; // mm
    const pageHeight = 210; // mm
    const margin = 10; // mm
    const contentWidth = pageWidth - 2 * margin;
    const contentHeight = pageHeight - 2 * margin - 20; // 20mm pour header/footer

    // Ratio du canvas
    const canvasRatio = fabricCanvas.width / fabricCanvas.height;
    let svgWidth = contentWidth;
    let svgHeight = contentWidth / canvasRatio;

    if (svgHeight > contentHeight) {
      svgHeight = contentHeight;
      svgWidth = contentHeight * canvasRatio;
    }

    // Créer le PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Header
    const title = fileName || 'Plan CAD';
    const dateStr = new Date().toLocaleDateString('fr-CH');
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin, margin + 5);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Commune de Bussigny - ${dateStr}`, pageWidth / 2, margin + 5, { align: 'center' });
    pdf.text('EPSG:2056 (MN95)', pageWidth - margin, margin + 5, { align: 'right' });

    // Ligne de séparation
    pdf.setDrawColor(100);
    pdf.line(margin, margin + 8, pageWidth - margin, margin + 8);

    // Centrer le SVG
    const xOffset = margin + (contentWidth - svgWidth) / 2;
    const yOffset = margin + 12;

    // Ajouter le SVG au PDF
    svgElement.setAttribute('width', String(svgWidth));
    svgElement.setAttribute('height', String(svgHeight));

    pdf.svg(svgElement, {
      x: xOffset,
      y: yOffset,
      width: svgWidth,
      height: svgHeight
    }).then(() => {
      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(
        `Généré par GeoMind - Module CAD | ${entities.length} entités | Zoom: ${zoom}%`,
        pageWidth / 2,
        pageHeight - margin,
        { align: 'center' }
      );

      // Télécharger
      pdf.save(`${fileName || 'export'}_${new Date().toISOString().slice(0, 10)}.pdf`);
    }).catch((err: any) => {
      console.error('Erreur export PDF:', err);
      alert('Erreur lors de l\'export PDF. Essayez l\'export PNG.');
    });
  }

  // ============================================
  // DELETE SELECTED ENTITIES
  // ============================================
  function deleteSelected() {
    const activeObj = fabricCanvas?.getActiveObject();
    if (!activeObj) return;

    saveUndoState();

    if (activeObj.type === 'activeSelection') {
      // Multiple selection
      const handles = activeObj.getObjects().map((o: any) => o.data?.handle).filter(Boolean);
      entities = entities.filter(e => !handles.includes(e.handle));
    } else if (activeObj.data?.handle) {
      // Single selection
      entities = entities.filter(e => e.handle !== activeObj.data.handle);
    }

    fabricCanvas?.discardActiveObject();
    renderAllEntities(false);
  }
</script>

<div class="cad-module">
  <!-- Toolbar -->
  <div class="cad-toolbar">
    <!-- File group -->
    <div class="toolbar-group">
      <label class="toolbar-btn" title="Ouvrir DXF">
        <input type="file" accept=".dxf" onchange={handleFileSelect} style="display:none" />
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </label>
      <label class="toolbar-btn" title="Importer Image/PDF">
        <input type="file" accept=".png,.jpg,.jpeg,.tif,.tiff,.pdf" onchange={handleImageImport} style="display:none" />
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </label>
    </div>

    <!-- Tools group -->
    <div class="toolbar-group">
      <button class="toolbar-btn" class:active={selectedTool === 'select'} onclick={() => setTool('select')} title="Selection (V)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        </svg>
      </button>
      <button class="toolbar-btn" class:active={selectedTool === 'pan'} onclick={() => setTool('pan')} title="Pan (H)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
          <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
          <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
        </svg>
      </button>
    </div>

    <!-- Drawing tools group -->
    <div class="toolbar-group">
      <button class="toolbar-btn" class:active={selectedTool === 'draw-line'} onclick={() => setTool('draw-line')} title="Ligne (L)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="19" x2="19" y2="5"/>
        </svg>
      </button>
      <button class="toolbar-btn" class:active={selectedTool === 'draw-polyline'} onclick={() => setTool('draw-polyline')} title="Polyligne (P)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 17 9 11 13 15 21 7"/>
        </svg>
      </button>
      <button class="toolbar-btn" class:active={selectedTool === 'draw-rect'} onclick={() => setTool('draw-rect')} title="Rectangle (R)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="5" width="18" height="14" rx="1"/>
        </svg>
      </button>
      <button class="toolbar-btn" class:active={selectedTool === 'draw-circle'} onclick={() => setTool('draw-circle')} title="Cercle (C)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="9"/>
        </svg>
      </button>
      <!-- Drawing color picker -->
      <input type="color" class="color-input" bind:value={currentDrawColor} title="Couleur de dessin" />
    </div>

    <!-- Measurement group -->
    <div class="toolbar-group">
      <button class="toolbar-btn" class:active={selectedTool === 'measure-dist'} onclick={() => setTool('measure-dist')} title="Mesure Distance (M)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 12h20M12 2v20M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/>
        </svg>
      </button>
      <button class="toolbar-btn" class:active={selectedTool === 'measure-area'} onclick={() => setTool('measure-area')} title="Mesure Surface (A)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="1"/>
          <path d="M3 9h18M9 3v18"/>
        </svg>
      </button>
    </div>

    <!-- Zoom group -->
    <div class="toolbar-group">
      <button class="toolbar-btn" onclick={zoomIn} title="Zoom +">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button class="toolbar-btn" onclick={zoomOut} title="Zoom -">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button class="toolbar-btn" onclick={zoomExtent} title="Zoom Etendue (F)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </button>
    </div>

    <!-- Edit group (undo/redo/delete) -->
    <div class="toolbar-group">
      <button class="toolbar-btn" onclick={undo} disabled={undoStack.length === 0} title="Annuler (Ctrl+Z)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
        </svg>
      </button>
      <button class="toolbar-btn" onclick={redo} disabled={redoStack.length === 0} title="Refaire (Ctrl+Y)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
        </svg>
      </button>
      <button class="toolbar-btn" onclick={deleteSelected} title="Supprimer selection">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
      </button>
    </div>

    <!-- Export/Print group -->
    <div class="toolbar-group">
      <button class="toolbar-btn" onclick={exportDxf} title="Exporter DXF">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
      <button class="toolbar-btn" onclick={printCanvas} title="Imprimer (Ctrl+P)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
      </button>
      <button class="toolbar-btn" onclick={exportGeoJSON} title="Exporter GeoJSON">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </button>
      <button class="toolbar-btn" onclick={exportSVG} title="Exporter SVG">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M7 8h2l2 4-2 4H7"/>
          <path d="M15 8h2l-2 4 2 4h-2"/>
        </svg>
      </button>
      <button class="toolbar-btn" onclick={exportPDF} title="Exporter PDF vectorisé">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="M9 15h6"/>
          <path d="M9 11h6"/>
        </svg>
      </button>
    </div>

    <div class="toolbar-spacer"></div>

    {#if fileName}
      <span class="file-name">{fileName}</span>
    {/if}

    <!-- Measurement display -->
    {#if measureDistance > 0 || measureArea > 0}
      <div class="measure-display">
        {#if selectedTool === 'measure-dist' && measureDistance > 0}
          <span class="measure-value">{measureDistance.toFixed(2)} m</span>
        {:else if selectedTool === 'measure-area' && measureArea > 0}
          <span class="measure-value">{measureArea.toFixed(2)} m²</span>
        {/if}
        <button class="measure-copy" onclick={copyMeasurement} title="Copier">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>
        <button class="measure-clear" onclick={cancelMeasurement} title="Effacer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    {/if}
  </div>

  <!-- Main area -->
  <div class="cad-main">
    <!-- Left panel -->
    <div class="cad-panel">
      <!-- Panel tabs -->
      <div class="panel-tabs">
        <button class="panel-tab" class:active={activePanel === 'layers'} onclick={() => activePanel = 'layers'}>
          Calques
        </button>
        <button class="panel-tab" class:active={activePanel === 'sources'} onclick={() => activePanel = 'sources'}>
          Sources
        </button>
        <button class="panel-tab" class:active={activePanel === 'georef'} onclick={() => activePanel = 'georef'}>
          Calage
        </button>
      </div>

      <div class="panel-content">
        {#if activePanel === 'layers'}
          <!-- Layer actions bar -->
          {#if layers.length > 0}
            <div class="layer-actions-bar">
              <button class="layer-action-btn" onclick={showAllLayers} title="Afficher tout">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button class="layer-action-btn" onclick={hideAllLayers} title="Masquer tout">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
              <button class="layer-action-btn" onclick={invertLayerVisibility} title="Inverser">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 4v6h-6M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
              </button>
              <span class="layer-count">{layers.length} calques</span>
            </div>
          {/if}

          <!-- Active layers list -->
          {#if layers.length === 0}
            <div class="empty-panel">
              <p>Aucun calque</p>
              <small>Chargez un DXF ou une couche PostGIS</small>
            </div>
          {:else}
            {#each layers as layer}
              <div
                class="layer-item-container"
                class:hidden={!layer.visible}
                class:locked={layer.locked}
              >
                <div class="layer-item-row" oncontextmenu={(e) => openLayerContextMenu(e, layer.name)}>
                  <button class="layer-visibility" onclick={() => toggleLayerVisibility(layer.name)}>
                    {#if layer.visible}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    {:else}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    {/if}
                  </button>
                  <button class="layer-lock-btn" onclick={() => toggleLayerLock(layer.name)} title={layer.locked ? 'Deverrouiller' : 'Verrouiller'}>
                    {#if layer.locked}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    {:else}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/>
                      </svg>
                    {/if}
                  </button>
                  <span class="layer-name" title={layer.name}>{layer.name}</span>
                  <span class="layer-count-badge">{getEntityCount(layer.name)}</span>
                  <button class="layer-remove" onclick={() => removeLayer(layer.name)} title="Supprimer">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <!-- Inline style controls -->
                <div class="layer-style-row">
                  <input
                    type="color"
                    class="layer-color-picker"
                    value={layer.source === 'postgis' ? layerColors[layers.indexOf(layer) % layerColors.length] : getColor(layer.color)}
                    oninput={(e) => setLayerColor(layer.name, (e.target as HTMLInputElement).value)}
                    title="Couleur"
                  />
                  <input
                    type="range"
                    class="layer-stroke-slider"
                    min="0.5" max="5" step="0.5"
                    value={layer.strokeWidth}
                    oninput={(e) => setLayerStrokeWidth(layer.name, parseFloat((e.target as HTMLInputElement).value))}
                    title="Epaisseur: {layer.strokeWidth}px"
                  />
                  <span class="layer-stroke-value">{layer.strokeWidth}px</span>
                  <input
                    type="range"
                    class="layer-opacity-slider"
                    min="0" max="1" step="0.1"
                    value={layer.opacity}
                    oninput={(e) => setLayerOpacity(layer.name, parseFloat((e.target as HTMLInputElement).value))}
                    title="Opacite: {Math.round(layer.opacity * 100)}%"
                  />
                  <span class="layer-opacity-value">{Math.round(layer.opacity * 100)}%</span>
                </div>
              </div>
            {/each}
          {/if}

        {:else if activePanel === 'sources'}
          <!-- PostGIS data sources -->
          <div class="sources-panel">
            <div class="connection-selector">
              <label>Connexion</label>
              <select bind:value={selectedConnectionId} onchange={() => loadGeoTables()}>
                {#each connections as conn}
                  <option value={conn.id}>{conn.name}</option>
                {/each}
              </select>
            </div>

            <div class="table-search">
              <input type="text" placeholder="Rechercher..." bind:value={tableSearch} />
            </div>

            {#if loadingTables}
              <div class="loading">Chargement...</div>
            {:else}
              <div class="tables-list">
                {#each Object.entries(getTablesBySchema()) as [schema, tables]}
                  <div class="schema-group">
                    <button class="schema-header" onclick={() => toggleSchema(schema)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        {#if expandedSchemas.has(schema)}
                          <polyline points="6 9 12 15 18 9"/>
                        {:else}
                          <polyline points="9 18 15 12 9 6"/>
                        {/if}
                      </svg>
                      <span>{schema}</span>
                      <span class="table-count">{tables.length}</span>
                    </button>

                    {#if expandedSchemas.has(schema)}
                      <div class="schema-tables">
                        {#each tables as table}
                          <button
                            class="table-item"
                            class:active={isLayerActive(table)}
                            onclick={() => loadPostGISLayer(table)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              {#if table.geometryType.includes('POINT')}
                                <circle cx="12" cy="12" r="3"/>
                              {:else if table.geometryType.includes('LINE')}
                                <path d="M3 17l6-6 4 4 8-8"/>
                              {:else}
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                              {/if}
                            </svg>
                            <span>{table.table}</span>
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>

        {:else if activePanel === 'georef'}
          <!-- Georeferencing panel -->
          <div class="georef-panel">
            <h4>Images importees</h4>

            {#if importedImages.length === 0}
              <div class="empty-panel">
                <p>Aucune image</p>
                <small>Importez une image ou un PDF</small>
              </div>
            {:else}
              {#each importedImages as image}
                <div class="image-card" class:georeferenced={image.isGeoreferenced}>
                  <div class="image-header">
                    <span class="image-name" title={image.name}>{image.name}</span>
                    <span class="georef-badge" class:success={image.isGeoreferenced}>
                      {image.isGeoreferenced ? 'Cale' : `${image.georefPoints.length} pts`}
                    </span>
                  </div>

                  {#if image.isGeoreferenced && image.rmsError !== undefined}
                    <div class="georef-results">
                      <div class="rms-display" class:good={image.rmsError < 1} class:warn={image.rmsError >= 1 && image.rmsError < 5} class:bad={image.rmsError >= 5}>
                        <span class="rms-label">RMS:</span>
                        <span class="rms-value">{image.rmsError.toFixed(3)} m</span>
                      </div>
                      {#if image.residuals}
                        <div class="residuals-list">
                          {#each image.residuals as res, i}
                            <div class="residual-item">
                              <span class="res-num">P{i + 1}</span>
                              <span class="res-val" class:good={res.dist < 0.5} class:warn={res.dist >= 0.5 && res.dist < 2} class:bad={res.dist >= 2}>
                                {res.dist.toFixed(3)}m
                              </span>
                            </div>
                          {/each}
                        </div>
                      {/if}
                      <div class="georef-export-actions">
                        <button class="btn-export" onclick={() => exportWorldFile(image.id)} title="Telecharger le world file">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          World File
                        </button>
                        <button class="btn-recal" onclick={() => { image.isGeoreferenced = false; image.georefPoints = []; importedImages = [...importedImages]; }}>
                          Recaler
                        </button>
                      </div>
                    </div>
                  {:else if !image.isGeoreferenced}
                    <div class="image-actions">
                      <button class="georef-btn" onclick={() => startGeoreferencing(image.id)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="22" y1="12" x2="18" y2="12"/>
                          <line x1="6" y1="12" x2="2" y2="12"/>
                          <line x1="12" y1="6" x2="12" y2="2"/>
                          <line x1="12" y1="22" x2="12" y2="18"/>
                        </svg>
                        Caler
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            {/if}

            {#if georefMode}
              <div class="georef-active">
                <h4>Mode calage actif</h4>
                <p class="georef-instruction">
                  {#if currentGeorefPoint === 'image'}
                    <span class="step-badge">1</span> Cliquez sur l'<strong>IMAGE</strong> (point source)
                  {:else}
                    <span class="step-badge">2</span> Cliquez sur la <strong>CARTE</strong> (point destination MN95)
                  {/if}
                </p>

                {#if selectedImageId}
                  {@const img = importedImages.find(i => i.id === selectedImageId)}
                  {#if img && img.georefPoints.length > 0}
                    <div class="georef-points">
                      <div class="points-header">Points de calage</div>
                      {#each img.georefPoints as pt, i}
                        <div class="georef-point">
                          <span class="point-num">{i + 1}</span>
                          <span class="point-coords">
                            ({pt.imageX.toFixed(0)}, {pt.imageY.toFixed(0)}) → ({pt.worldX.toFixed(0)}, {pt.worldY.toFixed(0)})
                          </span>
                          <button class="point-delete" onclick={() => deleteGeorefPoint(img.id, i)} title="Supprimer">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      {/each}
                    </div>
                  {/if}
                {/if}

                <div class="georef-actions">
                  <button class="btn-apply btn-helmert" onclick={applyGeoreferencing} disabled={!selectedImageId || (importedImages.find(i => i.id === selectedImageId)?.georefPoints.length || 0) < 2}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Helmert (2+ pts)
                  </button>
                  <button class="btn-apply btn-affine" onclick={applyAffineGeoreferencing} disabled={!selectedImageId || (importedImages.find(i => i.id === selectedImageId)?.georefPoints.length || 0) < 3}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Affine (3+ pts)
                  </button>
                </div>
                <div class="georef-actions" style="margin-top: 8px;">
                  <button class="btn-cancel" onclick={cancelGeoreferencing} style="flex: 1;">
                    Annuler
                  </button>
                </div>
                <p class="georef-hint">Helmert: 4 params (rotation uniforme) | Affine: 6 params (distorsion)</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Canvas area - Split view when georeferencing -->
    {#if georefMode}
      <div class="cad-canvas-split">
        <!-- Left side: Image to georeference -->
        <div class="georef-pane georef-image-pane">
          <div class="pane-header">
            <span class="pane-title">IMAGE A CALER</span>
            <span class="pane-status" class:active={currentGeorefPoint === 'image'}>
              {currentGeorefPoint === 'image' ? 'Cliquez ici' : 'En attente'}
            </span>
          </div>
          <div class="pane-canvas">
            <canvas bind:this={georefCanvasElement}></canvas>
          </div>
        </div>

        <!-- Divider -->
        <div class="split-divider">
          <div class="divider-handle"></div>
        </div>

        <!-- Right side: Reference map/DXF -->
        <div class="georef-pane georef-ref-pane">
          <div class="pane-header">
            <span class="pane-title">CARTE DE REFERENCE (DXF)</span>
            <span class="pane-status" class:active={currentGeorefPoint === 'world'}>
              {currentGeorefPoint === 'world' ? 'Cliquez ici' : 'En attente'}
            </span>
          </div>
          <div class="pane-canvas">
            <canvas bind:this={canvasElement}></canvas>
          </div>
        </div>
      </div>
    {:else}
      <div class="cad-canvas-area">
        <canvas bind:this={canvasElement}></canvas>

        {#if entities.length === 0 && importedImages.length === 0}
          <div class="canvas-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <h3>Module CAD</h3>
            <p>Chargez un DXF, une couche PostGIS ou une image</p>
          </div>
        {/if}

        {#if pdfLoading}
          <div class="pdf-loading-overlay">
            <div class="pdf-loading-content">
              <svg class="pdf-spinner" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              <span>Chargement PDF...</span>
              <div class="pdf-progress-bar">
                <div class="pdf-progress-fill" style="width: {pdfLoadingProgress}%"></div>
              </div>
              <span class="pdf-progress-text">{pdfLoadingProgress}%</span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Status bar -->
  <div class="cad-status-bar">
    <div class="status-left">
      <span class="status-mode" class:active={selectedTool !== 'select'} class:drawing={selectedTool.startsWith('draw-')}>
        {#if selectedTool === 'select'}Selection
        {:else if selectedTool === 'pan'}Pan
        {:else if selectedTool === 'measure-dist'}Mesure Distance
        {:else if selectedTool === 'measure-area'}Mesure Surface
        {:else if selectedTool === 'draw-line'}Ligne
        {:else if selectedTool === 'draw-polyline'}Polyligne
        {:else if selectedTool === 'draw-rect'}Rectangle
        {:else if selectedTool === 'draw-circle'}Cercle
        {/if}
      </span>
      {#if isDrawing}
        <span class="status-drawing">
          {drawingPoints.length} pts | {selectedTool === 'draw-polyline' ? 'Enter pour finir' : 'Cliquez'}
        </span>
      {/if}
      {#if snapPoint}
        <span class="status-snap">SNAP</span>
      {/if}
      {#if selectedEntityInfo}
        <span class="status-selection">
          {selectedEntityInfo.type} | {selectedEntityInfo.layer}
        </span>
      {/if}
    </div>
    <div class="status-coords">
      <span>E: {cursorX.toLocaleString('fr-CH')}</span>
      <span>N: {cursorY.toLocaleString('fr-CH')}</span>
    </div>
    <div class="status-center">
      <span>Zoom: {zoom}%</span>
      <span>Entites: {entities.length}</span>
    </div>
    <div class="status-toggles">
      <button class="status-toggle" class:active={snapEnabled} onclick={() => snapEnabled = !snapEnabled}>SNAP</button>
      <button class="status-toggle" class:active={gridEnabled} onclick={() => { gridEnabled = !gridEnabled; renderAllEntities(false); }}>GRID</button>
      <button class="status-toggle" class:active={orthoEnabled} onclick={() => orthoEnabled = !orthoEnabled}>ORTHO</button>
      <span class="status-srid">EPSG:2056</span>
    </div>
  </div>

  <!-- Layer context menu -->
  {#if contextMenuLayer}
    <div class="context-menu-overlay" onclick={() => contextMenuLayer = null}></div>
    <div class="layer-context-menu" style="left: {contextMenuPos.x}px; top: {contextMenuPos.y}px;">
      <div class="context-menu-header">{contextMenuLayer}</div>
      <button onclick={() => zoomToLayer(contextMenuLayer!)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
        Zoomer sur le calque
      </button>
      <button onclick={() => isolateLayer(contextMenuLayer!)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
        </svg>
        Isoler
      </button>
      <button onclick={() => selectLayerEntities(contextMenuLayer!)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        </svg>
        Selectionner tout
      </button>
      <div class="context-menu-divider"></div>
      <button onclick={() => toggleLayerLock(contextMenuLayer!)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if layerMap.get(contextMenuLayer!)?.locked}
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/>
          {:else}
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          {/if}
        </svg>
        {layerMap.get(contextMenuLayer!)?.locked ? 'Deverrouiller' : 'Verrouiller'}
      </button>
      <div class="context-menu-divider"></div>
      <div class="context-menu-colors">
        <span>Couleur:</span>
        {#each ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FFFFFF'] as color}
          <button
            class="color-swatch"
            style="background-color: {color}"
            onclick={() => setLayerColor(contextMenuLayer!, color)}
          ></button>
        {/each}
      </div>
      <div class="context-menu-slider">
        <span>Opacite:</span>
        <input
          type="range"
          min="0" max="1" step="0.1"
          value={layerMap.get(contextMenuLayer!)?.opacity ?? 1}
          oninput={(e) => setLayerOpacity(contextMenuLayer!, parseFloat((e.target as HTMLInputElement).value))}
        />
        <span class="slider-value">{Math.round((layerMap.get(contextMenuLayer!)?.opacity ?? 1) * 100)}%</span>
      </div>
      <div class="context-menu-slider">
        <span>Epaisseur:</span>
        <input
          type="range"
          min="0.5" max="5" step="0.5"
          value={layerMap.get(contextMenuLayer!)?.strokeWidth ?? 1}
          oninput={(e) => setLayerStrokeWidth(contextMenuLayer!, parseFloat((e.target as HTMLInputElement).value))}
        />
        <span class="slider-value">{layerMap.get(contextMenuLayer!)?.strokeWidth ?? 1}px</span>
      </div>
      <div class="context-menu-divider"></div>
      <button class="danger" onclick={() => removeLayer(contextMenuLayer!)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
        Supprimer
      </button>
    </div>
  {/if}
</div>

<style>
  .cad-module {
    --cad-bg: #1a1f2e;
    --cad-bg-secondary: #242b3d;
    --cad-bg-tertiary: #2d3548;
    --cad-border: #3d4659;
    --cad-text: #e8eaed;
    --cad-text-muted: #9aa0a6;
    --cad-accent: #4f8cff;
    --cad-accent-hover: #6ba1ff;
    --cad-success: #34d399;
    --cad-warning: #fbbf24;
    --cad-danger: #f87171;

    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--cad-bg);
    color: var(--cad-text);
    font-family: 'Segoe UI', -apple-system, sans-serif;
  }

  .cad-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--cad-bg-secondary);
    border-bottom: 1px solid var(--cad-border);
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 8px;
    border-right: 1px solid var(--cad-border);
  }

  .toolbar-group:last-child { border-right: none; }
  .toolbar-spacer { flex: 1; }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--cad-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .toolbar-btn:hover { background: var(--cad-bg-tertiary); color: var(--cad-text); }
  .toolbar-btn.active { background: var(--cad-accent); color: white; }

  .file-name { font-size: 12px; color: var(--cad-text-muted); }

  /* Measurement display in toolbar */
  .measure-display {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: rgba(255, 204, 0, 0.15);
    border: 1px solid #ffcc00;
    border-radius: 4px;
    margin-left: 8px;
  }

  .measure-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 600;
    color: #ffcc00;
  }

  .measure-copy, .measure-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 3px;
    color: #ffcc00;
    cursor: pointer;
    transition: all 0.15s;
  }

  .measure-copy:hover, .measure-clear:hover {
    background: rgba(255, 204, 0, 0.2);
  }

  .cad-main {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .cad-panel {
    width: 280px;
    min-width: 280px;
    background: var(--cad-bg-secondary);
    border-right: 1px solid var(--cad-border);
    display: flex;
    flex-direction: column;
  }

  .panel-tabs {
    display: flex;
    border-bottom: 1px solid var(--cad-border);
  }

  .panel-tab {
    flex: 1;
    padding: 10px;
    background: transparent;
    border: none;
    color: var(--cad-text-muted);
    font-size: 12px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }

  .panel-tab:hover { color: var(--cad-text); }
  .panel-tab.active {
    color: var(--cad-accent);
    border-bottom-color: var(--cad-accent);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .empty-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--cad-text-muted);
    text-align: center;
    padding: 20px;
  }

  .empty-panel p { margin: 0 0 4px; }
  .empty-panel small { font-size: 11px; opacity: 0.7; }

  /* Layer actions bar */
  .layer-actions-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--cad-border);
    margin-bottom: 4px;
  }

  .layer-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: transparent;
    border: 1px solid var(--cad-border);
    border-radius: 4px;
    color: var(--cad-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .layer-action-btn:hover {
    background: var(--cad-bg-tertiary);
    color: var(--cad-text);
    border-color: var(--cad-accent);
  }

  .layer-count {
    margin-left: auto;
    font-size: 10px;
    color: var(--cad-text-muted);
  }

  .layer-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: context-menu;
    transition: background 0.15s;
  }

  .layer-item:hover { background: var(--cad-bg-tertiary); }
  .layer-item.hidden { opacity: 0.5; }
  .layer-item.locked { background: rgba(255, 255, 255, 0.03); }

  .layer-visibility {
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--cad-text-muted);
    display: flex;
    flex-shrink: 0;
  }

  .layer-visibility:hover { color: var(--cad-accent); }

  .layer-lock-icon {
    color: var(--cad-warning);
    flex-shrink: 0;
  }

  .layer-color {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    border: 1px solid rgba(255,255,255,0.2);
    flex-shrink: 0;
  }

  .layer-name {
    flex: 1;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .layer-count-badge {
    font-size: 9px;
    color: var(--cad-text-muted);
    background: var(--cad-bg);
    padding: 1px 5px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .layer-remove {
    background: transparent;
    border: none;
    color: var(--cad-text-muted);
    cursor: pointer;
    padding: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .layer-item:hover .layer-remove { opacity: 1; }
  .layer-remove:hover { color: var(--cad-danger); }

  /* Sources panel */
  .sources-panel { display: flex; flex-direction: column; gap: 8px; }

  .connection-selector label {
    display: block;
    font-size: 11px;
    color: var(--cad-text-muted);
    margin-bottom: 4px;
  }

  .connection-selector select {
    width: 100%;
    padding: 8px;
    background: var(--cad-bg);
    border: 1px solid var(--cad-border);
    border-radius: 4px;
    color: var(--cad-text);
    font-size: 12px;
  }

  .table-search input {
    width: 100%;
    padding: 8px;
    background: var(--cad-bg);
    border: 1px solid var(--cad-border);
    border-radius: 4px;
    color: var(--cad-text);
    font-size: 12px;
  }

  .tables-list { margin-top: 8px; }

  .schema-group { margin-bottom: 4px; }

  .schema-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px;
    background: transparent;
    border: none;
    color: var(--cad-text);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }

  .schema-header:hover { background: var(--cad-bg-tertiary); }
  .table-count { margin-left: auto; font-size: 10px; color: var(--cad-text-muted); }

  .schema-tables { padding-left: 16px; }

  .table-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    background: transparent;
    border: none;
    color: var(--cad-text-muted);
    cursor: pointer;
    font-size: 11px;
    text-align: left;
  }

  .table-item:hover { background: var(--cad-bg-tertiary); color: var(--cad-text); }
  .table-item.active { color: var(--cad-accent); background: rgba(79, 140, 255, 0.1); }

  /* Georef panel */
  .georef-panel h4 {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--cad-text-muted);
  }

  .image-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--cad-bg);
    border-radius: 4px;
    margin-bottom: 4px;
  }

  .image-item.georeferenced { border-left: 3px solid var(--cad-success); }

  .image-name { flex: 1; font-size: 11px; }
  .georef-status { font-size: 10px; color: var(--cad-text-muted); }

  .georef-btn {
    padding: 4px 8px;
    background: var(--cad-accent);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 10px;
    cursor: pointer;
  }

  .georef-active {
    margin-top: 12px;
    padding: 12px;
    background: var(--cad-bg);
    border-radius: 6px;
    border: 1px solid var(--cad-accent);
  }

  .georef-instruction {
    font-size: 12px;
    color: var(--cad-warning);
    margin: 8px 0;
  }

  .georef-points { margin: 8px 0; }
  .georef-point { font-size: 10px; color: var(--cad-text-muted); padding: 2px 0; }

  .georef-actions { display: flex; gap: 8px; margin-top: 12px; }

  .btn-apply, .btn-cancel {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }

  .btn-apply { background: var(--cad-success); color: white; }
  .btn-apply:disabled { background: var(--cad-bg-tertiary); color: var(--cad-text-muted); cursor: not-allowed; }
  .btn-cancel { background: var(--cad-bg-tertiary); color: var(--cad-text); }

  .loading { text-align: center; padding: 20px; color: var(--cad-text-muted); }

  .cad-canvas-area {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #1a1f2e;
  }

  .cad-canvas-area :global(.canvas-container) {
    position: absolute !important;
    top: 0;
    left: 0;
    width: 100% !important;
    height: 100% !important;
  }

  .cad-canvas-area canvas {
    display: block;
  }

  .canvas-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--cad-text-muted);
    text-align: center;
    pointer-events: none;
  }

  .canvas-placeholder svg { margin-bottom: 16px; opacity: 0.3; }
  .canvas-placeholder h3 { margin: 0 0 8px; font-size: 18px; color: var(--cad-text); }

  .georef-overlay {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    background: var(--cad-warning);
    color: #000;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .cad-status-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 4px 12px;
    background: var(--cad-bg-tertiary);
    border-top: 1px solid var(--cad-border);
    font-size: 11px;
    color: var(--cad-text-muted);
  }

  .status-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 200px;
  }

  .status-mode {
    font-weight: 500;
    color: var(--cad-text-muted);
  }

  .status-mode.active {
    color: var(--cad-accent);
  }

  .status-selection {
    font-size: 10px;
    padding: 2px 8px;
    background: var(--cad-bg);
    border-radius: 3px;
    color: var(--cad-accent);
  }

  .status-coords {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    display: flex;
    gap: 16px;
  }

  .status-center {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    display: flex;
    gap: 16px;
    margin-left: auto;
  }

  .status-toggles {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .status-toggle {
    padding: 2px 8px;
    background: transparent;
    border: 1px solid var(--cad-border);
    border-radius: 3px;
    color: var(--cad-text-muted);
    font-size: 10px;
    cursor: pointer;
  }

  .status-toggle.active {
    background: var(--cad-accent);
    border-color: var(--cad-accent);
    color: white;
  }

  .status-srid {
    padding-left: 12px;
    border-left: 1px solid var(--cad-border);
    font-family: 'JetBrains Mono', 'Consolas', monospace;
  }

  /* Layer context menu */
  .context-menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
  }

  .layer-context-menu {
    position: fixed;
    z-index: 1000;
    min-width: 180px;
    background: var(--cad-bg-secondary);
    border: 1px solid var(--cad-border);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    padding: 4px 0;
  }

  .layer-context-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: var(--cad-text);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .layer-context-menu button:hover {
    background: var(--cad-bg-tertiary);
  }

  .layer-context-menu button.danger {
    color: var(--cad-danger);
  }

  .layer-context-menu button.danger:hover {
    background: rgba(248, 113, 113, 0.1);
  }

  .context-menu-divider {
    height: 1px;
    background: var(--cad-border);
    margin: 4px 0;
  }

  .context-menu-colors {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
  }

  .context-menu-colors span {
    font-size: 11px;
    color: var(--cad-text-muted);
  }

  .color-swatch {
    width: 18px !important;
    height: 18px !important;
    min-width: 18px;
    padding: 0 !important;
    border-radius: 3px !important;
    border: 1px solid rgba(255, 255, 255, 0.3) !important;
  }

  .color-swatch:hover {
    transform: scale(1.1);
    border-color: white !important;
  }

  .context-menu-header {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--cad-text-muted);
    border-bottom: 1px solid var(--cad-border);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .context-menu-slider {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
  }

  .context-menu-slider span:first-child {
    font-size: 11px;
    color: var(--cad-text-muted);
    min-width: 55px;
  }

  .context-menu-slider input[type="range"] {
    flex: 1;
    height: 4px;
    appearance: none;
    background: var(--cad-bg);
    border-radius: 2px;
    cursor: pointer;
  }

  .context-menu-slider input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--cad-accent);
    cursor: pointer;
  }

  .slider-value {
    font-size: 10px;
    color: var(--cad-accent);
    min-width: 30px;
    text-align: right;
  }

  /* Image cards for georef */
  .image-card {
    background: var(--cad-bg);
    border-radius: 6px;
    padding: 10px;
    margin-bottom: 8px;
    border: 1px solid var(--cad-border);
  }

  .image-card.georeferenced {
    border-left: 3px solid var(--cad-success);
  }

  .image-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .image-header .image-name {
    flex: 1;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .georef-badge {
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 8px;
    background: var(--cad-bg-tertiary);
    color: var(--cad-text-muted);
  }

  .georef-badge.success {
    background: rgba(52, 211, 153, 0.2);
    color: var(--cad-success);
  }

  .georef-results {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--cad-border);
  }

  .rms-display {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .rms-display.good { background: rgba(52, 211, 153, 0.15); color: var(--cad-success); }
  .rms-display.warn { background: rgba(251, 191, 36, 0.15); color: var(--cad-warning); }
  .rms-display.bad { background: rgba(248, 113, 113, 0.15); color: var(--cad-danger); }

  .rms-label { opacity: 0.8; }
  .rms-value { font-family: 'JetBrains Mono', monospace; }

  .residuals-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .residual-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    padding: 3px 6px;
    background: var(--cad-bg-secondary);
    border-radius: 3px;
  }

  .res-num { color: var(--cad-text-muted); font-weight: 600; }
  .res-val { font-family: 'JetBrains Mono', monospace; }
  .res-val.good { color: var(--cad-success); }
  .res-val.warn { color: var(--cad-warning); }
  .res-val.bad { color: var(--cad-danger); }

  .georef-export-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .btn-export, .btn-recal {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-export {
    background: var(--cad-accent);
    color: white;
  }

  .btn-export:hover { filter: brightness(1.1); }

  .btn-recal {
    background: var(--cad-bg-tertiary);
    color: var(--cad-text);
  }

  .btn-recal:hover { background: var(--cad-border); }

  .image-actions {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
  }

  .georef-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--cad-accent);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 11px;
    cursor: pointer;
  }

  .georef-btn:hover { filter: brightness(1.1); }

  .step-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: var(--cad-warning);
    color: #000;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 600;
    margin-right: 6px;
  }

  .points-header {
    font-size: 10px;
    color: var(--cad-text-muted);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .georef-point {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: var(--cad-bg-secondary);
    border-radius: 4px;
    margin-bottom: 4px;
    font-size: 10px;
  }

  .point-num {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--cad-accent);
    color: white;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 600;
  }

  .point-coords {
    flex: 1;
    font-family: 'JetBrains Mono', monospace;
    color: var(--cad-text-muted);
  }

  .point-delete {
    background: transparent;
    border: none;
    color: var(--cad-text-muted);
    cursor: pointer;
    padding: 2px;
    opacity: 0.6;
  }

  .point-delete:hover { color: var(--cad-danger); opacity: 1; }

  .georef-hint {
    font-size: 10px;
    color: var(--cad-text-muted);
    margin-top: 8px;
    text-align: center;
    opacity: 0.7;
  }

  .btn-apply {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  /* PDF Loading overlay */
  .pdf-loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .pdf-loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px 40px;
    background: var(--cad-bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--cad-border);
  }

  .pdf-spinner {
    animation: spin 1s linear infinite;
    color: var(--cad-accent);
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .pdf-loading-content span {
    font-size: 14px;
    color: var(--cad-text);
  }

  .pdf-progress-bar {
    width: 200px;
    height: 6px;
    background: var(--cad-bg);
    border-radius: 3px;
    overflow: hidden;
  }

  .pdf-progress-fill {
    height: 100%;
    background: var(--cad-accent);
    transition: width 0.3s ease;
  }

  .pdf-progress-text {
    font-size: 12px;
    color: var(--cad-text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  /* ============================================
     NEW STYLES FOR DRAWING & IMPROVED LAYERS
     ============================================ */

  /* Color input in toolbar */
  .color-input {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 2px solid var(--cad-border);
    border-radius: 4px;
    cursor: pointer;
    background: transparent;
  }

  .color-input::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .color-input::-webkit-color-swatch {
    border-radius: 2px;
    border: none;
  }

  /* Layer item container - new layout */
  .layer-item-container {
    background: var(--cad-bg);
    border-radius: 6px;
    margin-bottom: 4px;
    border: 1px solid var(--cad-border);
    overflow: hidden;
  }

  .layer-item-container.hidden {
    opacity: 0.5;
  }

  .layer-item-container.locked {
    border-left: 3px solid var(--cad-warning);
  }

  .layer-item-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    cursor: context-menu;
  }

  .layer-item-row:hover {
    background: var(--cad-bg-tertiary);
  }

  .layer-lock-btn {
    background: transparent;
    border: none;
    padding: 2px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .layer-style-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--cad-bg-secondary);
    border-top: 1px solid var(--cad-border);
  }

  .layer-color-picker {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--cad-border);
    border-radius: 3px;
    cursor: pointer;
    background: transparent;
  }

  .layer-color-picker::-webkit-color-swatch-wrapper {
    padding: 1px;
  }

  .layer-color-picker::-webkit-color-swatch {
    border-radius: 2px;
    border: none;
  }

  .layer-stroke-slider,
  .layer-opacity-slider {
    flex: 1;
    height: 4px;
    appearance: none;
    background: var(--cad-bg);
    border-radius: 2px;
    cursor: pointer;
  }

  .layer-stroke-slider::-webkit-slider-thumb,
  .layer-opacity-slider::-webkit-slider-thumb {
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--cad-accent);
    cursor: pointer;
  }

  .layer-stroke-value,
  .layer-opacity-value {
    font-size: 9px;
    color: var(--cad-text-muted);
    min-width: 25px;
    text-align: right;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Status bar drawing mode */
  .status-mode.drawing {
    color: var(--cad-success);
  }

  .status-drawing {
    font-size: 10px;
    padding: 2px 8px;
    background: rgba(52, 211, 153, 0.2);
    border-radius: 3px;
    color: var(--cad-success);
  }

  .status-snap {
    font-size: 9px;
    padding: 2px 6px;
    background: rgba(0, 255, 0, 0.2);
    border-radius: 3px;
    color: #00ff00;
    font-weight: 600;
  }

  /* Toolbar btn disabled */
  .toolbar-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .toolbar-btn:disabled:hover {
    background: transparent;
    color: var(--cad-text-muted);
  }

  /* Georef buttons */
  .btn-helmert {
    background: var(--cad-accent) !important;
    font-size: 10px !important;
  }

  .btn-affine {
    background: var(--cad-success) !important;
    font-size: 10px !important;
  }

  /* ============================================
     SPLIT SCREEN GEOREFERENCING STYLES
     ============================================ */

  .cad-canvas-split {
    flex: 1;
    display: flex;
    gap: 0;
    overflow: hidden;
    background: var(--cad-bg);
  }

  .georef-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .pane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--cad-bg-secondary);
    border-bottom: 2px solid var(--cad-border);
  }

  .georef-image-pane .pane-header {
    border-bottom-color: #ffcc00;
  }

  .georef-ref-pane .pane-header {
    border-bottom-color: #00ff88;
  }

  .pane-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--cad-text);
  }

  .georef-image-pane .pane-title {
    color: #ffcc00;
  }

  .georef-ref-pane .pane-title {
    color: #00ff88;
  }

  .pane-status {
    font-size: 10px;
    padding: 3px 10px;
    border-radius: 4px;
    background: var(--cad-bg);
    color: var(--cad-text-muted);
    transition: all 0.2s;
  }

  .pane-status.active {
    animation: status-pulse 1.5s ease-in-out infinite;
  }

  .georef-image-pane .pane-status.active {
    background: rgba(255, 204, 0, 0.2);
    color: #ffcc00;
    font-weight: 600;
  }

  .georef-ref-pane .pane-status.active {
    background: rgba(0, 255, 136, 0.2);
    color: #00ff88;
    font-weight: 600;
  }

  @keyframes status-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .pane-canvas {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #2d3748;
  }

  .pane-canvas canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  .split-divider {
    width: 6px;
    background: var(--cad-bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: col-resize;
    transition: background 0.2s;
  }

  .split-divider:hover {
    background: var(--cad-accent);
  }

  .divider-handle {
    width: 4px;
    height: 40px;
    background: var(--cad-border);
    border-radius: 2px;
    transition: background 0.2s;
  }

  .split-divider:hover .divider-handle {
    background: white;
  }

  /* Georef markers on split canvases */
  .georef-marker-image {
    fill: rgba(255, 204, 0, 0.5);
    stroke: #ffcc00;
    stroke-width: 2;
  }

  .georef-marker-world {
    fill: rgba(0, 255, 136, 0.5);
    stroke: #00ff88;
    stroke-width: 2;
  }

  /* Instructions overlay for georef panes */
  .georef-pane .pane-canvas::after {
    content: 'Molette: Zoom | Ctrl+Clic: Pan';
    position: absolute;
    bottom: 8px;
    right: 8px;
    font-size: 9px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.6);
    color: var(--cad-text-muted);
    border-radius: 4px;
    pointer-events: none;
  }
</style>
