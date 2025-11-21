# Firebase Setup Instructions - IMPORTANT

## Issue
Your app is showing these errors:
1. `serverTimestamp() is not currently supported inside arrays` - ✅ FIXED in code
2. `Missing or insufficient permissions` - ❌ NEEDS Firebase Console Update

## Solution: Update Firebase Security Rules

### Step 1: Go to Firebase Console
1. Open your browser and go to: https://console.firebase.google.com/
2. Select your project (the one used in this app)

### Step 2: Update Firestore Security Rules
1. Click on **"Firestore Database"** in the left sidebar
2. Click on the **"Rules"** tab at the top
3. You'll see your current rules

### Step 3: Replace with These Rules
**Delete everything** and paste this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == userId;
    }
    
    // Communities collection
    match /communities/{communityId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn();
      
      // Community posts subcollection
      match /posts/{postId} {
        allow read, write: if isSignedIn();
      }
      
      // Community blogs subcollection
      match /blogs/{blogId} {
        allow read, write: if isSignedIn();
      }
      
      // Community members subcollection
      match /members/{memberId} {
        allow read, write: if isSignedIn();
      }
      
      // Community messages subcollection
      match /messages/{messageId} {
        allow read, write: if isSignedIn();
      }
    }
    
    // Audio calls collection - THIS IS THE IMPORTANT ONE
    match /audio_calls/{communityId} {
      allow read, write: if isSignedIn();
      
      match /rooms/{roomId} {
        allow read, write: if isSignedIn();
        
        // Audio chunks subcollection
        match /audio_chunks/{chunkId} {
          allow read, write: if isSignedIn();
        }
      }
    }
    
    // Posts collection
    match /posts/{postId} {
      allow read, write: if isSignedIn();
    }
    
    // Marketplace collection
    match /marketplace/{itemId} {
      allow read, write: if isSignedIn();
    }
    
    // Messages/Chats
    match /messages/{messageId} {
      allow read, write: if isSignedIn();
    }
    
    // Following/Followers
    match /following/{docId} {
      allow read, write: if isSignedIn();
    }
    
    match /followers/{docId} {
      allow read, write: if isSignedIn();
    }
    
    // Default - allow everything else for authenticated users
    match /{document=**} {
      allow read, write: if isSignedIn();
    }
  }
}
```

### Step 4: Publish the Rules
1. Click the **"Publish"** button (blue button at the top)
2. Wait for the confirmation message

### Step 5: Reload Your App
1. In your Expo terminal (where the app is running), press **`r`** to reload
2. Or restart the app on your device/emulator

## After These Steps
✅ The `serverTimestamp()` error will be gone (already fixed in code)
✅ The `Missing or insufficient permissions` error will be gone (after updating rules)

## Notes
- These rules allow any authenticated user to read/write most collections
- For production, you may want to add more specific restrictions
- Make sure users are properly authenticated before accessing any features
