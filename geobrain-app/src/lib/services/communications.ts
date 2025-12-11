/**
 * GeoMind Communications Service
 * Intégration Outlook (Microsoft Graph API) et 3CX
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================
// Types
// ============================================

// Email types
export interface EmailMessage {
  id: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  body: string;
  bodyPreview: string;
  isRead: boolean;
  hasAttachments: boolean;
  receivedDateTime: Date;
  importance: 'low' | 'normal' | 'high';
  categories?: string[];
}

export interface EmailAddress {
  name: string;
  address: string;
}

export interface EmailDraft {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: Array<{ name: string; content: string; contentType: string }>;
}

export interface CalendarEvent {
  id: string;
  subject: string;
  start: Date;
  end: Date;
  location?: string;
  attendees: EmailAddress[];
  isAllDay: boolean;
  status: 'free' | 'tentative' | 'busy' | 'outOfOffice';
  body?: string;
}

// 3CX types
export interface PhoneExtension {
  id: string;
  number: string;
  name: string;
  status: 'available' | 'busy' | 'away' | 'dnd' | 'offline';
  queueStatus?: 'loggedIn' | 'loggedOut';
}

export interface CallRecord {
  id: string;
  type: 'inbound' | 'outbound' | 'missed';
  number: string;
  name?: string;
  duration: number;
  timestamp: Date;
  recordingUrl?: string;
}

export interface ActiveCall {
  id: string;
  direction: 'inbound' | 'outbound';
  number: string;
  name?: string;
  status: 'ringing' | 'connected' | 'onHold';
  startTime: Date;
}

// Config types
export interface OutlookConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}

export interface ThreeCXConfig {
  serverUrl: string;
  extension: string;
  username: string;
  password?: string;
}

// ============================================
// Constants
// ============================================

const API_BASE = 'http://localhost:3001/api';
const STORAGE_KEY_OUTLOOK = 'geobrain_outlook_config';
const STORAGE_KEY_3CX = 'geobrain_3cx_config';

// Default Outlook scopes
const DEFAULT_OUTLOOK_SCOPES = [
  'User.Read',
  'Mail.Read',
  'Mail.Send',
  'Calendars.Read',
  'Calendars.ReadWrite'
];

// ============================================
// Outlook Store
// ============================================

export interface OutlookState {
  isAuthenticated: boolean;
  config: OutlookConfig | null;
  user: { name: string; email: string } | null;
  unreadCount: number;
}

function createOutlookStore() {
  const initial: OutlookState = {
    isAuthenticated: false,
    config: null,
    user: null,
    unreadCount: 0
  };

  // Load config from storage
  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_OUTLOOK);
      if (stored) {
        initial.config = JSON.parse(stored);
      }
    } catch {}
  }

  const { subscribe, set, update } = writable<OutlookState>(initial);

  return {
    subscribe,

    setConfig(config: OutlookConfig) {
      update(state => {
        if (browser) {
          localStorage.setItem(STORAGE_KEY_OUTLOOK, JSON.stringify(config));
        }
        return { ...state, config };
      });
    },

    setAuthenticated(isAuthenticated: boolean, user?: { name: string; email: string }) {
      update(state => ({ ...state, isAuthenticated, user: user || null }));
    },

    setUnreadCount(count: number) {
      update(state => ({ ...state, unreadCount: count }));
    },

    logout() {
      set({ ...initial, config: get({ subscribe }).config });
    }
  };
}

export const outlookStore = createOutlookStore();

// ============================================
// 3CX Store
// ============================================

export interface ThreeCXState {
  isConnected: boolean;
  config: ThreeCXConfig | null;
  extension: PhoneExtension | null;
  activeCalls: ActiveCall[];
  missedCalls: number;
}

function createThreeCXStore() {
  const initial: ThreeCXState = {
    isConnected: false,
    config: null,
    extension: null,
    activeCalls: [],
    missedCalls: 0
  };

  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_3CX);
      if (stored) {
        initial.config = JSON.parse(stored);
      }
    } catch {}
  }

  const { subscribe, set, update } = writable<ThreeCXState>(initial);

  return {
    subscribe,

    setConfig(config: ThreeCXConfig) {
      update(state => {
        if (browser) {
          // Don't store password
          const toStore = { ...config, password: undefined };
          localStorage.setItem(STORAGE_KEY_3CX, JSON.stringify(toStore));
        }
        return { ...state, config };
      });
    },

    setConnected(isConnected: boolean, extension?: PhoneExtension) {
      update(state => ({ ...state, isConnected, extension: extension || null }));
    },

    setActiveCalls(calls: ActiveCall[]) {
      update(state => ({ ...state, activeCalls: calls }));
    },

    addCall(call: ActiveCall) {
      update(state => ({
        ...state,
        activeCalls: [...state.activeCalls, call]
      }));
    },

    removeCall(callId: string) {
      update(state => ({
        ...state,
        activeCalls: state.activeCalls.filter(c => c.id !== callId)
      }));
    },

    setMissedCalls(count: number) {
      update(state => ({ ...state, missedCalls: count }));
    },

    disconnect() {
      set({ ...initial, config: get({ subscribe }).config });
    }
  };
}

export const threeCXStore = createThreeCXStore();

// ============================================
// Outlook API Functions
// ============================================

/**
 * Initialize Outlook OAuth flow
 */
