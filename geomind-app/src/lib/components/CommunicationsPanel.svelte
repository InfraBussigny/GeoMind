<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import {
    outlookStore,
    threeCXStore,
    whatsAppStore,
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
    initOutlookAuth,
    connectWhatsApp,
    disconnectWhatsApp,
    sendWhatsAppMessage,
    getWhatsAppMessages,
    getWhatsAppContacts,
    formatWhatsAppNumber,
    type EmailMessage,
    type CalendarEvent,
    type CallRecord,
    type EmailDraft,
    type ThreeCXConfig,
    type OutlookConfig,
    type WhatsAppConfig,
    type WhatsAppMessage,
    type WhatsAppContact,
    type OutlookState,
    type ThreeCXState,
    type WhatsAppState
  } from '$lib/services/communications';

  // State
  let activeTab = $state<'emails' | 'calendar' | 'phone' | 'whatsapp' | 'notifications'>('emails');

  // Outlook state
  let outlookState = $state<OutlookState>({ isAuthenticated: false, config: null, user: null, unreadCount: 0 });
  let emails = $state<EmailMessage[]>([]);
  let selectedEmail = $state<EmailMessage | null>(null);
  let calendarEvents = $state<CalendarEvent[]>([]);
  let emailsLoading = $state(false);
  let showOutlookSetup = $state(false);
  let outlookConfig = $state<OutlookConfig>({
    clientId: '',
    tenantId: '',
    redirectUri: typeof window !== 'undefined' ? window.location.origin + '/auth/outlook/callback' : '',
    scopes: ['User.Read', 'Mail.Read', 'Mail.Send', 'Calendars.Read']
  });

  // 3CX state
  let threeCXState = $state<ThreeCXState>({ isConnected: false, config: null, extension: null, activeCalls: [], missedCalls: 0 });
  let callHistory = $state<CallRecord[]>([]);
  let dialNumber = $state('');
  let show3CXSetup = $state(false);
  let config3CX = $state<ThreeCXConfig>({ serverUrl: '', extension: '', username: '' });

  // WhatsApp state
  let whatsAppState = $state<WhatsAppState>({ isConnected: false, config: null, contacts: [], activeChat: null, unreadCount: 0 });
  let showWhatsAppSetup = $state(false);
  let whatsAppConfig = $state<WhatsAppConfig>({ phoneNumberId: '', businessAccountId: '', accessToken: '' });
  let whatsAppMessages = $state<WhatsAppMessage[]>([]);
  let whatsAppNewMessage = $state('');
  let selectedContact = $state<WhatsAppContact | null>(null);
  let newWhatsAppNumber = $state('');

  // WhatsApp Web personal mode
  let whatsAppMode = $state<'business' | 'personal'>('personal');
  let whatsAppWebWindow: Window | null = null;
  let whatsAppWebOpen = $state(false);

  // Outlook Web mode
  let outlookWebWindow: Window | null = null;
  let outlookWebOpen = $state(false);

  // 3CX Web mode
  let threeCXWebWindow: Window | null = null;
  let threeCXWebOpen = $state(false);
  let threeCXWebUrl = $state(localStorage.getItem('geomind_3cx_url') || '');

  // Time Pro state
  let timeProWebWindow: Window | null = null;
  let timeProWebOpen = $state(false);
  const timeProUrl = 'https://timepro.bussigny.ch/employee/dashboard';

  // Auto-pointage state
  interface AutoPointageConfig {
    enabled: boolean;
    schedules: Array<{
      id: string;
      time: string; // HH:mm format
      type: 'in' | 'out';
      label: string;
      days: number[]; // 0=dimanche, 1=lundi, etc.
    }>;
  }

  // Initialize safely (localStorage not available in SSR)
  let autoPointageConfig = $state<AutoPointageConfig>({ enabled: false, schedules: [] });
  let showTimeProSetup = $state(false);
  let nextPointage = $state<{ time: string; type: string; label: string } | null>(null);
  let autoPointageIntervalId: ReturnType<typeof setInterval> | null = null;

  // New schedule form
  let newScheduleTime = $state('08:00');
  let newScheduleType = $state<'in' | 'out'>('in');
  let newScheduleLabel = $state('');
  let newScheduleDays = $state<number[]>([1, 2, 3, 4, 5]); // Lundi-Vendredi par défaut

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
    const unsub3 = whatsAppStore.subscribe(s => whatsAppState = s);
    const unsub4 = notificationsStore.subscribe(n => notifications = n);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
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
    if (whatsAppState.isConnected) {
      loadWhatsAppContacts();
    }

    // Initialize Time Pro
    if (browser) {
      // Load saved config from localStorage
      try {
        const saved = localStorage.getItem('geomind_autopointage');
        if (saved) {
          autoPointageConfig = JSON.parse(saved);
        }
      } catch (e) {
        console.warn('Failed to load autopointage config:', e);
      }

      restoreRePointageTimer();
      requestNotificationPermission();
      if (autoPointageConfig.enabled) {
        startAutoPointageChecker();
      }
    }
  });

  onDestroy(() => {
    stopPolling();
    stopRePointageTimer();
    stopAutoPointageChecker();
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
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

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

  // Load WhatsApp contacts
  async function loadWhatsAppContacts() {
    const result = await getWhatsAppContacts();
    if (result.success && result.contacts) {
      // contacts are updated via store
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

  // Connect Outlook
  function handleConnectOutlook() {
    if (!outlookConfig.clientId || !outlookConfig.tenantId) return;
    outlookStore.setConfig(outlookConfig);
    const authUrl = initOutlookAuth(outlookConfig);
    window.open(authUrl, '_blank', 'width=600,height=700');
    showOutlookSetup = false;
  }

  // Connect 3CX
  async function handleConnect3CX() {
    const result = await connect3CX(config3CX);
    if (result.success) {
      show3CXSetup = false;
      loadCallHistory();
    }
  }

  // Connect WhatsApp
  async function handleConnectWhatsApp() {
    if (!whatsAppConfig.phoneNumberId || !whatsAppConfig.accessToken) return;
    const result = await connectWhatsApp(whatsAppConfig);
    if (result.success) {
      showWhatsAppSetup = false;
      loadWhatsAppContacts();
    } else {
      alert('Erreur de connexion: ' + result.error);
    }
  }

  // Select WhatsApp contact
  async function selectWhatsAppContact(contact: WhatsAppContact) {
    selectedContact = contact;
    whatsAppStore.setActiveChat(contact.phone);
    const result = await getWhatsAppMessages(contact.phone);
    if (result.success && result.messages) {
      whatsAppMessages = result.messages;
    }
  }

  // Send WhatsApp message
  async function handleSendWhatsApp() {
    if (!whatsAppNewMessage.trim() || !selectedContact) return;

    const result = await sendWhatsAppMessage(selectedContact.phone, whatsAppNewMessage);
    if (result.success) {
      // Add message locally
      whatsAppMessages = [...whatsAppMessages, {
        id: result.messageId || `local_${Date.now()}`,
        from: 'me',
        to: selectedContact.phone,
        body: whatsAppNewMessage,
        timestamp: new Date(),
        type: 'text',
        status: 'sent'
      }];
      whatsAppNewMessage = '';
    }
  }

  // Start new WhatsApp conversation
  function startNewWhatsAppChat() {
    if (!newWhatsAppNumber.trim()) return;
    const formattedNumber = formatWhatsAppNumber(newWhatsAppNumber);
    const newContact: WhatsAppContact = {
      id: `new_${Date.now()}`,
      phone: formattedNumber,
      name: formattedNumber,
      unreadCount: 0
    };
    whatsAppStore.addContact(newContact);
    selectWhatsAppContact(newContact);
    newWhatsAppNumber = '';
  }

  // Open WhatsApp Web - uses Tauri window if available, else popup
  async function openWhatsAppWeb() {
    // Check if window is already open (browser mode)
    if (whatsAppWebWindow && !whatsAppWebWindow.closed) {
      whatsAppWebWindow.focus();
      return;
    }

    // Try Tauri first
    if (browser) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        // Check if WhatsApp window already exists
        const existing = await WebviewWindow.getByLabel('whatsapp');
        if (existing) {
          await existing.setFocus();
          whatsAppWebOpen = true;
          return;
        }

        // Create new Tauri window for WhatsApp
        const webview = new WebviewWindow('whatsapp', {
          url: 'https://web.whatsapp.com',
          title: 'WhatsApp',
          width: 1200,
          height: 800,
          center: true,
          resizable: true,
          decorations: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        webview.once('tauri://created', () => {
          whatsAppWebOpen = true;
        });

        webview.once('tauri://close-requested', () => {
          whatsAppWebOpen = false;
        });

        webview.once('tauri://error', (e) => {
          console.error('Tauri WhatsApp window error:', e);
          // Fallback to browser popup
          openWhatsAppWebFallback();
        });

        return;
      } catch (e) {
        console.log('Tauri not available, using browser popup');
      }
    }

    // Fallback to browser popup
    openWhatsAppWebFallback();
  }

  // Fallback browser popup for WhatsApp Web
  function openWhatsAppWebFallback() {
    const width = 1200;
    const height = 800;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    whatsAppWebWindow = window.open(
      'https://web.whatsapp.com',
      'WhatsAppWeb',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (whatsAppWebWindow) {
      whatsAppWebOpen = true;

      // Monitor window close
      const checkWindow = setInterval(() => {
        if (whatsAppWebWindow?.closed) {
          whatsAppWebOpen = false;
          whatsAppWebWindow = null;
          clearInterval(checkWindow);
        }
      }, 1000);
    }
  }

  // Send message via WhatsApp Web (opens chat with number)
  async function sendViaWhatsAppWeb(phone: string, message?: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    let url = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
    if (message) {
      url += `&text=${encodeURIComponent(message)}`;
    }

    // Try Tauri first
    if (browser) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        // Check if WhatsApp window exists
        const existing = await WebviewWindow.getByLabel('whatsapp');
        if (existing) {
          // Navigate to the chat URL
          // Note: Tauri 2 doesn't have direct URL navigation, so we close and reopen
          await existing.close();
        }

        // Open new window with the direct chat URL
        const webview = new WebviewWindow('whatsapp', {
          url: url,
          title: 'WhatsApp',
          width: 1200,
          height: 800,
          center: true,
          resizable: true,
          decorations: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        webview.once('tauri://created', () => {
          whatsAppWebOpen = true;
        });

        webview.once('tauri://close-requested', () => {
          whatsAppWebOpen = false;
        });

        return;
      } catch (e) {
        console.log('Tauri not available for WhatsApp send');
      }
    }

    // Fallback to browser
    if (whatsAppWebWindow && !whatsAppWebWindow.closed) {
      whatsAppWebWindow.location.href = url;
      whatsAppWebWindow.focus();
    } else {
      openWhatsAppWebFallback();
      setTimeout(() => {
        if (whatsAppWebWindow) {
          whatsAppWebWindow.location.href = url;
        }
      }, 2000);
    }
  }

  // Open Outlook Web - uses Tauri window if available, else popup
  async function openOutlookWeb() {
    // Check if window is already open (browser mode)
    if (outlookWebWindow && !outlookWebWindow.closed) {
      outlookWebWindow.focus();
      return;
    }

    // Try Tauri first
    if (browser) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        // Check if Outlook window already exists
        const existing = await WebviewWindow.getByLabel('outlook');
        if (existing) {
          await existing.setFocus();
          outlookWebOpen = true;
          return;
        }

        // Create new Tauri window for Outlook
        const webview = new WebviewWindow('outlook', {
          url: 'https://outlook.office.com/mail/',
          title: 'Outlook',
          width: 1400,
          height: 900,
          center: true,
          resizable: true,
          decorations: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        webview.once('tauri://created', () => {
          outlookWebOpen = true;
        });

        webview.once('tauri://close-requested', () => {
          outlookWebOpen = false;
        });

        webview.once('tauri://error', (e) => {
          console.error('Tauri Outlook window error:', e);
          // Fallback to browser popup
          openOutlookWebFallback();
        });

        return;
      } catch (e) {
        console.log('Tauri not available, using browser popup');
      }
    }

    // Fallback to browser popup
    openOutlookWebFallback();
  }

  // Fallback browser popup for Outlook Web
  function openOutlookWebFallback() {
    const width = 1400;
    const height = 900;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    outlookWebWindow = window.open(
      'https://outlook.office.com/mail/',
      'OutlookWeb',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (outlookWebWindow) {
      outlookWebOpen = true;

      // Monitor window close
      const checkWindow = setInterval(() => {
        if (outlookWebWindow?.closed) {
          outlookWebOpen = false;
          outlookWebWindow = null;
          clearInterval(checkWindow);
        }
      }, 1000);
    }
  }

  // Open Outlook Calendar
  async function openOutlookCalendar() {
    if (browser) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const existing = await WebviewWindow.getByLabel('outlook');
        if (existing) {
          // Navigate to calendar - close and reopen with calendar URL
          await existing.close();
        }

        new WebviewWindow('outlook', {
          url: 'https://outlook.office.com/calendar/',
          title: 'Outlook Calendrier',
          width: 1400,
          height: 900,
          center: true,
          resizable: true,
          decorations: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        return;
      } catch (e) {
        // Fallback to browser
      }
    }

    const width = 1400;
    const height = 900;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    window.open(
      'https://outlook.office.com/calendar/',
      'OutlookCalendar',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );
  }

  // Save 3CX URL
  function save3CXUrl(url: string) {
    threeCXWebUrl = url;
    if (browser) {
      localStorage.setItem('geomind_3cx_url', url);
    }
  }

  // Open 3CX Web Client
  async function open3CXWeb() {
    if (!threeCXWebUrl) return;

    // Check if window is already open (browser mode)
    if (threeCXWebWindow && !threeCXWebWindow.closed) {
      threeCXWebWindow.focus();
      return;
    }

    // Try Tauri first
    if (browser) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        // Check if 3CX window already exists
        const existing = await WebviewWindow.getByLabel('threecx');
        if (existing) {
          await existing.setFocus();
          threeCXWebOpen = true;
          return;
        }

        // Create new Tauri window for 3CX
        const webview = new WebviewWindow('threecx', {
          url: threeCXWebUrl,
          title: '3CX',
          width: 1200,
          height: 800,
          center: true,
          resizable: true,
          decorations: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        webview.once('tauri://created', () => {
          threeCXWebOpen = true;
        });

        webview.once('tauri://close-requested', () => {
          threeCXWebOpen = false;
        });

        webview.once('tauri://error', (e) => {
          console.error('Tauri 3CX window error:', e);
          open3CXWebFallback();
        });

        return;
      } catch (e) {
        console.log('Tauri not available, using browser popup');
      }
    }

    // Fallback to browser popup
    open3CXWebFallback();
  }

  // Fallback browser popup for 3CX Web
  function open3CXWebFallback() {
    const width = 1200;
    const height = 800;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    threeCXWebWindow = window.open(
      threeCXWebUrl,
      '3CXWeb',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (threeCXWebWindow) {
      threeCXWebOpen = true;

      // Monitor window close
      const checkWindow = setInterval(() => {
        if (threeCXWebWindow?.closed) {
          threeCXWebOpen = false;
          threeCXWebWindow = null;
          clearInterval(checkWindow);
        }
      }, 1000);
    }
  }

  // ============================================
  // TIME PRO FUNCTIONS
  // ============================================

  // Open Time Pro Web
  async function openTimeProWeb() {
    // Check if window is already open (browser mode)
    if (timeProWebWindow && !timeProWebWindow.closed) {
      timeProWebWindow.focus();
      return;
    }

    // Try Tauri first
    if (browser) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        // Check if Time Pro window already exists
        const existing = await WebviewWindow.getByLabel('timepro');
        if (existing) {
          await existing.setFocus();
          timeProWebOpen = true;
          return;
        }

        // Create new Tauri window for Time Pro
        const webview = new WebviewWindow('timepro', {
          url: timeProUrl,
          title: 'Time Pro - Pointage',
          width: 1200,
          height: 800,
          center: true,
          resizable: true,
          decorations: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        webview.once('tauri://created', () => {
          timeProWebOpen = true;
        });

        webview.once('tauri://close-requested', () => {
          timeProWebOpen = false;
        });

        webview.once('tauri://error', () => {
          openTimeProWebFallback();
        });

        return;
      } catch (e) {
        console.log('Tauri not available, using browser popup');
      }
    }

    // Fallback to browser popup
    openTimeProWebFallback();
  }

  // Fallback browser popup for Time Pro
  function openTimeProWebFallback() {
    const width = 1200;
    const height = 800;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    timeProWebWindow = window.open(
      timeProUrl,
      'TimeProWeb',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (timeProWebWindow) {
      timeProWebOpen = true;

      // Monitor window close
      const checkWindow = setInterval(() => {
        if (timeProWebWindow?.closed) {
          timeProWebOpen = false;
          timeProWebWindow = null;
          clearInterval(checkWindow);
        }
      }, 1000);
    }
  }

  // ============================================
  // AUTO-POINTAGE FUNCTIONS
  // ============================================

  // Timer state for re-pointage
  let rePointageTimer = $state<{ endTime: Date; minutes: number } | null>(null);
  let rePointageIntervalId: ReturnType<typeof setInterval> | null = null;
  let rePointageTimeLeft = $state('');
  let rePointageMinutes = $state(45); // Default 45 minutes

  // Start re-pointage timer
  function startRePointageTimer(minutes?: number) {
    const mins = minutes ?? rePointageMinutes;
    const endTime = new Date(Date.now() + mins * 60 * 1000);
    rePointageTimer = { endTime, minutes: mins };

    // Save to localStorage
    localStorage.setItem('geomind_repointage_timer', JSON.stringify({ endTime: endTime.toISOString(), minutes: mins }));

    // Update countdown
    updateRePointageCountdown();

    // Clear existing interval
    if (rePointageIntervalId) clearInterval(rePointageIntervalId);

    // Start countdown interval
    rePointageIntervalId = setInterval(() => {
      updateRePointageCountdown();
    }, 1000);

    // Send notification
    notificationsStore.add({
      type: 'timepro',
      title: 'Timer re-pointage démarré',
      message: `Rappel dans ${mins} minutes pour re-pointer`
    });
  }

  // Update countdown display
  function updateRePointageCountdown() {
    if (!rePointageTimer) {
      rePointageTimeLeft = '';
      return;
    }

    const now = Date.now();
    const remaining = rePointageTimer.endTime.getTime() - now;

    if (remaining <= 0) {
      // Timer finished - notify and open Time Pro
      rePointageTimeLeft = '00:00';
      stopRePointageTimer();
      triggerRePointageNotification();
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    rePointageTimeLeft = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Stop re-pointage timer
  function stopRePointageTimer() {
    if (rePointageIntervalId) {
      clearInterval(rePointageIntervalId);
      rePointageIntervalId = null;
    }
    rePointageTimer = null;
    rePointageTimeLeft = '';
    localStorage.removeItem('geomind_repointage_timer');
  }

  // Trigger notification when timer finishes
  function triggerRePointageNotification() {
    // Desktop notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Time Pro - Re-pointage', {
        body: 'Il est temps de re-pointer!',
        icon: '/favicon.png',
        requireInteraction: true
      });
    }

    // In-app notification
    notificationsStore.add({
      type: 'timepro',
      title: 'Re-pointage!',
      message: 'Il est temps de re-pointer dans Time Pro'
    });

    // Open Time Pro
    openTimeProWeb();
  }

  // Restore timer on mount if it exists
  function restoreRePointageTimer() {
    const saved = localStorage.getItem('geomind_repointage_timer');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const endTime = new Date(data.endTime);
        if (endTime.getTime() > Date.now()) {
          rePointageTimer = { endTime, minutes: data.minutes };
          updateRePointageCountdown();
          rePointageIntervalId = setInterval(() => {
            updateRePointageCountdown();
          }, 1000);
        } else {
          localStorage.removeItem('geomind_repointage_timer');
        }
      } catch (e) {
        localStorage.removeItem('geomind_repointage_timer');
      }
    }
  }

  // Save auto-pointage config
  function saveAutoPointageConfig() {
    if (browser) {
      localStorage.setItem('geomind_autopointage', JSON.stringify(autoPointageConfig));
    }
  }

  // Add new scheduled pointage
  function addScheduledPointage() {
    if (!newScheduleTime || newScheduleDays.length === 0) return;

    const newSchedule = {
      id: `schedule_${Date.now()}`,
      time: newScheduleTime,
      type: newScheduleType,
      label: newScheduleLabel || (newScheduleType === 'in' ? 'Entrée' : 'Sortie'),
      days: [...newScheduleDays]
    };

    autoPointageConfig.schedules = [...autoPointageConfig.schedules, newSchedule];
    saveAutoPointageConfig();

    // Reset form
    newScheduleTime = '08:00';
    newScheduleType = 'in';
    newScheduleLabel = '';
    newScheduleDays = [1, 2, 3, 4, 5];
  }

  // Remove scheduled pointage
  function removeScheduledPointage(id: string) {
    autoPointageConfig.schedules = autoPointageConfig.schedules.filter(s => s.id !== id);
    saveAutoPointageConfig();
  }

  // Toggle auto-pointage
  function toggleAutoPointage() {
    autoPointageConfig.enabled = !autoPointageConfig.enabled;
    saveAutoPointageConfig();

    if (autoPointageConfig.enabled) {
      startAutoPointageChecker();
    } else {
      stopAutoPointageChecker();
    }
  }

  // Toggle day in schedule form
  function toggleScheduleDay(day: number) {
    if (newScheduleDays.includes(day)) {
      newScheduleDays = newScheduleDays.filter(d => d !== day);
    } else {
      newScheduleDays = [...newScheduleDays, day].sort();
    }
  }

  // Start auto-pointage checker
  function startAutoPointageChecker() {
    if (autoPointageIntervalId) clearInterval(autoPointageIntervalId);

    // Check every minute
    autoPointageIntervalId = setInterval(() => {
      checkScheduledPointages();
    }, 60000);

    // Check immediately
    checkScheduledPointages();
    updateNextPointage();
  }

  // Stop auto-pointage checker
  function stopAutoPointageChecker() {
    if (autoPointageIntervalId) {
      clearInterval(autoPointageIntervalId);
      autoPointageIntervalId = null;
    }
    nextPointage = null;
  }

  // Check if any scheduled pointage should trigger
  function checkScheduledPointages() {
    if (!autoPointageConfig.enabled) return;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    for (const schedule of autoPointageConfig.schedules) {
      if (schedule.days.includes(currentDay) && schedule.time === currentTime) {
        // Check if we already notified for this schedule today
        const notifiedKey = `geomind_pointage_notified_${schedule.id}_${now.toDateString()}`;
        if (!localStorage.getItem(notifiedKey)) {
          triggerScheduledPointage(schedule);
          localStorage.setItem(notifiedKey, 'true');

          // Clean up old notifications
          setTimeout(() => localStorage.removeItem(notifiedKey), 24 * 60 * 60 * 1000);
        }
      }
    }

    updateNextPointage();
  }

  // Trigger a scheduled pointage
  function triggerScheduledPointage(schedule: AutoPointageConfig['schedules'][0]) {
    // Desktop notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Time Pro - ${schedule.label}`, {
        body: `C'est l'heure de pointer (${schedule.type === 'in' ? 'entrée' : 'sortie'})`,
        icon: '/favicon.png',
        requireInteraction: true
      });
    }

    // In-app notification
    notificationsStore.add({
      type: 'timepro',
      title: `Pointage: ${schedule.label}`,
      message: `Heure de ${schedule.type === 'in' ? 'pointer' : 'dépointer'} (${schedule.time})`
    });

    // Open Time Pro
    openTimeProWeb();
  }

  // Update next pointage display
  function updateNextPointage() {
    if (!autoPointageConfig.enabled || autoPointageConfig.schedules.length === 0) {
      nextPointage = null;
      return;
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let closestSchedule: typeof autoPointageConfig.schedules[0] | null = null;
    let closestDiff = Infinity;
    let closestDayOffset = 0;

    // Check for next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDay = (currentDay + dayOffset) % 7;

      for (const schedule of autoPointageConfig.schedules) {
        if (schedule.days.includes(checkDay)) {
          const [hours, mins] = schedule.time.split(':').map(Number);
          const scheduleMinutes = hours * 60 + mins;

          // If same day, only consider future times
          if (dayOffset === 0 && scheduleMinutes <= currentMinutes) continue;

          const diff = dayOffset === 0
            ? scheduleMinutes - currentMinutes
            : (dayOffset * 24 * 60) + scheduleMinutes - currentMinutes;

          if (diff < closestDiff) {
            closestDiff = diff;
            closestSchedule = schedule;
            closestDayOffset = dayOffset;
          }
        }
      }
    }

    if (closestSchedule) {
      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const nextDay = (currentDay + closestDayOffset) % 7;
      const prefix = closestDayOffset === 0 ? "Aujourd'hui" : (closestDayOffset === 1 ? 'Demain' : dayNames[nextDay]);

      nextPointage = {
        time: `${prefix} ${closestSchedule.time}`,
        type: closestSchedule.type === 'in' ? 'Entrée' : 'Sortie',
        label: closestSchedule.label
      };
    } else {
      nextPointage = null;
    }
  }

  // Get day name
  function getDayName(day: number): string {
    return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][day];
  }

  // Request notification permission
  async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  // Note: Time Pro initialization is handled in the existing onMount/onDestroy

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
  let totalWhatsAppUnread = $derived(whatsAppState.contacts.reduce((sum, c) => sum + c.unreadCount, 0));
</script>

<div class="communications-panel">
  <!-- Tabs -->
  <div class="tabs">
    <button class="tab" class:active={activeTab === 'emails'} onclick={() => activeTab = 'emails'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
      <span>Emails</span>
      {#if outlookState.unreadCount > 0}
        <span class="badge">{outlookState.unreadCount}</span>
      {/if}
    </button>
    <button class="tab" class:active={activeTab === 'calendar'} onclick={() => activeTab = 'calendar'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span>Agenda</span>
    </button>
    <button class="tab" class:active={activeTab === 'phone'} onclick={() => activeTab = 'phone'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
      <span>3CX</span>
      {#if threeCXState.missedCalls > 0}
        <span class="badge missed">{threeCXState.missedCalls}</span>
      {/if}
    </button>
    <button class="tab whatsapp-tab" class:active={activeTab === 'whatsapp'} onclick={() => activeTab = 'whatsapp'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      <span>WhatsApp</span>
      {#if totalWhatsAppUnread > 0}
        <span class="badge whatsapp">{totalWhatsAppUnread}</span>
      {/if}
    </button>
    <button class="tab" class:active={activeTab === 'notifications'} onclick={() => activeTab = 'notifications'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span>Notifs</span>
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
          {#if showOutlookSetup}
            <div class="setup-form">
              <h3>Configuration Outlook / Microsoft 365</h3>
              <p class="setup-help">Configurez l'accès à votre compte Microsoft 365 via Azure AD.</p>
              <div class="form-group">
                <label>Client ID (Application ID)</label>
                <input type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" bind:value={outlookConfig.clientId} />
              </div>
              <div class="form-group">
                <label>Tenant ID</label>
                <input type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx ou 'common'" bind:value={outlookConfig.tenantId} />
              </div>
              <div class="form-group">
                <label>Redirect URI</label>
                <input type="text" bind:value={outlookConfig.redirectUri} readonly />
              </div>
              <div class="form-actions">
                <button class="cancel-btn" onclick={() => showOutlookSetup = false}>Annuler</button>
                <button class="connect-btn" onclick={handleConnectOutlook}>Se connecter</button>
              </div>
            </div>
          {:else}
            <div class="setup-prompt outlook-setup">
              <div class="setup-icon outlook-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <h3>Accédez à Outlook</h3>
              <p>Ouvrez Outlook Web pour gérer vos emails et calendrier Microsoft 365.</p>

              <div class="outlook-buttons">
                <button class="connect-btn outlook-web-btn" onclick={openOutlookWeb}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  {outlookWebOpen ? 'Outlook ouvert' : 'Ouvrir Outlook Web'}
                </button>

                <button class="secondary-btn" onclick={openOutlookCalendar}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Calendrier
                </button>
              </div>

              <div class="setup-divider">
                <span>ou</span>
              </div>

              <button class="text-btn" onclick={() => showOutlookSetup = true}>
                Configurer l'API Microsoft Graph (avancé)
              </button>
            </div>
          {/if}
        {:else}
          <div class="emails-toolbar">
            <button class="compose-btn" onclick={() => showCompose = true}>
              + Nouveau
            </button>
            <button class="refresh-btn" onclick={loadEmails} title="Actualiser">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
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
            <div class="setup-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
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
              <div class="form-group">
                <label>URL du serveur 3CX</label>
                <input type="text" placeholder="https://votre-serveur.3cx.ch" bind:value={config3CX.serverUrl} />
              </div>
              <div class="form-group">
                <label>Extension</label>
                <input type="text" placeholder="100" bind:value={config3CX.extension} />
              </div>
              <div class="form-group">
                <label>Nom d'utilisateur</label>
                <input type="text" placeholder="utilisateur" bind:value={config3CX.username} />
              </div>
              <div class="form-group">
                <label>Mot de passe</label>
                <input type="password" placeholder="••••••••" bind:value={config3CX.password} />
              </div>
              <div class="form-actions">
                <button class="cancel-btn" onclick={() => show3CXSetup = false}>Annuler</button>
                <button class="connect-btn" onclick={handleConnect3CX}>Connecter</button>
              </div>
            </div>
          {:else}
            <div class="setup-prompt threecx-setup">
              <div class="setup-icon threecx-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
              <h3>Accédez à 3CX</h3>
              <p>Ouvrez le client web 3CX pour gérer vos appels.</p>

              <div class="threecx-url-input">
                <input
                  type="url"
                  placeholder="https://votre-serveur.3cx.ch"
                  bind:value={threeCXWebUrl}
                  onchange={(e) => save3CXUrl(e.currentTarget.value)}
                />
              </div>

              <div class="threecx-buttons">
                <button
                  class="connect-btn threecx-web-btn"
                  onclick={open3CXWeb}
                  disabled={!threeCXWebUrl}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  {threeCXWebOpen ? '3CX ouvert' : 'Ouvrir 3CX Web'}
                </button>
              </div>

              <div class="setup-divider">
                <span>ou</span>
              </div>

              <button class="text-btn" onclick={() => show3CXSetup = true}>
                Configurer l'API 3CX (avancé)
              </button>
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
              <button onclick={() => handleSetStatus('available')} title="Disponible" class:active={threeCXState.extension?.status === 'available'}>🟢</button>
              <button onclick={() => handleSetStatus('busy')} title="Occupé" class:active={threeCXState.extension?.status === 'busy'}>🔴</button>
              <button onclick={() => handleSetStatus('away')} title="Absent" class:active={threeCXState.extension?.status === 'away'}>🟡</button>
              <button onclick={() => handleSetStatus('dnd')} title="Ne pas déranger" class:active={threeCXState.extension?.status === 'dnd'}>⛔</button>
            </div>
          </div>

          <div class="dialer">
            <input
              type="tel"
              placeholder="Numéro à appeler"
              bind:value={dialNumber}
              onkeydown={(e) => e.key === 'Enter' && handleMakeCall()}
            />
            <button class="call-btn" onclick={handleMakeCall}>📞</button>
          </div>

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
                    <button class="hold-btn" onclick={() => handleHoldCall(call.id, call.status === 'onHold')}>
                      {call.status === 'onHold' ? '▶️' : '⏸️'}
                    </button>
                    <button class="hangup-btn" onclick={() => handleEndCall(call.id)}>📵</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

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

    {:else if activeTab === 'whatsapp'}
      <div class="whatsapp-view">
        <!-- Mode selector -->
        <div class="whatsapp-mode-selector">
          <button
            class="mode-btn"
            class:active={whatsAppMode === 'personal'}
            onclick={() => whatsAppMode = 'personal'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Personnel
          </button>
          <button
            class="mode-btn"
            class:active={whatsAppMode === 'business'}
            onclick={() => whatsAppMode = 'business'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            Business API
          </button>
        </div>

        {#if whatsAppMode === 'personal'}
          <!-- WhatsApp Web Personal Mode -->
          <div class="whatsapp-personal">
            <div class="whatsapp-web-panel">
              <div class="setup-icon whatsapp-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>

              <h3>WhatsApp Web</h3>
              <p>Utilisez votre compte WhatsApp personnel via WhatsApp Web.</p>

              <div class="whatsapp-web-status" class:connected={whatsAppWebOpen}>
                <span class="status-dot"></span>
                <span>{whatsAppWebOpen ? 'WhatsApp Web ouvert' : 'Non connecté'}</span>
              </div>

              <button class="connect-btn whatsapp-connect large" onclick={openWhatsAppWeb}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                {whatsAppWebOpen ? 'Ouvrir la fenêtre WhatsApp' : 'Ouvrir WhatsApp Web'}
              </button>

              <div class="quick-send-section">
                <h4>Envoyer un message rapide</h4>
                <div class="quick-send-form">
                  <input
                    type="tel"
                    placeholder="+41 XX XXX XX XX"
                    bind:value={newWhatsAppNumber}
                  />
                  <button
                    class="send-quick-btn"
                    onclick={() => sendViaWhatsAppWeb(newWhatsAppNumber)}
                    disabled={!newWhatsAppNumber.trim()}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </button>
                </div>
                <p class="help-text">Entrez un numéro pour ouvrir une conversation WhatsApp</p>
              </div>
            </div>
          </div>
        {:else if !whatsAppState.isConnected}
          {#if showWhatsAppSetup}
            <div class="setup-form">
              <h3>Configuration WhatsApp Business</h3>
              <p class="setup-help">Utilisez l'API WhatsApp Business Cloud pour envoyer et recevoir des messages.</p>
              <div class="form-group">
                <label for="wa-phone-id">Phone Number ID</label>
                <input id="wa-phone-id" type="text" placeholder="ID du numéro de téléphone" bind:value={whatsAppConfig.phoneNumberId} />
              </div>
              <div class="form-group">
                <label for="wa-business-id">Business Account ID</label>
                <input id="wa-business-id" type="text" placeholder="ID du compte Business" bind:value={whatsAppConfig.businessAccountId} />
              </div>
              <div class="form-group">
                <label for="wa-token">Access Token</label>
                <input id="wa-token" type="password" placeholder="Token d'accès permanent" bind:value={whatsAppConfig.accessToken} />
              </div>
              <div class="form-actions">
                <button class="cancel-btn" onclick={() => showWhatsAppSetup = false}>Annuler</button>
                <button class="connect-btn whatsapp-connect" onclick={handleConnectWhatsApp}>Connecter</button>
              </div>
            </div>
          {:else}
            <div class="setup-prompt whatsapp-prompt">
              <div class="setup-icon whatsapp-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <h3>Connectez WhatsApp Business</h3>
              <p>Envoyez et recevez des messages WhatsApp directement depuis GeoMind.</p>
              <button class="connect-btn whatsapp-connect" onclick={() => showWhatsAppSetup = true}>Configurer WhatsApp</button>
            </div>
          {/if}
        {:else}
          <div class="whatsapp-container">
            <div class="whatsapp-sidebar">
              <div class="whatsapp-new-chat">
                <input
                  type="tel"
                  placeholder="+41 XX XXX XX XX"
                  bind:value={newWhatsAppNumber}
                  onkeydown={(e) => e.key === 'Enter' && startNewWhatsAppChat()}
                />
                <button onclick={startNewWhatsAppChat} title="Nouvelle conversation">+</button>
              </div>
              <div class="whatsapp-contacts-list">
                {#each whatsAppState.contacts as contact}
                  <button
                    class="whatsapp-contact"
                    class:active={selectedContact?.phone === contact.phone}
                    onclick={() => selectWhatsAppContact(contact)}
                  >
                    <div class="contact-avatar">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="contact-info">
                      <div class="contact-name">{contact.name}</div>
                      {#if contact.lastMessage}
                        <div class="contact-last-msg">{contact.lastMessage}</div>
                      {/if}
                    </div>
                    {#if contact.unreadCount > 0}
                      <span class="contact-badge">{contact.unreadCount}</span>
                    {/if}
                  </button>
                {:else}
                  <div class="empty">Aucune conversation</div>
                {/each}
              </div>
            </div>

            <div class="whatsapp-chat">
              {#if selectedContact}
                <div class="chat-header">
                  <div class="contact-avatar">{selectedContact.name.charAt(0).toUpperCase()}</div>
                  <div class="chat-contact-info">
                    <div class="chat-contact-name">{selectedContact.name}</div>
                    <div class="chat-contact-phone">{selectedContact.phone}</div>
                  </div>
                </div>

                <div class="chat-messages">
                  {#each whatsAppMessages as msg}
                    <div class="message" class:sent={msg.from === 'me'} class:received={msg.from !== 'me'}>
                      <div class="message-content">{msg.body}</div>
                      <div class="message-meta">
                        <span class="message-time">{msg.timestamp.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</span>
                        {#if msg.from === 'me'}
                          <span class="message-status">
                            {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        {/if}
                      </div>
                    </div>
                  {:else}
                    <div class="empty-chat">Aucun message. Envoyez le premier!</div>
                  {/each}
                </div>

                <div class="chat-input">
                  <input
                    type="text"
                    placeholder="Écrire un message..."
                    bind:value={whatsAppNewMessage}
                    onkeydown={(e) => e.key === 'Enter' && handleSendWhatsApp()}
                  />
                  <button class="send-whatsapp-btn" onclick={handleSendWhatsApp}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </button>
                </div>
              {:else}
                <div class="no-chat-selected">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <p>Sélectionnez une conversation ou démarrez-en une nouvelle</p>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'notifications'}
      <div class="notifications-view">
        <div class="notif-toolbar">
          <button onclick={() => notificationsStore.markAllRead()}>Tout marquer comme lu</button>
          <button onclick={() => notificationsStore.clear()}>Effacer tout</button>
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
                {notif.type === 'email' ? '✉️' : notif.type === 'call' ? '📞' : notif.type === 'calendar' ? '📅' : notif.type === 'whatsapp' ? '💬' : '🔔'}
              </span>
              <div class="notif-content">
                <div class="notif-title">{notif.title}</div>
                <div class="notif-message">{notif.message}</div>
              </div>
              <div class="notif-time">{formatEmailDate(notif.timestamp)}</div>
              <button class="notif-dismiss" onclick={(e) => { e.stopPropagation(); notificationsStore.remove(notif.id); }}>✕</button>
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
    overflow-x: auto;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    position: relative;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .tab:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .tab.active {
    color: var(--accent-primary);
    border-bottom: 2px solid var(--accent-primary);
  }

  .tab.whatsapp-tab.active {
    color: #25D366;
    border-bottom-color: #25D366;
  }

  .tab.timepro-tab.active {
    color: #00d4ff;
    border-bottom-color: #00d4ff;
  }

  .badge.timer {
    background: #00d4ff;
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 2px 5px;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .badge {
    position: absolute;
    top: 6px;
    right: 6px;
    background: var(--accent-primary);
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    font-weight: 600;
  }

  .badge.missed {
    background: #ef4444;
  }

  .badge.whatsapp {
    background: #25D366;
  }

  .tab-content {
    flex: 1;
    overflow: hidden;
  }

  /* Setup prompts */
  .setup-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 32px;
    text-align: center;
  }

  .setup-icon {
    margin-bottom: 16px;
    color: var(--text-secondary);
  }

  .whatsapp-icon {
    color: #25D366;
  }

  .outlook-icon {
    color: #0078D4;
  }

  .threecx-icon {
    color: #F8B500;
  }

  .outlook-setup,
  .threecx-setup {
    gap: 8px;
  }

  .outlook-buttons {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .outlook-web-btn {
    background: linear-gradient(135deg, #0078D4 0%, #106EBE 100%);
    border: none;
    padding: 12px 24px;
    font-size: 14px;
  }

  .outlook-web-btn:hover {
    background: linear-gradient(135deg, #106EBE 0%, #005A9E 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 120, 212, 0.4);
  }

  .threecx-url-input {
    width: 100%;
    max-width: 350px;
    margin-bottom: 16px;
  }

  .threecx-url-input input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
  }

  .threecx-url-input input:focus {
    outline: none;
    border-color: #F8B500;
    box-shadow: 0 0 0 3px rgba(248, 181, 0, 0.2);
  }

  .threecx-buttons {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .threecx-web-btn {
    background: linear-gradient(135deg, #F8B500 0%, #E5A800 100%);
    border: none;
    padding: 12px 24px;
    font-size: 14px;
    color: #000;
  }

  .threecx-web-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #E5A800 0%, #CC9500 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(248, 181, 0, 0.4);
  }

  .threecx-web-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .secondary-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .secondary-btn:hover {
    background: var(--bg-hover);
    border-color: var(--primary);
  }

  .setup-divider {
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 300px;
    margin: 8px 0;
    color: var(--text-muted);
    font-size: 12px;
  }

  .setup-divider::before,
  .setup-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-color);
  }

  .setup-divider span {
    padding: 0 12px;
  }

  .text-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    text-decoration: underline;
    padding: 8px;
  }

  .text-btn:hover {
    color: var(--primary);
  }

  .setup-prompt h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
  }

  .setup-prompt p {
    color: var(--text-secondary);
    margin: 0 0 20px 0;
    max-width: 300px;
  }

  .setup-form {
    max-width: 400px;
    margin: 24px auto;
    padding: 24px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .setup-form h3 {
    margin: 0 0 8px 0;
  }

  .setup-help {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0 0 16px 0;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .form-group label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .form-group input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 13px;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--accent-primary);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .connect-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    background: var(--accent-primary);
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .connect-btn:hover {
    filter: brightness(1.1);
  }

  .connect-btn.whatsapp-connect {
    background: #25D366;
  }

  .cancel-btn {
    padding: 10px 20px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: none;
    color: var(--text-primary);
    cursor: pointer;
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
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .compose-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: var(--accent-primary);
    color: white;
    font-weight: 500;
    cursor: pointer;
  }

  .refresh-btn {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    color: var(--text-secondary);
  }

  .emails-container {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .emails-list {
    width: 320px;
    border-right: 1px solid var(--border-color);
    overflow-y: auto;
  }

  .email-item {
    display: block;
    width: 100%;
    padding: 12px;
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
    background: rgba(59, 130, 246, 0.05);
  }

  .email-item.unread .email-from,
  .email-item.unread .email-subject {
    font-weight: 600;
  }

  .email-from {
    font-size: 13px;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .email-subject {
    font-size: 12px;
    color: var(--text-primary);
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
    margin-top: 6px;
  }

  .email-detail {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }

  .email-header h3 {
    margin: 0 0 12px 0;
    font-size: 18px;
  }

  .email-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 20px;
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
    padding: 16px;
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
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border-left: 3px solid var(--accent-primary);
  }

  .event-item.allday {
    border-left-color: #8b5cf6;
  }

  .event-time {
    font-size: 12px;
    color: var(--text-secondary);
    min-width: 100px;
  }

  .event-subject {
    font-weight: 500;
    font-size: 14px;
  }

  .event-location {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  /* Phone */
  .phone-view {
    padding: 16px;
    overflow-y: auto;
    height: 100%;
  }

  .phone-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .extension-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ext-number {
    font-size: 20px;
    font-weight: 600;
  }

  .ext-status {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .status-buttons {
    display: flex;
    gap: 4px;
  }

  .status-buttons button {
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: none;
    cursor: pointer;
    font-size: 14px;
  }

  .status-buttons button.active {
    background: var(--bg-hover);
    border-color: var(--accent-primary);
  }

  .dialer {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }

  .dialer input {
    flex: 1;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 18px;
  }

  .call-btn {
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    background: #22c55e;
    cursor: pointer;
    font-size: 20px;
  }

  .active-calls {
    margin-bottom: 20px;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .active-calls h4,
  .call-history h4 {
    margin: 0 0 12px 0;
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .active-call {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
  }

  .call-number {
    font-weight: 500;
    font-family: monospace;
    font-size: 14px;
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
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
  }

  .hangup-btn {
    background: #ef4444;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 6px;
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

  /* WhatsApp */
  .whatsapp-view {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .whatsapp-mode-selector {
    display: flex;
    gap: 4px;
    padding: 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: 20px;
    background: none;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mode-btn:hover {
    background: var(--bg-hover);
  }

  .mode-btn.active {
    background: #25D366;
    border-color: #25D366;
    color: white;
  }

  .whatsapp-personal {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }

  .whatsapp-web-panel {
    text-align: center;
    max-width: 400px;
  }

  .whatsapp-web-panel h3 {
    margin: 16px 0 8px 0;
    font-size: 20px;
  }

  .whatsapp-web-panel > p {
    color: var(--text-secondary);
    margin: 0 0 20px 0;
  }

  .whatsapp-web-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 20px;
    background: var(--bg-secondary);
    font-size: 13px;
    margin-bottom: 20px;
  }

  .whatsapp-web-status .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
  }

  .whatsapp-web-status.connected .status-dot {
    background: #25D366;
    box-shadow: 0 0 8px #25D366;
  }

  .connect-btn.large {
    padding: 14px 28px;
    font-size: 15px;
  }

  .quick-send-section {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--border-color);
  }

  .quick-send-section h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .quick-send-form {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .quick-send-form input {
    width: 200px;
    padding: 10px 16px;
    border: 1px solid var(--border-color);
    border-radius: 20px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
  }

  .quick-send-form input:focus {
    outline: none;
    border-color: #25D366;
  }

  .send-quick-btn {
    width: 42px;
    height: 42px;
    border: none;
    border-radius: 50%;
    background: #25D366;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .send-quick-btn:hover:not(:disabled) {
    background: #128C7E;
  }

  .send-quick-btn:disabled {
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: not-allowed;
  }

  .help-text {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 8px;
  }

  .whatsapp-container {
    display: flex;
    height: 100%;
  }

  .whatsapp-sidebar {
    width: 280px;
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
  }

  .whatsapp-new-chat {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .whatsapp-new-chat input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 20px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 13px;
  }

  .whatsapp-new-chat button {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: #25D366;
    color: white;
    font-size: 18px;
    cursor: pointer;
  }

  .whatsapp-contacts-list {
    flex: 1;
    overflow-y: auto;
  }

  .whatsapp-contact {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px;
    border: none;
    border-bottom: 1px solid var(--border-color);
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .whatsapp-contact:hover {
    background: var(--bg-hover);
  }

  .whatsapp-contact.active {
    background: var(--bg-hover);
  }

  .contact-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #25D366, #128C7E);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 16px;
  }

  .contact-info {
    flex: 1;
    min-width: 0;
  }

  .contact-name {
    font-weight: 500;
    font-size: 14px;
  }

  .contact-last-msg {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .contact-badge {
    background: #25D366;
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    font-weight: 600;
  }

  .whatsapp-chat {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .chat-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .chat-contact-name {
    font-weight: 500;
  }

  .chat-contact-phone {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .chat-messages {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .message {
    max-width: 70%;
    padding: 10px 14px;
    border-radius: 12px;
  }

  .message.sent {
    align-self: flex-end;
    background: #DCF8C6;
    color: #111;
    border-bottom-right-radius: 4px;
  }

  .message.received {
    align-self: flex-start;
    background: var(--bg-secondary);
    border-bottom-left-radius: 4px;
  }

  .message-content {
    font-size: 14px;
    line-height: 1.4;
  }

  .message-meta {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }

  .message-time {
    font-size: 10px;
    color: #667781;
  }

  .message-status {
    font-size: 12px;
    color: #53bdeb;
  }

  .empty-chat {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }

  .no-chat-selected {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }

  .no-chat-selected p {
    margin-top: 16px;
    text-align: center;
  }

  .chat-input {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
  }

  .chat-input input {
    flex: 1;
    padding: 10px 16px;
    border: 1px solid var(--border-color);
    border-radius: 20px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
  }

  .send-whatsapp-btn {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: #25D366;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
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
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .notif-toolbar button {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: none;
    font-size: 12px;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .notifications-list {
    flex: 1;
    overflow-y: auto;
  }

  .notification-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
  }

  .notification-item:hover {
    background: var(--bg-hover);
  }

  .notification-item.unread {
    background: rgba(59, 130, 246, 0.05);
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
    padding: 4px 8px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    opacity: 0;
  }

  .notification-item:hover .notif-dismiss {
    opacity: 1;
  }

  /* Empty & loading */
  .empty,
  .loading {
    padding: 32px;
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
    border-radius: 12px;
    padding: 24px;
  }

  .compose-modal {
    width: 500px;
  }

  .compose-modal h3 {
    margin: 0 0 20px 0;
  }

  .compose-modal input,
  .compose-modal textarea {
    width: 100%;
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
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
    margin-top: 8px;
  }

  .send-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    background: var(--accent-primary);
    color: white;
    font-weight: 500;
    cursor: pointer;
  }

  /* ============================================
     TIME PRO STYLES
     ============================================ */

  .timepro-view {
    padding: 20px;
    overflow-y: auto;
    height: 100%;
  }

  .timepro-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .timepro-header h3 {
    margin: 0;
    font-size: 18px;
    color: var(--text-primary);
  }

  .timepro-web-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0, 212, 255, 0.3);
  }

  .timepro-web-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.4);
  }

  .timepro-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .timepro-section h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: var(--text-primary);
    font-weight: 600;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .section-desc {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0 0 16px 0;
  }

  .toggle-auto-btn {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 20px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-auto-btn.active {
    background: rgba(0, 212, 255, 0.2);
    border-color: #00d4ff;
    color: #00d4ff;
  }

  /* Timer styles */
  .timer-active {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid #00d4ff;
    border-radius: 8px;
    padding: 16px;
  }

  .timer-display {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .timer-countdown {
    font-size: 32px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: #00d4ff;
  }

  .timer-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .timer-stop-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: rgba(255, 100, 100, 0.2);
    border: 1px solid #ff6464;
    border-radius: 6px;
    color: #ff6464;
    cursor: pointer;
    transition: all 0.2s;
  }

  .timer-stop-btn:hover {
    background: #ff6464;
    color: white;
  }

  .timer-setup {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .timer-input-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .timer-input-group label {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .timer-input-group input {
    width: 80px;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-mono);
    text-align: center;
  }

  .timer-presets {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .preset-btn {
    padding: 8px 16px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-btn:hover {
    border-color: #00d4ff;
    color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
  }

  .timer-start-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .timer-start-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.4);
  }

  /* Next pointage */
  .next-pointage {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(0, 212, 255, 0.1);
    border-left: 3px solid #00d4ff;
    border-radius: 0 8px 8px 0;
    margin-bottom: 16px;
  }

  .next-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .next-info {
    font-weight: 600;
    color: #00d4ff;
  }

  /* Schedules list */
  .schedules-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .schedule-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    border-left: 3px solid var(--border-color);
  }

  .schedule-item.in {
    border-left-color: #22c55e;
  }

  .schedule-item.out {
    border-left-color: #f59e0b;
  }

  .schedule-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .schedule-time {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 14px;
    color: var(--text-primary);
  }

  .schedule-label {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .schedule-days {
    font-size: 11px;
    color: var(--text-muted);
    padding: 2px 8px;
    background: var(--bg-primary);
    border-radius: 4px;
  }

  .schedule-delete {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .schedule-delete:hover {
    background: rgba(255, 100, 100, 0.2);
    border-color: #ff6464;
    color: #ff6464;
  }

  /* Add schedule form */
  .add-schedule-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .schedule-form-row {
    display: flex;
    gap: 10px;
  }

  .time-input {
    width: 100px;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .type-select {
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .label-input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .days-selector {
    display: flex;
    gap: 6px;
  }

  .day-btn {
    flex: 1;
    padding: 8px 4px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-tertiary);
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .day-btn:hover {
    border-color: #00d4ff;
    color: var(--text-primary);
  }

  .day-btn.selected {
    background: rgba(0, 212, 255, 0.2);
    border-color: #00d4ff;
    color: #00d4ff;
    font-weight: 600;
  }

  .add-schedule-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: var(--bg-tertiary);
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-schedule-btn:hover:not(:disabled) {
    border-style: solid;
    border-color: #00d4ff;
    color: #00d4ff;
    background: rgba(0, 212, 255, 0.1);
  }

  .add-schedule-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Examples section */
  .timepro-section.examples {
    background: transparent;
    border: none;
    padding: 0;
  }

  .example-btns {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .example-btn {
    padding: 8px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .example-btn:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
</style>
