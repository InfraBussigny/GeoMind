import { writable, derived } from 'svelte/store';

// Drawing tool types
export type DrawingTool =
  | 'select'
  | 'pan'
  | 'point'
  | 'line'
  | 'polygon'
  | 'rectangle'
  | 'circle'
  | 'modify'
  | 'split'
  | 'merge'
  | 'delete'
  | 'measure-distance'
  | 'measure-area';

// Tool settings
export interface ToolSettings {
  snapEnabled: boolean;
  snapTolerance: number;
  snapToVertex: boolean;
  snapToEdge: boolean;
  snapToGrid: boolean;
  gridSize: number;
  orthoMode: boolean;
}

// Default settings
const defaultToolSettings: ToolSettings = {
  snapEnabled: true,
  snapTolerance: 15,
  snapToVertex: true,
  snapToEdge: true,
  snapToGrid: false,
  gridSize: 10,
  orthoMode: false
};

// Stores
export const currentTool = writable<DrawingTool>('select');
export const toolSettings = writable<ToolSettings>(defaultToolSettings);

// Derived stores
export const isDrawingTool = derived(currentTool, $tool =>
  ['point', 'line', 'polygon', 'rectangle', 'circle'].includes($tool)
);

export const isEditingTool = derived(currentTool, $tool =>
  ['modify', 'split', 'merge', 'delete'].includes($tool)
);

export const isMeasuringTool = derived(currentTool, $tool =>
  ['measure-distance', 'measure-area'].includes($tool)
);

// Tool definitions for UI
export interface ToolDefinition {
  id: DrawingTool;
  label: string;
  shortcut: string;
  icon: string;
  group: 'navigation' | 'drawing' | 'editing' | 'measure';
}

export const toolDefinitions: ToolDefinition[] = [
  // Navigation
  { id: 'select', label: 'Sélection', shortcut: 'V', icon: 'cursor', group: 'navigation' },
  { id: 'pan', label: 'Déplacer', shortcut: 'H', icon: 'hand', group: 'navigation' },

  // Drawing
  { id: 'point', label: 'Point', shortcut: 'P', icon: 'dot', group: 'drawing' },
  { id: 'line', label: 'Ligne', shortcut: 'L', icon: 'line', group: 'drawing' },
  { id: 'polygon', label: 'Polygone', shortcut: 'O', icon: 'polygon', group: 'drawing' },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: 'rectangle', group: 'drawing' },
  { id: 'circle', label: 'Cercle', shortcut: 'C', icon: 'circle', group: 'drawing' },

  // Editing
  { id: 'modify', label: 'Modifier', shortcut: 'M', icon: 'edit', group: 'editing' },
  { id: 'split', label: 'Couper', shortcut: 'X', icon: 'scissors', group: 'editing' },
  { id: 'merge', label: 'Fusionner', shortcut: 'U', icon: 'merge', group: 'editing' },
  { id: 'delete', label: 'Supprimer', shortcut: 'Del', icon: 'trash', group: 'editing' },

  // Measure
  { id: 'measure-distance', label: 'Distance', shortcut: 'D', icon: 'ruler', group: 'measure' },
  { id: 'measure-area', label: 'Surface', shortcut: 'A', icon: 'area', group: 'measure' },
];

// Actions
export function setTool(tool: DrawingTool): void {
  currentTool.set(tool);
}

export function toggleSnap(): void {
  toolSettings.update(s => ({ ...s, snapEnabled: !s.snapEnabled }));
}

export function setSnapTolerance(tolerance: number): void {
  toolSettings.update(s => ({ ...s, snapTolerance: Math.max(1, Math.min(50, tolerance)) }));
}

export function toggleOrthoMode(): void {
  toolSettings.update(s => ({ ...s, orthoMode: !s.orthoMode }));
}

export function resetToolSettings(): void {
  toolSettings.set(defaultToolSettings);
}
