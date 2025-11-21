// Agora RTC Configuration
// Get your FREE App ID from: https://console.agora.io

export const AGORA_CONFIG = {
  // TODO: Replace with your Agora App ID from console.agora.io
  // 1. Sign up at https://console.agora.io
  // 2. Create a new project
  // 3. Copy the App ID and paste below
  appId: 'da4929427d76478caa10691c99fab9d7', // Replace this!
  
  // For production, implement token authentication
  // For testing, you can use null (less secure)
  token: null,
  
  // Channel configuration
  channelProfile: 0, // 0 = Communication (for calls)
  
  // Audio profile for high quality voice
  audioProfile: 5, // Music standard (48kHz, full band, stereo)
  audioScenario: 1, // Default scenario
};

/**
 * Generate channel name from communityId and roomId
 */
export function generateChannelName(communityId, roomId) {
  return `audio_${communityId}_${roomId}`;
}