export function initOutlookAuth(config: OutlookConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    response_mode: 'query'
  });

  return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params}`;
}

/**
 * Exchange auth code for tokens (via backend)
 */
export async function exchangeOutlookCode(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/outlook/auth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const result = await response.json();

    if (result.success && result.user) {
      outlookStore.setAuthenticated(true, result.user);
    }

    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get emails from inbox
 */
export async function getEmails(folder = 'inbox', top = 50, skip = 0): Promise<{ success: boolean; emails?: EmailMessage[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/outlook/mail/${folder}?top=${top}&skip=${skip}`);
    const result = await response.json();

    if (result.success && result.emails) {
      result.emails = result.emails.map((e: EmailMessage) => ({
        ...e,
        receivedDateTime: new Date(e.receivedDateTime)
      }));
    }

    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get single email
 */
export async function getEmail(id: string): Promise<{ success: boolean; email?: EmailMessage; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/outlook/mail/message/${id}`);
    const result = await response.json();

    if (result.success && result.email) {
      result.email.receivedDateTime = new Date(result.email.receivedDateTime);
    }

    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Send email
 */
export async function sendEmail(draft: EmailDraft): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/outlook/mail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });

    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Mark email as read/unread
 */
export async function markEmailRead(id: string, isRead: boolean): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/outlook/mail/message/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead })
    });

    return await response.json();
  } catch (error) {
    return { success: false };
  }
}

/**
 * Get calendar events
 */
export async function getCalendarEvents(start: Date, end: Date): Promise<{ success: boolean; events?: CalendarEvent[]; error?: string }> {
  try {
    const response = await fetch(
      `${API_BASE}/outlook/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`
    );
    const result = await response.json();

    if (result.success && result.events) {
      result.events = result.events.map((e: CalendarEvent) => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end)
      }));
    }

    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Create calendar event
 */
export async function createCalendarEvent(event: Omit<CalendarEvent, 'id'>): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/outlook/calendar/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });

    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get unread email count
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const response = await fetch(`${API_BASE}/outlook/mail/unread/count`);
    const result = await response.json();
    const count = result.success ? result.count : 0;
    outlookStore.setUnreadCount(count);
    return count;
  } catch {
    return 0;
  }
}

// ============================================
// 3CX API Functions
// ============================================

/**
 * Connect to 3CX
 */
export async function connect3CX(config: ThreeCXConfig): Promise<{ success: boolean; extension?: PhoneExtension; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/3cx/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const result = await response.json();

    if (result.success) {
      threeCXStore.setConfig(config);
      threeCXStore.setConnected(true, result.extension);
    }

    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Disconnect from 3CX
 */
export async function disconnect3CX(): Promise<void> {
  try {
    await fetch(`${API_BASE}/3cx/disconnect`, { method: 'POST' });
  } catch {}
  threeCXStore.disconnect();
}

/**
 * Make a call
 */
export async function makeCall(number: string): Promise<{ success: boolean; callId?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/3cx/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number })
    });

    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * End a call
 */
export async function endCall(callId: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/3cx/call/${callId}/end`, {
      method: 'POST'
    });
    return await response.json();
  } catch {
    return { success: false };
  }
}

