<script lang="ts">
  import { theme, appMode } from '$lib/stores/app';

  function toggleTheme() {
    theme.toggle();
  }
</script>

<button
  class="theme-toggle"
  class:expert={$appMode === 'expert'}
  onclick={toggleTheme}
  title={$theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'}
>
  {#if $theme === 'light'}
    <!-- Icône soleil -->
    <svg class="icon sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  {:else}
    <!-- Icône lune -->
    <svg class="icon moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  {/if}
</button>

<style>
  .theme-toggle {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    color: var(--text-secondary);
  }

  .theme-toggle:hover {
    background: var(--bg-hover);
    color: var(--primary);
    border-color: var(--primary);
  }

  .theme-toggle.expert:hover {
    box-shadow: 0 0 10px var(--primary-glow);
  }

  .icon {
    width: 18px;
    height: 18px;
    transition: transform var(--transition-fast);
  }

  .theme-toggle:hover .icon {
    transform: rotate(15deg);
  }

  .sun {
    color: var(--warning);
  }

  .moon {
    color: var(--accent-cyan);
  }
</style>
