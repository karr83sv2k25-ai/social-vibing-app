# 🚀 Marketplace Cloud Functions - Deployment Guide

## 📋 Current Status

### ✅ Successfully Deployed
- **Firestore Security Rules** - Deployed ✓
  - Wallet fields (`coins`, `diamonds`, `ownedProducts`) are now protected
  - Only Cloud Functions can modify marketplace data
  - Client-side wallet manipulation is blocked

### ⚠️ Pending Deployment
- **Cloud Functions** - Requires IAM Permissions
  - `buyProduct` - Secure product purchase
  - `creditCoinsAfterIAP` - In-app purchase verification
  - `setActiveCustomization` - Frame/bubble activation
  - `getUserLibrary` - Library fetching
  - `createProduct` - Product creation

---

## 🔐 Fix Permission Issue

### Error Message
```
Error: Missing permissions required for functions deploy.
You must have permission iam.serviceAccounts.ActAs on service account 
social-vibing-karr@appspot.gserviceaccount.com.
```

### Solution: Grant IAM Permissions

**Option 1: Firebase Console (Recommended)**
1. Go to [Firebase Console - IAM](https://console.cloud.google.com/iam-admin/iam?project=social-vibing-karr)
2. Find your account email in the list
3. Click **Edit** (pencil icon)
4. Click **Add Another Role**
5. Add the following roles:
   - **Cloud Functions Developer**
   - **Service Account User**
6. Click **Save**
7. Wait 2-3 minutes for permissions to propagate

**Option 2: Using Firebase CLI (if you have Owner access)**
```bash
# Get your current user email
firebase login:list

# Grant yourself the Service Account User role
gcloud projects add-iam-policy-binding social-vibing-karr \
  --member="user:YOUR_EMAIL@gmail.com" \
  --role="roles/iam.serviceAccountUser"

# Grant Cloud Functions Developer role
gcloud projects add-iam-policy-binding social-vibing-karr \
  --member="user:YOUR_EMAIL@gmail.com" \
  --role="roles/cloudfunctions.developer"
```

**Option 3: Ask Project Owner**
If you're not the project owner, ask them to grant you these roles using the link:
```
https://console.cloud.google.com/iam-admin/iam?project=social-vibing-karr
```

---

## 🧪 Test Locally First (Firebase Emulator)

While waiting for permissions, you can test the Cloud Functions locally:

### 1. Start Firebase Emulators
```bash
# Install emulator suite (if not already installed)
firebase init emulators

# Start emulators for Functions and Firestore
firebase emulators:start --only functions,firestore
```

### 2. Update Client Code for Emulator (Temporary)
In `firebaseConfig.js`, add this for local testing:
```javascript
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const functions = getFunctions(app);

// FOR TESTING ONLY - Connect to emulator
if (__DEV__) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

### 3. Test Purchase Flow
1. Run the app: `npx expo start`
2. Navigate to Marketplace
3. Try purchasing a product
4. Watch emulator logs for function execution

---

## 📦 Deploy Cloud Functions (After Permissions)

Once you have the required permissions:

### Deploy All Functions
```bash
cd /Users/ameerhamza/Developer/social-vibing-app
firebase deploy --only functions
```

### Deploy Specific Functions
```bash
# Deploy only marketplace functions
firebase deploy --only functions:buyProduct,functions:creditCoinsAfterIAP,functions:setActiveCustomization,functions:getUserLibrary,functions:createProduct
```

### Verify Deployment
```bash
# List all deployed functions
firebase functions:list

# View function logs
firebase functions:log --only buyProduct
```

---

## ✅ Post-Deployment Checklist

After successful deployment:

- [ ] Test `buyProduct` function from app
- [ ] Test insufficient balance error handling
- [ ] Test duplicate purchase prevention
- [ ] Verify wallet security (try direct modification - should fail)
- [ ] Test IAP coin crediting (when implemented)
- [ ] Test frame/bubble customization
- [ ] Check Firebase Console > Functions for execution logs
- [ ] Monitor error rates

---

## 🔍 Monitoring & Debugging

### View Function Logs
```bash
# Real-time logs
firebase functions:log --only buyProduct

# Filter by severity
firebase functions:log --only buyProduct --severity ERROR
```

### Firebase Console
- [Functions Dashboard](https://console.firebase.google.com/project/social-vibing-karr/functions)
- [Firestore Console](https://console.firebase.google.com/project/social-vibing-karr/firestore)
- [IAM Permissions](https://console.cloud.google.com/iam-admin/iam?project=social-vibing-karr)

---

## 🐛 Common Deployment Issues

### Issue: "Insufficient permissions"
**Solution**: Follow the "Fix Permission Issue" section above

### Issue: "Function timeout"
**Solution**: Increase timeout in `functions/index.js`:
```javascript
exports.buyProduct = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // function code
  });
```

### Issue: "Cold start delay"
**Solution**: Configure min instances (costs money):
```javascript
exports.buyProduct = functions
  .runWith({ minInstances: 1 })
  .https.onCall(async (data, context) => {
    // function code
  });
```

---

## 📊 Cost Estimation

### Cloud Functions Pricing (Pay-as-you-go)
- **Invocations**: $0.40 per million invocations
- **Compute Time**: $0.0000025 per GB-second
- **Network**: $0.12 per GB

**Example Monthly Cost for 10,000 purchases/month:**
- Invocations: ~$0.004
- Compute: ~$0.05
- **Total: ~$0.054/month** (very affordable!)

**Free Tier:**
- 2 million invocations/month
- 400,000 GB-seconds
- 200 GB network egress

*You'll likely stay within the free tier for testing and early growth!*

---

## 🎯 Next Steps

1. ✅ **Grant IAM Permissions** (see section above)
2. 🧪 **Test with Emulator** (optional, recommended)
3. 🚀 **Deploy Functions** (`firebase deploy --only functions`)
4. ✅ **Test in Production** (make a real purchase)
5. 📱 **Move to Phase 3** (Product Viewers - Comic Reader, etc.)

---

## 📞 Need Help?

**Firebase Support:**
- [Firebase Documentation](https://firebase.google.com/docs/functions)
- [Firebase Community Slack](https://firebase.community/)
- [Stack Overflow - Firebase](https://stackoverflow.com/questions/tagged/firebase)

**Project Specific:**
- Functions code: `/functions/marketplace.js`
- Firestore rules: `/firestore.rules`
- Client code: `/screens/marketplace/ProductDetailScreen.js`

---

**Created**: February 15, 2026  
**Project**: Social Vibing Marketplace  
**Status**: Phase 2 - Security & Cloud Functions (90% Complete)
