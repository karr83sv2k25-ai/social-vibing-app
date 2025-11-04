const { db } = require('../config/firebase');
const admin = require('firebase-admin');

// Login user
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Query Firestore for user with matching email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('user_email', '==', email).get();
    
    if (snapshot.empty) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const userData = snapshot.docs[0].data();
    
    // In production, you should use proper password hashing and comparison
    if (userData.user_password !== password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: snapshot.docs[0].id,
        ...userData
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Error during login'
    });
  }
};

// Verify user
exports.verifyUser = async (req, res) => {
  try {
    const { userId, verificationCode } = req.body;
    
    const userRef = db.collection('users').doc(userId);
    const user = await userRef.get();
    
    if (!user.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const userData = user.data();
    
    if (userData.user_email_verification_code !== verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }
    
    await userRef.update({
      user_email_verified: true,
      user_email_verification_code: null
    });
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Error during verification'
    });
  }
};

// Create a new user
exports.createUser = async (req, res) => {
  try {
    const { id, ...userData } = req.body;
    const userRef = id ? db.collection('users').doc(id) : db.collection('users').doc();
    await userRef.set(userData);
    
    res.status(201).json({
      success: true,
      data: { id: userRef.id, ...userData }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating user'
    });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = [];
    
    usersSnapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });
    
    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      error: 'Error retrieving users'
    });
  }
};

// Get a single user
exports.getUser = async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.params.id).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: { id: userDoc.id, ...userDoc.data() }
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      error: 'Error retrieving user'
    });
  }
};

// Update a user
exports.updateUser = async (req, res) => {
  try {
    const userRef = db.collection('users').doc(req.params.id);
    const user = await userRef.get();
    
    if (!user.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    await userRef.update(req.body);
    
    const updatedUser = await userRef.get();
    res.status(200).json({
      success: true,
      data: { id: updatedUser.id, ...updatedUser.data() }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating user'
    });
  }
};

// Delete a user
exports.deleteUser = async (req, res) => {
  try {
    const userRef = db.collection('users').doc(req.params.id);
    const user = await userRef.get();
    
    if (!user.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    await userRef.delete();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting user'
    });
  }
};