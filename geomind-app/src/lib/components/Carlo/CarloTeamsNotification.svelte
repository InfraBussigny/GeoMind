<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { appMode } from '$lib/stores/app';
  import {
    getRandomReplyError,
    getRandomTeamsMessageWithSender,
    type TeamsSender,
    type TeamsSenderInfo
  } from './carloMessages';

  // State
  let notifications = $state<Array<{
    id: number;
    message: string;
    isAllCaps: boolean;
    timestamp: Date;
    sender: TeamsSender;
    senderInfo: TeamsSenderInfo;
  }>>([]);

  let showReplyModal = $state(false);
  let replyProgress = $state(0);
  let replyError = $state('');
  let replyPhase = $state<'loading' | 'error'>('loading');

  let notificationInterval: ReturnType<typeof setInterval>;
  let notificationId = 0;

  // Configuration - Notifications fréquentes et irrégulières
  const MIN_INTERVAL = 5000; // 5 secondes minimum entre notifications
  const MAX_INTERVAL = 20000; // 20 secondes maximum
  const MAX_NOTIFICATIONS = 100; // Pas de limite - elles envahissent l'écran

  onMount(() => {
    if ($appMode !== 'bfsa') return;

    // Première notification après un délai aléatoire
    const initialDelay = Math.random() * 8000 + 3000;
    setTimeout(() => {
      addNotification();
      startNotificationLoop();
    }, initialDelay);
  });

  onDestroy(() => {
    if (notificationInterval) clearInterval(notificationInterval);
  });

  function startNotificationLoop() {
    const scheduleNext = () => {
      const delay = Math.random() * (MAX_INTERVAL - MIN_INTERVAL) + MIN_INTERVAL;
      notificationInterval = setTimeout(() => {
        if ($appMode === 'bfsa') {
          addNotification();
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  function addNotification() {
    // Pas de limite - les notifications peuvent envahir l'écran
    const teamsMsg = getRandomTeamsMessageWithSender();
    notifications = [...notifications, {
      id: notificationId++,
      message: teamsMsg.message,
      isAllCaps: teamsMsg.isAllCaps,
      timestamp: new Date(),
      sender: teamsMsg.sender,
      senderInfo: teamsMsg.senderInfo
    }];
  }

  function dismissNotification(id: number) {
    notifications = notifications.filter(n => n.id !== id);
  }

  function handleReply() {
    showReplyModal = true;
    replyPhase = 'loading';
    replyProgress = 0;
    replyError = '';

    // Animation de chargement qui se bloque
    const progressInterval = setInterval(() => {
      if (replyProgress < 73) {
        // Progression normale jusqu'à ~73%
        replyProgress += Math.random() * 8 + 2;
      } else if (replyProgress < 78) {
        // Ralentissement
        replyProgress += Math.random() * 2;
      } else {
        // Bloqué à ~78%, puis erreur
        clearInterval(progressInterval);
        setTimeout(() => {
          replyPhase = 'error';
          replyError = getRandomReplyError();
        }, 1500);
      }
    }, 200);
  }

  function closeReplyModal() {
    showReplyModal = false;
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  }
</script>

{#if $appMode === 'bfsa'}
  <!-- Container des notifications -->
  <div class="carlo-notifications-container">
    {#each notifications as notif (notif.id)}
      <div
        class="carlo-notification"
        class:allcaps={notif.isAllCaps}
      >
        <!-- Header Teams -->
        <div class="notification-header">
          <div class="teams-icon" style="background-color: {notif.senderInfo.color}">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.19 8.77q-.46 0-.86-.17t-.7-.47-.47-.7-.17-.85q0-.46.17-.86t.47-.7.7-.47.86-.17q.45 0 .85.17t.7.47.47.7.17.86q0 .45-.17.85t-.47.7-.7.47-.85.17zm-5.29 1.43q.22.09.41.22t.34.31.25.39.13.46v6.24q0 .46-.17.86t-.47.7-.7.47-.86.17h-6.7q-.46 0-.86-.17t-.7-.47-.47-.7-.17-.86v-6.7q0-.46.17-.86t.47-.7.7-.47.86-.17h5.38q.23 0 .44.06t.41.14zm5.29-.95q.46 0 .86.17t.7.47.47.7.17.86v4.4q0 .28-.1.53t-.29.44-.43.3-.53.1h-2.8v-4.55q0-.41-.12-.8t-.34-.71-.52-.57-.67-.4h2.8q.28 0 .52-.11t.43-.29.29-.43.11-.52-.11-.52-.29-.43-.43-.29-.52-.11h-1.5V8.25h2.8z"/>
            </svg>
          </div>
          <div class="sender-info">
            <span class="sender-name">{notif.senderInfo.name}</span>
            <span class="sender-status">{notif.senderInfo.title}</span>
          </div>
          <span class="notification-time">{formatTime(notif.timestamp)}</span>
        </div>

        <!-- Message -->
        <div class="notification-body">
          <p class="notification-message">{notif.message}</p>
        </div>

        <!-- Actions -->
        <div class="notification-actions">
          <button class="btn-dismiss" onclick={() => dismissNotification(notif.id)}>
            Ignorer
          </button>
          <button class="btn-reply" onclick={handleReply}>
            Répondre
          </button>
        </div>

      </div>
    {/each}
  </div>

  <!-- Modal de réponse -->
  {#if showReplyModal}
    <div class="reply-modal-overlay" onclick={closeReplyModal}>
      <div class="reply-modal" onclick={(e) => e.stopPropagation()}>
        {#if replyPhase === 'loading'}
          <div class="reply-loading">
            <div class="teams-logo-large">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.19 8.77q-.46 0-.86-.17t-.7-.47-.47-.7-.17-.85q0-.46.17-.86t.47-.7.7-.47.86-.17q.45 0 .85.17t.7.47.47.7.17.86q0 .45-.17.85t-.47.7-.7.47-.85.17zm-5.29 1.43q.22.09.41.22t.34.31.25.39.13.46v6.24q0 .46-.17.86t-.47.7-.7.47-.86.17h-6.7q-.46 0-.86-.17t-.7-.47-.47-.7-.17-.86v-6.7q0-.46.17-.86t.47-.7.7-.47.86-.17h5.38q.23 0 .44.06t.41.14zm5.29-.95q.46 0 .86.17t.7.47.47.7.17.86v4.4q0 .28-.1.53t-.29.44-.43.3-.53.1h-2.8v-4.55q0-.41-.12-.8t-.34-.71-.52-.57-.67-.4h2.8q.28 0 .52-.11t.43-.29.29-.43.11-.52-.11-.52-.29-.43-.43-.29-.52-.11h-1.5V8.25h2.8z"/>
              </svg>
            </div>
            <p class="loading-text">Connexion à Microsoft Teams...</p>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {replyProgress}%"></div>
            </div>
            <p class="progress-percent">{Math.floor(replyProgress)}%</p>
          </div>
        {:else}
          <div class="reply-error">
            <div class="error-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </div>
            <p class="error-title">Échec de l'envoi</p>
            <p class="error-message">{replyError}</p>
            <p class="error-contact">
              En cas de problème, contactez:<br/>
              <strong>Carlo Perono</strong><br/>
              <span class="contact-note">(Disponible 6 mois par an - actuellement en Thaïlande)</span>
            </p>
            <button class="btn-close-error" onclick={closeReplyModal}>
              Fermer
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<style>
  .carlo-notifications-container {
    position: fixed;
    bottom: 40px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 9999;
    max-width: 360px;
  }

  .carlo-notification {
    background: #292929;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    animation: slideIn 0.3s ease-out;
    border: 1px solid #404040;
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


  .notification-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: #1f1f1f;
    border-bottom: 1px solid #404040;
  }

  .teams-icon {
    width: 32px;
    height: 32px;
    background: #5059c9;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .teams-icon svg {
    width: 20px;
    height: 20px;
  }

  .sender-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .sender-name {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }

  .sender-status {
    font-size: 11px;
    color: #888;
  }

  .notification-time {
    font-size: 11px;
    color: #666;
  }

  .notification-body {
    padding: 12px;
  }

  .notification-message {
    margin: 0;
    font-size: 13px;
    color: #e0e0e0;
    line-height: 1.4;
  }

  .allcaps .notification-message {
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .notification-actions {
    display: flex;
    gap: 8px;
    padding: 8px 12px 12px;
  }

  .btn-dismiss,
  .btn-reply {
    flex: 1;
    padding: 8px 12px;
    border-radius: 4px;
    border: none;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-dismiss {
    background: #404040;
    color: #ccc;
  }

  .btn-dismiss:hover {
    background: #505050;
  }

  .btn-reply {
    background: #5059c9;
    color: white;
  }

  .btn-reply:hover {
    background: #6069d9;
  }


  /* Modal de réponse */
  .reply-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .reply-modal {
    background: #1f1f1f;
    border-radius: 12px;
    padding: 30px;
    width: 320px;
    text-align: center;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    border: 1px solid #404040;
  }

  .reply-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
  }

  .teams-logo-large {
    width: 60px;
    height: 60px;
    background: #5059c9;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .teams-logo-large svg {
    width: 36px;
    height: 36px;
  }

  .loading-text {
    margin: 0;
    color: #ccc;
    font-size: 14px;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: #404040;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #5059c9;
    transition: width 0.2s ease-out;
  }

  .progress-percent {
    margin: 0;
    color: #888;
    font-size: 12px;
  }

  .reply-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .error-icon {
    width: 50px;
    height: 50px;
    color: #f44336;
  }

  .error-icon svg {
    width: 100%;
    height: 100%;
  }

  .error-title {
    margin: 0;
    color: #f44336;
    font-size: 16px;
    font-weight: 600;
  }

  .error-message {
    margin: 0;
    color: #ccc;
    font-size: 13px;
    padding: 10px;
    background: #2a2a2a;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
  }

  .error-contact {
    margin: 0;
    color: #888;
    font-size: 12px;
    line-height: 1.5;
  }

  .error-contact strong {
    color: #ccc;
  }

  .contact-note {
    font-style: italic;
    color: #666;
    font-size: 11px;
  }

  .btn-close-error {
    margin-top: 10px;
    padding: 10px 30px;
    background: #404040;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }

  .btn-close-error:hover {
    background: #505050;
  }
</style>
