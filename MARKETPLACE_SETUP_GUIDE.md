# Marketplace Setup Guide

## Complete Configuration Guide for Social Vibing Marketplace

This guide walks through **all** setup steps required to configure the marketplace for production use.

---

## 📋 Prerequisites

- Firebase project with Blaze plan
- Apple Developer Account ($99/year)
- Google Play Developer Account ($25 one-time)
- Node.js 18+ installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Expo CLI installed (`npm install -g expo-cli`)

---

## 1️⃣ Firebase Configuration

### Step 1.1: Upgrade to Blaze Plan

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`social-vibing-karr`)
3. Click gear icon → Project Settings → Usage and Billing
4. Click "Modify plan"
5. Select "Blaze (pay as you go)"
6. Add payment method
7. Set billing alerts (recommended: $50/month)

**Cost Estimate:**
- Firestore: ~$1-5/month
- Cloud Functions: ~$0.10-2/month (125K free tier included)
- Hosting: Free tier sufficient
- **Total:** ~$5-10/month for moderate usage

### Step 1.2: Install Dependencies

```bash
cd /Users/ameerhamza/Developer/social-vibing-app/functions
npm install
```

**Verify:**
```bash
npm list googleapis firebase-functions firebase-admin
```

### Step 1.3: Deploy Firestore Rules

```bash
# From project root
firebase deploy --only firestore:rules

# Verify deployment
firebase firestore:rules get
```

### Step 1.4: Deploy Cloud Functions

```bash
# Test locally first (optional)
cd functions
npm run serve

# Deploy to production
firebase deploy --only functions

# Verify deployment
firebase functions:list
```

**Expected Output:**
```
✔ functions[buyProduct(us-central1)]
✔ functions[creditCoinsAfterIAP(us-central1)]
✔ functions[setActiveCustomization(us-central1)]
✔ functions[getUserLibrary(us-central1)]
✔ functions[createProduct(us-central1)]
✔ functions[generateAgoraToken(us-central1)]
```

---

## 2️⃣ Apple App Store Setup

### Step 2.1: App Store Connect Setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Sign in with Apple Developer account
3. Click "My Apps"
4. Select your app (or create new app)

**New App Creation:**
- Click "+" → New App
- Platforms: iOS
- Name: "Social Vibing"
- Primary Language: English
- Bundle ID: Select from dropdown (must match Xcode project)
- SKU: `com.socialvibing.app`

### Step 2.2: Create In-App Purchases

For each product:

1. Click "In-App Purchases" tab
2. Click "+" to create
3. Type: **Consumable**
4. Fill in details:

#### Coin Products

**Product 1: 100 Coins**
- Reference Name: `100 Coins`
- Product ID: `com.socialvibing.coins.100`
- Price Schedule:
  - Price: $0.99 (Tier 1)
  - Start Date: Immediate
- Localization (English US):
  - Display Name: `100 Coins`
  - Description: `Get 100 coins to unlock marketplace content`
- Review Information:
  - Screenshot: (upload coin purchase screen)
  - Review Notes: "Coins can purchase stickers, comics, books, art, and customizations"

**Product 2: 500 Coins + 50 Bonus**
- Reference Name: `500 Coins + 50 Bonus`
- Product ID: `com.socialvibing.coins.500`
- Price: $4.99 (Tier 5)
- Display Name: `550 Coins`
- Description: `Get 500 coins + 50 bonus coins (10% extra)`

**Product 3: 1000 Coins + 100 Bonus**
- Product ID: `com.socialvibing.coins.1000`
- Price: $9.99 (Tier 10)
- Display Name: `1,100 Coins`
- Description: `Get 1000 coins + 100 bonus coins (10% extra)`

**Product 4: 5000 Coins + 1500 Bonus**
- Product ID: `com.socialvibing.coins.5000`
- Price: $49.99 (Tier 50)
- Display Name: `6,500 Coins`
- Description: `Get 5000 coins + 1500 bonus coins (30% extra) - Best Value!`

#### Diamond Products

**Product 5: 10 Diamonds**
- Product ID: `com.socialvibing.diamonds.10`
- Price: $1.99 (Tier 2)
- Display Name: `10 Diamonds`
- Description: `Premium currency for exclusive marketplace items`

**Product 6: 50 Diamonds + 10 Bonus**
- Product ID: `com.socialvibing.diamonds.50`
- Price: $9.99 (Tier 10)
- Display Name: `60 Diamonds`
- Description: `Get 50 diamonds + 10 bonus diamonds (20% extra)`

