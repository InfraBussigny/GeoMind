<script lang="ts">
  import type { StatsKPI } from '$lib/stores/statsStore';

  export let kpi: StatsKPI;
</script>

<div class="kpi-card">
  <div class="kpi-value">
    {kpi.value}
    {#if kpi.unit}
      <span class="kpi-unit">{kpi.unit}</span>
    {/if}
  </div>
  <div class="kpi-label">{kpi.label}</div>
  {#if kpi.description}
    <div class="kpi-description">{kpi.description}</div>
  {/if}
  {#if kpi.trend}
    <div class="kpi-trend" class:up={kpi.trend === 'up'} class:down={kpi.trend === 'down'}>
      {#if kpi.trend === 'up'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 15l-6-6-6 6"/>
        </svg>
      {:else if kpi.trend === 'down'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14"/>
        </svg>
      {/if}
    </div>
  {/if}
</div>

<style>
  .kpi-card {
    background: var(--noir-card, #1a2332);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid var(--border-color, #2d3748);
    position: relative;
    transition: all 0.2s;
  }

  .kpi-card:hover {
    border-color: var(--cyber-green, #00ff88);
    transform: translateY(-2px);
  }

  .kpi-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-bright, #ffffff);
    line-height: 1.2;
  }

  .kpi-unit {
    font-size: 1rem;
    font-weight: 400;
    color: var(--text-secondary, #a0aac0);
    margin-left: 4px;
  }

  .kpi-label {
    font-size: 0.9rem;
    color: var(--text-secondary, #a0aac0);
    margin-top: 8px;
  }

  .kpi-description {
    font-size: 0.75rem;
    color: var(--text-muted, #606d8a);
    margin-top: 4px;
  }

  .kpi-trend {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--noir-surface, #151b26);
  }

  .kpi-trend svg {
    width: 14px;
    height: 14px;
  }

  .kpi-trend.up {
    color: #2ecc71;
  }

  .kpi-trend.down {
    color: #e74c3c;
  }
</style>
