<script lang="ts">
  import { currentModule, sidebarCollapsed, visibleModules, appMode, type ModuleType } from '$lib/stores/app';
  import ThemeToggle from './ThemeToggle.svelte';

  // Définition complète de tous les modules
  const allModules: { id: ModuleType; label: string; description: string }[] = [
    { id: 'chat', label: 'Assistant', description: 'Chat IA' },
    { id: 'canvas', label: 'Cartes', description: 'Visualisation' },
    { id: 'editor', label: 'Editeur', description: 'SQL & Python' },
    { id: 'data', label: 'Donnees', description: 'PostgreSQL' },
    { id: 'carto', label: 'Cartographie', description: 'WMS/WFS' },
    { id: 'ssh', label: 'Terminal', description: 'SSH & SFTP' },
    { id: 'comm', label: 'Comms', description: 'Outlook & 3CX' },
    { id: 'ai', label: 'Multi-IA', description: 'Providers' },
    { id: 'docgen', label: 'Documents', description: 'Generation PDF' },
    { id: 'connections', label: 'Connexions', description: 'Serveurs' },
    { id: 'settings', label: 'Parametres', description: 'Configuration' },
  ];

  // Modules filtrés selon le mode (standard/expert)
  $effect(() => {
    // Si le module actuel n'est plus visible, revenir à 'chat'
    if (!$visibleModules.includes($currentModule)) {
      currentModule.set('chat');
    }
  });

  // Modules à afficher (filtrés selon visibleModules)
  let displayedModules = $derived(
    allModules.filter(m => $visibleModules.includes(m.id))
  );

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
    <a href="/" class="logo-link">
      {#if $appMode === 'bfsa'}
        <img
          src="/images/logo_bfsa.png"
          alt="GeoBFSA"
          class="logo-img bfsa-logo"
          class:collapsed={$sidebarCollapsed}
        />
        {#if !$sidebarCollapsed}
          <span class="logo-subtitle bfsa-title">GEOBFSA</span>
        {/if}
      {:else}
        <img
          src="/images/Logo_GeoMind_nosubtitle.png"
          alt="GeoMind"
          class="logo-img"
          class:collapsed={$sidebarCollapsed}
        />
        {#if !$sidebarCollapsed}
          <span class="logo-subtitle">Spatial Intelligence</span>
        {/if}
      {/if}
    </a>
  </div>

  <!-- Decorative line -->
  <div class="header-divider">
    <div class="divider-line"></div>
    <div class="divider-glow"></div>
  </div>

  <!-- Navigation -->
  <nav class="sidebar-nav">
    {#each displayedModules as module}
      <button
        class="nav-item"
        class:active={$currentModule === module.id}
        onclick={() => selectModule(module.id)}
        title={$sidebarCollapsed ? module.label : ''}
      >
        <div class="nav-icon-wrapper">
          <!-- Assistant / Chat -->
          {#if module.id === 'chat'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Cerveau stylisé avec circuit -->
              <path d="M12 4C8 4 5 7 5 11c0 2 1 4 2 5l-1 4 4-2c1 0 2 0 2 0 4 0 7-3 7-7s-3-7-7-7z" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="9" cy="10" r="1" fill="currentColor"/>
              <circle cx="15" cy="10" r="1" fill="currentColor"/>
              <path d="M9 14c1.5 1.5 4.5 1.5 6 0" stroke-linecap="round"/>
            </svg>
          <!-- Cartes / Canvas -->
          {:else if module.id === 'canvas'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Globe avec grille -->
              <circle cx="12" cy="12" r="9"/>
              <ellipse cx="12" cy="12" rx="9" ry="4"/>
              <line x1="12" y1="3" x2="12" y2="21"/>
              <path d="M3.5 9h17M3.5 15h17"/>
              <circle cx="16" cy="7" r="2" fill="currentColor" stroke="none"/>
            </svg>
          <!-- Editeur -->
          {:else if module.id === 'editor'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Terminal/Code -->
              <rect x="3" y="4" width="18" height="16" rx="2"/>
              <path d="M7 9l3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="13" y1="15" x2="17" y2="15" stroke-linecap="round"/>
            </svg>
          <!-- Documents / DocGen -->
          {:else if module.id === 'docgen'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Document avec lignes -->
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="14" y2="17"/>
            </svg>
          <!-- Data / PostgreSQL -->
          {:else if module.id === 'data'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 5v6c0 1.66-4 3-9 3s-9-1.34-9-3V5"/>
              <path d="M21 11v6c0 1.66-4 3-9 3s-9-1.34-9-3v-6"/>
            </svg>
          <!-- Carto / WMS -->
          {:else if module.id === 'carto'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M9 21V9"/>
              <circle cx="15" cy="15" r="2" fill="currentColor"/>
            </svg>
          <!-- SSH / Terminal -->
          {:else if module.id === 'ssh'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M6 8l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="16" x2="18" y2="16" stroke-linecap="round"/>
            </svg>
          <!-- Communications -->
          {:else if module.id === 'comm'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
          <!-- AI / Multi-IA -->
          {:else if module.id === 'ai'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
              <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          <!-- Connexions -->
          {:else if module.id === 'connections'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Serveur avec connexion -->
              <rect x="2" y="2" width="20" height="8" rx="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2"/>
              <circle cx="6" cy="6" r="1" fill="currentColor"/>
              <circle cx="6" cy="18" r="1" fill="currentColor"/>
              <line x1="12" y1="10" x2="12" y2="14"/>
            </svg>
          <!-- Parametres / Settings -->
          {:else if module.id === 'settings'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Engrenage -->
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          {/if}
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

  <!-- Footer -->
  <div class="sidebar-footer">
    <div class="footer-actions">
      <ThemeToggle />
      {#if $appMode === 'god' && !$sidebarCollapsed}
        <span class="mode-badge god">GOD</span>
      {:else if $appMode === 'bfsa' && !$sidebarCollapsed}
        <span class="mode-badge bfsa">BFSA</span>
      {:else if $appMode === 'expert' && !$sidebarCollapsed}
        <span class="mode-badge expert">EXPERT</span>
      {/if}
    </div>
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
    background: var(--noir-surface);
    display: flex;
    flex-direction: column;
    transition: width var(--transition-normal);
    overflow: hidden;
    position: relative;
    border-right: 1px solid var(--border-color);
  }

  /* Effet scanline subtil */
  .sidebar::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 255, 136, 0.01) 2px,
      rgba(0, 255, 136, 0.01) 4px
    );
    pointer-events: none;
    z-index: 0;
  }

  /* Lueur verte en haut */
  .sidebar::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 150px;
    background: linear-gradient(180deg, var(--cyber-green-glow) 0%, transparent 100%);
    opacity: 0.15;
    pointer-events: none;
    z-index: 0;
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

  .logo-link {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    text-decoration: none;
  }

  .logo-img {
    width: 180px;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 0 10px var(--cyber-green-glow));
    transition: all var(--transition-fast);
    margin-left: -40px;
  }

  .logo-img.collapsed {
    width: 48px;
  }

  .logo-img:hover {
    filter: drop-shadow(0 0 20px var(--cyber-green-glow));
  }

  .logo-subtitle {
    font-size: 8px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-top: 4px;
    margin-left: 10px;
    white-space: nowrap;
  }

  /* Style spécifique BFSA */
  .logo-img.bfsa-logo {
    width: 80px;
    filter: drop-shadow(0 2px 8px rgba(227, 6, 19, 0.3));
  }

  .logo-img.bfsa-logo.collapsed {
    width: 32px;
  }

  .logo-img.bfsa-logo:hover {
    filter: drop-shadow(0 2px 12px rgba(227, 6, 19, 0.5));
  }

  .logo-subtitle.bfsa-title {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 3px;
    color: var(--bfsa-red, #e30613);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
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
    background: linear-gradient(90deg, transparent, var(--border-color), transparent);
  }

  .divider-glow {
    position: absolute;
    top: -2px;
    left: 20%;
    right: 20%;
    height: 4px;
    background: linear-gradient(90deg, transparent, var(--cyber-green), transparent);
    filter: blur(4px);
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
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    border-radius: 8px;
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

  .nav-item:hover {
    color: var(--text-bright);
    background: var(--bg-hover);
    border-color: var(--border-color);
  }

  .nav-item:hover .nav-icon-wrapper {
    border-color: var(--cyber-green);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  .nav-item:hover .nav-icon-svg {
    color: var(--cyber-green);
  }

  .nav-item.active {
    color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.08);
    border-color: var(--cyber-green);
    box-shadow: 0 0 20px var(--cyber-green-glow), inset 0 0 20px rgba(0, 255, 136, 0.05);
  }

  .nav-icon-wrapper {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all var(--transition-fast);
  }

  .nav-item.active .nav-icon-wrapper {
    background: var(--cyber-green);
    border-color: var(--cyber-green);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .nav-icon-svg {
    width: 20px;
    height: 20px;
    color: var(--text-secondary);
    transition: color var(--transition-fast);
  }

  .nav-item.active .nav-icon-svg {
    color: var(--noir-profond);
  }

  .nav-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .nav-label {
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-mono);
    letter-spacing: 0.5px;
    white-space: nowrap;
    color: var(--text-primary);
  }

  .nav-item.active .nav-label {
    color: var(--cyber-green);
  }

  .nav-description {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  .active-indicator {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 24px;
    background: var(--cyber-green);
    border-radius: 3px 0 0 3px;
    box-shadow: 0 0 10px var(--cyber-green-glow), 0 0 20px var(--cyber-green-glow);
  }

  .sidebar.collapsed .active-indicator {
    display: none;
  }

  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: relative;
    z-index: 1;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .mode-badge {
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .mode-badge.expert {
    background: var(--primary-glow);
    color: var(--primary);
    border: 1px solid var(--primary);
    animation: pulse-badge-expert 2s infinite;
  }

  .mode-badge.god {
    background: linear-gradient(135deg, #00FFFF, #FF00FF);
    color: black;
    font-weight: bold;
    border: 1px solid #FF00FF;
    animation: pulse-badge-god 1.5s infinite;
    text-shadow: none;
  }

  .mode-badge.bfsa {
    background: linear-gradient(135deg, #e30613, #1863DC);
    color: white;
    font-weight: bold;
    border: 1px solid #e30613;
    animation: pulse-badge-bfsa 2s infinite;
    text-shadow: none;
  }

  @keyframes pulse-badge-expert {
    0%, 100% { box-shadow: 0 0 0 0 var(--primary-glow); }
    50% { box-shadow: 0 0 10px var(--primary-glow); }
  }

  @keyframes pulse-badge-god {
    0%, 100% {
      box-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
      filter: hue-rotate(0deg);
    }
    33% {
      box-shadow: 0 0 15px rgba(255, 0, 255, 0.7), 0 0 25px rgba(0, 255, 255, 0.4);
      filter: hue-rotate(30deg);
    }
    66% {
      box-shadow: 0 0 10px rgba(255, 255, 0, 0.6), 0 0 20px rgba(255, 0, 255, 0.5);
      filter: hue-rotate(-30deg);
    }
  }

  @keyframes pulse-badge-bfsa {
    0%, 100% {
      box-shadow: 0 0 5px rgba(227, 6, 19, 0.4);
    }
    50% {
      box-shadow: 0 0 12px rgba(227, 6, 19, 0.6), 0 0 20px rgba(24, 99, 220, 0.3);
    }
  }

  .toggle-btn {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border-color);
    background: var(--noir-card);
    color: var(--text-secondary);
    border-radius: 6px;
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
  }

  .toggle-btn:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }
</style>
