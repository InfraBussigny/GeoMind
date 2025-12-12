/**
 * GeoMind Map Assistant Service
 * Service pour l'assistant IA cartographique
 * Gère les actions sur les cartes (zoom, couches, requêtes spatiales)
 */

import { writable, get } from 'svelte/store';
import { geocodeSwiss, lv95ToWgs84, wgs84ToLv95 } from './mapSources';

// ============================================
// Types
// ============================================

export interface MapContext {
  activeTab: string;
  connectionId: string | null;
  activeLayers: string[];
  availableTables: GeoTable[];
  currentZoom: number;
  currentCenter: [number, number]; // MN95
  selectedFeature: any | null;
}

export interface GeoTable {
  schema: string;
  table: string;
  fullName: string;
  geometryColumn: string;
  geometryType: string;
  srid: number;
}

export interface MapAction {
  type: 'zoom' | 'pan' | 'layer_toggle' | 'layer_add' | 'layer_remove' | 'search' | 'sql_query' | 'info' | 'measure' | 'export';
  params: Record<string, any>;
  description: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: MapAction[];
  sqlQuery?: string;
  results?: any;
}

export interface ParsedIntent {
  intent: 'zoom_address' | 'zoom_coordinates' | 'zoom_parcelle' | 'zoom_extent' |
          'toggle_layer' | 'add_layer' | 'remove_layer' | 'list_layers' |
          'search_address' | 'search_parcelle' | 'search_feature' |
          'sql_query' | 'spatial_query' |
          'get_info' | 'measure_distance' | 'measure_area' |
          'help' | 'unknown';
  entities: Record<string, any>;
  confidence: number;
}

// ============================================
// Stores
// ============================================

export const mapContextStore = writable<MapContext>({
  activeTab: 'geoportail',
  connectionId: null,
  activeLayers: [],
  availableTables: [],
  currentZoom: 10,
  currentCenter: [2538000, 1152000], // Centre de la Suisse
  selectedFeature: null
});

export const assistantMessagesStore = writable<AssistantMessage[]>([]);

export const assistantLoadingStore = writable<boolean>(false);

// ============================================
// Action Definitions pour l'IA
// ============================================

export const MAP_ACTIONS_SCHEMA = {
  zoom_to_address: {
    description: "Zoomer sur une adresse ou lieu en Suisse",
    parameters: {
      address: { type: "string", description: "Adresse ou nom de lieu" },
      zoom: { type: "number", description: "Niveau de zoom (0-28)", optional: true }
    }
  },
  zoom_to_coordinates: {
    description: "Zoomer sur des coordonnées MN95 (EPSG:2056)",
    parameters: {
      x: { type: "number", description: "Coordonnée Est (E)" },
      y: { type: "number", description: "Coordonnée Nord (N)" },
      zoom: { type: "number", description: "Niveau de zoom", optional: true }
    }
  },
  zoom_to_extent: {
    description: "Zoomer sur l'étendue d'une couche/table",
    parameters: {
      layer: { type: "string", description: "Nom de la couche (schema.table)" }
    }
  },
  toggle_layer: {
    description: "Activer ou désactiver une couche",
    parameters: {
      layer: { type: "string", description: "Nom de la couche (schema.table)" },
      visible: { type: "boolean", description: "true pour activer, false pour désactiver", optional: true }
    }
  },
  search_parcelle: {
    description: "Rechercher une parcelle par numéro",
    parameters: {
      numero: { type: "string", description: "Numéro de parcelle" },
      commune: { type: "string", description: "Nom de la commune", optional: true }
    }
  },
  execute_sql: {
    description: "Exécuter une requête SQL spatiale sur PostGIS",
    parameters: {
      query: { type: "string", description: "Requête SQL (SELECT uniquement)" }
    }
  },
  get_layer_info: {
    description: "Obtenir des informations sur une couche",
    parameters: {
      layer: { type: "string", description: "Nom de la couche" }
    }
  },
  list_layers: {
    description: "Lister les couches disponibles",
    parameters: {
      schema: { type: "string", description: "Filtrer par schéma", optional: true }
    }
  }
};

