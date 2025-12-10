<script lang="ts">
  import { browser } from '$app/environment';

  interface Props {
    position: 'left' | 'right' | 'bottom';
    collapsed?: boolean;
    size?: number;
    minSize?: number;
    maxSize?: number;
    storageKey?: string;
    title?: string;
    children?: any;
  }

  let {
    position,
    collapsed = $bindable(false),
    size = $bindable(position === 'bottom' ? 200 : 250),
    minSize = position === 'bottom' ? 100 : 150,
    maxSize = position === 'bottom' ? 500 : 500,
    storageKey,
    title = '',
    children
  }: Props = $props();

  let isResizing = $state(false);
  let startPos = $state(0);
  let startSize = $state(0);

  // Load saved state from localStorage
  $effect(() => {
    if (browser && storageKey) {
      const saved = localStorage.getItem(`panel-${storageKey}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          collapsed = data.collapsed ?? collapsed;
          size = data.size ?? size;
        } catch {}
      }
    }
  });

  // Save state to localStorage
  function saveState() {
    if (browser && storageKey) {
      localStorage.setItem(`panel-${storageKey}`, JSON.stringify({ collapsed, size }));
    }
  }

  function toggle() {
    collapsed = !collapsed;
    saveState();
  }

  function startResize(e: MouseEvent) {
    e.preventDefault();
    isResizing = true;
    startPos = position === 'bottom' ? e.clientY : e.clientX;
    startSize = size;

    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.cursor = position === 'bottom' ? 'ns-resize' : 'ew-resize';
    document.body.style.userSelect = 'none';
  }

  function onResize(e: MouseEvent) {
    if (!isResizing) return;

    let delta: number;
    if (position === 'bottom') {
      delta = startPos - e.clientY;
    } else if (position === 'left') {
      delta = e.clientX - startPos;
    } else {
      delta = startPos - e.clientX;
    }

    const newSize = Math.min(maxSize, Math.max(minSize, startSize + delta));
    size = newSize;
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    saveState();
  }

  // Get toggle icon based on position and state
  function getToggleIcon(): string {
    if (position === 'left') {
      return collapsed ? '>' : '<';
    } else if (position === 'right') {
      return collapsed ? '<' : '>';
    } else {
      return collapsed ? '^' : 'v';
    }
  }
</script>

<div
  class="collapsible-panel {position}"
  class:collapsed
  class:resizing={isResizing}
  style={collapsed ? '' : position === 'bottom' ? `height: ${size}px` : `width: ${size}px`}
>
  {#if !collapsed}
    <!-- Resize handle -->
    <div
      class="resize-handle"
      onmousedown={startResize}
      role="separator"
      aria-orientation={position === 'bottom' ? 'horizontal' : 'vertical'}
      tabindex="0"
    ></div>
  {/if}

  <!-- Panel header with toggle -->
  <div class="panel-header">
    {#if title}
      <span class="panel-title">{title}</span>
    {/if}
    <button
      class="toggle-btn"
      onclick={toggle}
      title={collapsed ? 'Ouvrir' : 'Fermer'}
      aria-expanded={!collapsed}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        {#if position === 'left'}
          {#if collapsed}
            <polyline points="9 18 15 12 9 6"/>
          {:else}
            <polyline points="15 18 9 12 15 6"/>
          {/if}
        {:else if position === 'right'}
          {#if collapsed}
            <polyline points="15 18 9 12 15 6"/>
          {:else}
            <polyline points="9 18 15 12 9 6"/>
          {/if}
        {:else}
          {#if collapsed}
            <polyline points="18 15 12 9 6 15"/>
          {:else}
            <polyline points="6 9 12 15 18 9"/>
          {/if}
        {/if}
      </svg>
    </button>
  </div>

  <!-- Panel content -->
  {#if !collapsed}
    <div class="panel-content">
      {@render children?.()}
    </div>
  {/if}
</div>

<style>
  .collapsible-panel {
    display: flex;
    flex-direction: column;
    background: var(--noir-surface);
    border: 1px solid var(--border-color);
    position: relative;
    transition: width 0.15s ease, height 0.15s ease;
    overflow: hidden;
  }

  .collapsible-panel.resizing {
    transition: none;
  }

  /* Position-specific styles */
  .collapsible-panel.left {
    border-right: 1px solid var(--border-color);
    border-left: none;
    border-top: none;
    border-bottom: none;
  }

  .collapsible-panel.right {
    border-left: 1px solid var(--border-color);
    border-right: none;
    border-top: none;
    border-bottom: none;
  }

  .collapsible-panel.bottom {
    border-top: 1px solid var(--border-color);
    border-bottom: none;
    border-left: none;
    border-right: none;
  }

  /* Collapsed states */
  .collapsible-panel.left.collapsed {
    width: 32px !important;
  }

  .collapsible-panel.right.collapsed {
    width: 32px !important;
  }

  .collapsible-panel.bottom.collapsed {
    height: 32px !important;
  }

  /* Resize handle */
  .resize-handle {
    position: absolute;
    background: transparent;
    z-index: 10;
    transition: background 0.15s;
  }

  .resize-handle:hover,
  .resizing .resize-handle {
    background: var(--cyber-green);
    box-shadow: 0 0 8px var(--cyber-green-glow);
  }

  .left .resize-handle {
    right: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: ew-resize;
  }

  .right .resize-handle {
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: ew-resize;
  }

  .bottom .resize-handle {
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    cursor: ns-resize;
  }

  /* Panel header */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: var(--noir-card);
    border-bottom: 1px solid var(--border-color);
    min-height: 32px;
  }

  .collapsed .panel-header {
    border-bottom: none;
    justify-content: center;
    padding: 6px 4px;
  }

  .panel-title {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .collapsed .panel-title {
    display: none;
  }

  /* Toggle button */
  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .toggle-btn:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
  }

  /* Panel content */
  .panel-content {
    flex: 1;
    overflow: auto;
    min-height: 0;
  }

  /* Vertical collapsed panels - rotate content indicator */
  .left.collapsed .panel-header,
  .right.collapsed .panel-header {
    flex-direction: column;
    height: 100%;
    padding: 8px 4px;
  }

  .left.collapsed .panel-title,
  .right.collapsed .panel-title {
    display: block;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    margin-top: 8px;
  }
</style>
