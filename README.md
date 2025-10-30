# Firebase Email OTP Verification Functions

## Features
- Send 6-digit OTP to email using Gmail (app password)
- Save OTP to Firestore, expire after 5 minutes
- Verify OTP, create/get Firebase user, return custom token
- Secure: Gmail credentials stored in Firebase config, not code

## Setup & Deploy

### 1. Install Firebase CLI
```
npm install -g firebase-tools
```

### 2. Login & Init
```
firebase login
firebase init functions
```

### 3. Install dependencies
```
cd functions
npm install
```

### 4. Enable Firestore & Auth in Firebase Console

### 5. Create Gmail App Password
- Turn on 2-Step Verification in Google account
- Create App Password for "Mail" + device "Other"

### 6. Set Gmail credentials in Firebase config
```
firebase functions:config:set gmail.email="your@gmail.com" gmail.pass="APP_PASSWORD" gmail.from="Social Vibing <your@gmail.com>"
```

### 7. Deploy functions
```
firebase deploy --only functions
```

### 8. Endpoints
- POST /sendOtp { email }
- POST /verifyOtp { email, code }

### 9. Client Usage Example
See EmailOtpClient.js in prompt above for React Native usage.

### 10. Security Notes
- Do NOT commit Gmail app password
- Use Firebase config for secrets
- Add rate limiting for production
- Clean up expired OTPs
