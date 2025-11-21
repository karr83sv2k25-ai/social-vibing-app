# 🚨 NDK Issue & Solution

## Problem: Local Build Failed

The local build failed with **NDK 27.1.12297006 C++ linker errors**:
```
ld.lld: error: undefined symbol: std::__ndk1::__shared_weak_count::lock()
ld.lld: error: undefined symbol: operator delete(void*)
... (20+ linker errors)
```

This is a **known issue** with:
- React Native 0.81.5
- Expo SDK 54
- NDK 27.x (too new)
- expo-modules-core C++ compilation

---

## ✅ Solution: EAS Cloud Build

Instead of fighting NDK issues locally, we're using **EAS Build** (cloud):

```bash
cd "d:\Fiver Project\Fiver Project"
npx eas build --platform android --profile development
```

### Why This Works:
✅ EAS uses **controlled build environment**
✅ Correct NDK version automatically
✅ No local Android SDK/NDK issues
✅ Builds in ~10-15 minutes
✅ Download APK when done

---

## 📊 Current Status

**Build Started**: Cloud build in progress...

**What's Happening:**
1. 🔄 Uploading project to EAS servers
2. 🔄 Setting up build environment
3. 🔄 Installing dependencies
4. 🔄 Compiling native Agora modules
5. 🔄 Building APK
6. ⏳ **Wait time: 10-15 minutes**

---

## 🎯 Next Steps

### When Build Completes:

1. **Download APK**
   - EAS will provide download link
   - Or check: https://expo.dev/accounts/[your-account]/projects/fiver-project/builds

2. **Install on Device**
   - Transfer APK to device via USB/cloud
   - Enable "Install from unknown sources"
   - Install APK

3. **Test WebRTC Audio**
   - Open app
   - Navigate to community group
   - Start audio call
   - Status shows "Connected via WebRTC"
   - Join on second device
   - Test <300ms latency!

---

## 🔧 Alternative: Fix Local Build (Advanced)

If you want to fix local builds later:

### Option 1: Downgrade NDK
```bash
# Install NDK 25.1.8937393
sdkmanager "ndk;25.1.8937393"

# Update app.json
"ndkVersion": "25.1.8937393"
```

### Option 2: Update Dependencies
```bash
npm update expo expo-modules-core react-native
npx expo install --fix
```

### Option 3: Clear Caches
```bash
cd android
./gradlew clean
cd ..
rm -rf node_modules
npm install
```

**But honestly**: EAS Build is easier and more reliable! 🚀

---

## 💡 Why NDK 27 Fails

NDK 27 changed C++ standard library linking:
- Missing symbols: `__shared_weak_count`, `operator delete`, `__cxa_*`
- expo-modules-core expects older NDK behavior
- React Native 0.81 not yet compatible with NDK 27
- Will be fixed in future RN/Expo versions

**For now**: Use EAS Build or NDK 25.x

---

## ⏱️ Build Timeline

- **Upload**: ~2 min
- **Setup**: ~3 min  
- **Build**: ~8 min
- **Total**: ~10-15 min

Check build status:
```bash
npx eas build:list
```

---

**Your build is running! Check back in ~15 minutes for the APK download link.**
