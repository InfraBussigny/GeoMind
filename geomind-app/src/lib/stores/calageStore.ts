import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================
// TYPES
// ============================================

export interface CalibrationPoint {
  id: string;
  imageX: number;      // Coordonnées pixel sur le plan à caler
  imageY: number;
  worldX: number;      // Coordonnées MN95 (EPSG:2056)
  worldY: number;
  label?: string;      // Label optionnel (ex: "PF1", "PL12")
}

export interface TransformResult {
  type: 'helmert' | 'affine';
  // Helmert parameters
  tx?: number;
  ty?: number;
  scale?: number;
  rotation?: number;
  // Affine parameters (6 params)
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  e?: number;
  f?: number;
  // Quality metrics
  rms: number;
  residuals: { pointId: string; dx: number; dy: number; dist: number }[];
}

export interface ImportedFile {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'dxf';
  data: string | ArrayBuffer;      // Base64 ou ArrayBuffer
  width?: number;
  height?: number;
  pages?: number;                  // Pour PDF multi-pages
  currentPage?: number;
}

export interface SnapConfig {
  enabled: boolean;
  tolerance: number;               // Tolérance en pixels
  types: ('intersection' | 'center' | 'node' | 'lineEnd')[];
}

export type SidebarTab = 'points' | 'layers' | 'settings' | null;

export interface CalageState {
  // Fichier importé
  importedFile: ImportedFile | null;

  // Points de calage
  calibrationPoints: CalibrationPoint[];

  // Mode d'édition
  editMode: 'none' | 'addPoint' | 'selectPoint';
  selectedPointId: string | null;

  // Point temporaire en cours de création
  tempPoint: Partial<CalibrationPoint> | null;
  pendingStep: 'image' | 'world' | null;

  // Transformation calculée
  transform: TransformResult | null;
  transformType: 'helmert' | 'affine';

  // Configuration snapping
  snapConfig: SnapConfig;

  // UI state
  referenceZoom: number;
  referenceCenter: { x: number; y: number };
  sourceZoom: number;
  sourceCenter: { x: number; y: number };
  sourceRotation: number;           // Rotation visuelle pré-calage
  sourceOpacity: number;

  // Sidebar unifié
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  activeLayers: string[];

  // Deprecated - keep for compatibility
  showLayersSidebar: boolean;

  // Historique pour undo/redo
  history: CalibrationPoint[][];
  historyIndex: number;
}

// ============================================
// DEFAULT STATE
// ============================================

const DEFAULT_SNAP_CONFIG: SnapConfig = {
  enabled: true,
  tolerance: 10,
  types: ['intersection', 'center', 'node', 'lineEnd']
};

const DEFAULT_STATE: CalageState = {
  importedFile: null,
  calibrationPoints: [],
  editMode: 'none',
  selectedPointId: null,
  tempPoint: null,
  pendingStep: null,
  transform: null,
  transformType: 'helmert',
  snapConfig: DEFAULT_SNAP_CONFIG,
  referenceZoom: 1,
  referenceCenter: { x: 2533500, y: 1152000 },  // Centre Vaud MN95
  sourceZoom: 1,
  sourceCenter: { x: 0, y: 0 },
  sourceRotation: 0,
  sourceOpacity: 1,
  sidebarOpen: false,
  sidebarTab: null,
  showLayersSidebar: false,  // Deprecated
  activeLayers: [
    'bdco_parcelle',
    'bdco_batiment',
    'bdco_point_fixe_1',
    'bdco_point_fixe_2',
    'bdco_point_fixe_3',
    'bdco_point_limite'
  ],
  history: [],
  historyIndex: -1
};

// ============================================
// STORE CREATION
// ============================================

