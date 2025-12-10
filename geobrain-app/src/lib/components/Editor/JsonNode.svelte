<script lang="ts">
  import JsonNode from './JsonNode.svelte';

  interface Props {
    value: any;
    nodeKey: string;
    expanded?: boolean;
  }

  let { value, nodeKey, expanded = false }: Props = $props();

  let isExpanded = $state(false);

  // Sync with prop on mount
  $effect(() => {
    isExpanded = expanded;
  });

  // Use $derived for reactive computed values
  const isObject = $derived(typeof value === 'object' && value !== null);
  const isArray = $derived(Array.isArray(value));
  const isEmpty = $derived(isObject && Object.keys(value).length === 0);

  function toggle() {
    isExpanded = !isExpanded;
  }
</script>

<div class="json-node">
  {#if isObject && !isEmpty}
    <button class="json-toggle" onclick={toggle}>
      <svg class="toggle-icon" class:expanded={isExpanded} width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 18l6-6-6-6"/>
      </svg>
      {#if nodeKey !== 'root'}
        <span class="json-key">"{nodeKey}"</span>
        <span class="json-colon">:</span>
      {/if}
      <span class="json-bracket">{isArray ? '[' : '{'}</span>
      {#if !isExpanded}
        <span class="json-ellipsis">...</span>
        <span class="json-bracket">{isArray ? ']' : '}'}</span>
        <span class="json-count">{Object.keys(value).length} {isArray ? 'items' : 'keys'}</span>
      {/if}
    </button>
    {#if isExpanded}
      <div class="json-children">
        {#each Object.entries(value) as [k, v]}
          <JsonNode value={v} nodeKey={k} expanded={false} />
        {/each}
      </div>
      <span class="json-bracket">{isArray ? ']' : '}'}</span>
    {/if}
  {:else}
    <div class="json-leaf">
      {#if nodeKey !== 'root'}
        <span class="json-key">"{nodeKey}"</span>
        <span class="json-colon">:</span>
      {/if}
      {#if value === null}
        <span class="json-null">null</span>
      {:else if typeof value === 'boolean'}
        <span class="json-boolean">{value}</span>
      {:else if typeof value === 'number'}
        <span class="json-number">{value}</span>
      {:else if typeof value === 'string'}
        <span class="json-string">"{value}"</span>
      {:else if isEmpty}
        <span class="json-bracket">{isArray ? '[]' : '{}'}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .json-node {
    margin-left: 16px;
  }

  .json-node:first-child {
    margin-left: 0;
  }

  .json-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
  }

  .json-toggle:hover {
    background: var(--bg-hover);
    border-radius: 2px;
  }

  .toggle-icon {
    color: var(--text-muted);
    transition: transform 0.15s;
  }

  .toggle-icon.expanded {
    transform: rotate(90deg);
  }

  .json-children {
    border-left: 1px solid var(--border-color);
    margin-left: 6px;
    padding-left: 10px;
  }

  .json-leaf {
    display: inline-flex;
    gap: 4px;
    padding: 0 4px;
  }

  .json-key {
    color: var(--accent-cyan);
  }

  .json-colon {
    color: var(--text-muted);
  }

  .json-bracket {
    color: var(--text-secondary);
  }

  .json-ellipsis {
    color: var(--text-muted);
  }

  .json-count {
    color: var(--text-muted);
    font-size: 10px;
    margin-left: 4px;
  }

  .json-null {
    color: var(--text-muted);
    font-style: italic;
  }

  .json-boolean {
    color: var(--accent-purple);
  }

  .json-number {
    color: var(--accent-purple);
  }

  .json-string {
    color: var(--cyber-green);
  }
</style>
