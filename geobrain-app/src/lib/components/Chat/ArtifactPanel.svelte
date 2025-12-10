<script module lang="ts">
  // Types d'artifacts supportés (exportés pour être utilisés par d'autres composants)
  export type ArtifactType = 'code' | 'document' | 'sql' | 'python' | 'markdown' | 'json';

  export interface Artifact {
    id: string;
    type: ArtifactType;
    title: string;
    content: string;
    language?: string;
    timestamp: Date;
  }
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';

  // Props
  let { artifact, onClose, onUpdate, isStreaming = false } = $props<{
    artifact: Artifact | null;
    onClose: () => void;
    onUpdate?: (content: string) => void;
    isStreaming?: boolean;
  }>();

  let isEditing = $state(true);
  let editedContent = $state('');
  let copySuccess = $state(false);
  let codeContainer = $state<HTMLPreElement | null>(null);

  // Initialiser editedContent quand l'artifact change
  $effect(() => {
    if (artifact?.content) {
      editedContent = artifact.content;
    }
  });

  // Auto-scroll vers le bas pendant le streaming
  $effect(() => {
    if (isStreaming && artifact?.content && codeContainer) {
      tick().then(() => {
        if (codeContainer) {
          codeContainer.scrollTop = codeContainer.scrollHeight;
        }
      });
    }
  });

  // Démarrer l'édition
  function startEditing() {
    if (artifact) {
      editedContent = artifact.content;
      isEditing = true;
    }
  }

  // Sauvegarder les modifications
  function saveEdit() {
    if (onUpdate && artifact) {
      onUpdate(editedContent);
    }
    isEditing = false;
  }

  // Annuler l'édition
  function cancelEdit() {
    isEditing = false;
    editedContent = '';
  }

  // Copier dans le presse-papier
  async function copyToClipboard() {
    if (artifact) {
      try {
        await navigator.clipboard.writeText(artifact.content);
        copySuccess = true;
        setTimeout(() => copySuccess = false, 2000);
      } catch (err) {
        console.error('Erreur de copie:', err);
      }
    }
  }

  // Télécharger le fichier
  function downloadFile() {
    if (!artifact) return;

    const extensions: Record<ArtifactType, string> = {
      code: 'txt',
      document: 'txt',
      sql: 'sql',
      python: 'py',
      markdown: 'md',
      json: 'json'
    };

    const ext = extensions[artifact.type] || 'txt';
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '_')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Icône selon le type
  function getTypeIcon(type: ArtifactType): string {
    const icons: Record<ArtifactType, string> = {
      code: '</>',
      document: '📄',
      sql: '🗃️',
      python: '🐍',
      markdown: '📝',
      json: '{}'
    };
    return icons[type] || '📄';
  }

  // Label selon le type
  function getTypeLabel(type: ArtifactType): string {
    const labels: Record<ArtifactType, string> = {
      code: 'Code',
      document: 'Document',
      sql: 'SQL',
      python: 'Python',
      markdown: 'Markdown',
      json: 'JSON'
    };
    return labels[type] || 'Fichier';
  }
</script>

{#if artifact}
  <div class="artifact-panel">
    <!-- Header -->
    <div class="panel-header">
      <div class="header-info">
        <span class="type-icon">{getTypeIcon(artifact.type)}</span>
        <div class="header-text">
          <h3>{artifact.title}</h3>
          <span class="type-badge">{getTypeLabel(artifact.type)}</span>
        </div>
      </div>
      <div class="header-actions">
        {#if !isEditing}
          <button class="action-btn" onclick={startEditing} title="Modifier">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        {/if}
        <button
          class="action-btn"
          class:success={copySuccess}
          onclick={copyToClipboard}
          title={copySuccess ? 'Copié!' : 'Copier'}
        >
          {#if copySuccess}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          {/if}
        </button>
        <button class="action-btn" onclick={downloadFile} title="Telecharger">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button class="action-btn close-btn" onclick={onClose} title="Fermer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="panel-content">
      {#if isEditing}
        <textarea
          class="edit-area"
          bind:value={editedContent}
          spellcheck="false"
        ></textarea>
        <div class="edit-actions">
          <button class="btn-secondary" onclick={cancelEdit}>Annuler</button>
          <button class="btn-primary" onclick={saveEdit}>Sauvegarder</button>
        </div>
      {:else}
        <pre class="code-preview" bind:this={codeContainer}><code>{artifact.content}</code>{#if isStreaming}<span class="streaming-cursor">▊</span>{/if}</pre>
      {/if}
    </div>
  </div>
{/if}

<style>
  .artifact-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--noir-surface);
    border-left: 1px solid var(--border-color);
    position: relative;
  }

  /* Ligne verte en haut */
  .artifact-panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--cyber-green), transparent);
    opacity: 0.6;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
    background: var(--noir-card);
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .type-icon {
    font-size: 20px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--noir-elevated);
    border: 1px solid var(--border-color);
    border-radius: 6px;
  }

  .header-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-text h3 {
    margin: 0;
    font-size: var(--font-size-md);
    font-family: var(--font-mono);
    color: var(--cyber-green);
    text-shadow: 0 0 8px var(--cyber-green-glow);
  }

  .type-badge {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    background: var(--noir-elevated);
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid var(--border-color);
    width: fit-content;
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-xs);
  }

  .action-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-color);
    background: var(--noir-elevated);
    color: var(--text-secondary);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .action-btn:hover {
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-color: var(--cyber-green);
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  .action-btn.success {
    background: var(--success-glow);
    color: var(--success);
    border-color: var(--success);
  }

  .action-btn.close-btn:hover {
    background: var(--error-glow);
    color: var(--error);
    border-color: var(--error);
    box-shadow: 0 0 10px var(--error-glow);
  }

  .panel-content {
    flex: 1;
    overflow: auto;
    padding: var(--spacing-md);
    background: var(--noir-profond);
  }

  .code-preview {
    margin: 0;
    padding: var(--spacing-md);
    background: var(--noir-card);
    color: var(--text-primary);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    line-height: 1.6;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    min-height: 200px;
  }

  .code-preview code {
    background: none;
    color: var(--text-primary);
  }

  .edit-area {
    width: 100%;
    height: calc(100% - 50px);
    padding: var(--spacing-md);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    line-height: 1.6;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    resize: none;
    background: var(--noir-card);
    color: var(--text-primary);
  }

  .edit-area:focus {
    outline: none;
    border-color: var(--cyber-green);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    padding-top: var(--spacing-md);
  }

  .btn-primary, .btn-secondary {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid transparent;
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .btn-primary {
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-color: var(--cyber-green);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .btn-primary:hover {
    background: var(--cyber-green-light);
    box-shadow: 0 0 25px var(--cyber-green-glow);
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--noir-card);
    color: var(--text-secondary);
    border-color: var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--noir-elevated);
    color: var(--text-primary);
    border-color: var(--cyber-green);
  }

  /* Curseur clignotant pendant le streaming */
  .streaming-cursor {
    display: inline;
    color: var(--cyber-green);
    animation: blink-cyber 0.6s infinite;
    font-weight: bold;
    text-shadow: 0 0 10px var(--cyber-green-glow);
  }

  @keyframes blink-cyber {
    0%, 50% {
      opacity: 1;
      text-shadow: 0 0 15px var(--cyber-green-glow);
    }
    51%, 100% {
      opacity: 0.3;
      text-shadow: 0 0 5px var(--cyber-green-glow);
    }
  }
</style>
