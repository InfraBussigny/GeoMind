<script lang="ts">
  import { mode } from '$lib/stores/app';

  // Props
  interface DangerWarning {
    title: string;
    message: string;
    consequence: string;
    color: string;
    canProceed: boolean;
    requiresConfirmation?: boolean;
  }

  interface Props {
    show: boolean;
    warning: DangerWarning | null;
    command: string;
    dangerLevel: string;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let { show = $bindable(), warning, command, dangerLevel, onConfirm, onCancel }: Props = $props();

  // Déterminer les couleurs selon le niveau
  const levelColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    'BLOCKED': { bg: '#1a0000', border: '#ff0000', text: '#ff4444', glow: '0 0 30px rgba(255,0,0,0.5)' },
    'Bloqué': { bg: '#1a0000', border: '#ff0000', text: '#ff4444', glow: '0 0 30px rgba(255,0,0,0.5)' },
    'Critique': { bg: '#1a0505', border: '#ff3333', text: '#ff6666', glow: '0 0 25px rgba(255,51,51,0.4)' },
    'CRITICAL': { bg: '#1a0505', border: '#ff3333', text: '#ff6666', glow: '0 0 25px rgba(255,51,51,0.4)' },
    'Élevé': { bg: '#1a0f00', border: '#ff6600', text: '#ff9933', glow: '0 0 20px rgba(255,102,0,0.4)' },
    'HIGH': { bg: '#1a0f00', border: '#ff6600', text: '#ff9933', glow: '0 0 20px rgba(255,102,0,0.4)' },
    'Moyen': { bg: '#1a1500', border: '#ffaa00', text: '#ffcc33', glow: '0 0 15px rgba(255,170,0,0.3)' },
    'MEDIUM': { bg: '#1a1500', border: '#ffaa00', text: '#ffcc33', glow: '0 0 15px rgba(255,170,0,0.3)' }
  };

  const getColors = () => levelColors[dangerLevel] || levelColors['Moyen'];
</script>

