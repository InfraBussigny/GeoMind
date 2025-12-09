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
    <!-- Globe/Geo base circle with gradient -->
    <defs>
      <linearGradient id="globeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#4a7ab8" />
        <stop offset="100%" style="stop-color:#2a4a73" />
      </linearGradient>
      <linearGradient id="brainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#ffffff" />
        <stop offset="100%" style="stop-color:#e0e8f0" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Outer globe ring -->
    <circle cx="50" cy="50" r="46" stroke="url(#globeGradient)" stroke-width="3" fill="none" opacity="0.3"/>

    <!-- Main circle background -->
    <circle cx="50" cy="50" r="42" fill="url(#globeGradient)"/>

    <!-- Latitude lines (geo symbol) -->
    <ellipse cx="50" cy="50" rx="38" ry="15" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/>
    <ellipse cx="50" cy="50" rx="38" ry="30" stroke="rgba(255,255,255,0.15)" stroke-width="1" fill="none"/>

    <!-- Longitude line -->
    <line x1="50" y1="10" x2="50" y2="90" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>

    <!-- Abstract brain shape - simplified, modern -->
    <g filter="url(#glow)">
      <!-- Left hemisphere -->
      <path
        d="M32 45
           C28 40, 30 32, 38 30
           C42 28, 48 30, 50 35
           C50 42, 48 48, 50 52
           C48 58, 42 62, 38 60
           C30 58, 28 50, 32 45Z"
        fill="url(#brainGradient)"
        opacity="0.95"
      />

      <!-- Right hemisphere -->
      <path
        d="M68 45
           C72 40, 70 32, 62 30
           C58 28, 52 30, 50 35
           C50 42, 52 48, 50 52
           C52 58, 58 62, 62 60
           C70 58, 72 50, 68 45Z"
        fill="url(#brainGradient)"
        opacity="0.95"
      />

      <!-- Brain folds - left -->
      <path d="M35 38 Q40 42, 35 48" stroke="#366092" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M38 52 Q44 50, 42 56" stroke="#366092" stroke-width="1.5" fill="none" stroke-linecap="round"/>

      <!-- Brain folds - right -->
      <path d="M65 38 Q60 42, 65 48" stroke="#366092" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M62 52 Q56 50, 58 56" stroke="#366092" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    </g>

    <!-- Location pin / coordinate marker -->
    <g transform="translate(65, 18)">
      <circle cx="0" cy="0" r="8" fill="#e67e22"/>
      <circle cx="0" cy="0" r="4" fill="white"/>
      <path d="M0 8 L0 16" stroke="#e67e22" stroke-width="2" stroke-linecap="round"/>
    </g>

    <!-- Grid dots (data points) -->
    <circle cx="22" cy="65" r="2" fill="rgba(255,255,255,0.5)"/>
    <circle cx="78" cy="70" r="2" fill="rgba(255,255,255,0.5)"/>
    <circle cx="25" cy="35" r="1.5" fill="rgba(255,255,255,0.4)"/>
  </svg>

  {#if showText}
    <div class="logo-text">
      <span class="logo-title">GeoBrain</span>
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
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  }

  .logo-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .logo-title {
    font-size: calc(var(--size) * 0.45);
    font-weight: 700;
    color: white;
    letter-spacing: -0.5px;
  }

  .logo-subtitle {
    font-size: calc(var(--size) * 0.25);
    color: rgba(255,255,255,0.7);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 500;
  }
</style>
