/**
 * Firestore Connection Test Script
 * Run this to diagnose Firestore connectivity issues
 */

import { db } from './firebaseConfig';
import { collection, getDocs, query, limit } from 'firebase/firestore';

const testConnection = async () => {
    console.log('🔍 Starting Firestore connection test...\n');

    try {
        console.log('1️⃣ Testing connection to "posts" collection...');
        const startTime = Date.now();

        const postsQuery = query(collection(db, 'posts'), limit(1));
        const snapshot = await getDocs(postsQuery);

        const elapsed = Date.now() - startTime;

        if (snapshot.empty) {
            console.log(`⚠️ Connection successful but collection is empty (${elapsed}ms)`);
            console.log('💡 This means Firestore is working but you have no posts yet.');
        } else {
            console.log(`✅ Connection successful! Found ${snapshot.docs.length} post(s) (${elapsed}ms)`);
            console.log('📄 Sample post ID:', snapshot.docs[0].id);
        }
    } catch (error) {
        console.error('❌ Connection failed:', error.code, error.message);
        console.log('\n🔧 Troubleshooting steps:');

        if (error.code === 'permission-denied') {
            console.log('   ❌ PERMISSION DENIED - Check your Firestore security rules');
            console.log('   📝 Your rules should allow read access. Example:');
            console.log('      rules_version = "2";');
            console.log('      service cloud.firestore {');
            console.log('        match /databases/{database}/documents {');
            console.log('          match /posts/{postId} {');
            console.log('            allow read: if true;  // Allow public read');
            console.log('          }');
            console.log('        }');
            console.log('      }');
        } else if (error.code === 'unavailable' || error.message.includes('timeout')) {
            console.log('   ❌ NETWORK/TIMEOUT - Firestore is unreachable');
            console.log('   📱 Check:');
            console.log('      1. Internet connection');
            console.log('      2. Firewall/proxy settings');
            console.log('      3. If using emulator, is it running?');
            console.log('      4. Firebase project exists and is active');
        } else if (error.code === 'not-found') {
            console.log('   ❌ PROJECT NOT FOUND - Firebase project may not exist');
            console.log('   📝 Verify your Firebase config in app.json');
        } else {
            console.log('   ❌ Unknown error - See details above');
        }
    }

    console.log('\n✅ Test complete');
};

// Auto-run when imported
testConnection();

export default testConnection;
