<script lang="ts">
  import { onMount } from 'svelte';
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    useSvelteFlow,
    BackgroundVariant
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  import TableNode from './TableNode.svelte';
  import ERDControls from './ERDControls.svelte';
  import {
    tablesToNodes,
    relationsToEdges,
    getLayoutedElements,
    saveLayout,
    loadLayout,
    clearLayout,
    applyLayoutPositions,
    type Table,
    type Relation,
    type ERDNode,
    type ERDEdge,
    type LayoutDirection,
    type SavedLayout
  } from './erd-utils';

  // Props
  interface Props {
    tables: Table[];
    relations: Relation[];
    connectionId: string;
  }

  let { tables, relations, connectionId }: Props = $props();

  // Node types registration
  const nodeTypes = {
    tableNode: TableNode
  };

  // State
  let nodes = $state<ERDNode[]>([]);
  let edges = $state<ERDEdge[]>([]);
  let layoutDirection = $state<LayoutDirection>('GRID');
  let initialized = $state(false);

  // SvelteFlow instance
  let flowInstance: ReturnType<typeof useSvelteFlow> | null = null;

  // Initialize on mount
  onMount(() => {
    initializeERD();
  });

  // Re-initialize when tables/relations change
  $effect(() => {
    if (tables.length > 0 && initialized) {
      // Tables changed, re-layout
      const rawNodes = tablesToNodes(tables);
      const rawEdges = relationsToEdges(relations);
      const layouted = getLayoutedElements(rawNodes, rawEdges, layoutDirection);

      // Try to apply saved positions
      const savedLayout = loadLayout(connectionId);
      if (savedLayout && savedLayout.direction === layoutDirection) {
        nodes = applyLayoutPositions(layouted.nodes, savedLayout);
      } else {
        nodes = layouted.nodes;
      }
      edges = layouted.edges;
    }
  });

  // Initialize ERD with layout
  function initializeERD() {
    if (tables.length === 0) {
      initialized = true;
      return;
    }

    const rawNodes = tablesToNodes(tables);
    const rawEdges = relationsToEdges(relations);

    // Check for saved layout
    const savedLayout = loadLayout(connectionId);
    if (savedLayout) {
      layoutDirection = savedLayout.direction;
      const layouted = getLayoutedElements(rawNodes, rawEdges, savedLayout.direction);
      nodes = applyLayoutPositions(layouted.nodes, savedLayout);
      edges = layouted.edges;
    } else {
      // Apply initial layout
      const layouted = getLayoutedElements(rawNodes, rawEdges, layoutDirection);
      nodes = layouted.nodes;
      edges = layouted.edges;
    }

    initialized = true;

    // Fit view after a short delay
    setTimeout(() => {
      fitView();
    }, 100);
  }

  // Handle layout direction change
  function handleLayoutChange(direction: LayoutDirection) {
    layoutDirection = direction;
    clearLayout(connectionId); // Clear saved positions when changing layout

    const rawNodes = tablesToNodes(tables);
    const rawEdges = relationsToEdges(relations);
    const layouted = getLayoutedElements(rawNodes, rawEdges, direction);

    nodes = layouted.nodes;
    edges = layouted.edges;

    setTimeout(() => fitView(), 50);
  }

  // Reset positions
  function handleResetPositions() {
    clearLayout(connectionId);
    handleLayoutChange(layoutDirection);
  }

  // Fit view
  function fitView() {
    const flowElement = document.querySelector('.svelte-flow');
    if (flowElement) {
      // Trigger fit view via custom event or direct API
      const event = new CustomEvent('fitview');
      flowElement.dispatchEvent(event);
    }
  }

  // Save position on node drag end
  function handleNodeDragStop(event: any) {
    const { node } = event.detail || {};
    if (!node) return;

    // Update node position in state
    nodes = nodes.map(n =>
      n.id === node.id ? { ...n, position: node.position } : n
    );

    // Save to localStorage
    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach(n => {
      positions[n.id] = n.position;
    });

    saveLayout(connectionId, {
      positions,
      direction: layoutDirection,
      timestamp: Date.now()
    });
  }

  // Handle nodes change from SvelteFlow
  function handleNodesChange(changes: any) {
    // SvelteFlow handles internal state, we just sync on drag end
  }

  // MiniMap node color
  function getMinimapNodeColor(node: any): string {
    if (node?.data?.table?.hasGeometry) {
      return '#90EE90'; // Green for PostGIS
    }
    return '#2563eb'; // Blue default
  }
