import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { app } from './firebaseConfig';

const diagnoseFirestore = async () => {
    console.log('\n🔬 === FIRESTORE DIAGNOSTIC TEST ===\n');

    try {
        const auth = getAuth(app);
        const db = getFirestore(app);

        console.log('✅ Firebase app initialized');
        console.log('✅ Auth instance obtained');
        console.log('✅ Firestore instance obtained');
        console.log('👤 Current user:', auth.currentUser ? auth.currentUser.uid : 'No user');

        if (!auth.currentUser) {
            console.error('❌ No authenticated user. Please log in first.');
            return;
        }

        // Test 1: Try to read a single document with a short timeout
        console.log('\n📋 Test 1: Reading a single user document...');
        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await Promise.race([
                getDoc(userRef),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Test 1 timeout')), 5000))
            ]);

            if (userSnap.exists()) {
                console.log('✅ Test 1 PASSED: User document read successfully');
                console.log('   Data keys:', Object.keys(userSnap.data()).join(', '));
            } else {
                console.log('⚠️  Test 1: Document exists but has no data');
            }
        } catch (error) {
            console.error('❌ Test 1 FAILED:', error.message);
            console.error('   Error code:', error.code);
            console.error('   Full error:', JSON.stringify(error, null, 2));
        }

        // Test 2: Try to list documents in a collection
        console.log('\n📋 Test 2: Listing posts collection...');
        try {
            const postsRef = collection(db, 'posts');
            const snapshot = await Promise.race([
                getDocs(postsRef),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Test 2 timeout')), 5000))
            ]);

            console.log('✅ Test 2 PASSED: Posts collection read successfully');
            console.log('   Documents found:', snapshot.docs.length);
        } catch (error) {
            console.error('❌ Test 2 FAILED:', error.message);
            console.error('   Error code:', error.code);
            if (error.code === 'permission-denied') {
                console.error('   💡 This means Firestore rules are blocking access');
            } else if (error.message.includes('timeout')) {
                console.error('   💡 This means Firestore cannot be reached (network/config issue)');
            }
        }

        console.log('\n🔬 === DIAGNOSTIC TEST COMPLETE ===\n');
    } catch (error) {
        console.error('❌ Fatal error during diagnostic:', error);
    }
};

diagnoseFirestore();

export default diagnoseFirestore;
