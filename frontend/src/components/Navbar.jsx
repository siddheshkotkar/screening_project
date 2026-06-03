import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, Database, Sliders, RefreshCw, Layers, Sun, Moon } from 'lucide-react';

const Navbar = ({ theme, toggleTheme }) => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <NavLink to="/" className="navbar-logo">
          <ShieldCheck className="logo-icon" />
          <span>Screening Automator</span>
        </NavLink>
        <ul className="nav-menu">
          <li className="nav-item">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Layers size={18} />
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/view-all" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Database size={18} />
              <span>All Feeds</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/view-specific" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Sliders size={18} />
              <span>Explore Feed</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/update" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <RefreshCw size={18} />
              <span>Update Data</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/compare" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <ShieldCheck size={18} />
              <span>Compare GitLab</span>
            </NavLink>
          </li>
          <li>
            <button 
              className="theme-toggle-btn" 
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
