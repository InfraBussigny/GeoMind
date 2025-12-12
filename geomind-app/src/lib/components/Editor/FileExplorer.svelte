<script lang="ts">
  import { listDirectory, readFile, listDrives } from '$lib/services/api';
  import { appMode } from '$lib/stores/app';

  interface FileNode {
    name: string;
    path: string;
    isDirectory: boolean;
    isExpanded?: boolean;
    children?: FileNode[];
    isLoading?: boolean;
    label?: string;
  }

  interface Props {
    rootPath?: string;
    onFileSelect?: (path: string, content: string) => void;
  }

  let { rootPath = 'C:/Users/zema/GeoMind', onFileSelect }: Props = $props();

  let files = $state<FileNode[]>([]);
  let drives = $state<FileNode[]>([]);
  let currentRoot = $state(rootPath);
  let selectedPath = $state<string | null>(null);
  let searchQuery = $state('');
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let showDrives = $state(false);

  // Charger les disques au démarrage en mode expert/god
  $effect(() => {
    if ($appMode === 'expert' || $appMode === 'god') {
      loadDrives();
    }
  });

  async function loadDrives() {
    try {
      const driveList = await listDrives();
      drives = driveList.map(d => ({
        name: d.name,
        path: d.path,
        label: d.label,
        isDirectory: true,
        isExpanded: false,
        children: []
      }));
    } catch (e) {
      console.error('Error loading drives:', e);
    }
  }

  function selectDrive(drive: FileNode) {
    currentRoot = drive.path;
    showDrives = false;
    loadRootDirectory();
  }

  function goUp() {
    const parts = currentRoot.replace(/\/$/, '').split('/');
    if (parts.length > 1) {
      parts.pop();
      currentRoot = parts.join('/') || parts[0] + '/';
      loadRootDirectory();
    } else {
      showDrives = true;
    }
  }

  // File type icons and colors
  const fileTypes: Record<string, { icon: string; color: string }> = {
    sql: { icon: 'database', color: 'var(--accent-cyan)' },
    py: { icon: 'python', color: 'var(--warning)' },
    json: { icon: 'braces', color: 'var(--accent-purple)' },
    geojson: { icon: 'globe', color: 'var(--cyber-green)' },
    js: { icon: 'js', color: 'var(--warning)' },
    ts: { icon: 'ts', color: 'var(--accent-cyan)' },
    md: { icon: 'doc', color: 'var(--text-secondary)' },
    fmw: { icon: 'workflow', color: 'var(--accent-pink)' },
    qgs: { icon: 'layers', color: 'var(--success)' },
    xml: { icon: 'code', color: 'var(--accent-orange)' },
    sh: { icon: 'terminal', color: 'var(--cyber-green)' },
    bat: { icon: 'terminal', color: 'var(--accent-cyan)' },
    csv: { icon: 'table', color: 'var(--success)' },
    txt: { icon: 'doc', color: 'var(--text-muted)' },
  };

  function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  function getFileType(filename: string) {
    const ext = getFileExtension(filename);
    return fileTypes[ext] || { icon: 'file', color: 'var(--text-muted)' };
  }

  // Load root directory on mount
  $effect(() => {
    loadRootDirectory();
  });

  async function loadDirectory(path: string): Promise<FileNode[]> {
    try {
      const entries = await listDirectory(path);
      // API returns array directly: [{name, isDirectory, isFile}]
      if (Array.isArray(entries)) {
        return entries
          .map((entry: any) => ({
            name: entry.name,
            path: `${path}/${entry.name}`.replace(/\\/g, '/').replace(/\/+/g, '/'),
            isDirectory: entry.isDirectory,
            isExpanded: false,
            children: entry.isDirectory ? [] : undefined,
            isLoading: false,
          }))
          .sort((a: FileNode, b: FileNode) => {
            // Directories first, then alphabetically
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          });
      }
      return [];
    } catch (e) {
      console.error('Error loading directory:', e);
      return [];
    }
  }

  async function loadRootDirectory() {
    isLoading = true;
    error = null;
    showDrives = false;
    try {
      files = await loadDirectory(currentRoot);
    } catch (e) {
      error = 'Impossible de charger le repertoire';
    } finally {
      isLoading = false;
    }
  }

  async function toggleDirectory(node: FileNode) {
    if (!node.isDirectory) return;

    if (node.isExpanded) {
      node.isExpanded = false;
    } else {
      node.isLoading = true;
      node.children = await loadDirectory(node.path);
      node.isExpanded = true;
      node.isLoading = false;
    }
    files = [...files]; // Trigger reactivity
  }

  async function selectFile(node: FileNode) {
    if (node.isDirectory) {
      toggleDirectory(node);
      return;
    }

    selectedPath = node.path;

    try {
      const result = await readFile(node.path);
      if (result.success && result.content !== undefined) {
        onFileSelect?.(node.path, result.content);
      }
    } catch (e) {
      console.error('Error reading file:', e);
    }
  }

  // Filter files based on search query
  function filterNodes(nodes: FileNode[], query: string): FileNode[] {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();

    return nodes.filter(node => {
      if (node.name.toLowerCase().includes(lowerQuery)) return true;
      if (node.isDirectory && node.children) {
        const filteredChildren = filterNodes(node.children, query);
        return filteredChildren.length > 0;
      }
      return false;
    });
  }

  let filteredFiles = $derived(filterNodes(files, searchQuery));

  function refresh() {
    loadRootDirectory();
  }
