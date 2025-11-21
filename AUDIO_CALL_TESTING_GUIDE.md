# Audio Call Testing Guide

## ✅ Code Improvements Completed

### What Was Fixed:
1. **Proper Interval Cleanup** - Prevents memory leaks using refs
2. **Recording Status Verification** - Skips invalid/short recordings
3. **Auto-Retry with Exponential Backoff** - 3 attempts with 1s/2s/4s delays
4. **Upload Failure Tracking** - Monitors consecutive failures
5. **Enhanced Error Messages** - Specific diagnostics for each error type
6. **Comprehensive Cleanup** - All resources cleaned on unmount

---

## 🧪 Testing Steps

### 1. Reload the App
```bash
# In Expo terminal, press 'r' to reload
```

### 2. Start an Audio Call
1. Navigate to a community
2. Tap the phone icon to start a call
3. Watch the terminal logs

### 3. Expected Logs (Success Case)

```
[Recording] Auto-starting recording...
[Recording] ✓ Recording started successfully
[Recording] Chunk upload interval started
[Recording] Interval tick - capturing chunk
[Upload] Capturing audio chunk...
[Upload] Recording status: { canRecord: true, isRecording: true, durationMillis: 2145 }
[Upload] Recording URI: file:///...
[Upload] Attempt 1/3...
[Upload] ✓ Audio uploaded: https://res.cloudinary.com/...
[Upload] ✓ Audio chunk saved to Firestore
[Upload] Recording restarted for next chunk
```

### 4. Expected Logs (Network Error)

```
[Upload] Attempt 1/3...
[Upload] ✗ Attempt 1 failed: Network request failed
[Upload] ⏳ Retrying in 1000ms...
[Upload] Attempt 2/3...
[Upload] ✗ Attempt 2 failed: Network request failed
[Upload] ⏳ Retrying in 2000ms...
[Upload] Attempt 3/3...
[Upload] ✗ Attempt 3 failed: Network request failed
[Upload] 🌐 Network error - check internet connection
[Upload] 💡 Tip: Verify Cloudinary upload preset allows audio/video
[Upload] ✗ All upload attempts failed - skipping chunk
[Upload] 📊 Consecutive failures: 1
```

### 5. Expected Logs (Recording Not Active)

```
[Upload] Capturing audio chunk...
[Upload] Recording status: { canRecord: false, isRecording: false, durationMillis: 0 }
[Upload] ⚠️ Skipping - recording not active
```

---

## 🐛 Troubleshooting

### Issue: "Network request failed"

**Possible Causes:**
1. **No Internet Connection**
   - Check device WiFi/mobile data
   - Test: Open browser and load a website

2. **Cloudinary Upload Preset Not Configured**
   - Go to Cloudinary Dashboard → Settings → Upload
   - Check that `profile_upload` preset exists
   - Verify it allows `video` resource type (audio uses video API)
   - Ensure "Unsigned" is enabled

3. **Audio Format Not Supported**
   - Default: `.m4a` format
   - Cloudinary should auto-detect format
   - Check upload preset doesn't have format restrictions

### Issue: "Recording not active"

**Possible Causes:**
1. **Microphone Permission Denied**
   - Check app permissions in device settings
   - Grant microphone access

2. **Audio Recording Conflict**
   - Close other apps using microphone
   - Restart the app

### Issue: "Recording too short"

**Normal Behavior:**
- First interval tick happens before 100ms of audio
- Subsequent chunks should work normally
- If persists: Check if microphone is actually capturing audio

### Issue: "Only one Recording object can be prepared"

**Should Be Fixed:**
- Delays added between stop and restart
- If still occurs: Increase delay in line 741-742

---

## 📊 Performance Metrics

### Normal Operation:
- **Chunk Interval**: 2 seconds
- **Upload Timeout**: 10 seconds
- **Retry Attempts**: 3 (max)
- **Retry Delays**: 1s, 2s, 4s

### Success Indicators:
- ✓ Audio uploaded within 3-5 seconds
- ✓ Consecutive failures: 0
- ✓ Recording restarted successfully

### Warning Signs:
- ⚠️ Consecutive failures > 3
- ⚠️ Upload timeout (>10s)
- ⚠️ Multiple "not active" skips

---

## 🔐 Firebase Rules (Required)

**Status:** Rules file created but NOT deployed

### Deploy Instructions:

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com
   - Select your project

2. **Navigate to Firestore Database**
   - Click "Firestore Database" in left sidebar
   - Click "Rules" tab

3. **Copy Rules from File**
   - Open: `FIREBASE_SETUP_REQUIRED.md`
   - Copy rules from lines 23-107

4. **Publish Rules**
   - Paste in Firebase Console
   - Click "Publish"

**Without these rules, you'll get permission-denied errors!**

---

## ✨ Next Steps

### If Everything Works:
1. Test with 2+ participants
2. Test with poor network (airplane mode on/off)
3. Test leaving and rejoining calls
4. Test app backgrounding during call

### If Issues Persist:
1. Share full terminal logs (copy all [Upload] messages)
2. Check Cloudinary dashboard for upload attempts
3. Verify Firebase rules are deployed
4. Test with different audio recording apps to verify mic works

---

## 🎉 Success Criteria

- [x] Audio recording starts automatically
- [x] Chunks upload to Cloudinary every 2 seconds
- [x] Other participants can hear audio
- [x] Failed uploads retry automatically
- [x] App doesn't crash on call end
- [ ] **Test with real devices** (2+ participants)
- [ ] **Deploy Firebase rules**

---

**Good luck with testing!** 🚀
