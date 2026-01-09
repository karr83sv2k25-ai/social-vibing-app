/**
 * Firebase REST API Test
 * This tests if we can reach Firebase using REST API instead of SDK
 * Helps identify if it's an SDK/long-polling issue or network issue
 */

const testFirebaseREST = async () => {
    console.log('🧪 Testing Firebase REST API...\n');

    const projectId = 'social-vibing-karr';
    const collectionName = 'posts';
    const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?pageSize=1`;

    try {
        console.log('📡 Attempting REST API call...');
        console.log('URL:', restUrl);

        const response = await fetch(restUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log('📊 Response status:', response.status, response.statusText);

        if (response.ok) {
            const data = await response.json();
            const docCount = data.documents ? data.documents.length : 0;

            console.log('✅ REST API works!');
            console.log('📄 Found', docCount, 'document(s)');

            if (docCount > 0) {
                console.log('📝 Sample document:', data.documents[0].name);
                console.log('\n💡 This means:');
                console.log('   ✓ Network is working');
                console.log('   ✓ Firebase project exists');
                console.log('   ✓ Firestore has data');
                console.log('   ✗ SDK long-polling might be the issue');
            } else {
                console.log('\n💡 This means:');
                console.log('   ✓ Network is working');
                console.log('   ✓ Firebase project exists');
                console.log('   ✗ Collections are empty (need to add data)');
            }
        } else {
            const errorText = await response.text();
            console.log('❌ REST API returned error:', errorText);

            if (response.status === 403) {
                console.log('\n💡 This means:');
                console.log('   ✗ Firestore rules are blocking access');
                console.log('   → Fix: Update rules in Firebase Console');
            } else if (response.status === 404) {
                console.log('\n💡 This means:');
                console.log('   ✗ Project or collection does not exist');
                console.log('   → Fix: Check project ID and create Firestore database');
            }
        }
    } catch (error) {
        console.error('❌ REST API call failed:', error.message);
        console.log('\n💡 This means:');
        console.log('   ✗ Network cannot reach Firebase at all');
        console.log('   → Possible causes:');
        console.log('     • No internet connection');
        console.log('     • Firewall blocking firebaseapis.com');
        console.log('     • DNS issues');
    }

    console.log('\n✅ REST API test complete\n');
};

// Auto-run
testFirebaseREST();

export default testFirebaseREST;
