// Check product details from Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyD8GUTKesMY2Hpv-D3JS0vUG3CnD6yhRgc",
  authDomain: "social-vibing-karr.firebaseapp.com",
  projectId: "social-vibing-karr",
  storageBucket: "social-vibing-karr.firebasestorage.app",
  messagingSenderId: "907907966035",
  appId: "1:907907966035:web:eca4797d3d76e6f00552a6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkProductDetails() {
  console.log('🔍 Checking product details...\n');

  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, limit(3));
    const snapshot = await getDocs(q);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`📦 ${data.title}:`);
      console.log(`   Type: ${data.type}`);
      console.log(`   Status: ${data.status || 'MISSING'}`);
      console.log(`   Price: ${data.price} ${data.currency}`);
      console.log(`   Cover: ${data.coverImage ? 'YES' : 'NO'}`);
      console.log(`   Stats: ${JSON.stringify(data.stats)}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkProductDetails();
