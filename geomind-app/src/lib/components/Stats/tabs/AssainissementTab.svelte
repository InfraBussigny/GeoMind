<script lang="ts">
  import { assainissementData, isLoading, statsError } from '$lib/stores/statsStore';
  import StatsKPI from '../widgets/StatsKPI.svelte';
  import StatsChart from '../widgets/StatsChart.svelte';

  export let connectionId: string;

  let dataLoaded = false;

  $: if (connectionId && !dataLoaded) {
    loadData();
  }

  async function loadData() {
    if (!connectionId) return;

    $isLoading = true;
    $statsError = null;

    try {
      const response = await fetch(`http://localhost:3001/api/stats/assainissement/${connectionId}`);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      $assainissementData = data;
      dataLoaded = true;
    } catch (error) {
      console.error('Erreur chargement stats assainissement:', error);
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

<div class="assainissement-tab">
  <div class="tab-header">
    <h2>Statistiques Assainissement</h2>
    <button class="refresh-btn" onclick={refresh} disabled={$isLoading}>
      {$isLoading ? 'Chargement...' : 'Actualiser'}
    </button>
  </div>

  {#if $assainissementData}
    <!-- KPIs -->
    <div class="kpis-grid">
      {#each $assainissementData.kpis as kpi}
        <StatsKPI {kpi} />
      {/each}
    </div>

    <!-- Graphiques - Row 1 -->
    <div class="charts-row">
      {#if $assainissementData.collecteursParType}
        <div class="chart-card">
          <h3>Linéaire par type d'eau</h3>
          <StatsChart type="bar" data={$assainissementData.collecteursParType} />
        </div>
      {/if}

      {#if $assainissementData.collecteursParEtat}
        <div class="chart-card">
          <h3>État d'inspection</h3>
          <StatsChart type="bar" data={$assainissementData.collecteursParEtat} />
        </div>
      {/if}
    </div>

    <!-- Graphiques - Row 2 -->
    <div class="charts-row">
      {#if $assainissementData.collecteursParMateriau}
        <div class="chart-card">
          <h3>Linéaire par matériau</h3>
          <StatsChart type="bar" data={$assainissementData.collecteursParMateriau} options={{ indexAxis: 'y' }} />
        </div>
      {/if}

      {#if $assainissementData.collecteursParHierarchie}
        <div class="chart-card">
          <h3>Par fonction hiérarchique</h3>
          <StatsChart type="pie" data={$assainissementData.collecteursParHierarchie} />
        </div>
      {/if}
    </div>

    <!-- Graphiques - Row 3: Chambres -->
    <div class="charts-row single">
      {#if $assainissementData.chambresParType}
        <div class="chart-card">
          <h3>Chambres par genre</h3>
          <StatsChart type="doughnut" data={$assainissementData.chambresParType} />
        </div>
      {/if}
    </div>
  {:else if !$isLoading && !$statsError}
    <div class="no-data">
      <p>Chargement des données...</p>
    </div>
  {/if}
</div>

<style>
  .assainissement-tab {
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
    font-weight: 600;
  }

  .refresh-btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--border-color, #2d3748);
    background: var(--noir-card, #1a2332);
    color: var(--text-primary, #e0e6ff);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--cyber-green, #00ff88);
    color: #000;
    border-color: var(--cyber-green, #00ff88);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .kpis-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .charts-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }

  .charts-row.single {
    grid-template-columns: 1fr;
    max-width: 500px;
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
    font-weight: 600;
    color: var(--text-secondary, #a0aac0);
  }

  .no-data {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--text-muted, #606d8a);
  }
</style>
