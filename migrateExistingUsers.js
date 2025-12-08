/**
 * Migration Script for Existing Website Users to Mobile App
 * 
 * This script helps migrate users who were created on the website
 * but don't have complete Firestore user documents required by the mobile app.
 * 
 * Run this script to create/update user documents for all authenticated users.
 */

import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { app, db } from './firebaseConfig';

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
 * Migrates a single user by creating or updating their Firestore document
 */
export async function migrateUser(userId, userEmail, displayName = null, photoURL = null, creationTime = null) {
  try {
    console.log(`Migrating user: ${userEmail} (${userId})`);
    
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // Create complete user document
      const userData = {
        email: userEmail,
        displayName: displayName || userEmail.split('@')[0],
        firstName: displayName?.split(' ')[0] || userEmail.split('@')[0],
        lastName: displayName?.split(' ')[1] || '',
        username: userEmail.split('@')[0],
        profileImage: photoURL || '',
        phoneNumber: '',
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
      
      await setDoc(userRef, userData);
      console.log(`✅ Created user document for: ${userEmail}`);
      return { success: true, action: 'created' };
    } else {
      // Update missing fields - PRESERVE ALL EXISTING DATA
      const userData = userSnap.data();
      const updates = {};
      
      // Check each required field - only add if truly missing (undefined/null)
      // NEVER overwrite existing data from website
      if (userData.firstName === undefined || userData.firstName === null || userData.firstName === '') {
        updates.firstName = displayName?.split(' ')[0] || userEmail.split('@')[0];
      }
      if (userData.lastName === undefined || userData.lastName === null || userData.lastName === '') {
        updates.lastName = displayName?.split(' ')[1] || '';
      }
      if (userData.username === undefined || userData.username === null || userData.username === '') {
        updates.username = userEmail.split('@')[0];
      }
      if (userData.email === undefined || userData.email === null) {
        updates.email = userEmail;
      }
      if (userData.displayName === undefined || userData.displayName === null) {
        updates.displayName = displayName || userEmail.split('@')[0];
      }
      if (userData.profileImage === undefined || userData.profileImage === null) {
        updates.profileImage = photoURL || '';
      }
      if (userData.phoneNumber === undefined || userData.phoneNumber === null) {
        updates.phoneNumber = '';
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
      if (userData.migratedFromWeb === undefined || userData.migratedFromWeb === null) {
        updates.migratedFromWeb = true;
      }
      if (userData.migrationDate === undefined || userData.migrationDate === null) {
        updates.migrationDate = new Date().toISOString();
      }
      
      updates.lastLogin = new Date().toISOString();
      
      if (Object.keys(updates).length > 1) { // More than just lastLogin
        await updateDoc(userRef, updates);
        console.log(`✅ Updated user document for: ${userEmail} (${Object.keys(updates).length} fields) - existing data preserved`);
        return { success: true, action: 'updated', fieldsUpdated: Object.keys(updates) };
      } else {
        console.log(`✅ User document already complete for: ${userEmail}`);
        return { success: true, action: 'no_changes' };
      }
    }
  } catch (error) {
    console.error(`❌ Error migrating user ${userEmail}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Main migration function - call this to migrate all users
 * Note: This requires admin access to list all users
 */
export async function migrateAllUsers() {
  console.log('🚀 Starting user migration...');
  
  try {
    // Note: Listing all Firebase Auth users requires Admin SDK
    // This is a client-side approach that migrates users as they log in
    console.log('ℹ️  This migration runs automatically when users log in.');
    console.log('ℹ️  To migrate all users at once, use the Firebase Admin SDK on the backend.');
    
    // You can manually add user IDs here if you know them
    const knownUserIds = [
      // Add user IDs here if you want to migrate specific users
      // { uid: 'user-id-1', email: 'user1@example.com' },
    ];
    
    const results = {
      total: knownUserIds.length,
      created: 0,
      updated: 0,
      noChanges: 0,
      errors: 0,
    };
    
    for (const user of knownUserIds) {
      const result = await migrateUser(user.uid, user.email);
      
      if (result.success) {
        if (result.action === 'created') results.created++;
        else if (result.action === 'updated') results.updated++;
        else results.noChanges++;
      } else {
        results.errors++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`Total users processed: ${results.total}`);
    console.log(`Created: ${results.created}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`No changes needed: ${results.noChanges}`);
    console.log(`Errors: ${results.errors}`);
    
    return results;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Test function to verify a specific user's document
 */
export async function verifyUserDocument(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.log(`❌ User document does not exist for: ${userId}`);
      return { exists: false };
    }
    
    const userData = userSnap.data();
    const missingFields = [];
    
    for (const field of Object.keys(REQUIRED_USER_FIELDS)) {
      if (userData[field] === undefined || userData[field] === null) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      console.log(`⚠️  User document exists but missing fields:`, missingFields);
      return { exists: true, complete: false, missingFields };
    }
    
    console.log(`✅ User document is complete for: ${userId}`);
    return { exists: true, complete: true, userData };
  } catch (error) {
    console.error(`❌ Error verifying user ${userId}:`, error);
    return { exists: false, error: error.message };
  }
}

// Export for use in the app
export default {
  migrateUser,
  migrateAllUsers,
  verifyUserDocument,
};
