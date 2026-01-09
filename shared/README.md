# Shared Code Between Mobile & Web

This folder contains code that is shared between React Native (mobile) and React (web) applications.

## 📁 Structure

```
shared/
├── firebaseConfig.web.js       # Firebase config for web
├── services/                   # Business logic & API calls
│   ├── authService.js         # Authentication logic
│   ├── userService.js         # User CRUD operations
│   ├── postService.js         # Post/content operations
│   ├── messageService.js      # Messaging operations
│   └── marketplaceService.js  # Marketplace operations
├── utils/                      # Helper functions
│   ├── validation.js          # Form validation
│   ├── formatters.js          # Data formatting
│   └── constants.js           # App constants
├── hooks/                      # Custom React hooks
│   ├── useAuth.js             # Auth hook
│   ├── useFirestore.js        # Firestore operations hook
│   └── useRealtime.js         # Real-time listeners hook
└── types/                      # TypeScript types (if using TS)
    └── index.js               # Type definitions

```

## 🔄 What to Share

### ✅ DO Share:
- Business logic (CRUD operations)
- Firebase service functions
- Data validation
- Helper/utility functions
- Custom hooks (React hooks work on both)
- Constants and configuration
- Type definitions
- State management logic

### ❌ DO NOT Share:
- UI Components (use platform-specific)
- Navigation code
- Native modules
- Platform-specific APIs
- Style definitions

## 🚀 Usage

### In React Native (Mobile):
```javascript
// Use mobile-specific Firebase config
import { auth, db } from '../firebaseConfig';
// Import shared services
import { getUserData } from '../shared/services/userService';
```

### In React Web:
```javascript
// Use web-specific Firebase config
import { auth, db } from './shared/firebaseConfig.web';
// Import shared services
import { getUserData } from './shared/services/userService';
```

## 🔧 Setup Instructions

1. **Copy your mobile app's business logic** into `shared/services/`
2. **Update Firebase imports** in service files to use parameterized db/auth
3. **Create web-specific Firebase config** in `firebaseConfig.web.js`
4. **Extract UI-independent logic** from screens into services
5. **Create custom hooks** for reusable data fetching logic

## 📝 Environment Variables

### For Web (.env file):
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### For Mobile (app.json extra):
```json
{
  "extra": {
    "FIREBASE_API_KEY": "your_api_key",
    "FIREBASE_AUTH_DOMAIN": "your_project.firebaseapp.com",
    "FIREBASE_PROJECT_ID": "your_project_id",
    "FIREBASE_STORAGE_BUCKET": "your_project.appspot.com",
    "FIREBASE_MESSAGING_SENDER_ID": "your_sender_id",
    "FIREBASE_APP_ID": "your_app_id"
  }
}
```

## 🔐 Firebase Rules

Both mobile and web use the **same Firebase project** and **same security rules**. Ensure your Firestore rules are properly configured for both platforms.

## 📱 Platform Detection

When needed, detect platform in shared code:

```javascript
// In React Native
import { Platform } from 'react-native';
const isWeb = Platform.OS === 'web';

// In React Web
const isWeb = typeof window !== 'undefined';
```
