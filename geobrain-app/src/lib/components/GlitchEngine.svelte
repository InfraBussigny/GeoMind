<script lang="ts">
  import { onDestroy } from 'svelte';
  import { appMode } from '$lib/stores/app';

  // ============================================
  // CONFIGURATION - Effet néon qui clignote
  // ============================================
  const CONFIG = {
    // Phases de calme entre les GROSSES rafales (en ms)
    calmPhase: {
      min: 5000,   // 5 secondes minimum
      max: 30000,  // 30 secondes maximum
    },
    // Durée d'une GROSSE rafale de glitch
    burstPhase: {
      min: 500,    // 0.5s minimum
      max: 1500,   // 1.5s maximum
    },
    // Intervalle entre les glitchs pendant une rafale
    burstInterval: {
      min: 30,     // Très rapide pendant les rafales
      max: 120,    // Max 120ms entre deux effets
    },
    // Petits glitchs isolés pendant la phase calme
    smallGlitch: {
      interval: { min: 800, max: 2500 },  // Toutes les 0.8-2.5 secondes
      probability: 0.5,  // 50% de chance qu'il se produise
    },
    // Durée d'un effet glitch individuel
    effectDuration: {
      min: 100,
      max: 400,
    },
    // Probabilité de chaque effet pendant une GROSSE rafale
    effects: {
      chromatic: 0.35,      // Aberration chromatique CMY - FORT
      shiftX: 0.30,         // Décalage horizontal - FORT
      shiftY: 0.25,         // Décalage vertical
      flicker: 0.40,        // Clignotement - TRES FORT
      hue: 0.15,            // Rotation de teinte
      skew: 0.20,           // Inclinaison
      scale: 0.12,          // Changement d'échelle
      invert: 0.08,         // Inversion (plus rare)
      split: 0.10,          // Split screen
      characters: 0.45,     // Apparition de caractères - TRES FORT
      screenTear: 0.25,     // Déchirure d'écran
      wholePage: 0.15,      // Glitch de toute la page
    },
    // Probabilité des effets pour les PETITS glitchs isolés (plus subtil)
    smallEffects: {
      chromatic: 0.25,
      shiftX: 0.20,
      flicker: 0.35,
      characters: 0.30,
      screenTear: 0.15,
    },
    // Nombre d'éléments affectés par effet
    elementsPerEffect: {
      min: 1,
      max: 5,
    },
    // Caractères par spawn
    charactersPerSpawn: {
      min: 3,
      max: 10,
    }
  };

  // Caractères glitch
  const GLITCH_CHARS = [
    '!', '@', '#', '$', '%', '^', '&', '*', '?',
    '/', '\\', '|', '[', ']', '{', '}', '<', '>',
    '0', '1', '=', '+', '-', '_', '~',
    '\u2588', '\u2591', '\u2592', '\u2593', // Blocs
    '\u2580', '\u2584', '\u258C', '\u2590', // Demi-blocs
    '\u00A7', '\u00B6', '\u2020', '\u2021', // Spéciaux
    '\u25A0', '\u25B2', '\u25CF', '\u2605', // Formes
    '\u2666', '\u2663', '\u2660', '\u2665', // Cartes
  ];

  let isActive = $state(false);
  let isBursting = $state(false);
  let glitchOverlay = $state<HTMLDivElement | null>(null);
  let mainTimeout: ReturnType<typeof setTimeout> | null = null;
  let burstIntervalId: ReturnType<typeof setInterval> | null = null;
  let smallGlitchIntervalId: ReturnType<typeof setInterval> | null = null;
  let characterElements: HTMLDivElement[] = [];

  // Utilitaire: nombre aléatoire dans une plage
  function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  // Sélectionner des éléments aléatoires
  function getRandomElements(count: number): Element[] {
    const selectors = [
      '.nav-item', '.nav-label', '.nav-icon-wrapper',
      '.logo-subtitle', '.logo-img',
      '.chat-title', '.chat-header',
      '.message-content', '.message-bubble',
      'button', 'input', 'textarea',
      'h1', 'h2', 'h3',
      '.stat-value', '.stat-label',
      '.mode-badge',
      '.sidebar', '.main-content',
      '.status-bar', '.provider-selector',
    ];

    const allElements: Element[] = [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => allElements.push(el));
    });

    const shuffled = allElements.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // Appliquer un effet à un élément
  function applyEffect(element: Element, effectClass: string, duration: number) {
    element.classList.add(effectClass);
    setTimeout(() => element.classList.remove(effectClass), duration);
  }

  // Créer des caractères glitch flottants
  function spawnGlitchCharacters(count: number) {
    if (!glitchOverlay) return;

    for (let i = 0; i < count; i++) {
      const char = document.createElement('div');
      char.className = 'glitch-char';
      char.textContent = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];

      // Position aléatoire
      char.style.left = `${Math.random() * 100}%`;
      char.style.top = `${Math.random() * 100}%`;
      char.style.fontSize = `${14 + Math.random() * 28}px`;

      // Couleur CMY aléatoire avec intensité variable
      const colors = ['#00FFFF', '#FF00FF', '#FFFF00'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      char.style.color = color;
      char.style.textShadow = `0 0 ${5 + Math.random() * 15}px ${color}, 0 0 ${20 + Math.random() * 30}px ${color}`;

      // Animation de déplacement aléatoire
      const moveX = -30 + Math.random() * 60;
      const moveY = -30 + Math.random() * 60;
      char.style.setProperty('--move-x', `${moveX}px`);
      char.style.setProperty('--move-y', `${moveY}px`);

      glitchOverlay.appendChild(char);
      characterElements.push(char);

      // Durée de vie plus longue
      const lifetime = 150 + Math.random() * 350;
      setTimeout(() => {
        char.remove();
        characterElements = characterElements.filter(c => c !== char);
      }, lifetime);
    }
  }

  // Créer une déchirure d'écran
  function createScreenTear() {
    if (!glitchOverlay) return;

    const tear = document.createElement('div');
    tear.className = 'glitch-tear';

    const height = 3 + Math.random() * 12;
    const top = Math.random() * 100;
    const offsetX = -30 + Math.random() * 60;

    tear.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      top: ${top}%;
      height: ${height}px;
      background: linear-gradient(90deg,
        transparent 0%,
        rgba(0, 255, 255, 0.6) 20%,
        rgba(255, 0, 255, 0.8) 50%,
        rgba(255, 255, 0, 0.6) 80%,
        transparent 100%
      );
      transform: translateX(${offsetX}px) scaleY(${0.5 + Math.random()});
      filter: blur(${Math.random() * 2}px);
      mix-blend-mode: screen;
      pointer-events: none;
    `;

    glitchOverlay.appendChild(tear);
    setTimeout(() => tear.remove(), 100 + Math.random() * 200);
  }

  // Glitch de la page entière
  function glitchWholePage(duration: number) {
    const effects = ['glitch-chromatic', 'glitch-shift-x', 'glitch-flicker', 'glitch-skew'];
    const effect = effects[Math.floor(Math.random() * effects.length)];

    document.body.classList.add(effect);
    setTimeout(() => document.body.classList.remove(effect), duration);
  }

  // Déclencher UN effet glitch
  function triggerSingleGlitch() {
    if (!isActive || !isBursting) return;

    const duration = rand(CONFIG.effectDuration.min, CONFIG.effectDuration.max);
    const elementCount = Math.floor(rand(CONFIG.elementsPerEffect.min, CONFIG.elementsPerEffect.max));

    // Parcourir les effets et les déclencher selon leur probabilité
    Object.entries(CONFIG.effects).forEach(([effect, probability]) => {
      if (Math.random() > probability) return;

      switch (effect) {
        case 'characters':
          const charCount = Math.floor(rand(CONFIG.charactersPerSpawn.min, CONFIG.charactersPerSpawn.max));
          spawnGlitchCharacters(charCount);
          break;
        case 'screenTear':
          createScreenTear();
          // Parfois plusieurs déchirures
          if (Math.random() < 0.4) createScreenTear();
          break;
        case 'wholePage':
          glitchWholePage(duration);
          break;
        default:
          const targets = getRandomElements(elementCount);
          const className = `glitch-${effect.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
          targets.forEach(el => applyEffect(el, className, duration));
      }
    });
  }

  // Démarrer une RAFALE de glitch (la "crise")
  function startBurst() {
    if (!isActive) return;

    isBursting = true;
    const burstDuration = rand(CONFIG.burstPhase.min, CONFIG.burstPhase.max);

    // Pendant la rafale, déclencher des glitchs à intervalles rapides et irréguliers
    const triggerNext = () => {
      if (!isBursting || !isActive) return;

      triggerSingleGlitch();

      // Prochain glitch après un délai aléatoire (irrégulier!)
      const nextDelay = rand(CONFIG.burstInterval.min, CONFIG.burstInterval.max);
      burstIntervalId = setTimeout(triggerNext, nextDelay);
    };

    // Démarrer la rafale
    triggerNext();

    // Arrêter la rafale après sa durée
    setTimeout(() => {
      isBursting = false;
      if (burstIntervalId) {
        clearTimeout(burstIntervalId);
        burstIntervalId = null;
      }
      // Programmer la prochaine rafale
      scheduleNextBurst();
    }, burstDuration);
  }

  // Déclencher un PETIT glitch isolé (pendant les phases calmes)
  function triggerSmallGlitch() {
    if (!isActive || isBursting) return;
    if (Math.random() > CONFIG.smallGlitch.probability) return;

    const duration = rand(80, 200);  // Court

    // Appliquer 1-2 effets subtils
    Object.entries(CONFIG.smallEffects).forEach(([effect, probability]) => {
      if (Math.random() > probability) return;

      switch (effect) {
        case 'characters':
          spawnGlitchCharacters(1 + Math.floor(Math.random() * 3));  // 1-3 caractères
          break;
        case 'screenTear':
          createScreenTear();
          break;
        default:
          const targets = getRandomElements(1 + Math.floor(Math.random() * 2));  // 1-2 éléments
          const className = `glitch-${effect.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
          targets.forEach(el => applyEffect(el, className, duration));
      }
    });
  }

  // Programmer les petits glitchs réguliers
  function startSmallGlitchLoop() {
    const scheduleNext = () => {
      if (!isActive) return;

      const delay = rand(CONFIG.smallGlitch.interval.min, CONFIG.smallGlitch.interval.max);
      smallGlitchIntervalId = setTimeout(() => {
        if (!isBursting) {  // Pas pendant une grosse rafale
          triggerSmallGlitch();
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  // Programmer la prochaine GROSSE rafale
  function scheduleNextBurst() {
    if (!isActive) return;

    const calmDuration = rand(CONFIG.calmPhase.min, CONFIG.calmPhase.max);

    // Programmer la vraie rafale
    mainTimeout = setTimeout(() => {
      if (isActive) startBurst();
    }, calmDuration);
  }

  // Démarrer le moteur
  function startEngine() {
    if (isActive) return;
    isActive = true;

    // Démarrer la boucle des petits glitchs isolés immédiatement
    startSmallGlitchLoop();

    // Premier délai avant la première GROSSE rafale (5-15 secondes)
    mainTimeout = setTimeout(() => {
      if (isActive) startBurst();
    }, 5000 + Math.random() * 10000);
  }

  // Arrêter le moteur
  function stopEngine() {
    isActive = false;
    isBursting = false;

    if (mainTimeout) {
      clearTimeout(mainTimeout);
      mainTimeout = null;
    }
    if (burstIntervalId) {
      clearTimeout(burstIntervalId);
      burstIntervalId = null;
    }
    if (smallGlitchIntervalId) {
      clearTimeout(smallGlitchIntervalId);
      smallGlitchIntervalId = null;
    }

    // Nettoyer
    characterElements.forEach(el => el.remove());
    characterElements = [];

    // Retirer les classes du body
    document.body.classList.remove(
      'glitch-chromatic', 'glitch-shift-x', 'glitch-shift-y',
      'glitch-flicker', 'glitch-hue', 'glitch-skew',
      'glitch-scale', 'glitch-invert', 'glitch-split'
    );
  }

  // Réagir au changement de mode
  $effect(() => {
    if ($appMode === 'god') {
      startEngine();
    } else {
      stopEngine();
    }
  });

  onDestroy(() => {
    stopEngine();
  });
</script>

{#if $appMode === 'god'}
  <div class="glitch-overlay" bind:this={glitchOverlay}></div>
{/if}

<style>
  .glitch-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
    overflow: hidden;
  }

  :global(.glitch-char) {
    position: absolute;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-weight: bold;
    pointer-events: none;
    z-index: 10000;
    animation: glitch-char-anim 0.2s steps(3) forwards;
    --move-x: 0px;
    --move-y: 0px;
  }

  @keyframes glitch-char-anim {
    0% {
      opacity: 0;
      transform: scale(2) rotate(20deg) translate(0, 0);
    }
    20% {
      opacity: 1;
      transform: scale(0.8) rotate(-10deg) translate(var(--move-x), var(--move-y));
    }
    60% {
      opacity: 0.9;
      transform: scale(1.1) rotate(5deg) translate(calc(var(--move-x) * 0.5), calc(var(--move-y) * 0.5));
    }
    100% {
      opacity: 0;
      transform: scale(0.5) rotate(0deg) translate(var(--move-x), var(--move-y));
    }
  }

  :global(.glitch-tear) {
    animation: tear-anim 0.15s ease-out forwards;
  }

  @keyframes tear-anim {
    0% {
      opacity: 0;
      transform: translateX(var(--offset, 0)) scaleX(0.5);
    }
    30% {
      opacity: 1;
      transform: translateX(var(--offset, 0)) scaleX(1.2);
    }
    100% {
      opacity: 0;
      transform: translateX(calc(var(--offset, 0) * 2)) scaleX(0.8);
    }
  }
</style>
