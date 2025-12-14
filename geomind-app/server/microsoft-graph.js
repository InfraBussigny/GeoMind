/**
 * Microsoft Graph API Integration
 * Handles Outlook emails and Calendar via OAuth2
 */

import * as msal from '@azure/msal-node';
import fetch from 'node-fetch';

// In-memory token cache (in production, use a proper cache)
let tokenCache = {};
let msalClient = null;

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * Initialize MSAL client with config
 */
export function initMsalClient(config) {
  const msalConfig = {
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId || 'common'}`,
      clientSecret: config.clientSecret // Optional for public clients
    }
  };

  msalClient = new msal.ConfidentialClientApplication(msalConfig);
  return msalClient;
}

/**
 * Get authorization URL for OAuth2 flow
 */
export function getAuthUrl(config, state = 'default') {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    response_mode: 'query',
    state: state
  });

  const authority = config.tenantId === 'common' ? 'common' : config.tenantId;
  return `https://login.microsoftonline.com/${authority}/oauth2/v2.0/authorize?${params}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(config, code) {
  try {
    if (!msalClient) {
      initMsalClient(config);
    }

    const tokenRequest = {
      code: code,
      scopes: config.scopes,
      redirectUri: config.redirectUri
    };

    const response = await msalClient.acquireTokenByCode(tokenRequest);

    // Store tokens
    tokenCache = {
      accessToken: response.accessToken,
      expiresOn: response.expiresOn,
      account: response.account
    };

    return {
      success: true,
      user: {
        name: response.account?.name || 'User',
        email: response.account?.username || ''
      }
    };
  } catch (error) {
    console.error('Token exchange error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get access token (refresh if needed)
 */
export async function getAccessToken() {
  if (!tokenCache.accessToken) {
    return null;
  }

  // Check if token is expired
  if (tokenCache.expiresOn && new Date() >= tokenCache.expiresOn) {
    // Try to refresh
    if (msalClient && tokenCache.account) {
      try {
        const response = await msalClient.acquireTokenSilent({
          account: tokenCache.account,
          scopes: ['User.Read', 'Mail.Read', 'Mail.Send', 'Calendars.Read', 'Calendars.ReadWrite']
        });
        tokenCache.accessToken = response.accessToken;
        tokenCache.expiresOn = response.expiresOn;
      } catch (error) {
        console.error('Token refresh failed:', error);
        return null;
      }
    }
  }

  return tokenCache.accessToken;
}

/**
 * Make authenticated request to Graph API
 */
export async function graphRequest(endpoint, options = {}) {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${GRAPH_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Graph API error: ${response.status} - ${error}` };
    }

    // Some endpoints return no content (202, 204)
    if (response.status === 202 || response.status === 204) {
      return { success: true, data: null };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get user profile
 */
export async function getProfile() {
  return await graphRequest('/me');
}

/**
 * Get emails from a folder
 */
export async function getEmails(folder = 'inbox', top = 50, skip = 0) {
  const result = await graphRequest(
    `/me/mailFolders/${folder}/messages?$top=${top}&$skip=${skip}&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,ccRecipients,bodyPreview,body,isRead,hasAttachments,receivedDateTime,importance,categories`
  );

  if (result.success) {
    return {
      success: true,
      emails: result.data.value.map(email => ({
        id: email.id,
        subject: email.subject,
        from: {
          name: email.from?.emailAddress?.name || '',
          address: email.from?.emailAddress?.address || ''
        },
        to: (email.toRecipients || []).map(r => ({
          name: r.emailAddress?.name || '',
          address: r.emailAddress?.address || ''
        })),
        cc: (email.ccRecipients || []).map(r => ({
          name: r.emailAddress?.name || '',
          address: r.emailAddress?.address || ''
        })),
        body: email.body?.content || '',
        bodyPreview: email.bodyPreview || '',
        isRead: email.isRead,
        hasAttachments: email.hasAttachments,
        receivedDateTime: email.receivedDateTime,
        importance: email.importance || 'normal',
        categories: email.categories || []
      }))
    };
  }

  return result;
}

/**
 * Get single email
 */
export async function getEmail(id) {
  const result = await graphRequest(`/me/messages/${id}`);

  if (result.success) {
    const email = result.data;
    return {
      success: true,
      email: {
        id: email.id,
        subject: email.subject,
        from: {
          name: email.from?.emailAddress?.name || '',
          address: email.from?.emailAddress?.address || ''
        },
        to: (email.toRecipients || []).map(r => ({
          name: r.emailAddress?.name || '',
          address: r.emailAddress?.address || ''
        })),
        cc: (email.ccRecipients || []).map(r => ({
          name: r.emailAddress?.name || '',
          address: r.emailAddress?.address || ''
        })),
        body: email.body?.content || '',
        bodyPreview: email.bodyPreview || '',
        isRead: email.isRead,
        hasAttachments: email.hasAttachments,
        receivedDateTime: email.receivedDateTime,
        importance: email.importance || 'normal',
        categories: email.categories || []
      }
    };
  }

  return result;
}

/**
 * Send email
 */
export async function sendEmail(draft) {
  const message = {
    subject: draft.subject,
    body: {
      contentType: draft.isHtml ? 'HTML' : 'Text',
      content: draft.body
    },
    toRecipients: draft.to.map(addr => ({
      emailAddress: { address: addr }
    }))
  };

  if (draft.cc && draft.cc.length > 0) {
    message.ccRecipients = draft.cc.map(addr => ({
      emailAddress: { address: addr }
    }));
  }

  const result = await graphRequest('/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({ message, saveToSentItems: true })
  });

  return result.success ? { success: true } : result;
}

/**
 * Mark email as read/unread
 */
export async function markEmailRead(id, isRead) {
  const result = await graphRequest(`/me/messages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isRead })
  });

  return result.success ? { success: true } : result;
}

