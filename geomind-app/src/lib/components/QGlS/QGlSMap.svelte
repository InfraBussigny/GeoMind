<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  // OpenLayers imports
  import Map from 'ol/Map';
  import View from 'ol/View';
  import TileLayer from 'ol/layer/Tile';
  import VectorLayer from 'ol/layer/Vector';
  import VectorSource from 'ol/source/Vector';
  import WMTS from 'ol/source/WMTS';
  import WMTSTileGrid from 'ol/tilegrid/WMTS';
  import { register } from 'ol/proj/proj4';
  import { get as getProjection } from 'ol/proj';
  import proj4 from 'proj4';
  import { ScaleLine, Zoom } from 'ol/control';
  import Draw, { createBox } from 'ol/interaction/Draw';
  import Modify from 'ol/interaction/Modify';
  import Snap from 'ol/interaction/Snap';
  import Select from 'ol/interaction/Select';
  import { click } from 'ol/events/condition';
  import Style from 'ol/style/Style';
  import Fill from 'ol/style/Fill';
  import Stroke from 'ol/style/Stroke';
  import CircleStyle from 'ol/style/Circle';
  import Overlay from 'ol/Overlay';
  import { getArea, getLength } from 'ol/sphere';
  import LineString from 'ol/geom/LineString';
  import type Polygon from 'ol/geom/Polygon';
  import GeoJSON from 'ol/format/GeoJSON';
  import KML from 'ol/format/KML';
  import GPX from 'ol/format/GPX';
  import VectorTileLayer from 'ol/layer/VectorTile';
  import VectorTileSource from 'ol/source/VectorTile';
  import MVT from 'ol/format/MVT';
  import XYZ from 'ol/source/XYZ';
  import TileGrid from 'ol/tilegrid/TileGrid';

  // Turf.js for geometry operations
  import * as turf from '@turf/turf';

  import { layers, type QGlSLayer } from '$lib/stores/qgls/layerStore';
  import { currentTool, toolSettings, isDrawingTool } from '$lib/stores/qgls/toolStore';
  import { historyStore, deserializeFeatures } from '$lib/stores/qgls/historyStore';
  import { currentStyle, type SketchStyle } from '$lib/stores/qgls/styleStore';
  import { get } from 'svelte/store';
  import type { Feature } from 'ol';
  import type { Geometry } from 'ol/geom';
  import RegularShape from 'ol/style/RegularShape';

  // Format instances for import/export
  const geoJsonFormat = new GeoJSON();
  const kmlFormat = new KML({
    extractStyles: false  // Ignore KML styles, use our own
  });
  const gpxFormat = new GPX();

  // Create OpenLayers style from SketchStyle
  function createOLStyle(style: SketchStyle): Style {
    // Convert hex color to rgba
    const hexToRgba = (hex: string, opacity: number): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    // Create point image based on shape
    let pointImage;
    const pointFill = new Fill({ color: style.fillColor });
    const pointStroke = new Stroke({
      color: style.strokeColor,
      width: 2
    });

    switch (style.pointShape) {
      case 'square':
        pointImage = new RegularShape({
          fill: pointFill,
          stroke: pointStroke,
          points: 4,
          radius: style.pointRadius,
          angle: Math.PI / 4
        });
        break;
      case 'triangle':
        pointImage = new RegularShape({
          fill: pointFill,
          stroke: pointStroke,
          points: 3,
          radius: style.pointRadius,
          rotation: 0,
          angle: 0
        });
        break;
      case 'cross':
        pointImage = new RegularShape({
          fill: pointFill,
          stroke: pointStroke,
          points: 4,
          radius: style.pointRadius,
          radius2: 0,
          angle: 0
        });
        break;
      default: // circle
        pointImage = new CircleStyle({
          radius: style.pointRadius,
          fill: pointFill,
          stroke: pointStroke
        });
    }

    return new Style({
      fill: new Fill({ color: hexToRgba(style.fillColor, style.fillOpacity) }),
      stroke: new Stroke({
        color: hexToRgba(style.strokeColor, style.strokeOpacity),
        width: style.strokeWidth,
        lineDash: style.strokeDash.length > 0 ? style.strokeDash : undefined
      }),
      image: pointImage
    });
  }

  // Get current style as OpenLayers Style
  function getCurrentOLStyle(): Style {
    return createOLStyle(get(currentStyle));
  }

  const API_BASE = 'http://localhost:3001/api';

  // Basemap configurations
  interface BasemapConfig {
    id: string;
    name: string;
    shortName: string;
    type: 'wmts' | 'xyz';
    url: string;
    layer?: string;
    matrixSet?: string;
    category: 'asit' | 'swisstopo';
    color: string;  // Color for the icon
    icon: string;   // Icon type: 'map', 'grid', 'satellite'
  }

  const basemaps: BasemapConfig[] = [
    // ASIT-VD en EPSG:2056
    { id: 'asit-couleur', name: 'ASIT Couleur', shortName: 'Couleur', category: 'asit', type: 'wmts', url: 'https://wmts.asit-asso.ch/wmts', layer: 'asitvd.fond_couleur', matrixSet: '2056', color: '#4CAF50', icon: 'map' },
    { id: 'asit-gris', name: 'ASIT Gris', shortName: 'Gris', category: 'asit', type: 'wmts', url: 'https://wmts.asit-asso.ch/wmts', layer: 'asitvd.fond_gris', matrixSet: '2056', color: '#9E9E9E', icon: 'map' },
    { id: 'asit-cadastral', name: 'ASIT Cadastral', shortName: 'Cadastre', category: 'asit', type: 'wmts', url: 'https://wmts.asit-asso.ch/wmts', layer: 'asitvd.fond_cadastral', matrixSet: '2056', color: '#FF9800', icon: 'grid' },
    // Swisstopo en EPSG:2056 (XYZ)
    { id: 'swisstopo-couleur', name: 'Swisstopo Couleur', shortName: 'Topo', category: 'swisstopo', type: 'xyz', url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/2056/{z}/{x}/{y}.jpeg', color: '#2196F3', icon: 'map' },
    { id: 'swisstopo-gris', name: 'Swisstopo Gris', shortName: 'Topo Gris', category: 'swisstopo', type: 'xyz', url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/2056/{z}/{x}/{y}.jpeg', color: '#607D8B', icon: 'map' },
    { id: 'ortho', name: 'Orthophoto', shortName: 'Ortho', category: 'swisstopo', type: 'xyz', url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/2056/{z}/{x}/{y}.jpeg', color: '#795548', icon: 'satellite' },
  ];

  let selectedBasemapId = $state('asit-gris');
  let basemapSelectorOpen = $state(false);

  // Map element reference
  let mapElement: HTMLDivElement;
  let map: Map | null = null;
  let basemapLayer: TileLayer | null = null;

  // PostGIS layer management
  let postgisLayerMap = new Map<string, VectorTileLayer>();

  // Status
  let currentZoom = $state(12);
  let currentCenter = $state<[number, number]>([2533500, 1152000]);
  let cursorPosition = $state<[number, number] | null>(null);

  // Sketching layer
  let sketchSource: VectorSource;
  let sketchLayer: VectorLayer<VectorSource>;

  // Interactions
  let drawInteraction: Draw | null = null;
  let modifyInteraction: Modify | null = null;
  let selectInteraction: Select | null = null;
  let snapInteraction: Snap | null = null;

  // History tracking - store feature state before modification
  let featuresBeforeModify: Map<string, Feature<Geometry>> = new Map();

  // Measurement state
  let measureOverlay: Overlay | null = null;
  let measureTooltipElement: HTMLDivElement | null = null;
  let measureSource: VectorSource | null = null;
  let measureLayer: VectorLayer<VectorSource> | null = null;
  let currentMeasurement = $state<string | null>(null);

  // Register Swiss projection (MN95 - EPSG:2056)
  proj4.defs('EPSG:2056', '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs');
  proj4.defs('EPSG:21781', '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs');

  if (browser) {
    register(proj4);
  }

  // Swiss extent
  const swissExtent = [2420000, 1030000, 2900000, 1350000];

  // WMTS resolutions for ASIT-VD
  const resolutions = [
    4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250,
    1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5, 0.25, 0.1
  ];

  const matrixIds = resolutions.map((_, i) => i.toString());

  // Default sketching style
  const sketchStyle = new Style({
    fill: new Fill({ color: 'rgba(0, 255, 136, 0.2)' }),
    stroke: new Stroke({ color: '#00ff88', width: 2 }),
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: '#00ff88' }),
      stroke: new Stroke({ color: '#fff', width: 2 })
    })
  });

  // Measurement style (dashed line)
  const measureStyle = new Style({
    fill: new Fill({ color: 'rgba(255, 200, 0, 0.2)' }),
    stroke: new Stroke({
      color: '#ffc800',
      width: 2,
      lineDash: [10, 10]
    }),
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: '#ffc800' }),
      stroke: new Stroke({ color: '#fff', width: 2 })
    })
  });

  // Format length measurement - always in meters (SI units)
  function formatLength(line: LineString): string {
    const length = getLength(line, { projection: 'EPSG:2056' });
    return `${length.toFixed(2)} m`;
  }

  // Format area measurement - always in m² (SI units)
  function formatArea(polygon: Polygon): string {
    const area = getArea(polygon, { projection: 'EPSG:2056' });
    return `${area.toFixed(2)} m²`;
  }

  // Create basemap layer from config
  function createBasemapLayer(config: BasemapConfig): TileLayer {
    if (config.type === 'wmts') {
      return new TileLayer({
        source: new WMTS({
          url: config.url,
          layer: config.layer!,
          matrixSet: config.matrixSet!,
          format: 'image/png',
          projection: getProjection('EPSG:2056')!,
          tileGrid: new WMTSTileGrid({
            origin: [2420000, 1350000],
            resolutions: resolutions,
            matrixIds: matrixIds
          }),
          style: 'default'
        }),
        zIndex: 0
      });
    } else {
      // XYZ source for Swisstopo
      return new TileLayer({
        source: new XYZ({
          url: config.url,
          projection: 'EPSG:2056',
          tileGrid: new TileGrid({
            origin: [2420000, 1350000],
            resolutions: resolutions
          })
        }),
        zIndex: 0
      });
    }
  }

  // Change basemap
  function changeBasemap(basemapId: string) {
    if (!map) return;

    const config = basemaps.find(b => b.id === basemapId);
    if (!config) return;

    // Remove current basemap
    if (basemapLayer) {
      map.removeLayer(basemapLayer);
    }

    // Create and add new basemap
    basemapLayer = createBasemapLayer(config);
    map.getLayers().insertAt(0, basemapLayer);

    selectedBasemapId = basemapId;
    basemapSelectorOpen = false;
  }

  // Get selected basemap config
  function getSelectedBasemap(): BasemapConfig {
    return basemaps.find(b => b.id === selectedBasemapId) || basemaps[1];
  }

  onMount(() => {
    if (!browser || !mapElement) return;

    // Create sketching layer
    sketchSource = new VectorSource();
    sketchLayer = new VectorLayer({
      source: sketchSource,
      style: sketchStyle,
      zIndex: 1000
    });

    // Create measurement layer
    measureSource = new VectorSource();
    measureLayer = new VectorLayer({
      source: measureSource,
      style: measureStyle,
      zIndex: 1001
    });

    // Create basemap layer from selected config
    const initialBasemap = basemaps.find(b => b.id === selectedBasemapId) || basemaps[1];
    basemapLayer = createBasemapLayer(initialBasemap);

    // Create map
    map = new Map({
      target: mapElement,
      layers: [basemapLayer, sketchLayer, measureLayer],
      view: new View({
        projection: 'EPSG:2056',
        center: currentCenter,
        zoom: currentZoom,
        minZoom: 0,
        maxZoom: 28,
        extent: swissExtent
      }),
      controls: [
        new Zoom(),
        new ScaleLine({ units: 'metric' })
      ]
    });

    // Track view changes
    map.getView().on('change:center', () => {
      const center = map?.getView().getCenter();
      if (center) {
        currentCenter = [center[0], center[1]];
      }
    });

    map.getView().on('change:resolution', () => {
      currentZoom = Math.round(map?.getView().getZoom() || 12);
    });

    // Track cursor position
    map.on('pointermove', (e) => {
      cursorPosition = [Math.round(e.coordinate[0]), Math.round(e.coordinate[1])];
    });

    map.on('pointerout', () => {
      cursorPosition = null;
    });

    // Setup select interaction
    selectInteraction = new Select({
      condition: click,
      style: new Style({
        fill: new Fill({ color: 'rgba(255, 200, 0, 0.3)' }),
        stroke: new Stroke({ color: '#ffc800', width: 3 }),
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: '#ffc800' }),
          stroke: new Stroke({ color: '#fff', width: 2 })
        })
      })
    });
    map.addInteraction(selectInteraction);
  });

  onDestroy(() => {
    if (map) {
      map.setTarget(undefined);
      map = null;
    }
  });

  // Reactive tool switching
  $effect(() => {
    if (!map) return;

    // Remove existing draw interaction
    if (drawInteraction) {
      map.removeInteraction(drawInteraction);
      drawInteraction = null;
    }

    // Remove existing modify interaction
    if (modifyInteraction) {
      map.removeInteraction(modifyInteraction);
      modifyInteraction = null;
    }

    // Remove existing snap interaction
    if (snapInteraction) {
      map.removeInteraction(snapInteraction);
      snapInteraction = null;
    }

    const tool = $currentTool;

    // Setup drawing tool
    if (['point', 'line', 'polygon', 'rectangle', 'circle'].includes(tool)) {
      let type: 'Point' | 'LineString' | 'Polygon' | 'Circle' = 'Point';
      let geometryFunction: any = undefined;

      switch (tool) {
        case 'point': type = 'Point'; break;
        case 'line': type = 'LineString'; break;
        case 'polygon': type = 'Polygon'; break;
        case 'rectangle':
          type = 'Circle';
          geometryFunction = createBox();
          break;
        case 'circle': type = 'Circle'; break;
      }

      // Get current style for drawing
      const drawStyle = getCurrentOLStyle();

      drawInteraction = new Draw({
        source: sketchSource,
        type,
        geometryFunction,
        style: drawStyle
      });

      drawInteraction.on('drawend', (e) => {
        // Apply current style to the drawn feature
        const feature = e.feature as Feature<Geometry>;
        feature.setStyle(getCurrentOLStyle());

        // Record in history
        historyStore.recordAdd([feature], `${tool} ajouté`);
      });

      map.addInteraction(drawInteraction);
    }

    // Setup modify tool
    if (tool === 'modify') {
      modifyInteraction = new Modify({
        source: sketchSource
      });

      // Capture state before modification starts
      modifyInteraction.on('modifystart', (e) => {
        featuresBeforeModify.clear();
        e.features.forEach((f: Feature<Geometry>) => {
          const id = f.getId() || f.get('_historyId');
          if (id) {
            // Clone the feature to preserve its state
            const clone = f.clone();
            clone.setId(id);
            featuresBeforeModify.set(id as string, clone);
          }
        });
      });

      modifyInteraction.on('modifyend', (e) => {
        const modifiedFeatures = e.features.getArray() as Feature<Geometry>[];
        const beforeFeatures: Feature<Geometry>[] = [];

        modifiedFeatures.forEach(f => {
          const id = f.getId() || f.get('_historyId');
          const before = featuresBeforeModify.get(id as string);
          if (before) {
            beforeFeatures.push(before);
          }
        });

        if (beforeFeatures.length > 0) {
          historyStore.recordModify(beforeFeatures, modifiedFeatures, 'Sketching modifié');
        }

        featuresBeforeModify.clear();
      });

      map.addInteraction(modifyInteraction);
    }

    // Setup measurement tools
    if (tool === 'measure-distance' || tool === 'measure-area') {
      // Clear previous measurements
      measureSource?.clear();
      currentMeasurement = null;

      const measureType = tool === 'measure-distance' ? 'LineString' : 'Polygon';

      drawInteraction = new Draw({
        source: measureSource!,
        type: measureType,
        style: measureStyle
      });

      drawInteraction.on('drawstart', () => {
        measureSource?.clear();
        currentMeasurement = null;
      });

      drawInteraction.on('drawend', (e) => {
        const geom = e.feature.getGeometry();
        if (tool === 'measure-distance' && geom) {
          currentMeasurement = formatLength(geom as LineString);
        } else if (tool === 'measure-area' && geom) {
          currentMeasurement = formatArea(geom as Polygon);
        }
      });

      map.addInteraction(drawInteraction);
    }

    // Setup split tool - draw a line to split selected polygon
    if (tool === 'split') {
      drawInteraction = new Draw({
        source: measureSource!, // Use temp source
        type: 'LineString',
        style: new Style({
          stroke: new Stroke({
            color: '#ff4444',
            width: 2,
            lineDash: [8, 8]
          })
        })
      });

      drawInteraction.on('drawend', (e) => {
        const splitLine = e.feature;
        const selected = selectInteraction?.getFeatures().getArray() as Feature<Geometry>[];

        if (selected.length === 1) {
          const targetFeature = selected[0];
          const success = performSplit(targetFeature, splitLine);
          if (success) {
            selectInteraction?.getFeatures().clear();
          }
        }

        // Remove the split line from temp source
        setTimeout(() => measureSource?.clear(), 100);
      });

      map.addInteraction(drawInteraction);
    }

    // Setup snap if enabled
    if ($toolSettings.snapEnabled && (drawInteraction || modifyInteraction)) {
      snapInteraction = new Snap({
        source: sketchSource,
        pixelTolerance: $toolSettings.snapTolerance
      });
      map.addInteraction(snapInteraction);
    }
  });

  // Watch layers store for PostGIS layers
  $effect(() => {
    if (!map) return;

    const currentLayers = $layers;

    // Get IDs of current PostGIS layers in store
    const storeLayerIds = new Set(
      currentLayers.filter(l => l.type === 'postgis').map(l => l.id)
    );

    // Remove layers that are no longer in store
    postgisLayerMap.forEach((olLayer, id) => {
      if (!storeLayerIds.has(id)) {
        map.removeLayer(olLayer);
        postgisLayerMap.delete(id);
      }
    });

    // Add new layers and update existing ones
    currentLayers.filter(l => l.type === 'postgis').forEach((layer) => {
      if (!postgisLayerMap.has(layer.id)) {
        // Create new MVT layer
        const { connectionId, schema, table } = layer.source;
        if (!connectionId || !schema || !table) return;

        const tileUrl = `${API_BASE}/databases/${connectionId}/tiles/${schema}/${table}/{z}/{x}/{y}.mvt`;

        // Generate color based on layer index
        const layerColors = [
          '#00ff88', '#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c',
          '#ff8787', '#74c0fc', '#ffe066', '#8ce99a', '#ffa8a8'
        ];
        const colorIndex = $layers.indexOf(layer) % layerColors.length;
        const color = layerColors[colorIndex];

        const vectorLayer = new VectorTileLayer({
          source: new VectorTileSource({
            format: new MVT(),
            url: tileUrl,
            maxZoom: 22
          }),
          style: new Style({
            fill: new Fill({ color: color + '40' }), // 25% opacity
            stroke: new Stroke({ color: color, width: 2 }),
            image: new CircleStyle({
              radius: 5,
              fill: new Fill({ color: color }),
              stroke: new Stroke({ color: '#fff', width: 1 })
            })
          }),
          visible: layer.visible,
          opacity: layer.opacity,
          zIndex: layer.zIndex + 100 // Above basemap, below sketching
        });

        map.addLayer(vectorLayer);
        postgisLayerMap.set(layer.id, vectorLayer);

        // Try to zoom to extent
        fetchLayerExtent(connectionId, schema, table);
      } else {
        // Update existing layer properties
        const olLayer = postgisLayerMap.get(layer.id);
        if (olLayer) {
          olLayer.setVisible(layer.visible);
          olLayer.setOpacity(layer.opacity);
          olLayer.setZIndex(layer.zIndex + 100);
        }
      }
    });
  });

  // Fetch and zoom to layer extent
  async function fetchLayerExtent(connectionId: string, schema: string, table: string) {
    try {
      const res = await fetch(`${API_BASE}/databases/${connectionId}/extent/${schema}/${table}`);
      const data = await res.json();
      if (data.extent && map) {
        const extent = data.extent as [number, number, number, number];
        map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
      }
    } catch (err) {
      console.error('Failed to fetch layer extent:', err);
    }
  }

  // Public methods
  export function zoomTo(x: number, y: number, zoom?: number) {
    if (!map) return;
    map.getView().animate({
      center: [x, y],
      zoom: zoom ?? map.getView().getZoom(),
      duration: 500
    });
  }

  export function zoomToExtent(extent: [number, number, number, number]) {
    if (!map) return;
    map.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 500
    });
  }

  export function getMap(): Map | null {
    return map;
  }

  export function getSketchSource(): VectorSource | null {
    return sketchSource || null;
  }

  // Undo last action
  export function undo(): boolean {
    const action = historyStore.popUndo();
    if (!action || !sketchSource) return false;

    switch (action.type) {
      case 'add':
        // Remove the added features
        action.featureIds.forEach(id => {
          const feature = sketchSource.getFeatureById(id);
          if (feature) {
            sketchSource.removeFeature(feature);
          }
        });
        break;

      case 'delete':
        // Restore the deleted features
        if (action.before) {
          const features = deserializeFeatures(action.before);
          features.forEach(f => sketchSource.addFeature(f));
        }
        break;

      case 'modify':
        // Restore the previous state
        if (action.before) {
          const beforeFeatures = deserializeFeatures(action.before);
          action.featureIds.forEach(id => {
            const current = sketchSource.getFeatureById(id);
            if (current) {
              sketchSource.removeFeature(current);
            }
          });
          beforeFeatures.forEach(f => sketchSource.addFeature(f));
        }
        break;
    }

    return true;
  }

  // Redo last undone action
  export function redo(): boolean {
    const action = historyStore.popRedo();
    if (!action || !sketchSource) return false;

    switch (action.type) {
      case 'add':
        // Re-add the features
        if (action.after) {
          const features = deserializeFeatures(action.after);
          features.forEach(f => sketchSource.addFeature(f));
        }
        break;

      case 'delete':
        // Re-delete the features
        action.featureIds.forEach(id => {
          const feature = sketchSource.getFeatureById(id);
          if (feature) {
            sketchSource.removeFeature(feature);
          }
        });
        break;

      case 'modify':
        // Apply the modification again
        if (action.after) {
          const afterFeatures = deserializeFeatures(action.after);
          action.featureIds.forEach(id => {
            const current = sketchSource.getFeatureById(id);
            if (current) {
              sketchSource.removeFeature(current);
            }
          });
          afterFeatures.forEach(f => sketchSource.addFeature(f));
        }
        break;
    }

    return true;
  }

  // Delete selected features
  export function deleteSelected(): boolean {
    if (!selectInteraction || !sketchSource) return false;

    const selected = selectInteraction.getFeatures().getArray() as Feature<Geometry>[];
    if (selected.length === 0) return false;

    // Record deletion in history
    historyStore.recordDelete([...selected], `${selected.length} sketching(s) supprimé(s)`);

    // Remove features
    selected.forEach(f => sketchSource.removeFeature(f));
    selectInteraction.getFeatures().clear();

    return true;
  }

  // Clear measurements
  export function clearMeasurements() {
    measureSource?.clear();
    currentMeasurement = null;
  }

  // Split a polygon with a line using Turf.js
  function performSplit(targetFeature: Feature<Geometry>, splitLineFeature: Feature<Geometry>): boolean {
    if (!sketchSource) return false;

    try {
      // Convert OpenLayers features to GeoJSON
      const targetGeoJSON = geoJsonFormat.writeFeatureObject(targetFeature);
      const lineGeoJSON = geoJsonFormat.writeFeatureObject(splitLineFeature);

      // Check if target is a polygon
      if (targetGeoJSON.geometry.type !== 'Polygon' && targetGeoJSON.geometry.type !== 'MultiPolygon') {
        console.warn('Split: Target must be a polygon');
        return false;
      }

      // Use Turf to split the polygon
      // First, buffer the line slightly to create a very thin polygon for difference
      const linePolygon = turf.buffer(lineGeoJSON as turf.Feature<turf.LineString>, 0.01, { units: 'meters' });

      if (!linePolygon) {
        console.warn('Split: Could not buffer line');
        return false;
      }

      // Split using difference - this creates two parts
      const targetPolygon = targetGeoJSON as turf.Feature<turf.Polygon | turf.MultiPolygon>;

      // Get the split result using lineSplit or polygonClipping approach
      const splitResult = turf.difference(turf.featureCollection([targetPolygon]), linePolygon);

      if (!splitResult) {
        console.warn('Split: No result from difference');
        return false;
      }

      // If it's a MultiPolygon, we've successfully split
      if (splitResult.geometry.type === 'MultiPolygon') {
        // Record in history before making changes
        historyStore.recordDelete([targetFeature], 'Polygone coupé');

        // Remove original feature
        sketchSource.removeFeature(targetFeature);

        // Add each part as a new feature
        const newFeatures: Feature<Geometry>[] = [];
        splitResult.geometry.coordinates.forEach((coords, index) => {
          const partGeoJSON = turf.polygon(coords);
          const olFeature = geoJsonFormat.readFeature(partGeoJSON) as Feature<Geometry>;
          olFeature.setStyle(getCurrentOLStyle());
          sketchSource.addFeature(olFeature);
          newFeatures.push(olFeature);
        });

        historyStore.recordAdd(newFeatures, `${newFeatures.length} parties créées`);
        return true;
      } else {
        // Single polygon returned - line didn't cross properly
        console.warn('Split: Line must completely cross the polygon');
        return false;
      }
    } catch (error) {
      console.error('Split error:', error);
      return false;
    }
  }

  // Merge selected polygons using Turf.js
  export function mergeSelected(): boolean {
    if (!selectInteraction || !sketchSource) return false;

    const selected = selectInteraction.getFeatures().getArray() as Feature<Geometry>[];
    if (selected.length < 2) {
      console.warn('Merge: Select at least 2 features');
      return false;
    }

    try {
      // Convert to GeoJSON
      const geoJSONFeatures = selected.map(f => geoJsonFormat.writeFeatureObject(f));

      // Filter only polygons
      const polygons = geoJSONFeatures.filter(f =>
        f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
      ) as turf.Feature<turf.Polygon | turf.MultiPolygon>[];

      if (polygons.length < 2) {
        console.warn('Merge: Need at least 2 polygons');
        return false;
      }

      // Union all polygons
      let merged = polygons[0];
      for (let i = 1; i < polygons.length; i++) {
        const union = turf.union(turf.featureCollection([merged, polygons[i]]));
        if (union) {
          merged = union as turf.Feature<turf.Polygon | turf.MultiPolygon>;
        }
      }

      // Record in history
      historyStore.recordDelete([...selected], `${selected.length} polygones fusionnés`);

      // Remove original features
      selected.forEach(f => sketchSource.removeFeature(f));
      selectInteraction.getFeatures().clear();

      // Add merged feature
      const mergedOlFeature = geoJsonFormat.readFeature(merged) as Feature<Geometry>;
      mergedOlFeature.setStyle(getCurrentOLStyle());
      sketchSource.addFeature(mergedOlFeature);

      historyStore.recordAdd([mergedOlFeature], 'Polygone fusionné');

      return true;
    } catch (error) {
      console.error('Merge error:', error);
      return false;
    }
  }

  // Run geoprocessing operation on selected features
  export function runProcessing(operation: string, params: Record<string, any>): boolean {
    if (!selectInteraction || !sketchSource) return false;

    const selected = selectInteraction.getFeatures().getArray() as Feature<Geometry>[];
    if (selected.length === 0) {
      console.warn('Processing: No features selected');
      return false;
    }

    try {
      // Convert selected features to GeoJSON
      const geoJSONFeatures = selected.map(f => geoJsonFormat.writeFeatureObject(f));
      let result: turf.Feature | turf.FeatureCollection | null = null;
      let description = '';

      switch (operation) {
        case 'buffer': {
          const distance = params.distance || 10;
          const buffered: turf.Feature[] = [];
          geoJSONFeatures.forEach(f => {
            const buf = turf.buffer(f as turf.Feature, distance, { units: 'meters' });
            if (buf) buffered.push(buf);
          });
          result = turf.featureCollection(buffered);
          description = `Buffer ${distance}m`;
          break;
        }

        case 'centroid': {
          const centroids: turf.Feature[] = [];
          geoJSONFeatures.forEach(f => {
            if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
              const c = turf.centroid(f as turf.Feature<turf.Polygon | turf.MultiPolygon>);
              centroids.push(c);
            }
          });
          result = turf.featureCollection(centroids);
          description = 'Centroïdes';
          break;
        }

        case 'convexHull': {
          const allPoints: turf.Feature<turf.Point>[] = [];
          geoJSONFeatures.forEach(f => {
            const coords = turf.coordAll(f as turf.Feature);
            coords.forEach(c => allPoints.push(turf.point(c)));
          });
          const fc = turf.featureCollection(allPoints);
          result = turf.convex(fc);
          description = 'Enveloppe convexe';
          break;
        }

        case 'boundingBox': {
          const allFeatures = turf.featureCollection(geoJSONFeatures as turf.Feature[]);
          const bbox = turf.bbox(allFeatures);
          result = turf.bboxPolygon(bbox);
          description = 'Boîte englobante';
          break;
        }

        case 'union': {
          const polygons = geoJSONFeatures.filter(f =>
            f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
          ) as turf.Feature<turf.Polygon | turf.MultiPolygon>[];

          if (polygons.length < 2) {
            console.warn('Union requires at least 2 polygons');
            return false;
          }

          let merged = polygons[0];
          for (let i = 1; i < polygons.length; i++) {
            const u = turf.union(turf.featureCollection([merged, polygons[i]]));
            if (u) merged = u as turf.Feature<turf.Polygon | turf.MultiPolygon>;
          }
          result = merged;
          description = 'Union';
          break;
        }

        case 'intersection': {
          const polygons = geoJSONFeatures.filter(f =>
            f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
          ) as turf.Feature<turf.Polygon | turf.MultiPolygon>[];

          if (polygons.length !== 2) {
            console.warn('Intersection requires exactly 2 polygons');
            return false;
          }

          result = turf.intersect(turf.featureCollection(polygons));
          description = 'Intersection';
          break;
        }

        case 'difference': {
          const polygons = geoJSONFeatures.filter(f =>
            f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
          ) as turf.Feature<turf.Polygon | turf.MultiPolygon>[];

          if (polygons.length !== 2) {
            console.warn('Difference requires exactly 2 polygons');
            return false;
          }

          result = turf.difference(turf.featureCollection([polygons[0]]), polygons[1]);
          description = 'Différence';
          break;
        }

        case 'symmetricDifference': {
          const polygons = geoJSONFeatures.filter(f =>
            f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
          ) as turf.Feature<turf.Polygon | turf.MultiPolygon>[];

          if (polygons.length !== 2) {
            console.warn('Symmetric difference requires exactly 2 polygons');
            return false;
          }

          // A XOR B = (A - B) + (B - A)
          const diffAB = turf.difference(turf.featureCollection([polygons[0]]), polygons[1]);
          const diffBA = turf.difference(turf.featureCollection([polygons[1]]), polygons[0]);

          if (diffAB && diffBA) {
            result = turf.union(turf.featureCollection([
              diffAB as turf.Feature<turf.Polygon | turf.MultiPolygon>,
              diffBA as turf.Feature<turf.Polygon | turf.MultiPolygon>
            ]));
          } else if (diffAB) {
            result = diffAB;
          } else if (diffBA) {
            result = diffBA;
          }
          description = 'Différence symétrique';
          break;
        }

        case 'simplify': {
          const tolerance = params.tolerance || 1;
          const simplified: turf.Feature[] = [];
          geoJSONFeatures.forEach(f => {
            const s = turf.simplify(f as turf.Feature, { tolerance, highQuality: true });
            simplified.push(s);
          });
          result = turf.featureCollection(simplified);
          description = `Simplification (${tolerance}m)`;
          break;
        }

        case 'dissolve': {
          const polygons = geoJSONFeatures.filter(f =>
            f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
          ) as turf.Feature<turf.Polygon>[];

          if (polygons.length < 2) {
            console.warn('Dissolve requires at least 2 polygons');
            return false;
          }

          const fc = turf.featureCollection(polygons);
          result = turf.dissolve(fc);
          description = 'Dissolve';
          break;
        }

        default:
          console.warn(`Unknown operation: ${operation}`);
          return false;
      }

      if (!result) {
        console.warn('Processing returned no result');
        return false;
      }

      // Add result features to the map
      const newFeatures: Feature<Geometry>[] = [];

      if (result.type === 'FeatureCollection') {
        result.features.forEach(f => {
          const olFeature = geoJsonFormat.readFeature(f) as Feature<Geometry>;
          olFeature.setStyle(getCurrentOLStyle());
          sketchSource.addFeature(olFeature);
          newFeatures.push(olFeature);
        });
      } else {
        const olFeature = geoJsonFormat.readFeature(result) as Feature<Geometry>;
        olFeature.setStyle(getCurrentOLStyle());
        sketchSource.addFeature(olFeature);
        newFeatures.push(olFeature);
      }

      // Record in history
      historyStore.recordAdd(newFeatures, description);

      // Clear selection
      selectInteraction.getFeatures().clear();

      return true;
    } catch (error) {
      console.error('Processing error:', error);
      return false;
    }
  }

  // Import features from file
  export async function importFile(file: File): Promise<{ success: boolean; count: number; error?: string }> {
    if (!sketchSource) return { success: false, count: 0, error: 'Source not initialized' };

    try {
      const content = await file.text();
      const extension = file.name.toLowerCase().split('.').pop();
      let features: Feature<Geometry>[] = [];

      switch (extension) {
        case 'geojson':
        case 'json':
          features = geoJsonFormat.readFeatures(content, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:2056'
          }) as Feature<Geometry>[];
          break;

        case 'kml':
        case 'kmz':
          features = kmlFormat.readFeatures(content, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:2056'
          }) as Feature<Geometry>[];
          break;

        case 'gpx':
          features = gpxFormat.readFeatures(content, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:2056'
          }) as Feature<Geometry>[];
          break;

        default:
          return { success: false, count: 0, error: `Format non supporté: .${extension}` };
      }

      if (features.length === 0) {
        return { success: false, count: 0, error: 'Aucune entité trouvée dans le fichier' };
      }

      // Apply current style to imported features
      const style = getCurrentOLStyle();
      features.forEach(f => {
        f.setStyle(style);
        sketchSource.addFeature(f);
      });

      // Record in history
      historyStore.recordAdd(features, `Import ${file.name}`);

      return { success: true, count: features.length };
    } catch (error) {
      console.error('Import error:', error);
      return { success: false, count: 0, error: `Erreur de lecture: ${error instanceof Error ? error.message : 'Inconnue'}` };
    }
  }

  // Export features to format
  export function exportFeatures(format: 'geojson' | 'kml' | 'gpx', selectedOnly: boolean = false): string | null {
    if (!sketchSource) return null;

    try {
      let features: Feature<Geometry>[];

      if (selectedOnly && selectInteraction) {
        features = selectInteraction.getFeatures().getArray() as Feature<Geometry>[];
      } else {
        features = sketchSource.getFeatures();
      }

      if (features.length === 0) {
        console.warn('Export: No features to export');
        return null;
      }

      switch (format) {
        case 'geojson':
          return geoJsonFormat.writeFeatures(features, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:2056'
          });

        case 'kml':
          return kmlFormat.writeFeatures(features, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:2056'
          });

        case 'gpx':
          // GPX only supports points, lines - convert polygons to linestrings
          const gpxFeatures = features.map(f => {
            const geom = f.getGeometry();
            if (geom && geom.getType() === 'Polygon') {
              // Convert polygon to linestring for GPX
              const polyGeom = geom as unknown as { getCoordinates(): number[][][] };
              const coords = polyGeom.getCoordinates()[0];
              const clone = f.clone();
              clone.setGeometry(new LineString(coords));
              return clone;
            }
            return f;
          });
          return gpxFormat.writeFeatures(gpxFeatures, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:2056'
          });

        default:
          return null;
      }
    } catch (error) {
      console.error('Export error:', error);
      return null;
    }
  }

  // Get all features as GeoJSON (utility)
  export function getAllFeaturesAsGeoJSON(): string | null {
    return exportFeatures('geojson', false);
  }

  // Get selected features count
  export function getSelectedCount(): number {
    return selectInteraction?.getFeatures().getLength() || 0;
  }

  // Get total features count
  export function getTotalCount(): number {
    return sketchSource?.getFeatures().length || 0;
  }