**Product 7: 100 Diamonds + 20 Bonus**
- Product ID: `com.socialvibing.diamonds.100`
- Price: $19.99 (Tier 20)
- Display Name: `120 Diamonds`
- Description: `Get 100 diamonds + 20 bonus diamonds (20% extra)`

**Product 8: 500 Diamonds + 150 Bonus**
- Product ID: `com.socialvibing.diamonds.500`
- Price: $99.99 (Tier 100)
- Display Name: `650 Diamonds`
- Description: `Get 500 diamonds + 150 bonus diamonds (30% extra) - Ultimate Value!`

### Step 2.3: Submit Products for Review

1. Click each product
2. Click "Submit for Review"
3. Wait for approval (typically 24-48 hours)

**Note:** You can test products before approval using sandbox accounts.

### Step 2.4: Get Shared Secret

1. In App Store Connect, go to your app
2. Click "App Information" (left sidebar)
3. Scroll to "App-Specific Shared Secret"
4. Click "Manage"
5. Click "Generate" (or copy existing)
6. **Copy this secret** - you'll need it for Firebase config

### Step 2.5: Create Sandbox Testers

1. Click "Users and Access" (top right)
2. Click "Sandbox Testers" tab
3. Click "+" to add tester
4. Fill in:
   - Email: Use **new** email not associated with real Apple ID
   - Password: Create strong password
   - First/Last Name: Test User
   - Country: United States
5. Confirm email
6. Save credentials for testing

**Important:** Don't use your real Apple ID for sandbox testing!

### Step 2.6: Configure Firebase

```bash
# Set Apple shared secret
firebase functions:config:set apple.shared_secret="YOUR_SECRET_HERE"

# Example:
firebase functions:config:set apple.shared_secret="a1b2c3d4e5f6g7h8"

# Verify
firebase functions:config:get

# Deploy functions to apply config
firebase deploy --only functions
```

---

## 3️⃣ Google Play Console Setup

### Step 3.1: Create or Select App

