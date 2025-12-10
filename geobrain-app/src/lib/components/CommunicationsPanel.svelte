<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    outlookStore,
    threeCXStore,
    notificationsStore,
    getEmails,
    sendEmail,
    markEmailRead,
    getCalendarEvents,
    connect3CX,
    disconnect3CX,
    makeCall,
    endCall,
    holdCall,
    getCallHistory,
    setExtensionStatus,
    startPolling,
    stopPolling,
    formatPhoneNumber,
    formatCallDuration,
    formatEmailDate,
    type EmailMessage,
    type CalendarEvent,
    type CallRecord,
    type EmailDraft,
    type ThreeCXConfig, type OutlookState, type ThreeCXState
  } from '$lib/services/communications';

  // State
  let activeTab = $state<'emails' | 'calendar' | 'phone' | 'notifications'>('emails');

  // Outlook state
  let outlookState = $state({ isAuthenticated: false, config: null, user: null, unreadCount: 0 });
  let emails = $state<EmailMessage[]>([]);
  let selectedEmail = $state<EmailMessage | null>(null);
  let calendarEvents = $state<CalendarEvent[]>([]);
  let emailsLoading = $state(false);

  // 3CX state
  let threeCXState = $state({ isConnected: false, config: null, extension: null, activeCalls: [], missedCalls: 0 });
  let callHistory = $state<CallRecord[]>([]);
  let dialNumber = $state('');
  let show3CXSetup = $state(false);
  let config3CX = $state<ThreeCXConfig>({ serverUrl: '', extension: '', username: '' });

  // Notifications
  let notifications = $state<Array<{ id: string; type: string; title: string; message: string; timestamp: Date; isRead: boolean }>>([]);

  // Compose email
  let showCompose = $state(false);
  let composeTo = $state('');
  let composeSubject = $state('');
  let composeBody = $state('');

  // Subscribe to stores
  $effect(() => {
    const unsub1 = outlookStore.subscribe(s => outlookState = s);
    const unsub2 = threeCXStore.subscribe(s => threeCXState = s);
    const unsub3 = notificationsStore.subscribe(n => notifications = n);

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  });

  onMount(() => {
    startPolling();
    if (outlookState.isAuthenticated) {
      loadEmails();
      loadCalendar();
    }
    if (threeCXState.isConnected) {
      loadCallHistory();
    }
  });

  onDestroy(() => {
    stopPolling();
  });

  // Load emails
  async function loadEmails() {
    emailsLoading = true;
    const result = await getEmails('inbox', 50);
    if (result.success && result.emails) {
      emails = result.emails;
    }
    emailsLoading = false;
  }

  // Load calendar
  async function loadCalendar() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await getCalendarEvents(start, end);
    if (result.success && result.events) {
      calendarEvents = result.events;
    }
  }

  // Load call history
  async function loadCallHistory() {
    const result = await getCallHistory();
    if (result.success && result.calls) {
      callHistory = result.calls;
    }
  }

  // Select email
  async function selectEmail(email: EmailMessage) {
    selectedEmail = email;
    if (!email.isRead) {
      await markEmailRead(email.id, true);
      emails = emails.map(e => e.id === email.id ? { ...e, isRead: true } : e);
    }
  }

  // Send email
  async function handleSendEmail() {
    if (!composeTo || !composeSubject) return;

    const draft: EmailDraft = {
      to: composeTo.split(',').map(s => s.trim()),
      subject: composeSubject,
      body: composeBody,
      isHtml: false
    };

    const result = await sendEmail(draft);
    if (result.success) {
      showCompose = false;
      composeTo = '';
      composeSubject = '';
      composeBody = '';
      notificationsStore.add({
        type: 'email',
        title: 'Email envoyé',
        message: `À: ${draft.to.join(', ')}`
      });
    }
  }

  // Connect 3CX
  async function handleConnect3CX() {
    const result = await connect3CX(config3CX);
    if (result.success) {
      show3CXSetup = false;
      loadCallHistory();
    }
  }

  // Make call
  async function handleMakeCall() {
    if (!dialNumber) return;
    const result = await makeCall(dialNumber);
    if (result.success) {
      dialNumber = '';
    }
  }

  // End active call
  async function handleEndCall(callId: string) {
    await endCall(callId);
  }

  // Toggle hold
  async function handleHoldCall(callId: string, isHeld: boolean) {
    await holdCall(callId, !isHeld);
  }

  // Set status
  async function handleSetStatus(status: 'available' | 'busy' | 'away' | 'dnd') {
    await setExtensionStatus(status);
  }

  // Get status color
  function getStatusColor(status: string): string {
    switch (status) {
      case 'available': return '#22c55e';
      case 'busy': return '#ef4444';
      case 'away': return '#f59e0b';
      case 'dnd': return '#ef4444';
      default: return '#6b7280';
    }
  }

  // Get unread notifications count
  let unreadNotifications = $derived(notifications.filter(n => !n.isRead).length);
