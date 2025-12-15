<script lang="ts">
  import { currentStyle } from '$lib/stores/qgls/styleStore';

  // Props - map reference will be passed from parent
  let { onProcess = (op: string, params: any) => {} }: { onProcess?: (op: string, params: any) => void } = $props();

  // Processing tools definition
  interface ProcessingTool {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'geometry' | 'analysis' | 'transform';
    requiresSelection: boolean;
    minFeatures: number;
    maxFeatures: number | null;
    params?: { name: string; type: 'number' | 'select'; default: any; options?: string[] }[];
  }

  const tools: ProcessingTool[] = [
    // Geometry operations
    {
      id: 'buffer',
      name: 'Buffer',
      description: 'Créer une zone tampon autour des sketches',
      icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
      category: 'geometry',
      requiresSelection: true,
      minFeatures: 1,
      maxFeatures: null,
      params: [{ name: 'distance', type: 'number', default: 10 }]
    },
    {
      id: 'centroid',
      name: 'Centroïde',
      description: 'Calculer le centre des polygones',
      icon: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
      category: 'geometry',
      requiresSelection: true,
      minFeatures: 1,
      maxFeatures: null
    },
    {
      id: 'convexHull',
      name: 'Enveloppe convexe',
      description: 'Créer l\'enveloppe convexe des sketches',
      icon: 'M3 3h18v18H3V3zm2 2v14h14V5H5z',
      category: 'geometry',
      requiresSelection: true,
      minFeatures: 1,
      maxFeatures: null
    },
    {
      id: 'boundingBox',
      name: 'Boîte englobante',
      description: 'Créer un rectangle englobant',
      icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z',
      category: 'geometry',
      requiresSelection: true,
      minFeatures: 1,
      maxFeatures: null
    },
    // Boolean operations
    {
      id: 'union',
      name: 'Union',
      description: 'Fusionner les polygones sélectionnés',
      icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z',
      category: 'analysis',
      requiresSelection: true,
      minFeatures: 2,
      maxFeatures: null
    },
    {
      id: 'intersection',
      name: 'Intersection',
      description: 'Zone commune entre 2 polygones',
      icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
      category: 'analysis',
      requiresSelection: true,
      minFeatures: 2,
      maxFeatures: 2
    },
    {
      id: 'difference',
      name: 'Différence',
      description: 'Soustraire un polygone d\'un autre',
      icon: 'M19 13H5v-2h14v2z',
      category: 'analysis',
      requiresSelection: true,
      minFeatures: 2,
      maxFeatures: 2
    },
    {
      id: 'symmetricDifference',
      name: 'Diff. symétrique',
      description: 'Zones non communes entre 2 polygones',
      icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
      category: 'analysis',
      requiresSelection: true,
      minFeatures: 2,
      maxFeatures: 2
    },
    // Transform operations
    {
      id: 'simplify',
      name: 'Simplifier',
      description: 'Réduire le nombre de vertices',
      icon: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
      category: 'transform',
      requiresSelection: true,
      minFeatures: 1,
      maxFeatures: null,
      params: [{ name: 'tolerance', type: 'number', default: 1 }]
    },
    {
      id: 'dissolve',
      name: 'Dissolve',
      description: 'Fusionner les polygones adjacents',
      icon: 'M17 20.41L18.41 19 15 15.59 13.59 17 17 20.41zM7.5 8H11v5.59L5.59 19 7 20.41l6-6V8h3.5L12 3.5 7.5 8z',
      category: 'transform',
      requiresSelection: true,
      minFeatures: 2,
      maxFeatures: null
    }
  ];

  // Group tools by category
  const geometryTools = tools.filter(t => t.category === 'geometry');
  const analysisTools = tools.filter(t => t.category === 'analysis');
  const transformTools = tools.filter(t => t.category === 'transform');

  // Selected tool and params
  let selectedTool = $state<ProcessingTool | null>(null);
  let toolParams = $state<Record<string, any>>({});

  function selectTool(tool: ProcessingTool) {
    selectedTool = tool;
    // Initialize params with defaults
    toolParams = {};
    if (tool.params) {
      tool.params.forEach(p => {
        toolParams[p.name] = p.default;
      });
    }
  }

  function executeTool() {
    if (!selectedTool) return;
    onProcess(selectedTool.id, { ...toolParams });
  }

  function cancelTool() {
    selectedTool = null;
    toolParams = {};
  }
</script>

