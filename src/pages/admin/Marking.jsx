import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, MenuIcon, TimerIcon } from '../../components/Icons';
import { getSubmissionTotals, normalizeEssayScore } from '../../utils/scoring';

export default function Marking() {
  const { setSidebarOpen } = useOutletContext();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [expanded, setExpanded] = useState(null);
  const [essayScores, setEssayScores] = useState({});
  const [saving, setSaving] = useState(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'submissions'));
        const all = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        all.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
        setSubmissions(all);
      } catch (err) {
        console.error('Error fetching submissions:', err);
      }
      setLoading(false);
    }

    load();
  }, []);

  const pending = submissions.filter((submission) => !submission.isReleased);
  const released = submissions.filter((submission) => submission.isReleased);
  const list = tab === 'pending' ? pending : released;

  function toggleExpand(id) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function getEssayScore(subId, qIndex) {
    if (essayScores[subId]?.[qIndex] !== undefined) {
      return essayScores[subId][qIndex];
    }

    const submission = submissions.find((item) => item.id === subId);
    const answer = submission?.answers?.[qIndex];
    if (answer?.score !== null && answer?.score !== undefined) {
      return normalizeEssayScore(answer.score, answer.maxPoints);
    }
    return '';
  }

  function setEssayScoreLocal(subId, qIndex, value) {
    const submission = submissions.find((item) => item.id === subId);
    const answer = submission?.answers?.[qIndex];
    const normalized = value === '' ? '' : normalizeEssayScore(value, answer?.maxPoints);
    setEssayScores((prev) => ({
      ...prev,
      [subId]: { ...prev[subId], [qIndex]: normalized },
    }));
  }

  function buildUpdatedAnswers(submission) {
    return submission.answers.map((answer, index) => {
      if (answer.type !== 'essay') return answer;
      return {
        ...answer,
        score: normalizeEssayScore(getEssayScore(submission.id, index), answer.maxPoints),
      };
    });
  }

  async function handleRelease(submission) {
    setSaving(submission.id);
    setFeedback('');

    try {
      const updatedAnswers = buildUpdatedAnswers(submission);
      const totals = getSubmissionTotals(updatedAnswers);

      await updateDoc(doc(db, 'submissions', submission.id), {
        answers: updatedAnswers,
        mcqScore: totals.mcqEarned,
        mcqTotal: totals.mcqTotal,
        mcqPercentage: totals.mcqPercentage,
        essayScore: totals.essayEarned,
        essayTotal: totals.essayTotal,
        essayPercentage: totals.essayPercentage,
        isReleased: true,
        releasedAt: serverTimestamp(),
      });

      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                answers: updatedAnswers,
                mcqScore: totals.mcqEarned,
                mcqTotal: totals.mcqTotal,
                mcqPercentage: totals.mcqPercentage,
                essayScore: totals.essayEarned,
                essayTotal: totals.essayTotal,
                essayPercentage: totals.essayPercentage,
                isReleased: true,
              }
            : item
        )
      );
      setExpanded(null);
      setFeedback(`Results released to ${submission.studentEmail}`);
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      console.error('Release error:', err);
      alert(`Failed to release results. ${err?.message || ''}`);
    }

    setSaving(null);
  }

  async function handleSaveMarks(submission) {
    setSaving(submission.id);
    try {
      const updatedAnswers = buildUpdatedAnswers(submission);
      const totals = getSubmissionTotals(updatedAnswers);

      await updateDoc(doc(db, 'submissions', submission.id), {
        answers: updatedAnswers,
        mcqScore: totals.mcqEarned,
        mcqTotal: totals.mcqTotal,
        mcqPercentage: totals.mcqPercentage,
        essayScore: totals.essayEarned,
        essayTotal: totals.essayTotal,
        essayPercentage: totals.essayPercentage,
      });

      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                answers: updatedAnswers,
                mcqScore: totals.mcqEarned,
                mcqTotal: totals.mcqTotal,
                mcqPercentage: totals.mcqPercentage,
                essayScore: totals.essayEarned,
                essayTotal: totals.essayTotal,
                essayPercentage: totals.essayPercentage,
              }
            : item
        )
      );
      setFeedback('Marks saved.');
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.error('Save error:', err);
      alert(`Failed to save. ${err?.message || ''}`);
    }
    setSaving(null);
  }

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-topbar-title">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <div>
            <h1>Marking</h1>
            <p className="admin-topbar-subtitle">Score each submission out of the total number of questions, then release the result.</p>
          </div>
        </div>
      </div>

      <div className="admin-content">
        <div className="marking-tabs">
          <button className={`marking-tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
            Pending ({pending.length})
          </button>
          <button className={`marking-tab ${tab === 'released' ? 'active' : ''}`} onClick={() => setTab('released')}>
            Released ({released.length})
          </button>
        </div>

        {feedback && (
          <div className="builder-success">
            <CheckCircleIcon size={16} />
            {feedback}
          </div>
        )}

        {loading && (
          <div className="empty-state">
            <div className="empty-state-icon"><CheckCircleIcon size={30} /></div>
            <h3>Loading submissions...</h3>
          </div>
        )}

        {!loading && list.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><CheckCircleIcon size={30} /></div>
            <h3>{tab === 'pending' ? 'No submissions to mark' : 'No released results yet'}</h3>
            <p>
              {tab === 'pending'
                ? 'Student submissions will appear here once they complete a quiz.'
                : 'Released results will appear here after you send them to students.'}
            </p>
          </div>
        )}

        {!loading && (
          <div className="submissions-list">
            {list.map((submission, index) => {
              const isOpen = expanded === submission.id;
              const isSaving = saving === submission.id;
              const totals = getSubmissionTotals(submission.answers);
              const mcqEarned = submission.mcqScore ?? totals.mcqEarned;
              const mcqTotal = submission.mcqTotal ?? totals.mcqTotal;
              const essayEarned = submission.essayScore ?? totals.essayEarned;
              const essayTotal = submission.essayTotal ?? totals.essayTotal;
              const date = submission.submittedAt?.toDate
                ? submission.submittedAt.toDate().toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              return (
                <div className="submission-card" key={submission.id} style={{ animationDelay: `${index * 60}ms` }}>
                  <div className="submission-header" onClick={() => toggleExpand(submission.id)} style={{ cursor: 'pointer' }}>
                    <div className="submission-avatar">
                      {(submission.studentEmail || '??').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="submission-meta">
                      <div className="submission-name">{submission.studentEmail || 'Unknown student'}</div>
                      <div className="submission-date">
                        {submission.quizTitle} • {date}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                      {submission.timeLimitMinutes ? (
                        <span className="badge badge-warning">
                          <TimerIcon size={13} />
                          {submission.timeLimitMinutes} min
                        </span>
                      ) : null}
                      {mcqTotal > 0 && <span className="badge badge-primary">MCQ: {mcqEarned}/{mcqTotal}</span>}
                      {essayTotal > 0 && <span className="badge badge-accent">Essay: {essayEarned}/{essayTotal}</span>}
                    </div>
                    <span style={{ color: 'var(--gray-400)', fontSize: 'var(--text-xs)', marginLeft: 'var(--space-2)' }}>
                      {isOpen ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
                    </span>
                  </div>

                  {isOpen && (
                    <div className="submission-body">
                      {submission.answers?.map((answer, questionIndex) => (
                        <div className="submission-answer" key={questionIndex}>
                          <div className="submission-question-text">
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '24px',
                                height: '24px',
                                background: 'var(--primary)',
                                color: 'var(--white)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 700,
                                marginRight: 'var(--space-2)',
                                flexShrink: 0,
                              }}
                            >
                              {questionIndex + 1}
                            </span>
                            {answer.questionText}
                            <span className={`badge ${answer.type === 'mcq' ? 'badge-primary' : 'badge-accent'}`} style={{ marginLeft: 'var(--space-2)' }}>
                              {answer.type === 'mcq' ? 'MCQ' : 'Essay'}
                            </span>
                          </div>

                          <div className="submission-answer-text">
                            <strong style={{ color: 'var(--gray-500)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Student answer:
                            </strong>
                            <div style={{ marginTop: '4px' }}>
                              {answer.type === 'mcq'
                                ? <span><strong>{answer.answer || '-' }.</strong> {answer.answerText || 'No answer'}</span>
                                : <div style={{ whiteSpace: 'pre-wrap' }}>{answer.answer || 'No answer submitted.'}</div>}
                            </div>
                          </div>

                          {answer.type === 'mcq' && (
                            <div
                              style={{
                                marginTop: 'var(--space-2)',
                                padding: 'var(--space-2) var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: 600,
                                background: answer.isCorrect ? 'var(--success-light)' : 'var(--error-light)',
                                color: answer.isCorrect ? '#047857' : '#b91c1c',
                              }}
                            >
                              {answer.isCorrect ? 'Correct • 1/1' : `Wrong • 0/1 • Correct answer: ${answer.correctAnswer}`}
                            </div>
                          )}

                          {answer.type === 'essay' && !submission.isReleased && (
                            <div className="submission-score-input">
                              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-600)' }}>
                                Score (0 - {answer.maxPoints ?? 1}):
                              </label>
                              <input
                                className="score-field"
                                type="number"
                                min="0"
                                max={answer.maxPoints ?? 1}
                                step="0.01"
                                placeholder="0"
                                value={getEssayScore(submission.id, questionIndex)}
                                onChange={(e) => setEssayScoreLocal(submission.id, questionIndex, e.target.value)}
                              />
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                                out of {answer.maxPoints ?? 1}
                              </span>
                            </div>
                          )}

                          {answer.type === 'essay' && submission.isReleased && (
                            <div
                              style={{
                                marginTop: 'var(--space-2)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: 600,
                                color: 'var(--primary)',
                              }}
                            >
                              Essay score: {normalizeEssayScore(answer.score, answer.maxPoints)}/{answer.maxPoints ?? 1}
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="submission-footer">
                        <div className="total-score">
                          {mcqTotal > 0 && <span>MCQ: {mcqEarned}/{mcqTotal} ({Math.round((mcqEarned / mcqTotal) * 100)}%)</span>}
                          {essayTotal > 0 && <span>Essay: {essayEarned}/{essayTotal} ({Math.round((essayEarned / essayTotal) * 100)}%)</span>}
                        </div>

                        {!submission.isReleased && (
                          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => handleSaveMarks(submission)} disabled={isSaving}>
                              {isSaving ? 'Saving...' : 'Save marks'}
                            </button>
                            <button
                              className="btn btn-accent"
                              onClick={() => {
                                const unscored = submission.answers.filter(
                                  (answer, questionIndex) =>
                                    answer.type === 'essay' &&
                                    (getEssayScore(submission.id, questionIndex) === '' || getEssayScore(submission.id, questionIndex) === undefined)
                                );
                                if (unscored.length > 0) {
                                  alert(`Please score all ${unscored.length} essay question(s) before releasing.`);
                                  return;
                                }
                                if (window.confirm(`Release results to ${submission.studentEmail}?`)) {
                                  handleRelease(submission);
                                }
                              }}
                              disabled={isSaving}
                            >
                              {isSaving ? 'Releasing...' : 'Release to student'}
                            </button>
                          </div>
                        )}

                        {submission.isReleased && (
                          <span className="badge badge-success" style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-4)' }}>
                            Released
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
