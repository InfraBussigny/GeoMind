<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    messages,
    isLoading,
    currentProvider,
    currentModel,
    providers,
    backendConnected,
    type Message
  } from '$lib/stores/app';
  import { getProviders, streamMessage, type ToolUseEvent, type ToolResultEvent, type StreamController } from '$lib/services/api';
  import ProviderSelector from './ProviderSelector.svelte';
  import ArtifactPanel, { type Artifact, type ArtifactType } from './ArtifactPanel.svelte';

  interface ToolActivity {
    tool: string;
    input?: any;
    result?: any;
    status: 'running' | 'done';
  }

  let inputValue = $state('');
  let messagesContainer: HTMLDivElement;
  let streamingContent = $state('');
  let toolActivities = $state<ToolActivity[]>([]);

  // Gestion des Artifacts (Canevas)
  let currentArtifact = $state<Artifact | null>(null);
  let artifactHistory = $state<Artifact[]>([]);
  let streamingArtifact = $state<Artifact | null>(null); // Artifact en cours de streaming

  // Buffer de prompts et contrôle du streaming
  interface QueuedPrompt {
    id: string;
    content: string;
    timestamp: Date;
  }
  let promptQueue = $state<QueuedPrompt[]>([]);
  let editingPromptId = $state<string | null>(null);
  let editingPromptContent = $state('');
  let currentStreamController = $state<StreamController | null>(null);

  onMount(async () => {
    await checkBackendAndLoadProviders();
  });

  async function checkBackendAndLoadProviders() {
    try {
      const loadedProviders = await getProviders();
      providers.set(loadedProviders);
      backendConnected.set(true);

      const configuredProvider = loadedProviders.find(p => p.isConfigured);
      if (configuredProvider) {
        currentProvider.set(configuredProvider.id);
        const defaultModel = configuredProvider.models.find(m => m.default) || configuredProvider.models[0];
        if (defaultModel) {
          currentModel.set(defaultModel.id);
        }
      }
    } catch (error) {
      console.error('Backend not available:', error);
      backendConnected.set(false);
    }
  }

  async function sendMessage() {
    if (!inputValue.trim()) return;

    // Si l'IA est en cours de génération, ajouter au buffer
    if ($isLoading) {
      promptQueue = [...promptQueue, {
        id: crypto.randomUUID(),
        content: inputValue.trim(),
        timestamp: new Date()
      }];
      inputValue = '';
      return;
    }

    await processMessage(inputValue.trim());
    inputValue = '';
  }

  // Traiter un message (soit direct, soit depuis la queue)
  async function processMessage(content: string) {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    messages.update(m => [...m, userMessage]);
    isLoading.set(true);
    streamingContent = '';
    toolActivities = [];

    // Scroll immédiat après l'envoi du message
    await tick();
    scrollToBottom();
    setTimeout(() => scrollToBottom(), 50);

    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      provider: $currentProvider,
      model: $currentModel
    };
    messages.update(m => [...m, assistantMessage]);

    try {
      const history = $messages.slice(0, -1).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      currentStreamController = await streamMessage(
        $currentProvider,
        $currentModel,
        history,
        undefined,
        // onChunk
        (chunk) => {
          streamingContent += chunk;
          messages.update(msgs => {
            const idx = msgs.findIndex(m => m.id === assistantMessageId);
            if (idx !== -1) {
              msgs[idx].content = streamingContent;
            }
            return [...msgs];
          });
          detectStreamingCodeBlock(streamingContent);
          tick().then(() => scrollToBottom());
        },
        // onDone
        () => {
          finishGeneration();
          detectAndExtractArtifacts(streamingContent);
          streamingArtifact = null;
          streamingContent = '';
          processNextInQueue();
        },
        // onError
        (error) => {
          messages.update(msgs => {
            const idx = msgs.findIndex(m => m.id === assistantMessageId);
            if (idx !== -1) {
              msgs[idx].content = `Erreur: ${error}`;
            }
            return [...msgs];
          });
          finishGeneration();
          streamingContent = '';
        },
        // onToolUse
        (event) => {
          toolActivities = [...toolActivities, { tool: event.tool, input: event.input, status: 'running' }];
          scrollToBottom();
        },
        // onToolResult
        (event) => {
          toolActivities = toolActivities.map(t =>
            t.tool === event.tool && t.status === 'running'
              ? { ...t, result: event.result, status: 'done' as const }
              : t
          );
        },
        // onAborted
        () => {
          messages.update(msgs => {
            const idx = msgs.findIndex(m => m.id === assistantMessageId);
            if (idx !== -1 && msgs[idx].content) {
              msgs[idx].content += '\n\n*(Generation interrompue)*';
            }
            return [...msgs];
          });
          finishGeneration();
          streamingArtifact = null;
          streamingContent = '';
          processNextInQueue();
        }
      );
    } catch (error) {
      messages.update(msgs => {
        const idx = msgs.findIndex(m => m.id === assistantMessageId);
        if (idx !== -1) {
          msgs[idx].content = `Erreur de connexion: ${error}`;
        }
        return [...msgs];
      });
      finishGeneration();
    }
  }

  // Nettoyer après génération
  function finishGeneration() {
    isLoading.set(false);
    toolActivities = [];
    currentStreamController = null;
  }

  // Traiter le prochain message dans la queue
  function processNextInQueue() {
    if (promptQueue.length > 0) {
      const next = promptQueue[0];
      promptQueue = promptQueue.slice(1);
      processMessage(next.content);
    }
  }

  // Arrêter la génération en cours
  function stopGeneration() {
    if (currentStreamController) {
      currentStreamController.abort();
    }
  }

  // Gestion de la queue de prompts
  function removeFromQueue(id: string) {
    promptQueue = promptQueue.filter(p => p.id !== id);
  }

  function startEditingPrompt(prompt: QueuedPrompt) {
    editingPromptId = prompt.id;
    editingPromptContent = prompt.content;
  }

  function savePromptEdit() {
    if (editingPromptId) {
      promptQueue = promptQueue.map(p =>
        p.id === editingPromptId ? { ...p, content: editingPromptContent } : p
      );
      editingPromptId = null;
      editingPromptContent = '';
    }
  }

  function cancelPromptEdit() {
    editingPromptId = null;
    editingPromptContent = '';
  }

  // Détecter un bloc de code en cours de streaming (incomplet ou complet)
  function detectStreamingCodeBlock(content: string) {
    // Chercher un bloc de code ouvert (``` suivi de code)
    const openBlockMatch = content.match(/```(\w*)\n([\s\S]*)$/);

    if (openBlockMatch) {
      const language = openBlockMatch[1] || 'code';
      const code = openBlockMatch[2];

      // Vérifier si le bloc est fermé
      const isComplete = code.includes('```');
      const actualCode = isComplete ? code.split('```')[0].trim() : code;

      if (actualCode.length > 0) {
        // Déterminer le type
        let type: ArtifactType = 'code';
        if (language === 'sql') type = 'sql';
        else if (language === 'python' || language === 'py') type = 'python';
        else if (language === 'json') type = 'json';
        else if (language === 'markdown' || language === 'md') type = 'markdown';

        const title = isComplete ? generateTitle(actualCode, type) : `${language || 'Code'} en cours...`;

        // Créer un nouvel objet à chaque fois pour forcer la réactivité Svelte
        const newArtifact: Artifact = {
          id: 'streaming',
          type,
          title,
          content: actualCode,
          language,
          timestamp: new Date()
        };

        streamingArtifact = newArtifact;
        // Mettre à jour currentArtifact pour que le panneau se rafraîchisse
        currentArtifact = newArtifact;
      }
    } else if (streamingArtifact) {
      // Pas de bloc de code détecté, mais on avait un artifact en streaming
      // Ne rien faire - garder l'artifact actuel
    }
  }

  // Détecter et extraire les artifacts (blocs de code) de la réponse
  function detectAndExtractArtifacts(content: string) {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    const artifacts: Artifact[] = [];

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();

      // Déterminer le type d'artifact
      let type: ArtifactType = 'code';
      if (language === 'sql') type = 'sql';
      else if (language === 'python' || language === 'py') type = 'python';
      else if (language === 'json') type = 'json';
      else if (language === 'markdown' || language === 'md') type = 'markdown';

      // Générer un titre basé sur le contenu
      const title = generateTitle(code, type);

      artifacts.push({
        id: crypto.randomUUID(),
        type,
        title,
        content: code,
        language,
        timestamp: new Date()
      });
    }

    // Sauvegarder les artifacts dans l'historique
    if (artifacts.length > 0) {
      artifactHistory = [...artifactHistory, ...artifacts];
    }
  }

  // Générer un titre intelligent pour l'artifact
  function generateTitle(code: string, type: ArtifactType): string {
    const firstLine = code.split('\n')[0].trim();

    // Pour SQL, extraire le nom de table ou type de requête
    if (type === 'sql') {
      if (firstLine.toLowerCase().startsWith('select')) return 'Requete SELECT';
      if (firstLine.toLowerCase().startsWith('insert')) return 'Requete INSERT';
      if (firstLine.toLowerCase().startsWith('update')) return 'Requete UPDATE';
      if (firstLine.toLowerCase().startsWith('create')) return 'Creation de table';
      return 'Requete SQL';
    }

    // Pour Python, extraire le nom de fonction/classe
    if (type === 'python') {
      const funcMatch = firstLine.match(/def\s+(\w+)/);
      if (funcMatch) return `Fonction ${funcMatch[1]}`;
      const classMatch = firstLine.match(/class\s+(\w+)/);
      if (classMatch) return `Classe ${classMatch[1]}`;
      return 'Script Python';
    }

    // Pour JSON
    if (type === 'json') return 'Donnees JSON';

    // Par défaut
    return `Code ${type}`;
  }

  // Ouvrir un artifact dans le panneau
  function openArtifact(artifact: Artifact) {
    currentArtifact = artifact;
  }

  // Fermer le panneau d'artifact
  function closeArtifact() {
    currentArtifact = null;
  }

  // Mettre à jour le contenu d'un artifact
  function updateArtifact(content: string) {
    if (currentArtifact) {
      currentArtifact = { ...currentArtifact, content };
      // Mettre à jour aussi dans l'historique
      artifactHistory = artifactHistory.map(a =>
        a.id === currentArtifact!.id ? { ...a, content } : a
      );
    }
  }

  // Extraire les blocs de code d'un message pour affichage avec boutons
  function extractCodeBlocks(content: string): { text: string; codeBlocks: { language: string; code: string }[] } {
    const codeBlocks: { language: string; code: string }[] = [];
    const text = content.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      codeBlocks.push({ language: lang || 'text', code: code.trim() });
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
    return { text, codeBlocks };
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'instant'
      });
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  }

  // Formater le nom du modèle pour l'affichage
  function formatModelName(modelId: string): string {
    const modelNames: Record<string, string> = {
      'claude-sonnet-4-20250514': 'Claude Sonnet 4',
      'claude-opus-4-20250514': 'Claude Opus 4',
      'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
      'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'o1-preview': 'o1 Preview',
      'mistral-large-latest': 'Mistral Large',
      'codestral-latest': 'Codestral',
      'deepseek-chat': 'DeepSeek Chat',
      'deepseek-coder': 'DeepSeek Coder'
    };
    return modelNames[modelId] || modelId;
  }

  function clearChat() {
    messages.set([]);
    artifactHistory = [];
    currentArtifact = null;
  }

  // Formater le nom d'un outil pour l'affichage
  function formatToolName(toolName: string): string {
    const names: Record<string, string> = {
      'read_file': 'Lecture fichier',
      'write_file': 'Écriture fichier',
      'list_directory': 'Liste répertoire',
      'execute_command': 'Commande',
      'web_search': 'Recherche web',
      'web_fetch': 'Récupération web',
      'create_directory': 'Création dossier'
    };
    return names[toolName] || toolName;
  }

  // Formater l'input d'un outil pour l'affichage
  function formatToolInput(toolName: string, input: any): string {
    if (!input) return '';

    switch (toolName) {
      case 'read_file':
      case 'write_file':
      case 'list_directory':
      case 'create_directory':
        return input.path ? `${input.path.split(/[/\\]/).pop()}` : '';
      case 'execute_command':
        return input.command ? `${input.command.slice(0, 40)}${input.command.length > 40 ? '...' : ''}` : '';
      case 'web_search':
        return input.query ? `"${input.query}"` : '';
      case 'web_fetch':
        return input.url ? new URL(input.url).hostname : '';
      default:
        return JSON.stringify(input).slice(0, 30);
    }
  }

  function getProviderIcon(providerId: string): string {
    const icons: Record<string, string> = {
      claude: 'C',
      openai: 'O',
      mistral: 'M',
      deepseek: 'D',
      perplexity: 'P'
    };
    return icons[providerId] || '?';
  }

  // Formater le message avec support markdown amélioré
  // Les blocs de code sont masqués car affichés uniquement dans le Canevas
  function formatMessageContent(content: string): string {
    return content
      // Supprimer complètement les blocs de code (ils sont dans le Canevas)
      .replace(/```(\w*)\n([\s\S]*?)```/g, '')
      // Supprimer aussi les blocs de code en cours de streaming (non fermés)
      .replace(/```(\w*)\n([\s\S]*)$/g, '')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
      // Nettoyer les lignes vides consécutives
      .replace(/(<br>){3,}/g, '<br><br>');
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
</script>

<div class="chat-layout" class:with-artifact={currentArtifact !== null}>
  <!-- Zone de chat principale -->
  <div class="chat-module">
    <header class="chat-header">
      <div class="header-left">
        <h1>Assistant GeoBrain</h1>
        {#if $backendConnected}
          <span class="status connected">Backend connecte</span>
        {:else}
          <span class="status disconnected">Backend non disponible</span>
        {/if}
      </div>
      <div class="header-right">
        {#if artifactHistory.length > 0}
          <div class="artifact-counter" title="Artifacts generes">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>{artifactHistory.length}</span>
          </div>
        {/if}
        <ProviderSelector />
        <button class="clear-btn" onclick={clearChat} title="Effacer la conversation">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
          </svg>
        </button>
      </div>
    </header>

    <div class="messages-container" bind:this={messagesContainer}>
      {#if $messages.length === 0}
        <div class="welcome-message">
          <div class="welcome-icon">
            <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="45" fill="var(--bleu-bussigny)" opacity="0.1"/>
              <circle cx="50" cy="50" r="35" fill="var(--bleu-bussigny)" opacity="0.2"/>
              <text x="50" y="58" text-anchor="middle" font-size="32" fill="var(--bleu-bussigny)">GB</text>
            </svg>
          </div>
          <h2>Bienvenue dans GeoBrain</h2>
          <p>Assistant IA pour les geodonnees et le SIT de Bussigny</p>

          {#if !$backendConnected}
            <div class="backend-warning">
              <p><strong>Le serveur backend n'est pas demarre.</strong></p>
              <p>Ouvrez un nouveau terminal et lancez :</p>
              <code>cd geobrain-app/server && npm install && npm start</code>
            </div>
          {:else}
            <div class="suggestions">
              <button class="suggestion" onclick={() => { inputValue = 'Aide-moi a ecrire une requete SQL spatiale pour trouver les parcelles dans un rayon de 500m'; }}>
                Requete SQL spatiale
              </button>
              <button class="suggestion" onclick={() => { inputValue = 'Comment fonctionne le geoportail de Bussigny ?'; }}>
                Geoportail Bussigny
              </button>
              <button class="suggestion" onclick={() => { inputValue = 'Ecris un script PyQGIS pour exporter les batiments en GeoJSON'; }}>
                Script PyQGIS
              </button>
            </div>
          {/if}
        </div>
      {:else}
        {#each $messages as message (message.id)}
          <div class="message" class:user={message.role === 'user'} class:assistant={message.role === 'assistant'}>
            <div class="message-avatar">
              {#if message.role === 'user'}
                <span>MZ</span>
              {:else}
                <span class="provider-icon">{getProviderIcon(message.provider || $currentProvider)}</span>
              {/if}
            </div>
            <div class="message-content">
              <div class="message-header">
                {#if message.role === 'assistant' && message.model}
                  <span class="model-badge">{formatModelName(message.model)}</span>
                {/if}
                <span class="message-time">{formatTime(message.timestamp)}</span>
              </div>
              <div class="message-text">{@html formatMessageContent(message.content)}</div>
            </div>
          </div>
        {/each}

        {#if toolActivities.length > 0}
          <div class="tool-activities">
            {#each toolActivities as activity}
              <div class="tool-activity" class:running={activity.status === 'running'} class:done={activity.status === 'done'}>
                <div class="tool-icon">
                  {#if activity.status === 'running'}
                    <span class="spinner"></span>
                  {:else}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  {/if}
                </div>
                <div class="tool-info">
                  <span class="tool-name">{formatToolName(activity.tool)}</span>
                  {#if activity.input}
                    <span class="tool-input">{formatToolInput(activity.tool, activity.input)}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}

        {#if $isLoading && !streamingContent && toolActivities.length === 0}
          <div class="message assistant">
            <div class="message-avatar">
              <span class="provider-icon">{getProviderIcon($currentProvider)}</span>
            </div>
            <div class="message-content">
              <div class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Barre d'artifacts récents -->
    {#if artifactHistory.length > 0 || streamingArtifact}
      <div class="artifacts-bar">
        <span class="artifacts-label">Canevas</span>
        <div class="artifacts-list">
          {#if streamingArtifact}
            <button
              class="artifact-chip streaming active"
              onclick={() => { currentArtifact = streamingArtifact; }}
            >
              <div class="chip-icon-wrapper">
                <svg class="chip-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10">
                    <animate attributeName="stroke-dashoffset" values="0;60" dur="1s" repeatCount="indefinite"/>
                  </circle>
                </svg>
              </div>
              <div class="chip-text">
                <span class="chip-lang">{streamingArtifact.language || 'Code'}</span>
                <span class="chip-title">En cours...</span>
              </div>
            </button>
          {/if}
          {#each artifactHistory.slice(-5) as artifact}
            <button
              class="artifact-chip"
              class:active={currentArtifact?.id === artifact.id}
              onclick={() => openArtifact(artifact)}
            >
              <div class="chip-icon-wrapper" class:sql={artifact.type === 'sql'} class:python={artifact.type === 'python'} class:json={artifact.type === 'json'}>
                {#if artifact.type === 'sql'}
                  <svg class="chip-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                  </svg>
                {:else if artifact.type === 'python'}
                  <svg class="chip-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2c-1.7 0-3 .5-3.5 1.5v3c0 1 .8 1.5 2 1.5h3c1.7 0 3 1.3 3 3v2c0 1.5-1.5 2.5-3.5 2.5"/>
                    <path d="M12 22c1.7 0 3-.5 3.5-1.5v-3c0-1-.8-1.5-2-1.5h-3c-1.7 0-3-1.3-3-3v-2c0-1.5 1.5-2.5 3.5-2.5"/>
                    <circle cx="9" cy="6" r="1" fill="currentColor"/>
                    <circle cx="15" cy="18" r="1" fill="currentColor"/>
                  </svg>
                {:else if artifact.type === 'json'}
                  <svg class="chip-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/>
                    <path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1"/>
                  </svg>
                {:else}
                  <svg class="chip-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 18 22 12 16 6"/>
                    <polyline points="8 6 2 12 8 18"/>
                  </svg>
                {/if}
              </div>
              <div class="chip-text">
                <span class="chip-lang">{artifact.language || artifact.type}</span>
                <span class="chip-title">{artifact.title}</span>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- File d'attente des prompts -->
    {#if promptQueue.length > 0}
      <div class="prompt-queue">
        <div class="queue-header">
          <span class="queue-label">File d'attente ({promptQueue.length})</span>
        </div>
        <div class="queue-items">
          {#each promptQueue as prompt, index (prompt.id)}
            <div class="queue-item">
              <span class="queue-index">{index + 1}</span>
              {#if editingPromptId === prompt.id}
                <textarea
                  class="queue-edit-input"
                  bind:value={editingPromptContent}
                  rows="2"
                ></textarea>
                <div class="queue-edit-actions">
                  <button class="queue-btn save" onclick={savePromptEdit} title="Sauvegarder">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                  <button class="queue-btn cancel" onclick={cancelPromptEdit} title="Annuler">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              {:else}
                <span class="queue-content">{prompt.content}</span>
                <div class="queue-actions">
                  <button class="queue-btn edit" onclick={() => startEditingPrompt(prompt)} title="Modifier">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button class="queue-btn delete" onclick={() => removeFromQueue(prompt.id)} title="Supprimer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="input-container">
      <div class="input-wrapper">
        <textarea
          bind:value={inputValue}
          placeholder={$isLoading ? "Message en file d'attente..." : ($backendConnected ? "Ecrivez votre message..." : "Demarrez le backend pour commencer...")}
          onkeydown={handleKeydown}
          rows="1"
          disabled={!$backendConnected}
        ></textarea>
        {#if $isLoading}
          <button
            class="stop-btn"
            onclick={stopGeneration}
            title="Arreter la generation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          </button>
        {:else}
          <button
            class="send-btn"
            onclick={sendMessage}
            disabled={!inputValue.trim() || !$backendConnected}
            title="Envoyer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        {/if}
      </div>
      <div class="input-footer">
        <span class="model-info">
          {#if $backendConnected}
            {#if $isLoading}
              Generation en cours...
            {:else}
              Utilisant {$currentModel.split('-').slice(0, 2).join(' ')}
            {/if}
          {/if}
        </span>
        {#if promptQueue.length > 0}
          <span class="queue-info">{promptQueue.length} message(s) en attente</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Panneau Artifact (Canevas) -->
  {#if currentArtifact}
    <div class="artifact-sidebar">
      <ArtifactPanel
        artifact={currentArtifact}
        onClose={closeArtifact}
        onUpdate={updateArtifact}
        isStreaming={streamingArtifact !== null && currentArtifact?.id === 'streaming'}
      />
    </div>
  {/if}
</div>

<style>
  .chat-layout {
    display: flex;
    height: 100%;
    transition: all var(--transition-normal);
  }

  .chat-module {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .chat-layout.with-artifact .chat-module {
    flex: 1;
  }

  .artifact-sidebar {
    width: 450px;
    flex-shrink: 0;
    height: 100%;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .chat-header {
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    background: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .header-left h1 {
    font-size: var(--font-size-lg);
    color: var(--bleu-bussigny);
    margin: 0;
  }

  .status {
    font-size: var(--font-size-xs);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .status.connected {
    background: var(--success-light);
    color: var(--success);
  }

  .status.disconnected {
    background: var(--error-light);
    color: var(--error);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .artifact-counter {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--bleu-bussigny);
    color: white;
    border-radius: 12px;
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .artifact-counter svg {
    width: 14px;
    height: 14px;
  }

  .clear-btn {
    padding: var(--spacing-sm);
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .clear-btn:hover {
    background: var(--bg-secondary);
    color: var(--error);
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .welcome-message {
    text-align: center;
    padding: var(--spacing-xl);
    max-width: 600px;
    margin: auto;
  }

  .welcome-icon {
    margin-bottom: var(--spacing-md);
  }

  .welcome-message h2 {
    color: var(--bleu-bussigny);
    margin-bottom: var(--spacing-sm);
    font-size: var(--font-size-xl);
  }

  .welcome-message > p {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-lg);
  }

  .backend-warning {
    background: var(--warning-light);
    border: 1px solid var(--warning);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    text-align: left;
  }

  .backend-warning code {
    display: block;
    background: rgba(0,0,0,0.1);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius-sm);
    margin-top: var(--spacing-sm);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    justify-content: center;
  }

  .suggestion {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: all var(--transition-fast);
  }

  .suggestion:hover {
    background: var(--bleu-bussigny);
    color: white;
    border-color: var(--bleu-bussigny);
  }

  .message {
    display: flex;
    gap: var(--spacing-md);
    max-width: 85%;
  }

  .message.user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .message-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
    color: var(--text-secondary);
  }

  .message.assistant .message-avatar {
    background: var(--bleu-bussigny);
    color: white;
  }

  .provider-icon {
    font-family: var(--font-mono);
  }

  .message-content {
    background: var(--bg-secondary);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    border-top-left-radius: 4px;
    min-width: 100px;
  }

  .message.user .message-content {
    background: var(--bleu-bussigny);
    color: white;
    border-top-left-radius: var(--border-radius);
    border-top-right-radius: 4px;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
  }

  .model-badge {
    font-size: 10px;
    background: rgba(0,0,0,0.1);
    padding: 1px 6px;
    border-radius: 8px;
    text-transform: capitalize;
  }

  .message.user .model-badge {
    background: rgba(255,255,255,0.2);
  }

  .message-time {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .message.user .message-time {
    color: rgba(255,255,255,0.7);
  }

  .message-text {
    white-space: pre-wrap;
    line-height: 1.5;
    word-break: break-word;
  }

  .message-text :global(.inline-code) {
    background: rgba(0,0,0,0.1);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  .message-text :global(.code-block) {
    margin: var(--spacing-sm) 0;
    border-radius: var(--border-radius-sm);
    overflow: hidden;
  }

  .message-text :global(.code-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: #2d2d2d;
    color: #888;
    font-size: 12px;
  }

  .message-text :global(.code-copy-btn) {
    padding: 2px 8px;
    background: #444;
    color: #ccc;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
  }

  .message-text :global(.code-copy-btn:hover) {
    background: #555;
    color: white;
  }

  .message-text :global(.code-block pre) {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: var(--spacing-md);
    margin: 0;
    overflow-x: auto;
  }

  .message-text :global(.code-block code) {
    background: none;
    padding: 0;
    color: inherit;
    font-family: var(--font-mono);
    font-size: 13px;
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 4px 0;
  }

  .typing-indicator span {
    width: 8px;
    height: 8px;
    background: var(--gris-clair);
    border-radius: 50%;
    animation: typing 1.4s infinite;
  }

  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes typing {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-6px); }
  }

  /* Barre d'artifacts */
  .artifacts-bar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    overflow-x: auto;
  }

  .artifacts-label {
    font-size: var(--font-size-sm);
    color: var(--bleu-bussigny);
    font-weight: 600;
    flex-shrink: 0;
    padding: 4px 12px;
    background: rgba(54, 96, 146, 0.1);
    border-radius: 8px;
  }

  .artifacts-list {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .artifact-chip {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 8px 14px;
    background: white;
    border: 2px solid var(--border-color);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
    min-width: 140px;
  }

  .artifact-chip:hover {
    border-color: var(--bleu-bussigny);
    background: rgba(54, 96, 146, 0.05);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .artifact-chip.active {
    background: var(--bleu-bussigny);
    color: white;
    border-color: var(--bleu-bussigny);
  }

  .artifact-chip.streaming {
    border-color: var(--bleu-bussigny);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(54, 96, 146, 0.4); }
    50% { box-shadow: 0 0 0 6px rgba(54, 96, 146, 0); }
  }

  .chip-icon-wrapper {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .chip-icon-wrapper.sql { background: #e3f2fd; color: #1565c0; }
  .chip-icon-wrapper.python { background: #fff3e0; color: #e65100; }
  .chip-icon-wrapper.json { background: #f3e5f5; color: #7b1fa2; }

  .artifact-chip.active .chip-icon-wrapper {
    background: rgba(255,255,255,0.2);
    color: white;
  }

  .chip-svg {
    width: 18px;
    height: 18px;
  }

  .chip-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .chip-lang {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.7;
  }

  .chip-title {
    font-size: var(--font-size-sm);
    font-weight: 500;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .input-container {
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    background: white;
  }

  .input-wrapper {
    display: flex;
    gap: var(--spacing-sm);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-sm);
  }

  .input-wrapper:focus-within {
    border-color: var(--bleu-bussigny);
    box-shadow: 0 0 0 3px rgba(54, 96, 146, 0.1);
  }

  .input-wrapper textarea {
    flex: 1;
    resize: none;
    min-height: 24px;
    max-height: 150px;
    padding: var(--spacing-sm);
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: var(--font-size-md);
    outline: none;
  }

  .input-wrapper textarea:disabled {
    cursor: not-allowed;
  }

  .send-btn {
    width: 40px;
    height: 40px;
    border: none;
    background: var(--bleu-bussigny);
    color: white;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--bleu-bussigny-dark);
  }

  .send-btn:disabled {
    background: var(--gris-clair);
    cursor: not-allowed;
  }

  .stop-btn {
    width: 40px;
    height: 40px;
    border: none;
    background: var(--error);
    color: white;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    flex-shrink: 0;
    animation: pulse-stop 1.5s infinite;
  }

  .stop-btn:hover {
    background: #c0392b;
    transform: scale(1.05);
  }

  @keyframes pulse-stop {
    0%, 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4); }
    50% { box-shadow: 0 0 0 6px rgba(231, 76, 60, 0); }
  }

  .input-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--spacing-xs);
  }

  .model-info {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .queue-info {
    font-size: var(--font-size-xs);
    color: var(--bleu-bussigny);
    font-weight: 500;
  }

  /* File d'attente des prompts */
  .prompt-queue {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    padding: var(--spacing-sm) var(--spacing-lg);
  }

  .queue-header {
    margin-bottom: var(--spacing-sm);
  }

  .queue-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--bleu-bussigny);
  }

  .queue-items {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .queue-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: white;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    border-left: 3px solid var(--bleu-bussigny);
  }

  .queue-index {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bleu-bussigny);
    color: white;
    border-radius: 50%;
    font-size: var(--font-size-xs);
    font-weight: 600;
    flex-shrink: 0;
  }

  .queue-content {
    flex: 1;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .queue-edit-input {
    flex: 1;
    padding: var(--spacing-xs);
    border: 1px solid var(--bleu-bussigny);
    border-radius: var(--border-radius-sm);
    font-family: inherit;
    font-size: var(--font-size-sm);
    resize: none;
  }

  .queue-actions, .queue-edit-actions {
    display: flex;
    gap: var(--spacing-xs);
  }

  .queue-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .queue-btn:hover {
    background: var(--border-color);
  }

  .queue-btn.edit:hover {
    color: var(--bleu-bussigny);
  }

  .queue-btn.delete:hover {
    background: var(--error-light);
    color: var(--error);
  }

  .queue-btn.save {
    background: var(--success-light);
    color: var(--success);
  }

  .queue-btn.save:hover {
    background: var(--success);
    color: white;
  }

  .queue-btn.cancel:hover {
    background: var(--error-light);
    color: var(--error);
  }

  /* Tool Activities */
  .tool-activities {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    margin-left: 48px;
  }

  .tool-activity {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-secondary);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    border-left: 3px solid var(--gris-clair);
    transition: all var(--transition-fast);
  }

  .tool-activity.running {
    border-left-color: var(--bleu-bussigny);
    background: rgba(54, 96, 146, 0.05);
  }

  .tool-activity.done {
    border-left-color: var(--success);
    opacity: 0.7;
  }

  .tool-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .tool-activity.done .tool-icon {
    color: var(--success);
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--gris-clair);
    border-top-color: var(--bleu-bussigny);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .tool-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .tool-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .tool-input {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-family: var(--font-mono);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
