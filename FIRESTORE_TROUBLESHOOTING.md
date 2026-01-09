# Firestore Connection Troubleshooting Guide

## Problem: All Firestore queries timing out

Your app shows logs like:
```
⚠️ Firestore connectivity issue: connectivity-timeout
❌ Posts fetch error: Posts timeout after 10000ms
```

This means **Firestore cannot connect** to your database.

---

## Solution Steps (Try in order)

### 1. ✅ Check Firestore Rules (MOST COMMON ISSUE)

Your Firestore rules might be blocking all reads.

**Fix:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: `social-vibing-karr`
3. Click **Firestore Database** in left menu
4. Click **Rules** tab
5. Replace with these rules (for testing):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow public read for all collections (for testing)
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

6. Click **Publish**
7. **Restart your app** and test

---

### 2. ✅ Verify Firestore Database Exists

**Check:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: `social-vibing-karr`
3. Look for **Firestore Database** in left menu
4. If it says "Create database", you need to create it first
5. Choose **Start in production mode** or **Test mode**
6. Select a location (any location is fine for testing)

**Important:** Make sure you're creating **Firestore Database**, NOT "Realtime Database"

---

### 3. ✅ Check Network Connection

**On Physical Device:**
- Make sure device has internet access
- Try opening a website in browser
- Try switching between WiFi and mobile data

**On Android Emulator:**
- Emulator should have internet by default
- Check if you can browse websites in emulator browser

**On iOS Simulator:**
- Check internet connection works
- Try Safari in simulator

---

### 4. ✅ Verify Project Configuration

Check `app.json` has correct Firebase config:

```json
"extra": {
  "FIREBASE_API_KEY": "AIzaSyD8GUTKesMY2Hpv-D3JS0vUG3CnD6yhRgc",
  "FIREBASE_PROJECT_ID": "social-vibing-karr",
  "FIREBASE_APP_ID": "1:907907966035:web:eca4797d3d76e6f00552a6"
}
```

Project ID should match what you see in Firebase Console.

---

### 5. ✅ Add Some Test Data

Your collections might be empty. Add test data:

1. Go to Firebase Console → Firestore Database
2. Click **Start collection**
3. Collection ID: `posts`
4. Click **Next**
5. Document ID: `test1` (or auto-generate)
6. Add fields:
   - `title` (string): "Test Post"
   - `text` (string): "This is a test"
   - `createdAt` (timestamp): [click clock icon]
   - `authorName` (string): "Test User"
   - `likes` (number): 0
7. Click **Save**

Now restart app and check if posts load.

---

### 6. ✅ Check for Firewall/Proxy

If on corporate network or using VPN:
- Firebase might be blocked
- Try on different network (mobile hotspot)
- Temporarily disable VPN

---

### 7. ✅ Clear App Cache and Reinstall

```bash
# Stop metro bundler
# Clear cache
npx expo start --clear

# Or full reinstall
npm run android  # for Android
npm run ios      # for iOS
```

---

## Quick Test Commands

### Test 1: Check Network
```javascript
// Run in app - check logs
import NetInfo from '@react-native-community/netinfo';
NetInfo.fetch().then(state => {
  console.log('Network:', state.isConnected, state.isInternetReachable);
});
```

### Test 2: Test Firestore Directly
```bash
# Import test file in App.js
import './testFirestoreConnection';
```

---

## Expected Success Logs

When working correctly, you should see:
```
📶 Network status: {isConnected: true, isInternetReachable: true}
✅ Firestore connectivity OK
✅ Posts completed in XXXms
✅ Posts fetched: 5 documents
✅ Loaded 5 posts with 3 unique authors
```

---

## Still Not Working?

If none of the above work:

1. **Share these logs:**
   - Full console output from app startup
   - Network status from logs
   - Any error messages

2. **Check Firebase Console:**
   - Go to Firestore Database
   - Take screenshot of your data structure
   - Take screenshot of your rules

3. **Try the web app:**
   - If your project has a web version
   - See if it can connect to Firestore
   - This isolates React Native issues

---

## Most Likely Solution

**90% of the time it's #1 (Firestore Rules)** - They're blocking reads.

Just set rules to allow public read for testing:
```javascript
match /{document=**} {
  allow read: if true;
}
```

Then test again!
