/**
 * Google Calendar & Meet API Integration
 * Handles calendar events and Google Meet meetings
 */

import fetch from 'node-fetch';

// In-memory token storage
let tokenCache = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

let googleConfig = {
  clientId: '',
  clientSecret: '',
  redirectUri: 'http://localhost:3001/api/google/callback'
};

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Set Google OAuth config
 */
export function setConfig(config) {
  googleConfig = {
    ...googleConfig,
    clientId: config.clientId || googleConfig.clientId,
    clientSecret: config.clientSecret || googleConfig.clientSecret,
    redirectUri: config.redirectUri || googleConfig.redirectUri
  };
}

/**
 * Get authorization URL for OAuth2 flow
 */
export function getAuthUrl(state = 'google-auth') {
  if (!googleConfig.clientId) {
    return null;
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const params = new URLSearchParams({
    client_id: googleConfig.clientId,
    redirect_uri: googleConfig.redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleConfig.clientId,
        client_secret: googleConfig.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: googleConfig.redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Token exchange failed: ${error}` };
    }

    const data = await response.json();

    tokenCache = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokenCache.refreshToken,
      expiresAt: Date.now() + (data.expires_in * 1000)
    };

    // Get user info
    const userInfo = await getUserInfo();

    return {
      success: true,
      user: userInfo.success ? userInfo.user : { name: 'User', email: '' }
    };
  } catch (error) {
    console.error('Google token exchange error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken() {
  if (!tokenCache.refreshToken) {
    return false;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleConfig.clientId,
        client_secret: googleConfig.clientSecret,
        refresh_token: tokenCache.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();

    tokenCache.accessToken = data.access_token;
    tokenCache.expiresAt = Date.now() + (data.expires_in * 1000);

    return true;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}

/**
 * Get valid access token
 */
async function getAccessToken() {
  if (!tokenCache.accessToken) {
    return null;
  }

  // Check if token is expired or about to expire (5 min buffer)
  if (tokenCache.expiresAt && Date.now() >= tokenCache.expiresAt - 300000) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return null;
    }
  }

  return tokenCache.accessToken;
}

/**
 * Make authenticated request to Google API
 */
async function googleRequest(url, options = {}) {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Google API error: ${response.status} - ${error}` };
    }

    // Some endpoints return no content
    if (response.status === 204) {
      return { success: true, data: null };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get user info
 */
export async function getUserInfo() {
  const result = await googleRequest('https://www.googleapis.com/oauth2/v2/userinfo');

  if (result.success) {
    return {
      success: true,
      user: {
        name: result.data.name || '',
        email: result.data.email || '',
        picture: result.data.picture || ''
      }
    };
  }

  return result;
}

/**
 * Get calendar events
 */
export async function getCalendarEvents(startDateTime, endDateTime, calendarId = 'primary') {
  const params = new URLSearchParams({
    timeMin: new Date(startDateTime).toISOString(),
    timeMax: new Date(endDateTime).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100'
  });

  const result = await googleRequest(
    `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`
  );

  if (result.success) {
    return {
      success: true,
      events: (result.data.items || []).map(event => ({
        id: event.id,
        subject: event.summary || '',
        description: event.description || '',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location || '',
        attendees: (event.attendees || []).map(a => ({
          name: a.displayName || '',
          email: a.email || '',
          responseStatus: a.responseStatus
        })),
        isAllDay: !!event.start?.date,
        hangoutLink: event.hangoutLink || null,
        conferenceData: event.conferenceData || null,
        status: event.status || 'confirmed'
      }))
    };
  }

  return result;
}

/**
 * Create calendar event with optional Google Meet
 */
export async function createCalendarEvent(event, addMeet = false) {
  const googleEvent = {
    summary: event.subject,
    description: event.description || '',
    start: event.isAllDay
      ? { date: event.start.split('T')[0] }
      : { dateTime: new Date(event.start).toISOString(), timeZone: 'Europe/Zurich' },
    end: event.isAllDay
      ? { date: event.end.split('T')[0] }
      : { dateTime: new Date(event.end).toISOString(), timeZone: 'Europe/Zurich' }
  };

  if (event.location) {
    googleEvent.location = event.location;
  }

  if (event.attendees && event.attendees.length > 0) {
    googleEvent.attendees = event.attendees.map(a => ({
      email: a.email || a.address || a
    }));
  }

  // Add Google Meet conference
  if (addMeet) {
    googleEvent.conferenceData = {
      createRequest: {
        requestId: `meet_${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    };
  }

  const url = addMeet
    ? `${GOOGLE_API_BASE}/calendars/primary/events?conferenceDataVersion=1`
    : `${GOOGLE_API_BASE}/calendars/primary/events`;

  const result = await googleRequest(url, {
    method: 'POST',
    body: JSON.stringify(googleEvent)
  });

  if (result.success) {
    return {
      success: true,
      eventId: result.data.id,
      htmlLink: result.data.htmlLink,
      meetLink: result.data.hangoutLink || result.data.conferenceData?.entryPoints?.[0]?.uri || null
    };
  }

  return result;
}

/**
 * Create Google Meet meeting (quick meeting)
 */
export async function createMeetMeeting(subject, startDateTime, endDateTime, attendees = []) {
  // Create a calendar event with Meet enabled
  const event = {
    subject: subject || 'Google Meet',
    start: startDateTime || new Date().toISOString(),
    end: endDateTime || new Date(Date.now() + 3600000).toISOString(),
    attendees: attendees
  };

  return await createCalendarEvent(event, true);
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(eventId, calendarId = 'primary') {
  const result = await googleRequest(
    `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: 'DELETE' }
  );

  return result.success ? { success: true } : result;
}

/**
 * Get list of calendars
 */
export async function getCalendarList() {
  const result = await googleRequest(`${GOOGLE_API_BASE}/users/me/calendarList`);

  if (result.success) {
    return {
      success: true,
      calendars: (result.data.items || []).map(cal => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description || '',
        primary: cal.primary || false,
        backgroundColor: cal.backgroundColor
      }))
    };
  }

  return result;
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
  tokenCache = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null
  };
}

/**
 * Set tokens directly (for stored credentials)
 */
export function setTokens(tokens) {
  tokenCache = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt).getTime() : null
  };
}

/**
 * Get current tokens (for storage)
 */
export function getTokens() {
  return {
    accessToken: tokenCache.accessToken,
    refreshToken: tokenCache.refreshToken,
    expiresAt: tokenCache.expiresAt
  };
}
