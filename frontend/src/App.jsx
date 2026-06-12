import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ViewAll from './pages/ViewAll';
import ViewSpecific from './pages/ViewSpecific';
import UpdateFile from './pages/UpdateFile';
import CompareFiles from './pages/CompareFiles';
import Login from './pages/Login';
import SourceSelect from './pages/SourceSelect';
import api from './services/api';
import { Download, LogOut, X, AlertTriangle, Loader2 } from 'lucide-react';
import './App.css';

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const [token, setToken] = useState(() => {
    return sessionStorage.getItem('token') || null;
  });

  const [username, setUsername] = useState(() => {
    return sessionStorage.getItem('username') || null;
  });

  const [hasSession, setHasSession] = useState(() => {
    return sessionStorage.getItem('hasSession') === 'true';
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [loadingSession, setLoadingSession] = useState(!!token);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Check session on mount if token exists
  useEffect(() => {
    if (!token) {
      setHasSession(false);
      setLoadingSession(false);
      return;
    }

    const checkSession = async () => {
      try {
        await api.get('/feeds');
        setHasSession(true);
        sessionStorage.setItem('hasSession', 'true');
      } catch (err) {
        if (err.response?.status === 401) {
          setToken(null);
          setUsername(null);
          setHasSession(false);
          sessionStorage.clear();
        } else if (
          err.response?.status === 400 &&
          err.response?.data?.detail?.includes("Session not initialized")
        ) {
          setHasSession(false);
          sessionStorage.removeItem('hasSession');
        } else {
          // Other connection issue, don't clear token but assume no session for now
          setHasSession(false);
        }
      } finally {
        setLoadingSession(false);
      }
    };

    checkSession();
  }, [token]);

  // Response interceptor to automatically redirect on session errors
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          if (error.response.status === 401) {
            setToken(null);
            setUsername(null);
            setHasSession(false);
            setHasChanges(false);
            sessionStorage.clear();
          } else if (
            error.response.status === 400 &&
            error.response.data?.detail?.includes("Session not initialized")
          ) {
            setHasSession(false);
            sessionStorage.removeItem('hasSession');
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLoginSuccess = (userToken, userName) => {
    setToken(userToken);
    setUsername(userName);
    sessionStorage.setItem('token', userToken);
    sessionStorage.setItem('username', userName);
    // Trigger session check/loading
    setLoadingSession(true);
  };

  const handleSelectSuccess = () => {
    setHasSession(true);
    sessionStorage.setItem('hasSession', 'true');
  };

  const handleDownload = async () => {
    try {
      const response = await api.get('/session/download', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `keywords_updated_${username}.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Could not download the session file.");
    }
  };

  const executeLogout = async () => {
    try {
      setLoggingOut(true);
      await api.post('/auth/logout');
    } catch (err) {
      console.error("Logout API failed:", err);
    } finally {
      setToken(null);
      setUsername(null);
      setHasSession(false);
      setHasChanges(false);
      sessionStorage.clear();
      setLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const handleDownloadAndLogout = async () => {
    await handleDownload();
    await executeLogout();
  };

  const handleLogoutRequest = () => {
    if (hasChanges) {
      setShowLogoutModal(true);
    } else {
      executeLogout();
    }
  };

  if (!token) {
    return (
      <div className="auth-wrapper">
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  if (loadingSession) {
    return (
      <div className="app-loader-container">
        <div className="spinner-glow"></div>
        <Loader2 className="spinner loader-spinner" size={48} />
        <p>Restoring session configuration...</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="auth-wrapper">
        <SourceSelect onSelectSuccess={handleSelectSuccess} />
      </div>
    );
  }

  return (
    <Router>
      <div className="app-container">
        <Navbar 
          theme={theme} 
          toggleTheme={toggleTheme} 
          username={username}
          onLogout={handleLogoutRequest}
        />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/view-all" element={<ViewAll />} />
            <Route path="/view-specific" element={<ViewSpecific />} />
            <Route path="/update" element={<UpdateFile setHasChanges={setHasChanges} />} />
            <Route path="/compare" element={<CompareFiles />} />
            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* LOGOUT CONFIRMATION / DOWNLOAD MODAL */}
        {showLogoutModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <div className="modal-title-container">
                  <AlertTriangle className="modal-icon text-warning" size={24} />
                  <h3>Unsaved Changes Detected</h3>
                </div>
                <button 
                  className="modal-close-btn" 
                  onClick={() => setShowLogoutModal(false)}
                  disabled={loggingOut}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '14px' }}>
                  You have made modifications (adding/removing keywords) during this session.
                </p>
                <div className="alert-info-box" style={{ margin: '14px 0' }}>
                  <span>
                    <strong>Note:</strong> Logging out will completely purge your sandboxed keywords list (<code>keywords_session_{username}.txt</code>) from the server. Download your updated copy to retain any changes.
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Would you like to download your updated file before logging out?
                </p>
              </div>
              <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowLogoutModal(false)}
                  disabled={loggingOut}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={executeLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? 'Logging out...' : 'Discard & Logout'}
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleDownloadAndLogout}
                  disabled={loggingOut}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={16} />
                  <span>Download & Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
