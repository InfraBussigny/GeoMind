/**
 * 3CX Phone System API Integration
 * Handles calls, extension status, and call history
 */

import fetch from 'node-fetch';

// In-memory state
let connectionState = {
  isConnected: false,
  config: null,
  sessionToken: null,
  extension: null
};

/**
 * Connect to 3CX system
 */
export async function connect(config) {
  try {
    const { serverUrl, extension, username, password } = config;

    // 3CX API v18+ uses REST API
    // First, authenticate to get session token
    const authResponse = await fetch(`${serverUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Username: username,
        Password: password
      })
    });

    if (!authResponse.ok) {
      // Try alternative auth endpoint for older 3CX versions
      const altAuthResponse = await fetch(`${serverUrl}/webclient/api/Login/GetAccessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Username: username,
          Password: password
        })
      });

      if (!altAuthResponse.ok) {
        return { success: false, error: 'Authentication failed. Check credentials and server URL.' };
      }

      const altData = await altAuthResponse.json();
      connectionState.sessionToken = altData.Token || altData.access_token;
    } else {
      const data = await authResponse.json();
      connectionState.sessionToken = data.Token || data.access_token;
    }

    connectionState.config = config;
    connectionState.isConnected = true;
    connectionState.extension = {
      id: extension,
      number: extension,
      name: username,
      status: 'available'
    };

    return {
      success: true,
      extension: connectionState.extension
    };
  } catch (error) {
    console.error('3CX connection error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Disconnect from 3CX
 */
export function disconnect() {
  connectionState = {
    isConnected: false,
    config: null,
    sessionToken: null,
    extension: null
  };
  return { success: true };
}

/**
 * Make authenticated request to 3CX API
 */
async function apiRequest(endpoint, options = {}) {
  if (!connectionState.isConnected || !connectionState.sessionToken) {
    return { success: false, error: 'Not connected to 3CX' };
  }

  const { serverUrl } = connectionState.config;

  try {
    const response = await fetch(`${serverUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${connectionState.sessionToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `3CX API error: ${response.status} - ${error}` };
    }

    // Some endpoints return no content
    const text = await response.text();
    if (!text) {
      return { success: true, data: null };
    }

    return { success: true, data: JSON.parse(text) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Make a call
 */
export async function makeCall(number) {
  if (!connectionState.isConnected) {
    return { success: false, error: 'Not connected to 3CX' };
  }

  const { extension } = connectionState.config;

  // Try different API endpoints for different 3CX versions
  let result = await apiRequest('/api/CallUs/MakeCall', {
    method: 'POST',
    body: JSON.stringify({
      party: extension,
      number: number
    })
  });

  if (!result.success) {
    // Try alternative endpoint
    result = await apiRequest('/webclient/api/Call/MakeCall', {
      method: 'POST',
      body: JSON.stringify({
        Destination: number,
        FromExtension: extension
      })
    });
  }

  if (result.success) {
    return {
      success: true,
      callId: result.data?.CallId || result.data?.callId || `call_${Date.now()}`
    };
  }

  return result;
}

/**
 * End a call
 */
export async function endCall(callId) {
  let result = await apiRequest(`/api/Calls/${callId}/Drop`, {
    method: 'POST'
  });

  if (!result.success) {
    result = await apiRequest('/webclient/api/Call/Drop', {
      method: 'POST',
      body: JSON.stringify({ CallId: callId })
    });
  }

  return result.success ? { success: true } : result;
}

/**
 * Hold/Resume a call
 */
export async function holdCall(callId, hold) {
  const endpoint = hold ? 'Hold' : 'Retrieve';

  let result = await apiRequest(`/api/Calls/${callId}/${endpoint}`, {
    method: 'POST'
  });

  if (!result.success) {
    result = await apiRequest(`/webclient/api/Call/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify({ CallId: callId })
    });
  }

  return result.success ? { success: true } : result;
}

/**
 * Transfer a call
 */
export async function transferCall(callId, targetNumber) {
  let result = await apiRequest(`/api/Calls/${callId}/Transfer`, {
    method: 'POST',
    body: JSON.stringify({ destination: targetNumber })
  });

  if (!result.success) {
    result = await apiRequest('/webclient/api/Call/Transfer', {
      method: 'POST',
      body: JSON.stringify({
        CallId: callId,
        Destination: targetNumber
      })
    });
  }

  return result.success ? { success: true } : result;
}

/**
 * Get call history
 */
export async function getCallHistory(limit = 50) {
  let result = await apiRequest(`/api/CallLogs?top=${limit}&orderby=StartTime desc`);

  if (!result.success) {
    result = await apiRequest(`/webclient/api/CallHistory?count=${limit}`);
  }

  if (result.success && result.data) {
    const calls = Array.isArray(result.data) ? result.data : (result.data.value || result.data.Items || []);

    return {
      success: true,
      calls: calls.map(call => ({
        id: call.Id || call.id || `log_${Date.now()}`,
        type: determineCallType(call),
        number: call.Number || call.CallerNumber || call.CalleeNumber || '',
        name: call.Name || call.CallerName || call.CalleeName || '',
        duration: call.Duration || call.TalkingDuration || 0,
        timestamp: call.StartTime || call.Time || new Date().toISOString(),
        recordingUrl: call.RecordingUrl || null
      }))
    };
  }

  // Return empty array if API fails
  return {
    success: true,
    calls: []
  };
}

/**
 * Determine call type from call record
 */
function determineCallType(call) {
  if (call.Type) return call.Type.toLowerCase();
  if (call.IsMissed || call.MissedCall) return 'missed';
  if (call.Direction === 'Inbound' || call.IsIncoming) return 'inbound';
  return 'outbound';
}

/**
 * Set extension status
 */
export async function setExtensionStatus(status) {
  const statusMap = {
    'available': 'Available',
    'busy': 'Busy',
    'away': 'Away',
    'dnd': 'DoNotDisturb',
    'offline': 'Offline'
  };

  let result = await apiRequest('/api/MyStatus', {
    method: 'POST',
    body: JSON.stringify({ status: statusMap[status] || status })
  });

  if (!result.success) {
    result = await apiRequest('/webclient/api/Status/SetStatus', {
      method: 'POST',
      body: JSON.stringify({ Status: statusMap[status] || status })
    });
  }

  if (result.success && connectionState.extension) {
    connectionState.extension.status = status;
  }

  return result.success ? { success: true } : result;
}

/**
 * Get missed calls count
 */
export async function getMissedCallsCount() {
  const result = await getCallHistory(100);

  if (result.success) {
    const missedCalls = result.calls.filter(c => c.type === 'missed');
    return { success: true, count: missedCalls.length };
  }

  return { success: false, count: 0 };
}

/**
 * Get active calls
 */
export async function getActiveCalls() {
  let result = await apiRequest('/api/Calls/Active');

  if (!result.success) {
    result = await apiRequest('/webclient/api/Call/GetActiveCalls');
  }

  if (result.success && result.data) {
    const calls = Array.isArray(result.data) ? result.data : (result.data.value || []);

    return {
      success: true,
      calls: calls.map(call => ({
        id: call.Id || call.id,
        direction: call.Direction?.toLowerCase() || 'outbound',
        number: call.Number || call.OtherPartyNumber || '',
        name: call.Name || call.OtherPartyName || '',
        status: call.Status?.toLowerCase() || 'connected',
        startTime: call.StartTime || new Date().toISOString()
      }))
    };
  }

  return { success: true, calls: [] };
}

/**
 * Check connection status
 */
export function isConnected() {
  return connectionState.isConnected;
}

/**
 * Get current extension info
 */
export function getExtension() {
  return connectionState.extension;
}

/**
 * Get connection config (for storage)
 */
export function getConfig() {
  if (!connectionState.config) return null;
  // Don't expose password
  return {
    serverUrl: connectionState.config.serverUrl,
    extension: connectionState.config.extension,
    username: connectionState.config.username
  };
}
