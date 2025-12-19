<script lang="ts">
  import { currentModule, sidebarCollapsed, visibleModules, appMode, moduleOrder, type ModuleType } from '$lib/stores/app';
  import { carloMode, isCarloModeActive, getRandomEffect } from '$lib/stores/carloMode';
  import { CarloBrokenButton, CarloOverlay } from './Carlo';
  import ThemeToggle from './ThemeToggle.svelte';

  // Carlo mode state
  let showCarloOverlay = $state(false);
  let carloOverlayType: 'bsod' | 'loading' = $state('bsod');
  let pendingModuleId: ModuleType | null = $state(null);

  // Assignations FIXES des effets Carlo (plus d'aléatoire)
  // - settings: bouton carton avec image
  // - chat: "Mise en route prévue 14.08.2021"
  // - converter: "HORS SERVICE"
  // - canvas: "MàJ: 30.03.2001"
  // - wip: bouton qui oscille (punaise)
  // - databases, connexions: scotch
  const carloEffects = {
    cardboard: 'settings' as ModuleType,
    horsService: 'converter' as ModuleType,
    wobbly: 'wip' as ModuleType,
    taped: ['databases', 'connexions'] as ModuleType[],
    miseEnRoute: 'chat' as ModuleType,
    oldUpdate: 'canvas' as ModuleType,
  };

  // Définition complète de tous les modules
  const allModules: { id: ModuleType; label: string; description: string }[] = [
    { id: 'chat', label: 'Assistant', description: 'Chat IA' },
    { id: 'canvas', label: 'Cartes', description: 'Visualisation' },
    { id: 'qgls', label: 'QGlS', description: 'SKETCHY SKETCHING' },
    { id: 'cad', label: 'CAD', description: 'DXF/DWG Viewer' },
    { id: 'calage', label: 'Calage', description: 'Géoréférencement' },
    { id: 'editor', label: 'Editeur', description: 'SQL & Python' },
    { id: 'databases', label: 'Databases', description: 'Schema & ERD' },
    { id: 'stats', label: 'Stats', description: 'Statistiques' },
    { id: 'converter', label: 'Convertisseur', description: 'Formats fichiers' },
    { id: 'wakelock', label: 'Anti-veille', description: 'Empeche la veille' },
    { id: 'timepro', label: 'TimePro', description: 'Pointage' },
    { id: 'connexions', label: 'Connexions', description: 'VPN & Serveurs DB' },
    { id: 'comm', label: 'Communications', description: 'Outlook, Teams, 3CX' },
    { id: 'docgen', label: 'Documents', description: 'Generation PDF' },
    { id: 'intercapi', label: 'Intercapi', description: 'Dev. suspendu' },
    { id: 'settings', label: 'Parametres', description: 'Configuration' },
    { id: 'wip', label: 'WIP', description: 'En developpement' },
    { id: 'kdrive', label: 'kDrive', description: 'Partage fichiers' },
  ];

  // Mode d'édition pour réordonnancement
  let editMode = $state(false);
  let draggedIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);

  // Modules filtrés selon le mode (standard/expert)
  $effect(() => {
    // Si le module actuel n'est plus visible, revenir à 'chat'
    if (!$visibleModules.includes($currentModule)) {
      currentModule.set('chat');
    }
  });

  // Modules à afficher (utilise directement visibleModules qui est déjà ordonné)
  let displayedModules = $derived(
    $visibleModules.map(id => allModules.find(m => m.id === id)).filter(Boolean) as typeof allModules
  );

  function selectModule(id: ModuleType) {
    if (editMode) return;

    // En mode Carlo (BFSA), chance de BSOD ou loading
    if ($isCarloModeActive) {
      const effect = getRandomEffect($carloMode, true);
      if (effect !== 'none') {
        pendingModuleId = id;
        carloOverlayType = effect;
        showCarloOverlay = true;
        return;
      }
    }

    currentModule.set(id);
  }

  // Callback quand l'overlay Carlo est terminé
  function onCarloOverlayComplete() {
    showCarloOverlay = false;
    if (pendingModuleId) {
      currentModule.set(pendingModuleId);
      pendingModuleId = null;
    }
  }

  function toggleSidebar() {
    sidebarCollapsed.update(v => !v);
  }

  function toggleEditMode() {
    editMode = !editMode;
  }

  // Drag & Drop handlers
  function handleDragStart(e: DragEvent, index: number) {
    if (!editMode) return;
    draggedIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index.toString());
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    if (!editMode || draggedIndex === null) return;
    e.preventDefault();
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  function handleDrop(e: DragEvent, toIndex: number) {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      // Obtenir les modules dans l'ordre actuel de l'affichage
      const fromModule = displayedModules[draggedIndex];
      const toModule = displayedModules[toIndex];

      if (fromModule && toModule) {
        // Trouver les indices dans moduleOrder
        const currentOrder = $moduleOrder;
        const fromOrderIndex = currentOrder.indexOf(fromModule.id);
        const toOrderIndex = currentOrder.indexOf(toModule.id);

        if (fromOrderIndex !== -1 && toOrderIndex !== -1) {
          moduleOrder.reorder(fromOrderIndex, toOrderIndex);
        }
      }
    }
    draggedIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
    dragOverIndex = null;
  }

  // Move with buttons (for accessibility)
  function moveModule(moduleId: ModuleType, direction: 'up' | 'down') {
    moduleOrder.moveModule(moduleId, direction);
  }

  function resetOrder() {
    moduleOrder.reset();
  }
