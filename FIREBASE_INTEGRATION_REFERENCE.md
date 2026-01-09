# 🔥 Firebase Backend Integration - Quick Reference

## 📁 Files Created

### Core Configuration
- `shared/firebaseConfig.web.js` - Firebase config for web
- `shared/.env.example` - Environment variables template

### Services (Business Logic)
- `shared/services/authService.js` - Authentication functions
- `shared/services/userService.js` - User CRUD operations

### Utilities
- `shared/utils/helpers.js` - Helper functions
- `shared/utils/validation.js` - Form validation
- `shared/utils/constants.js` - App constants

### Custom Hooks
- `shared/hooks/useAuth.js` - Authentication hook
- `shared/hooks/useFirestore.js` - Firestore operations hook

### Documentation
- `shared/README.md` - Shared code documentation
- `WEB_APP_SETUP.md` - Complete web setup guide

---

## 🚀 Quick Start for Web App

### 1. Create React App
```bash
npx create-react-app social-vibing-web
cd social-vibing-web
npm install firebase react-router-dom
```

### 2. Copy Shared Folder
```bash
# Copy entire shared folder to web app
cp -r mobile-app/shared web-app/src/
```

### 3. Create .env File
```bash
# In web app root
cp src/shared/.env.example .env
# Edit .env and add your Firebase credentials
```

### 4. Import in Your Components
```javascript
// Web app component
import { auth, db } from './shared/firebaseConfig.web';
import * as AuthService from './shared/services/authService';
import { useAuth } from './shared/hooks/useAuth';

function App() {
  const { user, loading, authenticated } = useAuth(auth, db);
  // Your code here
}
```

---

## 📱 Mobile App Usage (Existing)

```javascript
// Mobile app component
import { auth, db } from '../firebaseConfig';
import * as AuthService from '../shared/services/authService';
import { useAuth } from '../shared/hooks/useAuth';

function HomeScreen() {
  const { user, loading, authenticated } = useAuth(auth, db);
  // Your code here
}
```

---

## 🔑 Key Differences: Mobile vs Web

| Aspect | Mobile (React Native) | Web (React) |
|--------|----------------------|-------------|
| **Firebase Config** | `firebaseConfig.js` (uses `@react-native-async-storage`) | `shared/firebaseConfig.web.js` (uses `browserLocalPersistence`) |
| **Import Firebase** | `import { auth, db } from '../firebaseConfig'` | `import { auth, db } from './shared/firebaseConfig.web'` |
| **Shared Code** | `import * from '../shared/services/...'` | `import * from './shared/services/...'` |
| **Storage** | AsyncStorage | localStorage |
| **Components** | React Native (View, Text) | HTML (div, p) |

---

## 📝 Common Operations

### Authentication

```javascript
// Sign Up
const result = await AuthService.signUp(auth, db, email, password, {
  displayName: 'John Doe',
  phoneNumber: '+1234567890'
});

// Sign In
const result = await AuthService.signIn(auth, db, email, password);

// Sign Out
await AuthService.logout(auth);

// Reset Password
await AuthService.resetPassword(auth, email);
```

### User Operations

```javascript
// Get User Profile
const result = await UserService.getUserProfile(db, userId);

// Update Profile
await UserService.updateUserProfile(db, userId, {
  bio: 'New bio',
  displayName: 'New Name'
});

// Follow User
await UserService.followUser(db, currentUserId, targetUserId);

// Search Users
const result = await UserService.searchUsers(db, 'john', 10);
```

### Using Hooks

```javascript
// Auth Hook
const { user, userData, loading, authenticated } = useAuth(auth, db);

// Document Hook (real-time)
const { data, loading, error } = useDocument(db, 'users', userId, true);

// Collection Hook
import { collection, query, where } from 'firebase/firestore';
const q = query(collection(db, 'posts'), where('userId', '==', currentUserId));
const { data, loading, error } = useCollection(db, q, true);
```

---

## 🔒 Security Checklist

- [ ] `.env` file added to `.gitignore`
- [ ] Firebase Security Rules configured
- [ ] API keys in environment variables
- [ ] Auth state persistence enabled
- [ ] Offline persistence enabled
- [ ] Error handling implemented

---

## 📦 What's Shared vs Platform-Specific

### ✅ Shared (Works on Both)
- Authentication logic (`authService.js`)
- User operations (`userService.js`)
- Validation (`validation.js`)
- Helper functions (`helpers.js`)
- Constants (`constants.js`)
- Custom hooks (`useAuth.js`, `useFirestore.js`)

### ❌ Platform-Specific (DO NOT Share)
- UI Components (React Native vs React)
- Navigation (React Navigation vs React Router)
- Firebase initialization (`firebaseConfig.js` vs `firebaseConfig.web.js`)
- Native modules
- Styling (StyleSheet vs CSS)

---

## 🐛 Troubleshooting

### Firebase not initialized
```javascript
// Check if config is correct
import { isFirebaseReady } from './shared/firebaseConfig.web';
console.log(isFirebaseReady());
```

### Auth not persisting
```javascript
// Web: Check if browserLocalPersistence is set (already done)
// Mobile: Check if AsyncStorage is properly configured (already done)
```

### Firestore offline mode
```javascript
// Already enabled in both configs
// Web: enableIndexedDbPersistence
// Mobile: experimentalForceLongPolling
```

---

## 📚 Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Native Firebase](https://rnfirebase.io/)
- [Firebase JS SDK](https://firebase.google.com/docs/web/setup)
- Your `WEB_APP_SETUP.md` for complete guide
- Your `shared/README.md` for structure details

---

## 🎯 Next Steps

1. ✅ Shared code created
2. ⏳ Create React web app
3. ⏳ Copy shared folder to web app
4. ⏳ Configure environment variables
5. ⏳ Create web UI components
6. ⏳ Test authentication
7. ⏳ Implement features
8. ⏳ Deploy to Firebase Hosting

---

**Note:** Yeh sab files mobile app ke folder mein hai. Web app banate waqt `shared` folder ko copy kar lena.
