<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import {
    mapContextStore,
    assistantMessagesStore,
    assistantLoadingStore,
    addAssistantMessage,
    clearAssistantMessages,
    parseActionsFromResponse,
    executeMapAction,
    getMapAssistantSystemPrompt,
    searchAddress,
    QUICK_ACTIONS,
    type MapAction,
    type AssistantMessage,
    type MapContext
  } from '$lib/services/mapAssistant';
  import { streamMessage } from '$lib/services/api';
  import { currentProvider, currentModel } from '$lib/stores/app';

  const dispatch = createEventDispatcher();

  // Props
  interface Props {
    isOpen?: boolean;
    context: MapContext;
  }
  let { isOpen = true, context }: Props = $props();

  // State
  let inputValue = $state('');
  let messages = $state<AssistantMessage[]>([]);
  let isLoading = $state(false);
  let messagesContainer: HTMLDivElement;
  let inputRef: HTMLInputElement;
  let showQuickActions = $state(true);

  // Subscribe to stores on mount (not in $effect to avoid loops)
  onMount(() => {
    const unsub1 = assistantMessagesStore.subscribe(m => messages = m);
    const unsub2 = assistantLoadingStore.subscribe(l => isLoading = l);

    // Set initial context
    mapContextStore.set(context);

    return () => {
      unsub1();
      unsub2();
    };
  });

  // Auto-scroll function (called manually)
  function scrollToBottom() {
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 50);
    }
  }

  // Send message to AI
  async function sendMessage(userMessage?: string) {
    const message = userMessage || inputValue.trim();
    if (!message || isLoading) return;

    inputValue = '';
    showQuickActions = false;
    assistantLoadingStore.set(true);

    // Add user message
    addAssistantMessage('user', message);
    scrollToBottom();

    // Build system prompt with context
    const systemPrompt = getMapAssistantSystemPrompt(context);

    // Build conversation history for API
    // Include system prompt + previous messages + new user message
    const apiMessages: Array<{role: 'user' | 'assistant' | 'system', content: string}> = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    let assistantResponse = '';

    try {
      await streamMessage(
        $currentProvider,
        $currentModel,
        apiMessages,
        undefined, // no tools
        (chunk: string) => {
          assistantResponse += chunk;
          // Update last message in real-time
          assistantMessagesStore.update(msgs => {
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant') {
              return [...msgs.slice(0, -1), { ...last, content: assistantResponse }];
            } else {
              return [...msgs, {
                id: `msg_${Date.now()}`,
                role: 'assistant' as const,
                content: assistantResponse,
                timestamp: new Date()
              }];
            }
          });
          scrollToBottom();
        },
        () => {
          // On complete - parse actions
          const actions = parseActionsFromResponse(assistantResponse);
          if (actions.length > 0) {
            assistantMessagesStore.update(msgs => {
              const last = msgs[msgs.length - 1];
              if (last && last.role === 'assistant') {
                return [...msgs.slice(0, -1), { ...last, actions }];
              }
              return msgs;
            });
          }
          assistantLoadingStore.set(false);
        },
        (error: string) => {
          addAssistantMessage('assistant', `Erreur: ${error}`);
          assistantLoadingStore.set(false);
        }
      );
    } catch (error) {
      addAssistantMessage('assistant', `Erreur de connexion: ${error}`);
      assistantLoadingStore.set(false);
    }
  }

  // Execute an action
  async function handleExecuteAction(action: MapAction) {
    assistantLoadingStore.set(true);
    const result = await executeMapAction(action);

    if (result.success) {
      addAssistantMessage('system', `✓ ${result.message}`);
      dispatch('action', { action, result });
    } else {
      addAssistantMessage('system', `✗ ${result.message}`);
    }
    scrollToBottom();
    assistantLoadingStore.set(false);
  }

  // Quick action click
  function handleQuickAction(action: typeof QUICK_ACTIONS[0]) {
    if (action.id === 'help') {
      sendMessage(action.prompt);
    } else {
      inputValue = action.prompt;
      inputRef?.focus();
    }
  }

  // Handle keyboard
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Clear chat
  function handleClear() {
    clearAssistantMessages();
    showQuickActions = true;
  }

  // Format action type for display
  function formatActionType(type: string): string {
    const labels: Record<string, string> = {
      'zoom': 'Zoomer',
      'layer_toggle': 'Couche',
      'layer_add': 'Ajouter couche',
      'layer_remove': 'Retirer couche',
      'search': 'Rechercher',
      'sql_query': 'SQL',
      'zoom_to_address': 'Zoomer',
      'toggle_layer': 'Couche',
      'execute_sql': 'SQL'
    };
    return labels[type] || type;
  }
</script>

