<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Props
  export let active: boolean = true;
  export let intensity: number = 5; // 1-10

  // State
  interface Spark {
    id: number;
    x: number;
    y: number;
    size: number;
    color: string;
    duration: number;
    delay: number;
  }

  let sparks: Spark[] = [];
  let sparkInterval: ReturnType<typeof setInterval> | null = null;
  let sparkId = 0;

  const COLORS = ['#FFD700', '#FFA500', '#FF6B6B', '#FFFFFF', '#87CEEB'];

  function createSpark() {
    if (!active) return;

    const spark: Spark = {
      id: sparkId++,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      duration: Math.random() * 500 + 300,
      delay: Math.random() * 100
    };

    sparks = [...sparks, spark];

    // Supprimer l'etincelle apres son animation
    setTimeout(() => {
      sparks = sparks.filter(s => s.id !== spark.id);
    }, spark.duration + spark.delay + 100);
  }

  onMount(() => {
    if (active) {
      // Frequence basee sur l'intensite
      const intervalMs = Math.max(100, 1000 - intensity * 80);
      sparkInterval = setInterval(createSpark, intervalMs);
    }
  });

  onDestroy(() => {
    if (sparkInterval) clearInterval(sparkInterval);
  });

  // Reactif a l'activation
  $: {
    if (sparkInterval) clearInterval(sparkInterval);
    if (active) {
      const intervalMs = Math.max(100, 1000 - intensity * 80);
      sparkInterval = setInterval(createSpark, intervalMs);
    }
  }
</script>

<div class="sparks-container" class:active>
  {#each sparks as spark (spark.id)}
    <div
      class="spark"
      style="
        left: {spark.x}%;
        top: {spark.y}%;
        width: {spark.size}px;
        height: {spark.size}px;
        background: {spark.color};
        animation-duration: {spark.duration}ms;
        animation-delay: {spark.delay}ms;
      "
    ></div>
  {/each}
</div>

<style>
  .sparks-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 9998;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .sparks-container.active {
    opacity: 1;
  }

  .spark {
    position: absolute;
    border-radius: 50%;
    animation: spark-fly ease-out forwards;
    box-shadow: 0 0 6px currentColor, 0 0 12px currentColor;
  }

  @keyframes spark-fly {
    0% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
    50% {
      opacity: 0.8;
    }
    100% {
      opacity: 0;
      transform: scale(0) translateY(-30px) rotate(180deg);
    }
  }
</style>
