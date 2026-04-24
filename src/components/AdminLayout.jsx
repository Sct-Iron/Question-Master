import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { DashboardIcon, LogoutIcon, MarkingIcon, PencilIcon, QuizIcon } from './Icons';

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/auth', { replace: true });
  };

  return (
    <div className="admin-layout">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo">Q</div>
            <div>
              <div className="sidebar-brand-text">Question Master</div>
              <div className="sidebar-brand-sub">Admin Panel</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Main</span>

          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon"><DashboardIcon /></span>
            Dashboard
          </NavLink>

          <NavLink
            to="/admin/quizzes"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon"><QuizIcon /></span>
            My Quizzes
          </NavLink>

          <NavLink
            to="/admin/quiz-builder"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon"><PencilIcon /></span>
            Quiz Builder
          </NavLink>

          <NavLink
            to="/admin/marking"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon"><MarkingIcon /></span>
            Marking
          </NavLink>

          <span className="sidebar-section-label" style={{ marginTop: 'auto' }}>Account</span>
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-link" onClick={handleLogout} style={{ width: '100%' }}>
            <span className="sidebar-link-icon"><LogoutIcon /></span>
            Log Out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet context={{ setSidebarOpen }} />
      </main>
    </div>
  );
}

export default AdminLayout;
