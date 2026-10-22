import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { db } from '../../firebase';
import { callBackend } from '../../api/backend';
import { useAuth } from '../../context/useAuth';
import { AlertIcon, ArrowLeftIcon, CheckCircleIcon, QuizIcon, SearchIcon, TimerIcon } from '../../components/Icons';
import { formatRemainingTime, formatTimeLimit, parseTimeLimit } from '../../utils/scoring';

export default function TakeQuiz() {
  const { setQuizInProgress, setQuizLogoutHandler } = useOutletContext();
  const { user } = useAuth();
  const [view, setView] = useState('browse');
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quizLoadError, setQuizLoadError] = useState('');
  const [attemptLoadError, setAttemptLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [takenQuizIds, setTakenQuizIds] = useState(new Set());
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedByTimer, setSubmittedByTimer] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setQuizLoadError('');
      setAttemptLoadError('');

      const [quizResult, attemptResult] = await Promise.allSettled([
        callBackend('listPublishedQuizzes'),
        user?.uid
          ? getDocs(query(collection(db, 'attempts'), where('studentId', '==', user.uid)))
          : Promise.resolve(null),
      ]);

      if (quizResult.status === 'fulfilled') {
        const published = quizResult.value.data.quizzes
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setQuizzes(published);
      } else {
        console.error('Failed to load published quizzes:', quizResult.reason);
        setQuizLoadError('Failed to load quizzes. Please refresh the page.');
      }

      if (attemptResult.status === 'fulfilled') {
        if (attemptResult.value) {
          const taken = new Set(attemptResult.value.docs.map((docSnap) => docSnap.data().quizId));
          setTakenQuizIds(taken);
        }
      } else {
        console.error('Failed to load quiz attempts:', attemptResult.reason);
        setAttemptLoadError('Could not load your completion status. The server will still prevent duplicate submissions.');
      }
      setLoading(false);
    }

    fetchData();
  }, [user]);

  useEffect(() => {
    const minutes = parseTimeLimit(activeQuiz?.timeLimitMinutes);
    if (view !== 'quiz' || !activeQuiz || !minutes || submitting) return undefined;

    const timerId = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current === null) return minutes * 60;
        return current > 0 ? current - 1 : 0;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [view, activeQuiz, submitting]);

  const filtered = useMemo(
    () => quizzes.filter((quiz) => quiz.title.toLowerCase().includes(searchTerm.toLowerCase())),
    [quizzes, searchTerm]
  );

  async function startQuiz(quiz) {
    const minutes = parseTimeLimit(quiz.timeLimitMinutes);
    setSubmitError('');
    try {
      const result = await callBackend('startQuiz', { quizId: quiz.id });
      setActiveQuiz(result.data.quiz);
      setAttemptId(result.data.attemptId);
    } catch (error) {
      setSubmitError(error?.message || 'Could not start this quiz.');
      return;
    }
    setAnswers({});
    setSubmittedByTimer(false);
    setRemainingSeconds(minutes ? minutes * 60 : null);
    setView('quiz');
    setQuizInProgress(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setAnswer(index, value) {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  }

  function getProgress() {
    if (!activeQuiz) return 0;
    const answered = Object.keys(answers).filter(
      (key) => answers[key] && answers[key].toString().trim() !== ''
    ).length;
    return Math.round((answered / activeQuiz.questions.length) * 100);
  }

  async function handleSubmit(forceSubmit = false) {
    if (!activeQuiz || submitting) return false;
    setSubmitError('');

    const unanswered = activeQuiz.questions.filter(
      (_, index) => !answers[index] || answers[index].toString().trim() === ''
    );

    if (!forceSubmit && unanswered.length > 0) {
      setSubmitError(`Please answer all questions. ${unanswered.length} remaining.`);
      return;
    }

    setSubmitting(true);

    try {
      const submittedAnswers = Object.fromEntries(
        activeQuiz.questions.map((question, index) => [question.id || `q-${index + 1}`, answers[index] ?? ''])
      );
      const result = await callBackend('submitQuiz', { attemptId, answers: submittedAnswers });
      setTakenQuizIds((prev) => new Set([...prev, activeQuiz.id]));
      setSubmittedByTimer(result.data?.timeExpired === true || (forceSubmit && remainingSeconds === 0));
      setView('submitted');
      setQuizInProgress(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError(`Failed to submit. (${err?.code || err?.message || 'unknown'})`);
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  const submitDueToTimer = useEffectEvent(() => {
    handleSubmit(true);
  });

  const submitForLogout = useEffectEvent(() => handleSubmit(true));

  useEffect(() => {
    const logoutHandler = view === 'quiz' && activeQuiz && attemptId
      ? submitForLogout
      : null;

    setQuizLogoutHandler(() => logoutHandler);
    return () => setQuizLogoutHandler(null);
  }, [activeQuiz, attemptId, setQuizLogoutHandler, view]);

  useEffect(() => {
    if (view === 'quiz' && activeQuiz && remainingSeconds === 0 && !submitting) {
      submitDueToTimer();
    }
  }, [remainingSeconds, view, activeQuiz, submitting]);

  if (view === 'submitted') {
    return (
      <div className="student-container">
        <div className="results-hero" style={{ paddingTop: 'var(--space-16)' }}>
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'var(--success-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)',
              animation: 'scaleIn 0.4s ease-out',
              color: 'var(--success)',
            }}
          >
            <CheckCircleIcon size={46} />
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)' }}>
            Quiz Submitted
          </h1>
          <p className="results-summary-text" style={{ maxWidth: '420px', margin: '0 auto' }}>
            Your answers for <strong>{activeQuiz?.title}</strong> have been submitted successfully.
            {submittedByTimer ? ' The timer expired, so the quiz was submitted automatically.' : ''}
            {' '}You will see your result in <strong>My Results</strong> after review.
          </p>

          <div
            style={{
              marginTop: 'var(--space-8)',
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                setView('browse');
                setActiveQuiz(null);
                setAnswers({});
                setRemainingSeconds(null);
                setQuizInProgress(false);
              }}
            >
              <ArrowLeftIcon size={16} />
              Back to Quizzes
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'quiz' && activeQuiz) {
    const progress = getProgress();
    const timeLimitMinutes = parseTimeLimit(activeQuiz.timeLimitMinutes);
    const timerWarning = remainingSeconds !== null && remainingSeconds <= 60;

    return (
      <div className="student-container">
        <div className="quiz-hero">
          <div className="quiz-hero-badge">
            <QuizIcon size={16} />
            {activeQuiz.questions.length} question{activeQuiz.questions.length !== 1 ? 's' : ''}
          </div>
          <h1>{activeQuiz.title}</h1>
          <p>Answer all questions below, then submit when you are ready.</p>
        </div>

        <div className="student-info-card">
          <div className="quiz-meta-strip">
            <div className="quiz-meta-pill">
              <TimerIcon size={16} />
              Time limit: {formatTimeLimit(timeLimitMinutes)}
            </div>
            {remainingSeconds !== null && (
              <div className={`quiz-meta-pill quiz-timer-pill ${timerWarning ? 'warning' : ''}`}>
                <TimerIcon size={16} />
                Time left: {formatRemainingTime(remainingSeconds)}
              </div>
            )}
          </div>

          <div className="quiz-progress">
            <span>Progress</span>
            <div className="quiz-progress-bar">
              <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span style={{ fontWeight: 600 }}>{progress}%</span>
          </div>
        </div>

        {activeQuiz.questions.map((question, index) => (
          <div className="student-question-card" key={index} style={{ animationDelay: `${index * 60}ms` }}>
            <div className="student-question-number">{index + 1}</div>
            <div className="student-question-text">{question.text}</div>

            {question.type === 'mcq' ? (
              <div className="mcq-options">
                {['A', 'B', 'C', 'D'].map((letter) => (
                  <div
                    key={letter}
                    className={`mcq-option ${answers[index] === letter ? 'selected' : ''}`}
                    onClick={() => setAnswer(index, letter)}
                  >
                    <div className="mcq-option-radio" />
                    <span className="mcq-option-label">{letter}.</span>
                    <span className="mcq-option-text">{question.options[letter]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <textarea
                className="textarea-field"
                placeholder="Type your answer here..."
                value={answers[index] || ''}
                onChange={(e) => setAnswer(index, e.target.value)}
                rows={4}
              />
            )}
          </div>
        ))}

        {submitError && (
          <div className="auth-error" style={{ maxWidth: '600px', margin: '0 auto var(--space-4)' }}>
            <AlertIcon size={16} />
            {submitError}
          </div>
        )}

        <div className="quiz-submit-section quiz-submit-actions">
          <button
            className="btn btn-outline"
            onClick={() => {
              if (window.confirm('Leave quiz? Your answers will not be saved.')) {
                setView('browse');
                setActiveQuiz(null);
                setAnswers({});
                setRemainingSeconds(null);
                setQuizInProgress(false);
              }
            }}
          >
            Cancel
          </button>
          <button className="btn btn-accent btn-lg" onClick={() => handleSubmit(false)} disabled={submitting}>
            {submitting ? (
              <span className="btn-loading">
                <span className="btn-spinner" />
                Submitting...
              </span>
            ) : (
              'Submit Quiz'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="student-container">
      <div className="quiz-hero">
        <div className="quiz-hero-badge">
          <QuizIcon size={16} />
          Student Portal
        </div>
        <h1>Available Quizzes</h1>
        <p>Pick a quiz below to get started.</p>
      </div>

      <div className="search-bar" style={{ marginBottom: 'var(--space-6)' }}>
        <span className="search-bar-icon"><SearchIcon size={16} /></span>
        <input
          type="text"
          placeholder="Search quizzes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {quizLoadError && (
        <div className="auth-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <AlertIcon size={16} />
          {quizLoadError}
        </div>
      )}

      {attemptLoadError && (
        <div className="auth-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <AlertIcon size={16} />
          {attemptLoadError}
        </div>
      )}

      {loading && (
        <div className="empty-state">
          <div className="empty-state-icon"><QuizIcon size={30} /></div>
          <h3>Loading quizzes...</h3>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><SearchIcon size={30} /></div>
          <h3>{searchTerm ? 'No matching quizzes' : 'No quizzes available'}</h3>
          <p>
            {searchTerm
              ? 'Try a different search term.'
              : 'Check back later. Your instructor will publish quizzes here.'}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="student-quiz-grid">
          {filtered.map((quiz, index) => {
            const mcqCount = quiz.questions?.filter((question) => question.type === 'mcq').length || 0;
            const essayCount = quiz.questions?.filter((question) => question.type === 'essay').length || 0;
            const totalQuestions = quiz.questions?.length || 0;
            const isTaken = takenQuizIds.has(quiz.id);
            const timeLimitMinutes = parseTimeLimit(quiz.timeLimitMinutes);

            return (
              <div
                className="student-quiz-card"
                key={quiz.id}
                style={{
                  animationDelay: `${index * 80}ms`,
                  opacity: isTaken ? 0.7 : 1,
                }}
              >
                <div className="student-quiz-card-accent" style={isTaken ? { background: 'var(--gray-300)' } : {}} />
                <div className="student-quiz-card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)', flexWrap: 'wrap' }}>
                    <h3 className="student-quiz-card-title" style={{ margin: 0 }}>{quiz.title}</h3>
                    {isTaken && <span className="badge badge-success">Completed</span>}
                  </div>
                  <div className="student-quiz-card-meta">
                    <span>{totalQuestions} question{totalQuestions !== 1 ? 's' : ''}</span>
                    {mcqCount > 0 && <span>• {mcqCount} MCQ</span>}
                    {essayCount > 0 && <span>• {essayCount} Essay</span>}
                  </div>
                  <div className="student-quiz-card-tags">
                    {mcqCount > 0 && <span className="badge badge-primary">Multiple Choice</span>}
                    {essayCount > 0 && <span className="badge badge-accent">Essay</span>}
                    {timeLimitMinutes && (
                      <span className="badge badge-warning">
                        <TimerIcon size={13} />
                        {formatTimeLimit(timeLimitMinutes)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="student-quiz-card-footer">
                  {isTaken ? (
                    <button className="btn btn-ghost" disabled style={{ width: '100%', cursor: 'not-allowed' }}>
                      Already submitted
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => startQuiz(quiz)}>
                      Start Quiz
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
