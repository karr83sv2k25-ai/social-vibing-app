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
| Image Caching | expo-image via [components/CachedImage.js](../components/CachedImage.js) |

## Key Conventions

### Performance & UX
- **Lists**: Use `FlatList` with optimization props (`initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `removeClippedSubviews`) — never `.map()` inside `ScrollView` for large datasets.
- **Memoization**: Wrap list item components with `React.memo`. Use `useCallback` for event handlers and `useMemo` for computed values.
- **Images**: Use `CachedImage` from [components/CachedImage.js](../components/CachedImage.js) (wraps expo-image) for automatic caching and smooth fade-in transitions. Avoid raw `<Image>` for network images.
- **Loading States**: Use skeleton loaders from [components/SkeletonLoaders.js](../components/SkeletonLoaders.js) — `ConversationSkeleton`, `ProfileSkeleton`, `ProductGridSkeleton`, `CommunitySkeleton`, `ChatSkeleton`.
- **Error Boundaries**: The root navigator is wrapped with `ErrorBoundary` from [components/ErrorBoundary.js](../components/ErrorBoundary.js). Wrap major screens with it as needed.
- **Console.log**: Automatically stripped in production builds via `babel-plugin-transform-remove-console` in [babel.config.js](../babel.config.js). Safe to use in dev.
- **Splash Screen**: `expo-splash-screen` `preventAutoHideAsync()` is called at module level in App.js. Hides after auth resolves.

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

## Admin App Awareness

**There is a companion admin app** at `/Users/ameerhamza/StudioProjects/social-vibing-admin` (also React Native + Expo SDK 54). Both apps share the **same Firebase project** (`social-vibing-karr`) and the **same Firestore database**.

### DO NOT change these shared Firestore schemas:
- **`users/{uid}` moderation fields**: `role`, `isAdmin`, `isVerified`, `verificationStatus`, `isBanned`, `banType`, `banReason`, `bannedAt`, `banExpiresAt`, `bannedBy`, `isSuspended`, `suspendedReason`, `warnings`, `warningsCount`, `accountStatus`, `reportsReceived`
- **`reports` collection**: The admin app's entire moderation pipeline depends on this schema
- **`admin_actions` collection**: Immutable audit log — rules block updates/deletes
- **`communities` document fields**: `creatorId`, `moderators`, `members`, `memberCount`, `isDisabled`, `disabledAt`, `disabledBy`, `disabledReason`
- **Content soft-delete convention**: `isDeleted`, `deletedAt`, `deletedBy`, `deletionReason` on posts, products, comments
- **Admin-only collections**: `advertisements`, `blocked_content`, `blocked_members`, `join_requests`, `management_records`
- **Firestore rules helper functions**: `isAdmin()` checks `users/{uid}.role == 'admin'` — never change admin role storage

### Key Differences:
| Aspect | Main App | Admin App |
|--------|----------|-----------|
| Media Uploads | Hostinger | Cloudinary |
| UI Library | Custom components | react-native-paper |
| Navigation | Stack + Bottom Tabs | Drawer + Bottom Tabs + Native Stack |
| State | Context (Wallet, Status) | Local useState only |

See full admin app skill file: `.agents/skills/admin-app-skills.md`

## Security Notes
- Firebase API keys in `app.json` are client-side keys — Firestore rules are the actual security layer.
- The `.env` file holds any server-side secrets; never commit additional secrets to `app.json`.
- Firestore rules use helper functions (`isAdmin()`, `isCommunityStaff()`, `isLeaderOrAbove()`) — extend these rather than inlining role checks.