</script>

<div class="qgls-map" bind:this={mapElement}></div>

<!-- Basemap selector -->
<div class="basemap-selector" class:open={basemapSelectorOpen}>
  <button
    class="basemap-current"
    onclick={() => basemapSelectorOpen = !basemapSelectorOpen}
    title="Changer le fond de plan"
  >
    <div class="basemap-icon" style="background-color: {getSelectedBasemap().color}">
      {#if getSelectedBasemap().icon === 'satellite'}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2v20" stroke="#000" stroke-width="1" opacity="0.3"/>
        </svg>
      {:else if getSelectedBasemap().icon === 'grid'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="3" y1="15" x2="21" y2="15"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      {/if}
    </div>
    <span class="basemap-name">{getSelectedBasemap().shortName}</span>
    <svg class="basemap-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </button>

  {#if basemapSelectorOpen}
    <div class="basemap-dropdown">
      <div class="basemap-category">
        <span class="category-label">ASIT-VD</span>
        {#each basemaps.filter(b => b.category === 'asit') as bm}
          <button
            class="basemap-option"
            class:selected={selectedBasemapId === bm.id}
            onclick={() => changeBasemap(bm.id)}
          >
            <div class="option-icon" style="background-color: {bm.color}">
              {#if bm.icon === 'grid'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="3" y1="15" x2="21" y2="15"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                  <line x1="15" y1="3" x2="15" y2="21"/>
                </svg>
              {:else}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              {/if}
            </div>
            <span class="option-name">{bm.name}</span>
            {#if selectedBasemapId === bm.id}
              <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
        {/each}
      </div>
      <div class="basemap-category">
        <span class="category-label">Swisstopo</span>
        {#each basemaps.filter(b => b.category === 'swisstopo') as bm}
          <button
            class="basemap-option"
            class:selected={selectedBasemapId === bm.id}
            onclick={() => changeBasemap(bm.id)}
          >
            <div class="option-icon" style="background-color: {bm.color}">
              {#if bm.icon === 'satellite'}
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M2 12h20M12 2v20" stroke="#000" stroke-width="1" opacity="0.3"/>
                </svg>
              {:else}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              {/if}
            </div>
            <span class="option-name">{bm.name}</span>
            {#if selectedBasemapId === bm.id}
              <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Status bar -->
<div class="map-status">
  <span class="status-item projection">EPSG:2056</span>
  {#if cursorPosition}
    <span class="status-item coordinates">
      E: {cursorPosition[0].toLocaleString('fr-CH')} | N: {cursorPosition[1].toLocaleString('fr-CH')}
    </span>
  {/if}
  <span class="status-item zoom">Zoom: {currentZoom}</span>
  <span class="status-item sketching">{sketchSource?.getFeatures().length || 0} sketches</span>
  {#if currentMeasurement}
    <span class="status-item measurement">{currentMeasurement}</span>
  {/if}
</div>

<style>
  .qgls-map {
    width: 100%;
    height: 100%;
    background: #1a1a1a;
  }

  .qgls-map :global(.ol-control) {
    background: var(--bg-secondary, rgba(0,0,0,0.7));
    border-radius: 4px;
  }

  .qgls-map :global(.ol-control button) {
    background: var(--bg-tertiary, #333);
    color: var(--text-primary, #fff);
    border: none;
    cursor: pointer;
  }

  .qgls-map :global(.ol-control button:hover) {
    background: var(--cyber-green, #00ff88);
    color: #000;
  }

  .qgls-map :global(.ol-scale-line) {
    background: var(--bg-secondary, rgba(0,0,0,0.7));
    padding: 4px 8px;
    border-radius: 4px;
    bottom: 30px;
  }

  .qgls-map :global(.ol-scale-line-inner) {
    color: var(--text-primary, #fff);
    border-color: var(--text-primary, #fff);
    font-size: 11px;
  }

  .map-status {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 6px 12px;
    background: var(--bg-secondary, rgba(0,0,0,0.8));
    border-top: 1px solid var(--border-color);
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: var(--text-secondary);
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-item.projection {
    color: var(--cyber-green, #00ff88);
  }

  .status-item.coordinates {
    flex: 1;
  }

  .status-item.measurement {
    color: #ffc800;
    font-weight: 600;
    background: rgba(255, 200, 0, 0.15);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 200, 0, 0.3);
  }

  /* Basemap selector */
  .basemap-selector {
    position: absolute;
    bottom: 40px;
    right: 12px;
    z-index: 100;
  }

  .basemap-current {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--bg-secondary, rgba(0,0,0,0.85));
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 12px;
    font-family: var(--font-mono, monospace);
  }

  .basemap-current:hover {
    background: var(--bg-tertiary, rgba(0,0,0,0.95));
    border-color: var(--cyber-green, #00ff88);
  }

  .basemap-selector.open .basemap-current {
    border-color: var(--cyber-green, #00ff88);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .basemap-icon {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .basemap-icon svg {
    width: 16px;
    height: 16px;
    color: white;
  }

  .basemap-name {
    min-width: 50px;
  }

  .basemap-arrow {
    width: 14px;
    height: 14px;
    color: var(--text-muted, #888);
    transition: transform 0.15s ease;
  }

  .basemap-selector.open .basemap-arrow {
    transform: rotate(180deg);
  }

  .basemap-dropdown {
    position: absolute;
    bottom: 100%;
    right: 0;
    min-width: 200px;
    background: var(--bg-secondary, rgba(0,0,0,0.95));
    border: 1px solid var(--cyber-green, #00ff88);
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    overflow: hidden;
  }

  .basemap-category {
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .basemap-category:last-child {
    border-bottom: none;
  }

  .category-label {
    display: block;
    padding: 4px 12px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted, #888);
  }

  .basemap-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--text-primary, #fff);
    cursor: pointer;
    transition: background 0.1s ease;
    font-size: 12px;
    text-align: left;
  }

  .basemap-option:hover {
    background: rgba(255,255,255,0.08);
  }

  .basemap-option.selected {
    background: rgba(0, 255, 136, 0.15);
  }

  .option-icon {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .option-icon svg {
    width: 18px;
    height: 18px;
    color: white;
  }

  .option-name {
    flex: 1;
  }

  .check-icon {
    width: 16px;
    height: 16px;
    color: var(--cyber-green, #00ff88);
  }
</style>
