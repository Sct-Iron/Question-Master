import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { LogoutIcon, MarkingIcon, QuestionMasterMark, ResultsIcon } from './Icons';

function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quizInProgress, setQuizInProgress] = useState(false);

  useEffect(() => {
    if (quizInProgress && location.pathname !== '/student/take-quiz') {
      navigate('/student/take-quiz', { replace: true });
    }
  }, [location.pathname, navigate, quizInProgress]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/auth', { replace: true });
  };

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'ST';

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

        <div className="student-profile-area">
          <div
            className="student-avatar"
            onClick={() => setMenuOpen((v) => !v)}
            title={user?.email || 'Student'}
          >
            {initials}
          </div>

          {menuOpen && (
            <>
              <div
                className="student-menu-overlay"
                onClick={() => setMenuOpen(false)}
              />
              <div className="student-menu">
                <div className="student-menu-email">
                  {user?.email || 'Student'}
                </div>
                <div className="student-menu-divider" />
                <button className="student-menu-item" onClick={handleLogout}>
                  <span className="student-menu-item-icon"><LogoutIcon size={16} /></span>
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      <Outlet context={{ quizInProgress, setQuizInProgress }} />

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
