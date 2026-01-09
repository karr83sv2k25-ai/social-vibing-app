# Web App Setup Guide

Yeh guide aapko React web app setup karne mein help karegi jo same Firebase backend use karegi.

## 📋 Prerequisites

- Node.js (v16+)
- npm ya yarn
- Firebase account with existing project
- React knowledge

## 🚀 Quick Start

### 1. Create React Web App

```bash
# Create new React app
npx create-react-app social-vibing-web
cd social-vibing-web

# Install Firebase SDK
npm install firebase

# Install additional dependencies
npm install react-router-dom axios
```

### 2. Setup Firebase Configuration

Web app ke root folder mein `.env` file create karen:

```env
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

**Important:** Yeh values mobile app ke Firebase config se same honi chahiye!

### 3. Copy Shared Code

Mobile app se yeh folders/files web app mein copy karen:

```
mobile-app/shared/  →  web-app/src/shared/
├── services/
├── utils/
├── hooks/
└── firebaseConfig.web.js
```

### 4. Create Firebase Config

`src/config/firebase.js` file create karen:

```javascript
import { auth, db, storage } from '../shared/firebaseConfig.web';

export { auth, db, storage };
```

### 5. Project Structure

```
social-vibing-web/
├── public/
├── src/
│   ├── components/          # React components
│   │   ├── Auth/
│   │   ├── Posts/
│   │   ├── Profile/
│   │   └── Common/
│   ├── pages/               # Page components
│   │   ├── Home.js
│   │   ├── Login.js
│   │   ├── Profile.js
│   │   └── Marketplace.js
│   ├── shared/              # Shared code from mobile
│   │   ├── services/
│   │   ├── utils/
│   │   ├── hooks/
│   │   └── firebaseConfig.web.js
│   ├── config/
│   │   └── firebase.js
│   ├── App.js
│   ├── index.js
│   └── index.css
├── .env                     # Environment variables
├── package.json
└── README.md
```

## 📝 Example Usage

### Login Component (Web)

```javascript
import React, { useState } from 'react';
import { auth, db } from '../config/firebase';
import * as AuthService from '../shared/services/authService';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await AuthService.signIn(auth, db, email, password);
    
    if (result.success) {
      console.log('Logged in successfully');
      // Navigate to home
    } else {
      alert(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div>
      <h1>Login</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default Login;
```

### Using useAuth Hook

```javascript
import React from 'react';
import { auth, db } from '../config/firebase';
import { useAuth } from '../shared/hooks/useAuth';

function App() {
  const { user, userData, loading, authenticated } = useAuth(auth, db);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!authenticated) {
    return <Login />;
  }

  return (
    <div>
      <h1>Welcome, {userData?.displayName}</h1>
      {/* Your app content */}
    </div>
  );
}

export default App;
```

## 🔄 Syncing Data

Mobile aur web dono same Firebase database use karenge, so data automatically sync hoga:

1. **Real-time Updates:** Firestore listeners use karen
2. **Same Collections:** Mobile aur web same collection names use karen
3. **Same Security Rules:** Firebase console mein ek hi rules set karen

## 🚀 Running the App

```bash
# Development mode
npm start

# Build for production
npm run build

# Deploy to Firebase Hosting
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 🔐 Security Considerations

1. `.env` file ko `.gitignore` mein add karen
2. Firebase security rules properly configure karen
3. API keys ko environment variables mein rakhein
4. Production mein error logging setup karen

## 📱 Mobile vs Web Differences

| Feature | Mobile (React Native) | Web (React) |
|---------|----------------------|-------------|
| Firebase SDK | `@react-native-firebase/app` | `firebase` (JS SDK) |
| Navigation | `@react-navigation` | `react-router-dom` |
| Storage | `AsyncStorage` | `localStorage` |
| Components | React Native components | HTML/CSS |
| Styling | StyleSheet | CSS/styled-components |

## ⚠️ Common Issues

### Issue: Firebase not initialized
**Solution:** Make sure firebaseConfig.web.js properly imported hai

### Issue: CORS errors
**Solution:** Firebase Storage rules check karen

### Issue: Auth persistence not working
**Solution:** `browserLocalPersistence` use karen (already implemented)

## 📚 Next Steps

1. Create web components (UI)
2. Setup routing with React Router
3. Add responsive design
4. Implement all features from mobile app
5. Test thoroughly
6. Deploy to Firebase Hosting

## 🤝 Need Help?

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev/)
- Check mobile app code for business logic reference
