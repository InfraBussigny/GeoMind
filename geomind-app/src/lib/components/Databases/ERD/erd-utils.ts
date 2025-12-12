/**
 * ERD Utilities - Types, Layout Algorithm, Persistence
 */

import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/svelte';

// ============================================
// TYPES
// ============================================

export interface Column {
  name: string;
  type: string;
  dataType: string;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
  nullable: boolean;
  defaultValue: string | null;
  comment: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKey: {
    foreignSchema: string;
    foreignTable: string;
    foreignColumn: string;
    constraintName: string;
  } | null;
  isGeometry: boolean;
  geometry: {
    geometryType: string;
    srid: number;
    coordDimension: number;
  } | null;
  position: number;
}

export interface Table {
  schema: string;
  name: string;
  fullName: string;
  comment: string | null;
  sizeBytes: number;
  columnCount: number;
  columns: Column[];
  indexes: { name: string; definition: string }[];
  hasGeometry: boolean;
}

export interface Relation {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  constraintName: string;
}

export interface TableNodeData extends Record<string, unknown> {
  table: Table;
  isSelected: boolean;
  highlightedColumns: string[];
}

export interface RelationEdgeData extends Record<string, unknown> {
  relation: Relation;
  constraintName: string;
}

export type ERDNode = Node<TableNodeData, 'tableNode'>;
export type ERDEdge = Edge<RelationEdgeData>;

export type LayoutDirection = 'LR' | 'TB' | 'GRID';

// ============================================
// CONSTANTS
// ============================================

const NODE_WIDTH = 280;
const NODE_HEIGHT_BASE = 44; // Header height
const ROW_HEIGHT = 28; // Per column row
const MAX_VISIBLE_COLUMNS = 10;

// ============================================
// TRANSFORMATION FUNCTIONS
// ============================================

/**
 * Calculate node height based on number of columns
 */
export function calculateNodeHeight(table: Table): number {
  const visibleColumns = Math.min(table.columns.length, MAX_VISIBLE_COLUMNS);
  const showMoreButton = table.columns.length > MAX_VISIBLE_COLUMNS ? 32 : 0;
  return NODE_HEIGHT_BASE + (visibleColumns * ROW_HEIGHT) + showMoreButton;
}

/**
 * Transform tables to SvelteFlow nodes
 */
export function tablesToNodes(tables: Table[]): ERDNode[] {
  return tables.map((table) => ({
    id: table.fullName,
    type: 'tableNode',
    position: { x: 0, y: 0 }, // Will be set by Dagre
    data: {
      table,
      isSelected: false,
      highlightedColumns: []
    }
  }));
}

/**
 * Transform relations to SvelteFlow edges
 */
export function relationsToEdges(relations: Relation[]): ERDEdge[] {
  return relations.map((rel) => ({
    id: `${rel.sourceTable}-${rel.sourceColumn}-${rel.targetTable}-${rel.targetColumn}`,
    source: rel.sourceTable,
    target: rel.targetTable,
    type: 'smoothstep',
    animated: false,
    style: 'stroke: #87ceeb; stroke-width: 2px;',
    label: rel.sourceColumn,
    labelStyle: 'fill: #87ceeb; font-size: 10px;',
    labelBgStyle: 'fill: #1a1a2e; fill-opacity: 0.8;',
    data: {
      relation: rel,
      constraintName: rel.constraintName
    }
  }));
}

// ============================================
// LAYOUT ALGORITHMS
// ============================================

/**
 * Grid (Matrix) layout - compact and aesthetic arrangement
 * Arranges tables in a grid pattern, trying to keep related tables closer
 */