{#if show && warning}
  <div class="dialog-overlay" class:god-mode={$mode === 'god'}>
    <div
      class="dialog-container"
      style="
        --danger-bg: {getColors().bg};
        --danger-border: {getColors().border};
        --danger-text: {getColors().text};
        --danger-glow: {getColors().glow};
      "
    >
      <!-- Header avec niveau de danger -->
      <div class="dialog-header">
        <div class="danger-badge" class:blocked={!warning.canProceed}>
          {#if !warning.canProceed}
            <span class="danger-icon pulse">&#128683;</span>
          {:else if dangerLevel === 'Critique' || dangerLevel === 'CRITICAL'}
            <span class="danger-icon pulse">&#128680;</span>
          {:else}
            <span class="danger-icon">&#9888;&#65039;</span>
          {/if}
          <span class="danger-level">{dangerLevel}</span>
        </div>
        <h2 class="dialog-title">{warning.title}</h2>
      </div>

      <!-- Corps du message -->
      <div class="dialog-body">
        <p class="warning-message">{warning.message}</p>

        <!-- Commande affichée -->
        <div class="command-preview">
          <span class="command-label">Commande:</span>
          <code class="command-code">{command}</code>
        </div>

        <!-- Conséquence -->
        <div class="consequence-box">
          <span class="consequence-label">Conséquence:</span>
          <p class="consequence-text">{warning.consequence}</p>
        </div>
      </div>

      <!-- Boutons d'action -->
      <div class="dialog-actions">
        {#if warning.canProceed}
          <button class="btn btn-cancel" onclick={onCancel}>
            Annuler
          </button>
          <button class="btn btn-confirm" onclick={onConfirm}>
            Je comprends les risques - Exécuter
          </button>
        {:else}
          <button class="btn btn-blocked" onclick={onCancel}>
            Fermer (Action bloquée)
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease;
  }

  .dialog-overlay.god-mode {
    background: rgba(0, 0, 0, 0.9);
  }

  .dialog-container {
    background: var(--danger-bg, #1a0505);
    border: 2px solid var(--danger-border, #ff3333);
    border-radius: 12px;
    padding: 0;
    max-width: 550px;
    width: 90%;
    box-shadow: var(--danger-glow, 0 0 25px rgba(255,51,51,0.4));
    animation: slideIn 0.3s ease;
    overflow: hidden;
  }

  .dialog-header {
    background: linear-gradient(180deg, rgba(255,0,0,0.15) 0%, transparent 100%);
    padding: 1.5rem;
    border-bottom: 1px solid var(--danger-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .danger-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 0, 0, 0.2);
    padding: 0.4rem 1rem;
    border-radius: 20px;
    border: 1px solid var(--danger-border);
  }

  .danger-badge.blocked {
    background: rgba(255, 0, 0, 0.3);
    animation: shake 0.5s ease;
  }

  .danger-icon {
    font-size: 1.5rem;
  }

  .danger-icon.pulse {
    animation: pulse 1s ease-in-out infinite;
  }

  .danger-level {
    color: var(--danger-text);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 0.9rem;
  }

  .dialog-title {
    color: var(--danger-text);
    font-size: 1.3rem;
    margin: 0;
    text-align: center;
    font-weight: 600;
  }

  .dialog-body {
    padding: 1.5rem;
  }

  .warning-message {
    color: #e0e0e0;
    font-size: 1rem;
    margin: 0 0 1rem 0;
    text-align: center;
  }

  .command-preview {
    background: #0a0a0a;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .command-label {
    color: #888;
    font-size: 0.8rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .command-code {
    color: var(--danger-text);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.9rem;
    word-break: break-all;
    display: block;
  }

  .consequence-box {
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid var(--danger-border);
    border-radius: 8px;
    padding: 1rem;
  }

  .consequence-label {
    color: var(--danger-text);
    font-size: 0.8rem;
    font-weight: 600;
    display: block;
    margin-bottom: 0.5rem;
  }

  .consequence-text {
    color: #fff;
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .dialog-actions {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    background: rgba(0, 0, 0, 0.3);
    border-top: 1px solid #333;
  }

  .btn {
    flex: 1;
    padding: 0.9rem 1.5rem;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .btn-cancel {
    background: #2a2a2a;
    color: #ccc;
    border: 1px solid #444;
  }

  .btn-cancel:hover {
    background: #3a3a3a;
    color: #fff;
  }

  .btn-confirm {
    background: linear-gradient(135deg, #8b0000 0%, #cc0000 100%);
    color: #fff;
    border: 1px solid #ff3333;
  }

  .btn-confirm:hover {
    background: linear-gradient(135deg, #aa0000 0%, #ee0000 100%);
    box-shadow: 0 0 15px rgba(255, 0, 0, 0.4);
  }

  .btn-blocked {
    background: #333;
    color: #888;
    border: 1px solid #555;
    cursor: not-allowed;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideIn {
    from {
      transform: translateY(-20px) scale(0.95);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.8; }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
  }

  /* God mode specific styles */
  .god-mode .dialog-container {
    border-color: var(--cmy-magenta, #ff00ff);
    box-shadow:
      0 0 20px rgba(255, 0, 255, 0.3),
      0 0 40px rgba(255, 0, 0, 0.2);
  }

  .god-mode .danger-badge {
    border-color: var(--cmy-magenta, #ff00ff);
  }

  .god-mode .btn-confirm {
    background: linear-gradient(135deg, #800080 0%, #ff00ff 100%);
    border-color: var(--cmy-cyan, #00ffff);
  }

  .god-mode .btn-confirm:hover {
    box-shadow:
      0 0 15px rgba(255, 0, 255, 0.5),
      0 0 30px rgba(0, 255, 255, 0.3);
  }
</style>
