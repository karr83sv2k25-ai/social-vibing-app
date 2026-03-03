---
name: social-vibing-admin
description: "React Native (Expo) admin panel for the Social Vibing platform. Firebase/Firestore backend, Cloudinary media uploads, dark-themed UI. Manages communities, users, reports, verification, bans, content moderation, advertisements, and permissions. Key stacks: Expo SDK 54, React Native 0.81, Firebase 12, React Navigation (Drawer + Bottom Tabs + Native Stack), Cloudinary, react-native-paper. Screens: AdminPortal, VerifyUsers, ReportsDashboard, ReportDetail, CommunityMembers, BlockedContent, BlockedMembers, JoinRequests, ManageCoAdmins, TransferAdmin, Advertisements, Appearance, Permissions, DataCenter, CommunityRooms, CommunityFolders, CommunityTitles, CoverImage, CreateCommunity, ManagementRecords, HomeLayout, ColorPicker."
---

# Social Vibing Admin Panel — Project Skill File

Complete reference for AI agents working on the **social-vibing-admin** React Native (Expo) project. This admin app manages the Social Vibing social platform — communities, users, reports, moderation, and content.

---

## 1. Project Overview

| Field | Value |
|-------|-------|
| **Name** | `social-vibing-admin` |
| **Type** | React Native mobile/web admin panel |
| **Framework** | Expo SDK 54 (`expo ~54.0.30`) |
| **React Native** | 0.81.5 |
| **React** | 19.1.0 |
| **Backend** | Firebase (Firestore, Auth) |
| **Media** | Cloudinary (unsigned uploads) |
| **Language** | JavaScript (no TypeScript) |
| **Entry Point** | `index.js` → `App.js` |
| **Package Manager** | npm |
| **Platforms** | Android, iOS, Web |

### What This App Does
- Authenticates admins via Firebase Auth (email/password) with Firestore role check (`role === 'admin'` or `isAdmin === true`)
- Manages communities: CRUD, members, rooms, folders, titles, co-admins, appearance, permissions
- Manages users: verification (approve/reject), banning, suspending, warnings
- Reports system: dashboard with filters, real-time updates, admin actions (warn, ban, suspend, dismiss)
- Content moderation: block content, delete posts/comments/stories/products
- Advertisements management
- Data center / analytics view

---

## 2. Architecture & Directory Structure

```
social-vibing-admin/
├── App.js                    # Root: Auth gate (login screen) + Drawer navigator
├── index.js                  # Expo entry point
├── app.config.js             # Expo config, loads .env → expo.extra
├── firebaseConfig.js         # Firebase init (Auth with AsyncStorage persistence, Firestore, Analytics)
├── cloudinary.js             # Cloudinary unsigned image upload helper
├── firestore.rules           # Complete Firestore security rules (700+ lines)
│
├── components/
│   ├── Theme.js              # Color constants (C object): dark theme palette
│   ├── ListRow.js            # Reusable list row component
│   ├── PillButton.js         # Pill-shaped button component
│   └── SectionHeader.js      # Section header component
│
├── navigation/
│   ├── DrawerSidebar.js      # Drawer menu: Home, Messages, Favourites, Admin sections, Logout
│   └── StackScreens.js       # Bottom tabs (Home/Messages/Favourites) + all stack screens
│
├── screens/                  # All screen components (see §4 for details)
│   ├── AdminPortalScreen.js  # Community management hub (list, delete, navigate to sub-screens)
│   ├── ReportsDashboardScreen.js  # Reports list with filters, stats, real-time updates
│   ├── ReportDetailScreen.js      # Single report view with admin actions
│   ├── VerifyUsersScreen.js       # User verification: approve/reject/ban
│   ├── ... (25+ screens)
│
├── services/
│   └── reportService.js      # Firestore report CRUD, subscriptions, admin actions, ban/warn logic
│
├── scripts/
│   ├── setAdmin.js           # CLI script: set user as admin in Firestore
│   └── checkAdminRole.js     # CLI script: check user's admin status
│
├── styles/
│   └── styles.js             # Shared StyleSheet (s object) used across all screens
│
├── data/
│   └── mock.js               # Mock data for development/demos
│
└── assets/                   # Static assets (images, fonts)
```