1. Go to [Google Play Console](https://play.google.com/console)
2. Select "All apps"
3. Click your app or "Create app"

**New App:**
- App name: "Social Vibing"
- Default language: English (United States)
- App or game: App
- Free or paid: Free
- Declarations: Accept

### Step 3.2: Create In-App Products

1. Navigate to: Monetization → Products → In-app products
2. Click "Create product"

For each product:

#### Coin Products

**Product 1: 100 Coins**
- Product ID: `com.socialvibing.coins.100`
- Name: `100 Coins`
- Description: `Purchase 100 coins to unlock marketplace content including stickers, comics, books, art, and customizations`
- Status: Active
- Default price: $0.99 USD
- Managed product (consumable)

Repeat for:
- `com.socialvibing.coins.500` - $4.99 - "550 Coins (500 + 50 bonus)"
- `com.socialvibing.coins.1000` - $9.99 - "1,100 Coins (1000 + 100 bonus)"
- `com.socialvibing.coins.5000` - $49.99 - "6,500 Coins (5000 + 1500 bonus)"

#### Diamond Products

- `com.socialvibing.diamonds.10` - $1.99 - "10 Diamonds"
- `com.socialvibing.diamonds.50` - $9.99 - "60 Diamonds (50 + 10 bonus)"
- `com.socialvibing.diamonds.100` - $19.99 - "120 Diamonds (100 + 20 bonus)"
- `com.socialvibing.diamonds.500` - $99.99 - "650 Diamonds (500 + 150 bonus)"

**Critical:** Activate all products (toggle to "Active")

### Step 3.3: Configure License Testing

1. Go to: Setup → License testing
2. Add test Gmail accounts (comma-separated):
   ```
   test1@gmail.com, test2@gmail.com, yourtest@gmail.com
   ```
3. License response: "RESPOND_NORMALLY"
4. Save

**Note:** Test accounts won't be charged for purchases.

### Step 3.4: Upload to Internal Testing

Before IAP can be tested on Android:

1. Build signed APK:
```bash
cd /Users/ameerhamza/Developer/social-vibing-app
npm run build-apk
```

2. Go to: Release → Testing → Internal testing
3. Create new release
4. Upload APK: `android/app/build/outputs/apk/release/app-release.apk`
5. Add release notes
6. Review and rollout

**Add Testers:**
1. Click "Testers" tab
2. Create email list with test accounts
3. Save
4. Share opt-in link with testers

### Step 3.5: Enable Google Play Developer API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your Firebase project
3. **Enable API:**
   - Navigation menu → APIs & Services → Library
   - Search "Google Play Android Developer API"
   - Click → Enable

### Step 3.6: Create Service Account

**Option A: Use Existing Firebase Admin SDK Account**

1. Go to Cloud Console → IAM & Admin → Service Accounts
2. Find `firebase-adminsdk` account
3. Click ⋮ → "Manage keys"
4. Click "Add Key" → "Create new key"
5. Type: JSON
6. Download file
7. Save as: `functions/service-account-key.json`

**Option B: Create New Service Account**

1. IAM & Admin → Service Accounts
2. Click "Create Service Account"
3. Name: `play-developer-api`
4. Description: "Google Play receipt verification"
5. Click "Create and Continue"
6. Grant roles:
   - Service Account User
7. Click "Done"
8. Create and download JSON key

### Step 3.7: Link Service Account to Play Console

1. Go back to [Google Play Console](https://play.google.com/console)
2. Setup → API access
3. Click "Link" next to your Google Cloud project (if not linked)
4. Under "Service accounts", find your account
5. Click "Grant access"
6. Permissions:
   - ✅ View financial data
   - ✅ Manage orders and subscriptions
7. Click "Invite user"
8. Confirm

### Step 3.8: Configure Firebase with Service Account

**Option A: File-based (local development)**
- File already saved: `functions/service-account-key.json`
- Add to `.gitignore`:
  ```
  functions/service-account-key.json
  ```

**Option B: Config-based (recommended for production)**

```bash
# Store in Firebase config
firebase functions:config:set google.service_account="$(cat functions/service-account-key.json | tr -d '\n')"

# Verify
firebase functions:config:get google.service_account

# Deploy
firebase deploy --only functions
```

---

## 4️⃣ React Native App Configuration

### Step 4.1: Verify Product IDs

Check `/config/iapConfig.js`:

```javascript
// Ensure these match App Store Connect and Play Console exactly
export const IAP_PRODUCTS = {
  COINS: {
    'com.socialvibing.coins.100': { amount: 100, price: '$0.99' },
    'com.socialvibing.coins.500': { amount: 500, bonus: 50, price: '$4.99' },
    'com.socialvibing.coins.1000': { amount: 1000, bonus: 100, price: '$9.99' },
    'com.socialvibing.coins.5000': { amount: 5000, bonus: 1500, price: '$49.99' },
  },
  DIAMONDS: {
    'com.socialvibing.diamonds.10': { amount: 10, price: '$1.99' },
    'com.socialvibing.diamonds.50': { amount: 50, bonus: 10, price: '$9.99' },
    'com.socialvibing.diamonds.100': { amount: 100, bonus: 20, price: '$19.99' },
    'com.socialvibing.diamonds.500': { amount: 500, bonus: 150, price: '$99.99' },
  },
};
```

**If your bundle ID is different:**

Replace `com.socialvibing` with your actual bundle ID everywhere.

### Step 4.2: Update Package Name (Android)

If needed, update `android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        applicationId "com.socialvibing.app" // Match Play Console
    }
}
```

### Step 4.3: Update Bundle ID (iOS)

In Xcode:
1. Open `ios/YourApp.xcworkspace`
2. Select project in navigator
3. General tab → Bundle Identifier
4. Must match App Store Connect

### Step 4.4: Test IAP Library

```bash
# Verify react-native-iap is installed
npm list react-native-iap

# Should show:
# react-native-iap@14.7.11

# If not installed:
npm install --save react-native-iap --legacy-peer-deps
```

---

## 5️⃣ Testing Configuration

### Step 5.1: iOS Sandbox Testing

**On Device:**
1. Settings → App Store → Sandbox Account
2. Sign out of your real Apple ID
3. Don't sign in to sandbox account yet
4. Launch your app
5. Attempt purchase
6. When prompted, sign in with sandbox tester credentials

**On Simulator:**
- Sandbox purchases work on simulator
- StoreKit testing configuration can be used for offline testing

### Step 5.2: Android License Testing

**On Device:**
1. Ensure test account is signed in to device
2. Install app from Internal Testing track
3. Attempt purchase
4. Should see "Test card" notice (won't be charged)

**Debug:**
```bash
# Check logs for IAP events
adb logcat | grep -i "iap\|purchase\|billing"
```

### Step 5.3: Local Function Testing

```bash
# Start Firebase emulators
cd functions
npm run serve

# Test creditCoinsAfterIAP locally
# Update iapService.js to use local emulator
```

---

## 6️⃣ Production Configuration

### Step 6.1: Remove Development Bypasses

In `functions/receiptVerification.js`, **remove or comment out:**

```javascript
// REMOVE THIS BEFORE PRODUCTION:
// if (functions.config().app?.environment === "development") {
//   functions.logger.warn("Bypassing verification in development mode");
// }
```

### Step 6.2: Set Production Environment

```bash
# Ensure production mode
firebase functions:config:unset app.environment

# Deploy
firebase deploy --only functions
```

### Step 6.3: Test with Real Money

**⚠️ Important:** Test small purchases with real money before launch!

1. Use personal device (not test account)
2. Purchase smallest package ($0.99)
3. Verify:
   - Receipt verified
   - Coins credited
   - Transaction recorded
4. Request refund from Apple/Google if needed

### Step 6.4: Configure Monitoring

```bash
# Set up log-based alerts
# Firebase Console → Functions → Dashboard → Set up alerts

# Email when function errors spike
# Slack/Discord webhooks for purchases
```

---

## 7️⃣ Deployment Checklist

### Pre-Deployment

- [ ] Firebase Blaze plan active
- [ ] All Cloud Functions deployed and tested
- [ ] Firestore rules deployed
- [ ] Apple shared secret configured
- [ ] Google service account configured
- [ ] All 8 IAP products created in App Store Connect
- [ ] All 8 IAP products created in Play Console
- [ ] Products activated (status: active)
- [ ] iOS products approved (or in review)
- [ ] Android app uploaded to Internal Testing
- [ ] Test accounts configured
- [ ] Sandbox purchases tested and working
- [ ] Production bypass code removed
- [ ] Product IDs match across all platforms

### Post-Deployment

- [ ] Real money test purchase successful
- [ ] Receipt verification working
- [ ] Balance updates correctly
- [ ] Transaction recorded in database
- [ ] Creator earnings calculated
- [ ] Error monitoring active
- [ ] User documentation published
- [ ] Support team trained
- [ ] Refund policy documented

---

## 8️⃣ Troubleshooting

### Problem: Products Not Loading

**Symptoms:**
- Empty product list
- "Loading products..." forever

**Solutions:**
1. Check product IDs match exactly (case-sensitive)
2. Verify products are activated in console
3. iOS: Products must be submitted (can test before approval)
4. Android: App must be uploaded to testing track
5. Check bundle ID / package name matches
6. Clear app data and retry

**Debug:**
```javascript
// Add to iapService.js
console.log('Requesting products:', getAllProductIds());
```

### Problem: Receipt Verification Fails

**Symptoms:**
- Purchase completes but no coins
- Function logs show "Receipt verification failed"

**Solutions:**

**iOS:**
```bash
# Check Apple shared secret
firebase functions:config:get apple.shared_secret

# If empty or wrong:
firebase functions:config:set apple.shared_secret="CORRECT_SECRET"
firebase deploy --only functions
```

**Android:**
```bash
# Check service account configured
firebase functions:config:get google.service_account

# Check Google Play API enabled
# Cloud Console → APIs & Services → Dashboard

# Verify service account has Play Console access
# Play Console → Setup → API access
```

### Problem: "Permission Denied" on Wallet Update

**Symptoms:**
- Client can't update balance
- Firestore rules block write

**Expected:**
- This is correct! Clients should never update wallet directly
- Only Cloud Functions can credit coins/diamonds

**Verify:**
```javascript
// This should FAIL (security working):
await updateDoc(userRef, {
  'wallet.coins': 999999
});
// Error: Missing or insufficient permissions ✅

// This should SUCCEED:
const result = await creditCoinsAfterIAP({...});
// Coins credited ✅
```

---

## 9️⃣ Cost Estimates

### Firebase Costs (Blaze Plan)

**Free Tier:**
- Cloud Functions: 2M invocations/month
- Firestore: 50K reads, 20K writes
- Hosting: 10GB transfer

**Estimated Monthly Cost (10K active users):**
- Cloud Functions: $0.50 (within free tier mostly)
- Firestore: $3-5 (read/write operations)
- Storage: $1-2 (product images)
- **Total: ~$5-8/month**

**At Scale (100K users):**
- ~$30-50/month

### Apple Developer Program
- **$99/year** (required)

### Google Play Console
- **$25 one-time** (required)

### Total First Year
- Firebase: ~$60-100
- Apple: $99
- Google: $25
- **Total: ~$185-225**

---

## 🎉 Setup Complete!

Your marketplace is now fully configured and ready for launch!

**Next Steps:**
1. Review [MARKETPLACE_TESTING_GUIDE.md](MARKETPLACE_TESTING_GUIDE.md)
2. Complete all test cases
3. Perform real money test
4. Launch to production!

**Support:**
- Firebase: [Firebase Support](https://firebase.google.com/support)
- Apple: [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- Google: [Play Console Help](https://support.google.com/googleplay/android-developer)

---

**Setup Guide Version:** 1.0  
**Last Updated:** February 18, 2026  
**Estimated Setup Time:** 3-4 hours
