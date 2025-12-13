<script lang="ts">
  import { wakeLockStore } from '$lib/stores/app';

  // Use global store (persists across module changes)
  $effect(() => {
    // This effect runs when the component mounts
    // but doesn't deactivate on unmount - that's the point!
  });

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
    return `${s}s`;
  }
</script>

<div class="wakelock-module">
  <!-- Main Card -->
  <div class="status-card" class:active={$wakeLockStore.isActive}>
    <button class="toggle-btn" onclick={() => wakeLockStore.toggle()}>
      <div class="toggle-icon">
        {#if $wakeLockStore.isActive}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        {/if}
      </div>
    </button>

    <div class="status-text">
      <span class="status-label">{$wakeLockStore.isActive ? 'Anti-veille actif' : 'Anti-veille inactif'}</span>
      {#if $wakeLockStore.isActive}
        <span class="timer">{formatTime($wakeLockStore.activeTime)}</span>
      {/if}
    </div>
  </div>

  <!-- Method indicator -->
  <div class="method-row">
    <span class="method-dot" class:native={$wakeLockStore.isSupported && !$wakeLockStore.useSimulation}></span>
    <span class="method-text">
      {#if $wakeLockStore.useSimulation}
        Mode simulation
      {:else if $wakeLockStore.isSupported}
        Wake Lock API
      {:else}
        Mode simulation (API non supportee)
      {/if}
    </span>
    <button class="method-toggle" onclick={() => wakeLockStore.toggleSimulation()} title="Changer de methode">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
      </svg>
    </button>
  </div>

  <p class="note">Empeche la mise en veille automatique de l'ecran<br><small style="opacity: 0.7;">Reste actif meme en changeant de module</small></p>
</div>

<style>
  .wakelock-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 2rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  /* Main Card */
  .status-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 2.5rem 3.5rem;
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 16px;
    transition: all 0.3s ease;
  }

  .status-card.active {
    border-color: var(--accent-color, #00ff88);
    box-shadow: 0 0 40px rgba(0, 255, 136, 0.15);
  }

  .toggle-btn {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 3px solid var(--border-color);
    background: var(--bg-tertiary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
    color: var(--text-secondary);
  }

  .toggle-btn:hover {
    border-color: var(--accent-color, #00ff88);
    transform: scale(1.05);
  }

  .status-card.active .toggle-btn {
    background: rgba(0, 255, 136, 0.1);
    border-color: var(--accent-color, #00ff88);
    color: var(--accent-color, #00ff88);
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
  }

  .toggle-icon {
    width: 48px;
    height: 48px;
  }

  .toggle-icon svg {
    width: 100%;
    height: 100%;
  }

  .status-card.active .toggle-icon {
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  .status-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .status-label {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .timer {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--accent-color, #00ff88);
  }

  /* Method Row */
  .method-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .method-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f59e0b;
  }

  .method-dot.native {
    background: var(--accent-color, #00ff88);
  }

  .method-toggle {
    width: 24px;
    height: 24px;
    padding: 4px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    margin-left: 0.5rem;
  }

  .method-toggle:hover {
    border-color: var(--accent-color, #00ff88);
    color: var(--text-primary);
  }

  .method-toggle svg {
    width: 100%;
    height: 100%;
  }

  /* Note */
  .note {
    font-size: 0.75rem;
    color: var(--text-secondary);
    opacity: 0.7;
    margin: 0;
    text-align: center;
  }

  /* Error */
  .error-msg {
    padding: 0.5rem 1rem;
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid #ff4444;
    border-radius: 6px;
    color: #ff4444;
    font-size: 0.8rem;
  }
</style>
