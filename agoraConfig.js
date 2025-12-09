// Agora RTC Configuration - Production Mode
// Get your App ID from: https://console.agora.io

export const AGORA_CONFIG = {
  // App ID from Agora Console - Social-Vibing-production Project
  appId: '6158a2b02c6a422aa3646ee2c116efb8',
  
  // Production Token Server URL - ENABLED FOR PRODUCTION MODE
  // Local development server (change to your deployed URL for production)
  tokenServerUrl: 'http://10.196.231.201:3000/api/agora/token',
  
  // For Firebase Cloud Functions deployment, use:
  // tokenServerUrl: 'https://your-project.cloudfunctions.net/generateAgoraToken',
  
  // Channel configuration
  channelProfile: 0, // 0 = Communication (for calls)
  
  // Audio profile for high quality voice
  audioProfile: 5, // Music standard (48kHz, full band, stereo)
  audioScenario: 1, // Default scenario
  
  // Token expiration time (24 hours in seconds)
  tokenExpirationTime: 86400,
};

/**
 * Generate unique channel name from communityId and roomId
 */
export function generateChannelName(communityId, roomId) {
  return `${communityId}_${roomId}`;
}

/**
 * Generate Agora RTC Token
 * 
 * If tokenServerUrl is null, returns null (no token mode - requires App Certificate disabled in Agora Console)
 * If tokenServerUrl is set, fetches token from backend server
 * 
 * @param {string} channelName - Unique channel identifier
 * @param {number} uid - User ID (0 for auto-assign)
 * @param {number} role - User role (1=publisher, 2=subscriber)
 * @returns {Promise<string|null>} Token or null if not needed/failed
 */
export async function generateAgoraToken(channelName, uid = 0, role = 1) {
  try {
    // If no token server URL, work without token
    if (!AGORA_CONFIG.tokenServerUrl) {
      console.log('[Agora] ⚠️ No token server configured - working without token');
      console.log('[Agora] ⚠️ Make sure App Certificate is DISABLED in Agora Console');
      return null;
    }

    console.log('[Agora] Requesting token from server:', AGORA_CONFIG.tokenServerUrl);
    
    const response = await fetch(AGORA_CONFIG.tokenServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channelName,
        uid,
        role
      }),
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.error('[Agora] Server responded with error:', response.status);
      const errorText = await response.text();
      console.error('[Agora] Error details:', errorText);
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.token) {
      console.log('[Agora] Token received successfully');
      console.log('[Agora] Token expires at:', new Date(data.expiresAt * 1000).toLocaleString());
      return data.token;
    } else {
      console.error('[Agora] Invalid response from server:', data.error || 'Unknown error');
      return null;
    }
    
  } catch (error) {
    console.error('[Agora] Error fetching token from server:', error.message);
    console.error('[Agora] Make sure token server is running and accessible');
    console.error('[Agora] Server URL:', AGORA_CONFIG.tokenServerUrl);
    return null;
  }
}

/**
 * Renew an expiring token
 * Call this when you receive a token-privilege-will-expire callback
 */
export async function renewAgoraToken(channelName, uid = 0) {
  try {
    const renewUrl = AGORA_CONFIG.tokenServerUrl.replace('/token', '/token/renew');
    
    const response = await fetch(renewUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channelName,
        uid
      }),
      signal: AbortSignal.timeout(10000)
    });

    const data = await response.json();
    
    if (data.success && data.token) {
      console.log('[Agora] Token renewed successfully');
      return data.token;
    } else {
      console.error('[Agora] Failed to renew token');
      return null;
    }
    
  } catch (error) {
    console.error('[Agora] Error renewing token:', error);
    return null;
  }
}

