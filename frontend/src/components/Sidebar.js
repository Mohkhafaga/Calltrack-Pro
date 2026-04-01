import React from 'react';
import { useAuth } from '../context/AuthContext';
import { FiGrid, FiPhone, FiUsers, FiLogOut } from 'react-icons/fi';

const Sidebar = ({ activePage, setActivePage }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: <FiGrid /> },
    { id: 'calls', label: 'المكالمات', icon: <FiPhone /> },
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'users', label: 'المستخدمين', icon: <FiUsers /> });
  }

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h1>CallTrack Pro</h1>
        <span>نظام إدارة المكالمات</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div>
            <div className="user-name">{user?.fullName}</div>
            <div className="user-role">{user?.role === 'admin' ? 'مدير' : 'موظف'} — تحويلة {user?.extension}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={logout}>
          <FiLogOut style={{ marginLeft: 6 }} />
          <span>تسجيل خروج</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;