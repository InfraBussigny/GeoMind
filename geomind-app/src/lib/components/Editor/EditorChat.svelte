<script lang="ts">
  import { onMount } from 'svelte';
  import { streamMessage } from '$lib/services/api';
  import {
    currentProvider,
    currentModel,
    messages,
    isLoading,
    addMessage,
    clearMessages,
    setChatContext,
    getSystemPromptWithContext,
    type Message
  } from '$lib/stores/app';

  interface Props {
    currentFile?: string;
    currentLanguage?: string;
    selectedCode?: string;
    onInsertCode?: (code: string) => void;
  }

  let {
    currentFile = '',
    currentLanguage = 'plaintext',
    selectedCode = '',
    onInsertCode
  }: Props = $props();

  let inputValue = $state('');
  let messagesContainer: HTMLDivElement;
  let streamController: any = null;
  let streamingContent = $state('');

  // Quick actions
  const quickActions = [
    { label: 'Expliquer', prompt: 'Explique ce code en detail:', icon: '?' },
    { label: 'Corriger', prompt: 'Trouve et corrige les erreurs dans ce code:', icon: '!' },
    { label: 'Optimiser', prompt: 'Optimise ce code pour de meilleures performances:', icon: '^' },
    { label: 'Commenter', prompt: 'Ajoute des commentaires explicatifs a ce code:', icon: '#' },
  ];

  // Mettre a jour le contexte quand les props changent
  $effect(() => {
    setChatContext({
      type: 'editor',
      editorContext: {
        currentFile: currentFile,
        language: currentLanguage,
        selectedCode: selectedCode
      }
    });
  });

  function buildUserPrompt(basePrompt: string): string {
    let prompt = basePrompt;
    if (selectedCode) {
      prompt += `\n\nCode selectionne:\n\`\`\`${currentLanguage}\n${selectedCode}\n\`\`\``;
    }
    return prompt;
  }

  async function sendMessage(prompt?: string) {
    const messageText = prompt || inputValue.trim();
    if (!messageText || $isLoading) return;

    const userPrompt = buildUserPrompt(messageText);
    inputValue = '';
    isLoading.set(true);

    // Ajouter le message utilisateur
    addMessage({
      role: 'user',
      content: messageText,
      provider: $currentProvider,
      model: $currentModel
    });

    setTimeout(() => scrollToBottom(), 50);

    // Preparer les messages pour l'API
    const context = {
      type: 'editor' as const,
      editorContext: { currentFile, language: currentLanguage, selectedCode }
    };
    const systemPrompt = getSystemPromptWithContext(context);

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...$messages.map(m => ({ role: m.role, content: m.content }))
    ];

    streamingContent = '';
    let fullResponse = '';

    try {
      streamController = await streamMessage(
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
          addMessage({
            role: 'assistant',
            content: fullResponse,
            provider: $currentProvider,
            model: $currentModel
          });
          streamingContent = '';
          isLoading.set(false);
          streamController = null;
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
          streamController = null;
        }
      );
    } catch (e) {
      console.error('Error sending message:', e);
      isLoading.set(false);
    }
  }

  function stopGeneration() {
    if (streamController) {
      streamController.abort();
      streamController = null;
    }
    if (streamingContent) {
      addMessage({
        role: 'assistant',
        content: streamingContent + '\n\n*(Generation interrompue)*',
        provider: $currentProvider,
        model: $currentModel
      });
    }
    streamingContent = '';
    isLoading.set(false);
  }

  function executeQuickAction(action: typeof quickActions[0]) {
    if (!selectedCode) {
      inputValue = action.prompt + ' ';
      return;
    }
    sendMessage(action.prompt);
  }

  function extractCodeBlocks(content: string): string[] {
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
    const blocks: string[] = [];
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push(match[1].trim());
    }
    return blocks;
  }

  function insertCode(code: string) {
    onInsertCode?.(code);
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
    return new Date(date).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  }
</script>

<script module lang="ts">
  // Simple markdown-like formatting
  function formatMessage(content: string): string {
    let formatted = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    formatted = formatted.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre class="code-block"><code>$2</code></pre>'
    );
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }
</script>