</script>

<div class="erd-canvas">
  {#if tables.length === 0}
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
        <path d="M10 6h4M17 10v4M10 17h4M7 10v4"/>
      </svg>
      <h3>Aucune table a afficher</h3>
      <p>Selectionnez un schema contenant des tables.</p>
    </div>
  {:else}
    <SvelteFlow
      {nodes}
      {edges}
      {nodeTypes}
      fitView
      minZoom={0.1}
      maxZoom={2}
      defaultEdgeOptions={{
        type: 'smoothstep',
        animated: false
      }}
      onnodedragstop={handleNodeDragStop}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      <Controls position="bottom-right" />
      <MiniMap
        position="bottom-left"
        nodeColor={getMinimapNodeColor as any}
        maskColor="rgba(0, 0, 0, 0.7)"
      />

      <ERDControls
        {layoutDirection}
        {connectionId}
        onLayoutChange={handleLayoutChange}
        onFitView={fitView}
        onResetPositions={handleResetPositions}
      />
    </SvelteFlow>
  {/if}
</div>

<style>
  .erd-canvas {
    width: 100%;
    height: 100%;
    min-height: 500px;
    position: relative;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted, #888);
    text-align: center;
    padding: 40px;
  }

  .empty-state svg {
    width: 80px;
    height: 80px;
    opacity: 0.4;
    margin-bottom: 20px;
  }

  .empty-state h3 {
    margin: 0 0 8px;
    color: var(--text-secondary, #aaa);
    font-size: 1.2rem;
  }

  .empty-state p {
    margin: 0;
  }

  /* SvelteFlow theme overrides for dark mode */
  :global(.svelte-flow) {
    background: var(--bg-primary, #0f0f1a) !important;
  }

  :global(.svelte-flow__background) {
    background-color: var(--bg-primary, #0f0f1a) !important;
  }

  :global(.svelte-flow__background pattern circle) {
    fill: var(--border-color, #3a3a4a) !important;
  }

  :global(.svelte-flow__edge-path) {
    stroke: #87ceeb !important;
    stroke-width: 2px !important;
  }

  :global(.svelte-flow__edge.selected .svelte-flow__edge-path) {
    stroke: var(--cyber-green, #00ff88) !important;
    stroke-width: 3px !important;
  }

  :global(.svelte-flow__minimap) {
    background: var(--noir-card, #1e1e2e) !important;
    border: 1px solid var(--border-color, #3a3a4a) !important;
    border-radius: 8px !important;
  }

  :global(.svelte-flow__minimap-mask) {
    fill: rgba(0, 0, 0, 0.7) !important;
  }

  :global(.svelte-flow__controls) {
    background: var(--noir-card, #1e1e2e) !important;
    border: 1px solid var(--border-color, #3a3a4a) !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
  }

  :global(.svelte-flow__controls button) {
    background: var(--noir-surface, #252535) !important;
    border-color: var(--border-color, #3a3a4a) !important;
    color: var(--text-primary, #e0e0e0) !important;
  }

  :global(.svelte-flow__controls button:hover) {
    background: var(--bg-hover, #2a2a3a) !important;
    color: var(--cyber-green, #00ff88) !important;
  }

  :global(.svelte-flow__controls button svg) {
    fill: currentColor !important;
  }

  :global(.svelte-flow__attribution) {
    display: none !important;
  }
</style>
