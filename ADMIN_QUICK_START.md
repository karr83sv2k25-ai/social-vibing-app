# 🚀 QUICK START GUIDE - Age Verification & Admin Panel

## 📱 FOR END USERS

### How to Verify Your Age (17+)

1. **Create Account** 
   - Fill in your name, password, country, age, and gender
   - Click "Next"

2. **Age Verification Screen**
   - ✅ Check "I am 17 years or older"
   - Click "ENTER & VERIFY ACCOUNT"

3. **Upload Verification Document**
   - Select document type: ID Card, Passport, or Driver License
   - Enter your Date of Birth (format: YYYY-MM-DD, e.g., 1999-12-31)
   - Click "Upload Verification Document"
   - Choose a clear photo of your ID
   - Click "Submit Verification"

4. **Wait for Approval**
   - Your profile will show "Verification Pending" ⏱️
   - Admin will review within 24-48 hours
   - You'll get a notification when approved

5. **Get Your Badge**
   - Once approved, you'll see a **Verified 17+** badge 🛡️
   - Shield icon appears next to your name
   - Full access to all platform features

---

## 👮 FOR ADMINS

### First Time Setup

#### Make Yourself Admin (Choose One Method):

**Method 1: Firebase Console** (Easiest)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click "Firestore Database"
4. Find your user in the `users` collection
5. Click your document
6. Add fields:
   - `role`: `"admin"`
   - `isAdmin`: `true`
7. Save

**Method 2: Using Script**
```bash
# 1. Download service account key from Firebase Console
# Project Settings → Service Accounts → Generate New Private Key

# 2. Save as serviceAccountKey.json in project root

# 3. Install firebase-admin
npm install firebase-admin

# 4. Run the script with your email
node makeAdmin.js your-email@example.com
```

### Accessing Admin Panel

1. **From Profile Screen**
   - Look for the **shield icon button** 🛡️ (cyan/turquoise color)
   - Only visible if you're an admin
   - Tap to open Admin Moderation panel

2. **Direct Navigation**
   ```javascript
   navigation.navigate('AdminModeration')
   ```

### Using the Admin Panel

#### **Tab 1: Verifications** (Pending Reviews)

**What you see:**
- List of users awaiting verification
- User profile picture
- Full name and username
- Age and Date of Birth
- Document type submitted
- "Pending" badge

**What to do:**
1. Tap on a user
2. Review their uploaded document
3. Check if DOB matches and age is 17+
4. Choose action:
   - ✅ **APPROVE** → User gets verified badge
   - ❌ **REJECT** → User can resubmit

#### **Tab 2: All Users**

**What you see:**
- All registered users
- Verification status (verified badge or none)
- Ban status (if applicable)

**What to do:**
1. Tap on any user
2. View full profile and details
3. Available actions:

**For Verified Users:**
- 🔄 **Revoke Verification** → Remove verified status

**For All Users:**
- 🚫 **Ban User** → Block from platform
- ⚠️ **Send Warning** → Issue a warning
- 🔓 **Unban User** → Remove ban (if banned)

---

## 🎯 COMMON TASKS

### Approve a User's Age Verification
1. Open Admin Panel
2. Go to "Verifications" tab
3. Tap the user's card
4. Review document image
5. Confirm age is 17+ and document looks legitimate
6. Tap **"Approve"** button (green)
7. User instantly gets verified badge

### Reject a Verification
1. Open user detail from Verifications tab
2. Review why you're rejecting (unclear photo, underage, etc.)
3. Tap **"Reject"** button (red)
4. User can resubmit with a better document

### Ban a Rule Breaker
1. Find user in "All Users" tab
2. Tap to open details
3. Tap **"Ban User"** (red button)
4. Confirm the action
5. User is immediately banned
6. Reason logged: "Violation of community guidelines"

### Unban a User
1. Find banned user (shows red "Banned" badge)
2. Tap to open details
3. Tap **"Unban User"** (green button)
4. Confirm action
5. User regains access

