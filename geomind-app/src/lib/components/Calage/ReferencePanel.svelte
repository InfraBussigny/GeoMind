<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // OpenLayers imports
  import OLMap from 'ol/Map';
  import View from 'ol/View';
  import TileLayer from 'ol/layer/Tile';
  import VectorLayer from 'ol/layer/Vector';
  import VectorSource from 'ol/source/Vector';
  import VectorTileLayer from 'ol/layer/VectorTile';
  import VectorTileSource from 'ol/source/VectorTile';
  import WMTS from 'ol/source/WMTS';
  import XYZ from 'ol/source/XYZ';
  import MVT from 'ol/format/MVT';
  import GeoJSON from 'ol/format/GeoJSON';
  import WMTSTileGrid from 'ol/tilegrid/WMTS';
  import { get as getProjection } from 'ol/proj';
  import { register } from 'ol/proj/proj4';
  import { getTopLeft } from 'ol/extent';
  import { defaults as defaultControls, ScaleLine } from 'ol/control';
  import { Style, Fill, Stroke, Circle as CircleStyle, Text, RegularShape } from 'ol/style';
  import Feature from 'ol/Feature';
  import Point from 'ol/geom/Point';
  import proj4 from 'proj4';
  import 'ol/ol.css';

  import { calageStore, type CalibrationPoint } from '$lib/stores/calageStore';
  import { getConnections, getActiveConnection, type DBConnection } from '$lib/services/api';
  import bdcoLayersConfig from '$lib/config/bdcoLayers.json';

  // Register Swiss projection EPSG:2056 (MN95)
  proj4.defs('EPSG:2056', '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs');
  register(proj4);

  // Types
  interface BDCOLayer {
    id: string;
    name: string;
    table: string;
    schema: string;
    geometryType: string;
    geometryColumn: string;
    srid: number;
    style: {
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWidth?: number;
      radius?: number;
      shape?: 'circle' | 'triangle' | 'square';
    };
    interactive?: boolean;
    snapTypes?: string[];
    snapPriority?: number;
    defaultVisible: boolean;
    zIndex: number;
  }

  interface BasemapConfig {
    id: string;
    name: string;
    type: 'wmts' | 'xyz';
    url: string;
    layer?: string;
    category: string;
  }

  // State
  let mapContainer: HTMLDivElement;
  let map: OLMap | null = null;
  let mapReady = $state(false);
  let mouseCoords = $state<{ x: number; y: number } | null>(null);
  let selectedBasemap = $state('asit-gris');

  // Database connection (managed by LayersSidebar, synced via events)
  let selectedConnectionId = $state<string | null>(null);
  let loadingLayers = $state(false);

  // Layer management
  let layerMap = new Map<string, VectorTileLayer | VectorLayer<any>>();
  let calibrationPointsLayer: VectorLayer<VectorSource> | null = null;
  let calibrationPointsSource: VectorSource | null = null;

  // Store state - initialized with defaults from store
  let storeState: any = $state({
    editMode: 'none',
    pendingStep: null,
    calibrationPoints: [],
    selectedPointId: null,
    activeLayers: [
      'bdco_parcelle',
      'bdco_batiment',
      'bdco_point_fixe_1',
      'bdco_point_fixe_2',
      'bdco_point_fixe_3',
      'bdco_point_limite'
    ],
    showLayersSidebar: false,
    snapConfig: { enabled: true, tolerance: 10, types: [] },
    tempPoint: null
  });

  // Store subscription - handled in onMount/onDestroy
  let unsubscribeStore: (() => void) | null = null;

  // Basemaps config
  const basemaps: BasemapConfig[] = [
    { id: 'asit-couleur', name: 'Couleur', category: 'ASIT', type: 'wmts', url: 'https://wmts.asit-asso.ch/wmts', layer: 'asitvd.fond_couleur' },
    { id: 'asit-gris', name: 'Gris', category: 'ASIT', type: 'wmts', url: 'https://wmts.asit-asso.ch/wmts', layer: 'asitvd.fond_gris' },
    { id: 'asit-cadastral', name: 'Cadastral', category: 'ASIT', type: 'wmts', url: 'https://wmts.asit-asso.ch/wmts', layer: 'asitvd.fond_cadastral' },
    { id: 'swisstopo', name: 'Couleur', category: 'Swisstopo', type: 'xyz', url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/2056/{z}/{x}/{y}.jpeg' },
    { id: 'swisstopo-grey', name: 'Gris', category: 'Swisstopo', type: 'xyz', url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/2056/{z}/{x}/{y}.jpeg' },
    { id: 'ortho', name: 'Ortho', category: 'Swisstopo', type: 'xyz', url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/2056/{z}/{x}/{y}.jpeg' },
  ];

  // Swiss resolutions and matrix IDs for WMTS
  const swissResolutions = [
    4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250,
    1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5, 0.25, 0.1
  ];
  const asitMatrixIds = swissResolutions.map((_, i) => i.toString());
  const swissExtent = [2420000, 1030000, 2900000, 1350000];

  // BDCO layers from config
  const bdcoLayers: BDCOLayer[] = bdcoLayersConfig.layers as BDCOLayer[];

  // Commune extent for filtering (Bussigny by default)
  const communeExtent = bdcoLayersConfig.communeExtent as {
    name: string;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  const bussignyBbox = `${communeExtent.minX},${communeExtent.minY},${communeExtent.maxX},${communeExtent.maxY}`;

  // Create ASIT WMTS source
  function createAsitSource(layerId: string): WMTS {
    const projection = getProjection('EPSG:2056')!;
    const projectionExtent = projection.getExtent() || swissExtent;

    return new WMTS({
      url: `https://wmts.asit-asso.ch/wmts/1.0.0/${layerId}/default/default028mm/2056/{TileMatrix}/{TileRow}/{TileCol}.png`,
      layer: layerId,
      matrixSet: '2056',
      format: 'image/png',
      projection: projection,
      tileGrid: new WMTSTileGrid({
        origin: getTopLeft(projectionExtent),
        resolutions: swissResolutions,
        matrixIds: asitMatrixIds,
      }),
      style: 'default028mm',
      wrapX: false,
    });
  }

  // Create Swisstopo XYZ source
  function createSwisstopoSource(url: string): XYZ {
    return new XYZ({
      url: url,
      projection: 'EPSG:2056',
      tileGrid: new WMTSTileGrid({
        origin: getTopLeft(swissExtent),
        resolutions: swissResolutions,
        matrixIds: asitMatrixIds,
      }),
    });
  }

  // Create basemap layer
  function createBasemapLayer(config: BasemapConfig): TileLayer<any> {
    let source;
    if (config.type === 'wmts' && config.layer) {
      source = createAsitSource(config.layer);
    } else {
      source = createSwisstopoSource(config.url);
    }
    return new TileLayer({ source });
  }

  // Create style for BDCO layer
  function createBDCOStyle(layerConfig: BDCOLayer): Style {
    const { style, geometryType } = layerConfig;

    if (geometryType === 'point') {
      // Use triangle for points fixes, circle otherwise
      if (style.shape === 'triangle') {
        return new Style({
          image: new RegularShape({
            points: 3,
            radius: style.radius || 6,
            fill: new Fill({ color: style.fillColor || '#CC0000' }),
            stroke: new Stroke({
              color: style.strokeColor || '#000000',
              width: style.strokeWidth || 1
            }),
            rotation: 0, // Point up
          }),
        });
      } else {
        return new Style({
          image: new CircleStyle({
            radius: style.radius || 4,
            fill: new Fill({ color: style.fillColor || '#FFD700' }),
            stroke: new Stroke({
              color: style.strokeColor || '#000000',
              width: style.strokeWidth || 0.5
            }),
          }),
        });
      }
    } else if (geometryType === 'line') {
      return new Style({
        stroke: new Stroke({
          color: style.strokeColor || '#606060',
          width: style.strokeWidth || 1,
        }),
      });
    } else {
      // Polygon
      const fillColor = style.fillColor || '#D4D4D4';
      const opacity = style.fillOpacity ?? 0;
      return new Style({
        fill: opacity > 0 ? new Fill({ color: hexToRgba(fillColor, opacity) }) : undefined,
        stroke: new Stroke({
          color: style.strokeColor || '#404040',
          width: style.strokeWidth || 0.8,
        }),
      });
    }
  }

  // Helper: hex to rgba
  function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Style for calibration points
  function createCalibrationPointStyle(point: CalibrationPoint, isSelected: boolean): Style {
    const baseRadius = isSelected ? 12 : 10;
    const strokeWidth = isSelected ? 3 : 2;

    return new Style({
      image: new CircleStyle({
        radius: baseRadius,
        fill: new Fill({ color: isSelected ? '#ff4444' : '#00ff88' }),
        stroke: new Stroke({ color: '#ffffff', width: strokeWidth }),
      }),
      text: new Text({
        text: point.label || `P${storeState.calibrationPoints.indexOf(point) + 1}`,
        offsetY: -20,
        font: 'bold 12px sans-serif',
        fill: new Fill({ color: '#ffffff' }),
        stroke: new Stroke({ color: '#000000', width: 3 }),
      }),
    });
  }

  // Initialize map
  function initMap() {
    if (!mapContainer || map) return;

    const config = basemaps.find(b => b.id === selectedBasemap) || basemaps[1];
    const basemapLayer = createBasemapLayer(config);
    basemapLayer.set('name', 'basemap');

    const projection = getProjection('EPSG:2056')!;
    const defaultCenter = bdcoLayersConfig.defaultCenter;

    map = new OLMap({
      target: mapContainer,
      layers: [basemapLayer],
      view: new View({
        projection: projection,
        center: [defaultCenter.x, defaultCenter.y],
        zoom: bdcoLayersConfig.defaultZoom,
        minZoom: 0,
        maxZoom: 28,
        extent: swissExtent,
      }),
      controls: defaultControls({ zoom: true, rotate: false }).extend([
        new ScaleLine({ units: 'metric' }),
      ]),
    });

    // Mouse move for coordinates
    map.on('pointermove', (e) => {
      const coords = e.coordinate;
      if (coords) {
        mouseCoords = { x: Math.round(coords[0] * 100) / 100, y: Math.round(coords[1] * 100) / 100 };
      }
    });

    // Click handler for point placement
    map.on('singleclick', handleMapClick);

    // View change handler
    map.on('moveend', () => {
      if (map) {
        const view = map.getView();
        const center = view.getCenter();
        const zoom = view.getZoom();
        if (center && zoom !== undefined) {
          calageStore.setReferenceView(zoom, { x: center[0], y: center[1] });
        }
      }
    });

    // Create calibration points layer
    calibrationPointsSource = new VectorSource();
    calibrationPointsLayer = new VectorLayer({
      source: calibrationPointsSource,
      zIndex: 1000,
    });
    map.addLayer(calibrationPointsLayer);

    mapReady = true;
    console.log('[Calage] Reference map initialized (EPSG:2056)');
    // Note: BDCO layers are loaded in onMount after connection is established
  }

  // Load BDCO layers from PostGIS
  async function loadBDCOLayers() {
    if (!map) {
      console.warn('[Calage] Cannot load layers: map not initialized');
      return;
    }
    if (!selectedConnectionId) {
      console.warn('[Calage] Cannot load layers: no connection selected');
      return;
    }

    console.log('[Calage] Loading BDCO layers, active:', storeState.activeLayers);

    for (const layerConfig of bdcoLayers) {
      if (storeState.activeLayers.includes(layerConfig.id)) {
        await addBDCOLayer(layerConfig);
      }
    }
  }

  // Add a BDCO layer to the map (via SQL endpoint)
  async function addBDCOLayer(layerConfig: BDCOLayer) {
    if (!map || layerMap.has(layerConfig.id)) return;
    if (!selectedConnectionId) {
      console.warn('[Calage] No database connection selected');
      return;
    }

    loadingLayers = true;

    try {
      // Use Bussigny commune extent for filtering
      const { minX, minY, maxX, maxY } = communeExtent;
      const geomCol = layerConfig.geometryColumn || 'geom';
      const srid = layerConfig.srid || 2056;

      // Build SQL query to return GeoJSON FeatureCollection
      const query = `
        SELECT jsonb_build_object(
          'type', 'FeatureCollection',
          'crs', jsonb_build_object('type', 'name', 'properties', jsonb_build_object('name', 'EPSG:${srid}')),
          'features', COALESCE(jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON("${geomCol}")::jsonb,
              'properties', to_jsonb(t) - '${geomCol}'
            )
          ), '[]'::jsonb)
        ) as geojson
        FROM (
          SELECT *
          FROM "${layerConfig.schema}"."${layerConfig.table.split('.').pop()}"
          WHERE "${geomCol}" IS NOT NULL
            AND ST_Intersects("${geomCol}", ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, ${srid}))
          LIMIT 50000
        ) t
      `;

      // Use SQL endpoint which exists and works
      const response = await fetch(`http://localhost:3001/api/connections/${selectedConnectionId}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'SQL query failed');
      }

      const geojson = result.rows[0]?.geojson || { type: 'FeatureCollection', features: [] };

      // Create vector source with GeoJSON
      const vectorSource = new VectorSource({
        features: new GeoJSON({
          dataProjection: 'EPSG:2056',
          featureProjection: 'EPSG:2056'
        }).readFeatures(geojson)
      });

      // Use renderMode: 'image' for non-interactive layers (much better performance)
      // Interactive layers keep vector mode for snapping/clicking
      const isInteractive = layerConfig.interactive === true;

      const layer = new VectorLayer({
        source: vectorSource,
        style: createBDCOStyle(layerConfig),
        zIndex: layerConfig.zIndex,
        // renderMode: 'image' renders to a static canvas - much faster for many features
        renderMode: isInteractive ? 'vector' : 'image',
        // Disable feature updates for non-interactive layers
        updateWhileAnimating: isInteractive,
        updateWhileInteracting: isInteractive,
      });

      layer.set('layerId', layerConfig.id);
      layer.set('layerConfig', layerConfig);
      layer.set('interactive', isInteractive);

      map.addLayer(layer);
      layerMap.set(layerConfig.id, layer);

      const modeLabel = isInteractive ? 'interactif' : 'statique';
      console.log(`[Calage] Layer ${layerConfig.id} loaded: ${geojson.features?.length || 0} features (${modeLabel}, filtré ${communeExtent.name})`);
    } catch (err) {
      console.warn(`[Calage] Could not load layer ${layerConfig.id}:`, err);
    } finally {
      loadingLayers = false;
    }
  }

  // Remove a BDCO layer
  function removeBDCOLayer(layerId: string) {
    if (!map) return;

    const layer = layerMap.get(layerId);
    if (layer) {
      map.removeLayer(layer);
      layerMap.delete(layerId);
    }
  }


  // Reload all active layers
  async function reloadAllLayers() {
    if (!map || !selectedConnectionId) return;

    // Remove all existing BDCO layers
    for (const [layerId, layer] of layerMap) {
      map.removeLayer(layer);
    }
    layerMap.clear();

    // Re-add active layers
    for (const layerConfig of bdcoLayers) {
      if (storeState.activeLayers.includes(layerConfig.id)) {
        await addBDCOLayer(layerConfig);
      }
    }

    console.log('[Calage] All layers reloaded');
  }

  // Handle map click
  function handleMapClick(e: any) {
    if (!storeState.editMode || storeState.editMode === 'none') return;
    if (storeState.pendingStep !== 'world') return;

    const coords = e.coordinate;
    if (!coords) return;

    // Apply snapping if enabled
    let snappedCoords = coords;
    if (storeState.snapConfig.enabled) {
      snappedCoords = trySnap(coords);
    }

    calageStore.setTempWorldPoint(snappedCoords[0], snappedCoords[1]);

    // If we have both image and world coords, add the point
    if (storeState.tempPoint?.imageX !== undefined && storeState.tempPoint?.imageY !== undefined) {
      calageStore.addCalibrationPoint({
        imageX: storeState.tempPoint.imageX,
        imageY: storeState.tempPoint.imageY,
        worldX: snappedCoords[0],
        worldY: snappedCoords[1],
        label: `P${storeState.calibrationPoints.length + 1}`
      });
    }
  }

  // Try to snap to nearby features
  function trySnap(coords: number[]): number[] {
    // TODO: Implement proper snapping using ol/interaction/Snap
    // For now, return original coords
    return coords;
  }

  // Update calibration points on map
  function updateCalibrationPointsOnMap() {
    if (!calibrationPointsSource) return;

    calibrationPointsSource.clear();

    for (const point of storeState.calibrationPoints) {
      if (point.worldX !== undefined && point.worldY !== undefined) {
        const feature = new Feature({
          geometry: new Point([point.worldX, point.worldY]),
          pointData: point,
        });

        const isSelected = point.id === storeState.selectedPointId;
        feature.setStyle(createCalibrationPointStyle(point, isSelected));
        calibrationPointsSource.addFeature(feature);
      }
    }
  }

  // Change basemap
  function changeBasemap(basemapId: string) {
    selectedBasemap = basemapId;
    if (!map) return;

    const config = basemaps.find(b => b.id === basemapId);
    if (!config) return;

    const layers = map.getLayers();
    const basemapLayer = layers.getArray().find(l => l.get('name') === 'basemap');

    if (basemapLayer) {
      const newLayer = createBasemapLayer(config);
      newLayer.set('name', 'basemap');
      const index = layers.getArray().indexOf(basemapLayer);
      layers.removeAt(index);
      layers.insertAt(index, newLayer);
    }
  }

  // Zoom to extent
  function zoomToExtent(extent: number[]) {
    if (!map) return;
    map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
  }

  // Zoom to Vaud
  function zoomToVaud() {
    zoomToExtent([2494000, 1110000, 2580000, 1200000]);
  }

  // Event handlers for LayersSidebar
  function handleConnectionChange(e: CustomEvent) {
    selectedConnectionId = e.detail.connectionId;
    console.log('[Calage] Connection changed to:', selectedConnectionId);
    reloadAllLayers();
  }

  function handleLayerToggle(e: CustomEvent) {
    const { layerId, connectionId } = e.detail;
    if (connectionId) {
      selectedConnectionId = connectionId;
    }
    const layerConfig = bdcoLayers.find(l => l.id === layerId);
    if (!layerConfig) return;

    if (layerMap.has(layerId)) {
      removeBDCOLayer(layerId);
    } else {
      addBDCOLayer(layerConfig);
    }
  }

  function handleReloadLayers(e: CustomEvent) {
    if (e.detail.connectionId) {
      selectedConnectionId = e.detail.connectionId;
    }
    reloadAllLayers();
  }

  onMount(async () => {
    // Subscribe to store
    unsubscribeStore = calageStore.subscribe(s => {
      storeState = s;
      if (mapReady) {
        updateCalibrationPointsOnMap();
      }
    });

    // Listen for LayersSidebar events
    window.addEventListener('bdco-connection-change', handleConnectionChange as EventListener);
    window.addEventListener('bdco-layer-toggle', handleLayerToggle as EventListener);
    window.addEventListener('bdco-reload-layers', handleReloadLayers as EventListener);

    // Load database connections and set default
    let connectionId: string | null = null;
    try {
      const connections = await getConnections();
      console.log('[Calage] Connections loaded:', connections.length);
      const active = await getActiveConnection();
      if (active) {
        connectionId = active.id;
      } else if (connections.length > 0) {
        connectionId = connections[0].id;
      }
      selectedConnectionId = connectionId;
      console.log('[Calage] Default connection set:', selectedConnectionId);
    } catch (err) {
      console.warn('[Calage] Could not load database connections:', err);
    }

    // Wait for next tick to ensure DOM is ready
    await new Promise(resolve => setTimeout(resolve, 50));

    // Initialize map
    if (!mapContainer) {
      console.error('[Calage] mapContainer not available!');
      return;
    }

    initMap();
    console.log('[Calage] Map initialized, mapReady:', mapReady);

    // Load layers if connection is available
    if (selectedConnectionId && mapReady) {
      console.log('[Calage] Loading BDCO layers with connection:', selectedConnectionId);
      console.log('[Calage] Active layers:', storeState.activeLayers);
      await loadBDCOLayers();
    } else {
      console.warn('[Calage] Cannot load layers - connection:', selectedConnectionId, 'mapReady:', mapReady);
    }
  });

  onDestroy(() => {
    unsubscribeStore?.();
    window.removeEventListener('bdco-connection-change', handleConnectionChange as EventListener);
    window.removeEventListener('bdco-layer-toggle', handleLayerToggle as EventListener);
    window.removeEventListener('bdco-reload-layers', handleReloadLayers as EventListener);
    if (map) {
      map.setTarget(undefined);
      map = null;
    }
  });
</script>

<div class="reference-panel">
  <!-- Toolbar -->
  <div class="panel-toolbar">
    <div class="toolbar-left">
      <span class="panel-title">Reference (MN95)</span>

      <!-- Basemap selector -->
      <div class="basemap-selector">
        <select bind:value={selectedBasemap} onchange={(e) => changeBasemap(e.currentTarget.value)}>
          {#each basemaps as bm}
            <option value={bm.id}>{bm.category} - {bm.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="toolbar-right">
      <!-- Snap toggle -->
      <button
        class="toolbar-btn"
        class:active={storeState.snapConfig.enabled}
        onclick={() => calageStore.setSnapEnabled(!storeState.snapConfig.enabled)}
        title="Accroche aux objets"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
        </svg>
      </button>

      <!-- Zoom VD -->
      <button class="toolbar-btn" onclick={zoomToVaud} title="Zoom Vaud">VD</button>
    </div>
  </div>

  <!-- Map container -->
  <div class="map-wrapper">
    <div class="map-container" bind:this={mapContainer}></div>


    <!-- Coordinates display -->
    {#if mouseCoords}
      <div class="coords-display">
        <span>E: {mouseCoords.x.toLocaleString('fr-CH')}</span>
        <span>N: {mouseCoords.y.toLocaleString('fr-CH')}</span>
      </div>
    {/if}

    <!-- Edit mode indicator -->
    {#if storeState.editMode === 'addPoint' && storeState.pendingStep === 'world'}
      <div class="edit-mode-indicator">
        Cliquez sur la carte pour placer le point de reference
      </div>
    {/if}
  </div>
</div>

<style>
  .reference-panel {
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
    color: var(--cyber-green);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .basemap-selector select {
    background: var(--noir-surface);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }

  .basemap-selector select:hover {
    border-color: var(--cyber-green);
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
    font-size: 10px;
    font-weight: bold;
  }

  .toolbar-btn:hover {
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .toolbar-btn.active {
    background: rgba(0, 255, 136, 0.15);
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .map-wrapper {
    flex: 1;
    position: relative;
    min-height: 0;
  }

  .map-container {
    width: 100%;
    height: 100%;
  }

  .map-container :global(.ol-control) {
    background: var(--noir-card) !important;
    border: 1px solid var(--border-color) !important;
    border-radius: 4px !important;
  }

  .map-container :global(.ol-control button) {
    background: var(--noir-surface) !important;
    color: var(--text-primary) !important;
  }

  .map-container :global(.ol-control button:hover) {
    background: var(--cyber-green) !important;
    color: var(--noir-profond) !important;
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
    color: var(--cyber-green);
    display: flex;
    gap: 16px;
    z-index: 50;
  }

  .edit-mode-indicator {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--cyber-green);
    color: var(--noir-profond);
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    z-index: 50;
    box-shadow: 0 2px 8px rgba(0, 255, 136, 0.3);
  }
</style>
