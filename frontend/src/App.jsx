import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ViewAll from './pages/ViewAll';
import ViewSpecific from './pages/ViewSpecific';
import UpdateFile from './pages/UpdateFile';
import CompareFiles from './pages/CompareFiles';
import './App.css';

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <Router>
      <div className="app-container">
        <Navbar theme={theme} toggleTheme={toggleTheme} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/view-all" element={<ViewAll />} />
            <Route path="/view-specific" element={<ViewSpecific />} />
            <Route path="/update" element={<UpdateFile />} />
            <Route path="/compare" element={<CompareFiles />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
