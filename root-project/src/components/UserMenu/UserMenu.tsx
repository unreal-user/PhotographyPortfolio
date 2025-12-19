import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import './userMenu.css';

const UserMenu: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      setIsOpen(false);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <Link to="/login" className="login-link">
        Login
      </Link>
    );
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="user-avatar">
          {user?.email?.charAt(0).toUpperCase() || 'A'}
        </span>
        <span className="user-email">{user?.email}</span>
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <p className="user-menu-email">{user?.email}</p>
          </div>

          <div className="user-menu-divider" />

          <nav className="user-menu-nav">
            {/* Future: Add admin dashboard link */}
            {/* <Link to="/admin" className="user-menu-item">
              Dashboard
            </Link> */}

            <button
              onClick={handleLogout}
              className="user-menu-item user-menu-logout"
            >
              Sign Out
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