</script>

<div class="communications-panel">
  <!-- Tabs -->
  <div class="tabs">
    <button class="tab" class:active={activeTab === 'emails'} onclick={() => activeTab = 'emails'}>
      Emails
      {#if outlookState.unreadCount > 0}
        <span class="badge">{outlookState.unreadCount}</span>
      {/if}
    </button>
    <button class="tab" class:active={activeTab === 'calendar'} onclick={() => activeTab = 'calendar'}>
      Calendrier
    </button>
    <button class="tab" class:active={activeTab === 'phone'} onclick={() => activeTab = 'phone'}>
      Téléphone
      {#if threeCXState.missedCalls > 0}
        <span class="badge missed">{threeCXState.missedCalls}</span>
      {/if}
    </button>
    <button class="tab" class:active={activeTab === 'notifications'} onclick={() => activeTab = 'notifications'}>
      Notifs
      {#if unreadNotifications > 0}
        <span class="badge">{unreadNotifications}</span>
      {/if}
    </button>
  </div>

  <!-- Content -->
  <div class="tab-content">
    {#if activeTab === 'emails'}
      <div class="emails-view">
        {#if !outlookState.isAuthenticated}
          <div class="setup-prompt">
            <p>Connectez votre compte Outlook pour accéder à vos emails.</p>
            <button class="connect-btn">Connecter Outlook</button>
          </div>
        {:else}
          <div class="emails-toolbar">
            <button class="compose-btn" onclick={() => showCompose = true}>
              + Nouveau
            </button>
            <button class="refresh-btn" onclick={loadEmails}>
              🔄
            </button>
          </div>

          <div class="emails-container">
            <div class="emails-list">
              {#if emailsLoading}
                <div class="loading">Chargement...</div>
              {:else}
                {#each emails as email}
                  <button
                    class="email-item"
                    class:unread={!email.isRead}
                    class:selected={selectedEmail?.id === email.id}
                    onclick={() => selectEmail(email)}
                  >
                    <div class="email-from">{email.from.name || email.from.address}</div>
                    <div class="email-subject">{email.subject}</div>
                    <div class="email-preview">{email.bodyPreview}</div>
                    <div class="email-date">{formatEmailDate(email.receivedDateTime)}</div>
                  </button>
                {:else}
                  <div class="empty">Aucun email</div>
                {/each}
              {/if}
            </div>

            {#if selectedEmail}
              <div class="email-detail">
                <div class="email-header">
                  <h3>{selectedEmail.subject}</h3>
                  <div class="email-meta">
                    <span>De: {selectedEmail.from.name} &lt;{selectedEmail.from.address}&gt;</span>
                    <span>{selectedEmail.receivedDateTime.toLocaleString('fr-CH')}</span>
                  </div>
                </div>
                <div class="email-body">
                  {selectedEmail.body}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'calendar'}
      <div class="calendar-view">
        {#if !outlookState.isAuthenticated}
          <div class="setup-prompt">
            <p>Connectez votre compte Outlook pour voir votre calendrier.</p>
          </div>
        {:else}
          <div class="events-list">
            {#each calendarEvents as event}
              <div class="event-item" class:allday={event.isAllDay}>
                <div class="event-time">
                  {#if event.isAllDay}
                    Toute la journée
                  {:else}
                    {event.start.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                    - {event.end.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                  {/if}
                </div>
                <div class="event-info">
                  <div class="event-subject">{event.subject}</div>
                  {#if event.location}
                    <div class="event-location">📍 {event.location}</div>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="empty">Aucun événement cette semaine</div>
            {/each}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'phone'}
      <div class="phone-view">
        {#if !threeCXState.isConnected}
          {#if show3CXSetup}
            <div class="setup-form">
              <h3>Configuration 3CX</h3>
              <input
                type="text"
                placeholder="URL du serveur 3CX"
                bind:value={config3CX.serverUrl}
              />
              <input
                type="text"
                placeholder="Extension"
                bind:value={config3CX.extension}
              />
              <input
                type="text"
                placeholder="Nom d'utilisateur"
                bind:value={config3CX.username}
              />
              <input
                type="password"
                placeholder="Mot de passe"
                bind:value={config3CX.password}
              />
              <div class="form-actions">
                <button class="cancel-btn" onclick={() => show3CXSetup = false}>Annuler</button>
                <button class="connect-btn" onclick={handleConnect3CX}>Connecter</button>
              </div>
            </div>
          {:else}
            <div class="setup-prompt">
              <p>Connectez-vous à 3CX pour gérer vos appels.</p>
              <button class="connect-btn" onclick={() => show3CXSetup = true}>Configurer 3CX</button>
            </div>
          {/if}
        {:else}
          <div class="phone-header">
            <div class="extension-info">
              <span class="ext-number">{threeCXState.extension?.number}</span>
              <span
                class="ext-status"
                style="background: {getStatusColor(threeCXState.extension?.status || 'offline')}"
              ></span>
            </div>
            <div class="status-buttons">
              <button onclick={() => handleSetStatus('available')} title="Disponible">🟢</button>
              <button onclick={() => handleSetStatus('busy')} title="Occupé">🔴</button>
              <button onclick={() => handleSetStatus('away')} title="Absent">🟡</button>
              <button onclick={() => handleSetStatus('dnd')} title="Ne pas déranger">⛔</button>
            </div>
          </div>

          <!-- Dialer -->
          <div class="dialer">
            <input
              type="tel"
              placeholder="Numéro à appeler"
              bind:value={dialNumber}
              onkeydown={(e) => e.key === 'Enter' && handleMakeCall()}
            />
            <button class="call-btn" onclick={handleMakeCall}>📞</button>
          </div>

          <!-- Active calls -->
          {#if threeCXState.activeCalls.length > 0}
            <div class="active-calls">
              <h4>Appels en cours</h4>
              {#each threeCXState.activeCalls as call}
                <div class="active-call">
                  <div class="call-info">
                    <span class="call-number">{formatPhoneNumber(call.number)}</span>
                    {#if call.name}
                      <span class="call-name">{call.name}</span>
                    {/if}
                    <span class="call-status">{call.status}</span>
                  </div>
                  <div class="call-actions">
                    <button
                      class="hold-btn"
                      onclick={() => handleHoldCall(call.id, call.status === 'onHold')}
                    >
                      {call.status === 'onHold' ? '▶️' : '⏸️'}
                    </button>
                    <button class="hangup-btn" onclick={() => handleEndCall(call.id)}>
                      📵
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Call history -->
          <div class="call-history">
            <h4>Historique</h4>
            {#each callHistory.slice(0, 20) as call}
              <div class="history-item" class:missed={call.type === 'missed'}>
                <span class="call-type">
                  {call.type === 'inbound' ? '📥' : call.type === 'outbound' ? '📤' : '📵'}
                </span>
                <div class="call-details">
                  <span class="call-number">{formatPhoneNumber(call.number)}</span>
                  {#if call.name}
                    <span class="call-name">{call.name}</span>
                  {/if}
                </div>
                <div class="call-meta">
                  <span class="call-duration">{formatCallDuration(call.duration)}</span>
                  <span class="call-time">{formatEmailDate(call.timestamp)}</span>
                </div>
              </div>
            {:else}
              <div class="empty">Aucun appel</div>
            {/each}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'notifications'}
      <div class="notifications-view">
        <div class="notif-toolbar">
          <button onclick={() => notificationsStore.markAllRead()}>
            Tout marquer comme lu
          </button>
          <button onclick={() => notificationsStore.clear()}>
            Effacer tout
          </button>
        </div>

        <div class="notifications-list">
          {#each notifications as notif}
            <div
              class="notification-item"
              class:unread={!notif.isRead}
              onclick={() => notificationsStore.markRead(notif.id)}
              onkeydown={(e) => e.key === 'Enter' && notificationsStore.markRead(notif.id)}
              role="button"
              tabindex="0"
            >
              <span class="notif-icon">
                {notif.type === 'email' ? '✉️' : notif.type === 'call' ? '📞' : notif.type === 'calendar' ? '📅' : '🔔'}
              </span>
              <div class="notif-content">
                <div class="notif-title">{notif.title}</div>
                <div class="notif-message">{notif.message}</div>
              </div>
              <div class="notif-time">
                {formatEmailDate(notif.timestamp)}
              </div>
              <button
                class="notif-dismiss"
                onclick={(e) => { e.stopPropagation(); notificationsStore.remove(notif.id); }}
              >
                ✕
              </button>
            </div>
          {:else}
            <div class="empty">Aucune notification</div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Compose email modal -->
  {#if showCompose}
    <div
      class="modal-overlay"
      onclick={() => showCompose = false}
      onkeydown={(e) => e.key === 'Escape' && (showCompose = false)}
      role="button"
      tabindex="-1"
    >
      <div class="modal compose-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Nouveau message</h3>
        <input type="text" placeholder="À" bind:value={composeTo} />
        <input type="text" placeholder="Sujet" bind:value={composeSubject} />
        <textarea placeholder="Message..." bind:value={composeBody}></textarea>
        <div class="modal-actions">
          <button class="cancel-btn" onclick={() => showCompose = false}>Annuler</button>
          <button class="send-btn" onclick={handleSendEmail}>Envoyer</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .communications-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .tab {
    flex: 1;
    padding: 10px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    position: relative;
  }

  .tab:hover {
    background: var(--bg-hover);
  }

  .tab.active {
    color: var(--accent-primary);
    border-bottom: 2px solid var(--accent-primary);
  }

  .badge {
    position: absolute;
    top: 4px;
    right: 8px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
  }

  .badge.missed {
    background: #ef4444;
  }

  .tab-content {
    flex: 1;
    overflow: hidden;
  }

  /* Emails */
  .emails-view {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .emails-toolbar {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .compose-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    cursor: pointer;
  }

  .refresh-btn {
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: none;
    cursor: pointer;
  }

  .emails-container {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .emails-list {
    width: 300px;
    border-right: 1px solid var(--border-color);
    overflow-y: auto;
  }

  .email-item {
    display: block;
    width: 100%;
    padding: 10px;
    border: none;
    border-bottom: 1px solid var(--border-color);
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .email-item:hover {
    background: var(--bg-hover);
  }

  .email-item.selected {
    background: var(--bg-hover);
    border-left: 3px solid var(--accent-primary);
  }

  .email-item.unread {
    background: rgba(var(--accent-primary-rgb), 0.05);
  }

  .email-item.unread .email-from,
  .email-item.unread .email-subject {
    font-weight: 600;
  }

  .email-from {
    font-size: 13px;
    margin-bottom: 2px;
  }

  .email-subject {
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .email-preview {
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 4px;
  }

  .email-date {
    font-size: 10px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .email-detail {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
  }

  .email-header h3 {
    margin: 0 0 8px 0;
  }

  .email-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .email-body {
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  /* Calendar */
  .calendar-view {
    padding: 12px;
    overflow-y: auto;
    height: 100%;
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .event-item {
    display: flex;
    gap: 12px;
    padding: 10px;
    background: var(--bg-secondary);
    border-radius: 6px;
    border-left: 3px solid var(--accent-primary);
  }

  .event-item.allday {
    border-left-color: #8b5cf6;
  }

  .event-time {
    font-size: 12px;
    color: var(--text-secondary);
    min-width: 80px;
  }

  .event-subject {
    font-weight: 500;
    font-size: 13px;
  }

  .event-location {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  /* Phone */
  .phone-view {
    padding: 12px;
    overflow-y: auto;
    height: 100%;
  }

  .phone-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .extension-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ext-number {
    font-size: 18px;
    font-weight: 600;
  }

  .ext-status {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .status-buttons {
    display: flex;
    gap: 4px;
  }

  .status-buttons button {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: none;
    cursor: pointer;
  }

  .dialer {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .dialer input {
    flex: 1;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 16px;
  }

  .call-btn {
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    background: #22c55e;
    cursor: pointer;
    font-size: 18px;
  }

  .active-calls {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 6px;
  }

  .active-calls h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .active-call {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
  }

  .call-number {
    font-weight: 500;
    font-family: monospace;
  }

  .call-name {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .call-status {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--accent-primary);
  }

  .call-actions {
    display: flex;
    gap: 8px;
  }

  .hold-btn,
  .hangup-btn {
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .hangup-btn {
    background: #ef4444;
  }

  .call-history h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 4px;
  }

  .history-item:hover {
    background: var(--bg-hover);
  }

  .history-item.missed {
    background: rgba(239, 68, 68, 0.1);
  }

  .call-details {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .call-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: 11px;
    color: var(--text-secondary);
  }

  /* Notifications */
  .notifications-view {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .notif-toolbar {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .notif-toolbar button {
    padding: 4px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: none;
    font-size: 11px;
    cursor: pointer;
  }

  .notifications-list {
    flex: 1;
    overflow-y: auto;
  }

  .notification-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
  }

  .notification-item:hover {
    background: var(--bg-hover);
  }

  .notification-item.unread {
    background: rgba(var(--accent-primary-rgb), 0.05);
  }

  .notif-content {
    flex: 1;
    min-width: 0;
  }

  .notif-title {
    font-weight: 500;
    font-size: 13px;
  }

  .notif-message {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .notif-time {
    font-size: 10px;
    color: var(--text-secondary);
  }

  .notif-dismiss {
    padding: 2px 6px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    opacity: 0;
  }

  .notification-item:hover .notif-dismiss {
    opacity: 1;
  }

  /* Setup */
  .setup-prompt,
  .setup-form {
    padding: 24px;
    text-align: center;
  }

  .setup-form {
    text-align: left;
  }

  .setup-form h3 {
    margin: 0 0 16px 0;
  }

  .setup-form input {
    width: 100%;
    padding: 10px;
    margin-bottom: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .connect-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    cursor: pointer;
  }

  .cancel-btn {
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: none;
    cursor: pointer;
  }

  /* Empty & loading */
  .empty,
  .loading {
    padding: 24px;
    text-align: center;
    color: var(--text-secondary);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 20px;
  }

  .compose-modal {
    width: 500px;
  }

  .compose-modal h3 {
    margin: 0 0 16px 0;
  }

  .compose-modal input,
  .compose-modal textarea {
    width: 100%;
    padding: 10px;
    margin-bottom: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .compose-modal textarea {
    height: 200px;
    resize: vertical;
    font-family: inherit;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .send-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    cursor: pointer;
  }
</style>
