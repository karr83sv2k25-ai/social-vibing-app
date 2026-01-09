/**
 * Firebase Connection Diagnostic Tool
 * Run this to identify why data fetching is failing
 */

import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, query, limit } from 'firebase/firestore';
import { app } from './firebaseConfig';

const diagnoseConnection = async () => {
    console.log('\n==============================================');
    console.log('🔬 FIREBASE CONNECTION DIAGNOSTIC');
    console.log('==============================================\n');

    try {
        const auth = getAuth(app);
        const db = getFirestore(app);
        const currentUser = auth.currentUser;

        // Check 1: Firebase App Status
        console.log('✅ Step 1: Firebase App initialized');

        // Check 2: Auth Status
        console.log('\n📋 Step 2: Checking Authentication...');
        if (currentUser) {
            console.log('✅ User is authenticated');
            console.log('   User ID:', currentUser.uid);
            console.log('   Email:', currentUser.email || 'N/A');
        } else {
            console.log('❌ No user is authenticated');
            console.log('   ⚠️  Most Firestore rules require authentication');
            console.log('   💡 Solution: Log in first before testing data fetch');
            return;
        }

        // Check 3: Test user document read
        console.log('\n📋 Step 3: Testing User Document Read...');
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await Promise.race([
                getDoc(userRef),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
                )
            ]);

            if (userSnap.exists()) {
                console.log('✅ User document read successfully');
                const userData = userSnap.data();
                console.log('   Name:', userData.firstName, userData.lastName);
                console.log('   Username:', userData.username || 'N/A');
            } else {
                console.log('⚠️  User document exists but is empty');
                console.log('   💡 You may need to create user profile data');
            }
        } catch (error) {
            console.log('❌ Failed to read user document');
            console.log('   Error:', error.message);
            if (error.code === 'permission-denied') {
                console.log('   💡 Firestore rules are blocking access to users collection');
                console.log('   💡 Check your firestore.rules file');
            } else if (error.message.includes('Timeout')) {
                console.log('   💡 Connection timeout - check internet connection');
            }
        }

        // Check 4: Test posts collection read
        console.log('\n📋 Step 4: Testing Posts Collection Read...');
        try {
            const postsRef = collection(db, 'posts');
            const postsQuery = query(postsRef, limit(5));

            const postsSnap = await Promise.race([
                getDocs(postsQuery),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
                )
            ]);

            console.log('✅ Posts collection read successfully');
            console.log('   Documents found:', postsSnap.docs.length);

            if (postsSnap.docs.length === 0) {
                console.log('   ⚠️  No posts found in database');
                console.log('   💡 Add some test posts in Firebase Console');
            } else {
                console.log('   Sample post IDs:', postsSnap.docs.slice(0, 3).map(d => d.id).join(', '));
            }
        } catch (error) {
            console.log('❌ Failed to read posts collection');
            console.log('   Error:', error.message);
            console.log('   Code:', error.code || 'N/A');

            if (error.code === 'permission-denied') {
                console.log('\n   🚨 PERMISSION DENIED - This is the issue!');
                console.log('   💡 Your Firestore rules are blocking read access');
                console.log('   💡 Fix: Go to Firebase Console → Firestore → Rules');
                console.log('   💡 Allow read access for authenticated users');
            } else if (error.message.includes('Timeout')) {
                console.log('\n   🚨 CONNECTION TIMEOUT - Cannot reach Firebase');
                console.log('   💡 Check internet connection');
                console.log('   💡 Try on different network (WiFi vs Mobile Data)');
                console.log('   💡 Check if Firebase is blocked by firewall/VPN');
            } else if (error.code === 'unavailable') {
                console.log('\n   🚨 SERVICE UNAVAILABLE');
                console.log('   💡 Firebase service might be down or unreachable');
                console.log('   💡 Check Firebase status at status.firebase.google.com');
            }
        }

        // Check 5: Test communities collection
        console.log('\n📋 Step 5: Testing Communities Collection Read...');
        try {
            const communitiesRef = collection(db, 'communities');
            const communitiesQuery = query(communitiesRef, limit(3));

            const communitiesSnap = await Promise.race([
                getDocs(communitiesQuery),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
                )
            ]);

            console.log('✅ Communities collection read successfully');
            console.log('   Communities found:', communitiesSnap.docs.length);
        } catch (error) {
            console.log('❌ Failed to read communities collection');
            console.log('   Error:', error.message);
        }

        // Summary
        console.log('\n==============================================');
        console.log('📊 DIAGNOSTIC SUMMARY');
        console.log('==============================================');
        console.log('If you see permission-denied errors:');
        console.log('  → Fix Firestore security rules');
        console.log('If you see timeout errors:');
        console.log('  → Check internet connection');
        console.log('  → Try different network');
        console.log('If collections are empty:');
        console.log('  → Add test data in Firebase Console');
        console.log('==============================================\n');

    } catch (error) {
        console.log('\n❌ FATAL ERROR:', error.message);
        console.log('Stack:', error.stack);
    }
};

// Auto-run on import (comment out if you want to call manually)
// diagnoseConnection();

export default diagnoseConnection;
