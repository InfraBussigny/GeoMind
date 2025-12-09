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
  import { getProviders, streamMessage } from '$lib/services/api';
  import ProviderSelector from './ProviderSelector.svelte';

  let inputValue = $state('');
  let messagesContainer: HTMLDivElement;
  let streamingContent = $state('');

  onMount(async () => {
    await checkBackendAndLoadProviders();
  });

  async function checkBackendAndLoadProviders() {
    try {
      const loadedProviders = await getProviders();
      providers.set(loadedProviders);
      backendConnected.set(true);

      // Set default provider to first configured one
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
    if (!inputValue.trim() || $isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    messages.update(m => [...m, userMessage]);
    const userInput = inputValue;
    inputValue = '';
    isLoading.set(true);
    streamingContent = '';

    await tick();
    scrollToBottom();

    // Create placeholder for assistant message
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
      // Build conversation history
      const history = $messages.slice(0, -1).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      await streamMessage(
        $currentProvider,
        $currentModel,
        history,
        undefined, // tools
        (chunk) => {
          // On chunk received
          streamingContent += chunk;
          messages.update(msgs => {
            const idx = msgs.findIndex(m => m.id === assistantMessageId);
            if (idx !== -1) {
              msgs[idx].content = streamingContent;
            }
            return [...msgs];
          });
          scrollToBottom();
        },
        () => {
          // On done
          isLoading.set(false);
          streamingContent = '';
        },
        (error) => {
          // On error
          messages.update(msgs => {
            const idx = msgs.findIndex(m => m.id === assistantMessageId);
            if (idx !== -1) {
              msgs[idx].content = `Erreur: ${error}`;
            }
            return [...msgs];
          });
          isLoading.set(false);
          streamingContent = '';
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
      isLoading.set(false);
    }
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

  function clearChat() {
    messages.set([]);
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
</script>

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
                <span class="model-badge">{message.model.split('-').slice(0, 2).join(' ')}</span>
              {/if}
              <span class="message-time">{formatTime(message.timestamp)}</span>
            </div>
            <div class="message-text">{@html formatMessage(message.content)}</div>
          </div>
        </div>
      {/each}

      {#if $isLoading && !streamingContent}
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

  <div class="input-container">
    <div class="input-wrapper">
      <textarea
        bind:value={inputValue}
        placeholder={$backendConnected ? "Ecrivez votre message..." : "Demarrez le backend pour commencer..."}
        onkeydown={handleKeydown}
        rows="1"
        disabled={!$backendConnected}
      ></textarea>
      <button
        class="send-btn"
        onclick={sendMessage}
        disabled={!inputValue.trim() || $isLoading || !$backendConnected}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </div>
    <div class="input-footer">
      <span class="model-info">
        {#if $backendConnected}
          Utilisant {$currentModel.split('-').slice(0, 2).join(' ')}
        {/if}
      </span>
    </div>
  </div>
</div>

<script context="module" lang="ts">
  function formatMessage(content: string): string {
    // Basic markdown-like formatting
    return content
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
</script>

<style>
  .chat-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
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

  .message-text :global(code) {
    background: rgba(0,0,0,0.1);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  .message-text :global(pre) {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: var(--spacing-md);
    border-radius: var(--border-radius-sm);
    overflow-x: auto;
    margin: var(--spacing-sm) 0;
  }

  .message-text :global(pre code) {
    background: none;
    padding: 0;
    color: inherit;
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

  .input-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--spacing-xs);
  }

  .model-info {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }
</style>