---

## 3. Key Configuration & Environment

### Environment Variables (`.env` → `app.config.js` → `expo.extra`)

```
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=social-vibing-karr
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_MEASUREMENT_ID=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_UPLOAD_PRESET=...
CLOUDINARY_API_KEY=...
```

### Firebase Project
- **Project ID**: `social-vibing-karr`
- **Auth**: Email/password sign-in
- **Firestore**: Primary database (see §6 for collections)
- **Admin check**: `users/{uid}.role === 'admin'` OR `users/{uid}.isAdmin === true`

### Theme Constants (`components/Theme.js`)

```javascript
export const C = {
  bg: "#0B0B10",        // Deep dark background
  card: "#14171C",      // Card background
  card2: "#1A1F26",     // Secondary card
  border: "#1C1F26",    // Border color
  text: "#EAEAF0",      // Primary text
  dim: "#A2A8B3",       // Dimmed text
  accent: "#36E3C0",    // Teal accent
  // + gradient arrays for purple, orange, green, red, blue, pink, mixed
};
```

### Shared Styles (`styles/styles.js`)
All screens import `import { s } from "../styles/styles"` for consistent styling. Key style names: `center`, `h1`, `dim`, `header`, `headerTitle`, `communityCard`, `menuRow`, `menuText`, `label`, `input`, `cardBox`, `badge`, `modalBackdrop`, `modalCard`, `drawerItem`, `grid2`, `statCard`.

---

## 4. Navigation Structure

```
App.js (Auth Gate)
└── DrawerNavigator
    └── "Stack" (StackScreens.js)
        ├── MainTabs (BottomTabNavigator)
        │   ├── Home → HomeScreen
        │   ├── Messages → MessageScreen
        │   └── Favourites → FavouritesScreen
        │
        ├── AdminPortal → AdminPortalScreen
        ├── VerifyUsers → VerifyUsersScreen
        ├── DataCenter → DataCenterScreen
        ├── PermissionsPrivacy → PermissionsPrivacyScreen
        ├── Appearance → AppearanceScreen
        ├── ColorPicker → ColorPickerScreen
        ├── CommunityInfoDetail → CommunityInfoDetailScreen
        ├── HomeLayout → HomeLayoutScreen
        ├── CommunityFolders → CommunityFoldersScreen
        ├── CommunityRooms → CommunityRoomsScreen
        ├── Room → PublicRoomDetailScreen
        ├── CommunityTitles → CommunityTitlesScreen
        ├── ManageCoAdmins → ManageCoAdminsScreen
        ├── CreateCommunity → CreateCommunityScreen
        ├── Advertisement → AdvertisementScreen
        ├── CommunityMembers → CommunityMembersScreen
        ├── CoverImage → CoverImageScreen
        ├── BlockedContent → BlockedContentScreen
        ├── JoinRequests → JoinRequestsScreen
        ├── BlockedMembers → BlockedMembersScreen
        ├── TransferAdmin → TransferAdminScreen
        ├── ManagementRecords → ManagementRecordsScreen
        ├── ReportsDashboard → ReportsDashboardScreen
        └── ReportDetail → ReportDetailScreen
```

**Navigation pattern**: `navigation.navigate("Stack", { screen: "ScreenName" })` from drawer, or `navigation.navigate("ScreenName")` from stack screens.

---

## 5. Core Services & Patterns

### Authentication Flow (`App.js`)
1. `onAuthStateChanged` listener checks if user is logged in
2. If logged in → fetch `users/{uid}` from Firestore
3. Check `role === 'admin'` or `isAdmin === true`
4. If not admin → sign out + show "Access Denied"
5. If admin → show main app (Drawer + Stack navigation)

### Report Service (`services/reportService.js`)
Central service for the report/moderation system:

```javascript
// Exported constants
REPORT_STATUS: { PENDING, UNDER_REVIEW, RESOLVED, DISMISSED, ACTION_TAKEN }
REPORT_PRIORITY: { HIGH, MEDIUM, LOW }
REPORT_TYPES: { USER, POST, COMMENT, MESSAGE, COMMUNITY, PRODUCT, STORY }
ADMIN_ACTIONS: { WARNING, TEMPORARY_BAN, PERMANENT_BAN, ACCOUNT_SUSPENDED, CONTENT_REMOVED, NO_VIOLATION, DISMISSED }

// Key functions
getReports({ status, priority, reportType })  // Query reports with filters
getReportStats()                                // Get status/priority counts
subscribeToReports(filters, callback)           // Real-time listener
updateReportStatus(reportId, status, adminId)   // Change report status
takeAdminAction(reportId, action, details)      // Execute ban/warn/dismiss
```

### Cloudinary Helper (`cloudinary.js`)
- Unsigned image upload to Cloudinary
- Cross-platform (web Blob vs RN file object)
- Optional Firestore logging of uploaded images
- Config comes from `expo.extra` env vars

### Firestore Access Pattern
All screens directly import Firestore and query collections:
```javascript
import { firebaseApp } from "../firebaseConfig";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
const db = getFirestore(firebaseApp);
```

---

## 6. Firestore Collections

### Primary Collections
| Collection | Purpose | Admin Access |
|------------|---------|-------------|
| `users/{uid}` | User profiles, roles, verification, ban status | Read all, update moderation fields |
| `communities/{id}` | Community data, members, settings | Full CRUD via moderator/creator check |
| `communities/{id}/posts/{id}` | Community posts | Admin can delete |
| `communities/{id}/posts/{id}/comments/{id}` | Post comments | Admin can delete |
| `communities/{id}/blogs/{id}` | Community blogs | Admin can delete |
| `reports/{id}` | User reports (moderation queue) | Full CRUD |
| `admin_actions/{id}` | Immutable admin action log | Read + create only |
| `products/{id}` | Marketplace products | Admin can soft-delete/hard-delete |
| `posts/{id}` | Global posts (public read) | Admin can soft-delete/hard-delete |
| `stories/{id}` | User stories | Admin can delete |
| `comments/{id}` | Top-level comments | Admin can delete |
| `messages/{id}` | Top-level messages | Admin can delete |
| `advertisements/{id}` | Ad management | Full CRUD |
| `blocked_content/{id}` | Blocked content records | Full CRUD |
| `blocked_members/{id}` | Blocked member records | Full CRUD |
| `join_requests/{id}` | Community join requests | Full CRUD |
| `management_records/{id}` | Management audit records | Full CRUD |

### Report Document Schema
```javascript
{
  reporterId, reporterUsername,      // Who filed the report
  reportedId, reportedUsername,      // Who was reported
  reportType,                        // 'user'|'post'|'comment'|'message'|'community'|'product'|'story'
  reason, reasonLabel, reasonCategory, // Report classification
  description, evidence,             // Details + optional evidence URLs
  contentId, contentType, contentPreview, // Referenced content
  status,                            // 'pending'|'under_review'|'resolved'|'dismissed'|'action_taken'
  priority,                          // 'high'|'medium'|'low'
  reviewedBy, reviewedAt,            // Admin review tracking
  actionTaken, actionDetails,        // What admin did
  adminNotes, isResolved,            // Internal notes + resolution flag
  createdAt, updatedAt               // Timestamps
}
```

### User Document — Admin-Relevant Fields
```javascript
{
  role: 'admin',                     // Admin role flag
  isAdmin: true,                     // Alternative admin flag
  isVerified: boolean,               // Age verification (17+)
  verificationStatus: 'pending'|'verified'|'rejected',
  isBanned: boolean,
  banType, banReason, bannedAt, banExpiresAt, bannedBy,
  isSuspended: boolean,
  suspendedReason, suspendedAt, suspendedBy,
  warnings: array, warningsCount: number,
  accountStatus: string,
  reportsReceived: number,
}
```

