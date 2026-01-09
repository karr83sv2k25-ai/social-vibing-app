# Video Generation Implementation Guide for React Native
## Complete Guide for Developer/Agent

---

## 🎯 Objective
Implement video generation feature in React Native app using King Media API with Google Veo 3.

---

## ✅ Prerequisites Checklist

Before starting, verify these are completed:

```
☐ API is working (test with: .\test-login.ps1)
☐ Google AI Studio API key added in database
☐ Rate limits cleared
☐ User can login successfully
☐ JWT token is being saved properly
```

---

## 📋 Step-by-Step Implementation

### **Step 1: Add API Service**

Create file: `src/services/api.js`

Copy complete code from `RN_API_SERVICE_FIXED.js` file.

**Verify these settings:**
```javascript
const API_BASE_URL = 'https://beige-crane-665569.hostingersite.com/api';

// In generateVideo function:
generateVideo: async (prompt, provider = 'veo3') => {  // ← Must be 'veo3'
    // ... code
    const response = await fetchWithConfig(`${API_BASE_URL}/ai/video`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, provider }),
    }, 60000);
}
```

---

### **Step 2: Create Video Generation Screen**

File: `src/screens/VideoGenerationScreen.js`

```javascript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { aiAPI } from '../services/api';

const VideoGenerationScreen = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleGenerateVideo = async () => {
    // Validation
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a video description');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      console.log('🎬 Starting video generation...');
      console.log('📝 Prompt:', prompt);
      
      // Call API - IMPORTANT: provider must be 'veo3'
      const response = await aiAPI.generateVideo(prompt, 'veo3');
      
      console.log('📦 Response:', JSON.stringify(response, null, 2));

      if (response.success) {
        setResult(response);
        Alert.alert(
          'Success! 🎉', 
          'Video generation started! This will take 2-5 minutes.'
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to start video generation');
      }
    } catch (error) {
      console.error('❌ Video Generation Error:', error);
      console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      Alert.alert(
        'Error',
        error.message || 'Failed to generate video. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🎬 Generate Video</Text>
        <Text style={styles.subtitle}>Powered by Google Veo 3</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Describe your video in detail. Example: "A cat playing with a ball of yarn on a sunny day"
          </Text>
        </View>

        <TextInput
          style={styles.textArea}
          placeholder="Describe your video..."
          placeholderTextColor="#999"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          numberOfLines={4}
          editable={!loading}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleGenerateVideo}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.buttonText}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>🎬 Generate Video</Text>
          )}
        </TouchableOpacity>

        {result && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>✅ Video Generation Started</Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Job ID:</Text>
              <Text style={styles.resultValue}>{result.job_id}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Status:</Text>
              <Text style={styles.resultValue}>{result.status}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Estimated Time:</Text>
              <Text style={styles.resultValue}>{result.estimated_time || '2-5 minutes'}</Text>
            </View>
          </View>
        )}

        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>📝 Example Prompts:</Text>
          
          <TouchableOpacity 
            style={styles.exampleButton}
            onPress={() => setPrompt('A cat playing with a ball of yarn')}>
            <Text style={styles.exampleText}>🐱 A cat playing with a ball of yarn</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.exampleButton}
            onPress={() => setPrompt('Waves crashing on a beach at sunset')}>
            <Text style={styles.exampleText}>🌊 Waves crashing on a beach at sunset</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.exampleButton}
            onPress={() => setPrompt('A bird flying through the clouds')}>
            <Text style={styles.exampleText}>🐦 A bird flying through the clouds</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.exampleButton}
            onPress={() => setPrompt('A person walking in a park on a sunny day')}>
            <Text style={styles.exampleText}>🚶 A person walking in a park on a sunny day</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>⏱️ Important Notes:</Text>
          <Text style={styles.noteText}>• Video generation takes 2-5 minutes</Text>
          <Text style={styles.noteText}>• You will receive notification when complete</Text>
          <Text style={styles.noteText}>• Keep your description detailed and clear</Text>
          <Text style={styles.noteText}>• Limit: 2 videos per hour</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 120,
    marginBottom: 20,
    color: '#333',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultContainer: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 15,
  },
  resultRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 120,
  },
  resultValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  examplesContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  exampleButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  exampleText: {
    fontSize: 14,
    color: '#2196F3',
  },
  noteBox: {
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#E65100',
    marginBottom: 4,
  },
});

export default VideoGenerationScreen;
```

