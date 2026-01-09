# AGE VERIFICATION & ADMIN MODERATION SYSTEM

## Overview
Social Vibing is a **17+ adult-only platform** with comprehensive age verification and admin moderation features to ensure community safety and compliance.

---

## 🔞 AGE VERIFICATION FEATURES

### User Side

#### 1. **Age Verification Flow**
- **Location**: [ageverification.js](ageverification.js)
- Users must confirm they are 17+ before entering the platform
- Required fields:
  - Date of Birth (YYYY-MM-DD format)
  - Verification Document (ID Card, Passport, or Driver's License)
  - Document Type Selection
  - Terms Acceptance Checkbox

#### 2. **Verification Status**
Users can have one of the following statuses:
- **Not Verified**: No verification submitted
- **Pending**: Verification submitted, awaiting admin review
- **Verified**: Admin approved ✓
- **Rejected**: Admin rejected the verification
- **Revoked**: Previously verified but admin revoked

#### 3. **Profile Display**
- **Location**: [editprofile.js](editprofile.js)
- Verified users get a shield badge (🛡️) next to their name
- Status banner shows:
  - ⏱️ "Verification Pending" (Yellow)
  - ❌ "Verification Rejected" (Red)
  - ✅ "Verified 17+" (Cyan)
  - 🛡️ "Verify Account" button (if not verified)

#### 4. **Data Collected**
```javascript
{
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'revoked',
  verificationDocument: 'url-to-uploaded-document',
  documentType: 'ID Card' | 'Passport' | 'Driver License',
  dateOfBirth: 'YYYY-MM-DD',
  age: number,
  isVerified: boolean,
  verificationSubmittedAt: timestamp,
  verifiedAt: timestamp,
  verifiedBy: 'admin-uid'
}
```

---

## 👮 ADMIN MODERATION PANEL

### Access
- **Screen**: [AdminModerationScreen.js](AdminModerationScreen.js)
- **Route**: Navigate to `AdminModeration` screen
- **Requirements**: User must have `role: 'admin'` or `isAdmin: true`

### Features

#### 1. **Pending Verifications Tab**
- View all users awaiting verification
- See verification documents uploaded by users
- User information displayed:
  - Profile picture
  - Full name and username
  - Age and Date of Birth
  - Document type
  - Submission date

#### 2. **All Users Tab**
- Browse all registered users
- See verification status at a glance
- Filter and search functionality
- View banned users

#### 3. **User Detail Modal**
Actions available when clicking on a user:

##### **Verification Actions**
- ✅ **Approve Verification**: Grant verified status
- ❌ **Reject Verification**: Deny verification request
- 🔄 **Revoke Verification**: Remove verified status from user

##### **Moderation Actions**
- 🚫 **Ban User**: Permanently ban user from platform
  - Adds ban reason
  - Timestamps ban action
  - Tracks who banned them
- 🔓 **Unban User**: Remove ban from user
- ⚠️ **Send Warning**: Issue warning to user
  - Stores warning message
  - Tracks warning history

---

## 🔒 FIRESTORE SECURITY RULES

### Admin Privileges
```javascript
function isAdmin() {
  return isSignedIn() && 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

### Admin-Only Fields
Admins can update these fields:
- `isVerified`, `verificationStatus`, `verifiedAt`, `verifiedBy`
- `isBanned`, `banReason`, `bannedAt`, `bannedBy`
- `unbannedAt`, `unbannedBy`
- `warnings`, `lastWarning`, `warnedAt`, `warnedBy`
- `revokedAt`, `revokedBy`

---

## 📝 SETUP INSTRUCTIONS

### 1. Make First User Admin

#### Option A: Using Firebase Console
1. Go to Firebase Console → Firestore Database
2. Find your user document in `users` collection
3. Add fields:
   ```
   role: "admin"
   isAdmin: true
   ```

#### Option B: Using Script (Recommended)
1. Download service account key from Firebase Console:
   - Project Settings → Service Accounts → Generate New Private Key
2. Save as `serviceAccountKey.json` in project root
3. Run:
   ```bash
   npm install firebase-admin
   node makeAdmin.js your-email@example.com
   ```

### 2. Navigation Setup

Add admin panel button to your settings or profile screen:

```javascript
<TouchableOpacity 
  onPress={() => navigation.navigate('AdminModeration')}
  style={styles.adminButton}>
  <Ionicons name="shield-checkmark" size={20} color="#08FFE2" />
  <Text style={styles.adminText}>Admin Panel</Text>
</TouchableOpacity>
```

Only show to admins:
```javascript
{userData?.isAdmin && (
  <TouchableOpacity onPress={() => navigation.navigate('AdminModeration')}>
    <Text>Admin Moderation</Text>
  </TouchableOpacity>
)}
```

### 3. Required Packages

Ensure these packages are installed:
```bash
npm install expo-image-picker expo-document-picker
npm install firebase-admin  # For makeAdmin.js script only
```

---

## 🎨 UI/UX FEATURES

### Verification Screen
- Two-step process:
  1. Age confirmation and terms acceptance
  2. Document upload form
- Document type selector (ID Card, Passport, Driver License)
- Date of birth input with format hint
- Image preview after upload
- Privacy note about encryption

### Profile Verification Badge
- Verified users: Cyan shield badge (🛡️)
- Status banners with appropriate colors:
  - Pending: Yellow (#FFD700)
  - Rejected: Red (#FF3232)
  - Verified: Cyan (#08FFE2)

### Admin Panel
- Clean, dark-themed interface matching app design
- Tab navigation (Verifications / All Users)
- Search functionality
- Badge indicators for pending count
- Modal for detailed user view
- Color-coded action buttons

---

## 🔐 SECURITY CONSIDERATIONS

### Document Storage
- Documents uploaded via [hostingerConfig.js](hostingerConfig.js)
- Stored securely with unique filenames
- Only accessible by admins
- Encryption at rest

### Admin Verification
- Admin status checked on every panel load
- Firestore rules enforce admin-only updates
- All moderation actions logged with:
  - Timestamp
  - Admin UID who performed action
  - Action type

### User Privacy
- DOB and age stored separately
- Documents only visible to admins
- Verification status is public (to show verified badge)

---

## 📊 DATABASE SCHEMA

### User Document
```javascript
{
  // Basic Info
  firstName: string,
  lastName: string,
  username: string,
  email: string,
  profileImage: string,
  createdAt: timestamp,
  
  // Verification
  isVerified: boolean,
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'revoked',
  verificationDocument: string (url),
  documentType: string,
  dateOfBirth: string,
  age: number,
  verificationSubmittedAt: timestamp,
  verifiedAt: timestamp,
  verifiedBy: string (admin uid),
  revokedAt: timestamp,
  revokedBy: string (admin uid),
  
  // Moderation
  isBanned: boolean,
  banReason: string,
  bannedAt: timestamp,
  bannedBy: string (admin uid),
  unbannedAt: timestamp,
  unbannedBy: string (admin uid),
  warnings: timestamp,
  lastWarning: string,
  warnedAt: timestamp,
  warnedBy: string (admin uid),
  
  // Admin
  role: 'user' | 'admin',
  isAdmin: boolean,
  adminSince: timestamp
}
```

---

## 🚀 USAGE GUIDE

### For Users
1. **Create Account** → Fill basic info
2. **Age Verification Screen** → Accept terms (17+)
3. **Upload Verification** → Choose document type, enter DOB, upload photo
4. **Wait for Approval** → Admin will review within 24-48 hours
5. **Get Verified Badge** → Shield icon appears on profile

### For Admins
1. **Access Admin Panel** → Navigate to AdminModeration screen
2. **Review Verifications** → Check Verifications tab
3. **Click User** → View full details and document
4. **Take Action**:
   - Approve → User gets verified badge
   - Reject → User can resubmit
   - Ban → User cannot access platform
   - Warn → User receives warning message

---

## 🎯 KEY DIFFERENTIATORS

This platform stands out because:
- ✅ **Mandatory Age Verification**: Unlike most platforms, verification is required
- ✅ **17+ Enforcement**: Clear age restrictions with document proof
- ✅ **Adult-Focused**: Designed specifically for mature audiences
- ✅ **Admin Control**: Full moderation tools for community safety
- ✅ **Transparent Process**: Users know their verification status at all times

---

## 📞 SUPPORT

### Common Issues

**Q: User can't upload document**
- Check image picker permissions
- Ensure hostinger upload config is correct
- Verify Firebase storage rules

**Q: Admin panel shows "Access Denied"**
- Verify user has `role: 'admin'` in Firestore
- Check Firestore security rules are deployed
- Clear app cache and reload

**Q: Verification button not showing**
- Check navigation is properly configured
- Ensure AdminModerationScreen is imported in App.js
- Verify user is authenticated

---

## 📄 FILES MODIFIED/CREATED

1. **[ageverification.js](ageverification.js)** - Enhanced with verification form
2. **[editprofile.js](editprofile.js)** - Added verification badges and status
3. **[AdminModerationScreen.js](AdminModerationScreen.js)** - New admin panel (NEW)
4. **[firestore.rules](firestore.rules)** - Updated security rules
5. **[App.js](App.js)** - Added AdminModeration route
6. **[makeAdmin.js](makeAdmin.js)** - Admin utility script (NEW)
7. **[AGE_VERIFICATION_GUIDE.md](AGE_VERIFICATION_GUIDE.md)** - This file (NEW)

---

## ✅ TESTING CHECKLIST

- [ ] User can submit verification with document
- [ ] Verification shows as "pending" in profile
- [ ] Admin can access moderation panel
- [ ] Admin can view pending verifications
- [ ] Admin can approve verification
- [ ] Verified badge appears on profile
- [ ] Admin can reject verification
- [ ] Admin can revoke verification
- [ ] Admin can ban user
- [ ] Admin can unban user
- [ ] Admin can send warnings
- [ ] Banned users cannot perform actions
- [ ] Firestore rules prevent unauthorized updates

---

**Platform**: Social Vibing - The 17+ Adult Community Platform
**Version**: 1.0
**Last Updated**: January 2026
