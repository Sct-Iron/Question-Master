import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { CalendarIcon, ChevronDownIcon, ChevronUpIcon, QuizIcon, ResultsIcon, TimerIcon } from '../../components/Icons';
import { getSubmissionTotals, normalizeEssayScore } from '../../utils/scoring';

export default function ViewResults() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!user) return;

    async function fetchResults() {
      setLoading(true);
      try {
        const submissionQuery = query(
          collection(db, 'submissions'),
          where('studentId', '==', user.uid),
          where('isReleased', '==', true)
        );
        const snap = await getDocs(submissionQuery);
        const mySubmissions = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => {
            const aTime = a.releasedAt?.seconds || a.submittedAt?.seconds || 0;
            const bTime = b.releasedAt?.seconds || b.submittedAt?.seconds || 0;
            return bTime - aTime;
          });
        setSubmissions(mySubmissions);
      } catch (err) {
        console.error('Error loading results:', err);
      }
      setLoading(false);
    }

    fetchResults();
  }, [user]);

  function toggleExpand(id) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  if (loading) {
    return (
      <div className="student-container">
        <div className="quiz-hero">
          <div className="quiz-hero-badge">
            <ResultsIcon size={16} />
            Results
          </div>
          <h1>My Results</h1>
          <p>Loading your results...</p>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon"><ResultsIcon size={30} /></div>
          <h3>Loading...</h3>
        </div>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="student-container">
        <div className="quiz-hero">
          <div className="quiz-hero-badge">
            <ResultsIcon size={16} />
            Results
          </div>
          <h1>My Results</h1>
          <p>View how you performed on each quiz.</p>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon"><QuizIcon size={30} /></div>
          <h3>No results yet</h3>
          <p>Your results will appear here once your teacher reviews and releases them.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-container">
      <div className="quiz-hero">
        <div className="quiz-hero-badge">
          <ResultsIcon size={16} />
          Results
        </div>
        <h1>My Results</h1>
        <p>
          {submissions.length} result{submissions.length !== 1 ? 's' : ''} released. Tap a card to see details.
        </p>
      </div>

      <div className="results-list">
        {submissions.map((submission, index) => {
          const isOpen = expanded === submission.id;
          const totals = getSubmissionTotals(submission.answers, submission.totalQuestions);
          const earned = submission.totalCorrect ?? totals.earned;
          const totalQuestions = submission.totalQuestions ?? totals.totalQuestions;
          const percentage = submission.percentage ?? totals.percentage;
          const gradeClass =
            percentage >= 80 ? 'excellent'
              : percentage >= 60 ? 'good'
                : percentage >= 40 ? 'average'
                  : 'poor';
          const gradeColors = {
            excellent: 'var(--success)',
            good: 'var(--primary)',
            average: 'var(--accent)',
            poor: 'var(--error)',
          };
          const date = submission.releasedAt?.toDate
            ? submission.releasedAt.toDate().toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : submission.submittedAt?.toDate
              ? submission.submittedAt.toDate().toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '';

          return (
            <div className="results-card" key={submission.id} style={{ animationDelay: `${index * 70}ms` }}>
              <div className="results-card-header" onClick={() => toggleExpand(submission.id)}>
                <div className="results-card-score-circle">
                  <svg viewBox="0 0 48 48" className="rcs-ring">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="var(--gray-200)" strokeWidth="4" />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke={gradeColors[gradeClass]}
                      strokeWidth="4"
                      strokeDasharray={2 * Math.PI * 20}
                      strokeDashoffset={2 * Math.PI * 20 - (percentage / 100) * 2 * Math.PI * 20}
                      strokeLinecap="round"
                      style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                    />
                  </svg>
                  <span className="rcs-value">{percentage}%</span>
                </div>

                <div className="results-card-info">
                  <h3 className="results-card-title">{submission.quizTitle}</h3>
                  <div className="results-card-meta">
                    {date && (
                      <span>
                        <CalendarIcon size={13} />
                        {date}
                      </span>
                    )}
                    <span>
                      <QuizIcon size={13} />
                      {earned}/{totalQuestions}
                    </span>
                    {submission.timeLimitMinutes ? (
                      <span>
                        <TimerIcon size={13} />
                        {submission.timeLimitMinutes} min
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="results-card-chevron">
                  {isOpen ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
                </div>
              </div>

              {isOpen && submission.answers && (
                <div className="results-card-detail">
                  {submission.answers.map((answer, questionIndex) => {
                    const isMCQ = answer.type === 'mcq';
                    return (
                      <div className="result-item" key={questionIndex}>
                        <div className="result-item-header">
                          <div className="result-item-question">
                            <span className="student-question-number">{questionIndex + 1}</span>{' '}
                            {answer.questionText}
                          </div>

                          {isMCQ ? (
                            <div
                              className="result-item-score"
                              style={{
                                background: answer.isCorrect ? 'var(--success-light)' : 'var(--error-light)',
                                color: answer.isCorrect ? '#047857' : '#b91c1c',
                              }}
                            >
                              {answer.isCorrect ? '1/1 Correct' : '0/1 Wrong'}
                            </div>
                          ) : (
                            <div
                              className="result-item-score"
                              style={{
                                background: 'var(--primary-bg)',
                                color: 'var(--primary)',
                              }}
                            >
                              {normalizeEssayScore(answer.score)}/1 Essay
                            </div>
                          )}
                        </div>

                        <div className="result-item-answer">
                          <label>Your answer</label>
                          {isMCQ ? (
                            <div>
                              <strong>{answer.answer || '-' }.</strong> {answer.answerText || 'No answer'}
                              {!answer.isCorrect && (
                                <div style={{ marginTop: '6px', color: '#047857', fontSize: '0.85em' }}>
                                  Correct: <strong>{answer.correctAnswer}.</strong>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ whiteSpace: 'pre-wrap' }}>{answer.answer || 'No answer submitted.'}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div
                    style={{
                      marginTop: 'var(--space-5)',
                      padding: 'var(--space-4)',
                      background: 'var(--gray-50)',
                      borderRadius: 'var(--radius-lg)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)', fontWeight: 600 }}>
                      Final score
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-xl)',
                        fontWeight: 800,
                        color: gradeColors[gradeClass],
                      }}
                    >
                      {earned}/{totalQuestions} ({percentage}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