<div class="processing-panel">
  {#if !selectedTool}
    <!-- Tool categories -->
    <div class="tool-section">
      <div class="section-header">Géométrie</div>
      <div class="tool-grid">
        {#each geometryTools as tool}
          <button class="tool-btn" onclick={() => selectTool(tool)} title={tool.description}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d={tool.icon}/>
            </svg>
            <span>{tool.name}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="tool-section">
      <div class="section-header">Analyse</div>
      <div class="tool-grid">
        {#each analysisTools as tool}
          <button class="tool-btn" onclick={() => selectTool(tool)} title={tool.description}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d={tool.icon}/>
            </svg>
            <span>{tool.name}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="tool-section">
      <div class="section-header">Transformation</div>
      <div class="tool-grid">
        {#each transformTools as tool}
          <button class="tool-btn" onclick={() => selectTool(tool)} title={tool.description}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d={tool.icon}/>
            </svg>
            <span>{tool.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <!-- Tool configuration -->
    <div class="tool-config">
      <div class="config-header">
        <button class="back-btn" onclick={cancelTool}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h3>{selectedTool.name}</h3>
      </div>

      <p class="tool-desc">{selectedTool.description}</p>

      <div class="selection-info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>
          {#if selectedTool.minFeatures === selectedTool.maxFeatures}
            Sélectionner {selectedTool.minFeatures} sketche(s)
          {:else if selectedTool.maxFeatures}
            Sélectionner {selectedTool.minFeatures}-{selectedTool.maxFeatures} sketches
          {:else}
            Sélectionner au moins {selectedTool.minFeatures} sketche(s)
          {/if}
        </span>
      </div>

      {#if selectedTool.params && selectedTool.params.length > 0}
        <div class="params-section">
          <div class="section-header">Paramètres</div>
          {#each selectedTool.params as param}
            <div class="param-row">
              <label for={param.name}>{param.name}</label>
              {#if param.type === 'number'}
                <div class="param-input">
                  <input
                    type="number"
                    id={param.name}
                    bind:value={toolParams[param.name]}
                    step="0.1"
                  />
                  <span class="param-unit">m</span>
                </div>
              {:else if param.type === 'select' && param.options}
                <select id={param.name} bind:value={toolParams[param.name]}>
                  {#each param.options as opt}
                    <option value={opt}>{opt}</option>
                  {/each}
                </select>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <div class="action-buttons">
        <button class="btn-cancel" onclick={cancelTool}>Annuler</button>
        <button class="btn-execute" onclick={executeTool}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Exécuter
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .processing-panel {
    padding: 12px;
    font-size: 12px;
  }

  .tool-section {
    margin-bottom: 16px;
  }

  .section-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-color);
  }

  .tool-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px;
    background: var(--bg-tertiary, rgba(0,0,0,0.2));
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tool-btn:hover {
    background: rgba(0, 255, 136, 0.1);
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .tool-btn svg {
    width: 20px;
    height: 20px;
  }

  .tool-btn span {
    font-size: 10px;
    text-align: center;
  }

  /* Tool configuration */
  .tool-config {
    background: var(--bg-tertiary, rgba(0,0,0,0.2));
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
  }

  .config-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .back-btn:hover {
    background: rgba(255,255,255,0.1);
    color: var(--text-primary);
  }

  .back-btn svg {
    width: 16px;
    height: 16px;
  }

  .config-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--cyber-green);
  }

  .tool-desc {
    color: var(--text-secondary);
    margin: 0 0 12px 0;
    line-height: 1.4;
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255, 200, 0, 0.1);
    border: 1px solid rgba(255, 200, 0, 0.3);
    border-radius: 4px;
    color: #ffc800;
    font-size: 11px;
    margin-bottom: 12px;
  }

  .selection-info svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .params-section {
    margin-bottom: 16px;
  }

  .param-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }

  .param-row label {
    color: var(--text-secondary);
    text-transform: capitalize;
  }

  .param-input {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .param-input input {
    width: 80px;
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-family: var(--font-mono);
    text-align: right;
  }

  .param-unit {
    color: var(--text-muted);
    font-size: 11px;
  }

  .param-row select {
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .btn-cancel, .btn-execute {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn-cancel:hover {
    background: rgba(255,255,255,0.05);
    color: var(--text-primary);
  }

  .btn-execute {
    background: var(--cyber-green);
    border: 1px solid var(--cyber-green);
    color: #000;
  }

  .btn-execute:hover {
    background: #00cc6a;
  }

  .btn-execute svg {
    width: 14px;
    height: 14px;
  }
</style>
