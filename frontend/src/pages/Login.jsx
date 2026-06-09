import React, { useState } from 'react';
import api from '../services/api';
import Toast from '../components/Toast';
import { ShieldCheck, Loader2, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = username.trim();
    
    // Validations
    if (!user) {
      showToast('Username is required.', 'error');
      return;
    }
    if (user.length < 3) {
      showToast('Username must be at least 3 characters.', 'error');
      return;
    }
    if (!password) {
      showToast('Password is required.', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    if (!isLogin) {
      if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
      }
    }

    try {
      setSubmitting(true);
      if (isLogin) {
        // Log in
        const res = await api.post('/auth/login', {
          username: user,
          password: password
        });
        showToast('Log in successful!');
        setTimeout(() => {
          onLoginSuccess(res.data.token, res.data.username);
        }, 800);
      } else {
        // Sign up
        await api.post('/auth/signup', {
          username: user,
          password: password
        });
        showToast('Registration successful! Please sign in.');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Authentication failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page-container">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <div className="login-logo-header">
        <ShieldCheck className="login-logo-icon" size={48} />
        <h1>Screening Automator</h1>
        <p>Advanced Feed-to-Keyword Management Platform</p>
      </div>

      <div className="login-card card">
        <div className="login-tabs">
          <button 
            className={`login-tab-btn ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(true);
            }}
          >
            <LogIn size={18} />
            <span>Sign In</span>
          </button>
          <button 
            className={`login-tab-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(false);
            }}
          >
            <UserPlus size={18} />
            <span>Sign Up</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="input-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              placeholder="Enter username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
              autoComplete="username"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="password">
              Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input password-input"
                autoComplete="current-password"
                disabled={submitting}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="input-label" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter password..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                autoComplete="new-password"
                disabled={submitting}
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={submitting}
            className="btn btn-primary login-submit-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="spinner" size={18} />
                <span>{isLogin ? 'Signing In...' : 'Registering...'}</span>
              </>
            ) : (
              <span>{isLogin ? 'Sign In' : 'Sign Up'}</span>
            )}
          </button>
        </form>

        <div className="login-footer-note">
          <p>Master User Seed: <code>master_user</code> / <code>password123</code></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
