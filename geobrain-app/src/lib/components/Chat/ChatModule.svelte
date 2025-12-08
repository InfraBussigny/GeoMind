<script lang="ts">
  import { messages, isLoading, type Message } from '$lib/stores/app';
  import { onMount, tick } from 'svelte';

  let inputValue = $state('');
  let messagesContainer: HTMLDivElement;

  async function sendMessage() {
    if (!inputValue.trim() || $isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    messages.update(m => [...m, userMessage]);
    inputValue = '';
    isLoading.set(true);

    await tick();
    scrollToBottom();

    // Simuler une réponse (à remplacer par l'appel API Claude)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Je suis GeoBrain, ton assistant SIT. Pour l'instant, je fonctionne en mode démo. L'intégration avec l'API Claude sera bientôt disponible.\n\nTu m'as dit : "${userMessage.content}"`,
        timestamp: new Date()
      };
      messages.update(m => [...m, assistantMessage]);
      isLoading.set(false);
      scrollToBottom();
    }, 1000);
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
</script>

<div class="chat-module">
  <header class="chat-header">
    <h1>💬 Assistant GeoBrain</h1>
    <p>Posez vos questions sur les géodonnées, QGIS, SQL spatial...</p>
  </header>

  <div class="messages-container" bind:this={messagesContainer}>
    {#if $messages.length === 0}
      <div class="welcome-message">
        <div class="welcome-icon">🧠</div>
        <h2>Bienvenue dans GeoBrain</h2>
        <p>Je suis votre assistant spécialisé en géodonnées et SIT.</p>
        <div class="suggestions">
          <button class="suggestion" on:click={() => { inputValue = 'Comment créer une requête SQL spatiale ?'; sendMessage(); }}>
            Requête SQL spatiale
          </button>
          <button class="suggestion" on:click={() => { inputValue = 'Aide-moi avec un script PyQGIS'; sendMessage(); }}>
            Script PyQGIS
          </button>
          <button class="suggestion" on:click={() => { inputValue = 'Quels sont les projets en cours ?'; sendMessage(); }}>
            Projets en cours
          </button>
        </div>
      </div>
    {:else}
      {#each $messages as message (message.id)}
        <div class="message" class:user={message.role === 'user'} class:assistant={message.role === 'assistant'}>
          <div class="message-avatar">
            {message.role === 'user' ? '👤' : '🧠'}
          </div>
          <div class="message-content">
            <div class="message-text">{message.content}</div>
            <div class="message-time">{formatTime(message.timestamp)}</div>
          </div>
        </div>
      {/each}

      {#if $isLoading}
        <div class="message assistant">
          <div class="message-avatar">🧠</div>
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
    <textarea
      bind:value={inputValue}
      placeholder="Écrivez votre message..."
      on:keydown={handleKeydown}
      rows="1"
    ></textarea>
    <button class="send-btn" on:click={sendMessage} disabled={!inputValue.trim() || $isLoading}>
      <span>➤</span>
    </button>
  </div>
</div>

<style>
  .chat-module {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .chat-header {
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    background: white;
  }

  .chat-header h1 {
    font-size: var(--font-size-xl);
    color: var(--bleu-bussigny);
    margin-bottom: var(--spacing-xs);
  }

  .chat-header p {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
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
    max-width: 500px;
    margin: auto;
  }

  .welcome-icon {
    font-size: 64px;
    margin-bottom: var(--spacing-md);
  }

  .welcome-message h2 {
    color: var(--bleu-bussigny);
    margin-bottom: var(--spacing-sm);
  }

  .welcome-message p {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-lg);
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
    max-width: 80%;
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
    font-size: 18px;
    flex-shrink: 0;
  }

  .message.assistant .message-avatar {
    background: var(--bleu-bussigny);
  }

  .message-content {
    background: var(--bg-secondary);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    border-top-left-radius: 4px;
  }

  .message.user .message-content {
    background: var(--bleu-bussigny);
    color: white;
    border-top-left-radius: var(--border-radius);
    border-top-right-radius: 4px;
  }

  .message-text {
    white-space: pre-wrap;
    line-height: 1.5;
  }

  .message-time {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-top: var(--spacing-xs);
  }

  .message.user .message-time {
    color: rgba(255,255,255,0.7);
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

  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-6px); }
  }

  .input-container {
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    background: white;
    display: flex;
    gap: var(--spacing-md);
  }

  .input-container textarea {
    flex: 1;
    resize: none;
    min-height: 44px;
    max-height: 150px;
    padding: var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-family: inherit;
    font-size: var(--font-size-md);
  }

  .input-container textarea:focus {
    outline: none;
    border-color: var(--bleu-bussigny);
    box-shadow: 0 0 0 3px rgba(54, 96, 146, 0.1);
  }

  .send-btn {
    width: 44px;
    height: 44px;
    border: none;
    background: var(--bleu-bussigny);
    color: white;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: 18px;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--bleu-bussigny-dark);
  }

  .send-btn:disabled {
    background: var(--gris-clair);
    cursor: not-allowed;
  }
</style>
