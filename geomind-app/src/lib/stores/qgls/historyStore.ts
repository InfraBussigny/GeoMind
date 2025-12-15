// QGlS History Store - Undo/Redo functionality
import { writable, derived, get } from 'svelte/store';
import type { Feature } from 'ol';
import type { Geometry } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';

// Types
export type HistoryActionType = 'add' | 'delete' | 'modify' | 'style' | 'batch';

export interface HistoryAction {
  id: string;
  type: HistoryActionType;
  timestamp: number;
  description: string;
  // Serialized GeoJSON for the features
  before: string | null;  // State before action (null for 'add')
  after: string | null;   // State after action (null for 'delete')
  featureIds: string[];   // IDs of affected features
}

interface HistoryState {
  undoStack: HistoryAction[];
  redoStack: HistoryAction[];
  maxSize: number;
}

// GeoJSON format for serialization
const geoJsonFormat = new GeoJSON();

// Generate unique ID
function generateId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Serialize features to GeoJSON string
export function serializeFeatures(features: Feature<Geometry>[]): string {
  if (!features || features.length === 0) return '[]';

  const geojson = {
    type: 'FeatureCollection',
    features: features.map(f => {
      const geom = f.getGeometry();
      const props = f.getProperties();
      // Remove geometry from properties to avoid duplication
      const { geometry, ...cleanProps } = props;

      return {
        type: 'Feature',
        id: f.getId() || f.get('_historyId'),
        geometry: geom ? geoJsonFormat.writeGeometryObject(geom) : null,
        properties: cleanProps
      };
    })
  };

  return JSON.stringify(geojson);
}

// Deserialize GeoJSON string to features
export function deserializeFeatures(json: string): Feature<Geometry>[] {
  if (!json || json === '[]') return [];

  try {
    const geojson = JSON.parse(json);
    return geoJsonFormat.readFeatures(geojson) as Feature<Geometry>[];
  } catch (e) {
    console.error('Failed to deserialize features:', e);
    return [];
  }
}

// Create the history store
function createHistoryStore() {
  const initialState: HistoryState = {
    undoStack: [],
    redoStack: [],
    maxSize: 50
  };

  const { subscribe, set, update } = writable<HistoryState>(initialState);

  return {
    subscribe,

    // Record a new action
    record(action: Omit<HistoryAction, 'id' | 'timestamp'>) {
      update(state => {
        const newAction: HistoryAction = {
          ...action,
          id: generateId(),
          timestamp: Date.now()
        };

        // Add to undo stack
        const undoStack = [...state.undoStack, newAction];

        // Trim if exceeds max size
        if (undoStack.length > state.maxSize) {
          undoStack.shift();
        }

        return {
          ...state,
          undoStack,
          redoStack: [] // Clear redo stack on new action
        };
      });
    },

    // Record feature addition
    recordAdd(features: Feature<Geometry>[], description = 'Sketching ajouté') {
      const featureIds = features.map(f => {
        // Ensure feature has an ID for history tracking
        if (!f.getId()) {
          const historyId = `feat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          f.set('_historyId', historyId);
          f.setId(historyId);
        }
        return f.getId() as string;
      });

      this.record({
        type: 'add',
        description,
        before: null,
        after: serializeFeatures(features),
        featureIds
      });
    },

    // Record feature deletion
    recordDelete(features: Feature<Geometry>[], description = 'Sketching supprimé') {
      const featureIds = features.map(f => (f.getId() || f.get('_historyId')) as string);

      this.record({
        type: 'delete',
        description,
        before: serializeFeatures(features),
        after: null,
        featureIds
      });
    },

    // Record feature modification
    recordModify(
      beforeFeatures: Feature<Geometry>[],
      afterFeatures: Feature<Geometry>[],
      description = 'Sketching modifié'
    ) {
      const featureIds = beforeFeatures.map(f => (f.getId() || f.get('_historyId')) as string);

      this.record({
        type: 'modify',
        description,
        before: serializeFeatures(beforeFeatures),
        after: serializeFeatures(afterFeatures),
        featureIds
      });
    },

    // Get the action to undo (without removing it yet)
    peekUndo(): HistoryAction | null {
      const state = get({ subscribe });
      return state.undoStack.length > 0
        ? state.undoStack[state.undoStack.length - 1]
        : null;
    },

    // Get the action to redo (without removing it yet)
    peekRedo(): HistoryAction | null {
      const state = get({ subscribe });
      return state.redoStack.length > 0
        ? state.redoStack[state.redoStack.length - 1]
        : null;
    },

    // Pop from undo stack and push to redo
    popUndo(): HistoryAction | null {
      let action: HistoryAction | null = null;

      update(state => {
        if (state.undoStack.length === 0) return state;

        const undoStack = [...state.undoStack];
        action = undoStack.pop()!;

        return {
          ...state,
          undoStack,
          redoStack: [...state.redoStack, action]
        };
      });

      return action;
    },

    // Pop from redo stack and push to undo
    popRedo(): HistoryAction | null {
      let action: HistoryAction | null = null;

      update(state => {
        if (state.redoStack.length === 0) return state;

        const redoStack = [...state.redoStack];
        action = redoStack.pop()!;

        return {
          ...state,
          redoStack,
          undoStack: [...state.undoStack, action]
        };
      });

      return action;
    },

    // Clear all history
    clear() {
      set(initialState);
    },

    // Set max history size
    setMaxSize(size: number) {
      update(state => ({
        ...state,
        maxSize: Math.max(10, size)
      }));
    }
  };
}

// Create store instance
export const historyStore = createHistoryStore();

// Derived stores for UI
export const canUndo = derived(historyStore, $h => $h.undoStack.length > 0);
export const canRedo = derived(historyStore, $h => $h.redoStack.length > 0);
export const undoDescription = derived(historyStore, $h => {
  const last = $h.undoStack[$h.undoStack.length - 1];
  return last?.description || null;
});
export const redoDescription = derived(historyStore, $h => {
  const last = $h.redoStack[$h.redoStack.length - 1];
  return last?.description || null;
});
