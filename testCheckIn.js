// testCheckIn.js - Helper script to test check-in streaks
// Run: node testCheckIn.js

const admin = require('firebase-admin');
const serviceAccount = require('./path-to-your-service-account.json'); // Update this path

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Configuration
const COMMUNITY_ID = 'YOUR_COMMUNITY_ID'; // Replace with actual community ID
const USER_ID = 'YOUR_USER_ID'; // Replace with actual user ID

async function simulateCheckIns() {
  console.log('🧪 Simulating check-ins for testing...\n');
  
  const checkInRef = db.collection('communities').doc(COMMUNITY_ID)
    .collection('checkIns').doc(USER_ID);
  
  // Simulate 7 days of check-ins
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  // Calculate totals
  let totalPoints = 0;
  let totalCoins = 0;
  
  for (let day = 1; day <= 7; day++) {
    const multiplier = day === 7 ? 2 : 1; // 2x on day 7
    const points = 10 * multiplier;
    const coins = day === 7 ? 5 + 10 : 5; // +10 bonus on day 7
    
    totalPoints += points;
    totalCoins += coins;
    
    console.log(`Day ${day}: ${points} pts, ${coins} coins (${multiplier}x)`);
  }
  
  console.log(`\n📊 Total: ${totalPoints} points, ${totalCoins} coins`);
  
  // Update Firestore
  await checkInRef.set({
    userId: USER_ID,
    communityId: COMMUNITY_ID,
    lastCheckInDate: dates[6], // Yesterday (to allow today's check-in)
    currentStreak: 6,
    longestStreak: 6,
    totalCheckIns: 6,
    totalPoints: totalPoints - 20, // Exclude today
    weeklyPoints: totalPoints - 20,
    monthlyPoints: totalPoints - 20,
    coinsEarned: totalCoins - 15,
    weekStart: dates[0],
    monthStart: dates[0],
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  console.log('\n✅ Check-in data updated! Now check in today to get 2x bonus!');
  process.exit(0);
}

// To test 30-day streak (4x multiplier)
async function simulate30DayStreak() {
  console.log('🧪 Simulating 30-day streak...\n');
  
  const checkInRef = db.collection('communities').doc(COMMUNITY_ID)
    .collection('checkIns').doc(USER_ID);
  
  let totalPoints = 0;
  let totalCoins = 0;
  
  for (let day = 1; day <= 29; day++) {
    let multiplier = 1;
    let coins = 5;
    
    if (day % 30 === 0) { multiplier = 4; coins += 50; }
    else if (day % 7 === 0) { multiplier = 2; coins += 10; }
    
    totalPoints += 10 * multiplier;
    totalCoins += coins;
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  await checkInRef.set({
    userId: USER_ID,
    communityId: COMMUNITY_ID,
    lastCheckInDate: yesterday.toISOString().split('T')[0],
    currentStreak: 29,
    longestStreak: 29,
    totalCheckIns: 29,
    totalPoints: totalPoints,
    weeklyPoints: 100,
    monthlyPoints: totalPoints,
    coinsEarned: totalCoins,
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  console.log(`✅ Ready for day 30! Check in to get 4x multiplier!`);
  console.log(`   Expected: +40 points, +55 coins\n`);
  process.exit(0);
}

// Choose which test to run
const testType = process.argv[2] || '7day';

if (testType === '30day') {
  simulate30DayStreak();
} else {
  simulateCheckIns();
}