/**
 * Get unread email count
 */
export async function getUnreadCount() {
  const result = await graphRequest('/me/mailFolders/inbox?$select=unreadItemCount');

  if (result.success) {
    return { success: true, count: result.data.unreadItemCount || 0 };
  }

  return { success: false, count: 0 };
}

/**
 * Get calendar events
 */
export async function getCalendarEvents(startDateTime, endDateTime) {
  const start = new Date(startDateTime).toISOString();
  const end = new Date(endDateTime).toISOString();

  const result = await graphRequest(
    `/me/calendarView?startDateTime=${start}&endDateTime=${end}&$orderby=start/dateTime&$select=id,subject,start,end,location,attendees,isAllDay,showAs,body`
  );

  if (result.success) {
    return {
      success: true,
      events: result.data.value.map(event => ({
        id: event.id,
        subject: event.subject,
        start: event.start?.dateTime,
        end: event.end?.dateTime,
        location: event.location?.displayName || '',
        attendees: (event.attendees || []).map(a => ({
          name: a.emailAddress?.name || '',
          address: a.emailAddress?.address || ''
        })),
        isAllDay: event.isAllDay,
        status: event.showAs || 'busy',
        body: event.body?.content || ''
      }))
    };
  }

  return result;
}

/**
 * Create calendar event
 */
export async function createCalendarEvent(event) {
  const graphEvent = {
    subject: event.subject,
    start: {
      dateTime: new Date(event.start).toISOString(),
      timeZone: 'Europe/Zurich'
    },
    end: {
      dateTime: new Date(event.end).toISOString(),
      timeZone: 'Europe/Zurich'
    },
    isAllDay: event.isAllDay || false
  };

  if (event.location) {
    graphEvent.location = { displayName: event.location };
  }

  if (event.attendees && event.attendees.length > 0) {
    graphEvent.attendees = event.attendees.map(a => ({
      emailAddress: { address: a.address, name: a.name || '' },
      type: 'required'
    }));
  }

  if (event.body) {
    graphEvent.body = { contentType: 'HTML', content: event.body };
  }

  const result = await graphRequest('/me/events', {
    method: 'POST',
    body: JSON.stringify(graphEvent)
  });

  if (result.success) {
    return { success: true, eventId: result.data.id };
  }

  return result;
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(eventId) {
  const result = await graphRequest(`/me/events/${eventId}`, {
    method: 'DELETE'
  });

  return result.success ? { success: true } : result;
}

/**
 * Check if authenticated
 */
export function isAuthenticated() {
  return !!tokenCache.accessToken;
}

/**
 * Logout
 */
export function logout() {
  tokenCache = {};
  msalClient = null;
}

/**
 * Set tokens directly (for stored credentials)
 */
export function setTokens(tokens) {
  tokenCache = {
    accessToken: tokens.accessToken,
    expiresOn: tokens.expiresOn ? new Date(tokens.expiresOn) : null,
    account: tokens.account
  };
}

/**
 * Get current tokens (for storage)
 */
export function getTokens() {
  return {
    accessToken: tokenCache.accessToken,
    expiresOn: tokenCache.expiresOn?.toISOString(),
    account: tokenCache.account
  };
}
