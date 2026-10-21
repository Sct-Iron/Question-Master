import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { callBackend } from '../../api/backend';
import { useAuth } from '../../context/useAuth';
import { MenuIcon, ShieldIcon, UserCheckIcon, StudentsIcon } from '../../components/Icons';

export default function AdminApproval() {
  const { setSidebarOpen } = useOutletContext();
  const { isSuperAdmin } = useAuth();
  const [pendingAdmins, setPendingAdmins] = useState([]);
  const [approvedAdmins, setApprovedAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // uid being acted on
  const [tab, setTab] = useState('pending'); // 'pending' | 'approved'

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all users and filter client-side to avoid compound query permission issues
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setPendingAdmins(allUsers.filter(u => u.role === 'admin' && u.status === 'pending'));
      setApprovedAdmins(allUsers.filter(u => u.role === 'admin' && u.status === 'approved'));
    } catch (err) {
      console.error('Failed to load admins:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAdmins(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAdmins]);

  async function handleApprove(uid) {
    setActionLoading(uid);
    try {
      await callBackend('approveAdmin', { uid });
      setPendingAdmins(prev => prev.filter(u => u.id !== uid));
      // Refresh approved list
      const approvedUser = pendingAdmins.find(u => u.id === uid);
      if (approvedUser) {
        setApprovedAdmins(prev => [...prev, { ...approvedUser, status: 'approved' }]);
      }
    } catch (err) {
      console.error('Failed to approve admin:', err);
    }
    setActionLoading(null);
  }

  async function handleReject(uid) {
    if (!window.confirm('Reject this admin request? They will be downgraded to a student.')) return;
    setActionLoading(uid);
    try {
      await callBackend('rejectAdmin', { uid });
      setPendingAdmins(prev => prev.filter(u => u.id !== uid));
    } catch (err) {
      console.error('Failed to reject admin:', err);
    }
    setActionLoading(null);
  }

  async function handleRemoveAdmin(uid, name) {
    if (!window.confirm(`Remove admin access for "${name}"? They will be downgraded to a student.`)) return;
    setActionLoading(uid);
    try {
      await callBackend('rejectAdmin', { uid });
      setApprovedAdmins(prev => prev.filter(u => u.id !== uid));
    } catch (err) {
      console.error('Failed to remove admin:', err);
    }
    setActionLoading(null);
  }

  function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (!isSuperAdmin) {
    return (
      <>
        <div className="admin-topbar">
          <div className="admin-topbar-title">
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </button>
            <div>
              <h1>Access Denied</h1>
            </div>
          </div>
        </div>
        <div className="admin-content">
          <div className="empty-state page-panel">
            <div className="empty-state-icon"><ShieldIcon size={30} /></div>
            <h3>Super Admin Only</h3>
            <p>Only the super admin can manage admin approvals.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-topbar-title">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <div>
            <h1>Admin Management</h1>
            <p className="admin-topbar-subtitle">Approve new admin requests and manage existing admin accounts.</p>
          </div>
        </div>
      </div>

      <div className="admin-content">
        <section className="page-shell">
          <div className="page-hero">
            <div>
              <span className="badge badge-primary">Admin Control</span>
              <h2>Manage Admin Access</h2>
              <p>Approve or reject admin requests, and remove admin privileges from existing admins at any time.</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="approval-tabs">
            <button
              className={`approval-tab ${tab === 'pending' ? 'active' : ''}`}
              onClick={() => setTab('pending')}
            >
              <ShieldIcon size={16} />
              Pending Requests
              {pendingAdmins.length > 0 && (
                <span className="approval-tab-count">{pendingAdmins.length}</span>
              )}
            </button>
            <button
              className={`approval-tab ${tab === 'approved' ? 'active' : ''}`}
              onClick={() => setTab('approved')}
            >
              <UserCheckIcon size={16} />
              Active Admins
              {approvedAdmins.length > 0 && (
                <span className="approval-tab-count-muted">{approvedAdmins.length}</span>
              )}
            </button>
          </div>

          {loading ? (
            <div className="empty-state page-panel">
              <div className="empty-state-icon" style={{ animation: 'pulse 1.2s ease-in-out infinite' }}>
                <ShieldIcon size={30} />
              </div>
              <h3>Loading admin data...</h3>
            </div>
          ) : tab === 'pending' ? (
            /* Pending tab */
            pendingAdmins.length === 0 ? (
              <div className="empty-state page-panel">
                <div className="empty-state-icon"><ShieldIcon size={30} /></div>
                <h3>No pending requests</h3>
                <p>All admin requests have been handled. New requests will appear here.</p>
              </div>
            ) : (
              <div className="admin-list">
                {pendingAdmins.map(admin => (
                  <article key={admin.id} className="page-panel admin-list-card">
                    <div className="admin-list-card-main">
                      <div className="approval-user-info">
                        <div className="approval-avatar">
                          {(admin.name || admin.email || '??').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="admin-list-card-copy">
                          <div className="admin-list-card-row">
                            <h3>{admin.name || 'Unnamed User'}</h3>
                            <span className="badge badge-warning">Pending</span>
                          </div>
                          <p>{admin.email} {admin.createdAt ? `• Joined ${formatDate(admin.createdAt)}` : ''}</p>
                        </div>
                      </div>

                      <div className="admin-list-card-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApprove(admin.id)}
                          disabled={actionLoading === admin.id}
                        >
                          <UserCheckIcon size={14} />
                          {actionLoading === admin.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleReject(admin.id)}
                          disabled={actionLoading === admin.id}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            /* Active admins tab */
            approvedAdmins.length === 0 ? (
              <div className="empty-state page-panel">
                <div className="empty-state-icon"><StudentsIcon size={30} /></div>
                <h3>No active admins</h3>
                <p>Approved admins will appear here.</p>
              </div>
            ) : (
              <div className="admin-list">
                {approvedAdmins.map(admin => {
                  const isSelf = admin.email?.toLowerCase() === 'favoure1231@gmail.com';
                  return (
                    <article key={admin.id} className="page-panel admin-list-card">
                      <div className="admin-list-card-main">
                        <div className="approval-user-info">
                          <div className="approval-avatar">
                            {(admin.name || admin.email || '??').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="admin-list-card-copy">
                            <div className="admin-list-card-row">
                              <h3>{admin.name || 'Unnamed User'}</h3>
                              {isSelf ? (
                                <span className="badge badge-primary">Super Admin</span>
                              ) : (
                                <span className="badge badge-success">Active</span>
                              )}
                            </div>
                            <p>{admin.email} {admin.createdAt ? `• Joined ${formatDate(admin.createdAt)}` : ''}</p>
                          </div>
                        </div>

                        {!isSelf && (
                          <div className="admin-list-card-actions">
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveAdmin(admin.id, admin.name || admin.email)}
                              disabled={actionLoading === admin.id}
                            >
                              {actionLoading === admin.id ? 'Removing...' : 'Remove Admin'}
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          )}
        </section>
      </div>
    </>
  );
}