</script>

<div class="file-explorer">
  <!-- Navigation bar (expert/god mode) -->
  {#if $appMode === 'expert' || $appMode === 'god'}
    <div class="nav-bar">
      <button class="nav-btn" onclick={goUp} title="Dossier parent">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 15l-6-6-6 6"/>
        </svg>
      </button>
      <button class="nav-btn drives-btn" onclick={() => showDrives = !showDrives} title="Afficher les disques">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="4" width="20" height="5" rx="1"/>
          <rect x="2" y="10" width="20" height="5" rx="1"/>
          <rect x="2" y="16" width="20" height="5" rx="1"/>
        </svg>
      </button>
      <span class="current-path" title={currentRoot}>{currentRoot}</span>
    </div>
  {/if}

  <!-- Search bar -->
  <div class="search-bar">
    <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
    <input
      type="text"
      placeholder="Rechercher..."
      bind:value={searchQuery}
      class="search-input"
    />
    <button class="refresh-btn" onclick={refresh} title="Actualiser">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
    </button>
  </div>

  <!-- Drives list (when showDrives) -->
  {#if showDrives && drives.length > 0}
    <div class="drives-list">
      {#each drives as drive}
        <button class="drive-item" onclick={() => selectDrive(drive)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M6 8h.01"/>
          </svg>
          <span class="drive-name">{drive.name}</span>
          <span class="drive-label">{drive.label}</span>
        </button>
      {/each}
    </div>
  {:else}
    <!-- File tree -->
    <div class="file-tree">
      {#if isLoading}
        <div class="loading">Chargement...</div>
      {:else if error}
        <div class="error">{error}</div>
      {:else if filteredFiles.length === 0}
        <div class="empty">Aucun fichier</div>
      {:else}
        {#each filteredFiles as node}
          {@render fileNode(node, 0)}
        {/each}
      {/if}
    </div>
  {/if}
</div>

{#snippet fileNode(node: FileNode, depth: number)}
  <div class="file-node" style="--depth: {depth}">
    <button
      class="node-btn"
      class:selected={selectedPath === node.path}
      class:directory={node.isDirectory}
      onclick={() => selectFile(node)}
    >
      <!-- Expand icon for directories -->
      {#if node.isDirectory}
        <svg
          class="expand-icon"
          class:expanded={node.isExpanded}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      {:else}
        <span class="expand-spacer"></span>
      {/if}

      <!-- File/folder icon -->
      <span class="file-icon" style="color: {node.isDirectory ? 'var(--warning)' : getFileType(node.name).color}">
        {#if node.isDirectory}
          {#if node.isExpanded}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v12z"/>
            </svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          {/if}
        {:else}
          {@const fileType = getFileType(node.name)}
          {#if fileType.icon === 'database'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          {:else if fileType.icon === 'python'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2c-1.5 0-2.5.5-3 1.5V6h6v1H7.5C6 7 4.5 8.5 4.5 11c0 2 1 3.5 2.5 4h1v-2c0-1.5 1-2.5 2.5-2.5H15c1 0 2-.5 2-1.5V4c0-1-1-2-2-2h-3zm-1 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
              <path d="M12 22c1.5 0 2.5-.5 3-1.5V18H9v-1h7.5c1.5 0 3-1.5 3-4 0-2-1-3.5-2.5-4h-1v2c0 1.5-1 2.5-2.5 2.5H9c-1 0-2 .5-2 1.5v5c0 1 1 2 2 2h3zm1-2a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
            </svg>
          {:else if fileType.icon === 'braces'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/>
              <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>
            </svg>
          {:else if fileType.icon === 'globe'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>
            </svg>
          {:else if fileType.icon === 'terminal'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 17 10 11 4 5"/>
              <line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          {/if}
        {/if}
      </span>

      <!-- File name -->
      <span class="file-name">{node.name}</span>

      <!-- Loading indicator -->
      {#if node.isLoading}
        <span class="loading-indicator"></span>
      {/if}
    </button>

    <!-- Children (recursive) -->
    {#if node.isDirectory && node.isExpanded && node.children}
      <div class="children">
        {#each node.children as child}
          {@render fileNode(child, depth + 1)}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<style>
  .file-explorer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--noir-surface);
  }

  .nav-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-color);
    background: var(--noir-card);
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .nav-btn:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
  }

  .current-path {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .drives-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    overflow-y: auto;
  }

  .drive-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: var(--noir-card);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .drive-item:hover {
    background: var(--bg-hover);
    border-left: 2px solid var(--cyber-green);
  }

  .drive-item svg {
    color: var(--accent-cyan);
  }

  .drive-name {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 12px;
  }

  .drive-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
    background: var(--noir-card);
  }

  .search-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--noir-surface);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 11px;
    outline: none;
  }

  .search-input:focus {
    border-color: var(--cyber-green);
    box-shadow: 0 0 4px var(--cyber-green-glow);
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .refresh-btn:hover {
    background: var(--bg-hover);
    color: var(--cyber-green);
  }

  .file-tree {
    flex: 1;
    overflow: auto;
    padding: 4px 0;
  }

  .loading,
  .error,
  .empty {
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
  }

  .error {
    color: var(--error);
  }

  .file-node {
    --indent: calc(var(--depth) * 12px);
  }

  .node-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 4px 8px;
    padding-left: calc(8px + var(--indent));
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-mono);
    font-size: 12px;
    transition: all 0.1s;
  }

  .node-btn:hover {
    background: var(--bg-hover);
    color: var(--text-bright);
  }

  .node-btn.selected {
    background: rgba(0, 255, 136, 0.1);
    color: var(--cyber-green);
  }

  .node-btn.directory {
    color: var(--text-primary);
  }

  .expand-icon {
    flex-shrink: 0;
    color: var(--text-muted);
    transition: transform 0.15s;
  }

  .expand-icon.expanded {
    transform: rotate(90deg);
  }

  .expand-spacer {
    width: 12px;
    flex-shrink: 0;
  }

  .file-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loading-indicator {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-color);
    border-top-color: var(--cyber-green);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .children {
    /* Indent handled by CSS variable */
  }
</style>