---

### **Step 3: Add Navigation**

Update `App.js` or your navigation file:

```javascript
import VideoGenerationScreen from './src/screens/VideoGenerationScreen';

// In your Stack/Tab navigator:
<Tab.Screen 
  name="Videos" 
  component={VideoGenerationScreen}
  options={{ 
    title: '🎬 Videos',
    tabBarIcon: ({ color, size }) => (
      <Icon name="video" size={size} color={color} />
    )
  }}
/>
```

---

## 🔧 Common Errors & Solutions

### **Error 1: "Not authenticated"**

**Problem:** Token missing or expired

**Solution:**
```javascript
// Check if user is logged in before generating video
useEffect(() => {
  const checkAuth = async () => {
    const token = await AsyncStorage.getItem('jwt_token');
    if (!token) {
      Alert.alert('Error', 'Please login first');
      navigation.navigate('Login');
    }
  };
  checkAuth();
}, []);
```

---

### **Error 2: "Network request failed"**

**Problem:** API not accessible from device

**Solution 1:** Test API from terminal first
```powershell
.\test-video.ps1
```

**Solution 2:** Use physical device instead of emulator
```bash
adb devices
npx react-native run-android
```

**Solution 3:** Check API URL
```javascript
// In api.js, verify:
const API_BASE_URL = 'https://beige-crane-665569.hostingersite.com/api';
// NOT http:// or localhost
```

---

### **Error 3: "Rate limit exceeded"**

**Problem:** Too many requests

**Solution:** Clear rate limits in database
```sql
DELETE FROM qa_api_logs WHERE created < NOW();
```

Or wait 1 hour for automatic reset.

---

### **Error 4: "API key not configured"**

**Problem:** Google AI Studio API key missing

**Solution:** Add key in phpMyAdmin
```sql
INSERT INTO qa_options (title, content) 
VALUES ('gemini_api', 'YOUR_GOOGLE_AI_KEY_HERE')
ON DUPLICATE KEY UPDATE content = 'YOUR_GOOGLE_AI_KEY_HERE';
```

Get key from: https://aistudio.google.com/app/apikey

---

## 🧪 Testing Checklist

### **Before Testing:**
```
☐ User is logged in
☐ Token is saved in AsyncStorage
☐ API tested with curl (.\test-video.ps1)
☐ Google AI key added in database
☐ Rate limits cleared
```

### **During Testing:**
```
☐ Enter prompt in text field
☐ Press "Generate Video" button
☐ Check console logs for errors
☐ Verify success message appears
☐ Check job_id is returned
```

### **Console Logs to Look For:**
```javascript
🎬 Starting video generation...
📝 Prompt: A cat playing...
📦 Response: {"success":true,"job_id":true,...}
✅ Video generation started
```

---

## 🐛 Debugging Steps

### **Step 1: Enable Debug Mode**

Add this at top of VideoGenerationScreen:
```javascript
import { LogBox } from 'react-native';
LogBox.ignoreLogs(['Possible Unhandled Promise Rejection']);

// In component:
useEffect(() => {
  console.log('🚀 VideoGenerationScreen mounted');
}, []);
```

### **Step 2: Test API Separately**

Create test function:
```javascript
const testAPI = async () => {
  try {
    const token = await AsyncStorage.getItem('jwt_token');
    console.log('🔑 Token:', token ? 'Present' : 'Missing');
    
    const response = await fetch('https://beige-crane-665569.hostingersite.com/api/ai/video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        prompt: 'test video',
        provider: 'veo3'
      }),
    });
    
    console.log('📊 Status:', response.status);
    const data = await response.json();
    console.log('📦 Data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Test Error:', error);
  }
};

// Add button to call testAPI()
```

