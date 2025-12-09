<script lang="ts">
  import { currentModule, sidebarCollapsed, type ModuleType } from '$lib/stores/app';
  import GeoBrainLogo from './icons/GeoBrainLogo.svelte';

  const modules: { id: ModuleType; label: string; icon: string; description: string }[] = [
    { id: 'chat', label: 'Assistant', icon: 'M', description: 'Chat IA' },
    { id: 'canvas', label: 'Carte', icon: 'C', description: 'Visualisation' },
    { id: 'editor', label: 'Editeur', icon: 'E', description: 'SQL & Python' },
    { id: 'docgen', label: 'Documents', icon: 'D', description: 'Generation PDF' },
    { id: 'settings', label: 'Parametres', icon: 'S', description: 'Configuration' },
  ];

  function selectModule(id: ModuleType) {
    currentModule.set(id);
  }

  function toggleSidebar() {
    sidebarCollapsed.update(v => !v);
  }
</script>

<aside class="sidebar" class:collapsed={$sidebarCollapsed}>
  <!-- Logo section -->
  <div class="sidebar-header">
    {#if !$sidebarCollapsed}
      <GeoBrainLogo size={42} showText={true} />
    {:else}
      <GeoBrainLogo size={36} showText={false} />
    {/if}
  </div>

  <!-- Decorative line -->
  <div class="header-divider">
    <div class="divider-line"></div>
    <div class="divider-glow"></div>
  </div>

  <!-- Navigation -->
  <nav class="sidebar-nav">
    {#each modules as module}
      <button
        class="nav-item"
        class:active={$currentModule === module.id}
        onclick={() => selectModule(module.id)}
        title={$sidebarCollapsed ? module.label : ''}
      >
        <div class="nav-icon-wrapper">
          <span class="nav-icon">{module.icon}</span>
        </div>
        {#if !$sidebarCollapsed}
          <div class="nav-content">
            <span class="nav-label">{module.label}</span>
            <span class="nav-description">{module.description}</span>
          </div>
        {/if}
        {#if $currentModule === module.id}
          <div class="active-indicator"></div>
        {/if}
      </button>
    {/each}
  </nav>

  <!-- Footer with Bussigny branding -->
  <div class="sidebar-footer">
    {#if !$sidebarCollapsed}
      <div class="bussigny-brand">
        <img
          src="/images/logo_bussigny_neg.png"
          alt="Commune de Bussigny"
          class="bussigny-logo-img"
        />
      </div>
    {:else}
      <div class="bussigny-brand-collapsed">
        <img
          src="/images/logo_bussigny_neg.png"
          alt="Bussigny"
          class="bussigny-logo-small"
        />
      </div>
    {/if}

    <button class="toggle-btn" onclick={toggleSidebar} title={$sidebarCollapsed ? 'Ouvrir le menu' : 'Reduire le menu'}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        {#if $sidebarCollapsed}
          <path d="M6 3l5 5-5 5V3z"/>
        {:else}
          <path d="M10 3L5 8l5 5V3z"/>
        {/if}
      </svg>
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    height: 100vh;
    background: linear-gradient(180deg, #1a2634 0%, #2c3e50 50%, #1a2634 100%);
    display: flex;
    flex-direction: column;
    transition: width var(--transition-normal);
    overflow: hidden;
    position: relative;
    box-shadow: 4px 0 20px rgba(0,0,0,0.3);
  }

  .sidebar::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 200px;
    background: linear-gradient(180deg, rgba(54, 96, 146, 0.15) 0%, transparent 100%);
    pointer-events: none;
  }

  .sidebar.collapsed {
    width: var(--sidebar-collapsed-width);
  }

  .sidebar-header {
    padding: 20px;
    min-height: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
  }

  .header-divider {
    position: relative;
    height: 2px;
    margin: 0 16px 8px;
  }

  .divider-line {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  }

  .divider-glow {
    position: absolute;
    top: -2px;
    left: 20%;
    right: 20%;
    height: 4px;
    background: linear-gradient(90deg, transparent, var(--bleu-bussigny), transparent);
    filter: blur(3px);
    opacity: 0.6;
  }

  .sidebar-nav {
    flex: 1;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
    z-index: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.6);
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
    position: relative;
    overflow: hidden;
  }

  .sidebar.collapsed .nav-item {
    justify-content: center;
    padding: 14px 12px;
  }

  .nav-item::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .nav-item:hover {
    color: white;
    background: rgba(255,255,255,0.05);
  }

  .nav-item:hover::before {
    opacity: 1;
  }

  .nav-item.active {
    color: white;
    background: linear-gradient(135deg, var(--bleu-bussigny) 0%, var(--bleu-bussigny-dark) 100%);
    box-shadow: 0 4px 15px rgba(54, 96, 146, 0.4);
  }

  .nav-icon-wrapper {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all var(--transition-fast);
  }

  .nav-item.active .nav-icon-wrapper {
    background: rgba(255,255,255,0.2);
  }

  .nav-icon {
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-mono);
  }

  .nav-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .nav-label {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
  }

  .nav-description {
    font-size: 11px;
    opacity: 0.6;
    white-space: nowrap;
  }

  .active-indicator {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 24px;
    background: white;
    border-radius: 3px 0 0 3px;
    box-shadow: 0 0 10px rgba(255,255,255,0.5);
  }

  .sidebar.collapsed .active-indicator {
    display: none;
  }

  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid rgba(255,255,255,0.1);
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: relative;
    z-index: 1;
  }

  .bussigny-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
  }

  .bussigny-logo-img {
    max-width: 100%;
    height: auto;
    max-height: 50px;
    object-fit: contain;
    opacity: 0.9;
    transition: opacity var(--transition-fast);
  }

  .bussigny-logo-img:hover {
    opacity: 1;
  }

  .bussigny-brand-collapsed {
    display: flex;
    justify-content: center;
    padding: 8px;
  }

  .bussigny-logo-small {
    width: 32px;
    height: 32px;
    object-fit: contain;
    opacity: 0.8;
  }

  .toggle-btn {
    width: 100%;
    padding: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.6);
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-btn:hover {
    background: rgba(255,255,255,0.1);
    color: white;
    border-color: rgba(255,255,255,0.2);
  }
</style>
