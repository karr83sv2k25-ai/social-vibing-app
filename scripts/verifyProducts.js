// Verify products in Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query } = require('firebase/firestore');

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

async function verifyProducts() {
  console.log('📦 Checking products in Firestore...\n');

  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
    console.log(`✅ Total products found: ${snapshot.size}\n`);
    
    const productsByType = {};
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const type = data.type || 'unknown';
      
      if (!productsByType[type]) {
        productsByType[type] = [];
      }
      
      productsByType[type].push({
        id: doc.id,
        title: data.title,
        price: data.price,
        currency: data.currency
      });
    });
    
    // Display by type
    Object.keys(productsByType).sort().forEach(type => {
      console.log(`\n📚 ${type.toUpperCase()}:`);
      productsByType[type].forEach(product => {
        console.log(`   • ${product.title} - ${product.price} ${product.currency}`);
      });
    });
    
    console.log('\n✨ Verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyProducts();
