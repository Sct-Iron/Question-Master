import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/useAuth';
import { LogoutIcon, MarkingIcon, QuestionMasterMark, ResultsIcon } from './Icons';

function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName } = useAuth();
  const [quizInProgress, setQuizInProgress] = useState(false);
  const [quizLogoutHandler, setQuizLogoutHandler] = useState(null);
  const [logoutPromptOpen, setLogoutPromptOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    if (quizInProgress && location.pathname !== '/student/take-quiz') {
      navigate('/student/take-quiz', { replace: true });
    }
  }, [location.pathname, navigate, quizInProgress]);

  useEffect(() => {
    if (!logoutPromptOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape' && !loggingOut) {
        setLogoutPromptOpen(false);
        setLogoutError('');
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [loggingOut, logoutPromptOpen]);

  const handleLogout = async () => {
    if (quizInProgress) {
      setLogoutError('');
      setLogoutPromptOpen(true);
      return;
    }

    await signOut(auth);
    navigate('/auth', { replace: true });
  };

  const cancelLogout = () => {
    if (loggingOut) return;
    setLogoutPromptOpen(false);
    setLogoutError('');
  };

  const confirmLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError('');

    try {
      if (typeof quizLogoutHandler !== 'function') {
        throw new Error('The quiz could not be submitted. Please try again.');
      }

      const submitted = await quizLogoutHandler();
      if (!submitted) {
        throw new Error('The quiz could not be submitted. Please try again.');
      }

      await signOut(auth);
      navigate('/auth', { replace: true });
    } catch (error) {
      setLogoutError(error?.message || 'The quiz could not be submitted. Please try again.');
      setLoggingOut(false);
    }
  };

  return (
    <div className="student-page">
      <nav className="student-navbar">
        <NavLink
          to="/student/take-quiz"
          className="student-logo"
          onClick={(event) => quizInProgress && event.preventDefault()}
        >
          <div className="student-logo-icon"><QuestionMasterMark size={44} /></div>
          <span className="student-logo-text">Question Master</span>
        </NavLink>

        {!quizInProgress && <div className="student-nav-links">
          <NavLink
            to="/student/take-quiz"
            className={({ isActive }) =>
              `student-nav-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="student-nav-link-icon"><MarkingIcon /></span>
            Quizzes
          </NavLink>
          <NavLink
            to="/student/view-results"
            className={({ isActive }) =>
              `student-nav-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="student-nav-link-icon"><ResultsIcon /></span>
            My Results
          </NavLink>
        </div>}

        <button className="student-logout-button" type="button" onClick={handleLogout}>
          <LogoutIcon size={16} />
          <span>Log out</span>
        </button>
      </nav>

      <div className="student-welcome-bar">
        Welcome, {userName || 'Student'}
      </div>

      <Outlet context={{ quizInProgress, setQuizInProgress, setQuizLogoutHandler }} />

      {logoutPromptOpen && (
        <div className="logout-dialog-backdrop" role="presentation">
          <div
            className="logout-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            aria-describedby="logout-dialog-description"
          >
            <div className="logout-dialog-icon"><LogoutIcon size={22} /></div>
            <h2 id="logout-dialog-title">Are You Sure You Want To Logout?</h2>
            <p id="logout-dialog-description">
              This Quiz Will Be Submitted Automatically.
            </p>
            {logoutError && <p className="logout-dialog-error" role="alert">{logoutError}</p>}
            <div className="logout-dialog-actions">
              <button className="btn btn-outline" type="button" onClick={cancelLogout} disabled={loggingOut}>
                No, Continue Quiz
              </button>
              <button className="btn btn-danger" type="button" onClick={confirmLogout} disabled={loggingOut}>
                {loggingOut ? 'Submitting...' : 'Yes, Logout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!quizInProgress && <nav className="student-bottom-nav">
        <NavLink
          to="/student/take-quiz"
          className={({ isActive }) =>
            `student-bottom-link ${isActive ? 'active' : ''}`
          }
        >
          <span className="student-bottom-link-icon"><MarkingIcon size={18} /></span>
          Quizzes
        </NavLink>
        <NavLink
          to="/student/view-results"
          className={({ isActive }) =>
            `student-bottom-link ${isActive ? 'active' : ''}`
          }
        >
          <span className="student-bottom-link-icon"><ResultsIcon size={18} /></span>
          My Results
        </NavLink>
      </nav>}
    </div>
  );
}

export default StudentLayout;
