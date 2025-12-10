<script lang="ts">
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment';
  import {
    getTemplates,
    getSnippets,
    applyTemplate,
    searchTemplates,
    type Template,
    type Snippet
  } from '$lib/services/ghostwriter';

  // Props
  interface Props {
    onInsert?: (content: string) => void;
    language?: string;
  }

  let { onInsert, language }: Props = $props();

  // State
  let activeTab = $state<'templates' | 'snippets' | 'custom'>('templates');
  let searchQuery = $state('');
  let selectedTemplate = $state<Template | null>(null);
  let templateValues = $state<Record<string, string>>({});
  let showPreview = $state(false);

  // Custom functions store
  interface CustomFunction {
    id: string;
    name: string;
    description: string;
    content: string;
    language: string;
    createdAt: string;
  }

  const STORAGE_KEY = 'geobrain_custom_functions';

  function loadCustomFunctions(): CustomFunction[] {
    if (!browser) return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveCustomFunctions(funcs: CustomFunction[]) {
    if (browser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(funcs));
    }
  }

  let customFunctions = $state<CustomFunction[]>(loadCustomFunctions());

  // New function form
  let newFuncName = $state('');
  let newFuncDesc = $state('');
  let newFuncContent = $state('');
  let newFuncLang = $state('sql');
  let showNewForm = $state(false);

  // Computed
  let filteredTemplates = $derived(() => {
    let templates = getTemplates(language);
    if (searchQuery) {
      templates = searchTemplates(searchQuery);
      if (language) {
        templates = templates.filter(t => t.language === language);
      }
    }
    return templates;
  });

  let filteredSnippets = $derived(() => {
    let snippets = getSnippets(language);
    if (searchQuery) {
      snippets = snippets.filter(s =>
        s.trigger.includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return snippets;
  });

  let filteredCustom = $derived(() => {
    let funcs = customFunctions;
    if (language) {
      funcs = funcs.filter(f => f.language === language);
    }
    if (searchQuery) {
      funcs = funcs.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return funcs;
  });

  let previewContent = $derived(() => {
    if (!selectedTemplate) return '';
    return applyTemplate(selectedTemplate, templateValues);
  });

  // Actions
  function selectTemplate(template: Template) {
    selectedTemplate = template;
    templateValues = {};
    for (const v of template.variables) {
      templateValues[v.name] = v.placeholder;
    }
    showPreview = true;
  }

  function insertTemplate() {
    if (onInsert && selectedTemplate) {
      onInsert(applyTemplate(selectedTemplate, templateValues));
    }
    selectedTemplate = null;
    showPreview = false;
  }

  function insertSnippet(snippet: Snippet) {
    if (onInsert) {
      onInsert(snippet.content);
    }
  }

  function insertCustom(func: CustomFunction) {
    if (onInsert) {
      onInsert(func.content);
    }
  }

  function addCustomFunction() {
    if (!newFuncName || !newFuncContent) return;

    const newFunc: CustomFunction = {
      id: `custom_${Date.now()}`,
      name: newFuncName,
      description: newFuncDesc,
      content: newFuncContent,
      language: newFuncLang,
      createdAt: new Date().toISOString()
    };

    customFunctions = [...customFunctions, newFunc];
    saveCustomFunctions(customFunctions);

    // Reset form
    newFuncName = '';
    newFuncDesc = '';
    newFuncContent = '';
    showNewForm = false;
  }

  function deleteCustomFunction(id: string) {
    customFunctions = customFunctions.filter(f => f.id !== id);
    saveCustomFunctions(customFunctions);
  }

  function getLangIcon(lang: string): string {
    const icons: Record<string, string> = {
      sql: '🗄️',
      python: '🐍',
      py: '🐍',
      javascript: '📜',
      js: '📜',
      typescript: '📘',
      ts: '📘',
      html: '🌐',
      css: '🎨',
      json: '📋',
      yaml: '📝',
      bash: '💻',
      shell: '💻'
    };
    return icons[lang] || '📄';
  }
</script>

<div class="functions-library">
  <!-- Header -->
  <div class="library-header">
    <h3>Bibliothèque</h3>
    <input
      type="text"
      class="search-input"
      placeholder="Rechercher..."
      bind:value={searchQuery}
    />
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button
      class="tab"
      class:active={activeTab === 'templates'}
      onclick={() => activeTab = 'templates'}
    >
      Templates
    </button>
    <button
      class="tab"
      class:active={activeTab === 'snippets'}
      onclick={() => activeTab = 'snippets'}
    >
      Snippets
    </button>
    <button
      class="tab"
      class:active={activeTab === 'custom'}
      onclick={() => activeTab = 'custom'}
    >
      Mes fonctions
    </button>
  </div>

  <!-- Content -->
  <div class="library-content">
    {#if activeTab === 'templates'}
      <div class="items-list">
        {#each filteredTemplates() as template}
          <button
            class="item-card"
            onclick={() => selectTemplate(template)}
          >
            <span class="item-icon">{getLangIcon(template.language)}</span>
            <div class="item-info">
              <span class="item-name">{template.name}</span>
              <span class="item-desc">{template.description}</span>
            </div>
            <span class="item-lang">{template.language}</span>
          </button>
        {:else}
          <p class="empty-message">Aucun template trouvé</p>
        {/each}
      </div>

    {:else if activeTab === 'snippets'}
      <div class="items-list">
        {#each filteredSnippets() as snippet}
          <button
            class="item-card snippet-card"
            onclick={() => insertSnippet(snippet)}
          >
            <span class="snippet-trigger">{snippet.trigger}</span>
            <span class="snippet-arrow">→</span>
            <span class="snippet-desc">{snippet.description}</span>
            <span class="item-lang">{snippet.language}</span>
          </button>
        {:else}
          <p class="empty-message">Aucun snippet trouvé</p>
        {/each}
      </div>

    {:else if activeTab === 'custom'}
      <div class="custom-header">
        <button class="add-btn" onclick={() => showNewForm = !showNewForm}>
          {showNewForm ? '✕ Annuler' : '+ Nouvelle fonction'}
        </button>
      </div>

      {#if showNewForm}
        <div class="new-func-form">
          <input
            type="text"
            placeholder="Nom de la fonction"
            bind:value={newFuncName}
          />
          <input
            type="text"
            placeholder="Description"
            bind:value={newFuncDesc}
          />
          <select bind:value={newFuncLang}>
            <option value="sql">SQL</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="bash">Bash</option>
            <option value="yaml">YAML</option>
          </select>
          <textarea
            placeholder="Contenu de la fonction..."
            bind:value={newFuncContent}
            rows="5"
          ></textarea>
          <button class="save-btn" onclick={addCustomFunction}>
            Enregistrer
          </button>
        </div>
      {/if}

      <div class="items-list">
        {#each filteredCustom() as func}
          <div class="item-card custom-card">
            <button class="custom-main" onclick={() => insertCustom(func)}>
              <span class="item-icon">{getLangIcon(func.language)}</span>
              <div class="item-info">
                <span class="item-name">{func.name}</span>
                <span class="item-desc">{func.description}</span>
              </div>
            </button>
            <button
              class="delete-btn"
              onclick={() => deleteCustomFunction(func.id)}
              title="Supprimer"
            >
              🗑️
            </button>
          </div>
        {:else}
          <p class="empty-message">
            {showNewForm ? '' : 'Aucune fonction personnalisée. Cliquez sur + pour en créer une.'}
          </p>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Template Preview Modal -->
  {#if showPreview && selectedTemplate}
    <div
      class="preview-overlay"
      onclick={() => showPreview = false}
      onkeydown={(e) => e.key === 'Escape' && (showPreview = false)}
      role="button"
      tabindex="-1"
    >
      <div
        class="preview-modal"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div class="preview-header">
          <h4>{selectedTemplate.name}</h4>
          <button class="close-btn" onclick={() => showPreview = false}>✕</button>
        </div>

        <div class="preview-variables">
          {#each selectedTemplate.variables as variable}
            <div class="variable-input">
              <label for={variable.name}>{variable.description}</label>
              <input
                id={variable.name}
                type="text"
                bind:value={templateValues[variable.name]}
                placeholder={variable.placeholder}
              />
            </div>
          {/each}
        </div>

        <div class="preview-content">
          <pre><code>{previewContent()}</code></pre>
        </div>

        <div class="preview-actions">
          <button class="cancel-btn" onclick={() => showPreview = false}>
            Annuler
          </button>
          <button class="insert-btn" onclick={insertTemplate}>
            Insérer
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .functions-library {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
    border-radius: 8px;
    overflow: hidden;
  }

  .library-header {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .library-header h3 {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: var(--accent-primary);
  }

  .search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 13px;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-primary);
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
  }

  .tab {
    flex: 1;
    padding: 10px;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab:hover {
    background: var(--bg-hover);
  }

  .tab.active {
    color: var(--accent-primary);
    border-bottom: 2px solid var(--accent-primary);
    margin-bottom: -1px;
  }

  .library-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .item-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .item-card:hover {
    border-color: var(--accent-primary);
    background: var(--bg-hover);
  }

  .item-icon {
    font-size: 18px;
  }

  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .item-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 13px;
  }

  .item-desc {
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-lang {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--bg-secondary);
    border-radius: 4px;
    color: var(--text-secondary);
  }

  .snippet-card {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    align-items: center;
  }

  .snippet-trigger {
    font-family: monospace;
    font-weight: bold;
    color: var(--accent-primary);
    background: var(--bg-secondary);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .snippet-arrow {
    color: var(--text-secondary);
    font-size: 12px;
  }

  .snippet-desc {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .custom-header {
    margin-bottom: 8px;
  }

  .add-btn {
    width: 100%;
    padding: 8px;
    border: 1px dashed var(--accent-primary);
    border-radius: 6px;
    background: transparent;
    color: var(--accent-primary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-btn:hover {
    background: var(--bg-hover);
  }

  .new-func-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    margin-bottom: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
  }

  .new-func-form input,
  .new-func-form select,
  .new-func-form textarea {
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 12px;
  }

  .new-func-form textarea {
    font-family: monospace;
    resize: vertical;
  }

  .save-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    font-weight: 500;
    cursor: pointer;
  }

  .save-btn:hover {
    opacity: 0.9;
  }

  .custom-card {
    display: flex;
    padding: 0;
  }

  .custom-main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
  }

  .delete-btn {
    padding: 10px;
    border: none;
    background: none;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .delete-btn:hover {
    opacity: 1;
  }

  .empty-message {
    text-align: center;
    color: var(--text-secondary);
    font-size: 12px;
    padding: 20px;
  }

  /* Preview Modal */
  .preview-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .preview-modal {
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .preview-header h4 {
    margin: 0;
    color: var(--accent-primary);
  }

  .close-btn {
    padding: 4px 8px;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 18px;
    cursor: pointer;
  }

  .preview-variables {
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
    max-height: 200px;
    overflow-y: auto;
  }

  .variable-input {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .variable-input:last-child {
    margin-bottom: 0;
  }

  .variable-input label {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .variable-input input {
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 13px;
  }

  .variable-input input:focus {
    outline: none;
    border-color: var(--accent-primary);
  }

  .preview-content {
    flex: 1;
    overflow: auto;
    padding: 16px;
    background: var(--bg-secondary);
  }

  .preview-content pre {
    margin: 0;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .preview-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color);
  }

  .cancel-btn,
  .insert-btn {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-btn {
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--text-secondary);
  }

  .cancel-btn:hover {
    background: var(--bg-hover);
  }

  .insert-btn {
    border: none;
    background: var(--accent-primary);
    color: var(--bg-primary);
    font-weight: 500;
  }

  .insert-btn:hover {
    opacity: 0.9;
  }
</style>
