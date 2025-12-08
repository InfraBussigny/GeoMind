<script lang="ts">
  import { currentModule, sidebarCollapsed, type ModuleType } from '$lib/stores/app';

  const modules: { id: ModuleType; label: string; icon: string }[] = [
    { id: 'chat', label: 'Assistant', icon: '💬' },
    { id: 'canvas', label: 'Carte', icon: '🗺️' },
    { id: 'editor', label: 'Éditeur', icon: '📝' },
    { id: 'docgen', label: 'Documents', icon: '📄' },
  ];

  function selectModule(id: ModuleType) {
    currentModule.set(id);
  }

  function toggleSidebar() {
    sidebarCollapsed.update(v => !v);
  }
</script>

<aside class="sidebar" class:collapsed={$sidebarCollapsed}>
  <div class="sidebar-header">
    {#if !$sidebarCollapsed}
      <div class="logo">
        <span class="logo-icon">🧠</span>
        <span class="logo-text">GeoBrain</span>
      </div>
      <span class="logo-subtitle">Bussigny SIT</span>
    {:else}
      <span class="logo-icon-only">🧠</span>
    {/if}
  </div>

  <nav class="sidebar-nav">
    {#each modules as module}
      <button
        class="nav-item"
        class:active={$currentModule === module.id}
        on:click={() => selectModule(module.id)}
        title={module.label}
      >
        <span class="nav-icon">{module.icon}</span>
        {#if !$sidebarCollapsed}
          <span class="nav-label">{module.label}</span>
        {/if}
      </button>
    {/each}
  </nav>

  <div class="sidebar-footer">
    <button class="toggle-btn" on:click={toggleSidebar} title={$sidebarCollapsed ? 'Ouvrir' : 'Réduire'}>
      <span class="toggle-icon">{$sidebarCollapsed ? '→' : '←'}</span>
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    height: 100vh;
    background: var(--bg-sidebar);
    display: flex;
    flex-direction: column;
    transition: width var(--transition-normal);
    overflow: hidden;
  }

  .sidebar.collapsed {
    width: var(--sidebar-collapsed-width);
  }

  .sidebar-header {
    padding: var(--spacing-lg);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    min-height: 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .logo-icon, .logo-icon-only {
    font-size: 28px;
  }

  .logo-icon-only {
    display: flex;
    justify-content: center;
  }

  .logo-text {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: white;
  }

  .logo-subtitle {
    font-size: var(--font-size-xs);
    color: var(--bleu-bussigny-light);
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .sidebar-nav {
    flex: 1;
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.7);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
    font-size: var(--font-size-md);
  }

  .sidebar.collapsed .nav-item {
    justify-content: center;
    padding: var(--spacing-md) var(--spacing-sm);
  }

  .nav-item:hover {
    background: rgba(255,255,255,0.1);
    color: white;
  }

  .nav-item.active {
    background: var(--bleu-bussigny);
    color: white;
  }

  .nav-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .nav-label {
    white-space: nowrap;
  }

  .sidebar-footer {
    padding: var(--spacing-md);
    border-top: 1px solid rgba(255,255,255,0.1);
  }

  .toggle-btn {
    width: 100%;
    padding: var(--spacing-sm);
    border: none;
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .toggle-btn:hover {
    background: rgba(255,255,255,0.2);
    color: white;
  }

  .toggle-icon {
    font-size: 16px;
  }
</style>
