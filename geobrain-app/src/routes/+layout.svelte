<script lang="ts">
  import '$lib/styles/theme.css';
  import Sidebar from '$lib/components/Sidebar.svelte';

  let { children } = $props();
</script>

<svelte:head>
  <title>GeoBrain - Bussigny SIT</title>
</svelte:head>

<div class="app-container">
  <Sidebar />
  <main class="main-content">
    {@render children()}
  </main>
</div>

<style>
  .app-container {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    overflow: auto;
    background: var(--bg-secondary);
  }
</style>