// ============================================
// System Prompt pour l'assistant carto
// ============================================

export function getMapAssistantSystemPrompt(context: MapContext): string {
  const layersList = context.availableTables
    .slice(0, 50) // Limiter pour le contexte
    .map(t => `- ${t.fullName} (${t.geometryType})`)
    .join('\n');

  const activeLayersList = context.activeLayers.length > 0
    ? context.activeLayers.join(', ')
    : 'Aucune couche active';

  return `Tu es l'assistant cartographique de GeoMind, spécialisé dans les SIG et géodonnées suisses.

## Contexte actuel
- **Onglet actif**: ${context.activeTab}
- **Couches actives**: ${activeLayersList}
- **Zoom actuel**: ${context.currentZoom}
- **Centre (MN95)**: E=${context.currentCenter[0].toFixed(0)}, N=${context.currentCenter[1].toFixed(0)}
- **Connexion PostGIS**: ${context.connectionId || 'Non connecté'}

## Couches disponibles (PostGIS)
${layersList || 'Aucune couche disponible'}

## Tes capacités

### 1. Navigation et zoom
- Zoomer sur une adresse suisse (utilise le géocodage Swisstopo)
- Zoomer sur des coordonnées MN95 (EPSG:2056)
- Zoomer sur l'étendue d'une couche

### 2. Gestion des couches
- Activer/désactiver des couches
- Lister les couches par schéma
- Donner des informations sur une couche

### 3. Requêtes spatiales (PostGIS)
- Générer et exécuter des requêtes SQL spatiales
- Rechercher des parcelles, bâtiments, etc.
- Analyses spatiales (buffer, intersection, distance)

### 4. Aide contextuelle
- Expliquer les fonctionnalités des différents géoportails
- Donner des conseils d'utilisation
- Générer des URLs pour les cartes externes

## Format de réponse
Quand tu proposes une action, utilise ce format JSON dans ta réponse:
\`\`\`action
{
  "type": "zoom_to_address|toggle_layer|execute_sql|...",
  "params": { ... }
}
\`\`\`

## Règles importantes
- Pour les coordonnées suisses, utilise toujours EPSG:2056 (MN95)
- Les requêtes SQL doivent être en lecture seule (SELECT)
- Sois concis et précis dans tes réponses
- Propose des actions concrètes quand c'est pertinent
- Pour les cartes externes (Geoportail VD, Swisstopo), donne des instructions ou URLs`;
}

// ============================================
// Action Handlers
// ============================================

export interface MapController {
  zoomTo: (x: number, y: number, zoom?: number) => void;
  zoomToExtent: (minX: number, minY: number, maxX: number, maxY: number) => void;
  toggleLayer: (layerName: string, visible?: boolean) => void;
  addLayer: (layerName: string) => void;
  removeLayer: (layerName: string) => void;
  getActiveLayers: () => string[];
  executeSQL: (query: string) => Promise<any>;
  highlightFeature: (geojson: any) => void;
}

let mapController: MapController | null = null;

export function setMapController(controller: MapController) {
  mapController = controller;
}

export function getMapController(): MapController | null {
  return mapController;
}

// ============================================
// Action Execution
// ============================================

