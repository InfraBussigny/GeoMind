<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    messages,
    isLoading,
    currentProvider,
    currentModel,
    chatContext,
    addMessage,
    clearMessages,
    getSystemPromptWithContext,
    type Message,
    type ChatContext,
    type ChatContextType
  } from '$lib/stores/app';
  import { streamMessage, type StreamController } from '$lib/services/api';
  import { get } from 'svelte/store';

  // Props
  interface Props {
    compact?: boolean;           // Mode compact pour sidebars
    showHeader?: boolean;        // Afficher le header avec provider
    showClearButton?: boolean;   // Afficher bouton effacer
    context?: ChatContext;       // Contexte spécifique (sinon utilise le store)
    placeholder?: string;        // Placeholder de l'input
    onCodeBlock?: (code: string, language: string) => void;  // Callback pour les blocs de code
  }

  let {
    compact = false,
    showHeader = true,
    showClearButton = true,
    context = undefined,
    placeholder = 'Ecrivez votre message...',
    onCodeBlock = undefined
  }: Props = $props();

  // Local state
  let inputValue = $state('');
  let messagesContainer: HTMLDivElement;
  let currentStreamController = $state<StreamController | null>(null);
  let streamingContent = $state('');

  // Derived - utilise le contexte passé en prop ou le store global
  let activeContext = $derived(context || $chatContext);

  // Auto-scroll
  function scrollToBottom() {
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 50);
    }
  }

  // Envoi de message
  async function sendMessage() {
    const messageText = inputValue.trim();
    if (!messageText || $isLoading) return;

    inputValue = '';
    isLoading.set(true);

    // Ajouter le message utilisateur
    addMessage({
      role: 'user',
      content: messageText,
      provider: $currentProvider,
      model: $currentModel
    });

    await tick();
    scrollToBottom();

    // Préparer les messages pour l'API
    const systemPrompt = getSystemPromptWithContext(activeContext);
    const apiMessages: Array<{role: 'user' | 'assistant' | 'system', content: string}> = [
      { role: 'system', content: systemPrompt },
      ...$messages.map(m => ({ role: m.role, content: m.content }))
    ];

    streamingContent = '';
    let fullResponse = '';

    try {
      currentStreamController = await streamMessage(
        $currentProvider,
        $currentModel,
        apiMessages,
        undefined,
        // onChunk
        (chunk: string) => {
          streamingContent += chunk;
          fullResponse += chunk;
          scrollToBottom();
        },
        // onDone
        () => {
          // Extraire les blocs de code si callback fourni
          if (onCodeBlock) {
            const codeBlocks = fullResponse.match(/```(\w+)?\n([\s\S]*?)```/g);
            if (codeBlocks) {
              codeBlocks.forEach(block => {
                const match = block.match(/```(\w+)?\n([\s\S]*?)```/);
                if (match) {
                  const lang = match[1] || 'plaintext';
                  const code = match[2];
                  onCodeBlock(code, lang);
                }
              });
            }
          }

          // Ajouter le message assistant
          addMessage({
            role: 'assistant',
            content: fullResponse,
            provider: $currentProvider,
            model: $currentModel
          });

          streamingContent = '';
          isLoading.set(false);
          currentStreamController = null;
          scrollToBottom();
        },
        // onError
        (error: string) => {
          addMessage({
            role: 'assistant',
            content: `Erreur: ${error}`,
            provider: $currentProvider,
            model: $currentModel
          });
          streamingContent = '';
          isLoading.set(false);
          currentStreamController = null;
        }
      );
    } catch (error) {
      console.error('[UnifiedChat] Error:', error);
      isLoading.set(false);
    }
  }

  // Stop la génération
  function stopGeneration() {
    if (currentStreamController) {
      currentStreamController.abort();
      if (streamingContent) {
        addMessage({
          role: 'assistant',
          content: streamingContent + '\n\n*(Génération interrompue)*',
          provider: $currentProvider,
          model: $currentModel
        });
      }
      streamingContent = '';
      isLoading.set(false);
      currentStreamController = null;
    }
  }

  // Handle Enter key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Format timestamp
  function formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  }

  // Format model name for display
  function formatModelName(model: string): string {
    const names: Record<string, string> = {
      'llama-3.3-70b-versatile': 'Llama 3.3',
      'llama-3.1-70b-versatile': 'Llama 3.1',
      'mixtral-8x7b-32768': 'Mixtral',
      'claude-3-5-haiku-20241022': 'Haiku',
      'claude-sonnet-4-20250514': 'Sonnet 4',
      'qwen2.5:14b': 'Qwen 2.5'
    };
    return names[model] || model.split('/').pop()?.split(':')[0] || model;
  }
</script>

