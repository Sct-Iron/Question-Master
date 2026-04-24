import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { MenuIcon, PencilIcon, QuizIcon } from '../../components/Icons';

export default function Quizzes() {
  const navigate = useNavigate();
  const { setSidebarOpen } = useOutletContext();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    async function loadQuizzes() {
      setLoading(true);
      setError('');
      try {
        const quizzesQuery = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(quizzesQuery);
        setQuizzes(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      } catch (e) {
        console.error(e);
        setError('Failed to load quizzes. Please refresh.');
      }
      setLoading(false);
    }

    loadQuizzes();
  }, []);

  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, 'quizzes', id));
      setQuizzes((prev) => prev.filter((quiz) => quiz.id !== id));
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      setError('Failed to delete quiz. Check your permissions.');
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-topbar-title">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <div>
            <h1>My Quizzes</h1>
            <p className="admin-topbar-subtitle">Manage drafts, published quizzes, and recent changes.</p>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <button className="btn btn-primary" onClick={() => navigate('/admin/quiz-builder')}>
            <PencilIcon size={16} />
            New Quiz
          </button>
        </div>
      </div>

      <div className="admin-content">
        <section className="page-shell">
          <div className="page-hero">
            <div>
              <span className="badge badge-primary">Quiz Library</span>
              <h2>All assessments in one place</h2>
              <p>Open any quiz to edit it, or remove older items you no longer need.</p>
            </div>
          </div>

          {error && <div className="auth-error page-alert">{error}</div>}

          {loading ? (
            <div className="empty-state page-panel">
              <div className="empty-state-icon" style={{ animation: 'pulse 1.2s ease-in-out infinite' }}>
                <QuizIcon size={30} />
              </div>
              <h3>Loading quizzes...</h3>
            </div>
          ) : quizzes.length === 0 ? (
            <div className="empty-state page-panel">
              <div className="empty-state-icon"><QuizIcon size={30} /></div>
              <h3>No quizzes yet</h3>
              <p>Create your first quiz to start publishing assessments.</p>
              <button className="btn btn-primary" onClick={() => navigate('/admin/quiz-builder')}>
                <PencilIcon size={16} />
                Create Quiz
              </button>
            </div>
          ) : (
            <div className="admin-list">
              {quizzes.map((quiz) => {
                const qCount = quiz.questionCount ?? quiz.questions?.length ?? 0;
                const dateStr = quiz.createdAt?.toDate
                  ? quiz.createdAt.toDate().toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '';
                const isPendingDelete = deleteTarget === quiz.id;

                return (
                  <article key={quiz.id} className="page-panel admin-list-card">
                    <div className="admin-list-card-main">
                      <div className="admin-list-card-copy">
                        <div className="admin-list-card-row">
                          <h3>{quiz.title || 'Untitled Quiz'}</h3>
                          <span className={`badge ${quiz.isPublished ? 'badge-success' : 'badge-warning'}`}>
                            {quiz.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p>
                          {qCount} question{qCount !== 1 ? 's' : ''}
                          {dateStr ? ` • ${dateStr}` : ''}
                        </p>
                      </div>

                      <div className="admin-list-card-actions">
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/quiz-builder/${quiz.id}`)}>
                          <PencilIcon size={14} />
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(quiz.id)}>
                          Delete
                        </button>
                      </div>
                    </div>

                    {isPendingDelete && (
                      <div className="admin-inline-confirm">
                        <span>Delete "{quiz.title}"? This cannot be undone.</span>
                        <div className="admin-inline-confirm-actions">
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(quiz.id)}>
                            Yes, delete
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