</script>

<aside class="sidebar" class:collapsed={$sidebarCollapsed}>
  <!-- Logo section -->
  <div class="sidebar-header">
    <a href="/" class="logo-link">
      {#if $appMode === 'bfsa'}
        <img
          src="/images/BFK.png"
          alt="GeoBFK"
          class="logo-img bfsa-logo"
          class:collapsed={$sidebarCollapsed}
        />
        {#if !$sidebarCollapsed}
          <span class="logo-subtitle bfsa-title">GEOBFK</span>
        {/if}
      {:else}
        <img
          src="/images/Logo_GeoMind.png"
          alt="GeoMind"
          class="logo-img"
          class:collapsed={$sidebarCollapsed}
        />
      {/if}
    </a>
  </div>

  <!-- Decorative line -->
  <div class="header-divider">
    <div class="divider-line"></div>
    <div class="divider-glow"></div>
  </div>

  <!-- Navigation -->
  <nav class="sidebar-nav" class:edit-mode={editMode}>
    {#if editMode && !$sidebarCollapsed}
      <div class="edit-mode-hint">
        <span>Utiliser ▲▼ pour reorganiser</span>
        <button class="reset-order-btn" onclick={resetOrder} title="Reinitialiser l'ordre">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>
      </div>
    {/if}
    {#each displayedModules as module, index}
      <div
        class="nav-item"
        class:active={$currentModule === module.id}
        class:dragging={draggedIndex === index}
        class:drag-over={dragOverIndex === index && draggedIndex !== index}
        class:edit-mode={editMode}
        class:carlo-mode={$isCarloModeActive}
        class:carlo-wobbly={$isCarloModeActive && module.id === carloEffects.wobbly}
        class:carlo-cardboard={$isCarloModeActive && module.id === carloEffects.cardboard}
        class:carlo-hors-service={$isCarloModeActive && module.id === carloEffects.horsService}
        class:carlo-taped={$isCarloModeActive && carloEffects.taped.includes(module.id)}
        onclick={() => selectModule(module.id)}
        onkeydown={(e) => e.key === 'Enter' && selectModule(module.id)}
        title={$sidebarCollapsed ? module.label : ''}
        draggable={editMode ? "true" : "false"}
        ondragstart={(e) => handleDragStart(e, index)}
        ondragover={(e) => handleDragOver(e, index)}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, index)}
        ondragend={handleDragEnd}
        role="button"
        tabindex="0"
      >
        <!-- Clous SVG en mode Carlo (pas sur le bouton oscillant ou scotché) -->
        {#if $isCarloModeActive && !carloEffects.taped.includes(module.id) && module.id !== carloEffects.wobbly}
          <!-- Nombre et position des clous varient selon le module -->
          {@const nailConfig = {
            'chat': ['tl', 'tr', 'bl'],
            'canvas': ['tl', 'mr', 'br'],
            'cad': ['tl', 'tr', 'bl', 'br'],
            'calage': ['tl', 'tr', 'bl', 'br'],
            'editor': ['tl', 'tr'],
            'databases': ['ml', 'tr', 'br'],
            'converter': ['tl', 'tr', 'bl', 'br', 'ml'],
            'wakelock': ['tl', 'br'],
            'timepro': ['tr', 'bl', 'mr'],
            'connexions': ['tl', 'tr', 'br'],
            'docgen': ['tl', 'ml', 'bl'],
            'comm': ['tr', 'bl', 'br'],
            'settings': ['tl', 'tr', 'bl', 'br'],
            'kdrive': ['ml', 'mr', 'bl'],
            'intercapi': ['tl', 'tr', 'bl'],
            'wip': ['tl', 'br'],
          }[module.id] || ['tl', 'tr']}
          {#each nailConfig as pos}
            <svg class="carlo-nail nail-{pos}" viewBox="0 0 20 30" width="10" height="15">
              <ellipse cx="10" cy="6" rx="8" ry="5" fill="#9CA3AF"/>
              <ellipse cx="10" cy="5" rx="6" ry="3" fill="#D1D5DB"/>
              <rect x="8" y="8" width="4" height="20" fill="#6B7280"/>
              <rect x="9" y="8" width="1" height="20" fill="#9CA3AF"/>
            </svg>
          {/each}
        {/if}

        <!-- Scotch en mode Carlo (plusieurs morceaux selon le module) -->
        {#if $isCarloModeActive && carloEffects.taped.includes(module.id)}
          {@const tapeCount = module.id === 'databases' ? 3 : 4}
          <div class="carlo-tape carlo-tape-1"></div>
          <div class="carlo-tape carlo-tape-2"></div>
          {#if tapeCount >= 3}
            <div class="carlo-tape carlo-tape-3"></div>
          {/if}
          {#if tapeCount >= 4}
            <div class="carlo-tape carlo-tape-4"></div>
          {/if}
        {/if}

        <!-- Punaise en mode Carlo pour le bouton oscillant -->
        {#if $isCarloModeActive && module.id === carloEffects.wobbly}
          <div class="carlo-string"></div>
        {/if}

        <!-- Etiquette HORS SERVICE (Convertisseur) -->
        {#if $isCarloModeActive && module.id === carloEffects.horsService}
          <div class="carlo-hors-service-label">
            <span>HORS</span>
            <span>SERVICE</span>
          </div>
        {/if}

        <!-- Overlay carton pour bouton Paramètres avec image (semi-transparent pour voir dessous) -->
        {#if $isCarloModeActive && module.id === carloEffects.cardboard}
          <div class="carlo-cardboard-overlay">
            <img src="/images/carlo/parametres.png" alt="Paramètres" class="cardboard-image" />
          </div>
          <!-- Épingle centrée en haut du carton -->
          <div class="carlo-cardboard-pin"></div>
          <!-- Clous pour tenir le carton -->
          <svg class="carlo-nail nail-tl cardboard-nail" viewBox="0 0 20 30" width="10" height="15">
            <ellipse cx="10" cy="6" rx="8" ry="5" fill="#9CA3AF"/>
            <ellipse cx="10" cy="5" rx="6" ry="3" fill="#D1D5DB"/>
            <rect x="8" y="8" width="4" height="20" fill="#6B7280"/>
          </svg>
          <svg class="carlo-nail nail-br cardboard-nail" viewBox="0 0 20 30" width="10" height="15">
            <ellipse cx="10" cy="6" rx="8" ry="5" fill="#9CA3AF"/>
            <ellipse cx="10" cy="5" rx="6" ry="3" fill="#D1D5DB"/>
            <rect x="8" y="8" width="4" height="20" fill="#6B7280"/>
          </svg>
        {/if}

        <!-- Eléments vintage/obsolètes -->
        {#if $isCarloModeActive}
          <!-- Taches de rouille près des clous (pas sur les boutons spéciaux) -->
          {#if !carloEffects.taped.includes(module.id) && module.id !== carloEffects.cardboard && module.id !== carloEffects.wobbly && module.id !== carloEffects.horsService}
            <div class="carlo-rust rust-tl"></div>
            <div class="carlo-rust rust-tr"></div>
          {/if}

          <!-- Assistant: "Mise en route prévue 14.08.2021" -->
          {#if module.id === carloEffects.miseEnRoute && !$sidebarCollapsed}
            <div class="carlo-mise-en-route">Mise en route prévue 14.08.2021</div>
          {/if}

          <!-- Cartes: "MàJ: 23.07.1989" -->
          {#if module.id === carloEffects.oldUpdate && !$sidebarCollapsed}
            <div class="carlo-update-date">MàJ: 23.07.1989</div>
          {/if}

          <!-- Toile d'araignée sur TimePro (rarement utilisé) -->
          {#if module.id === 'timepro'}
            <div class="carlo-cobweb"></div>
          {/if}

          <!-- Tache de café sur Documents -->
          {#if module.id === 'docgen'}
            <div class="carlo-coffee-stain"></div>
          {/if}
        {/if}

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
          <!-- QGlS / sketching GIS -->
          {:else if module.id === 'qgls'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Sketching: couches + crayon -->
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
              <!-- Crayon diagonal -->
              <path d="M16 3l5 5-8 8-5 0 0-5 8-8z" fill="currentColor" stroke="none" opacity="0.3"/>
              <path d="M16 3l5 5-8 8-5 0 0-5 8-8z"/>
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
          <!-- Databases / Schema & ERD -->
          {:else if module.id === 'databases'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 5v6c0 1.66-4 3-9 3s-9-1.34-9-3V5"/>
              <path d="M21 11v6c0 1.66-4 3-9 3s-9-1.34-9-3v-6"/>
            </svg>
          <!-- Stats -->
          {:else if module.id === 'stats'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 20V10M12 20V4M6 20v-6"/>
            </svg>
          <!-- TimePro -->
          {:else if module.id === 'timepro'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Horloge avec badge play -->
              <circle cx="12" cy="12" r="9"/>
              <polyline points="12 6 12 12 16 14"/>
              <circle cx="18" cy="18" r="4" fill="currentColor" stroke="none"/>
              <path d="M17 17l2 1-2 1z" fill="var(--noir-profond)" stroke="none"/>
            </svg>
          <!-- Connexions (VPN + Communications) -->
          {:else if module.id === 'connexions'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Bouclier VPN avec signal -->
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M8.5 12.5c1-1 2.5-1.5 3.5-1.5s2.5.5 3.5 1.5"/>
              <path d="M10 14c.5-.5 1.25-.75 2-.75s1.5.25 2 .75"/>
              <circle cx="12" cy="16" r="1" fill="currentColor"/>
            </svg>
          <!-- Communications (Outlook, Teams, 3CX) -->
          {:else if module.id === 'comm'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Bulle de communication avec signaux -->
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="8" cy="12" r="1" fill="currentColor"/>
              <circle cx="16" cy="12" r="1" fill="currentColor"/>
            </svg>
          <!-- Parametres / Settings -->
          {:else if module.id === 'settings'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Engrenage classique -->
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          <!-- WIP / En developpement -->
          {:else if module.id === 'wip'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Panneau travaux -->
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
              <circle cx="12" cy="12" r="2" fill="currentColor" class="wip-dot"/>
            </svg>
          <!-- CAD / DXF Viewer -->
          {:else if module.id === 'cad'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Equerre/Compas CAD -->
              <path d="M2 20l7-7"/>
              <path d="M20 4l-7 7"/>
              <path d="M7 2v5h5"/>
              <path d="M17 22v-5h-5"/>
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 9v-2M12 17v-2"/>
            </svg>
          <!-- Convertisseur -->
          {:else if module.id === 'converter'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Flèches de conversion -->
              <path d="M4 7h12l-3-3M4 7l3 3"/>
              <path d="M20 17H8l3 3M20 17l-3-3"/>
              <rect x="2" y="10" width="6" height="4" rx="1"/>
              <rect x="16" y="10" width="6" height="4" rx="1"/>
            </svg>
          <!-- Anti-veille / WakeLock -->
          {:else if module.id === 'wakelock'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Soleil / écran allumé -->
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          <!-- kDrive / Cloud -->
          {:else if module.id === 'kdrive'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Nuage -->
              <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
            </svg>
          <!-- Intercapi / Registre Foncier -->
          {:else if module.id === 'intercapi'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Bâtiment avec colonnes (registre foncier) -->
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
            </svg>
          <!-- Calage / Géoréférencement -->
          {:else if module.id === 'calage'}
            <svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <!-- Cible avec croix de géoréférencement -->
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
            </svg>
          {/if}
        </div>
        {#if !$sidebarCollapsed}
          <div class="nav-content">
            <span class="nav-label">{module.label}</span>
            <span class="nav-description">{module.description}</span>
            {#if module.id === 'intercapi'}
              <span class="suspended-badge">Suspendu</span>
            {/if}
          </div>
        {/if}
        {#if $currentModule === module.id && !editMode}
          <div class="active-indicator"></div>
        {/if}
        <!-- Boutons de réordonnancement en mode édition -->
        {#if editMode}
          <div class="reorder-buttons">
            <button
              class="reorder-btn"
              onclick={(e) => { e.stopPropagation(); moveModule(module.id, 'up'); }}
              disabled={index === 0}
              title="Monter"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
            <button
              class="reorder-btn"
              onclick={(e) => { e.stopPropagation(); moveModule(module.id, 'down'); }}
              disabled={index === displayedModules.length - 1}
              title="Descendre"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </nav>

  <!-- Footer -->
  <div class="sidebar-footer">
    <div class="footer-controls">
      <ThemeToggle />

      {#if !$sidebarCollapsed}
        {#if $appMode === 'god'}
          <span class="mode-badge god">GOD</span>
        {:else if $appMode === 'bfsa'}
          <span class="mode-badge bfsa">BFK</span>
        {:else if $appMode === 'expert'}
          <span class="mode-badge expert">EXP</span>
        {/if}
      {/if}

      <button
        class="footer-btn order-btn"
        class:active={editMode}
        onclick={toggleEditMode}
        title={editMode ? 'Terminer le reordonnancement' : 'Reorganiser les modules'}
      >
        {#if editMode}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="4" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="18" x2="20" y2="18"/>
          </svg>
        {/if}
      </button>

      <button
        class="footer-btn collapse-btn"
        onclick={toggleSidebar}
        title={$sidebarCollapsed ? 'Ouvrir le menu' : 'Reduire le menu'}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          {#if $sidebarCollapsed}
            <path d="M6 3l5 5-5 5V3z"/>
          {:else}
            <path d="M10 3L5 8l5 5V3z"/>
          {/if}
        </svg>
      </button>
    </div>
  </div>
</aside>

<!-- Carlo Overlay (BSOD / Loading) -->
{#if showCarloOverlay}
  <CarloOverlay
    type={carloOverlayType}
    duration={carloOverlayType === 'bsod' ? 10000 : 15000}
    onComplete={onCarloOverlayComplete}
  />
{/if}

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
    padding: 20px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  .logo-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-decoration: none;
  }

  .logo-img {
    width: 240px;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 0 10px var(--cyber-green-glow));
    transition: all var(--transition-fast);
  }

  .logo-img.collapsed {
    width: 50px;
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
    width: 160px;
    filter: drop-shadow(0 2px 8px rgba(227, 6, 19, 0.3));
  }

  .logo-img.bfsa-logo.collapsed {
    width: 64px;
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
    margin: 0 16px 4px;
    flex-shrink: 0;
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
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0; /* Important pour que flex + overflow fonctionne */
  }

  /* Scrollbar personnalisée */
  .sidebar-nav::-webkit-scrollbar {
    width: 4px;
  }

  .sidebar-nav::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar-nav::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 2px;
  }

  .sidebar-nav::-webkit-scrollbar-thumb:hover {
    background: var(--cyber-green);
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
    user-select: none;
    -webkit-user-select: none;
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

  .suspended-badge {
    position: absolute;
    top: 4px;
    right: 8px;
    font-size: 8px;
    padding: 2px 6px;
    background: linear-gradient(135deg, #ff6b35, #f7931e);
    color: white;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
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
    padding: 12px;
    border-top: 1px solid var(--border-color);
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  .footer-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .sidebar.collapsed .footer-controls {
    flex-direction: column;
    gap: 8px;
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

  /* Footer buttons */
  .footer-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-color);
    background: var(--noir-card);
    color: var(--text-secondary);
    border-radius: 6px;
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .footer-btn:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
    border-color: var(--cyber-green);
    box-shadow: 0 0 8px var(--cyber-green-glow);
  }

  .footer-btn.active {
    color: var(--cyber-green);
    border-color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.15);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  /* Edit mode hint */
  .edit-mode-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    margin-bottom: 8px;
    background: rgba(0, 255, 136, 0.08);
    border: 1px solid var(--cyber-green);
    border-radius: 6px;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--cyber-green);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .reset-order-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--cyber-green);
    background: transparent;
    color: var(--cyber-green);
    border-radius: 4px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .reset-order-btn:hover {
    color: var(--warning);
    border-color: var(--warning);
    background: rgba(255, 165, 0, 0.15);
  }

  /* Drag & drop styles */
  .nav-item.edit-mode {
    cursor: default;
    border: 1px dashed var(--border-color);
    padding-right: 50px;
  }

  /* Boutons de réordonnancement */
  .reorder-buttons {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .reorder-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
    padding: 0;
  }

  .reorder-btn:hover:not(:disabled) {
    background: var(--cyber-green);
    border-color: var(--cyber-green);
    color: #000;
  }

  .reorder-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .reorder-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .sidebar.collapsed .reorder-buttons {
    display: none;
  }

  .nav-item.dragging {
    opacity: 0.5;
    border: 1px dashed var(--cyber-green);
    background: rgba(0, 255, 136, 0.1);
  }

  .nav-item.drag-over {
    border: 2px solid var(--cyber-green);
    background: rgba(0, 255, 136, 0.15);
    transform: scale(1.02);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  /* === CARLO MODE (BFSA) STYLES === */
  .nav-item.carlo-mode {
    position: relative;
    transform: rotate(var(--carlo-rotation, 0deg));
    transition: transform 0.3s ease;
    overflow: visible;
  }

  /* Texture papier/carton usé */
  .nav-item.carlo-mode::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      radial-gradient(circle at 20% 80%, rgba(139, 90, 43, 0.08) 0%, transparent 40%),
      radial-gradient(circle at 80% 20%, rgba(100, 70, 30, 0.06) 0%, transparent 30%),
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.02) 2px,
        rgba(0,0,0,0.02) 4px
      );
    pointer-events: none;
    border-radius: 8px;
    z-index: 1;
  }

  /* Rotation aleatoire pour chaque bouton */
  .nav-item.carlo-mode:nth-child(odd) { --carlo-rotation: 1.8deg; }
  .nav-item.carlo-mode:nth-child(even) { --carlo-rotation: -1.2deg; }
  .nav-item.carlo-mode:nth-child(3n) { --carlo-rotation: 2.5deg; }
  .nav-item.carlo-mode:nth-child(4n) { --carlo-rotation: -2deg; }
  .nav-item.carlo-mode:nth-child(5n) { --carlo-rotation: 0.8deg; }

  /* ===== CLOUS SVG ===== */
  .carlo-nail {
    position: absolute;
    z-index: 20;
    pointer-events: none;
    filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.5));
  }

  /* Positions coins - TOUJOURS À L'INTÉRIEUR du bouton */
  .carlo-nail.nail-tl {
    top: 2px;
    left: 6px;
    transform: rotate(-12deg);
  }

  .carlo-nail.nail-tr {
    top: 2px;
    right: 6px;
    transform: rotate(15deg);
  }

  .carlo-nail.nail-bl {
    bottom: 2px;
    left: 8px;
    transform: rotate(-8deg);
  }

  .carlo-nail.nail-br {
    bottom: 2px;
    right: 8px;
    transform: rotate(10deg);
  }

  /* Positions milieux - TOUJOURS À L'INTÉRIEUR */
  .carlo-nail.nail-ml {
    top: 50%;
    left: 4px;
    transform: translateY(-50%) rotate(-5deg);
  }

  .carlo-nail.nail-mr {
    top: 50%;
    right: 4px;
    transform: translateY(-50%) rotate(8deg);
  }

  /* Clous sur le carton - DOIVENT être AU-DESSUS de l'image PNG */
  .carlo-nail.cardboard-nail {
    z-index: 50;
    /* Ombre plus prononcée pour montrer qu'ils sont par-dessus */
    filter: drop-shadow(2px 3px 3px rgba(0,0,0,0.6));
  }

  /* Épingle/punaise centrée en haut du carton - style réaliste */
  .carlo-cardboard-pin {
    position: absolute;
    top: -4px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 55;
    width: 12px;
    height: 12px;
    pointer-events: none;
  }

  /* Tête de la punaise - plastique mat */
  .carlo-cardboard-pin::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 12px;
    height: 12px;
    background: radial-gradient(circle at 40% 35%,
      #B33A3A 0%,
      #8B2020 60%,
      #5C1515 100%
    );
    border-radius: 50%;
    box-shadow:
      inset -1px -1px 2px rgba(0,0,0,0.4),
      inset 1px 1px 1px rgba(255,255,255,0.15),
      0 2px 3px rgba(0,0,0,0.4);
  }

  /* Petit reflet discret */
  .carlo-cardboard-pin::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 3px;
    width: 3px;
    height: 2px;
    background: rgba(255,255,255,0.25);
    border-radius: 50%;
  }

  /* ===== SCOTCH / TAPE ===== */
  .carlo-tape {
    position: absolute;
    z-index: 15;
    pointer-events: none;
    height: 22px;
    background: linear-gradient(180deg,
      rgba(255, 240, 200, 0.15) 0%,
      rgba(255, 235, 180, 0.75) 15%,
      rgba(255, 230, 170, 0.8) 50%,
      rgba(255, 235, 180, 0.75) 85%,
      rgba(255, 240, 200, 0.15) 100%
    );
    border-top: 1px solid rgba(200, 180, 140, 0.3);
    border-bottom: 1px solid rgba(200, 180, 140, 0.3);
  }

  .carlo-tape-1 {
    top: 8px;
    left: -15px;
    right: -15px;
    transform: rotate(-3deg);
  }

  .carlo-tape-2 {
    bottom: 6px;
    left: -10px;
    right: -20px;
    transform: rotate(2deg);
    height: 18px;
  }

  .carlo-tape-3 {
    top: 50%;
    left: -12px;
    width: 30px;
    transform: translateY(-50%) rotate(85deg);
    height: 16px;
  }

  .carlo-tape-4 {
    top: 50%;
    right: -12px;
    width: 28px;
    transform: translateY(-50%) rotate(-80deg);
    height: 14px;
  }

  .nav-item.carlo-taped {
    border: 1px dashed rgba(150, 120, 80, 0.4) !important;
    background: rgba(200, 180, 140, 0.1) !important;
  }

  /* ===== PUNAISE CENTRALE ===== */
  .carlo-string {
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 25;
    width: 16px;
    height: 16px;
    pointer-events: none;
  }

  /* Tête de la punaise */
  .carlo-string::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 14px;
    height: 14px;
    background: radial-gradient(circle at 35% 35%,
      #E53935 0%,
      #C62828 40%,
      #B71C1C 70%,
      #8B0000 100%
    );
    border-radius: 50%;
    box-shadow:
      inset -2px -2px 4px rgba(0,0,0,0.4),
      inset 2px 2px 4px rgba(255,255,255,0.2),
      0 2px 4px rgba(0,0,0,0.5);
    border: 1px solid #7B0000;
  }

  /* Pointe de la punaise (ombre) */
  .carlo-string::after {
    content: '';
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 8px;
    background: linear-gradient(180deg, #666 0%, #333 100%);
    clip-path: polygon(50% 100%, 0% 0%, 100% 0%);
  }

  /* ===== BOUTON QUI OSCILLE (pendule réaliste) ===== */
  .nav-item.carlo-wobbly {
    transform-origin: top center;
    animation: carlo-pendulum 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  /* Mouvement pendulaire avec amortissement et perturbations */
  @keyframes carlo-pendulum {
    0% { transform: rotate(0deg); }
    /* Repos initial */
    5% { transform: rotate(-0.5deg); }
    /* Petite brise */
    10% { transform: rotate(1deg); }
    15% { transform: rotate(-0.3deg); }
    /* Rafale soudaine */
    20% { transform: rotate(-6deg); }
    24% { transform: rotate(4.5deg); }
    28% { transform: rotate(-3deg); }
    31% { transform: rotate(2deg); }
    34% { transform: rotate(-1.2deg); }
    37% { transform: rotate(0.7deg); }
    40% { transform: rotate(-0.3deg); }
    /* Calme */
    50% { transform: rotate(0.5deg); }
    55% { transform: rotate(-0.8deg); }
    /* Autre rafale */
    60% { transform: rotate(4deg); }
    64% { transform: rotate(-3deg); }
    68% { transform: rotate(2deg); }
    71% { transform: rotate(-1.3deg); }
    74% { transform: rotate(0.8deg); }
    /* Retour au calme */
    80% { transform: rotate(-0.5deg); }
    85% { transform: rotate(0.3deg); }
    90% { transform: rotate(-0.2deg); }
    95% { transform: rotate(0.1deg); }
    100% { transform: rotate(0deg); }
  }

  /* ===== BOUTON AVEC CARTON PAR-DESSUS ===== */
  /* Le bouton lui-même reste NORMAL - c'est l'image carton qui est par-dessus */

  /* Bout de carton collé PAR-DESSUS le bouton normal */
  .carlo-cardboard-overlay {
    position: absolute;
    /* Décalé et pas parfaitement aligné */
    top: -3px;
    left: 5px;
    right: -8px;
    bottom: 4px;
    z-index: 30;
    pointer-events: none;
    overflow: visible;
  }

  .cardboard-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 2px;
    /* Rotation différente du bouton - effet "collé à la va-vite" */
    transform: rotate(4deg);
    filter: drop-shadow(2px 3px 5px rgba(0,0,0,0.35));
  }

  /* Le bouton dessous reste NORMAL */
  .nav-item.carlo-cardboard {
    position: relative;
    /* Pas de transformation sur le bouton lui-même */
  }

  /* Le contenu du bouton reste visible et normal */
  .nav-item.carlo-cardboard .nav-icon-wrapper,
  .nav-item.carlo-cardboard .nav-content {
    /* Normal, pas de filtre - c'est le bouton "original" */
    opacity: 1;
  }

  /* ===== BOUTON HORS SERVICE ===== */
  .nav-item.carlo-hors-service {
    background: repeating-linear-gradient(
      45deg,
      rgba(255, 0, 0, 0.1),
      rgba(255, 0, 0, 0.1) 10px,
      rgba(0, 0, 0, 0.05) 10px,
      rgba(0, 0, 0, 0.05) 20px
    ) !important;
    border: 2px dashed #cc0000 !important;
    opacity: 0.7;
  }

  .carlo-hors-service-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-8deg);
    background: #cc0000;
    color: white;
    padding: 4px 12px;
    font-family: 'Impact', 'Arial Black', sans-serif;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
    z-index: 30;
    box-shadow: 2px 2px 4px rgba(0,0,0,0.4);
    border: 1px solid #990000;
  }

  .nav-item.carlo-hors-service .nav-icon-wrapper,
  .nav-item.carlo-hors-service .nav-content {
    filter: grayscale(100%) blur(1px);
    opacity: 0.3;
  }

  .nav-item.carlo-hors-service:hover {
    cursor: not-allowed;
  }

  /* ===== EFFETS GLOBAUX MODE CARLO ===== */
  .nav-item.carlo-mode:hover {
    filter: sepia(0.15) contrast(0.92) brightness(1.05);
  }

  /* Desactiver transitions en mode Carlo pour effet plus "cassé" */
  .nav-item.carlo-mode {
    transition: none !important;
  }

  .nav-item.carlo-mode:active {
    transform: rotate(var(--carlo-rotation, 0deg)) scale(0.98) !important;
  }

  /* ===== ELEMENTS VINTAGE/OBSOLETES ===== */

  /* Taches de rouille près des clous */
  .carlo-rust {
    position: absolute;
    width: 12px;
    height: 14px;
    pointer-events: none;
    z-index: 5;
    opacity: 0.6;
    background: radial-gradient(ellipse at center,
      rgba(139, 69, 19, 0.4) 0%,
      rgba(160, 82, 45, 0.3) 30%,
      rgba(165, 42, 42, 0.15) 60%,
      transparent 80%
    );
    filter: blur(0.5px);
  }

  .carlo-rust.rust-tl {
    top: 4px;
    left: 2px;
    transform: rotate(-10deg) scale(1.2);
  }

  .carlo-rust.rust-tr {
    top: 6px;
    right: 0px;
    transform: rotate(15deg) scale(0.9);
  }

  /* Autocollant "NOUVEAU!" fané et décollé */
  .carlo-sticker-new {
    position: absolute;
    top: -8px;
    right: -12px;
    background: linear-gradient(135deg,
      #FFEB3B 0%,
      #FDD835 40%,
      #F9A825 100%
    );
    color: #C62828;
    font-family: 'Impact', 'Arial Black', sans-serif;
    font-size: 8px;
    font-weight: bold;
    padding: 3px 8px;
    transform: rotate(18deg);
    z-index: 25;
    border-radius: 2px;
    box-shadow: 1px 2px 3px rgba(0,0,0,0.3);
    /* Effet fané/vieilli */
    filter: sepia(0.4) saturate(0.7) brightness(0.85);
    opacity: 0.75;
    /* Effet décollé */
    border-bottom: 2px solid rgba(200, 160, 60, 0.5);
  }

  /* Coin qui se décolle */
  .carlo-sticker-new::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 6px;
    height: 6px;
    background: linear-gradient(135deg,
      transparent 50%,
      rgba(255, 255, 255, 0.8) 50%
    );
    transform: rotate(0deg);
    border-radius: 0 2px 0 0;
  }

  /* Date de mise à jour antique - EN HAUT */
  .carlo-update-date {
    position: absolute;
    top: -10px;
    right: 8px;
    font-family: 'Courier New', monospace;
    font-size: 9px;
    font-weight: bold;
    color: #444;
    background: linear-gradient(180deg, #f5f5dc 0%, #e8e4c9 100%);
    padding: 3px 8px;
    border-radius: 2px;
    transform: rotate(2deg);
    z-index: 25;
    box-shadow: 1px 2px 4px rgba(0,0,0,0.25);
    border: 1px solid #ccc;
    white-space: nowrap;
    /* Effet encre fanée */
    filter: sepia(0.15);
  }

  /* Label "Mise en route prévue" pour Assistant - EN HAUT */
  .carlo-mise-en-route {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%) rotate(-2deg);
    font-family: 'Courier New', monospace;
    font-size: 8px;
    font-weight: bold;
    color: #5D4037;
    background: linear-gradient(180deg, #FFFDE7 0%, #FFF9C4 100%);
    padding: 4px 10px;
    border-radius: 3px;
    z-index: 25;
    box-shadow: 1px 2px 5px rgba(0,0,0,0.3);
    border: 1px solid #BCAAA4;
    white-space: nowrap;
    /* Effet post-it vieilli */
    filter: sepia(0.1) brightness(0.98);
  }

  /* Effet post-it décollé - coin en bas maintenant */
  .carlo-mise-en-route::before {
    content: '';
    position: absolute;
    bottom: 0;
    right: 0;
    width: 8px;
    height: 8px;
    background: linear-gradient(315deg, transparent 50%, rgba(0,0,0,0.1) 50%);
  }

  /* Toile d'araignée dans un coin */
  .carlo-cobweb {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 28px;
    height: 28px;
    pointer-events: none;
    z-index: 18;
    opacity: 0.35;
    /* Dessin toile simplifiée avec gradients */
    background:
      /* Fils radiaux */
      linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.6) 46%, rgba(255,255,255,0.6) 47%, transparent 48%),
      linear-gradient(115deg, transparent 45%, rgba(255,255,255,0.5) 46%, rgba(255,255,255,0.5) 47%, transparent 48%),
      linear-gradient(155deg, transparent 45%, rgba(255,255,255,0.4) 46%, rgba(255,255,255,0.4) 47%, transparent 48%),
      /* Arc concentrique */
      radial-gradient(circle at 100% 0%, transparent 60%, rgba(255,255,255,0.3) 61%, transparent 62%),
      radial-gradient(circle at 100% 0%, transparent 75%, rgba(255,255,255,0.25) 76%, transparent 77%);
    filter: blur(0.3px);
  }

  /* Tache de café */
  .carlo-coffee-stain {
    position: absolute;
    bottom: 2px;
    left: 8px;
    width: 22px;
    height: 18px;
    pointer-events: none;
    z-index: 8;
    opacity: 0.25;
    background: radial-gradient(ellipse at center,
      rgba(101, 67, 33, 0.15) 0%,
      rgba(101, 67, 33, 0.4) 40%,
      rgba(101, 67, 33, 0.2) 50%,
      rgba(139, 90, 43, 0.1) 70%,
      transparent 85%
    );
    border-radius: 50%;
    transform: rotate(-5deg) scaleX(1.3);
    filter: blur(0.8px);
  }

  /* Anneau de la tasse */
  .carlo-coffee-stain::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 16px;
    height: 13px;
    border: 2px solid rgba(101, 67, 33, 0.3);
    border-radius: 50%;
    background: transparent;
  }

</style>