/**
 * Hold/Resume call
 */
export async function holdCall(callId: string, hold: boolean): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/3cx/call/${callId}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hold })
    });
    return await response.json();
  } catch {
    return { success: false };
  }
}

/**
 * Transfer call
 */
export async function transferCall(callId: string, targetNumber: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/3cx/call/${callId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: targetNumber })
    });
    return await response.json();
  } catch {
    return { success: false };
  }
}

/**
 * Get call history
 */
export async function getCallHistory(limit = 50): Promise<{ success: boolean; calls?: CallRecord[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/3cx/calls/history?limit=${limit}`);
    const result = await response.json();

    if (result.success && result.calls) {
      result.calls = result.calls.map((c: CallRecord) => ({
        ...c,
        timestamp: new Date(c.timestamp)
      }));
    }

    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Set extension status
 */
export async function setExtensionStatus(status: PhoneExtension['status']): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/3cx/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return await response.json();
  } catch {
    return { success: false };
  }
}

/**
 * Get missed calls count
 */
export async function getMissedCallsCount(): Promise<number> {
  try {
    const response = await fetch(`${API_BASE}/3cx/calls/missed/count`);
    const result = await response.json();
    const count = result.success ? result.count : 0;
    threeCXStore.setMissedCalls(count);
    return count;
  } catch {
    return 0;
  }
}

// ============================================
// Notifications Store
// ============================================

export interface Notification {
  id: string;
  type: 'email' | 'call' | 'calendar' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  action?: { label: string; handler: () => void };
}

function createNotificationsStore() {
  const { subscribe, update } = writable<Notification[]>([]);

  return {
    subscribe,

    add(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) {
      update(notifications => [{
        ...notification,
        id: `notif_${Date.now()}`,
        timestamp: new Date(),
        isRead: false
      }, ...notifications].slice(0, 100)); // Keep max 100
    },

    markRead(id: string) {
      update(notifications =>
        notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    },

    markAllRead() {
      update(notifications =>
        notifications.map(n => ({ ...n, isRead: true }))
      );
    },

    remove(id: string) {
      update(notifications => notifications.filter(n => n.id !== id));
    },

    clear() {
      update(() => []);
    }
  };
}

export const notificationsStore = createNotificationsStore();

// ============================================
// Utility Functions
// ============================================

export function formatPhoneNumber(number: string): string {
  // Swiss format: +41 XX XXX XX XX
  const cleaned = number.replace(/\D/g, '');

  if (cleaned.startsWith('41') && cleaned.length === 11) {
    return `+41 ${cleaned.slice(2, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9)}`;
  }

  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }

  return number;
}

export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatEmailDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Hier';
  } else if (days < 7) {
    return date.toLocaleDateString('fr-CH', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' });
  }
}

// ============================================
// Polling for updates
// ============================================

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function startPolling(intervalMs = 60000): void {
  if (pollingInterval) return;

  pollingInterval = setInterval(async () => {
    const outlookState = get(outlookStore);
    const threeCXState = get(threeCXStore);

    if (outlookState.isAuthenticated) {
      await getUnreadCount();
    }

    if (threeCXState.isConnected) {
      await getMissedCallsCount();
    }
  }, intervalMs);
}

export function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
