import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { AlertIcon, ArrowLeftIcon, CheckCircleIcon, QuizIcon, SearchIcon, TimerIcon } from '../../components/Icons';
import { formatRemainingTime, formatTimeLimit, parseTimeLimit } from '../../utils/scoring';

export default function TakeQuiz() {
  const { user } = useAuth();
  const [view, setView] = useState('browse');
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [takenQuizIds, setTakenQuizIds] = useState(new Set());
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedByTimer, setSubmittedByTimer] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const quizSnap = await getDocs(collection(db, 'quizzes'));
        const published = quizSnap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((quiz) => quiz.isPublished)
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setQuizzes(published);

        if (user?.uid) {
          const subQuery = query(collection(db, 'submissions'), where('studentId', '==', user.uid));
          const subSnap = await getDocs(subQuery);
          const taken = new Set(subSnap.docs.map((docSnap) => docSnap.data().quizId));
          setTakenQuizIds(taken);
        }
      } catch (err) {
        console.error('Error loading data:', err);
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

  function startQuiz(quiz) {
    const minutes = parseTimeLimit(quiz.timeLimitMinutes);
    setActiveQuiz(quiz);
    setAnswers({});
    setSubmitError('');
    setSubmittedByTimer(false);
    setRemainingSeconds(minutes ? minutes * 60 : null);
    setView('quiz');
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
    if (!activeQuiz || submitting) return;
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
      let mcqScore = 0;
      let mcqTotal = 0;

      const gradedAnswers = activeQuiz.questions.map((question, index) => {
        const studentAnswer = answers[index] ?? '';
        if (question.type === 'mcq') {
          mcqTotal += 1;
          const isCorrect = studentAnswer === question.correctAnswer;
          if (isCorrect) mcqScore += 1;
          return {
            questionIndex: index,
            questionText: question.text,
            type: 'mcq',
            answer: studentAnswer,
            answerText: question.options?.[studentAnswer] || '',
            correctAnswer: question.correctAnswer,
            isCorrect,
          };
        }

        return {
          questionIndex: index,
          questionText: question.text,
          type: 'essay',
          answer: studentAnswer,
          score: null,
        };
      });

      const submission = {
        quizId: activeQuiz.id,
        quizTitle: activeQuiz.title,
        studentId: user?.uid || 'anonymous',
        studentEmail: user?.email || 'anonymous',
        answers: gradedAnswers,
        mcqScore,
        mcqTotal,
        totalQuestions: activeQuiz.questions.length,
        totalCorrect: null,
        percentage: null,
        totalScore: null,
        isReleased: false,
        timeLimitMinutes: parseTimeLimit(activeQuiz.timeLimitMinutes),
        timeExpired: forceSubmit && remainingSeconds === 0,
        submittedAt: serverTimestamp(),
        releasedAt: null,
      };

      await addDoc(collection(db, 'submissions'), submission);
      setTakenQuizIds((prev) => new Set([...prev, activeQuiz.id]));
      setSubmittedByTimer(forceSubmit && remainingSeconds === 0);
      setView('submitted');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError(`Failed to submit. (${err?.code || err?.message || 'unknown'})`);
    }

    setSubmitting(false);
  }

  const submitDueToTimer = useEffectEvent(() => {
    handleSubmit(true);
  });

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
                    {essayCount > 0 && <span className="badge badge-accent">Written</span>}
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
