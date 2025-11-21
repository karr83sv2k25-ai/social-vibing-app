# 🚀 Building WebRTC App - Device Setup

## Current Status: ✅ Agora Configured

Your Agora App ID is set: `da4929427d76478caa10691c99fab9d7`

Now you need to build the app with native Agora modules.

---

## Option 1: Build on Connected Device (Recommended)

### Android:

1. **Connect your Android device via USB**
2. **Enable Developer Mode**:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
3. **Enable USB Debugging**:
   - Settings → Developer Options → USB Debugging
4. **Trust your computer** (pop-up on device)
5. **Run build**:
   ```bash
   cd "d:\Fiver Project\Fiver Project"
   npx expo run:android
   ```

The build will take **5-10 minutes** (downloads Gradle, Android SDK, compiles native modules).

---

## Option 2: Use Android Emulator

### If you have Android Studio:

1. **Open Android Studio**
2. **Tools → Device Manager**
3. **Create Virtual Device** (if none exists)
4. **Start emulator**
5. **Run build**:
   ```bash
   cd "d:\Fiver Project\Fiver Project"
   npx expo run:android
   ```

---

## Option 3: Cloud Build (EAS Build)

If you don't want to wait for local build:

```bash
cd "d:\Fiver Project\Fiver Project"
npx eas build --platform android --profile development
```

This builds in the cloud (~10-15 min), then you download and install APK.

---

## ⚡ Quick Start (What to Do Now)

**Choose one**:

### A. Have Android device handy?
→ Plug it in via USB
→ Enable USB debugging
→ Run: `npx expo run:android`

### B. Have Android Studio?
→ Start emulator
→ Run: `npx expo run:android`

### C. Want to skip local build?
→ Run: `npx eas build --platform android --profile development`
→ Download APK when done
→ Install on your device

---

## 🎯 After Build Completes

1. **App will auto-launch** on your device/emulator
2. **Navigate to a community group**
3. **Start audio call**
4. **Join on second device** (use your testing device from before)
5. **Speak** - you should hear with <300ms latency!

---

## 📱 Testing Checklist

Once app launches:

- ☐ Open app
- ☐ Go to community group
- ☐ Tap group info → Start audio call
- ☐ Check status shows "Connected via WebRTC"
- ☐ Join on second device
- ☐ Speak on device 1 → Hear on device 2
- ☐ Verify <300ms latency (nearly instant)
- ☐ Check speaking indicator pulses when talking
- ☐ Test mute button
- ☐ Test speaker toggle

---

## 🔧 Build Troubleshooting

### "No Android connected device found"
→ Connect device via USB or start emulator

### "USB debugging not authorized"
→ Check device screen for "Trust this computer?" prompt

### "Gradle build failed"
→ This is normal first time - let it re-download dependencies
→ Run build again

### Build takes too long (>15 min)
→ First build downloads lots of dependencies
→ Subsequent builds will be much faster (~2-3 min)

---

**Ready? Pick your option above and let's build! 🚀**
