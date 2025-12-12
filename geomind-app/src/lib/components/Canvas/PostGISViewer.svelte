<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // OpenLayers imports
  import Map from 'ol/Map';
  import View from 'ol/View';
  import TileLayer from 'ol/layer/Tile';
  import VectorTileLayer from 'ol/layer/VectorTile';
  import WMTS from 'ol/source/WMTS';
  import XYZ from 'ol/source/XYZ';
  import VectorTileSource from 'ol/source/VectorTile';
  import MVT from 'ol/format/MVT';
  import WMTSTileGrid from 'ol/tilegrid/WMTS';
  import { get as getProjection, transformExtent } from 'ol/proj';
  import { register } from 'ol/proj/proj4';
  import { getTopLeft, getWidth } from 'ol/extent';
  import { defaults as defaultControls, ScaleLine, Zoom } from 'ol/control';
  import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
  import Overlay from 'ol/Overlay';
  import proj4 from 'proj4';
  import 'ol/ol.css';

  // Enregistrer la projection suisse EPSG:2056 (MN95)
  proj4.defs('EPSG:2056', '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs');
  register(proj4);

  // Types
  interface GeoTable {
    schema: string;
    table: string;
    fullName: string;
    geometryColumn: string;
    geometryType: string;
    srid: number;
  }

  interface DBConnection {
    id: string;
    name: string;
    type: string;
    host?: string;
    database?: string;
    status: string;
  }

  interface BasemapConfig {
    id: string;
    name: string;
    type: 'wmts-2056' | 'wmts-3857' | 'xyz';
    url: string;
    layer?: string;
    matrixSet?: string;
    category: 'asit' | 'swisstopo';
    preview?: string;
  }

  // Props
  interface Props {
    initialConnectionId?: string;
  }

  let { initialConnectionId = '' }: Props = $props();

  // State
  let mapContainer: HTMLDivElement;
  let popupContainer: HTMLDivElement;
  let map: Map | null = null;
  let mapLoaded = $state(false);
  let connections = $state<DBConnection[]>([]);
  let selectedConnectionId = $state(initialConnectionId);
  let geoTables = $state<GeoTable[]>([]);
  let activeLayers = $state<Set<string>>(new Set());
  let layerMap = new Map<string, VectorTileLayer>();
  let loading = $state(false);
  let error = $state<string | null>(null);
  let currentZoom = $state(12);
  let currentCenter = $state<[number, number]>([2533500, 1152000]); // Bussigny en MN95
  let sidebarCollapsed = $state(false);
  let popupContent = $state<string>('');
  let overlay: Overlay | null = null;

  // Sidebar UI state
  let layerSearch = $state('');
  let expandedSchemas = $state<Set<string>>(new Set());
  let activeTab = $state<'layers' | 'basemaps'>('layers');

  // Basemaps - ASIT-VD (2056) + Swisstopo
  const basemaps: BasemapConfig[] = [
    // ASIT-VD en EPSG:2056 (natif)
    { id: 'asit-couleur', name: 'Couleur', category: 'asit', type: 'wmts-2056', url: 'https://wmts.asit-asso.ch/wmts', layer: 'asitvd.fond_couleur', matrixSet: '2056' },
    { id: 'asit-gris', name: 'Gris', category: 'asit', type: 'wmts-2056', url: 'https://wmts.asit-asso.ch/wmts', layer: 'asitvd.fond_gris', matrixSet: '2056' },
    { id: 'asit-cadastral', name: 'Cadastral', category: 'asit', type: 'wmts-2056', url: 'https://wmts.asit-asso.ch/wmts', layer: 'asitvd.fond_cadastral', matrixSet: '2056' },
    // Swisstopo en EPSG:2056
    { id: 'swisstopo', name: 'Couleur', category: 'swisstopo', type: 'xyz', url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/2056/{z}/{x}/{y}.jpeg' },
    { id: 'swisstopo-grey', name: 'Gris', category: 'swisstopo', type: 'xyz', url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/2056/{z}/{x}/{y}.jpeg' },
    { id: 'ortho', name: 'Ortho', category: 'swisstopo', type: 'xyz', url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/2056/{z}/{x}/{y}.jpeg' },
  ];
  let selectedBasemap = $state('asit-gris');

  // Grouper les tables par schéma
  function getTablesBySchema(tables: GeoTable[], search: string): Record<string, GeoTable[]> {
    const filtered = search
      ? tables.filter(t => t.table.toLowerCase().includes(search.toLowerCase()) || t.schema.toLowerCase().includes(search.toLowerCase()))
      : tables;

    return filtered.reduce((acc, table) => {
      if (!acc[table.schema]) acc[table.schema] = [];
      acc[table.schema].push(table);
      return acc;
    }, {} as Record<string, GeoTable[]>);
  }

  // Toggle un schéma ouvert/fermé
  function toggleSchema(schema: string) {
    const newSet = new Set(expandedSchemas);
    if (newSet.has(schema)) {
      newSet.delete(schema);
    } else {
      newSet.add(schema);
    }
    expandedSchemas = newSet;
  }

  // Icône selon le type de géométrie
  function getGeomIcon(geomType: string): string {
    const upper = geomType.toUpperCase();
    if (upper.includes('POINT')) return 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z';
    if (upper.includes('LINE')) return 'M3 17l6-6 4 4 8-8';
    if (upper.includes('POLYGON')) return 'M3 3h18v18H3V3zm2 2v14h14V5H5z';
    return 'M12 2l10 20H2L12 2z';
  }

  // Compter les couches actives par schéma
  function countActiveInSchema(schema: string): number {
    return geoTables.filter(t => t.schema === schema && activeLayers.has(t.fullName)).length;
  }

  // Désactiver toutes les couches
  function clearAllLayers() {
    if (!map) return;
    layerMap.forEach((layer) => map!.removeLayer(layer));
    layerMap.clear();
    activeLayers = new Set();
  }

  // Couleurs pour les couches
  const layerColors = [
    '#00ff88', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
    '#ffeaa7', '#fd79a8', '#a29bfe', '#6c5ce7', '#e17055'
  ];

  // Résolutions pour la grille de tuiles suisse (EPSG:2056)
  const swissResolutions = [
    4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250,
    1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5, 0.25, 0.1
  ];

  // Matrice pour ASIT-VD WMTS
  const asitMatrixIds = swissResolutions.map((_, i) => i.toString());

  // Extent de la Suisse en EPSG:2056
  const swissExtent = [2420000, 1030000, 2900000, 1350000];

  // Créer une source WMTS ASIT
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

  // Créer une source XYZ pour Swisstopo
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

  // Créer le layer de fond selon le type
  function createBasemapLayer(config: BasemapConfig): TileLayer<any> {
    let source;

    if (config.type === 'wmts-2056' && config.layer) {
      source = createAsitSource(config.layer);
    } else if (config.type === 'xyz') {
      source = createSwisstopoSource(config.url);
    } else {
      source = new XYZ({ url: config.url });
    }

    return new TileLayer({ source });
  }

  // Charger les connexions PostgreSQL
  async function loadConnections() {
    try {
      const res = await fetch('http://localhost:3001/api/connections');
      const data = await res.json();
      connections = data.filter((c: DBConnection) => c.type === 'postgresql');

      if (!selectedConnectionId && connections.length > 0) {
        const srvFme = connections.find(c => c.host === 'srv-fme' && c.database === 'Prod');
        const connected = connections.find(c => c.status === 'connected');
        selectedConnectionId = srvFme?.id || connected?.id || connections[0].id;
      }
    } catch (err) {
      console.error('[PostGIS] Erreur chargement connexions:', err);
    }
  }

  // Charger les tables géométriques
  async function loadGeoTables() {
    if (!selectedConnectionId) return;

    loading = true;
    error = null;

    try {
      await fetch(`http://localhost:3001/api/connections/${selectedConnectionId}/connect`, {
        method: 'POST'
      });

      const res = await fetch(`http://localhost:3001/api/databases/${selectedConnectionId}/geotables`);
      const data = await res.json();

      if (data.success) {
        geoTables = data.tables;
        console.log('[PostGIS] Tables chargées:', geoTables.length);
      } else {
        throw new Error(data.error || 'Erreur chargement tables');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur inconnue';
      geoTables = [];
    } finally {
      loading = false;
    }
  }

  // Initialiser la carte OpenLayers
  function initMap() {
    if (!mapContainer || map) return;

    const config = basemaps.find(b => b.id === selectedBasemap) || basemaps[0];
    const basemapLayer = createBasemapLayer(config);
    basemapLayer.set('name', 'basemap');

    const projection = getProjection('EPSG:2056')!;

    map = new Map({
      target: mapContainer,
      layers: [basemapLayer],
      view: new View({
        projection: projection,
        center: currentCenter,
        zoom: currentZoom,
        minZoom: 0,
        maxZoom: 28,
        extent: swissExtent,
      }),
      controls: defaultControls({ zoom: true, rotate: false }).extend([
        new ScaleLine({ units: 'metric' }),
      ]),
    });

    // Overlay pour popup
    overlay = new Overlay({
      element: popupContainer,
      autoPan: { animation: { duration: 250 } },
    });
    map.addOverlay(overlay);

    // Events
    map.on('moveend', () => {
      if (map) {
        const view = map.getView();
        const center = view.getCenter();
        if (center) {
          currentCenter = [center[0], center[1]];
        }
        currentZoom = Math.round(view.getZoom() || 12);
      }
    });

    // Click pour popup
    map.on('singleclick', handleMapClick);

    mapLoaded = true;
    console.log('[PostGIS] Carte OpenLayers initialisée (EPSG:2056)');
  }

  // Changer le fond de carte
  function changeBasemap(basemapId: string) {
    selectedBasemap = basemapId;
    if (!map) return;

    const config = basemaps.find(b => b.id === basemapId);
    if (!config) return;

    // Trouver et remplacer le layer de fond
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

  // Style pour les couches vectorielles
  function createLayerStyle(color: string, geomType: string): Style {
    const upperType = geomType.toUpperCase();

    if (upperType.includes('POLYGON') || upperType.includes('MULTI')) {
      return new Style({
        fill: new Fill({ color: color + '66' }), // 40% opacity
        stroke: new Stroke({ color: color, width: 2 }),
      });
    } else if (upperType.includes('LINE')) {
      return new Style({
        stroke: new Stroke({ color: color, width: 3 }),
      });
    } else {
      return new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: color }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
      });
    }
  }

  // Toggle une couche
  async function toggleLayer(table: GeoTable) {
    if (!map || !mapLoaded || !selectedConnectionId) {
      console.error('[PostGIS] Carte non prête');
      return;
    }

    const layerId = table.fullName;

    if (activeLayers.has(layerId)) {
      // Supprimer la couche
      const layer = layerMap.get(layerId);
      if (layer) {
        map.removeLayer(layer);
        layerMap.delete(layerId);
      }
      activeLayers.delete(layerId);
      activeLayers = new Set(activeLayers);
    } else {
      // Ajouter la couche
      const colorIndex = activeLayers.size % layerColors.length;
      const color = layerColors[colorIndex];

      const tileUrl = `http://localhost:3001/api/databases/${selectedConnectionId}/tiles/${table.schema}/${table.table}/{z}/{x}/{y}.mvt`;

      const vectorLayer = new VectorTileLayer({
        source: new VectorTileSource({
          format: new MVT(),
          url: tileUrl,
          projection: 'EPSG:3857', // Les tuiles MVT sont en 3857
        }),
        style: createLayerStyle(color, table.geometryType),
      });

      vectorLayer.set('tableName', layerId);
      vectorLayer.set('tableInfo', table);

      map.addLayer(vectorLayer);
      layerMap.set(layerId, vectorLayer);
      activeLayers.add(layerId);
      activeLayers = new Set(activeLayers);

      // Zoomer sur l'extent
      try {
        const extentRes = await fetch(
          `http://localhost:3001/api/databases/${selectedConnectionId}/extent/${table.schema}/${table.table}`
        );
        const extentData = await extentRes.json();
        if (extentData.success && extentData.extent) {
          const { minx, miny, maxx, maxy } = extentData.extent;
          // Transformer de 4326 vers 2056
          const extent2056 = transformExtent([minx, miny, maxx, maxy], 'EPSG:4326', 'EPSG:2056');
          map.getView().fit(extent2056, { padding: [50, 50, 50, 50], duration: 500 });
        }
      } catch (e) {
        console.warn('[PostGIS] Impossible de récupérer l\'extent:', e);
      }

      console.log('[PostGIS] Couche ajoutée:', layerId);
    }
  }

  // Gestion du clic pour popup
  function handleMapClick(evt: any) {
    if (!map || !overlay) return;

    const features = map.getFeaturesAtPixel(evt.pixel);

    if (features && features.length > 0) {
      const feature = features[0];
      const props = feature.getProperties();

      // Filtrer les propriétés internes
      const displayProps = Object.entries(props)
        .filter(([k]) => !k.startsWith('_') && k !== 'geometry' && k !== 'layer')
        .slice(0, 10);

      if (displayProps.length > 0) {
        const tableName = props['layer'] || 'Feature';
        popupContent = `
          <div class="popup-title">${tableName}</div>
          <div class="popup-props">
            ${displayProps.map(([k, v]) => `
              <div class="popup-row">
                <span class="popup-key">${k}:</span>
                <span class="popup-value">${v}</span>
              </div>
            `).join('')}
          </div>
        `;
        overlay.setPosition(evt.coordinate);
      }
    } else {
      closePopup();
    }
  }

  function closePopup() {
    if (overlay) {
      overlay.setPosition(undefined);
    }
  }

  // Rafraîchir
  async function refresh() {
    await loadConnections();
    if (selectedConnectionId) {
      await loadGeoTables();
    }
  }

  // Effet pour charger les tables quand la connexion change
  $effect(() => {
    if (selectedConnectionId) {
      // Vider les couches actives quand on change de connexion
      if (map) {
        layerMap.forEach((layer) => map!.removeLayer(layer));
        layerMap.clear();
        activeLayers = new Set();
      }
      loadGeoTables();
    }
  });

  onMount(async () => {
    await loadConnections();
    initMap();
  });

  onDestroy(() => {
    if (map) {
      map.setTarget(undefined);
      map = null;
    }
  });

  // ============================================
  // Fonctions exposées pour le contrôle externe
  // ============================================

  // Zoomer sur des coordonnées MN95
  export function zoomTo(x: number, y: number, zoom?: number) {
    if (!map) return;
    const view = map.getView();
    view.animate({
      center: [x, y],
      zoom: zoom ?? view.getZoom(),
      duration: 500
    });
  }

  // Zoomer sur une étendue [minX, minY, maxX, maxY] en MN95
  export function zoomToExtent(minX: number, minY: number, maxX: number, maxY: number) {
    if (!map) return;
    map.getView().fit([minX, minY, maxX, maxY], {
      padding: [50, 50, 50, 50],
      duration: 500
    });
  }

  // Activer/désactiver une couche par nom (schema.table)
  export function toggleLayerByName(layerName: string, visible?: boolean) {
    const table = geoTables.find(t => t.fullName === layerName);
    if (!table) {
      console.warn('[PostGIS] Table non trouvée:', layerName);
      return false;
    }

    const isActive = activeLayers.has(layerName);
    const shouldBeActive = visible ?? !isActive;

    if (shouldBeActive !== isActive) {
      toggleLayer(table);
    }
    return true;
  }

  // Ajouter une couche (active si pas déjà active)
  export function addLayerByName(layerName: string) {
    if (!activeLayers.has(layerName)) {
      return toggleLayerByName(layerName, true);
    }
    return true;
  }

  // Retirer une couche
  export function removeLayerByName(layerName: string) {
    if (activeLayers.has(layerName)) {
      return toggleLayerByName(layerName, false);
    }
    return true;
  }

  // Obtenir les couches actives
  export function getActiveLayers(): string[] {
    return Array.from(activeLayers);
  }

  // Exécuter une requête SQL
  export async function executeSQL(query: string): Promise<any> {
    if (!selectedConnectionId) {
      throw new Error('Aucune connexion PostGIS active');
    }

    const res = await fetch(`http://localhost:3001/api/databases/${selectedConnectionId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Erreur SQL');
    }
    return data.results;
  }

  // Obtenir les tables disponibles
  export function getAvailableTables(): GeoTable[] {
    return geoTables;
  }

  // Obtenir l'état courant de la carte
  export function getMapState() {
    return {
      zoom: currentZoom,
      center: currentCenter,
      activeLayers: Array.from(activeLayers),
      connectionId: selectedConnectionId
    };
  }

  // Highlight une feature GeoJSON (TODO: implémenter)
  export function highlightFeature(geojson: any) {
    console.log('[PostGIS] Highlight feature:', geojson);
    // TODO: Ajouter un layer temporaire pour highlight
  }
</script>

<div class="postgis-viewer">
  <!-- Sidebar -->
  <aside class="sidebar" class:collapsed={sidebarCollapsed}>
    <div class="sidebar-header">
      <h3>PostGIS</h3>
      <button
        class="collapse-btn"
        onclick={() => sidebarCollapsed = !sidebarCollapsed}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if sidebarCollapsed}
            <path d="M9 18l6-6-6-6"/>
          {:else}
            <path d="M15 18l-6-6 6-6"/>
          {/if}
        </svg>
      </button>
    </div>

    {#if !sidebarCollapsed}
      <div class="sidebar-content">
        <!-- Sélection connexion -->
        <div class="connection-bar">
          <select bind:value={selectedConnectionId} class="connection-select">
            <option value="">-- Connexion --</option>
            {#each connections as conn}
              <option value={conn.id}>{conn.name}</option>
            {/each}
          </select>
          <button class="icon-btn" onclick={refresh} title="Rafraîchir">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button
            class="tab"
            class:active={activeTab === 'layers'}
            onclick={() => activeTab = 'layers'}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            Couches
            {#if activeLayers.size > 0}
              <span class="badge">{activeLayers.size}</span>
            {/if}
          </button>
          <button
            class="tab"
            class:active={activeTab === 'basemaps'}
            onclick={() => activeTab = 'basemaps'}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M9 21V9"/>
            </svg>
            Fonds
          </button>
        </div>

        <!-- Tab Content: Couches -->
        {#if activeTab === 'layers'}
          <div class="tab-content">
            <!-- Recherche -->
            <div class="search-bar">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Rechercher..."
                bind:value={layerSearch}
              />
              {#if activeLayers.size > 0}
                <button class="clear-btn" onclick={clearAllLayers} title="Tout désélectionner">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              {/if}
            </div>

            <!-- Liste des couches groupées par schéma -->
            <div class="layers-panel">
              {#if loading}
                <div class="status-msg">Chargement...</div>
              {:else if error}
                <div class="status-msg error">{error}</div>
              {:else if geoTables.length === 0}
                <div class="status-msg">Sélectionnez une connexion</div>
              {:else}
                {@const tablesBySchema = getTablesBySchema(geoTables, layerSearch)}
                {#each Object.entries(tablesBySchema).sort((a, b) => a[0].localeCompare(b[0])) as [schema, tables]}
                  <div class="schema-group">
                    <button
                      class="schema-header"
                      class:expanded={expandedSchemas.has(schema)}
                      onclick={() => toggleSchema(schema)}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d={expandedSchemas.has(schema) ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'}/>
                      </svg>
                      <span class="schema-name">{schema}</span>
                      <span class="schema-count">
                        {#if countActiveInSchema(schema) > 0}
                          <span class="active-count">{countActiveInSchema(schema)}/</span>
                        {/if}
                        {tables.length}
                      </span>
                    </button>

                    {#if expandedSchemas.has(schema)}
                      <div class="schema-layers">
                        {#each tables as table}
                          <label
                            class="layer-row"
                            class:active={activeLayers.has(table.fullName)}
                            class:disabled={!mapLoaded}
                          >
                            <input
                              type="checkbox"
                              checked={activeLayers.has(table.fullName)}
                              onchange={() => toggleLayer(table)}
                              disabled={!mapLoaded}
                            />
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="geom-icon">
                              <path d={getGeomIcon(table.geometryType)}/>
                            </svg>
                            <span class="layer-name">{table.table}</span>
                          </label>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}

        <!-- Tab Content: Fonds de plan -->
        {#if activeTab === 'basemaps'}
          <div class="tab-content basemaps-content">
            <!-- ASIT-VD -->
            <div class="basemap-category">
              <div class="category-label">ASIT-VD</div>
              <div class="basemap-grid">
                {#each basemaps.filter(b => b.category === 'asit') as basemap}
                  <button
                    class="basemap-card"
                    class:selected={selectedBasemap === basemap.id}
                    onclick={() => changeBasemap(basemap.id)}
                  >
                    <div class="basemap-preview" data-type={basemap.id}></div>
                    <span class="basemap-name">{basemap.name}</span>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Swisstopo -->
            <div class="basemap-category">
              <div class="category-label">Swisstopo</div>
              <div class="basemap-grid">
                {#each basemaps.filter(b => b.category === 'swisstopo') as basemap}
                  <button
                    class="basemap-card"
                    class:selected={selectedBasemap === basemap.id}
                    onclick={() => changeBasemap(basemap.id)}
                  >
                    <div class="basemap-preview" data-type={basemap.id}></div>
                    <span class="basemap-name">{basemap.name}</span>
                  </button>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </aside>

  <!-- Map container -->
  <div class="map-wrapper">
    <div class="map-container" bind:this={mapContainer}></div>

    <!-- Popup -->
    <div class="ol-popup" bind:this={popupContainer}>
      <button class="ol-popup-closer" onclick={closePopup}>×</button>
      <div class="popup-content">
        {@html popupContent}
      </div>
    </div>
  </div>

  <!-- Status bar -->
  <div class="status-bar">
    <span class="status-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      Zoom: {currentZoom}
    </span>
    <span class="status-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
      {currentCenter[0].toFixed(0)}, {currentCenter[1].toFixed(0)}
    </span>
    <span class="status-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      {activeLayers.size} couche{activeLayers.size !== 1 ? 's' : ''}
    </span>
    <span class="status-item projection">EPSG:2056</span>
  </div>
</div>

<style>
  .postgis-viewer {
    display: flex;
    height: 100%;
    position: relative;
    background: var(--bg-primary, #0f0f1a);
  }

  .sidebar {
    width: 260px;
    background: var(--noir-card, #1e1e2e);
    border-right: 1px solid var(--border-color, #3a3a4a);
    display: flex;
    flex-direction: column;
    transition: width 0.2s ease;
    z-index: 10;
  }

  .sidebar.collapsed {
    width: 40px;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-bottom: 1px solid var(--border-color, #3a3a4a);
    background: var(--noir-surface, #252535);
  }

  .sidebar-header h3 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--cyber-green, #00ff88);
    font-weight: 600;
  }

  .sidebar.collapsed .sidebar-header h3 {
    display: none;
  }

  .collapse-btn {
    padding: 4px;
    border: none;
    background: transparent;
    color: var(--text-muted, #888);
    cursor: pointer;
    border-radius: 4px;
  }

  .collapse-btn:hover {
    background: var(--bg-hover, #2a2a3a);
    color: var(--cyber-green, #00ff88);
  }

  .collapse-btn svg {
    width: 18px;
    height: 18px;
  }

  .sidebar-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Connection bar */
  .connection-bar {
    display: flex;
    gap: 6px;
    padding: 10px;
    border-bottom: 1px solid var(--border-color, #3a3a4a);
  }

  .connection-select {
    flex: 1;
    padding: 8px 10px;
    border: 1px solid var(--border-color, #3a3a4a);
    border-radius: 6px;
    background: var(--noir-surface, #252535);
    color: var(--text-primary, #e0e0e0);
    font-size: 0.8rem;
  }

  .icon-btn {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-color, #3a3a4a);
    border-radius: 6px;
    background: var(--noir-surface, #252535);
    color: var(--text-muted, #888);
    cursor: pointer;
    transition: all 0.15s;
  }

  .icon-btn:hover {
    color: var(--cyber-green, #00ff88);
    border-color: var(--cyber-green, #00ff88);
  }

  .icon-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Tabs */
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color, #3a3a4a);
  }

  .tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 8px;
    border: none;
    background: transparent;
    color: var(--text-muted, #888);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
  }

  .tab:hover {
    color: var(--text-primary, #e0e0e0);
    background: var(--bg-hover, #2a2a3a);
  }

  .tab.active {
    color: var(--cyber-green, #00ff88);
  }

  .tab.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--cyber-green, #00ff88);
  }

  .badge {
    background: var(--cyber-green, #00ff88);
    color: var(--noir-profond, #0a0a0f);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }

  /* Tab content */
  .tab-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Search bar */
  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--noir-surface, #252535);
    border-bottom: 1px solid var(--border-color, #3a3a4a);
  }

  .search-bar svg {
    color: var(--text-muted, #888);
    flex-shrink: 0;
  }

  .search-bar input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text-primary, #e0e0e0);
    font-size: 0.8rem;
    outline: none;
  }

  .search-bar input::placeholder {
    color: var(--text-muted, #666);
  }

  .clear-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: rgba(255, 100, 100, 0.2);
    color: #ff6b6b;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .clear-btn:hover {
    background: rgba(255, 100, 100, 0.3);
  }

  /* Layers panel */
  .layers-panel {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  }

  .status-msg {
    padding: 20px;
    text-align: center;
    font-size: 0.8rem;
    color: var(--text-muted, #888);
  }

  .status-msg.error {
    color: #ff6b6b;
  }

  /* Schema groups */
  .schema-group {
    margin-bottom: 2px;
  }

  .schema-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: none;
    background: var(--noir-surface, #252535);
    color: var(--text-primary, #e0e0e0);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s;
  }

  .schema-header:hover {
    background: var(--bg-hover, #2a2a3a);
  }

  .schema-header.expanded {
    border-radius: 6px 6px 0 0;
    background: var(--bg-hover, #2a2a3a);
  }

  .schema-header svg {
    color: var(--text-muted, #888);
    transition: transform 0.15s;
  }

  .schema-name {
    flex: 1;
    text-align: left;
  }

  .schema-count {
    font-size: 0.7rem;
    color: var(--text-muted, #888);
    font-weight: 400;
  }

  .active-count {
    color: var(--cyber-green, #00ff88);
    font-weight: 600;
  }

  .schema-layers {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 0 0 6px 6px;
    padding: 4px;
    margin-bottom: 4px;
  }

  .layer-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .layer-row:hover {
    background: var(--bg-hover, #2a2a3a);
  }

  .layer-row.active {
    background: rgba(0, 255, 136, 0.1);
  }

  .layer-row.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .layer-row input {
    accent-color: var(--cyber-green, #00ff88);
    width: 14px;
    height: 14px;
  }

  .geom-icon {
    color: var(--text-muted, #888);
    flex-shrink: 0;
  }

  .layer-row.active .geom-icon {
    color: var(--cyber-green, #00ff88);
  }

  .layer-name {
    flex: 1;
    font-size: 0.75rem;
    color: var(--text-secondary, #aaa);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .layer-row.active .layer-name {
    color: var(--text-primary, #e0e0e0);
  }

  /* Basemaps content */
  .basemaps-content {
    padding: 10px;
    overflow-y: auto;
  }

  .basemap-category {
    margin-bottom: 16px;
  }

  .category-label {
    font-size: 0.7rem;
    color: var(--text-muted, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    padding-left: 4px;
  }

  .basemap-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .basemap-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 4px;
    border: 2px solid var(--border-color, #3a3a4a);
    border-radius: 8px;
    background: var(--noir-surface, #252535);
    cursor: pointer;
    transition: all 0.15s;
  }

  .basemap-card:hover {
    border-color: var(--text-muted, #888);
  }

  .basemap-card.selected {
    border-color: var(--cyber-green, #00ff88);
    box-shadow: 0 0 10px rgba(0, 255, 136, 0.2);
  }

  .basemap-preview {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 4px;
    background-size: cover;
    background-position: center;
  }

  /* Preview backgrounds */
  .basemap-preview[data-type="asit-couleur"] {
    background: linear-gradient(135deg, #f5e6d3 0%, #e8d4c0 50%, #d4c4a8 100%);
  }
  .basemap-preview[data-type="asit-gris"] {
    background: linear-gradient(135deg, #888 0%, #666 50%, #555 100%);
  }
  .basemap-preview[data-type="asit-cadastral"] {
    background: linear-gradient(135deg, #fff 0%, #f0f0f0 50%, #e0e0e0 100%);
    border: 1px solid #ccc;
  }
  .basemap-preview[data-type="swisstopo"] {
    background: linear-gradient(135deg, #e8d4a8 0%, #c9b896 50%, #a89870 100%);
  }
  .basemap-preview[data-type="swisstopo-grey"] {
    background: linear-gradient(135deg, #999 0%, #777 50%, #666 100%);
  }
  .basemap-preview[data-type="ortho"] {
    background: linear-gradient(135deg, #3a5f3a 0%, #2d4a2d 50%, #1f3a1f 100%);
  }

  .basemap-name {
    font-size: 0.7rem;
    color: var(--text-secondary, #aaa);
    text-align: center;
  }

  .basemap-card.selected .basemap-name {
    color: var(--cyber-green, #00ff88);
    font-weight: 600;
  }

  .map-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .map-container {
    flex: 1;
    position: relative;
  }

  .status-bar {
    display: flex;
    gap: 16px;
    padding: 8px 16px;
    background: rgba(30, 30, 46, 0.95);
    border-top: 1px solid var(--border-color, #3a3a4a);
    font-size: 0.8rem;
    color: var(--text-muted, #888);
    font-family: var(--font-mono, monospace);
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-item.projection {
    margin-left: auto;
    color: var(--cyber-green, #00ff88);
    font-weight: 500;
  }

  /* OpenLayers Popup */
  .ol-popup {
    position: absolute;
    background: var(--noir-card, #1e1e2e);
    border: 1px solid var(--border-color, #3a3a4a);
    border-radius: 8px;
    padding: 12px;
    min-width: 200px;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    display: none;
  }

  :global(.ol-overlay-container) .ol-popup {
    display: block;
  }

  .ol-popup-closer {
    position: absolute;
    top: 4px;
    right: 8px;
    background: transparent;
    border: none;
    color: var(--text-muted, #888);
    font-size: 20px;
    cursor: pointer;
    line-height: 1;
  }

  .ol-popup-closer:hover {
    color: var(--cyber-green, #00ff88);
  }

  :global(.popup-title) {
    font-weight: 600;
    color: var(--cyber-green, #00ff88);
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color, #3a3a4a);
    font-size: 0.9rem;
  }

  :global(.popup-props) {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :global(.popup-row) {
    display: flex;
    gap: 8px;
    font-size: 0.8rem;
  }

  :global(.popup-key) {
    color: var(--text-muted, #888);
    min-width: 80px;
  }

  :global(.popup-value) {
    color: var(--text-primary, #e0e0e0);
    word-break: break-all;
  }

  /* OpenLayers controls dark theme */
  :global(.ol-control button) {
    background-color: var(--noir-card, #1e1e2e) !important;
    color: var(--text-primary, #e0e0e0) !important;
    border: 1px solid var(--border-color, #3a3a4a) !important;
  }

  :global(.ol-control button:hover) {
    background-color: var(--bg-hover, #2a2a3a) !important;
  }

  :global(.ol-scale-line) {
    background: rgba(30, 30, 46, 0.8) !important;
  }

  :global(.ol-scale-line-inner) {
    border-color: var(--text-muted, #888) !important;
    color: var(--text-muted, #888) !important;
  }

  :global(.ol-attribution) {
    background: rgba(30, 30, 46, 0.8) !important;
  }

  :global(.ol-attribution a) {
    color: var(--cyber-green, #00ff88) !important;
  }
</style>
