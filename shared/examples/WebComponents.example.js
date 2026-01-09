// Example React Web Component
// This shows how to use shared services in web app

import React, { useState, useEffect } from 'react';
import { auth, db } from '../shared/firebaseConfig.web';
import { useAuth } from '../shared/hooks/useAuth';
import * as AuthService from '../shared/services/authService';
import * as UserService from '../shared/services/userService';
import { validateEmail, validatePassword } from '../shared/utils/validation';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    setErrors({});

    // Validate inputs
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);

    if (!emailValidation.valid || !passwordValidation.valid) {
      setErrors({
        email: emailValidation.error,
        password: passwordValidation.error
      });
      return;
    }

    setLoading(true);

    // Use shared service
    const result = await AuthService.signIn(auth, db, email, password);

    if (result.success) {
      console.log('✅ Login successful');
      // Redirect to home page
      window.location.href = '/home';
    } else {
      setErrors({ general: result.error });
    }

    setLoading(false);
  };

  return (
    <div className="login-container">
      <h1>Login to Social Vibing</h1>
      
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            disabled={loading}
          />
          {errors.email && <span className="error">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={loading}
          />
          {errors.password && <span className="error">{errors.password}</span>}
        </div>

        {errors.general && (
          <div className="error-message">{errors.general}</div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <div className="links">
        <a href="/forgot-password">Forgot Password?</a>
        <a href="/signup">Create Account</a>
      </div>
    </div>
  );
}

function HomePage() {
  const { user, userData, loading, authenticated } = useAuth(auth, db);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);

  useEffect(() => {
    if (authenticated && user) {
      loadUserData();
    }
  }, [authenticated, user]);

  const loadUserData = async () => {
    // Get followers using shared service
    const followersResult = await UserService.getFollowers(db, user.uid);
    if (followersResult.success) {
      setFollowers(followersResult.data);
    }

    // Load posts (you would create a postService.js for this)
    // const postsResult = await PostService.getUserPosts(db, user.uid);
  };

  const handleFollowUser = async (targetUserId) => {
    const result = await UserService.followUser(db, user.uid, targetUserId);
    if (result.success) {
      console.log('✅ User followed');
      // Refresh followers list
      loadUserData();
    }
  };

  const handleLogout = async () => {
    await AuthService.logout(auth);
    window.location.href = '/login';
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!authenticated) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div className="home-container">
      <header>
        <h1>Social Vibing</h1>
        <div className="user-info">
          <img 
            src={userData?.photoURL || '/default-avatar.png'} 
            alt="Profile" 
            className="avatar"
          />
          <span>{userData?.displayName}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main>
        <div className="profile-stats">
          <div>
            <strong>{userData?.followers?.length || 0}</strong>
            <span>Followers</span>
          </div>
          <div>
            <strong>{userData?.following?.length || 0}</strong>
            <span>Following</span>
          </div>
          <div>
            <strong>{userData?.coins || 0}</strong>
            <span>Coins</span>
          </div>
        </div>

        <section className="followers-section">
          <h2>Your Followers</h2>
          <div className="followers-list">
            {followers.map(follower => (
              <div key={follower.id} className="follower-card">
                <img 
                  src={follower.photoURL || '/default-avatar.png'} 
                  alt={follower.displayName}
                />
                <span>{follower.displayName}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="posts-section">
          <h2>Recent Posts</h2>
          {/* Posts would go here */}
        </section>
      </main>
    </div>
  );
}

function SignUpPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    phoneNumber: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate all fields
    const emailValidation = validateEmail(formData.email);
    const passwordValidation = validatePassword(formData.password, {
      minLength: 8,
      requireUppercase: true,
      requireNumber: true
    });

    if (!emailValidation.valid) {
      setErrors({ email: emailValidation.error });
      return;
    }

    if (!passwordValidation.valid) {
      setErrors({ password: passwordValidation.error });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    if (!formData.displayName) {
      setErrors({ displayName: 'Display name is required' });
      return;
    }

    setLoading(true);

    // Use shared service to create account
    const result = await AuthService.signUp(
      auth, 
      db, 
      formData.email, 
      formData.password,
      {
        displayName: formData.displayName,
        phoneNumber: formData.phoneNumber,
        bio: '',
        photoURL: ''
      }
    );

    if (result.success) {
      console.log('✅ Account created successfully');
      window.location.href = '/home';
    } else {
      setErrors({ general: result.error });
    }

    setLoading(false);
  };

  return (
    <div className="signup-container">
      <h1>Create Account</h1>
      
      <form onSubmit={handleSignUp}>
        <div className="form-group">
          <label>Display Name</label>
          <input
            type="text"
            name="displayName"
            value={formData.displayName}
            onChange={handleChange}
            placeholder="Your name"
            disabled={loading}
          />
          {errors.displayName && <span className="error">{errors.displayName}</span>}
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="your@email.com"
            disabled={loading}
          />
          {errors.email && <span className="error">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label>Phone (Optional)</label>
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            placeholder="+1234567890"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Minimum 8 characters"
            disabled={loading}
          />
          {errors.password && <span className="error">{errors.password}</span>}
        </div>

        <div className="form-group">
          <label>Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Re-enter password"
            disabled={loading}
          />
          {errors.confirmPassword && <span className="error">{errors.confirmPassword}</span>}
        </div>

        {errors.general && (
          <div className="error-message">{errors.general}</div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <div className="links">
        <a href="/login">Already have an account? Login</a>
      </div>
    </div>
  );
}

// Export components
export { LoginPage, HomePage, SignUpPage };
