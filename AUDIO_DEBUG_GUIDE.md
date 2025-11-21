# Audio Call Debugging Guide

## Comprehensive Fixes Applied

### 1. Fixed Audio Snapshot Listener
- **Problem**: Used `forEach` with `async` which doesn't wait for async operations
- **Fix**: Removed `async` from forEach and made operations synchronous
- **Added**: Detailed logging at each step

### 2. Enhanced Playback Function
- **Problem**: Redundant `sound.playAsync()` call after `shouldPlay: true`
- **Fix**: Removed the redundant call
- **Added**: Comprehensive error logging with success/failure indicators

### 3. Improved Upload Function
- **Added**: Logging at each upload stage to track the flow

### 4. Better Timestamp Handling
- **Problem**: Timestamp comparison could fail with different formats
- **Fix**: Added proper error handling and extended time window to 5 seconds

## Debugging with Logs

### When Testing, Look for These Log Patterns:

#### **Person A is Speaking:**
```
[Upload] Capturing audio chunk...
[Upload] Audio chunk captured, uploading to Cloudinary...
[Upload] ✓ Audio uploaded: https://res.cloudinary.com/...
[Upload] ✓ Audio chunk saved to Firestore
[Upload] Recording restarted for next chunk
```

#### **Person B Should See:**
```
[Audio] Received 1 audio chunk(s)
[Audio] Processing chunk from <userId>: {isSpeaking: true, hasAudioUrl: true, isCurrentUser: false}
[Audio] Chunk age: 234ms, isRecent: true
[Audio] IsNew: true, IsRecent: true, URL: https://res.cloudinary.com/...
[Audio] ✓ Playing audio from <userName>
[Audio] Starting playback for <userId>: https://res.cloudinary.com/...
[Audio] Setting audio mode for playback
[Audio] Creating sound object
[Audio] ✓ Sound created and playing for <userId>
[Audio] Playback finished for <userId>
```

## Common Issues & Solutions

### If you see "[Audio] Received 0 audio chunk(s)":
- **Problem**: Firestore rules not updated OR audio not being uploaded
- **Check**: Firebase console → Firestore → audio_calls collection
- **Solution**: Update Firebase rules as per FIREBASE_SETUP_REQUIRED.md

### If you see upload logs but Person B sees nothing:
- **Problem**: Firestore listener not working
- **Check**: Firebase rules for read permissions on audio_calls
- **Solution**: Ensure authenticated users can read audio_calls collection

### If you see "IsNew: false":
- **Problem**: Audio chunk already played
- **This is normal** - each chunk plays only once

### If you see "IsRecent: false":
- **Problem**: Chunk is older than 5 seconds
- **Possible cause**: Network delay or clock sync issues
- **Solution**: This is normal for old chunks, just wait for new ones

### If you see playback errors:
- **Check**: The audio URL is valid (visit it in browser)
- **Check**: Phone/emulator volume is up
- **Check**: Silent mode is OFF

## Testing Checklist

1. ✅ Firebase rules updated
2. ✅ Both devices on same WiFi (good connection)
3. ✅ Microphone permissions granted on both devices
4. ✅ Volume turned up on receiving device
5. ✅ Silent mode OFF
6. ✅ App reloaded after code changes (press 'r' in terminal)

## Next Steps

1. **Reload the app** (press 'r' in Expo terminal)
2. **Start a call** between two devices/emulators
3. **Watch the logs** in the Expo terminal
4. **Share the logs** with me if issues persist

The logs will now clearly show:
- When audio is being captured ("[Upload]" prefix)
- When audio is being received ("[Audio]" prefix)  
- When audio is playing (✓ success) or failing (✗ error)
- Detailed error messages if something goes wrong
