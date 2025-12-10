<script lang="ts">
  import { streamMessage } from '$lib/services/api';
  import { currentProvider, currentModel } from '$lib/stores/app';

  interface Message {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
  }

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

  let messages = $state<Message[]>([]);
  let inputValue = $state('');
  let isLoading = $state(false);
  let messagesContainer: HTMLDivElement;
  let streamController: any = null;

  // Quick actions
  const quickActions = [
    { label: 'Expliquer', prompt: 'Explique ce code en detail:', icon: '?' },
    { label: 'Corriger', prompt: 'Trouve et corrige les erreurs dans ce code:', icon: '!' },
    { label: 'Optimiser', prompt: 'Optimise ce code pour de meilleures performances:', icon: '^' },
    { label: 'Commenter', prompt: 'Ajoute des commentaires explicatifs a ce code:', icon: '#' },
  ];

  function buildSystemPrompt(): string {
    let prompt = `Tu es l'assistant de code GeoBrain, specialise en:
- SQL spatial (PostGIS, Oracle Spatial)
- Python/PyQGIS pour les scripts de geotraitement
- FME workbenches
- GeoJSON/JSON manipulation
- Scripts shell et automatisation

Tu reponds en francais. Tu fournis du code fonctionnel, bien commente et optimise.`;

    if (currentFile) {
      prompt += `\n\nFichier actuel: ${currentFile}`;
    }
    if (currentLanguage && currentLanguage !== 'plaintext') {
      prompt += `\nLangage: ${currentLanguage}`;
    }

    return prompt;
  }

  function buildUserPrompt(basePrompt: string): string {
    let prompt = basePrompt;

    if (selectedCode) {
      prompt += `\n\nCode selectionne:\n\`\`\`${currentLanguage}\n${selectedCode}\n\`\`\``;
    }

    return prompt;
  }

  async function sendMessage(prompt?: string) {
    const messageText = prompt || inputValue.trim();
    if (!messageText || isLoading) return;

    const userPrompt = buildUserPrompt(messageText);

    // Add user message
    messages = [...messages, { role: 'user', content: messageText }];
    inputValue = '';
    isLoading = true;

    // Add empty assistant message for streaming
    const assistantMessage: Message = { role: 'assistant', content: '', isStreaming: true };
    messages = [...messages, assistantMessage];

    // Scroll to bottom
    setTimeout(() => scrollToBottom(), 50);

    try {
      // Build messages array with system prompt
      const apiMessages = [
        { role: 'system' as const, content: buildSystemPrompt() },
        ...messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userPrompt }
      ];

      streamController = await streamMessage(
        $currentProvider,
        $currentModel,
        apiMessages,
        undefined,
        // onChunk
        (chunk: string) => {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content += chunk;
            messages = [...messages];
            scrollToBottom();
          }
        },
        // onDone
        () => {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg) {
            lastMsg.isStreaming = false;
          }
          messages = [...messages];
          isLoading = false;
          streamController = null;
        },
        // onError
        (error: string) => {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = `Erreur: ${error}`;
            lastMsg.isStreaming = false;
          }
          messages = [...messages];
          isLoading = false;
          streamController = null;
        }
      );
    } catch (e) {
      console.error('Error sending message:', e);
      isLoading = false;
    }
  }

  function stopGeneration() {
    if (streamController) {
      streamController.abort();
      streamController = null;
    }
    isLoading = false;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      lastMsg.isStreaming = false;
      messages = [...messages];
    }
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

  function clearChat() {
    messages = [];
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
</script>

<div class="editor-chat">
  <!-- Header -->
  <div class="chat-header">
    <span class="header-title">Assistant IA</span>
    <button class="clear-btn" onclick={clearChat} title="Effacer">
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
    {#if messages.length === 0}
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>Posez une question sur votre code</p>
        <span class="hint">Selectionnez du code pour des actions rapides</span>
      </div>
    {:else}
      {#each messages as message, i}
        <div class="message {message.role}">
          <div class="message-header">
            <span class="role-badge">{message.role === 'user' ? 'Vous' : 'IA'}</span>
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

            {#if message.isStreaming}
              <span class="cursor-blink">|</span>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Input area -->
  <div class="input-area">
    <textarea
      bind:value={inputValue}
      onkeydown={handleKeydown}
      placeholder="Posez une question..."
      rows="2"
      disabled={isLoading}
    ></textarea>
    <div class="input-actions">
      {#if isLoading}
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

<script context="module" lang="ts">
  // Simple markdown-like formatting
  function formatMessage(content: string): string {
    // Escape HTML first
    let formatted = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks
    formatted = formatted.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre class="code-block"><code>$2</code></pre>'
    );

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }
</script>

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
    justify-content: space-between;
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

  .clear-btn {
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