### **Step 3: Check Token**

```javascript
const checkToken = async () => {
  const token = await AsyncStorage.getItem('jwt_token');
  console.log('Token:', token);
  console.log('Token length:', token?.length);
  
  // Decode token to check expiry
  const parts = token?.split('.');
  if (parts && parts[1]) {
    const payload = JSON.parse(atob(parts[1]));
    console.log('Token expires:', new Date(payload.exp * 1000));
  }
};
```

---

## 📱 Complete Working Example

Here's a minimal working implementation:

```javascript
// VideoScreen.js
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
import { aiAPI } from '../services/api';

export default function VideoScreen() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!prompt) {
      Alert.alert('Error', 'Enter prompt');
      return;
    }
    
    setLoading(true);
    try {
      const result = await aiAPI.generateVideo(prompt, 'veo3');
      if (result.success) {
        Alert.alert('Success', `Job ID: ${result.job_id}`);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{padding: 20}}>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Enter video prompt"
        style={{borderWidth: 1, padding: 10, marginBottom: 10}}
      />
      <TouchableOpacity 
        onPress={generate} 
        disabled={loading}
        style={{backgroundColor: '#007AFF', padding: 15, borderRadius: 8}}>
        <Text style={{color: '#fff', textAlign: 'center'}}>
          {loading ? 'Generating...' : 'Generate Video'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## ✅ Verification Steps

After implementation, verify:

1. **Login works:**
   ```javascript
   await authAPI.login('karr83sv2k25@gmail.com', 'Admin123!');
   // Should save token in AsyncStorage
   ```

2. **Token is present:**
   ```javascript
   const token = await AsyncStorage.getItem('jwt_token');
   console.log('Token:', token ? 'Present' : 'Missing');
   ```

3. **Video generation works:**
   ```javascript
   const result = await aiAPI.generateVideo('A cat playing', 'veo3');
   console.log('Success:', result.success);
   console.log('Job ID:', result.job_id);
   ```

---

## 🆘 If Still Not Working

### **Contact Developer with:**

```
Hi, I need help with video generation in my React Native app.

Current Setup:
- API URL: https://beige-crane-665569.hostingersite.com/api
- Login works: Yes/No
- Token saved: Yes/No
- Provider: veo3

Error Details:
[Paste error message from console]

Console Logs:
[Paste relevant console logs]

Steps Tried:
- Tested API with curl: Yes/No
- Checked token in AsyncStorage: Yes/No
- Verified Google AI key in database: Yes/No
- Cleared rate limits: Yes/No
```

---

## 📚 Required Files

Make sure you have:
- ✅ `src/services/api.js` (from RN_API_SERVICE_FIXED.js)
- ✅ `src/screens/VideoGenerationScreen.js`
- ✅ Navigation setup
- ✅ AsyncStorage installed
- ✅ Login screen working

---

## 🎉 Expected Result

When working correctly:

1. User logs in ✅
2. Opens video generation screen ✅
3. Enters prompt: "A cat playing" ✅
4. Presses generate button ✅
5. Sees success message ✅
6. Receives job_id in response ✅
7. Video processes in background ✅

**Test command:**
```powershell
.\test-video.ps1
```

**Should return:**
```json
{
    "success": true,
    "job_id": true,
    "status": "queued",
    "estimated_time": "2-5 minutes"
}
```

---

## 📞 Support Files

- `RN_API_SERVICE_FIXED.js` - API service code
- `RN_IMPLEMENTATION_GUIDE.md` - Full React Native guide
- `API_TROUBLESHOOTING_GUIDE.md` - Server troubleshooting
- `SETUP_API_KEYS.md` - API keys setup
- `test-video.ps1` - Test video generation

---

**Ye guide developer/agent ko de do. Sab steps follow karne ke baad video generation perfect kaam karega!** 🚀