export async function executeMapAction(action: MapAction): Promise<{ success: boolean; message: string; data?: any }> {
  if (!mapController) {
    return { success: false, message: "Contrôleur de carte non initialisé" };
  }

  try {
    // Normaliser le type d'action (l'IA peut utiliser différents formats)
    const actionType = action.type.toLowerCase().replace(/-/g, '_');

    switch (actionType) {
      // Actions de zoom
      case 'zoom':
      case 'zoom_to_coordinates': {
        const { x, y, zoom } = action.params;
        mapController.zoomTo(x, y, zoom);
        return { success: true, message: `Zoom sur E=${x}, N=${y}` };
      }

      case 'zoom_to_address':
      case 'search': {
        const query = action.params.address || action.params.query;
        const results = await geocodeSwiss(query);
        if (results.length > 0) {
          const first = results[0];
          mapController.zoomTo(first.x, first.y, action.params.zoom || 17);
          return {
            success: true,
            message: `Trouvé: ${first.label}`,
            data: results
          };
        }
        return { success: false, message: "Aucun résultat trouvé" };
      }

      case 'zoom_to_extent': {
        const { layer, minx, miny, maxx, maxy } = action.params;
        if (minx !== undefined) {
          mapController.zoomToExtent(minx, miny, maxx, maxy);
          return { success: true, message: `Zoom sur l'étendue` };
        }
        // Si layer est fourni, il faudrait récupérer l'extent de la couche
        return { success: false, message: "Paramètres d'extent manquants" };
      }

      // Actions sur les couches
      case 'layer_toggle':
      case 'toggle_layer': {
        const { layer, visible } = action.params;
        mapController.toggleLayer(layer, visible);
        const status = visible !== undefined ? (visible ? 'activée' : 'désactivée') : 'basculée';
        return { success: true, message: `Couche ${layer} ${status}` };
      }

      case 'layer_add':
      case 'add_layer': {
        const { layer } = action.params;
        mapController.addLayer(layer);
        return { success: true, message: `Couche ${layer} ajoutée` };
      }

      case 'layer_remove':
      case 'remove_layer': {
        const { layer } = action.params;
        mapController.removeLayer(layer);
        return { success: true, message: `Couche ${layer} retirée` };
      }

      case 'list_layers': {
        const layers = mapController.getActiveLayers();
        return {
          success: true,
          message: layers.length > 0 ? `${layers.length} couches actives` : 'Aucune couche active',
          data: layers
        };
      }

      // Actions SQL
      case 'sql_query':
      case 'execute_sql': {
        const { query } = action.params;
        // Vérification de sécurité basique
        const upperQuery = query.toUpperCase().trim();
        if (!upperQuery.startsWith('SELECT')) {
          return { success: false, message: "Seules les requêtes SELECT sont autorisées" };
        }
        const result = await mapController.executeSQL(query);
        return {
          success: true,
          message: `Requête exécutée (${Array.isArray(result) ? result.length : 0} résultats)`,
          data: result
        };
      }

      // Info sur une couche
      case 'get_layer_info': {
        const { layer } = action.params;
        return { success: true, message: `Informations sur ${layer}`, data: { layer } };
      }

      default:
        return { success: false, message: `Action non reconnue: ${action.type}` };
    }
  } catch (error) {
    return { success: false, message: `Erreur: ${error}` };
  }
}

// ============================================
// Geocoding & Search
// ============================================