<div class="unified-chat" class:compact>
  {#if showHeader && !compact}
    <div class="chat-header">
      <span class="provider-badge">{$currentProvider}</span>
      <span class="model-name">{formatModelName($currentModel)}</span>
      {#if showClearButton && $messages.length > 0}
        <button class="clear-btn" onclick={() => clearMessages()} title="Effacer l'historique">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      {/if}
    </div>
  {/if}

  <div class="messages-container" bind:this={messagesContainer}>
    {#if $messages.length === 0 && !streamingContent}
      <div class="empty-state">
        <p>Historique vide</p>
        <small>Les messages sont partagés entre tous les modules</small>
      </div>
    {:else}
      {#each $messages as message (message.id)}
        <div class="message {message.role}">
          {#if !compact}
            <div class="message-header">
              <span class="role">{message.role === 'user' ? 'Vous' : 'Assistant'}</span>
              <span class="time">{formatTime(message.timestamp)}</span>
            </div>
          {/if}
          <div class="message-content">
            {#if message.role === 'assistant'}
              {@html message.content
                .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>')}
            {:else}
              {message.content}
            {/if}
          </div>
        </div>
      {/each}

      {#if streamingContent}
        <div class="message assistant streaming">
          <div class="message-content">
            {@html streamingContent
              .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
              .replace(/`([^`]+)`/g, '<code>$1</code>')
              .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
              .replace(/\n/g, '<br>')}
            <span class="cursor">|</span>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <div class="input-container">
    <textarea
      bind:value={inputValue}
      onkeydown={handleKeydown}
      {placeholder}
      disabled={$isLoading}
      rows={compact ? 1 : 2}
    ></textarea>

    {#if $isLoading}
      <button class="stop-btn" onclick={stopGeneration} title="Arrêter">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
      </button>
    {:else}
      <button class="send-btn" onclick={sendMessage} disabled={!inputValue.trim()} title="Envoyer">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    {/if}
  </div>
</div>

<style>
  .unified-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary, #1a1a2e);
    border-radius: 8px;
    overflow: hidden;
  }

  .unified-chat.compact {
    border-radius: 4px;
  }

  .chat-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-tertiary, #16213e);
    border-bottom: 1px solid var(--border-color, #333);
  }

  .provider-badge {
    background: var(--accent-color, #00ff88);
    color: #000;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .model-name {
    font-size: 0.85rem;
    color: var(--text-secondary, #888);
  }

  .clear-btn {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--text-secondary, #888);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .clear-btn:hover {
    background: rgba(255, 100, 100, 0.2);
    color: #ff6464;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .compact .messages-container {
    padding: 8px;
    gap: 8px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary, #666);
    text-align: center;
  }

  .empty-state small {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .message {
    padding: 8px 12px;
    border-radius: 8px;
    max-width: 85%;
  }

  .compact .message {
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .message.user {
    background: var(--accent-color, #00ff88);
    color: #000;
    align-self: flex-end;
    margin-left: 15%;
  }

  .message.assistant {
    background: var(--bg-tertiary, #16213e);
    color: var(--text-primary, #fff);
    align-self: flex-start;
    margin-right: 15%;
    border: 1px solid var(--border-color, #333);
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .message-content {
    line-height: 1.5;
    word-break: break-word;
  }

  .message-content :global(pre) {
    background: rgba(0, 0, 0, 0.3);
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 8px 0;
  }

  .message-content :global(code) {
    font-family: 'Fira Code', monospace;
    font-size: 0.85em;
  }

  .message-content :global(pre code) {
    background: none;
    padding: 0;
  }

  .message-content :global(code:not(pre code)) {
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .streaming .cursor {
    animation: blink 0.7s infinite;
    color: var(--accent-color, #00ff88);
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  .input-container {
    display: flex;
    gap: 8px;
    padding: 12px;
    background: var(--bg-tertiary, #16213e);
    border-top: 1px solid var(--border-color, #333);
  }

  .compact .input-container {
    padding: 8px;
  }

  textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    padding: 8px 12px;
    background: var(--bg-primary, #0f0f23);
    color: var(--text-primary, #fff);
    font-family: inherit;
    font-size: 0.9rem;
  }

  .compact textarea {
    padding: 6px 10px;
    font-size: 0.85rem;
  }

  textarea:focus {
    outline: none;
    border-color: var(--accent-color, #00ff88);
  }

  textarea:disabled {
    opacity: 0.6;
  }

  .send-btn, .stop-btn {
    background: var(--accent-color, #00ff88);
    color: #000;
    border: none;
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-btn:not(:disabled):hover {
    filter: brightness(1.1);
    transform: scale(1.05);
  }

  .stop-btn {
    background: #ff4444;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
</style>
