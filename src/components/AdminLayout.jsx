import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { DashboardIcon, LogoutIcon, MarkingIcon, PencilIcon, QuestionMasterMark, QuizIcon, ShieldIcon } from './Icons';

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isSuperAdmin } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/auth', { replace: true });
  };

  // Fetch pending admin count for badge (super admin only)
  useEffect(() => {
    if (!isSuperAdmin) return;
    async function fetchPendingCount() {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const pending = usersSnap.docs.filter(d => {
          const data = d.data();
          return data.role === 'admin' && data.status === 'pending';
        });
        setPendingCount(pending.length);
      } catch (e) {
        console.warn('Could not fetch pending admin count:', e.message);
      }
    }
    fetchPendingCount();
  }, [isSuperAdmin]);

  return (
    <div className="admin-layout">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo"><QuestionMasterMark size={48} /></div>
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

          {isSuperAdmin && (
            <>
              <span className="sidebar-section-label">Management</span>
              <NavLink
                to="/admin/admin-approvals"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-link-icon"><ShieldIcon /></span>
                Admin Approvals
                {pendingCount > 0 && (
                  <span className="sidebar-badge">{pendingCount}</span>
                )}
              </NavLink>
            </>
          )}

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
