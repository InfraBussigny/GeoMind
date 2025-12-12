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
  import hljs from 'highlight.js/lib/core';
  // Import langages courants
  import sql from 'highlight.js/lib/languages/sql';
  import python from 'highlight.js/lib/languages/python';
  import javascript from 'highlight.js/lib/languages/javascript';
  import typescript from 'highlight.js/lib/languages/typescript';
  import json from 'highlight.js/lib/languages/json';
  import xml from 'highlight.js/lib/languages/xml';
  import markdown from 'highlight.js/lib/languages/markdown';
  import bash from 'highlight.js/lib/languages/bash';
  import yaml from 'highlight.js/lib/languages/yaml';
  import css from 'highlight.js/lib/languages/css';

  // Enregistrer les langages
  hljs.registerLanguage('sql', sql);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('html', xml);
  hljs.registerLanguage('markdown', markdown);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('shell', bash);
  hljs.registerLanguage('yaml', yaml);
  hljs.registerLanguage('css', css);

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
  let highlightedCode = $state('');

  // Système d'historique des révisions
  interface Revision {
    id: number;
    content: string;
    timestamp: Date;
    label?: string;
  }

  let revisions = $state<Revision[]>([]);
  let currentRevisionIndex = $state(-1); // -1 = version actuelle
  let showHistory = $state(false);

  // Mapping type artifact -> langage highlight.js
  function getHighlightLanguage(type: ArtifactType, lang?: string): string {
    if (lang) return lang;
    const mapping: Record<ArtifactType, string> = {
      code: 'javascript',
      document: 'markdown',
      sql: 'sql',
      python: 'python',
      markdown: 'markdown',
      json: 'json'
    };
    return mapping[type] || 'plaintext';
  }

  // Initialiser editedContent quand l'artifact change
  $effect(() => {
    if (artifact?.content) {
      editedContent = artifact.content;
    }
  });

  // Détection automatique du langage
  let detectedLanguage = $state('');

  function detectLanguage(content: string): string {
    // Patterns pour détecter le langage
    const patterns: { lang: string; regex: RegExp; weight: number }[] = [
      // SQL
      { lang: 'sql', regex: /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN|GROUP BY|ORDER BY)\b/i, weight: 10 },
      { lang: 'sql', regex: /\bST_(AsText|GeomFromText|Intersects|Contains|Buffer|Distance)\b/i, weight: 15 }, // PostGIS
      // Python
      { lang: 'python', regex: /\b(def|class|import|from|if __name__|print\(|self\.|lambda)\b/, weight: 10 },
      { lang: 'python', regex: /^import\s+\w+|^from\s+\w+\s+import/m, weight: 15 },
      // JavaScript/TypeScript
      { lang: 'javascript', regex: /\b(const|let|var|function|=>|async|await|export|import)\b/, weight: 8 },
      { lang: 'typescript', regex: /:\s*(string|number|boolean|any|void|interface|type)\b/, weight: 12 },
      // JSON
      { lang: 'json', regex: /^\s*[\[{][\s\S]*[\]}]\s*$/, weight: 5 },
      { lang: 'json', regex: /^\s*\{[\s\S]*"[^"]+"\s*:[\s\S]*\}\s*$/, weight: 10 },
      // YAML
      { lang: 'yaml', regex: /^[\w-]+:\s*(\n|.)+/m, weight: 5 },
      { lang: 'yaml', regex: /^---\s*\n/m, weight: 10 },
      // XML/HTML
      { lang: 'xml', regex: /<\?xml|<\w+[^>]*>[\s\S]*<\/\w+>/, weight: 10 },
      { lang: 'html', regex: /<(!DOCTYPE|html|head|body|div|span|p|a|script)\b/i, weight: 12 },
      // Bash/Shell
      { lang: 'bash', regex: /^#!/m, weight: 15 },
      { lang: 'bash', regex: /\b(echo|cd|ls|grep|awk|sed|chmod|mkdir|rm|cp|mv)\b/, weight: 8 },
      // CSS
      { lang: 'css', regex: /\{[\s\S]*[a-z-]+\s*:\s*[^}]+\}/, weight: 5 },
      { lang: 'css', regex: /\.([\w-]+)\s*\{|#[\w-]+\s*\{|@media\s*\(/, weight: 10 },
      // Markdown
      { lang: 'markdown', regex: /^#{1,6}\s+.+|^\*{1,3}[^*]+\*{1,3}|\[.+\]\(.+\)/m, weight: 8 },
    ];

    const scores: Record<string, number> = {};

    for (const { lang, regex, weight } of patterns) {
      if (regex.test(content)) {
        scores[lang] = (scores[lang] || 0) + weight;
      }
    }

    // Trouver le langage avec le meilleur score
    let bestLang = '';
    let bestScore = 0;
    for (const [lang, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }

    return bestLang || 'plaintext';
  }

  // Appliquer la coloration syntaxique
  $effect(() => {
    if (artifact?.content && !isEditing) {
      let lang = artifact.language;

      // Si pas de langage spécifié, utiliser le type ou détecter automatiquement
      if (!lang) {
        const typeMapping: Record<ArtifactType, string> = {
          code: '',  // Détecter automatiquement
          document: 'markdown',
          sql: 'sql',
          python: 'python',
          markdown: 'markdown',
          json: 'json'
        };
        lang = typeMapping[artifact.type];
      }

      // Si toujours pas de langage, détecter automatiquement
      if (!lang) {
        lang = detectLanguage(artifact.content);
      }

      detectedLanguage = lang;

      try {
        const result = hljs.highlight(artifact.content, { language: lang });
        highlightedCode = result.value;
      } catch {
        // Fallback : essayer la détection auto de highlight.js
        try {
          const autoResult = hljs.highlightAuto(artifact.content);
          highlightedCode = autoResult.value;
          detectedLanguage = autoResult.language || 'plaintext';
        } catch {
          highlightedCode = artifact.content;
        }
      }
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

  // Sauvegarder une révision
  function saveRevision(content: string, label?: string) {
    const newRevision: Revision = {
      id: Date.now(),
      content,
      timestamp: new Date(),
      label
    };
    revisions = [...revisions, newRevision];
    // Garder max 20 révisions
    if (revisions.length > 20) {
      revisions = revisions.slice(-20);
    }
  }

  // Sauvegarder les modifications
  function saveEdit() {
    if (onUpdate && artifact) {
      // Sauvegarder l'ancienne version avant modification
      saveRevision(artifact.content, 'Avant édition');
      onUpdate(editedContent);
    }
    isEditing = false;
    currentRevisionIndex = -1;
  }

  // Naviguer dans l'historique
  function goToRevision(index: number) {
    currentRevisionIndex = index;
    if (index >= 0 && index < revisions.length) {
      editedContent = revisions[index].content;
    } else if (artifact) {
      editedContent = artifact.content;
    }
  }

  // Restaurer une révision
  function restoreRevision(revision: Revision) {
    if (onUpdate && artifact) {
      saveRevision(artifact.content, 'Avant restauration');
      onUpdate(revision.content);
    }
    currentRevisionIndex = -1;
    showHistory = false;
  }

  // Formater la date
  function formatTimestamp(date: Date): string {
    return date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

  // Export menu state
  let showExportMenu = $state(false);

  type ExportFormat = 'raw' | 'html' | 'markdown';

  // Télécharger le fichier
  function downloadFile(format: ExportFormat = 'raw') {
    if (!artifact) return;

    let content = artifact.content;
    let mimeType = 'text/plain';
    let ext = 'txt';

    const extensions: Record<ArtifactType, string> = {
      code: 'txt',
      document: 'txt',
      sql: 'sql',
      python: 'py',
      markdown: 'md',
      json: 'json'
    };

    switch (format) {
      case 'html':
        ext = 'html';
        mimeType = 'text/html';
        content = generateHTML(artifact.content, artifact.title, detectedLanguage);
        break;
      case 'markdown':
        ext = 'md';
        mimeType = 'text/markdown';
        content = generateMarkdown(artifact.content, artifact.title, detectedLanguage);
        break;
      default:
        ext = extensions[artifact.type] || 'txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '_')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showExportMenu = false;
  }

  // Générer HTML avec coloration syntaxique
  function generateHTML(content: string, title: string, language: string): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - GeoMind Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 2rem;
      margin: 0;
    }
    .header {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #333;
    }
    h1 {
      color: #00ff88;
      font-size: 1.5rem;
      margin: 0 0 0.5rem 0;
    }
    .meta {
      font-size: 0.8rem;
      color: #666;
    }
    .badge {
      display: inline-block;
      background: rgba(0, 255, 136, 0.1);
      color: #00ff88;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      border: 1px solid #00ff88;
      margin-right: 0.5rem;
    }
    pre {
      background: #111;
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid #333;
      overflow-x: auto;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.9rem;
      line-height: 1.6;
    }
    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #333;
      font-size: 0.75rem;
      color: #666;
    }
    /* Syntax highlighting */
    .hljs-keyword { color: #ff79c6; font-weight: 600; }
    .hljs-string { color: #f1fa8c; }
    .hljs-number { color: #bd93f9; }
    .hljs-comment { color: #6272a4; font-style: italic; }
    .hljs-function { color: #50fa7b; }
    .hljs-variable { color: #ffb86c; }
    .hljs-type { color: #8be9fd; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="meta">
      <span class="badge">${language.toUpperCase()}</span>
      <span>Exporté depuis GeoMind - ${new Date().toLocaleDateString('fr-CH')}</span>
    </div>
  </div>
  <pre><code>${escapeHtml(content)}</code></pre>
  <div class="footer">
    Généré par GeoMind - Commune de Bussigny
  </div>
</body>
</html>`;
  }

  // Générer Markdown
  function generateMarkdown(content: string, title: string, language: string): string {
    return `# ${title}

> Exporté depuis GeoMind - ${new Date().toLocaleDateString('fr-CH')}

\`\`\`${language}
${content}
\`\`\`

---
*Généré par GeoMind - Commune de Bussigny*
`;
  }

  // Échapper les caractères HTML
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
          <div class="badge-row">
            <span class="type-badge">{getTypeLabel(artifact.type)}</span>
            {#if detectedLanguage && detectedLanguage !== 'plaintext'}
              <span class="lang-badge">{detectedLanguage.toUpperCase()}</span>
            {/if}
          </div>
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
        <div class="export-wrapper">
          <button
            class="action-btn"
            class:active={showExportMenu}
            onclick={() => showExportMenu = !showExportMenu}
            title="Exporter"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          {#if showExportMenu}
            <div class="export-menu">
              <button class="export-option" onclick={() => downloadFile('raw')}>
                <span class="export-icon">📄</span>
                <span class="export-label">Fichier brut</span>
                <span class="export-ext">.{artifact.type === 'sql' ? 'sql' : artifact.type === 'python' ? 'py' : 'txt'}</span>
              </button>
              <button class="export-option" onclick={() => downloadFile('html')}>
                <span class="export-icon">🌐</span>
                <span class="export-label">Page HTML</span>
                <span class="export-ext">.html</span>
              </button>
              <button class="export-option" onclick={() => downloadFile('markdown')}>
                <span class="export-icon">📝</span>
                <span class="export-label">Markdown</span>
                <span class="export-ext">.md</span>
              </button>
            </div>
          {/if}
        </div>
        {#if revisions.length > 0}
          <button
            class="action-btn"
            class:active={showHistory}
            onclick={() => showHistory = !showHistory}
            title="Historique ({revisions.length})"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            {#if revisions.length > 0}
              <span class="history-count">{revisions.length}</span>
            {/if}
          </button>
        {/if}
        <button class="action-btn close-btn" onclick={onClose} title="Fermer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- History Panel -->
    {#if showHistory}
      <div class="history-panel">
        <div class="history-header">
          <span class="history-title">Historique des révisions</span>
          <button class="history-close" onclick={() => showHistory = false}>×</button>
        </div>
        <div class="history-list">
          {#each revisions.slice().reverse() as revision, i}
            <div class="history-item" class:active={currentRevisionIndex === revisions.length - 1 - i}>
              <button
                class="history-item-btn"
                onclick={() => goToRevision(revisions.length - 1 - i)}
                type="button"
              >
                <span class="history-time">{formatTimestamp(revision.timestamp)}</span>
                {#if revision.label}
                  <span class="history-label">{revision.label}</span>
                {/if}
              </button>
              <button
                class="restore-btn"
                onclick={() => restoreRevision(revision)}
                title="Restaurer cette version"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
            </div>
          {/each}
          <button
            class="history-item current"
            class:active={currentRevisionIndex === -1}
            onclick={() => goToRevision(-1)}
            type="button"
          >
            <span class="history-time">Version actuelle</span>
          </button>
        </div>
      </div>
    {/if}

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
        <pre class="code-preview hljs" bind:this={codeContainer}><code>{@html highlightedCode || artifact.content}</code>{#if isStreaming}<span class="streaming-cursor">▊</span>{/if}</pre>
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

  .badge-row {
    display: flex;
    gap: 6px;
    align-items: center;
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

  .lang-badge {
    font-size: 9px;
    font-family: var(--font-mono);
    color: var(--cyber-green);
    background: var(--cyber-green-glow);
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid var(--cyber-green);
    font-weight: 600;
  }

  /* ========================================
     History Panel Styles
     ======================================== */

  .history-panel {
    background: var(--noir-surface);
    border-bottom: 1px solid var(--border-color);
    max-height: 200px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--noir-card);
    border-bottom: 1px solid var(--border-color);
  }

  .history-title {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .history-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .history-close:hover {
    color: var(--error);
  }

  .history-list {
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
    width: 100%;
  }

  .history-item:hover {
    border-color: var(--cyber-green);
    background: var(--bg-hover);
  }

  .history-item.active {
    border-color: var(--cyber-green);
    background: var(--cyber-green-glow);
  }

  .history-item.current {
    border-style: dashed;
  }

  .history-item-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    color: inherit;
  }

  .history-time {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .history-label {
    font-size: 10px;
    color: var(--text-muted);
  }

  .restore-btn {
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 4px;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .restore-btn:hover {
    color: var(--cyber-green);
    border-color: var(--cyber-green);
    background: var(--cyber-green-glow);
  }

  .history-count {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    font-size: 9px;
    font-weight: bold;
    padding: 1px 4px;
    border-radius: 8px;
    min-width: 14px;
    text-align: center;
  }

  .action-btn {
    position: relative;
  }

  .action-btn.active {
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-color: var(--cyber-green);
  }

  /* Export Menu Styles */
  .export-wrapper {
    position: relative;
  }

  .export-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--noir-surface);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 4px;
    min-width: 160px;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .export-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .export-option:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
  }

  .export-icon {
    font-size: 14px;
  }

  .export-label {
    flex: 1;
    font-size: 12px;
    font-family: var(--font-mono);
  }

  .export-ext {
    font-size: 10px;
    color: var(--text-muted);
    font-family: var(--font-mono);
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

  /* ========================================
     Thème Highlight.js Cyber GeoMind
     ======================================== */

  :global(.hljs) {
    background: var(--noir-card, #0d0d0d);
    color: var(--text-primary, #e0e0e0);
  }

  /* Mots-clés : SELECT, FROM, WHERE, def, function, const, etc. */
  :global(.hljs-keyword),
  :global(.hljs-selector-tag),
  :global(.hljs-built_in),
  :global(.hljs-name) {
    color: #ff79c6;
    font-weight: 600;
  }

  /* Types : int, string, boolean, etc. */
  :global(.hljs-type),
  :global(.hljs-class .hljs-title),
  :global(.hljs-title.class_) {
    color: #8be9fd;
  }

  /* Fonctions */
  :global(.hljs-title.function_),
  :global(.hljs-title),
  :global(.hljs-function .hljs-title) {
    color: #50fa7b;
  }

  /* Strings */
  :global(.hljs-string),
  :global(.hljs-template-string),
  :global(.hljs-addition) {
    color: #f1fa8c;
  }

  /* Nombres */
  :global(.hljs-number),
  :global(.hljs-literal) {
    color: #bd93f9;
  }

  /* Commentaires */
  :global(.hljs-comment),
  :global(.hljs-quote) {
    color: #6272a4;
    font-style: italic;
  }

  /* Variables, paramètres */
  :global(.hljs-variable),
  :global(.hljs-params),
  :global(.hljs-template-variable) {
    color: #ffb86c;
  }

  /* Attributs (HTML, XML) */
  :global(.hljs-attr),
  :global(.hljs-attribute) {
    color: #50fa7b;
  }

  /* Tags HTML */
  :global(.hljs-tag) {
    color: #ff79c6;
  }

  /* Symboles, regex */
  :global(.hljs-symbol),
  :global(.hljs-regexp) {
    color: #ff5555;
  }

  /* Deletion (diff) */
  :global(.hljs-deletion) {
    color: #ff5555;
    background: rgba(255, 85, 85, 0.1);
  }

  /* Meta, preprocessor */
  :global(.hljs-meta),
  :global(.hljs-meta .hljs-keyword) {
    color: #8be9fd;
  }

  /* Operator */
  :global(.hljs-operator),
  :global(.hljs-punctuation) {
    color: #ff79c6;
  }

  /* Section headers */
  :global(.hljs-section) {
    color: #50fa7b;
    font-weight: bold;
  }

  /* Emphasis */
  :global(.hljs-emphasis) {
    font-style: italic;
  }

  :global(.hljs-strong) {
    font-weight: bold;
  }

  /* SQL spécifique */
  :global(.hljs-aggregate),
  :global(.hljs-built_in) {
    color: #8be9fd;
  }
</style>
