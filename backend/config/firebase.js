const admin = require('firebase-admin');
const serviceAccount = require('./social-vibing-karr-firebase-adminsdk-fbsvc-3208b413eb.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = { admin, db };