function createCalageStore() {
  const { subscribe, set, update } = writable<CalageState>(DEFAULT_STATE);

  return {
    subscribe,

    // Reset to initial state
    reset: () => set(DEFAULT_STATE),

    // ========== FILE MANAGEMENT ==========

    setImportedFile: (file: ImportedFile) => {
      update(state => ({
        ...state,
        importedFile: file,
        calibrationPoints: [],
        transform: null,
        history: [],
        historyIndex: -1
      }));
    },

    clearImportedFile: () => {
      update(state => ({
        ...state,
        importedFile: null,
        calibrationPoints: [],
        transform: null
      }));
    },

    setCurrentPage: (page: number) => {
      update(state => {
        if (!state.importedFile || state.importedFile.type !== 'pdf') return state;
        return {
          ...state,
          importedFile: { ...state.importedFile, currentPage: page }
        };
      });
    },

    updateImportedFileDimensions: (width: number, height: number) => {
      update(state => {
        if (!state.importedFile) return state;
        return {
          ...state,
          importedFile: { ...state.importedFile, width, height }
        };
      });
    },

    // ========== CALIBRATION POINTS ==========

    addCalibrationPoint: (point: Omit<CalibrationPoint, 'id'>) => {
      update(state => {
        const newPoint: CalibrationPoint = {
          ...point,
          id: crypto.randomUUID()
        };
        const newPoints = [...state.calibrationPoints, newPoint];
        return {
          ...state,
          calibrationPoints: newPoints,
          history: [...state.history.slice(0, state.historyIndex + 1), newPoints],
          historyIndex: state.historyIndex + 1,
          tempPoint: null,
          pendingStep: null,
          editMode: 'none'
        };
      });
    },

    updateCalibrationPoint: (id: string, updates: Partial<CalibrationPoint>) => {
      update(state => {
        const newPoints = state.calibrationPoints.map(p =>
          p.id === id ? { ...p, ...updates } : p
        );
        return {
          ...state,
          calibrationPoints: newPoints,
          history: [...state.history.slice(0, state.historyIndex + 1), newPoints],
          historyIndex: state.historyIndex + 1
        };
      });
    },

    removeCalibrationPoint: (id: string) => {
      update(state => {
        const newPoints = state.calibrationPoints.filter(p => p.id !== id);
        return {
          ...state,
          calibrationPoints: newPoints,
          selectedPointId: state.selectedPointId === id ? null : state.selectedPointId,
          history: [...state.history.slice(0, state.historyIndex + 1), newPoints],
          historyIndex: state.historyIndex + 1
        };
      });
    },

    clearCalibrationPoints: () => {
      update(state => ({
        ...state,
        calibrationPoints: [],
        transform: null,
        history: [...state.history.slice(0, state.historyIndex + 1), []],
        historyIndex: state.historyIndex + 1
      }));
    },

    // ========== EDIT MODE ==========

    setEditMode: (mode: CalageState['editMode']) => {
      update(state => ({
        ...state,
        editMode: mode,
        tempPoint: mode === 'addPoint' ? {} : null,
        pendingStep: mode === 'addPoint' ? 'image' : null
      }));
    },

    setSelectedPoint: (id: string | null) => {
      update(state => ({
        ...state,
        selectedPointId: id,
        editMode: id ? 'selectPoint' : 'none'
      }));
    },

    // ========== TEMP POINT (during creation) ==========

    setTempImagePoint: (x: number, y: number) => {
      update(state => ({
        ...state,
        tempPoint: { ...state.tempPoint, imageX: x, imageY: y },
        pendingStep: 'world'
      }));
    },

    setTempWorldPoint: (x: number, y: number) => {
      update(state => ({
        ...state,
        tempPoint: { ...state.tempPoint, worldX: x, worldY: y }
      }));
    },

    cancelTempPoint: () => {
      update(state => ({
        ...state,
        tempPoint: null,
        pendingStep: null,
        editMode: 'none'
      }));
    },

    // ========== TRANSFORMATION ==========

    setTransformType: (type: 'helmert' | 'affine') => {
      update(state => ({ ...state, transformType: type }));
    },

    setTransform: (transform: TransformResult | null) => {
      update(state => ({ ...state, transform }));
    },

    // ========== SNAP CONFIG ==========

    setSnapEnabled: (enabled: boolean) => {
      update(state => ({
        ...state,
        snapConfig: { ...state.snapConfig, enabled }
      }));
    },

    setSnapTolerance: (tolerance: number) => {
      update(state => ({
        ...state,
        snapConfig: { ...state.snapConfig, tolerance }
      }));
    },

    toggleSnapType: (type: SnapConfig['types'][number]) => {
      update(state => {
        const types = state.snapConfig.types.includes(type)
          ? state.snapConfig.types.filter(t => t !== type)
          : [...state.snapConfig.types, type];
        return {
          ...state,
          snapConfig: { ...state.snapConfig, types }
        };
      });
    },

    // ========== VIEW STATE ==========

    setReferenceView: (zoom: number, center: { x: number; y: number }) => {
      update(state => ({
        ...state,
        referenceZoom: zoom,
        referenceCenter: center
      }));
    },

    setSourceView: (zoom: number, center: { x: number; y: number }) => {
      update(state => ({
        ...state,
        sourceZoom: zoom,
        sourceCenter: center
      }));
    },

    setSourceRotation: (rotation: number) => {
      update(state => ({ ...state, sourceRotation: rotation }));
    },

    setSourceOpacity: (opacity: number) => {
      update(state => ({ ...state, sourceOpacity: opacity }));
    },

    // ========== LAYERS ==========

    // ========== UNIFIED SIDEBAR ==========

    openSidebar: (tab: SidebarTab) => {
      update(state => ({
        ...state,
        sidebarOpen: true,
        sidebarTab: tab,
        showLayersSidebar: tab === 'layers' || tab === 'points'  // Backward compat
      }));
    },

    closeSidebar: () => {
      update(state => ({
        ...state,
        sidebarOpen: false,
        sidebarTab: null,
        showLayersSidebar: false
      }));
    },

    setSidebarTab: (tab: SidebarTab) => {
      update(state => ({
        ...state,
        sidebarTab: tab,
        sidebarOpen: tab !== null,
        showLayersSidebar: tab === 'layers' || tab === 'points'
      }));
    },

    toggleSidebar: (tab?: SidebarTab) => {
      update(state => {
        if (state.sidebarOpen && state.sidebarTab === tab) {
          // Close if clicking same tab
          return { ...state, sidebarOpen: false, sidebarTab: null, showLayersSidebar: false };
        } else {
          // Open with new tab
          const newTab = tab || 'layers';
          return { ...state, sidebarOpen: true, sidebarTab: newTab, showLayersSidebar: true };
        }
      });
    },

    // Deprecated - kept for backward compatibility
    toggleLayersSidebar: () => {
      update(state => {
        const newOpen = !state.sidebarOpen || state.sidebarTab !== 'layers';
        return {
          ...state,
          sidebarOpen: newOpen,
          sidebarTab: newOpen ? 'layers' : null,
          showLayersSidebar: newOpen
        };
      });
    },

    toggleLayer: (layerId: string) => {
      update(state => {
        const activeLayers = state.activeLayers.includes(layerId)
          ? state.activeLayers.filter(l => l !== layerId)
          : [...state.activeLayers, layerId];
        return { ...state, activeLayers };
      });
    },

    setActiveLayers: (layers: string[]) => {
      update(state => ({ ...state, activeLayers: layers }));
    },

    // ========== HISTORY (Undo/Redo) ==========

    undo: () => {
      update(state => {
        if (state.historyIndex <= 0) return state;
        const newIndex = state.historyIndex - 1;
        return {
          ...state,
          calibrationPoints: state.history[newIndex] || [],
          historyIndex: newIndex
        };
      });
    },

    redo: () => {
      update(state => {
        if (state.historyIndex >= state.history.length - 1) return state;
        const newIndex = state.historyIndex + 1;
        return {
          ...state,
          calibrationPoints: state.history[newIndex] || [],
          historyIndex: newIndex
        };
      });
    }
  };
}

// ============================================
// EXPORTED STORE
// ============================================

export const calageStore = createCalageStore();

// ============================================
// DERIVED STORES
// ============================================

export const canComputeHelmert = derived(calageStore, $state =>
  $state.calibrationPoints.length >= 2
);

export const canComputeAffine = derived(calageStore, $state =>
  $state.calibrationPoints.length >= 3
);

export const canUndo = derived(calageStore, $state =>
  $state.historyIndex > 0
);

export const canRedo = derived(calageStore, $state =>
  $state.historyIndex < $state.history.length - 1
);

export const pointCount = derived(calageStore, $state =>
  $state.calibrationPoints.length
);
