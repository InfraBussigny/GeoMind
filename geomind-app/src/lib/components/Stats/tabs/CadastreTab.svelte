<script lang="ts">
  import { cadastreData, isLoading, statsError } from '$lib/stores/statsStore';
  import StatsKPI from '../widgets/StatsKPI.svelte';
  import StatsChart from '../widgets/StatsChart.svelte';

  export let connectionId: string;

  let dataLoaded = false;

  $: if (connectionId && !dataLoaded) {
    loadData();
  }

  async function loadData() {
    $isLoading = true;
    $statsError = null;

    try {
      const response = await fetch(`http://localhost:3001/api/stats/cadastre/${connectionId}`);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      $cadastreData = data;
      dataLoaded = true;
    } catch (error) {
      console.error('Erreur chargement stats cadastre:', error);
      $statsError = error instanceof Error ? error.message : 'Erreur inconnue';
    } finally {
      $isLoading = false;
    }
  }

  function refresh() {
    dataLoaded = false;
    loadData();
  }
</script>

<div class="cadastre-tab">
  <div class="tab-header">
    <h2>Statistiques Cadastre</h2>
    <button class="refresh-btn" onclick={refresh} disabled={$isLoading}>
      {$isLoading ? 'Chargement...' : 'Actualiser'}
    </button>
  </div>

  {#if $cadastreData}
    <div class="kpis-grid">
      {#each $cadastreData.kpis as kpi}
        <StatsKPI {kpi} />
      {/each}
    </div>

    <div class="charts-grid">
      {#if $cadastreData.parcellesParType}
        <div class="chart-card">
          <h3>Parcelles par type</h3>
          <StatsChart type="pie" data={$cadastreData.parcellesParType} />
        </div>
      {/if}

      {#if $cadastreData.surfacesParProprietaire}
        <div class="chart-card">
          <h3>Surfaces par propriétaire</h3>
          <StatsChart type="bar" data={$cadastreData.surfacesParProprietaire} />
        </div>
      {/if}
    </div>
  {:else if !$isLoading && !$statsError}
    <div class="placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
      <p>Module Cadastre en cours de développement</p>
      <span>Les statistiques parcellaires seront disponibles prochainement</span>
    </div>
  {/if}
</div>

<style>
  .cadastre-tab {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .tab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tab-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .refresh-btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--border-color, #2d3748);
    background: var(--noir-card, #1a2332);
    color: var(--text-primary, #e0e6ff);
    cursor: pointer;
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--cyber-green, #00ff88);
    color: #000;
  }

  .kpis-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 24px;
  }

  .chart-card {
    background: var(--noir-card, #1a2332);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid var(--border-color, #2d3748);
  }

  .chart-card h3 {
    margin: 0 0 16px 0;
    font-size: 1rem;
    color: var(--text-secondary, #a0aac0);
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    gap: 16px;
    color: var(--text-muted, #606d8a);
    text-align: center;
  }

  .placeholder svg {
    width: 64px;
    height: 64px;
    opacity: 0.3;
  }

  .placeholder p {
    font-size: 1.1rem;
    margin: 0;
  }

  .placeholder span {
    font-size: 0.85rem;
  }
</style>
