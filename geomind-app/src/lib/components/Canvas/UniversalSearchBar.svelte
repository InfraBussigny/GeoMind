<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { universalSearch, getDefaultPortalResult, type ParsedQuery, type PortalSearchResult } from '$lib/services/universalSearch';
  import { defaultPortal } from '$lib/stores/portalConfig';

  const dispatch = createEventDispatcher<{
    navigate: { tabId: string; url: string };
    openAll: { results: PortalSearchResult[] };
  }>();

  // State
  let searchQuery = $state('');
  let parsedQuery = $state<ParsedQuery | null>(null);
  let relevantResults = $state<PortalSearchResult[]>([]);
  let otherResults = $state<PortalSearchResult[]>([]);
  let showDropdown = $state(false);
  let selectedIndex = $state(-1);
  let inputRef: HTMLInputElement | null = null;
  let containerRef: HTMLDivElement | null = null;

  // Computed: all visible results
  let allResults = $derived([...relevantResults, ...otherResults]);

  // Perform search
  function handleSearch() {
    if (searchQuery.trim().length < 2) {
      parsedQuery = null;
      relevantResults = [];
      otherResults = [];
      showDropdown = false;
      selectedIndex = -1;
      return;
    }

    const result = universalSearch(searchQuery);
    parsedQuery = result.parsed;
    relevantResults = result.relevantResults;
    otherResults = result.otherResults;
    showDropdown = true;
    selectedIndex = relevantResults.length > 0 ? 0 : -1;
  }

  // Handle result click
  function selectResult(result: PortalSearchResult) {
    if (result.url) {
      dispatch('navigate', { tabId: result.tabId, url: result.url });
    }
    closeDropdown();
  }

  // Open all relevant results
  function openAllRelevant() {
    dispatch('openAll', { results: relevantResults });
    closeDropdown();
  }

  // Close dropdown and reset
  function closeDropdown() {
    showDropdown = false;
    searchQuery = '';
    parsedQuery = null;
    relevantResults = [];
    otherResults = [];
    selectedIndex = -1;
  }

  // Keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    if (!showDropdown) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, allResults.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && allResults[selectedIndex]) {
          selectResult(allResults[selectedIndex]);
        } else if (relevantResults.length > 0) {
          // Default: open first relevant result
          selectResult(relevantResults[0]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeDropdown();
        inputRef?.blur();
        break;
    }
  }

  // Click outside handler
  function handleClickOutside(event: MouseEvent) {
    if (containerRef && !containerRef.contains(event.target as Node)) {
      showDropdown = false;
    }
  }

  // Get type label in French
  function getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'parcelle': 'PARCELLE',
      'adresse': 'ADRESSE',
      'commune': 'COMMUNE',
      'coordonnees': 'COORDONNEES',
      'lieu': 'LIEU',
      'unknown': 'RECHERCHE'
    };
    return labels[type] || type.toUpperCase();
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<div class="search-container" bind:this={containerRef}>
  <div class="search-input-wrapper" class:active={showDropdown}>
    <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input
      type="text"
      bind:this={inputRef}
      bind:value={searchQuery}
      oninput={handleSearch}
      onkeydown={handleKeydown}
      onfocus={() => { if (searchQuery.length >= 2) showDropdown = true; }}
      placeholder="Recherche: parcelle, adresse, coordonnees..."
      class="search-input"
    />
    {#if searchQuery}
      <button class="search-clear" onclick={closeDropdown} title="Effacer">
        &times;
      </button>
    {/if}
  </div>

  {#if showDropdown && (relevantResults.length > 0 || otherResults.length > 0)}
    <div class="search-dropdown">
      <!-- Parsed query info -->
      {#if parsedQuery}
        <div class="search-header">
          <span class="query-type">{getTypeLabel(parsedQuery.type)}</span>
          <div class="query-details">
            {#if parsedQuery.commune}
              <span class="detail">Commune: <strong>{parsedQuery.commune}</strong></span>
            {/if}
            {#if parsedQuery.parcelle}
              <span class="detail">Parcelle: <strong>{parsedQuery.parcelle}</strong></span>
            {/if}
            {#if parsedQuery.coordX}
              <span class="detail">X: {parsedQuery.coordX}, Y: {parsedQuery.coordY}</span>
            {/if}
            {#if parsedQuery.adresse && !parsedQuery.commune}
              <span class="detail">{parsedQuery.adresse}</span>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Relevant results -->
      {#if relevantResults.length > 0}
        <div class="results-section">
          {#each relevantResults as result, index}
            {@const globalIndex = index}
            <button
              class="result-item"
              class:selected={selectedIndex === globalIndex}
              class:is-default={result.isDefault}
              onclick={() => selectResult(result)}
              title={result.url || ''}
            >
              <div class="result-main">
                {#if result.isDefault}
                  <span class="default-star" title="Portail par defaut">★</span>
                {/if}
                <span class="portal-name">{result.portalName}</span>
                <span class="result-method">{result.method}</span>
              </div>
              <div class="result-description">{result.description}</div>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Other results (non-relevant) -->
      {#if otherResults.length > 0}
        <div class="results-section other">
          <div class="section-divider">
            <span>Autres portails</span>
          </div>
          {#each otherResults as result, index}
            {@const globalIndex = relevantResults.length + index}
            <button
              class="result-item dimmed"
              class:selected={selectedIndex === globalIndex}
              onclick={() => selectResult(result)}
              title={result.url || ''}
            >
              <div class="result-main">
                <span class="portal-name">{result.portalName}</span>
                <span class="result-method">{result.method}</span>
              </div>
              <div class="result-description">{result.description}</div>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Open all button -->
      {#if relevantResults.length > 1}
        <button class="open-all-btn" onclick={openAllRelevant}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          Ouvrir sur tous les portails pertinents ({relevantResults.length})
        </button>
      {/if}

      <!-- Keyboard hint -->
      <div class="keyboard-hint">
        <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
        <span><kbd>Entree</kbd> ouvrir</span>
        <span><kbd>Esc</kbd> fermer</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .search-container {
    position: relative;
    margin: 0 var(--spacing-md);
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: 0 var(--spacing-sm);
    transition: all var(--transition-fast);
  }

  .search-input-wrapper:focus-within,
  .search-input-wrapper.active {
    border-color: var(--cyber-green);
    box-shadow: 0 0 8px var(--cyber-green-glow);
  }

  .search-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 6px 8px;
    min-width: 280px;
  }

  .search-input::placeholder {
    color: var(--text-muted);
    font-style: italic;
  }

  .search-clear {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    transition: color var(--transition-fast);
  }

  .search-clear:hover {
    color: var(--danger);
  }

  .search-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--noir-card);
    border: 1px solid var(--cyber-green);
    border-radius: var(--border-radius-sm);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px var(--cyber-green-glow);
    z-index: 1000;
    overflow: hidden;
    min-width: 350px;
  }

  .search-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(0, 255, 136, 0.05);
    border-bottom: 1px solid var(--border-color);
  }

  .query-type {
    background: var(--cyber-green);
    color: var(--noir-profond);
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: 0.5px;
  }

  .query-details {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .detail {
    color: var(--text-secondary);
    font-size: 11px;
    font-family: var(--font-mono);
  }

  .detail strong {
    color: var(--text-primary);
  }

  .results-section {
    max-height: 280px;
    overflow-y: auto;
  }

  .section-divider {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    color: var(--text-muted);
    font-size: 10px;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-divider::before,
  .section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-color);
  }

  .result-item {
    width: 100%;
    display: block;
    text-align: left;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .result-item:last-child {
    border-bottom: none;
  }

  .result-item:hover,
  .result-item.selected {
    background: rgba(0, 255, 136, 0.1);
  }

  .result-item.is-default {
    background: rgba(0, 255, 136, 0.05);
  }

  .result-item.dimmed {
    opacity: 0.6;
  }

  .result-item.dimmed:hover {
    opacity: 1;
  }

  .result-main {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 3px;
  }

  .default-star {
    color: var(--warning);
    font-size: 12px;
  }

  .portal-name {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--cyber-green);
  }

  .result-item.dimmed .portal-name {
    color: var(--text-secondary);
  }

  .result-method {
    background: var(--noir-surface);
    color: var(--text-muted);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-family: var(--font-mono);
    text-transform: uppercase;
  }

  .result-description {
    font-size: 11px;
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }

  .open-all-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: rgba(0, 255, 136, 0.1);
    border: none;
    border-top: 1px solid var(--cyber-green);
    color: var(--cyber-green);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .open-all-btn:hover {
    background: var(--cyber-green);
    color: var(--noir-profond);
  }

  .keyboard-hint {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 6px 12px;
    background: var(--noir-surface);
    border-top: 1px solid var(--border-color);
    font-size: 10px;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .keyboard-hint kbd {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    padding: 1px 4px;
    font-size: 9px;
    margin-right: 2px;
  }
</style>