<div class="editor-chat">
  <!-- Header -->
  <div class="chat-header">
    <span class="header-title">Assistant IA</span>
    <span class="shared-badge" title="Historique partage avec tous les modules">partage</span>
    <button class="clear-btn" onclick={() => clearMessages()} title="Effacer tout l'historique">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    </button>
  </div>

  <!-- Quick actions -->
  {#if selectedCode}
    <div class="quick-actions">
      <span class="selection-badge">Selection active</span>
      {#each quickActions as action}
        <button class="quick-btn" onclick={() => executeQuickAction(action)} title={action.prompt}>
          {action.label}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Messages -->
  <div class="messages" bind:this={messagesContainer}>
    {#if $messages.length === 0 && !streamingContent}
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>Posez une question sur votre code</p>
        <span class="hint">L'historique est partage entre tous les modules</span>
      </div>
    {:else}
      {#each $messages as message (message.id)}
        <div class="message {message.role}">
          <div class="message-header">
            <span class="role-badge">{message.role === 'user' ? 'Vous' : 'IA'}</span>
            <span class="time">{formatTime(message.timestamp)}</span>
          </div>
          <div class="message-content">
            {#if message.role === 'assistant'}
              {@html formatMessage(message.content)}

              <!-- Insert code buttons -->
              {#each extractCodeBlocks(message.content) as codeBlock, j}
                <button class="insert-btn" onclick={() => insertCode(codeBlock)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Inserer le code
                </button>
              {/each}
            {:else}
              {message.content}
            {/if}
          </div>
        </div>
      {/each}

      {#if streamingContent}
        <div class="message assistant streaming">
          <div class="message-header">
            <span class="role-badge">IA</span>
          </div>
          <div class="message-content">
            {@html formatMessage(streamingContent)}
            <span class="cursor-blink">|</span>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Input area -->
  <div class="input-area">
    <textarea
      bind:value={inputValue}
      onkeydown={handleKeydown}
      placeholder="Posez une question..."
      rows="2"
      disabled={$isLoading}
    ></textarea>
    <div class="input-actions">
      {#if $isLoading}
        <button class="stop-btn" onclick={stopGeneration}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
          Stop
        </button>
      {:else}
        <button class="send-btn" onclick={() => sendMessage()} disabled={!inputValue.trim()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Envoyer
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .editor-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--noir-surface);
  }

  .chat-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
    background: var(--noir-card);
  }

  .header-title {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--cyber-green);
  }

  .shared-badge {
    font-size: 9px;
    padding: 2px 6px;
    background: rgba(0, 200, 255, 0.15);
    color: var(--cyber-cyan, #00c8ff);
    border-radius: 3px;
    border: 1px solid rgba(0, 200, 255, 0.3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    margin-left: auto;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .clear-btn:hover {
    background: var(--bg-hover);
    color: var(--error);
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
    background: var(--noir-card);
  }

  .selection-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: rgba(0, 255, 136, 0.15);
    color: var(--cyber-green);
    border-radius: 4px;
    border: 1px solid var(--cyber-green);
  }

  .quick-btn {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    background: var(--noir-surface);
    color: var(--text-secondary);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .quick-btn:hover {
    border-color: var(--cyber-green);
    color: var(--cyber-green);
    background: rgba(0, 255, 136, 0.1);
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    text-align: center;
    padding: 16px;
  }

  .empty-state svg {
    opacity: 0.5;
    margin-bottom: 8px;
  }

  .empty-state p {
    font-size: 12px;
    margin: 0;
  }

  .empty-state .hint {
    font-size: 10px;
    margin-top: 4px;
    opacity: 0.7;
  }

  .message {
    padding: 8px;
    border-radius: 6px;
    font-size: 12px;
  }

  .message.user {
    background: rgba(0, 255, 136, 0.1);
    border: 1px solid rgba(0, 255, 136, 0.2);
    margin-left: 16px;
  }

  .message.assistant {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    margin-right: 16px;
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .role-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .message.user .role-badge {
    color: var(--cyber-green);
  }

  .time {
    font-size: 9px;
    color: var(--text-muted);
    opacity: 0.7;
  }

  .message-content {
    color: var(--text-primary);
    line-height: 1.5;
    word-break: break-word;
  }

  .message-content :global(.code-block) {
    background: var(--noir-profond);
    padding: 8px;
    border-radius: 4px;
    margin: 8px 0;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    border: 1px solid var(--border-color);
  }

  .message-content :global(.inline-code) {
    background: var(--noir-profond);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .insert-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    margin-top: 4px;
    border: 1px solid var(--cyber-green);
    background: rgba(0, 255, 136, 0.1);
    color: var(--cyber-green);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .insert-btn:hover {
    background: var(--cyber-green);
    color: var(--noir-profond);
  }

  .cursor-blink {
    animation: blink 1s infinite;
    color: var(--cyber-green);
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  .input-area {
    padding: 8px;
    border-top: 1px solid var(--border-color);
    background: var(--noir-card);
  }

  .input-area textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--noir-surface);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 12px;
    resize: none;
    outline: none;
  }

  .input-area textarea:focus {
    border-color: var(--cyber-green);
    box-shadow: 0 0 4px var(--cyber-green-glow);
  }

  .input-area textarea::placeholder {
    color: var(--text-muted);
  }

  .input-area textarea:disabled {
    opacity: 0.6;
  }

  .input-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
  }

  .send-btn,
  .stop-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .send-btn {
    background: var(--cyber-green);
    color: var(--noir-profond);
  }

  .send-btn:hover:not(:disabled) {
    box-shadow: 0 0 10px var(--cyber-green-glow);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .stop-btn {
    background: var(--error);
    color: white;
  }

  .stop-btn:hover {
    box-shadow: 0 0 10px var(--error-glow);
  }
</style>
