# Native Modules & Development Build Guide

## Problem Solved

This guide addresses the following errors that occur when running the app in Expo Go:

```
ERROR [Error: NitroModules are not supported in Expo Go! Use EAS (`expo prebuild`) or eject to a bare workflow instead.]
ERROR [Error: Element type is invalid. Received a promise that resolves to: undefined.]
LOG ⏱️ Posts/Polls/Quizzes timeout triggered at 30000ms
```

## What Was Changed

### 1. Platform Detection Utility
Created `/utils/platformCheck.js` to detect if the app is running in Expo Go or a development build.

### 2. Conditional Screen Loading
Updated `App.js` to conditionally load screens that require native modules:
- **CallScreen** - Uses react-native-agora (native module)
- **GroupAudioCallScreen** - Uses react-native-agora (native module)

When running in Expo Go, these screens show a helpful placeholder with build instructions instead of crashing.

### 3. Reduced Timeout Duration
Optimized Firestore query timeouts in `homescreen.js`:
- **Before**: 30 seconds timeout
- **After**: 15 seconds timeout
- Improved logging to be less verbose

## How to Use Native Modules (Recommended)

Since your app uses `react-native-agora` for voice/video calls, you need to build a **Development Build** instead of using Expo Go.

### Option 1: Build with EAS (Recommended)

#### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

#### Step 2: Login to Expo
```bash
eas login
```

#### Step 3: Configure EAS Build (if not already done)
```bash
eas build:configure
```

#### Step 4: Build Development APK for Android
```bash
# This will take 10-20 minutes
eas build --profile development --platform android
```

#### Step 5: Install the APK
Once the build completes, you'll get a download link. Install the APK on your Android device.

#### Step 6: Start Development Server
```bash
npx expo start --dev-client
```

The app will now connect to your development server and support ALL native modules including Agora!

### Option 2: Build Locally with expo prebuild

#### Step 1: Prebuild Native Projects
```bash
npx expo prebuild
```

This generates `android/` and `ios/` folders with native code.

#### Step 2: Run on Android
```bash
npx expo run:android
```

#### Step 3: Run on iOS (Mac only)
```bash
npx expo run:ios
```

## Testing in Expo Go (Limited Features)

You can still test the app in Expo Go, but features requiring native modules will show a placeholder screen with instructions:

```bash
npx expo start
```

Then scan the QR code with Expo Go. Voice/video call screens will show:
> "Feature Unavailable in Expo Go - Build Instructions..."

## What Each Approach Supports

| Feature | Expo Go | Development Build | Production Build |
|---------|---------|-------------------|------------------|
| Basic UI/Navigation | ✅ | ✅ | ✅ |
| Firebase/Firestore | ✅ | ✅ | ✅ |
| React Navigation | ✅ | ✅ | ✅ |
| Voice/Video Calls (Agora) | ❌ | ✅ | ✅ |
| Native Modules | ❌ | ✅ | ✅ |
| Fast Refresh | ✅ | ✅ | ❌ |
| OTA Updates | ✅ | ✅ (with EAS Update) | ✅ (with EAS Update) |

## Quick Commands Reference

```bash
# Install dependencies
npm install

# Start with Expo Go (limited features)
npx expo start

# Start with Development Build (full features)
npx expo start --dev-client

# Build development APK
eas build --profile development --platform android

# Build production APK
eas build --profile production --platform android

# Build iOS (requires Mac + enrolled in Apple Developer Program)
eas build --profile production --platform ios
```

## Troubleshooting

### "No development build found"
- Make sure you've installed the development build APK on your device
- The app name should show "...Fiver Project (dev)" when installed

### Build fails with "ANDROID_SDK_ROOT not set"
For local builds:
```bash
export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk  # Mac
export ANDROID_SDK_ROOT=$HOME/Android/Sdk          # Linux
set ANDROID_SDK_ROOT=%LOCALAPPDATA%\\Android\\Sdk  # Windows
```

### Firestore queries still timing out
- Check your internet connection
- Verify Firebase configuration in `firebaseConfig.js`
- Check Firestore rules allow read access
- Run the diagnostic script:
  ```bash
  node diagnoseFirestore.js
  ```

## Additional Resources

- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [React Native Agora Setup](./AGORA_SETUP.md)

## Summary

**For Development**: Use development builds (`eas build --profile development`)
**For Testing UI Only**: Use Expo Go (call features will be disabled)
**For Production**: Use production builds (`eas build --profile production`)

The app now gracefully handles both environments and provides clear instructions to users when native features aren't available.
