import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/useAuth';
import { ShieldIcon, RefreshIcon, LogoutIcon } from '../components/Icons';

const css = `
  .pending-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f7fafb;
    padding: 24px;
    font-family: var(--font-body);
  }

  .pending-card {
    max-width: 480px;
    width: 100%;
    text-align: center;
    background: #fff;
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 1.8rem;
    padding: 3rem 2rem;
    box-shadow:
      0 20px 45px rgba(15, 23, 42, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.75);
    position: relative;
    overflow: hidden;
  }

  .pending-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 160px; height: 160px;
    background: rgba(11, 124, 114, 0.06);
    border-radius: 50%;
    pointer-events: none;
  }

  .pending-icon-wrap {
    width: 80px;
    height: 80px;
    margin: 0 auto 1.5rem;
    display: grid;
    place-items: center;
    border-radius: 1.5rem;
    background: rgba(11, 124, 114, 0.1);
    color: var(--primary-dark, #07645e);
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
  }

  .pending-icon-wrap.rejected {
    background: rgba(239, 68, 68, 0.1);
    color: #b42318;
  }

  .pending-title {
    font-family: var(--font-display, 'Outfit', sans-serif);
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--gray-900, #0f172a);
    margin-bottom: 0.5rem;
  }

  .pending-desc {
    font-size: 0.95rem;
    color: var(--gray-500, #64748b);
    line-height: 1.7;
    max-width: 360px;
    margin: 0 auto 2rem;
  }

  .pending-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .pending-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-body, 'Inter', sans-serif);
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
  }

  .pending-btn-primary {
    background: var(--primary, #0b7c72);
    color: #fff;
    box-shadow: 0 12px 24px rgba(11, 124, 114, 0.2);
  }

  .pending-btn-primary:hover {
    box-shadow: 0 16px 30px rgba(11, 124, 114, 0.28);
    transform: translateY(-1px);
  }

  .pending-btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .pending-btn-ghost {
    background: transparent;
    color: var(--gray-600, #475569);
    border: 1px solid rgba(148, 163, 184, 0.24);
  }

  .pending-btn-ghost:hover {
    background: rgba(15, 23, 42, 0.04);
    border-color: rgba(148, 163, 184, 0.4);
  }

  .pending-status-msg {
    margin-top: 1.5rem;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
  }

  .pending-status-approved {
    background: rgba(34, 197, 94, 0.14);
    color: #127a44;
  }

  .pending-status-rejected {
    background: rgba(239, 68, 68, 0.12);
    color: #991b1b;
  }

  @keyframes pendingSpin {
    to { transform: rotate(360deg); }
  }
  .pending-spinning svg {
    animation: pendingSpin 0.8s linear infinite;
  }
`;

export default function PendingApproval() {
  const { status, refreshStatus, role } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const isRejected = String(status || '').trim().toLowerCase() === 'rejected';
  const isApproved = String(status || '').trim().toLowerCase() === 'approved' && String(role || '').trim().toLowerCase() === 'admin';

  useEffect(() => {
    if (isApproved) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isApproved, navigate]);

  async function handleRefresh() {
    setChecking(true);
    await refreshStatus();

    // Re-read from context after refresh
    setTimeout(() => {
      setChecking(false);
    }, 800);
  }

  async function handleLogout() {
    await signOut(auth);
    navigate('/auth', { replace: true });
  }

  return (
    <>
      <style>{css}</style>
      <div className="pending-root">
        <div className="pending-card">
          <div className={`pending-icon-wrap ${isRejected ? 'rejected' : ''}`}>
            <ShieldIcon size={36} />
          </div>

          {isRejected ? (
            <>
              <h1 className="pending-title">Request Declined</h1>
              <p className="pending-desc">
                Your admin access request was not approved. You can still use Question Master as a student.
              </p>
              <div className="pending-actions">
                <button className="pending-btn pending-btn-primary" onClick={handleLogout}>
                  <LogoutIcon size={16} />
                  Sign Out & Continue as Student
                </button>
              </div>
            </>
          ) : isApproved ? (
            <>
              <h1 className="pending-title">You're Approved!</h1>
              <p className="pending-desc">
                Your admin account has been approved. You now have full access to the admin dashboard.
              </p>
              <div className="pending-actions">
                <button className="pending-btn pending-btn-primary" onClick={() => navigate('/admin/dashboard', { replace: true })}>
                  Go to Dashboard
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="pending-title">Awaiting Approval</h1>
              <p className="pending-desc">
                Your admin account is pending approval from the super admin.
                You'll be able to access the admin panel once your request is approved.
              </p>
              <div className="pending-actions">
                <button
                  className={`pending-btn pending-btn-primary ${checking ? 'pending-spinning' : ''}`}
                  onClick={handleRefresh}
                  disabled={checking}
                >
                  <RefreshIcon size={16} />
                  {checking ? 'Checking...' : 'Check Status'}
                </button>
                <button className="pending-btn pending-btn-ghost" onClick={handleLogout}>
                  <LogoutIcon size={16} />
                  Log Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
