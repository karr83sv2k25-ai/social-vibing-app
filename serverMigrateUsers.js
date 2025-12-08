/**
 * Server-Side User Migration Script
 * 
 * This script uses Firebase Admin SDK to migrate all existing Firebase Auth users
 * to have complete Firestore user documents required by the mobile app.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Install dependencies: npm install firebase-admin
 * 2. Download your Firebase service account key from Firebase Console:
 *    Project Settings > Service Accounts > Generate New Private Key
 * 3. Save it as 'serviceAccountKey.json' in the same directory as this script
 * 4. Run: node serverMigrateUsers.js
 * 
 * IMPORTANT: This script should be run on a secure server, NOT in the mobile app!
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

// Required fields for mobile app users
const REQUIRED_USER_FIELDS = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  profileImage: '',
  phoneNumber: '',
  bio: '',
  followers: 0,
  following: 0,
  friends: 0,
  visits: 0,
  characterCollection: [],
  interests: [],
  createdAt: '',
  lastLogin: '',
};

/**
 * Migrates a single user
 */
async function migrateUser(userRecord) {
  try {
    const userId = userRecord.uid;
    const userEmail = userRecord.email;
    const displayName = userRecord.displayName;
    const photoURL = userRecord.photoURL;
    const creationTime = userRecord.metadata.creationTime;
    
    console.log(`Migrating user: ${userEmail} (${userId})`);
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      // Create complete user document
      const userData = {
        email: userEmail || '',
        displayName: displayName || userEmail?.split('@')[0] || 'User',
        firstName: displayName?.split(' ')[0] || userEmail?.split('@')[0] || 'User',
        lastName: displayName?.split(' ')[1] || '',
        username: userEmail?.split('@')[0] || userId.substring(0, 8),
        profileImage: photoURL || '',
        phoneNumber: userRecord.phoneNumber || '',
        bio: '',
        followers: 0,
        following: 0,
        friends: 0,
        visits: 0,
        characterCollection: [],
        interests: [],
        createdAt: creationTime || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        migratedFromWeb: true,
        migrationDate: new Date().toISOString(),
      };
      
      await userRef.set(userData);
      console.log(`✅ Created user document for: ${userEmail}`);
      return { success: true, action: 'created', email: userEmail };
    } else {
      // Update missing fields - PRESERVE ALL EXISTING WEBSITE DATA
      const userData = userDoc.data();
      const updates = {};
      
      // Check each required field - only add if truly missing (undefined/null/empty)
      // CRITICAL: Never overwrite existing data from website
      if (userData.firstName === undefined || userData.firstName === null || userData.firstName === '') {
        updates.firstName = displayName?.split(' ')[0] || userEmail?.split('@')[0] || 'User';
      }
      if (userData.lastName === undefined || userData.lastName === null || userData.lastName === '') {
        updates.lastName = displayName?.split(' ')[1] || '';
      }
      if (userData.username === undefined || userData.username === null || userData.username === '') {
        updates.username = userEmail?.split('@')[0] || userId.substring(0, 8);
      }
      if (userData.email === undefined || userData.email === null) {
        updates.email = userEmail || '';
      }
      if (userData.displayName === undefined || userData.displayName === null) {
        updates.displayName = displayName || userEmail?.split('@')[0] || 'User';
      }
      if (userData.profileImage === undefined || userData.profileImage === null) {
        updates.profileImage = photoURL || '';
      }
      if (userData.phoneNumber === undefined || userData.phoneNumber === null) {
        updates.phoneNumber = userRecord.phoneNumber || '';
      }
      if (userData.bio === undefined || userData.bio === null) {
        updates.bio = '';
      }
      if (userData.followers === undefined || userData.followers === null) {
        updates.followers = 0;
      }
      if (userData.following === undefined || userData.following === null) {
        updates.following = 0;
      }
      if (userData.friends === undefined || userData.friends === null) {
        updates.friends = 0;
      }
      if (userData.visits === undefined || userData.visits === null) {
        updates.visits = 0;
      }
      if (userData.characterCollection === undefined || userData.characterCollection === null) {
        updates.characterCollection = [];
      }
      if (userData.interests === undefined || userData.interests === null) {
        updates.interests = [];
      }
      if (userData.createdAt === undefined || userData.createdAt === null) {
        updates.createdAt = creationTime || new Date().toISOString();
      }
      if (userData.migratedFromWeb === undefined || userData.migratedFromWeb === null) {
        updates.migratedFromWeb = true;
      }
      if (userData.migrationDate === undefined || userData.migrationDate === null) {
        updates.migrationDate = new Date().toISOString();
      }
      
      updates.lastLogin = new Date().toISOString();
      
      if (Object.keys(updates).length > 1) { // More than just lastLogin
        await userRef.update(updates);
        console.log(`✅ Updated user document for: ${userEmail} (${Object.keys(updates).length} fields) - existing data preserved`);
        return { success: true, action: 'updated', email: userEmail, fieldsUpdated: Object.keys(updates).length };
      } else {
        console.log(`✅ User document already complete for: ${userEmail}`);
        return { success: true, action: 'no_changes', email: userEmail };
      }
    }
  } catch (error) {
    console.error(`❌ Error migrating user ${userRecord.email}:`, error.message);
    return { success: false, error: error.message, email: userRecord.email };
  }
}

/**
 * Main migration function
 */
async function migrateAllUsers() {
  console.log('🚀 Starting user migration...\n');
  
  const results = {
    total: 0,
    created: 0,
    updated: 0,
    noChanges: 0,
    errors: 0,
    errorDetails: [],
  };
  
  try {
    // List all users
    let nextPageToken;
    
    do {
      // List batch of users, 1000 at a time
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      
      console.log(`Processing ${listUsersResult.users.length} users...`);
      
      // Migrate each user
      for (const userRecord of listUsersResult.users) {
        results.total++;
        const result = await migrateUser(userRecord);
        
        if (result.success) {
          if (result.action === 'created') results.created++;
          else if (result.action === 'updated') results.updated++;
          else results.noChanges++;
        } else {
          results.errors++;
          results.errorDetails.push({
            email: result.email,
            error: result.error,
          });
        }
        
        // Add small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users processed: ${results.total}`);
    console.log(`✅ Created: ${results.created}`);
    console.log(`✅ Updated: ${results.updated}`);
    console.log(`✅ No changes needed: ${results.noChanges}`);
    console.log(`❌ Errors: ${results.errors}`);
    
    if (results.errorDetails.length > 0) {
      console.log('\n❌ Error Details:');
      results.errorDetails.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.email}: ${err.error}`);
      });
    }
    
    console.log('='.repeat(60) + '\n');
    
    return results;
  } catch (error) {
    console.error('❌ Fatal migration error:', error);
    throw error;
  }
}

// Run the migration
console.log('Firebase User Migration Script');
console.log('==============================\n');

migrateAllUsers()
  .then((results) => {
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
