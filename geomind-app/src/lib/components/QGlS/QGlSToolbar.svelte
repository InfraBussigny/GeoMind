<script lang="ts">
  import { currentTool, toolSettings, toolDefinitions, setTool, toggleSnap, type DrawingTool } from '$lib/stores/qgls/toolStore';
  import { canUndo, canRedo, undoDescription, redoDescription } from '$lib/stores/qgls/historyStore';
  import type QGlSMap from './QGlSMap.svelte';

  // Props
  let { mapRef = $bindable() }: { mapRef?: QGlSMap } = $props();

  // Undo/Redo handlers
  function handleUndo() {
    mapRef?.undo();
  }

  function handleRedo() {
    mapRef?.redo();
  }

  function handleDelete() {
    mapRef?.deleteSelected();
  }

  function handleMerge() {
    mapRef?.mergeSelected();
  }

  // Group tools
  const navigationTools = toolDefinitions.filter(t => t.group === 'navigation');
  const drawingTools = toolDefinitions.filter(t => t.group === 'drawing');
  const editingTools = toolDefinitions.filter(t => t.group === 'editing');
  const measureTools = toolDefinitions.filter(t => t.group === 'measure');

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    // Ignore if typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = e.key.toUpperCase();

    // Special action shortcuts
    if (key === 'U') {
      e.preventDefault();
      handleMerge();
      return;
    }

    // Find tool by shortcut
    const tool = toolDefinitions.find(t => t.shortcut.toUpperCase() === key);
    if (tool) {
      e.preventDefault();
      if (tool.id === 'delete') {
        handleDelete();
      } else {
        setTool(tool.id);
      }
      return;
    }

    // Special shortcuts
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      handleUndo();
    }
    if (e.ctrlKey && e.key === 'y') {
      e.preventDefault();
      handleRedo();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleDelete();
    }
  }

  // Tool icon renderer
  function getToolIcon(iconName: string): string {
    const icons: Record<string, string> = {
      cursor: 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z',
      hand: 'M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6M10 10V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8M18 11a2 2 0 1 1 4 0v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-4a2 2 0 0 1 2-2 2 2 0 0 1 2 2v2',
      dot: 'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
      line: 'M5 12h14',
      polygon: 'M12 2l9 7-3.5 9h-11L3 9z',
      rectangle: 'M3 3h18v18H3z',
      circle: 'M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0',
      edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
      scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12',
      merge: 'M8 6l4 4 4-4M12 10v8M5 18h14',
      trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
      ruler: 'M2 12h20M12 2v20M6 6l12 12',
      area: 'M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18',
    };
    return icons[iconName] || icons.dot;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="qgls-toolbar">
  <!-- Navigation tools -->
  <div class="tool-group">
    {#each navigationTools as tool}
      <button
        class="tool-btn"
        class:active={$currentTool === tool.id}
        title="{tool.label} ({tool.shortcut})"
        onclick={() => setTool(tool.id)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d={getToolIcon(tool.icon)}/>
        </svg>
      </button>
    {/each}
  </div>

  <div class="tool-separator"></div>

  <!-- Drawing tools -->
  <div class="tool-group">
    {#each drawingTools as tool}
      <button
        class="tool-btn"
        class:active={$currentTool === tool.id}
        title="{tool.label} ({tool.shortcut})"
        onclick={() => setTool(tool.id)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d={getToolIcon(tool.icon)}/>
        </svg>
      </button>
    {/each}
  </div>

  <div class="tool-separator"></div>

  <!-- Editing tools -->
  <div class="tool-group">
    {#each editingTools as tool}
      <button
        class="tool-btn"
        class:active={$currentTool === tool.id}
        title="{tool.label} ({tool.shortcut})"
        onclick={() => {
          if (tool.id === 'merge') {
            handleMerge();
          } else if (tool.id === 'delete') {
            handleDelete();
          } else {
            setTool(tool.id);
          }
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d={getToolIcon(tool.icon)}/>
        </svg>
      </button>
    {/each}
  </div>

  <div class="tool-separator"></div>

  <!-- Measure tools -->
  <div class="tool-group">
    {#each measureTools as tool}
      <button
        class="tool-btn"
        class:active={$currentTool === tool.id}
        title="{tool.label} ({tool.shortcut})"
        onclick={() => setTool(tool.id)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d={getToolIcon(tool.icon)}/>
        </svg>
      </button>
    {/each}
  </div>

  <div class="tool-separator"></div>

  <!-- History tools -->
  <div class="tool-group">
    <button
      class="tool-btn"
      title={$undoDescription ? `Annuler: ${$undoDescription} (Ctrl+Z)` : 'Annuler (Ctrl+Z)'}
      disabled={!$canUndo}
      onclick={handleUndo}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 7v6h6M3 13a9 9 0 1 0 2-5.3"/>
      </svg>
    </button>
    <button
      class="tool-btn"
      title={$redoDescription ? `Rétablir: ${$redoDescription} (Ctrl+Y)` : 'Rétablir (Ctrl+Y)'}
      disabled={!$canRedo}
      onclick={handleRedo}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 7v6h-6M21 13a9 9 0 1 1-2-5.3"/>
      </svg>
    </button>
  </div>

  <div class="tool-spacer"></div>

  <!-- Snap toggle -->
  <div class="tool-group snap-group">
    <label class="snap-toggle" title="Accrochage aux objets">
      <input type="checkbox" checked={$toolSettings.snapEnabled} onchange={toggleSnap} />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="2"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
      </svg>
      <span>Snap</span>
    </label>
  </div>
</div>

<style>
  .qgls-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--bg-tertiary, rgba(0,0,0,0.2));
    border-bottom: 1px solid var(--border-color);
  }

  .tool-group {
    display: flex;
    gap: 2px;
  }

  .tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tool-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.1);
    color: var(--text-primary);
  }

  .tool-btn.active {
    background: var(--cyber-green, #00ff88);
    color: #000;
    border-color: var(--cyber-green, #00ff88);
  }

  .tool-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tool-btn svg {
    width: 18px;
    height: 18px;
  }

  .tool-separator {
    width: 1px;
    height: 24px;
    background: var(--border-color);
    margin: 0 4px;
  }

  .tool-spacer {
    flex: 1;
  }

  .snap-group {
    display: flex;
    align-items: center;
  }

  .snap-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .snap-toggle:has(input:checked) {
    background: rgba(0, 255, 136, 0.15);
    border-color: var(--cyber-green, #00ff88);
    color: var(--cyber-green, #00ff88);
  }

  .snap-toggle input {
    display: none;
  }

  .snap-toggle svg {
    width: 16px;
    height: 16px;
  }
</style>
