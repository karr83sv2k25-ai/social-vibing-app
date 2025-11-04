const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../config/social-vibing-karr-firebase-adminsdk-fbsvc-3208b413eb.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Function to read JSON file
const readJsonFile = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
};

// Function to import data to Firestore
async function importDataToFirestore(collectionName, data) {
  try {
    const batch = db.batch();
    
    data.forEach((doc) => {
      const docRef = db.collection(collectionName).doc(doc.id || db.collection(collectionName).doc().id);
      batch.set(docRef, doc);
    });

    await batch.commit();
    console.log(`Successfully imported ${data.length} documents to ${collectionName}`);
  } catch (error) {
    console.error(`Error importing data to ${collectionName}:`, error);
  }
}

// Main import function
async function importAllData() {
  const jsonDataPath = path.join(__dirname, '../json_data/users');
  const files = fs.readdirSync(jsonDataPath);

  // Special handling for users.json
  if (fs.existsSync(path.join(jsonDataPath, 'users_fixed.json'))) {
    const usersData = readJsonFile(path.join(jsonDataPath, 'users_fixed.json'));
    if (usersData) {
      console.log('Importing users_fixed.json...');
      await importDataToFirestore('users', usersData);
    }
  }

  for (const file of files) {
    if (file.endsWith('.json') && file !== 'users.json' && file !== 'users_fixed.json') {
      const collectionName = file.replace('.json', '');
      const data = readJsonFile(path.join(jsonDataPath, file));
      
      if (data) {
        console.log(`Importing ${file}...`);
        await importDataToFirestore(collectionName, Array.isArray(data) ? data : [data]);
      }
    }
  }
}

// Run the import
importAllData()
  .then(() => {
    console.log('All data imported successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during import:', error);
    process.exit(1);
  });