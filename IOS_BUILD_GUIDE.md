# iOS App Build Guide

## 🎯 Quick Start

To extract/build the iOS app, you have several options:

### Option 1: Build for Simulator (Fastest, No Code Signing)
```bash
./build-ios.sh
# Then select option 2
```

Or manually:
```bash
cd ios
xcodebuild -workspace SocialVibing.xcworkspace \
  -scheme SocialVibing \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath ./build \
  CODE_SIGNING_ALLOWED=NO
```

**Output**: `ios/build/Build/Products/Debug-iphonesimulator/SocialVibing.app`

### Option 2: Build with Expo CLI (Recommended)
```bash
npx expo run:ios
```

This will:
- Bundle your JavaScript
- Build the native app
- Launch it in the simulator automatically

### Option 3: Build with EAS (Cloud Build)
```bash
npx eas build --platform ios --profile production
```

Benefits:
- No local Xcode required
- Handles code signing automatically
- Creates IPA file ready for App Store or TestFlight

## 📋 Prerequisites

- **macOS** (required for iOS development)
- **Xcode** 15.0 or later
- **Node.js** 18+ and npm
- **CocoaPods** (already installed via `pod install`)

## 🔧 Common Issues & Solutions

### Permission Errors
If you see `EPERM` errors:
```bash
# Clean derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/SocialVibing-*

# Clean project
cd ios && xcodebuild clean && cd ..
```

### Code Signing Issues
For local device builds, you need:
1. Apple Developer account
2. Provisioning profile configured in Xcode
3. Signing certificate installed

To avoid code signing for testing:
- Build for simulator (Option 1)
- Use EAS cloud build (Option 3)

### Metro Bundler Issues
```bash
# Reset Metro cache
npx react-native start --reset-cache

# Or
rm -rf node_modules
npm install
cd ios && pod install && cd ..
```

## 📦 Build Output Locations

- **Simulator Build**: `ios/build/Build/Products/Debug-iphonesimulator/SocialVibing.app`
- **Archive**: `ios/build/SocialVibing.xcarchive`
- **IPA**: Created using Archive → Export in Xcode

## 🚀 Deploying

### TestFlight (Beta Testing)
1. Build with EAS: `npx eas build --platform ios`
2. Submit to TestFlight: `npx eas submit --platform ios`

### App Store
1. Archive the app in Xcode
2. Validate & upload via Xcode Organizer
3. Submit for review in App Store Connect

## 📱 Running on Physical Device

```bash
# List available devices
xcrun devicectl list devices

# Build for specific device
npx expo run:ios --device "Your iPhone Name"
```

## 🛠 What's Already Done

✅ CocoaPods dependencies installed (112 pods)
✅ Podfile configured and fixed
✅ Native project structure generated
✅ Build scripts ready
✅ All syntax errors fixed

## 💡 Tips

1. **First time building?** Use the simulator build - it's fastest
2. **Need to test on device?** Use Expo Go app for quick testing
3. **Production build?** Use EAS cloud build for proper distribution
4. **Debugging?** Enable Debug configuration and connect to Metro bundler

## 📚 Additional Resources

- [Expo iOS Build Documentation](https://docs.expo.dev/build/setup/)
- [React Native iOS Guide](https://reactnative.dev/docs/running-on-device)
- [Xcode Build Settings](https://developer.apple.com/documentation/xcode/build-settings-reference)
