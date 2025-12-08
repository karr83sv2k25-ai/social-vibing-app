# User Migration Guide - Website to Mobile App

## Problem
Existing users who were created on the website platform can authenticate with Firebase Auth, but they cannot use the mobile app because their Firestore user documents are missing or incomplete.

## Solution
This migration system creates/updates Firestore user documents with all required fields for mobile app compatibility.

## Automatic Migration (Recommended)

### How It Works
The mobile app's login screen (`accountloginscreen.js`) has been updated to **automatically migrate users** when they log in. This means:

1. ✅ User logs in with their existing email/password
2. ✅ App checks if their Firestore document exists
3. ✅ If missing: Creates complete user document with all required fields
4. ✅ If incomplete: Adds any missing required fields
5. ✅ User can immediately use the app

### Required Fields
The migration creates/updates these fields:
- `firstName`, `lastName`, `username`
- `email`, `profileImage`, `phoneNumber`
- `bio`
- `followers`, `following`, `friends`, `visits` (all set to 0)
- `characterCollection`, `interests` (empty arrays)
- `createdAt`, `lastLogin`
- `migratedFromWeb` (flag to track migrated users)

### Testing
Old users should now be able to:
1. Open the mobile app
2. Click "Login"
3. Enter their existing email and password
4. Login successfully ✅

## Manual Bulk Migration (Optional)

If you want to migrate all users at once before they log in, use the server-side script.

### Prerequisites
1. Node.js installed
2. Firebase Admin SDK access
3. Service account key from Firebase

### Setup Steps

1. **Install Firebase Admin SDK**
   ```bash
   npm install firebase-admin
   ```

2. **Get Service Account Key**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project
   - Go to Project Settings (⚙️) > Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file as `serviceAccountKey.json` in the project root

3. **Run Migration Script**
   ```bash
   node serverMigrateUsers.js
   ```

### What the Script Does
- Lists all Firebase Auth users
- For each user:
  - Checks if Firestore document exists
  - Creates document if missing
  - Updates document if incomplete
  - Adds migration tracking fields
- Provides detailed summary report

### Sample Output
```
🚀 Starting user migration...

Processing 100 users...
Migrating user: john@example.com (abc123)
✅ Created user document for: john@example.com
Migrating user: jane@example.com (def456)
✅ Updated user document for: jane@example.com (8 fields)

============================================================
📊 MIGRATION SUMMARY
============================================================
Total users processed: 100
✅ Created: 45
✅ Updated: 40
✅ No changes needed: 15
❌ Errors: 0
============================================================
```

## Verification

### Check Single User
Use the verification function in `migrateExistingUsers.js`:

```javascript
import { verifyUserDocument } from './migrateExistingUsers';

// Check if user document is complete
const result = await verifyUserDocument('user-id-here');
console.log(result);
```

### Check in Firebase Console
1. Go to Firestore Database
2. Navigate to `users` collection
3. Select a user document
4. Verify all required fields exist

## Migration Flags

Migrated users will have these additional fields:
- `migratedFromWeb: true` - Identifies users migrated from website
- `migrationDate` - ISO timestamp of when migration occurred

## Troubleshooting

### Users Still Can't Login
1. Check Firebase Console > Authentication - verify user exists
2. Check Firestore > users collection - verify document exists
3. Check app logs for specific error messages
4. Verify Firestore security rules allow authenticated users to read/write

### Firestore Rules
Ensure your `firestore.rules` allows authenticated users:
```
match /users/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == userId;
}
```

### Error Messages
- "No account found with this email" → User doesn't exist in Firebase Auth
- "Invalid email or password" → Wrong credentials
- "Network error" → Firebase connection issues
- Document creation works but app crashes → Check for missing fields in app code

## Next Steps

1. **Deploy Updated Login Screen** ✅ (Already done)
2. **Test with Old User Account**
   - Have an old user try logging in
   - Verify they can access the app
   - Check their profile displays correctly

3. **Optional: Run Bulk Migration**
   - If you have many old users
   - If you want to avoid delays during first login
   - Run `serverMigrateUsers.js`

4. **Monitor Migration**
   - Check Firebase logs
   - Monitor for login errors
   - Track `migratedFromWeb` flag in analytics

## Security Notes

⚠️ **IMPORTANT**: 
- `serverMigrateUsers.js` requires Admin SDK access
- **Never** commit `serviceAccountKey.json` to version control
- Add to `.gitignore`: `serviceAccountKey.json`
- Run server script in secure environment only
- Delete service account key after migration if not needed

## Support

If users still cannot login after migration:
1. Check error logs in app
2. Verify Firebase Auth account exists
3. Verify Firestore document created
4. Check all required fields present
5. Test with fresh user account

## Files Changed
- `accountloginscreen.js` - Added automatic migration on login
- `migrateExistingUsers.js` - Client-side migration utilities
- `serverMigrateUsers.js` - Server-side bulk migration script
- `USER_MIGRATION_README.md` - This documentation
