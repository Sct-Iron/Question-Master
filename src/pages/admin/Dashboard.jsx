import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  ArrowRightIcon,
  DashboardIcon,
  MarkingIcon,
  MenuIcon,
  PendingIcon,
  PencilIcon,
  PublishedIcon,
  QuizIcon,
  ReleasedIcon,
  StudentsIcon,
} from '../../components/Icons';

const STAT_ICONS = {
  totalQuizzes: <QuizIcon />,
  publishedQuizzes: <PublishedIcon />,
  totalSubmissions: <MarkingIcon />,
  pendingReview: <PendingIcon />,
  releasedResults: <ReleasedIcon />,
  totalStudents: <StudentsIcon />,
};

export default function Dashboard() {
  const { setSidebarOpen } = useOutletContext();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    publishedQuizzes: 0,
    totalSubmissions: 0,
    pendingReview: 0,
    releasedResults: 0,
    totalStudents: 0,
  });
  const [recentQuizzes, setRecentQuizzes] = useState([]);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true);
      try {
        const quizSnap = await getDocs(collection(db, 'quizzes'));
        const quizzes = quizSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const subSnap = await getDocs(collection(db, 'submissions'));
        const submissions = subSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const published = quizzes.filter((q) => q.isPublished);
        const pending = submissions.filter((s) => !s.isReleased);
        const released = submissions.filter((s) => s.isReleased);
        const uniqueStudents = new Set(submissions.map((s) => s.studentEmail));

        setStats({
          totalQuizzes: quizzes.length,
          publishedQuizzes: published.length,
          totalSubmissions: submissions.length,
          pendingReview: pending.length,
          releasedResults: released.length,
          totalStudents: uniqueStudents.size,
        });

        setRecentQuizzes(
          [...quizzes]
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
            .slice(0, 5)
        );

        setRecentSubmissions(
          [...submissions]
            .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0))
            .slice(0, 5)
        );
      } catch (err) {
        console.error('Dashboard load error:', err);
      }
      setLoading(false);
    }

    fetchDashboard();
  }, []);

  function formatDate(ts) {
    if (!ts?.toDate) return '';
    return ts.toDate().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  }

  const statCards = [
    { key: 'totalQuizzes', label: 'Total Quizzes', className: 'purple' },
    { key: 'publishedQuizzes', label: 'Published', className: 'green' },
    { key: 'totalSubmissions', label: 'Submissions', className: 'amber' },
    { key: 'pendingReview', label: 'Pending Review', className: 'blue' },
    { key: 'releasedResults', label: 'Released', className: 'purple' },
    { key: 'totalStudents', label: 'Students', className: 'amber' },
  ];

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-topbar-title">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <div>
            <h1>Dashboard</h1>
            <p className="admin-topbar-subtitle">Overview of activity, quizzes, and student progress.</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/quiz-builder')}>
          <PencilIcon size={16} />
          New Quiz
        </button>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon"><DashboardIcon size={34} /></div>
            <h3>Loading dashboard...</h3>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              {statCards.map((item) => (
                <div className="stat-card" key={item.key}>
                  <div className={`stat-icon ${item.className}`}>
                    {STAT_ICONS[item.key]}
                  </div>
                  <div>
                    <div className="stat-value">{stats[item.key]}</div>
                    <div className="stat-label">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="section-header" style={{ marginTop: 'var(--space-8)' }}>
              <h2>Quick Actions</h2>
            </div>
            <div className="dashboard-action-grid">
              <button className="btn btn-primary btn-lg dashboard-action-button" onClick={() => navigate('/admin/quiz-builder')}>
                <PencilIcon size={18} />
                <span>Create Quiz</span>
              </button>
              <button className="btn btn-outline btn-lg dashboard-action-button" onClick={() => navigate('/admin/quizzes')}>
                <QuizIcon size={18} />
                <span>My Quizzes</span>
              </button>
              <button className="btn btn-accent btn-lg dashboard-action-button" onClick={() => navigate('/admin/marking')}>
                <MarkingIcon size={18} />
                <span>Mark Submissions</span>
                {stats.pendingReview > 0 && (
                  <span className="dashboard-action-count">{stats.pendingReview}</span>
                )}
              </button>
            </div>

            <div className="dashboard-split-grid">
              <div>
                <div className="section-header">
                  <h2>Recent Quizzes</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/quizzes')}>
                    View all
                    <ArrowRightIcon size={15} />
                  </button>
                </div>

                {recentQuizzes.length === 0 ? (
                  <div className="empty-state dashboard-panel-empty">
                    <div className="empty-state-icon"><QuizIcon size={30} /></div>
                    <h3>No quizzes yet</h3>
                    <p>Create your first quiz to get started.</p>
                  </div>
                ) : (
                  <div className="quiz-list">
                    {recentQuizzes.map((quiz) => (
                      <div
                        className="quiz-item"
                        key={quiz.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/admin/quiz-builder/${quiz.id}`)}
                      >
                        <div className="quiz-item-color" />
                        <div className="quiz-item-info">
                          <div className="quiz-item-title">{quiz.title || 'Untitled Quiz'}</div>
                          <div className="quiz-item-meta">
                            <span>{quiz.questions?.length || 0} question{(quiz.questions?.length || 0) !== 1 ? 's' : ''}</span>
                            <span>{formatDate(quiz.createdAt)}</span>
                          </div>
                        </div>
                        <span className={`badge ${quiz.isPublished ? 'badge-success' : 'badge-warning'}`}>
                          {quiz.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="section-header">
                  <h2>Recent Submissions</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/marking')}>
                    View all
                    <ArrowRightIcon size={15} />
                  </button>
                </div>

                {recentSubmissions.length === 0 ? (
                  <div className="empty-state dashboard-panel-empty">
                    <div className="empty-state-icon"><MarkingIcon size={30} /></div>
                    <h3>No submissions yet</h3>
                    <p>Student submissions will appear here.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {recentSubmissions.map((sub) => (
                      <div
                        className="activity-item"
                        key={sub.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate('/admin/marking')}
                      >
                        <div className="submission-avatar" style={{ width: '34px', height: '34px', fontSize: 'var(--text-xs)' }}>
                          {(sub.studentEmail || '??').substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="dashboard-submission-name">{sub.studentEmail || 'Unknown'}</div>
                          <div className="dashboard-submission-meta">
                            {sub.quizTitle} • {formatDate(sub.submittedAt)}
                          </div>
                        </div>
                        <span className={`badge ${sub.isReleased ? 'badge-success' : 'badge-accent'}`}>
                          {sub.isReleased ? 'Released' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