export async function searchAddress(query: string): Promise<{ success: boolean; results?: any[]; error?: string }> {
  try {
    const results = await geocodeSwiss(query, 10);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function searchParcelle(numero: string, commune?: string): Promise<{ success: boolean; results?: any[]; error?: string }> {
  // Construire la requête SQL pour chercher la parcelle
  const query = commune
    ? `SELECT * FROM cadastre.parcelles WHERE numero = '${numero}' AND commune ILIKE '%${commune}%' LIMIT 10`
    : `SELECT * FROM cadastre.parcelles WHERE numero = '${numero}' LIMIT 10`;

  try {
    if (mapController) {
      const result = await mapController.executeSQL(query);
      return { success: true, results: result };
    }
    return { success: false, error: "Connexion PostGIS non disponible" };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================
// URL Generators pour cartes externes
// ============================================

export function generateGeoportailVDUrl(x: number, y: number, zoom: number = 10): string {
  // Conversion MN95 vers paramètres URL Geoportail VD
  return `https://www.geo.vd.ch/theme/cadastre?map_x=${x}&map_y=${y}&map_zoom=${zoom}`;
}

export function generateSwisstopoUrl(x: number, y: number, zoom: number = 10): string {
  // Swisstopo utilise des coordonnées légèrement différentes
  return `https://map.geo.admin.ch/#/map?lang=fr&center=${x},${y}&z=${zoom}&topic=ech&bgLayer=ch.swisstopo.pixelkarte-farbe`;
}

export function generateGoogleMapsUrl(x: number, y: number): string {
  const [lon, lat] = lv95ToWgs84(x, y);
  return `https://www.google.com/maps/@${lat},${lon},17z`;
}

// ============================================
// Message Helpers
// ============================================

export function addAssistantMessage(role: 'user' | 'assistant' | 'system', content: string, actions?: MapAction[]) {
  const message: AssistantMessage = {
    id: `msg_${Date.now()}`,
    role,
    content,
    timestamp: new Date(),
    actions
  };

  assistantMessagesStore.update(msgs => [...msgs, message]);
  return message;
}

export function clearAssistantMessages() {
  assistantMessagesStore.set([]);
}

// ============================================
// Parse Action from AI Response
// ============================================

export function parseActionsFromResponse(response: string): MapAction[] {
  const actions: MapAction[] = [];

  // Chercher les blocs ```action ... ```
  const actionRegex = /```action\s*([\s\S]*?)```/g;
  let match;

  while ((match = actionRegex.exec(response)) !== null) {
    try {
      const actionJson = JSON.parse(match[1].trim());
      if (actionJson.type && actionJson.params) {
        actions.push({
          type: actionJson.type,
          params: actionJson.params,
          description: actionJson.description || ''
        });
      }
    } catch (e) {
      console.warn('Failed to parse action:', match[1]);
    }
  }

  return actions;
}

// ============================================
// Quick Actions (boutons rapides)
// ============================================

export const QUICK_ACTIONS = [
  {
    id: 'search',
    label: 'Rechercher',
    icon: 'search',
    prompt: 'Rechercher une adresse ou un lieu...'
  },
  {
    id: 'layers',
    label: 'Couches',
    icon: 'layers',
    prompt: 'Liste les couches disponibles'
  },
  {
    id: 'parcelle',
    label: 'Parcelle',
    icon: 'map-pin',
    prompt: 'Rechercher une parcelle...'
  },
  {
    id: 'sql',
    label: 'SQL',
    icon: 'database',
    prompt: 'Exécuter une requête SQL spatiale...'
  },
  {
    id: 'help',
    label: 'Aide',
    icon: 'help',
    prompt: 'Comment puis-je utiliser cet outil ?'
  }
];

// ============================================
// Spatial Query Templates
// ============================================

export const SQL_TEMPLATES = {
  parcelles_in_buffer: (x: number, y: number, distance: number) => `
SELECT p.*, ST_Distance(p.geom, ST_SetSRID(ST_MakePoint(${x}, ${y}), 2056)) as distance
FROM cadastre.parcelles p
WHERE ST_DWithin(p.geom, ST_SetSRID(ST_MakePoint(${x}, ${y}), 2056), ${distance})
ORDER BY distance
LIMIT 100`,

  features_in_bbox: (schema: string, table: string, minX: number, minY: number, maxX: number, maxY: number) => `
SELECT *
FROM ${schema}.${table}
WHERE ST_Intersects(geom, ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 2056))
LIMIT 1000`,

  count_by_type: (schema: string, table: string, typeColumn: string) => `
SELECT ${typeColumn}, COUNT(*) as count
FROM ${schema}.${table}
GROUP BY ${typeColumn}
ORDER BY count DESC`,

  nearest_feature: (schema: string, table: string, x: number, y: number, limit: number = 10) => `
SELECT *, ST_Distance(geom, ST_SetSRID(ST_MakePoint(${x}, ${y}), 2056)) as distance
FROM ${schema}.${table}
ORDER BY geom <-> ST_SetSRID(ST_MakePoint(${x}, ${y}), 2056)
LIMIT ${limit}`
};
