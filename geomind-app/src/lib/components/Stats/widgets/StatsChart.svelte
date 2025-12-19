<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import type { ChartData } from '$lib/stores/statsStore';

  // Enregistrer tous les composants Chart.js
  Chart.register(...registerables);

  export let type: 'bar' | 'pie' | 'line' | 'doughnut' = 'bar';
  export let data: ChartData;
  export let options: Record<string, any> = {};

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  // Couleurs par défaut (palette Bussigny)
  const defaultColors = [
    '#1E4B8E',  // Bleu foncé
    '#3D7ABF',  // Bleu moyen
    '#6BA3D6',  // Bleu clair
    '#00ff88',  // Cyber green
    '#27ae60',  // Vert
    '#f39c12',  // Orange
    '#e74c3c',  // Rouge
    '#9b59b6',  // Violet
    '#1abc9c',  // Turquoise
    '#95a5a6'   // Gris
  ];

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: type === 'pie' || type === 'doughnut',
        position: 'bottom' as const,
        labels: {
          color: '#a0aac0',
          padding: 16,
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: '#1a2332',
        titleColor: '#e0e6ff',
        bodyColor: '#a0aac0',
        borderColor: '#2d3748',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: type === 'bar' || type === 'line' ? {
      x: {
        grid: { color: '#2d374830' },
        ticks: { color: '#a0aac0' }
      },
      y: {
        grid: { color: '#2d374830' },
        ticks: { color: '#a0aac0' }
      }
    } : undefined
  };

  function createChart() {
    if (!canvas || !data) return;

    // Détruire l'ancien chart s'il existe
    if (chart) {
      chart.destroy();
    }

    // Ajouter les couleurs par défaut si non définies
    const processedData = {
      ...data,
      datasets: data.datasets.map((dataset, i) => ({
        ...dataset,
        backgroundColor: dataset.backgroundColor || (
          type === 'pie' || type === 'doughnut'
            ? defaultColors
            : defaultColors[i % defaultColors.length]
        ),
        borderColor: dataset.borderColor || (
          type === 'line' ? defaultColors[i % defaultColors.length] : 'transparent'
        ),
        borderWidth: type === 'line' ? 2 : 0,
        borderRadius: type === 'bar' ? 4 : 0
      }))
    };

    chart = new Chart(canvas, {
      type,
      data: processedData,
      options: { ...baseOptions, ...options }
    });
  }

  onMount(() => {
    createChart();
  });

  // Recréer le chart quand les données changent
  $: if (canvas && data) {
    createChart();
  }

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });

  // Fonction pour exporter en PNG (pour PDF)
  export function toBase64(): string {
    return canvas?.toDataURL('image/png') || '';
  }
</script>

<div class="chart-container">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart-container {
    position: relative;
    width: 100%;
    height: 300px;
  }
</style>
