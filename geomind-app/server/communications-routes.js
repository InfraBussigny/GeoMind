/**
 * Communications API Routes
 * Microsoft Graph (Outlook, Calendar, Teams) + 3CX Phone + Google Calendar/Meet
 */

import * as msgraph from './microsoft-graph.js';
import * as threecx from './threecx-api.js';
import * as gcal from './google-calendar.js';

// Microsoft 365 OAuth config (stored in memory, should be persisted)
let msConfig = {
  clientId: '',
  clientSecret: '',
  tenantId: 'common',
  redirectUri: 'http://localhost:3001/api/outlook/callback',
  scopes: [
    'User.Read',
    'Mail.Read',
    'Mail.Send',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'OnlineMeetings.ReadWrite'  // For Teams meetings
  ]
};

export function setupCommunicationsRoutes(app) {

  // ============================================
  // MICROSOFT OUTLOOK / CALENDAR / TEAMS
  // ============================================

  // Get Microsoft auth status
  app.get('/api/outlook/status', (req, res) => {
    res.json({
      authenticated: msgraph.isAuthenticated(),
      needsConfig: !msConfig.clientId
    });
  });

  // Set Microsoft OAuth config
  app.post('/api/outlook/config', async (req, res) => {
    const { clientId, clientSecret, tenantId } = req.body;

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'Client ID required' });
    }

    msConfig = {
      ...msConfig,
      clientId,
      clientSecret: clientSecret || '',
      tenantId: tenantId || 'common'
    };

    res.json({ success: true });
  });

  // Get Microsoft OAuth URL
  app.get('/api/outlook/auth-url', (req, res) => {
    if (!msConfig.clientId) {
      return res.status(400).json({
        success: false,
        error: 'Microsoft OAuth not configured. Set Client ID first.'
      });
    }

    const authUrl = msgraph.getAuthUrl(msConfig, 'geomind-auth');
    res.json({ success: true, authUrl });
  });

  // OAuth callback
  app.get('/api/outlook/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
      return res.redirect('/?error=' + encodeURIComponent(error));
    }

    if (!code) {
      return res.redirect('/?error=no_code');
    }

    try {
      const result = await msgraph.exchangeCodeForTokens(msConfig, code);

      if (result.success) {
        // Redirect to app with success
        res.redirect('/?outlook=connected');
      } else {
        res.redirect('/?error=' + encodeURIComponent(result.error));
      }
    } catch (err) {
      res.redirect('/?error=' + encodeURIComponent(err.message));
    }
  });

  // Logout
  app.post('/api/outlook/logout', (req, res) => {
    msgraph.logout();
    res.json({ success: true });
  });

  // Get user profile
  app.get('/api/outlook/profile', async (req, res) => {
    const result = await msgraph.getProfile();
    res.json(result);
  });

  // Get emails
  app.get('/api/outlook/emails', async (req, res) => {
    const { folder = 'inbox', top = 50, skip = 0 } = req.query;
    const result = await msgraph.getEmails(folder, parseInt(top), parseInt(skip));
    res.json(result);
  });

  // Get single email
  app.get('/api/outlook/emails/:id', async (req, res) => {
    const result = await msgraph.getEmail(req.params.id);
    res.json(result);
  });

  // Send email
  app.post('/api/outlook/send', async (req, res) => {
    const result = await msgraph.sendEmail(req.body);
    res.json(result);
  });

  // Mark email read/unread
  app.patch('/api/outlook/emails/:id/read', async (req, res) => {
    const { isRead } = req.body;
    const result = await msgraph.markEmailRead(req.params.id, isRead);
    res.json(result);
  });

  // Get unread count
  app.get('/api/outlook/unread-count', async (req, res) => {
    const result = await msgraph.getUnreadCount();
    res.json(result);
  });

  // ============================================
  // CALENDAR (via Microsoft Graph)
  // ============================================

  // Get calendar events
  app.get('/api/calendar/events', async (req, res) => {
    const { start, end } = req.query;

    if (!start || !end) {
      // Default to current week
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const result = await msgraph.getCalendarEvents(weekStart.toISOString(), weekEnd.toISOString());
      return res.json(result);
    }

    const result = await msgraph.getCalendarEvents(start, end);
    res.json(result);
  });

  // Create calendar event
  app.post('/api/calendar/events', async (req, res) => {
    const result = await msgraph.createCalendarEvent(req.body);
    res.json(result);
  });

  // Delete calendar event
  app.delete('/api/calendar/events/:id', async (req, res) => {
    const result = await msgraph.deleteCalendarEvent(req.params.id);
    res.json(result);
  });

  // ============================================
  // TEAMS MEETINGS (via Microsoft Graph)
  // ============================================

  // Create Teams meeting
  app.post('/api/teams/meeting', async (req, res) => {
    const { subject, startDateTime, endDateTime, attendees } = req.body;

    // Create a calendar event with online meeting
    const event = {
      subject: subject || 'Teams Meeting',
      start: startDateTime || new Date().toISOString(),
      end: endDateTime || new Date(Date.now() + 3600000).toISOString(),
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      attendees: attendees || []
    };

    // Use Graph API to create online meeting
    const result = await msgraph.graphRequest('/me/events', {
      method: 'POST',
      body: JSON.stringify({
        subject: event.subject,
        start: { dateTime: event.start, timeZone: 'Europe/Zurich' },
        end: { dateTime: event.end, timeZone: 'Europe/Zurich' },
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
        attendees: (event.attendees || []).map(a => ({
          emailAddress: { address: a.address || a, name: a.name || '' },
          type: 'required'
        }))
      })
    });

    if (result.success) {
      res.json({
        success: true,
        eventId: result.data.id,
        joinUrl: result.data.onlineMeeting?.joinUrl || result.data.webLink,
        subject: result.data.subject
      });
    } else {
      res.json(result);
    }
  });

  // ============================================
  // 3CX PHONE SYSTEM
  // ============================================

  // Get 3CX status
  app.get('/api/3cx/status', (req, res) => {
    res.json({
      connected: threecx.isConnected(),
      extension: threecx.getExtension()
    });
  });

  // Connect to 3CX
  app.post('/api/3cx/connect', async (req, res) => {
    const { serverUrl, extension, username, password } = req.body;

    if (!serverUrl || !extension || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: serverUrl, extension, username, password'
      });
    }

    const result = await threecx.connect({
      serverUrl,
      extension,
      username,
      password
    });

    res.json(result);
  });

  // Disconnect from 3CX
  app.post('/api/3cx/disconnect', (req, res) => {
    const result = threecx.disconnect();
    res.json(result);
  });

  // Make call
  app.post('/api/3cx/call', async (req, res) => {
    const { number } = req.body;

    if (!number) {
      return res.status(400).json({ success: false, error: 'Phone number required' });
    }

    const result = await threecx.makeCall(number);
    res.json(result);
  });

  // End call
  app.post('/api/3cx/call/:callId/end', async (req, res) => {
    const result = await threecx.endCall(req.params.callId);
    res.json(result);
  });

  // Hold/Resume call
  app.post('/api/3cx/call/:callId/hold', async (req, res) => {
    const { hold } = req.body;
    const result = await threecx.holdCall(req.params.callId, hold !== false);
    res.json(result);
  });

  // Transfer call
  app.post('/api/3cx/call/:callId/transfer', async (req, res) => {
    const { targetNumber } = req.body;

    if (!targetNumber) {
      return res.status(400).json({ success: false, error: 'Target number required' });
    }

    const result = await threecx.transferCall(req.params.callId, targetNumber);
    res.json(result);
  });

  // Get call history
  app.get('/api/3cx/history', async (req, res) => {
    const { limit = 50 } = req.query;
    const result = await threecx.getCallHistory(parseInt(limit));
    res.json(result);
  });

  // Get active calls
  app.get('/api/3cx/active', async (req, res) => {
    const result = await threecx.getActiveCalls();
    res.json(result);
  });

  // Set extension status
  app.post('/api/3cx/status', async (req, res) => {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status required' });
    }

    const result = await threecx.setExtensionStatus(status);
    res.json(result);
  });

  // Get missed calls count
  app.get('/api/3cx/missed-count', async (req, res) => {
    const result = await threecx.getMissedCallsCount();
    res.json(result);
  });

  // ============================================
  // GOOGLE CALENDAR / MEET
  // ============================================

  // Get Google auth status
  app.get('/api/google/status', (req, res) => {
    res.json({
      authenticated: gcal.isAuthenticated()
    });
  });

  // Set Google OAuth config
  app.post('/api/google/config', (req, res) => {
    const { clientId, clientSecret } = req.body;

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'Client ID required' });
    }

    gcal.setConfig({ clientId, clientSecret });
    res.json({ success: true });
  });

  // Get Google OAuth URL
  app.get('/api/google/auth-url', (req, res) => {
    const authUrl = gcal.getAuthUrl('geomind-google-auth');

    if (!authUrl) {
      return res.status(400).json({
        success: false,
        error: 'Google OAuth not configured. Set Client ID first.'
      });
    }

    res.json({ success: true, authUrl });
  });

  // Google OAuth callback
  app.get('/api/google/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
      return res.redirect('/?error=' + encodeURIComponent(error));
    }

    if (!code) {
      return res.redirect('/?error=no_code');
    }

    try {
      const result = await gcal.exchangeCodeForTokens(code);

      if (result.success) {
        res.redirect('/?google=connected');
      } else {
        res.redirect('/?error=' + encodeURIComponent(result.error));
      }
    } catch (err) {
      res.redirect('/?error=' + encodeURIComponent(err.message));
    }
  });

  // Google logout
  app.post('/api/google/logout', (req, res) => {
    gcal.logout();
    res.json({ success: true });
  });

  // Get Google user profile
  app.get('/api/google/profile', async (req, res) => {
    const result = await gcal.getUserInfo();
    res.json(result);
  });

  // Get Google Calendar events
  app.get('/api/google/calendar/events', async (req, res) => {
    const { start, end, calendarId = 'primary' } = req.query;

    if (!start || !end) {
      // Default to current week
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const result = await gcal.getCalendarEvents(weekStart.toISOString(), weekEnd.toISOString(), calendarId);
      return res.json(result);
    }

    const result = await gcal.getCalendarEvents(start, end, calendarId);
    res.json(result);
  });

  // Create Google Calendar event
  app.post('/api/google/calendar/events', async (req, res) => {
    const { addMeet = false, ...event } = req.body;
    const result = await gcal.createCalendarEvent(event, addMeet);
    res.json(result);
  });

  // Delete Google Calendar event
  app.delete('/api/google/calendar/events/:id', async (req, res) => {
    const result = await gcal.deleteCalendarEvent(req.params.id);
    res.json(result);
  });

  // Get list of calendars
  app.get('/api/google/calendars', async (req, res) => {
    const result = await gcal.getCalendarList();
    res.json(result);
  });

  // Create Google Meet meeting
  app.post('/api/google/meet', async (req, res) => {
    const { subject, startDateTime, endDateTime, attendees } = req.body;
    const result = await gcal.createMeetMeeting(subject, startDateTime, endDateTime, attendees);
    res.json(result);
  });

  console.log('[Communications] Routes registered: Outlook, Calendar, Teams, 3CX, Google Calendar, Google Meet');
}