---

## 7. Firestore Security Rules Summary

The rules file (`firestore.rules`) uses helper functions:
- `isSignedIn()` — `request.auth != null`
- `isOwner(userId)` — `request.auth.uid == userId`
- `isAdmin()` — checks `users/{uid}.role == 'admin'`
- `isCommunityModerator(communityId)` — checks creator or moderators array
- `isVerified()` — checks `users/{uid}.isVerified == true`

**Admin-specific rules**:
- Admin can update user moderation fields (ban, verify, warn, suspend)
- Admin can delete posts, comments, stories, messages, products
- Admin can soft-delete products/posts via `isDeleted` field
- Admin can disable communities
- Reports: admin has full CRUD; users can only create (validated) and read own
- Admin actions log: admin can read + create; immutable (no update/delete)

---

## 8. Development Commands

```bash
# Start dev server
npm start          # or: expo start

# Platform-specific
npm run android    # expo run:android
npm run ios        # expo run:ios
npm run web        # expo start --web

# Admin scripts
node scripts/setAdmin.js <userId>      # Grant admin role
node scripts/checkAdminRole.js <userId> # Check admin status
```

---

## 9. Dependencies Summary

### Core
- `expo ~54.0.30` — Managed workflow
- `react-native 0.81.5` + `react 19.1.0`
- `firebase ^12.5.0` — Auth, Firestore, Analytics (web only)

### Navigation
- `@react-navigation/native`, `drawer`, `bottom-tabs`, `native-stack`, `stack`
- `react-native-gesture-handler`, `react-native-reanimated`, `react-native-screens`

### UI
- `react-native-paper 4.9.2` — Material Design components
- `@expo/vector-icons` — Ionicons, MaterialIcons
- `expo-linear-gradient` — Gradient backgrounds

### Utilities
- `@react-native-async-storage/async-storage` — Auth persistence
- `expo-image-picker` — Image selection
- `dotenv` — Environment variable loading

---

## 10. Coding Conventions & Patterns

1. **File naming**: PascalCase for screens (`AdminPortalScreen.js`), camelCase for services/utils
2. **Exports**: Default exports for screens and components
3. **Styling**: All screens use `import { s } from "../styles/styles"` + `import { C } from "../components/Theme"` — dark theme, consistent palette
4. **Firebase access**: Direct Firestore SDK calls in screens (no abstraction layer except for reports)
5. **State management**: Local `useState` + `useEffect` — no global state library (no Redux/Zustand)
6. **Navigation**: Screen names are PascalCase strings matching the `Stack.Screen` name prop
7. **Error handling**: `try/catch` with `Alert.alert()` for user-facing errors, `console.error()` for logging
8. **Data fetching**: `getDocs`/`getDoc` for reads, `updateDoc`/`deleteDoc` for writes, `onSnapshot` for real-time
9. **Pull to refresh**: `RefreshControl` pattern used on scrollable screens
10. **No TypeScript**: All files are `.js`

---

## 11. Common Tasks for Agents

### Adding a new screen
1. Create `screens/NewScreen.js` with default export
2. Import in `navigation/StackScreens.js`
3. Add `<Stack.Screen name="NewScreen" component={NewScreen} />` 
4. Optionally add drawer item in `navigation/DrawerSidebar.js`

### Adding a new Firestore collection
1. Add security rules in `firestore.rules` (use `isAdmin()` helper for admin-only access)
2. Create/query in the relevant screen using Firestore SDK

### Modifying theme/colors
- Edit `components/Theme.js` (`C` object)
- All screens auto-pick up changes via `C.***` references

### Adding admin moderation actions
- Extend `services/reportService.js` (`ADMIN_ACTIONS`, action handler functions)
- Update `screens/ReportDetailScreen.js` for UI
- Add Firestore rules if new collection/fields are needed

### Working with environment variables
1. Add to `.env` file
2. Expose through `app.config.js` → `extra` block
3. Access via `Constants.expoConfig.extra.VARIABLE_NAME`
