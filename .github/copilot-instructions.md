# Social Vibing – Copilot Instructions

## Project Overview
**Social Vibing** is a React Native + Expo social platform (iOS/Android) with real-time chat, communities, marketplace, voice/video calls, and a virtual coin economy.

## Architecture

### Directory Layout
```
/                        # Root-level screens (flat, lowercase filenames: homescreen.js, loginscreen.js)
screens/                 # Secondary/nested screens (PascalCase filenames)
screens/marketplace/     # Marketplace-specific screens
screens/viewers/         # Content viewer screens (comics, books, art, stickers)
components/              # Reusable UI components (ChatBubble, MessageBox, ProfileWithFrame, etc.)
context/                 # WalletContext
contexts/                # StatusContext
hooks/                   # Custom React hooks (useChatState, useAppTimeTracker)
utils/                   # Helpers: firestoreHelpers, fileUpload, platformCheck, presenceHelpers
services/                # External API wrappers (kingMediaService, komikoService, leonardoService, etc.)
functions/               # Firebase Cloud Functions (Node.js)
hostinger-backend/       # PHP/backend for Hostinger media hosting
```

### Navigation
- Root: `createStackNavigator` in [App.js](../App.js)
- Bottom Tabs (5 tabs + FAB): `createBottomTabNavigator` in [tabbarview.js](../tabbarview.js) — Home, Community, Messages, Marketplace

### State Management
- React Context only: `WalletContext` ([context/WalletContext.js](../context/WalletContext.js)), `StatusContext` ([contexts/StatusContext.js](../contexts/StatusContext.js))
- No Redux. Local component state + Firestore `onSnapshot` listeners are the norm.

## Tech Stack
| Concern | Solution |
|---|---|
| Framework | Expo ~54 + React Native ^0.81 |
| Database / Auth | Firebase Firestore + Firebase Auth |
| Media Storage | **Hostinger** (NOT Firebase Storage) — see [hostingerConfig.js](../hostingerConfig.js) |
| Voice/Video Calls | react-native-agora ^4.5 — config in [agoraConfig.js](../agoraConfig.js) |
| Navigation | React Navigation v7 (Stack + Bottom Tabs) |
| In-App Purchases | react-native-iap — see [services/iapService.js](../services/iapService.js) |
| Push Notifications | Firebase Cloud Messaging via [notification.js](../notification.js) |
| Icons | @expo/vector-icons (Ionicons, MaterialCommunityIcons, FontAwesome5) |

## Key Conventions

### Firestore Access
Always use the retry/cache helpers from [utils/firestoreHelpers.js](../utils/firestoreHelpers.js) instead of raw Firestore calls:
```js
import { getDocWithRetry, getDocsWithRetry, fetchUserWithCache } from './utils/firestoreHelpers';
```
Use `CacheManager` from [cacheManager.js](../cacheManager.js) for local persistence of frequently read data.

### Firebase Config
Import `app` and `db` from [firebaseConfig.js](../firebaseConfig.js). Never re-initialize Firebase — the file guards against duplicate initialization with `getApps()`.

### Media Uploads
All image/video/audio uploads go to Hostinger via helpers in [hostingerConfig.js](../hostingerConfig.js) and [utils/fileUpload.js](../utils/fileUpload.js). Do **not** use Firebase Storage.

### Platform / Expo Go Detection
Use `isExpoGo()` from [utils/platformCheck.js](../utils/platformCheck.js) to guard features that require a native build (Agora calls, IAP, etc.).

### Error Suppression
Known benign Firestore SDK errors are suppressed in `LogBox.ignoreLogs` in [App.js](../App.js). Do not remove these entries.

### File Naming
- Root screens: `camelcase.js` (e.g., `homescreen.js`, `loginscreen.js`)
- `screens/` directory: `PascalCase.js` (e.g., `AdminPanelScreen.js`)
- Components: `PascalCase.js`

## Build & Run

```bash
# Start dev server (Expo Go or dev client)
npx expo start

# Run on device (requires native build)
npx expo run:android
npx expo run:ios

# EAS production builds
npm run build:android   # eas build --platform android --profile production
npm run build:ios       # eas build --platform ios --profile production

# EAS development builds
npm run build:android:dev
npm run build:ios:dev
```

## Integration Points

- **Firebase Project**: `social-vibing-karr` — credentials in [app.json](../app.json) `extra` field and [firebaseConfig.js](../firebaseConfig.js)
- **Hostinger Upload Endpoint**: `https://socialvibingapp.karr83anime.com/upload.php` — API key in [hostingerConfig.js](../hostingerConfig.js)
- **Agora App ID**: [agoraConfig.js](../agoraConfig.js)
- **Firestore Security Rules**: [firestore.rules](../firestore.rules) — role hierarchy: `admin > creator > community owner > leader > curator > member`

## Security Notes
- Firebase API keys in `app.json` are client-side keys — Firestore rules are the actual security layer.
- The `.env` file holds any server-side secrets; never commit additional secrets to `app.json`.
- Firestore rules use helper functions (`isAdmin()`, `isCommunityStaff()`, `isLeaderOrAbove()`) — extend these rather than inlining role checks.
