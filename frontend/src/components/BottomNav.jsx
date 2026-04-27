import React from 'react';
import { NavLink } from 'react-router-dom';
import './BottomNav.css';

function BottomNav() {
  return (
    <nav className="bottom-nav" id="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <span className="nav-icon">⛏</span>
        <span className="nav-label">Mine</span>
      </NavLink>
      <NavLink to="/friends" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">👥</span>
        <span className="nav-label">Friends</span>
      </NavLink>
      <NavLink to="/leaderboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🏆</span>
        <span className="nav-label">Top</span>
      </NavLink>
      <NavLink to="/withdraw" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">💰</span>
        <span className="nav-label">Wallet</span>
      </NavLink>
    </nav>
  );
}

export default BottomNav;