<aside class="map-assistant" class:open={isOpen}>
  <div class="assistant-header">
    <div class="header-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
      </svg>
      <span>Assistant Carto</span>
    </div>
    <div class="header-actions">
      <button class="icon-btn" onclick={handleClear} title="Effacer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
      <button class="icon-btn" onclick={() => dispatch('close')} title="Fermer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  </div>

  <div class="assistant-context">
    <span class="context-badge">{context.activeTab}</span>
    {#if context.activeLayers.length > 0}
      <span class="context-layers">{context.activeLayers.length} couches</span>
    {/if}
  </div>

  <div class="messages-container" bind:this={messagesContainer}>
    {#if messages.length === 0 && showQuickActions}
      <div class="welcome-section">
        <div class="welcome-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <h3>Assistant Cartographique</h3>
        <p>Posez vos questions sur les cartes, recherchez des lieux, gérez vos couches ou exécutez des requêtes spatiales.</p>

        <div class="quick-actions">
          {#each QUICK_ACTIONS as action}
            <button class="quick-action-btn" onclick={() => handleQuickAction(action)}>
              <span class="quick-icon">
                {#if action.icon === 'search'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                {:else if action.icon === 'layers'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                    <polyline points="2 17 12 22 22 17"/>
                    <polyline points="2 12 12 17 22 12"/>
                  </svg>
                {:else if action.icon === 'map-pin'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                {:else if action.icon === 'database'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                  </svg>
                {:else}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                {/if}
              </span>
              {action.label}
            </button>
          {/each}
        </div>
      </div>
    {:else}
      {#each messages as msg (msg.id)}
        <div class="message {msg.role}">
          {#if msg.role === 'user'}
            <div class="message-avatar user-avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
          {:else if msg.role === 'assistant'}
            <div class="message-avatar assistant-avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
            </div>
          {:else}
            <div class="message-avatar system-avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
          {/if}

          <div class="message-content">
            <div class="message-text">{msg.content}</div>

            {#if msg.actions && msg.actions.length > 0}
              <div class="message-actions">
                {#each msg.actions as action}
                  <button
                    class="action-btn"
                    onclick={() => handleExecuteAction(action)}
                    disabled={isLoading}
                  >
                    <span class="action-type">{formatActionType(action.type)}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/each}

      {#if isLoading}
        <div class="message assistant">
          <div class="message-avatar assistant-avatar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <div class="input-container">
    <input
      type="text"
      placeholder="Rechercher, zoomer, interroger..."
      bind:value={inputValue}
      bind:this={inputRef}
      onkeydown={handleKeydown}
      disabled={isLoading}
    />
    <button
      class="send-btn"
      onclick={() => sendMessage()}
      disabled={!inputValue.trim() || isLoading}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    </button>
  </div>
</aside>

<style>
  .map-assistant {
    width: 320px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--noir-surface);
    border-left: 1px solid var(--border-color);
    transition: transform 0.3s ease, opacity 0.3s ease;
  }

  .map-assistant:not(.open) {
    transform: translateX(100%);
    opacity: 0;
    pointer-events: none;
  }

  .assistant-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    background: var(--noir-card);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--cyber-green);
  }

  .header-title svg {
    color: var(--cyber-green);
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .icon-btn:hover {
    background: var(--bg-hover);
    border-color: var(--border-color);
    color: var(--text-primary);
  }

  .assistant-context {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--noir-profond);
    border-bottom: 1px solid var(--border-color);
  }

  .context-badge {
    padding: 2px 8px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    font-size: 10px;
    font-weight: 600;
    font-family: var(--font-mono);
    border-radius: 4px;
    text-transform: uppercase;
  }

  .context-layers {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .welcome-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px 16px;
  }

  .welcome-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 255, 136, 0.1);
    border: 1px solid var(--cyber-green);
    border-radius: 50%;
    margin-bottom: 16px;
    color: var(--cyber-green);
  }

  .welcome-section h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text-primary);
  }

  .welcome-section p {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0 0 20px 0;
    line-height: 1.5;
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .quick-action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 12px;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .quick-action-btn:hover {
    background: var(--bg-hover);
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .quick-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .message {
    display: flex;
    gap: 10px;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .message-avatar {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .user-avatar {
    background: var(--primary);
    color: white;
  }

  .assistant-avatar {
    background: var(--cyber-green);
    color: var(--noir-profond);
  }

  .system-avatar {
    background: var(--info);
    color: white;
  }

  .message-content {
    flex: 1;
    min-width: 0;
  }

  .message-text {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .message.system .message-text {
    font-size: 12px;
    color: var(--text-secondary);
    font-style: italic;
  }

  .message-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(0, 255, 136, 0.1);
    border: 1px solid var(--cyber-green);
    border-radius: 4px;
    color: var(--cyber-green);
    font-size: 11px;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--cyber-green);
    color: var(--noir-profond);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-type {
    font-weight: 600;
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 8px 0;
  }

  .typing-indicator span {
    width: 6px;
    height: 6px;
    background: var(--cyber-green);
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
  .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }

  .input-container {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color);
    background: var(--noir-card);
  }

  .input-container input {
    flex: 1;
    padding: 10px 14px;
    background: var(--noir-profond);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: var(--font-mono);
  }

  .input-container input:focus {
    outline: none;
    border-color: var(--cyber-green);
    box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.1);
  }

  .input-container input::placeholder {
    color: var(--text-muted);
  }

  .send-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--cyber-green);
    border: none;
    border-radius: 6px;
    color: var(--noir-profond);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--cyber-green-light);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
