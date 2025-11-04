const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../config/social-vibing-karr-firebase-adminsdk-fbsvc-3208b413eb.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({
  ignoreUndefinedProperties: true
});

// Function to parse and transform community data
const transformCommunityData = (data) => {
  if (!Array.isArray(data)) return [];
  
  return data.map(item => {
    try {
      // Get the long property name (concatenated column names)
      const longKey = Object.keys(item).find(key => key !== 'null');
      if (!longKey) return null;
      const value = item[longKey];
      
      if (!value) return null;
      
      // Parse field names
      const propertyNames = longKey.split(';').map(name => 
        name.replace(/\"/g, '').trim()
      );
      
      // Parse values
      let values = value.split(';').map(val => 
        val.replace(/^\"|\"$/g, '').trim()
      );
      
      // Handle additional text from null array if it exists
      if (item.null && Array.isArray(item.null)) {
        const additionalText = item.null.join('').trim();
        if (additionalText) {
          const lastValue = values[values.length - 1];
          values[values.length - 1] = lastValue + additionalText;
        }
      }
      
      // Create transformed object
      const transformedData = {};
      propertyNames.forEach((prop, index) => {
        let val = values[index];
        
        // Standardize null/undefined values
        if (val === 'NULL' || val === '' || val === undefined) {
          val = null;
        } else if (val) {
          // Try to convert numeric strings to numbers
          const num = Number(val);
          if (!isNaN(num) && val.trim() === num.toString()) {
            val = num;
          }
          // Clean up HTML entities
          if (typeof val === 'string') {
            val = val.replace(/&mdash;/g, '—')
                    .replace(/&#039;/g, "'")
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>');
          }
        }
        
        // Only add non-undefined values
        if (val !== undefined) {
          transformedData[prop] = val;
        }
      });
      
      return transformedData;
    } catch (error) {
      console.error(`Error transforming data:`, error);
      return null;
    }
  }).filter(Boolean);
};

// Function to sanitize data for Firestore limitations
const sanitizeData = (data) => {
  const MAX_STRING_LENGTH = 1500;
  
  if (typeof data === 'string' && data.length > MAX_STRING_LENGTH) {
    return data.substring(0, MAX_STRING_LENGTH);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip properties that are too long
      if (key.length > 1500) continue;
      
      if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
        sanitized[key] = value.substring(0, MAX_STRING_LENGTH);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  
  return data;
};

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
    // Process data in smaller batches to avoid memory issues
    const BATCH_SIZE = 100;
    let count = 0;
    
    // If data is array, process in batches
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const currentBatch = data.slice(i, i + BATCH_SIZE);
        
        currentBatch.forEach((doc) => {
          const sanitizedDoc = sanitizeData(doc);
          const docId = doc.community_id || doc.id || db.collection(collectionName).doc().id;
          const docRef = db.collection(collectionName).doc(docId.toString());
          batch.set(docRef, sanitizedDoc);
          count++;
        });
        
        await batch.commit();
        console.log(`Imported batch of ${currentBatch.length} documents to ${collectionName}`);
      }
    } else if (data) {
      // If data is object, process it directly
      const batch = db.batch();
      const sanitizedDoc = sanitizeData(data);
      const docId = data.community_id || data.id || db.collection(collectionName).doc().id;
      const docRef = db.collection(collectionName).doc(docId.toString());
      batch.set(docRef, sanitizedDoc);
      count = 1;
      await batch.commit();
    }

    console.log(`Successfully imported ${count} documents to ${collectionName}`);
  } catch (error) {
    console.error(`Error importing data to ${collectionName}:`, error);
  }
}

// Main import function for community data
async function importCommunityData() {
  const communityDataPath = path.join(__dirname, '../json_data/community');
  const files = fs.readdirSync(communityDataPath);

  console.log('Starting community data import...');

  for (const file of files) {
    if (file.endsWith('.json')) {
      const collectionName = file.replace('.json', '');
      const rawData = readJsonFile(path.join(communityDataPath, file));
      
      if (rawData) {
        console.log(`Importing ${file}...`);
        
        // Transform data if it's the communities.json file
        const data = file === 'communities.json' ? 
          transformCommunityData(rawData) : rawData;
        
        await importDataToFirestore(collectionName, data);
      }
    }
  }
}

// Run the import
importCommunityData()
  .then(() => {
    console.log('All community data imported successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during import:', error);
    process.exit(1);
  });