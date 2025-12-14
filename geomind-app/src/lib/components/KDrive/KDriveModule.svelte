<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  // Types
  interface KDriveConfig {
    driveId: string;
    email: string;
    appPassword: string;
  }

  interface UploadedFile {
    id: string;
    name: string;
    size: number;
    uploadedAt: Date;
    path: string;
    shareLink?: string;
    shareEnabled: boolean;
  }

  interface KDriveFile {
    id: number;
    name: string;
    type: 'file' | 'dir';
    size?: number;
    lastModified?: string;
    path: string;
  }

  // State
  let config = $state<KDriveConfig>({
    driveId: '',
    email: '',
    appPassword: ''
  });
  let isConfigured = $state(false);
  let isConnecting = $state(false);
  let connectionError = $state<string | null>(null);

  let currentPath = $state('/');
  let files = $state<KDriveFile[]>([]);
  let isLoadingFiles = $state(false);

  // Breadcrumb for navigation (folder stack)
  interface FolderInfo {
    id: number;
    name: string;
  }
  let folderStack = $state<FolderInfo[]>([{ id: 1, name: 'Racine' }]);

  let selectedLocalFiles = $state<File[]>([]);
  let isUploading = $state(false);
  let uploadProgress = $state(0);
  let uploadStatus = $state('');

  let uploadHistory = $state<UploadedFile[]>([]);
  let showConfig = $state(false);
  let copiedLink = $state<string | null>(null);

  // Default config for Marc (using API token)
  const DEFAULT_CONFIG: KDriveConfig = {
    driveId: '2025713',
    email: 'marc.zermatten@gmail.com',
    appPassword: 'bc0-aSNG0XL0e8cnk6rEzQf_Mtiklo2EW4slw7CDfvezRDFnbsT43MKoCtUGyGSBnIdMjt9B8XbcGIGB'
  };

  // Load saved config on mount
  onMount(() => {
    if (!browser) return;
    const saved = localStorage.getItem('geomind-kdrive-config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        config = parsed;
        if (config.driveId && config.email && config.appPassword) {
          isConfigured = true;
          loadFiles();
        }
      } catch (e) {
        console.error('Error loading kDrive config:', e);
      }
    } else {
      // Use default config if nothing saved
      config = { ...DEFAULT_CONFIG };
      // Auto-connect with default config
      testConnection();
    }

    const history = localStorage.getItem('geomind-kdrive-history');
    if (history) {
      try {
        uploadHistory = JSON.parse(history);
      } catch (e) {
        console.error('Error loading upload history:', e);
      }
    }
  });

  function saveConfig() {
    if (!browser) return;
    localStorage.setItem('geomind-kdrive-config', JSON.stringify(config));
  }

  function saveHistory() {
    if (!browser) return;
    localStorage.setItem('geomind-kdrive-history', JSON.stringify(uploadHistory));
  }

  // API base URL (via backend proxy to avoid CORS)
  const API_BASE = 'http://localhost:3001/api/kdrive';

  // Current folder ID (root = 1)
  let currentFolderId = $state(1);

  // Auth header (Bearer token)
  function getAuthHeader(): string {
    return `Bearer ${config.appPassword}`;
  }

  // Test connection
  async function testConnection() {
    isConnecting = true;
    connectionError = null;

    try {
      const response = await fetch(`${API_BASE}/${config.driveId}/files`, {
        headers: {
          'Authorization': getAuthHeader()
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result === 'success') {
          isConfigured = true;
          saveConfig();
          showConfig = false;
          currentFolderId = 1;
          currentPath = '/';
          folderStack = [{ id: 1, name: 'Racine' }];
          await loadFiles();
        } else {
          connectionError = data.error?.description || 'Erreur inconnue';
        }
      } else if (response.status === 401) {
        connectionError = 'Token API invalide';
      } else {
        connectionError = `Erreur de connexion: ${response.status}`;
      }
    } catch (err) {
      connectionError = 'Impossible de se connecter a kDrive. Verifiez votre connexion.';
      console.error('Connection error:', err);
    } finally {
      isConnecting = false;
    }
  }

  // Load files from current folder
  async function loadFiles() {
    if (!isConfigured) return;
    isLoadingFiles = true;

    try {
      const url = currentFolderId === 1
        ? `${API_BASE}/${config.driveId}/files`
        : `${API_BASE}/${config.driveId}/files/${currentFolderId}/files`;

      const response = await fetch(url, {
        headers: {
          'Authorization': getAuthHeader()
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result === 'success') {
          files = (data.data || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            type: f.type === 'dir' ? 'dir' : 'file',
            size: f.size,
            lastModified: f.last_modified_at ? new Date(f.last_modified_at * 1000).toISOString() : undefined,
            path: f.path || `/${f.name}`
          }));
          // Sort: directories first, then alphabetically
          files = files.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        }
      } else {
        console.error('Error loading files:', response.status);
      }
    } catch (err) {
      console.error('Error loading files:', err);
    } finally {
      isLoadingFiles = false;
    }
  }

  // Navigate to folder (using folder ID)
  function navigateTo(folder: KDriveFile) {
    if (folder.type !== 'dir') return;

    // Add to folder stack
    folderStack = [...folderStack, { id: folder.id, name: folder.name }];
    currentFolderId = folder.id;
    currentPath = folderStack.map(f => f.name).join('/');
    loadFiles();
  }

  // Go up one level
  function goUp() {
    if (folderStack.length <= 1) return;

    // Pop from stack
    folderStack = folderStack.slice(0, -1);
    const parentFolder = folderStack[folderStack.length - 1];
    currentFolderId = parentFolder.id;
    currentPath = folderStack.length === 1 ? '/' : folderStack.map(f => f.name).join('/');
    loadFiles();
  }

  // Navigate to specific folder in breadcrumb
  function navigateToBreadcrumb(index: number) {
    if (index >= folderStack.length - 1) return;

    folderStack = folderStack.slice(0, index + 1);
    const targetFolder = folderStack[folderStack.length - 1];
    currentFolderId = targetFolder.id;
    currentPath = folderStack.length === 1 ? '/' : folderStack.map(f => f.name).join('/');
    loadFiles();
  }

  // Handle local file selection
  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      selectedLocalFiles = Array.from(input.files);
    }
  }

  // Upload files using REST API
  async function uploadFiles() {
    if (selectedLocalFiles.length === 0) return;
    isUploading = true;
    uploadProgress = 0;

    const total = selectedLocalFiles.length;
    let completed = 0;

    for (const file of selectedLocalFiles) {
      uploadStatus = `Upload de ${file.name}...`;

      try {
        // Use REST API upload endpoint
        const uploadUrl = `${API_BASE}/${config.driveId}/files/${currentFolderId}/upload`;

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': getAuthHeader()
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();

          // Add to history with the real file ID from response
          const uploadedFile: UploadedFile = {
            id: data.data?.id?.toString() || Date.now().toString(),
            name: file.name,
            size: file.size,
            uploadedAt: new Date(),
            path: currentPath + '/' + file.name,
            shareEnabled: false
          };
          uploadHistory = [uploadedFile, ...uploadHistory.slice(0, 49)];
          saveHistory();

          completed++;
          uploadProgress = Math.round((completed / total) * 100);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Upload failed:', response.status, errorData);
          uploadStatus = `Erreur upload ${file.name}: ${errorData.error?.description || response.status}`;
        }
      } catch (err) {
        console.error('Upload error:', err);
        uploadStatus = `Erreur upload ${file.name}`;
      }
    }

    uploadStatus = `${completed}/${total} fichiers uploades`;
    selectedLocalFiles = [];
    isUploading = false;

    // Refresh file list
    await loadFiles();

    // Clear status after 3 seconds
    setTimeout(() => {
      if (!isUploading) uploadStatus = '';
    }, 3000);
  }

  // Create share link (via REST API)
  async function createShareLink(file: UploadedFile) {
    try {
      // Use file ID to create share link
      const response = await fetch(`${API_BASE}/${config.driveId}/files/${file.id}/link`, {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          right: 'read',
          can_download: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        file.shareLink = data.data?.url || data.url;
        file.shareEnabled = true;
        uploadHistory = [...uploadHistory];
        saveHistory();
      } else {
        // Fallback: direct link to file in kDrive web interface
        const shareUrl = `https://kdrive.infomaniak.com/app/drive/${config.driveId}/files/${file.id}`;
        file.shareLink = shareUrl;
        file.shareEnabled = true;
        uploadHistory = [...uploadHistory];
        saveHistory();
      }
    } catch (err) {
      console.error('Error creating share link:', err);
      // Fallback URL
      const shareUrl = `https://kdrive.infomaniak.com/app/drive/${config.driveId}/files/${file.id}`;
      file.shareLink = shareUrl;
      file.shareEnabled = true;
      uploadHistory = [...uploadHistory];
      saveHistory();
    }
  }

  // Copy to clipboard
  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedLink = text;
      setTimeout(() => copiedLink = null, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  // Format file size
  function formatSize(bytes?: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  // Format date
  function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // Disconnect
  function disconnect() {
    isConfigured = false;
    config = { driveId: '', email: '', appPassword: '' };
    files = [];
    currentPath = '/';
    currentFolderId = 1;
    folderStack = [{ id: 1, name: 'Racine' }];
    localStorage.removeItem('geomind-kdrive-config');
    showConfig = true;
  }
</script>

<div class="kdrive-module">
  <!-- Header -->
  <div class="module-header">
    <div class="header-title">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
      </svg>
      <span>kDrive</span>
      {#if isConfigured}
        <span class="connected-badge">Connecte</span>
      {/if}
    </div>
    <div class="header-actions">
      {#if isConfigured}
        <button class="icon-btn" onclick={() => showConfig = !showConfig} title="Configuration">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  {#if !isConfigured || showConfig}
    <!-- Configuration Panel -->
    <div class="config-panel">
      <h3>Configuration kDrive</h3>
      <p class="config-help">
        Connectez votre kDrive Infomaniak pour envoyer et partager des fichiers.
      </p>

      <div class="config-form">
        <div class="form-group">
          <label for="driveId">ID du Drive</label>
          <input
            type="text"
            id="driveId"
            bind:value={config.driveId}
            placeholder="123456"
          />
          <span class="form-hint">Visible dans l'URL: drive.infomaniak.com/app/drive/<strong>[ID]</strong>/files</span>
        </div>

        <div class="form-group">
          <label for="email">Email Infomaniak</label>
          <input
            type="email"
            id="email"
            bind:value={config.email}
            placeholder="vous@example.com"
          />
        </div>

        <div class="form-group">
          <label for="appPassword">Mot de passe d'application</label>
          <input
            type="password"
            id="appPassword"
            bind:value={config.appPassword}
            placeholder="••••••••"
          />
          <span class="form-hint">
            Creez-en un sur <a href="https://manager.infomaniak.com/v3/profile/application-password" target="_blank">manager.infomaniak.com</a>
          </span>
        </div>

        {#if connectionError}
          <div class="error-msg">{connectionError}</div>
        {/if}

        <div class="form-actions">
          <button class="btn-primary" onclick={testConnection} disabled={isConnecting || !config.driveId || !config.email || !config.appPassword}>
            {#if isConnecting}
              <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              Connexion...
            {:else}
              Connecter
            {/if}
          </button>
          {#if isConfigured}
            <button class="btn-secondary" onclick={() => showConfig = false}>Annuler</button>
            <button class="btn-danger" onclick={disconnect}>Deconnecter</button>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <!-- Main Interface -->
    <div class="main-content">
      <!-- Upload Section -->
      <div class="upload-section">
        <h4>Envoyer des fichiers</h4>

        <div class="upload-zone">
          <input
            type="file"
            id="fileInput"
            multiple
            onchange={handleFileSelect}
            class="file-input"
          />
          <label for="fileInput" class="upload-label">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>Cliquez ou glissez des fichiers</span>
          </label>
        </div>

        {#if selectedLocalFiles.length > 0}
          <div class="selected-files">
            <span>{selectedLocalFiles.length} fichier(s) selectionne(s)</span>
            <ul>
              {#each selectedLocalFiles as file}
                <li>{file.name} ({formatSize(file.size)})</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if isUploading}
          <div class="upload-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {uploadProgress}%"></div>
            </div>
            <span class="progress-text">{uploadProgress}% - {uploadStatus}</span>
          </div>
        {:else if uploadStatus}
          <div class="upload-status">{uploadStatus}</div>
        {/if}

        <div class="upload-actions">
          <span class="current-path">Destination: {folderStack[folderStack.length - 1].name}</span>
          <button
            class="btn-upload"
            onclick={uploadFiles}
            disabled={selectedLocalFiles.length === 0 || isUploading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Envoyer
          </button>
        </div>
      </div>

      <!-- File Browser -->
      <div class="browser-section">
        <div class="browser-header">
          <h4>Parcourir kDrive</h4>
          <div class="browser-nav">
            <button class="nav-btn" onclick={goUp} disabled={folderStack.length <= 1} title="Remonter">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <div class="breadcrumb">
              {#each folderStack as folder, index}
                {#if index > 0}
                  <span class="breadcrumb-sep">/</span>
                {/if}
                <button
                  class="breadcrumb-item"
                  class:current={index === folderStack.length - 1}
                  onclick={() => navigateToBreadcrumb(index)}
                  disabled={index === folderStack.length - 1}
                >
                  {folder.name}
                </button>
              {/each}
            </div>
            <button class="nav-btn" onclick={() => loadFiles()} disabled={isLoadingFiles} title="Rafraichir">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spinning={isLoadingFiles}>
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="file-list">
          {#if isLoadingFiles}
            <div class="loading">Chargement...</div>
          {:else if files.length === 0}
            <div class="empty">Dossier vide</div>
          {:else}
            {#each files as file}
              <div
                class="file-item"
                class:folder={file.type === 'dir'}
                ondblclick={() => file.type === 'dir' && navigateTo(file)}
              >
                <div class="file-icon">
                  {#if file.type === 'dir'}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                    </svg>
                  {:else}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  {/if}
                </div>
                <span class="file-name">{file.name}</span>
                <span class="file-size">{file.type === 'file' ? formatSize(file.size) : ''}</span>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Upload History -->
      <div class="history-section">
        <h4>Fichiers envoyes recemment</h4>

        {#if uploadHistory.length === 0}
          <div class="empty-history">Aucun fichier envoye</div>
        {:else}
          <div class="history-list">
            {#each uploadHistory as file}
              <div class="history-item">
                <div class="history-info">
                  <span class="history-name">{file.name}</span>
                  <span class="history-meta">{formatSize(file.size)} - {formatDate(file.uploadedAt)}</span>
                </div>
                <div class="history-actions">
                  {#if file.shareLink}
                    <button
                      class="btn-copy"
                      onclick={() => copyToClipboard(file.shareLink!)}
                      class:copied={copiedLink === file.shareLink}
                    >
                      {#if copiedLink === file.shareLink}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Copie!
                      {:else}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                        Copier
                      {/if}
                    </button>
                  {:else}
                    <button class="btn-share" onclick={() => createShareLink(file)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"/>
                        <circle cx="6" cy="12" r="3"/>
                        <circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      Partager
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .kdrive-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  /* Header */
  .module-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .header-title svg {
    color: var(--accent-color, #3b82f6);
  }

  .connected-badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    background: rgba(52, 211, 153, 0.2);
    color: #34d399;
    border-radius: 4px;
    font-weight: 500;
  }

  .icon-btn {
    padding: 0.5rem;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  /* Config Panel */
  .config-panel {
    padding: 2rem;
    max-width: 500px;
    margin: 0 auto;
  }

  .config-panel h3 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
  }

  .config-help {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.4rem;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .form-group input {
    width: 100%;
    padding: 0.6rem 0.8rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .form-hint {
    display: block;
    margin-top: 0.3rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .form-hint a {
    color: var(--accent-color, #3b82f6);
  }

  .error-msg {
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 6px;
    color: #ef4444;
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .btn-primary, .btn-secondary, .btn-danger {
    padding: 0.6rem 1.25rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--accent-color, #3b82f6);
    border: none;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  .btn-danger {
    background: transparent;
    border: 1px solid #ef4444;
    color: #ef4444;
  }

  .btn-danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Main Content */
  .main-content {
    flex: 1;
    overflow: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Upload Section */
  .upload-section {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 1rem;
  }

  .upload-section h4 {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .upload-zone {
    position: relative;
    border: 2px dashed var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    transition: all 0.2s;
  }

  .upload-zone:hover {
    border-color: var(--accent-color, #3b82f6);
    background: rgba(59, 130, 246, 0.05);
  }

  .file-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .upload-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    pointer-events: none;
  }

  .selected-files {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .selected-files ul {
    margin: 0.5rem 0 0;
    padding-left: 1.25rem;
    color: var(--text-secondary);
  }

  .upload-progress {
    margin-top: 0.75rem;
  }

  .progress-bar {
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-color, #3b82f6);
    transition: width 0.3s;
  }

  .progress-text {
    display: block;
    margin-top: 0.4rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .upload-status {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #34d399;
  }

  .upload-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.75rem;
  }

  .current-path {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-family: monospace;
  }

  .btn-upload {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: var(--accent-color, #3b82f6);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-upload:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn-upload:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Browser Section */
  .browser-section {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 1rem;
    flex: 1;
    min-height: 200px;
    display: flex;
    flex-direction: column;
  }

  .browser-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .browser-header h4 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .browser-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .nav-btn {
    padding: 0.4rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .nav-btn:hover:not(:disabled) {
    color: var(--text-primary);
    border-color: var(--accent-color, #3b82f6);
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .breadcrumb-sep {
    color: var(--text-secondary);
    opacity: 0.5;
    font-size: 0.75rem;
  }

  .breadcrumb-item {
    background: transparent;
    border: none;
    padding: 0.2rem 0.4rem;
    font-size: 0.8rem;
    font-family: monospace;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .breadcrumb-item:hover:not(:disabled) {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .breadcrumb-item.current {
    color: var(--text-primary);
    font-weight: 500;
    cursor: default;
  }

  .breadcrumb-item:disabled {
    cursor: default;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  .file-list {
    flex: 1;
    overflow: auto;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
  }

  .loading, .empty {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--border-color);
    cursor: default;
    transition: background 0.15s;
  }

  .file-item:last-child {
    border-bottom: none;
  }

  .file-item:hover {
    background: var(--bg-secondary);
  }

  .file-item.folder {
    cursor: pointer;
  }

  .file-item.folder:hover {
    background: rgba(59, 130, 246, 0.1);
  }

  .file-icon {
    color: var(--text-secondary);
  }

  .file-item.folder .file-icon {
    color: #fbbf24;
  }

  .file-name {
    flex: 1;
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-size {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: monospace;
  }

  /* History Section */
  .history-section {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 1rem;
  }

  .history-section h4 {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .empty-history {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .history-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.75rem;
    background: var(--bg-primary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .history-info {
    flex: 1;
    min-width: 0;
  }

  .history-name {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .history-meta {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .history-actions {
    display: flex;
    gap: 0.4rem;
  }

  .btn-share, .btn-copy {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-share {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn-share:hover {
    border-color: var(--accent-color, #3b82f6);
    color: var(--text-primary);
  }

  .btn-copy {
    background: var(--accent-color, #3b82f6);
    border: none;
    color: white;
  }

  .btn-copy:hover {
    filter: brightness(1.1);
  }

  .btn-copy.copied {
    background: #34d399;
  }
</style>
