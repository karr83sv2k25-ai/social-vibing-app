// makeAdmin.js - Utility to grant admin privileges to a user
// Usage: node makeAdmin.js <user-email>

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // You'll need to download this from Firebase Console

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function makeUserAdmin(userEmail) {
  try {
    console.log(`🔍 Looking for user with email: ${userEmail}`);
    
    // Find user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', userEmail)
      .get();
    
    if (usersSnapshot.empty) {
      console.error('❌ No user found with that email');
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    console.log(`✅ Found user: ${userData.firstName} ${userData.lastName} (${userId})`);
    
    // Update user to admin
    await db.collection('users').doc(userId).update({
      role: 'admin',
      isAdmin: true,
      adminSince: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ User successfully granted admin privileges!');
    console.log('🎉 They can now access the Admin Moderation panel');
    
  } catch (error) {
    console.error('❌ Error making user admin:', error);
  }
}

// Get email from command line argument
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('❌ Please provide a user email');
  console.log('Usage: node makeAdmin.js user@example.com');
  process.exit(1);
}

makeUserAdmin(userEmail).then(() => {
  console.log('✅ Done!');
  process.exit(0);
});
