# Physical Device Network Error Fix Guide

## ❌ Issue: "Network request failed" on Physical Device

Physical device pe bhi network error aa raha hai even though:
- ✅ API is working (tested from PC with curl)
- ✅ Code is correct
- ✅ AndroidManifest has proper permissions

---

## 🔍 Quick Checks

### 1. Phone Ki Internet Check Karo
```
1. Phone pe browser kholo
2. google.com open karo
3. Agar nahi khula to internet issue hai
```

### 2. WiFi/Mobile Data Toggle Karo
```
1. Phone ka WiFi OFF karo
2. Mobile Data ON karo
3. App restart karo
4. Test karo
```

### 3. App Permissions Check Karo
```
1. Phone Settings → Apps → Social Vibing
2. Permissions → Network/Internet
3. Verify "Allow" selected hai
```

### 4. VPN Check Karo
```
1. Settings → VPN
2. Agar VPN ON hai to OFF karo
3. App restart karo
```

### 5. DNS Change Karo
```
1. WiFi Settings → Advanced
2. DNS ko Google DNS set karo:
   - Primary: 8.8.8.8
   - Secondary: 8.8.4.4
3. WiFi reconnect karo
```

---

## 🛠️ Solution Steps

### Option 1: Network Test Screen (Recommended)

Maine ek diagnostic screen banaya hai:

```bash
# Add to App.js navigation:
import NetworkTestScreen from './screens/NetworkTestScreen';

<Stack.Screen 
  name="NetworkTest" 
  component={NetworkTestScreen} 
  options={{ title: 'Network Test' }}
/>
```

**Test karne ke liye:**
1. App me ja kar NetworkTest screen kholo
2. "Run Tests" button press karo
3. Dekho kaun se tests fail ho rahe hain
4. Results screenshot le kar bhejo

### Option 2: Manual Fix

**Try these in order:**

1. **Restart Phone**
   ```
   Phone completely restart karo
   App phir se try karo
   ```

2. **Clear App Cache**
   ```
   Settings → Apps → Social Vibing → Storage
   Clear Cache (NOT Clear Data)
   App restart karo
   ```

3. **Reinstall App**
   ```
   App uninstall karo
   npx expo start
   QR code scan kar ke phir se install karo
   ```

4. **Check Firewall**
   ```
   Agar phone pe firewall app installed hai (NetGuard, NoRoot Firewall)
   to us me Social Vibing ko allow karo
   ```

---

## 🔧 Technical Debugging

### Test 1: Simple Fetch Test

App me ye code add karo aur test karo:

```javascript
// Add this test function in KingMediaVideoGenScreen
const testBasicFetch = async () => {
  try {
    console.log('🧪 Testing basic HTTPS fetch...');
    
    // Test 1: Google
    const google = await fetch('https://www.google.com', { method: 'HEAD' });
    console.log('✅ Google:', google.status);
    
    // Test 2: API domain
    const api = await fetch('https://beige-crane-665569.hostingersite.com', { method: 'HEAD' });
    console.log('✅ API domain:', api.status);
    
    // Test 3: Full API endpoint
    const login = await fetch('https://beige-crane-665569.hostingersite.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: 'karr83sv2k25@gmail.com',
        password: 'Admin123!'
      })
    });
    const data = await login.json();
    console.log('✅ Login API:', data);
    
    Alert.alert('Success', 'All tests passed! API is reachable.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    Alert.alert('Error', `Test failed: ${error.message}`);
  }
};

// Add test button in render
<TouchableOpacity onPress={testBasicFetch} style={{padding: 10, backgroundColor: '#FF9800'}}>
  <Text style={{color: '#fff'}}>🧪 Test Network</Text>
</TouchableOpacity>
```

### Test 2: Check Logs

Phone ko USB se connect karo aur logs dekho:

```bash
# Terminal me run karo:
adb logcat | grep -i "network\|fetch\|cors"
```

---

## 📱 Common Android Issues

### Issue 1: Network Security Policy (Android 9+)

**Fix:**
```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>
```

### Issue 2: DNS Resolution Failure

**Symptoms:**
- "Network request failed"
- Works on PC but not phone
- Other apps work fine

**Fix:**
```
1. Phone Settings → WiFi
2. Long press connected network
3. Modify Network
4. IP Settings → Static
5. DNS 1: 8.8.8.8
6. DNS 2: 8.8.4.4
7. Save and reconnect
```

### Issue 3: Expo Go Limitations

**If using Expo Go:**
```bash
# Switch to development build
npx expo prebuild
npx expo run:android
```

Development build mein better network support hai.

---

## ✅ Expected Behavior

Jab sab theek ho to ye dikhna chahiye:

```
LOG 🎬 Starting video generation...
LOG 📝 Prompt: A cat playing
LOG 🎬 Generating video...
LOG 🔧 Provider: veo3
LOG 📊 Response status: 200
LOG ✅ Video generation started
LOG 📦 Response data: {"success":true,"job_id":true,"status":"queued"}
```

**NOT this:**
```
ERROR ❌ Video Generation Error: Network request failed
```

---

## 🆘 Still Not Working?

**Send me:**
1. Phone model and Android version
2. Screenshot of NetworkTest results
3. Output of `adb logcat` when error occurs
4. Network type (WiFi/Mobile data)
5. VPN status (ON/OFF)

**Quick Test Command:**
```bash
# Run on phone browser:
https://beige-crane-665569.hostingersite.com/api

# Should show: {"message":"Welcome to King Media API"}
```

Agar browser pe bhi nahi khula, to DNS/Network issue hai phone ki taraf se.

---

## 📞 Contact

- File: [PHYSICAL_DEVICE_FIX.md](PHYSICAL_DEVICE_FIX.md)
- API working: ✅ Yes (tested from PC)
- Code working: ✅ Yes
- Issue: Phone network configuration

**Recommendation:** Try different WiFi network or mobile data first.