### Revoke Someone's Verification
Use when:
- User was verified but turns out to be underage
- Fake document discovered
- User violates platform rules

Steps:
1. Find verified user (has shield badge)
2. Tap to open details
3. Tap **"Revoke Verification"** (yellow button)
4. Confirm action
5. Shield badge removed from their profile

### Send a Warning
1. Tap user in All Users tab
2. Tap **"Send Warning"** (yellow button)
3. Default message: "Please follow community guidelines"
4. Warning is logged in their profile

---

## 🔍 VERIFICATION CHECKLIST

When reviewing a document, check:

✅ **Document is clear and readable**
✅ **Date of Birth is visible**
✅ **User is 17 years or older**
✅ **Document appears legitimate** (not photoshopped)
✅ **Name matches account name** (optional, for stricter verification)

❌ **Reject if:**
- Document is blurry or unreadable
- User is under 17 years old
- Document looks fake or tampered
- Wrong document type (e.g., school ID instead of government ID)

---

## 📊 USER STATUSES

### Verification Status
- **Not Verified**: No verification submitted
- **Pending** (⏱️ Yellow): Waiting for admin review
- **Verified** (✅ Cyan): Approved by admin
- **Rejected** (❌ Red): Denied by admin, can resubmit
- **Revoked** (🔄): Previously verified but removed

### Moderation Status
- **Active**: Normal user, no issues
- **Warned** (⚠️): Received warning from admin
- **Banned** (🚫 Red): Cannot access platform

---

## 🎨 VISUAL CUES

### In User Profiles
- **Shield Badge** 🛡️ = Verified user (17+)
- **No Badge** = Not verified
- **Yellow Banner** = Verification pending
- **Red Banner** = Verification rejected
- **Cyan Banner** = Verified 17+

### In Admin Panel
- **Green Buttons** = Positive actions (Approve, Unban)
- **Red Buttons** = Negative actions (Reject, Ban)
- **Yellow Buttons** = Warning actions (Warn, Revoke)
- **Cyan Shield Icon** = Verified users
- **Ban Icon** 🚫 = Banned users

---

## ⚠️ IMPORTANT NOTES

### For Users
1. **Verification is NOT optional** - It's required for full platform access
2. **Use real documents** - Fake documents will be rejected
3. **Clear photos** - Make sure your ID is readable
4. **Be patient** - Reviews take 24-48 hours
5. **Privacy protected** - Your documents are encrypted and only admins can see them

### For Admins
1. **Review carefully** - You're responsible for platform safety
2. **Document reasons** - When banning/warning, note why
3. **Be consistent** - Apply rules fairly to all users
4. **Privacy matters** - Never share user documents
5. **Log everything** - All actions are timestamped and tracked

---

## 🆘 TROUBLESHOOTING

### "Can't upload document"
- Check permissions (camera/gallery access)
- Try a smaller image file
- Make sure you selected a file

### "Admin panel says Access Denied"
- Verify you're added as admin in Firestore
- Check `role: "admin"` and `isAdmin: true` are set
- Log out and log back in

### "Don't see shield button in profile"
- Only appears on YOUR profile
- Only if you're an admin
- Check userData.isAdmin is true

### "Firestore permission denied when approving"
- Deploy updated firestore.rules
- Check admin helper function in rules
- Verify your admin status in Firestore

---

## 📞 SUPPORT

**Need help?**
- Check [AGE_VERIFICATION_GUIDE.md](AGE_VERIFICATION_GUIDE.md) for detailed documentation
- Review [firestore.rules](firestore.rules) for security rules
- Test with [makeAdmin.js](makeAdmin.js) script

**Report Issues:**
- Document doesn't upload: Check hostinger config
- Admin panel not accessible: Verify Firestore admin fields
- Rules not working: Redeploy firestore.rules

---

**Remember**: This is a **17+ platform**. Proper age verification protects the community and keeps everyone safe! 🛡️
