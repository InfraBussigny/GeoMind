<script lang="ts">
  interface Props {
    size?: number;
    showText?: boolean;
  }

  let { size = 40, showText = true }: Props = $props();
</script>

<div class="logo-container" style="--size: {size}px">
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="logo-svg"
  >
    <!-- Cyber Globe definitions -->
    <defs>
      <linearGradient id="cyberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#00ff88" />
        <stop offset="100%" style="stop-color:#00cc6a" />
      </linearGradient>
      <linearGradient id="cyberGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#00ff88;stop-opacity:0.6" />
        <stop offset="100%" style="stop-color:#00cc6a;stop-opacity:0.2" />
      </linearGradient>
      <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Outer ring glow -->
    <circle cx="50" cy="50" r="46" stroke="#00ff88" stroke-width="1" fill="none" opacity="0.3"/>

    <!-- Outer scanning ring (animated) -->
    <circle cx="50" cy="50" r="44" stroke="url(#cyberGradient)" stroke-width="2" fill="none" stroke-dasharray="10 5" class="scan-ring"/>

    <!-- Main circle background -->
    <circle cx="50" cy="50" r="40" fill="#0a0a0f" stroke="#00ff88" stroke-width="2"/>

    <!-- Inner glow circle -->
    <circle cx="50" cy="50" r="38" fill="url(#cyberGlow)" opacity="0.3"/>

    <!-- Grid lines (geo/cyber) -->
    <line x1="50" y1="12" x2="50" y2="88" stroke="#00ff88" stroke-width="0.5" opacity="0.3"/>
    <line x1="12" y1="50" x2="88" y2="50" stroke="#00ff88" stroke-width="0.5" opacity="0.3"/>
    <ellipse cx="50" cy="50" rx="36" ry="14" stroke="#00ff88" stroke-width="0.5" fill="none" opacity="0.3"/>
    <ellipse cx="50" cy="50" rx="36" ry="28" stroke="#00ff88" stroke-width="0.5" fill="none" opacity="0.2"/>

    <!-- Abstract brain circuits -->
    <g filter="url(#neonGlow)">
      <!-- Left hemisphere circuit -->
      <path
        d="M28 50
           C28 38, 35 28, 48 28
           L48 35
           C40 35, 34 42, 34 50
           C34 58, 40 65, 48 65
           L48 72
           C35 72, 28 62, 28 50Z"
        fill="none"
        stroke="#00ff88"
        stroke-width="2"
        stroke-linecap="round"
      />

      <!-- Right hemisphere circuit -->
      <path
        d="M72 50
           C72 38, 65 28, 52 28
           L52 35
           C60 35, 66 42, 66 50
           C66 58, 60 65, 52 65
           L52 72
           C65 72, 72 62, 72 50Z"
        fill="none"
        stroke="#00ff88"
        stroke-width="2"
        stroke-linecap="round"
      />

      <!-- Center connection -->
      <line x1="48" y1="50" x2="52" y2="50" stroke="#00ff88" stroke-width="2"/>

      <!-- Neural nodes -->
      <circle cx="34" cy="42" r="2" fill="#00ff88"/>
      <circle cx="34" cy="58" r="2" fill="#00ff88"/>
      <circle cx="66" cy="42" r="2" fill="#00ff88"/>
      <circle cx="66" cy="58" r="2" fill="#00ff88"/>
      <circle cx="50" cy="28" r="2" fill="#00ff88"/>
      <circle cx="50" cy="72" r="2" fill="#00ff88"/>

      <!-- Center pulse -->
      <circle cx="50" cy="50" r="4" fill="#00ff88" class="center-pulse"/>
    </g>

    <!-- Location marker (cyan accent) -->
    <g transform="translate(68, 22)" filter="url(#softGlow)">
      <circle cx="0" cy="0" r="6" fill="#00d4ff"/>
      <circle cx="0" cy="0" r="3" fill="#0a0a0f"/>
      <path d="M0 6 L0 12" stroke="#00d4ff" stroke-width="1.5" stroke-linecap="round"/>
    </g>

    <!-- Data points -->
    <circle cx="24" cy="62" r="1.5" fill="#00ff88" opacity="0.6"/>
    <circle cx="76" cy="68" r="1.5" fill="#00ff88" opacity="0.6"/>
    <circle cx="28" cy="38" r="1" fill="#00d4ff" opacity="0.5"/>
  </svg>

  {#if showText}
    <div class="logo-text">
      <span class="logo-title">GeoMind</span>
      <span class="logo-subtitle">Bussigny SIT</span>
    </div>
  {/if}
</div>

<style>
  .logo-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-svg {
    flex-shrink: 0;
    filter: drop-shadow(0 0 8px rgba(0, 255, 136, 0.4));
  }

  .logo-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .logo-title {
    font-size: calc(var(--size) * 0.42);
    font-weight: 700;
    font-family: var(--font-mono);
    color: #00ff88;
    letter-spacing: 1px;
    text-shadow: 0 0 10px rgba(0, 255, 136, 0.6);
  }

  .logo-subtitle {
    font-size: calc(var(--size) * 0.22);
    color: rgba(255,255,255,0.5);
    text-transform: uppercase;
    letter-spacing: 2px;
    font-weight: 500;
    font-family: var(--font-mono);
  }

  /* Animated scanning ring */
  .scan-ring {
    animation: rotate 20s linear infinite;
    transform-origin: center;
  }

  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Center pulse animation */
  .center-pulse {
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      r: 4;
      opacity: 1;
    }
    50% {
      r: 6;
      opacity: 0.7;
    }
  }
</style>
