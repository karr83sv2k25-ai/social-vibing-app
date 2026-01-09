// Shared Authentication Service
// Works on both React Native and React Web
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Authentication Service
 * Platform-agnostic authentication functions
 * 
 * Usage:
 * import { auth, db } from '../firebaseConfig'; // Mobile
 * import { auth, db } from '../shared/firebaseConfig.web'; // Web
 * import * as AuthService from '../shared/services/authService';
 * 
 * AuthService.signUp(auth, db, email, password, userData);
 */

// ==================== SIGN UP ====================
export const signUp = async (auth, db, email, password, userData = {}) => {
  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name if provided
    if (userData.displayName) {
      await updateProfile(user, {
        displayName: userData.displayName,
        photoURL: userData.photoURL || null
      });
    }

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: userData.displayName || '',
      photoURL: userData.photoURL || '',
      phoneNumber: userData.phoneNumber || '',
      bio: userData.bio || '',
      followers: [],
      following: [],
      coins: 0,
      diamonds: 0,
      verified: false,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      ...userData // Any additional fields
    });

    console.log('✅ User created:', user.uid);
    return { success: true, user };
  } catch (error) {
    console.error('❌ Sign up error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== SIGN IN ====================
export const signIn = async (auth, db, email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update last seen
    await updateDoc(doc(db, 'users', user.uid), {
      lastSeen: serverTimestamp()
    });

    console.log('✅ User signed in:', user.uid);
    return { success: true, user };
  } catch (error) {
    console.error('❌ Sign in error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== SIGN OUT ====================
export const logout = async (auth) => {
  try {
    await signOut(auth);
    console.log('✅ User signed out');
    return { success: true };
  } catch (error) {
    console.error('❌ Sign out error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== PASSWORD RESET ====================
export const resetPassword = async (auth, email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('✅ Password reset email sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Password reset error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UPDATE PROFILE ====================
export const updateUserProfile = async (auth, db, updates) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');

    // Update Auth profile
    if (updates.displayName || updates.photoURL) {
      await updateProfile(user, {
        displayName: updates.displayName || user.displayName,
        photoURL: updates.photoURL || user.photoURL
      });
    }

    // Update Firestore document
    await updateDoc(doc(db, 'users', user.uid), {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Profile updated');
    return { success: true };
  } catch (error) {
    console.error('❌ Profile update error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UPDATE EMAIL ====================
export const changeEmail = async (auth, db, newEmail, currentPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');

    // Reauthenticate first
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Update email
    await updateEmail(user, newEmail);
    
    // Update Firestore
    await updateDoc(doc(db, 'users', user.uid), {
      email: newEmail,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Email updated');
    return { success: true };
  } catch (error) {
    console.error('❌ Email update error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== UPDATE PASSWORD ====================
export const changePassword = async (auth, currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');

    // Reauthenticate first
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Update password
    await updatePassword(user, newPassword);

    console.log('✅ Password updated');
    return { success: true };
  } catch (error) {
    console.error('❌ Password update error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== GET CURRENT USER DATA ====================
export const getCurrentUserData = async (db, userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() };
    } else {
      return { success: false, error: 'User not found' };
    }
  } catch (error) {
    console.error('❌ Get user data error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== AUTH STATE LISTENER ====================
export const subscribeToAuthState = (auth, callback) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('👤 User authenticated:', user.uid);
      callback({ authenticated: true, user });
    } else {
      console.log('👤 No user authenticated');
      callback({ authenticated: false, user: null });
    }
  });
};

// ==================== CHECK IF USER EXISTS ====================
export const checkUserExists = async (db, userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    return userDoc.exists();
  } catch (error) {
    console.error('❌ Check user exists error:', error);
    return false;
  }
};