function getGridLayout(nodes: ERDNode[], edges: ERDEdge[]): ERDNode[] {
  if (nodes.length === 0) return nodes;

  // Calculate grid dimensions for a balanced layout
  const count = nodes.length;
  const cols = Math.ceil(Math.sqrt(count * 1.5)); // Slightly wider than square
  const rows = Math.ceil(count / cols);

  // Spacing between nodes
  const horizontalGap = 100;
  const verticalGap = 80;

  // Sort nodes: tables with more relations first, then by name
  const relationCount = new Map<string, number>();
  nodes.forEach(n => relationCount.set(n.id, 0));
  edges.forEach(e => {
    relationCount.set(e.source, (relationCount.get(e.source) || 0) + 1);
    relationCount.set(e.target, (relationCount.get(e.target) || 0) + 1);
  });

  const sortedNodes = [...nodes].sort((a, b) => {
    const relDiff = (relationCount.get(b.id) || 0) - (relationCount.get(a.id) || 0);
    if (relDiff !== 0) return relDiff;
    return a.data.table.name.localeCompare(b.data.table.name);
  });

  // Position nodes in grid
  return sortedNodes.map((node, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const height = calculateNodeHeight(node.data.table);

    // Calculate max height in this row for alignment
    const rowStartIdx = row * cols;
    const rowEndIdx = Math.min(rowStartIdx + cols, sortedNodes.length);
    let maxRowHeight = 0;
    for (let i = rowStartIdx; i < rowEndIdx; i++) {
      const h = calculateNodeHeight(sortedNodes[i].data.table);
      if (h > maxRowHeight) maxRowHeight = h;
    }

    // Calculate cumulative Y position based on previous rows
    let yOffset = 50; // margin
    for (let r = 0; r < row; r++) {
      const rStartIdx = r * cols;
      const rEndIdx = Math.min(rStartIdx + cols, sortedNodes.length);
      let rowMaxHeight = 0;
      for (let i = rStartIdx; i < rEndIdx; i++) {
        const h = calculateNodeHeight(sortedNodes[i].data.table);
        if (h > rowMaxHeight) rowMaxHeight = h;
      }
      yOffset += rowMaxHeight + verticalGap;
    }

    return {
      ...node,
      position: {
        x: 50 + col * (NODE_WIDTH + horizontalGap),
        y: yOffset
      }
    };
  });
}

/**
 * Apply Dagre layout algorithm to position nodes (LR or TB)
 */
function getDagreLayout(
  nodes: ERDNode[],
  edges: ERDEdge[],
  direction: 'LR' | 'TB'
): ERDNode[] {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 120,
    marginx: 50,
    marginy: 50
  });

  nodes.forEach((node) => {
    const height = calculateNodeHeight(node.data.table);
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const height = calculateNodeHeight(node.data.table);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - height / 2
      }
    };
  });
}

/**
 * Main layout function - dispatches to appropriate algorithm
 */
export function getLayoutedElements(
  nodes: ERDNode[],
  edges: ERDEdge[],
  direction: LayoutDirection = 'GRID'
): { nodes: ERDNode[]; edges: ERDEdge[] } {
  let layoutedNodes: ERDNode[];

  if (direction === 'GRID') {
    layoutedNodes = getGridLayout(nodes, edges);
  } else {
    layoutedNodes = getDagreLayout(nodes, edges, direction);
  }

  return { nodes: layoutedNodes, edges };
}

// ============================================
// PERSISTENCE (LOCALSTORAGE)
// ============================================

const STORAGE_KEY = 'geomind-erd-layout';

export interface SavedLayout {
  positions: Record<string, { x: number; y: number }>;
  direction: LayoutDirection;
  timestamp: number;
}

/**
 * Save layout to localStorage
 */
export function saveLayout(connectionId: string, layout: SavedLayout): void {
  try {
    const key = `${STORAGE_KEY}-${connectionId}`;
    localStorage.setItem(key, JSON.stringify(layout));
  } catch (e) {
    console.warn('[ERD] Failed to save layout:', e);
  }
}

/**
 * Load layout from localStorage
 */
export function loadLayout(connectionId: string): SavedLayout | null {
  try {
    const key = `${STORAGE_KEY}-${connectionId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('[ERD] Failed to load layout:', e);
    return null;
  }
}

/**
 * Clear saved layout
 */
export function clearLayout(connectionId: string): void {
  try {
    const key = `${STORAGE_KEY}-${connectionId}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('[ERD] Failed to clear layout:', e);
  }
}

/**
 * Apply saved positions to nodes
 */
export function applyLayoutPositions(
  nodes: ERDNode[],
  savedLayout: SavedLayout | null
): ERDNode[] {
  if (!savedLayout) return nodes;

  return nodes.map((node) => {
    const savedPos = savedLayout.positions[node.id];
    return savedPos ? { ...node, position: savedPos } : node;
  });
}

// ============================================
// EXPORT UTILITIES
// ============================================

/**
 * Download a data URL as a file
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate filename for export
 */
export function generateExportFilename(connectionId: string, extension: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `erd-${connectionId}-${date}.${extension}`;
}
