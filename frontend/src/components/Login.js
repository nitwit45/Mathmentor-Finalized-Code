import { useState } from 'react';
import { login } from '../services/api';
import './Login.css';

function Login({ onNavigate, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!password) {
      setError('Password is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await login(email, password);
      if (response.success) {
        // Call auth context login with user data
        if (onLoginSuccess) {
          onLoginSuccess(response.data);
        }
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split-container">
      <div 
        className="split-left"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/welcome_background.svg)`
        }}
      ></div>
      <div className="split-right">
        <div className="auth-container">
          <div className="auth-card">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="back-button"
              aria-label="Go back"
            >
              ← Back
            </button>
            <h1>Login</h1>
            <p className="auth-subtitle">Welcome back to Mathmentor</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={loading}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
              required
              autoComplete="current-password"
            />
          </div>
          
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <p className="auth-link">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('signup')}
            className="link-button"
          >
            Sign up
          </button>
        </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
