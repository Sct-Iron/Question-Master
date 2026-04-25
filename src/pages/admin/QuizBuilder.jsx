import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { ArrowRightIcon, MenuIcon, PencilIcon, PlusIcon, QuizIcon, TimerIcon } from '../../components/Icons';
import { formatTimeLimit, parseTimeLimit } from '../../utils/scoring';

function QuestionForm({ initial, onSave, onCancel }) {
  const [qType, setQType] = useState(initial?.type || 'mcq');
  const [text, setText] = useState(initial?.text || '');
  const [options, setOptions] = useState(initial?.options || { A: '', B: '', C: '', D: '' });
  const [correct, setCorrect] = useState(initial?.correctAnswer || '');
  const [hint, setHint] = useState(initial?.hint || '');
  const [err, setErr] = useState('');

  function handleTypeSwitch(nextType) {
    setQType(nextType);
    setErr('');
  }

  function setOption(letter, value) {
    setOptions((prev) => ({ ...prev, [letter]: value }));
    if (correct === letter && !value) setCorrect('');
  }

  function save() {
    if (!text.trim()) {
      setErr('Please write the question.');
      return;
    }

    if (qType === 'mcq') {
      for (const letter of ['A', 'B', 'C', 'D']) {
        if (!options[letter].trim()) {
          setErr(`Option ${letter} is empty.`);
          return;
        }
      }

      if (!correct) {
        setErr('Select the correct answer.');
        return;
      }

      onSave({ type: 'mcq', text: text.trim(), options, correctAnswer: correct });
    } else {
      onSave({ type: 'essay', text: text.trim(), hint: hint.trim() });
    }

    setErr('');
  }

  return (
    <div className="builder-form">
      <div className="builder-type-row">
        <button
          className={`builder-type-button ${qType === 'mcq' ? 'active' : ''}`}
          type="button"
          onClick={() => handleTypeSwitch('mcq')}
        >
          Multiple Choice
        </button>
        <button
          className={`builder-type-button ${qType === 'essay' ? 'active' : ''}`}
          type="button"
          onClick={() => handleTypeSwitch('essay')}
        >
          Essay
        </button>
      </div>

      <div className="input-group">
        <label className="input-label">Question</label>
        <textarea
          className="textarea-field"
          placeholder="Type the question here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {qType === 'mcq' ? (
        <div className="builder-options-block">
          <label className="input-label">Options</label>
          <p className="builder-options-hint">Click a letter after filling an option to mark it as correct.</p>
          {['A', 'B', 'C', 'D'].map((letter) => (
            <div className="builder-option-row" key={letter}>
              <button
                className={`builder-option-letter ${correct === letter ? 'active' : ''}`}
                type="button"
                onClick={() => options[letter].trim() && setCorrect(letter)}
              >
                {letter}
              </button>
              <input
                className="input-field"
                placeholder={`Option ${letter}`}
                value={options[letter]}
                onChange={(e) => setOption(letter, e.target.value)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="input-group">
          <label className="input-label">Marking Guide</label>
          <textarea
            className="textarea-field"
            placeholder="Optional notes for grading this written question..."
            value={hint}
            onChange={(e) => setHint(e.target.value)}
          />
        </div>
      )}

      {err && <div className="auth-error">{err}</div>}

      <div className="builder-form-actions">
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" type="button" onClick={save}>
          Save Question
        </button>
      </div>
    </div>
  );
}

export default function QuizBuilder() {
  const navigate = useNavigate();
  const { setSidebarOpen } = useOutletContext();
  const { quizId } = useParams();
  const isEditing = Boolean(quizId);

  const [phase, setPhase] = useState('naming');
  const [title, setTitle] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('');
  const [questions, setQuestions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Save draft to localStorage whenever title or questions change
  useEffect(() => {
    // Don't overwrite a saved draft with empty state on first load
    if (!title && questions.length === 0) return;
    const draft = { title, questions };
    localStorage.setItem('quiz-draft', JSON.stringify(draft));
  }, [title, questions]);

  // Restore draft on mount
  useEffect(() => {
    if (isEditing) {
      // Load from Firestore as before
      async function load() {
        const snap = await getDoc(doc(db, 'quizzes', quizId));
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title);
          setQuestions(data.questions || []);
          setPhase('building');
        }
      }
      load();
    } else {
      // Restore draft from localStorage if it exists
      const saved = localStorage.getItem('quiz-draft');
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          if (draft.title || draft.questions?.length > 0) {
            setTitle(draft.title || '');
            setQuestions(draft.questions || []);
            // Skip naming phase if title already exists
            if (draft.title) setPhase('building');
          }
        } catch (e) {
          localStorage.removeItem('quiz-draft');
        }
      }
    }
  }, [quizId, isEditing]);

  function startBuilding() {
    if (!title.trim()) {
      setError('Please give the quiz a title first.');
      return;
    }

    setError('');
    setPhase('building');
    if (!isEditing) saveDraft({ phase: 'building', title, timeLimitMinutes, questions });
  }

  function saveQuestion(question) {
    if (editingIndex !== null) {
      setQuestions((prev) => {
        const updated = [...prev];
        updated[editingIndex] = question;
        return updated;
      });
      setEditingIndex(null);
    } else {
      setQuestions((prev) => [...prev, question]);
    }

    setShowForm(false);
  }

  function deleteQuestion(index) {
    if (!window.confirm('Delete this question?')) return;
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function startEdit(index) {
    setEditingIndex(index);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingIndex(null);
  }

  async function handlePublish() {
    setError('');
    setSuccess('');

    if (!title.trim()) {
      setError('Please give the quiz a title.');
      return;
    }

    if (questions.length === 0) {
      setError('Add at least one question before publishing.');
      return;
    }

    const parsedTimeLimit = parseTimeLimit(timeLimitMinutes);
    if (timeLimitMinutes.trim() && parsedTimeLimit === null) {
      setError('Time limit must be a whole number greater than 0.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        questionCount: questions.length,
        questions,
        isPublished: true,
        timeLimitMinutes: parsedTimeLimit,
      };

      if (isEditing) {
        payload.updatedAt = serverTimestamp();
        await updateDoc(doc(db, 'quizzes', quizId), payload);
        setSuccess('Quiz updated successfully.');
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, 'quizzes'), payload);
        localStorage.removeItem('quiz-draft');
        setSuccess('Quiz published successfully.');
      }

      setTimeout(() => navigate('/admin/quizzes'), 1200);
    } catch (e) {
      console.error('Firestore error:', e);
      const code = e?.code || e?.message || 'unknown';
      setError(`Failed to save quiz. (${code})`);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-topbar-title">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <div>
            <h1>{phase === 'naming' ? 'Quiz Setup' : isEditing ? 'Edit Quiz' : 'Quiz Builder'}</h1>
            <p className="admin-topbar-subtitle">
              {phase === 'naming'
                ? 'Start with a title and optional time limit.'
                : 'Add questions, set a time limit, and publish when ready.'}
            </p>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/admin/quizzes')}>
            <QuizIcon size={16} />
            Back to Quizzes
          </button>
        </div>
      </div>

      <div className="admin-content">
        <section className="page-shell">
          {phase === 'naming' ? (
            <div className="page-panel builder-shell">
              <div className="page-hero page-hero-compact">
                <div>
                  <span className="badge badge-primary">Step 1</span>
                  <h2>Name your quiz</h2>
                  <p>Set the title first, and choose a time limit if the quiz should be timed.</p>
                </div>
              </div>

              {error && <div className="auth-error page-alert">{error}</div>}

              <div className="builder-settings-grid">
                <div className="input-group">
                  <label className="input-label" htmlFor="quiz-title">Quiz Title</label>
                  <input
                    id="quiz-title"
                    className="input-field builder-title-field"
                    placeholder="e.g. Biology - Cell Division"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && startBuilding()}
                    autoFocus
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="quiz-time-limit">Time Limit In Minutes</label>
                  <input
                    id="quiz-time-limit"
                    className="input-field"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Optional"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(e.target.value)}
                  />
                  <p className="builder-setting-help">
                    Leave blank if students should take the quiz without a timer.
                  </p>
                </div>
              </div>

              <div className="builder-footer-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    localStorage.removeItem('quiz-draft');
                    navigate('/admin/quizzes');
                  }}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={startBuilding}>
                  <ArrowRightIcon size={16} />
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="page-hero">
                <div>
                  <span className="badge badge-primary">{isEditing ? 'Editing' : 'New quiz'}</span>
                  <h2>{title}</h2>
                  <p>{questions.length} question{questions.length !== 1 ? 's' : ''} prepared for this assessment.</p>
                </div>
              </div>

              {error && <div className="auth-error page-alert">{error}</div>}
              {success && <div className="builder-success">{success}</div>}

              <div className="page-panel builder-shell">
                <div className="builder-panel-header">
                  <div className="builder-panel-details">
                    <div>
                      <p className="builder-panel-kicker">Quiz title</p>
                      <input
                        className="builder-panel-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Untitled quiz"
                      />
                    </div>
                    <div className="builder-time-summary">
                      <span className="builder-time-summary-label">
                        <TimerIcon size={16} />
                        Time limit
                      </span>
                      <span className="builder-time-summary-value">
                        {formatTimeLimit(parseTimeLimit(timeLimitMinutes))}
                      </span>
                    </div>
                  </div>
                  {!showForm && (
                    <button
                      className="btn btn-outline"
                      onClick={() => {
                        setEditingIndex(null);
                        setShowForm(true);
                      }}
                    >
                      <PlusIcon size={16} />
                      Add Question
                    </button>
                  )}
                </div>

                <div className="builder-settings-grid">
                  <div className="input-group">
                    <label className="input-label" htmlFor="quiz-time-limit-live">Time Limit In Minutes</label>
                    <input
                      id="quiz-time-limit-live"
                      className="input-field"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Optional"
                      value={timeLimitMinutes}
                      onChange={(e) => setTimeLimitMinutes(e.target.value)}
                    />
                    <p className="builder-setting-help">
                      Students will see this limit before they start, and the quiz will auto-submit when time runs out.
                    </p>
                  </div>
                </div>

                {questions.length === 0 && !showForm && (
                  <div className="empty-state builder-empty-state">
                    <div className="empty-state-icon"><PlusIcon size={30} /></div>
                    <h3>No questions yet</h3>
                    <p>Add your first question to start shaping the quiz.</p>
                  </div>
                )}

                <div className="builder-question-list">
                  {questions.map((question, index) => {
                    const isBeingEdited = showForm && editingIndex === index;

                    return (
                      <article key={`${question.text}-${index}`} className="builder-question-card">
                        {isBeingEdited ? (
                          <>
                            <div className="builder-question-card-head">
                              <span className="builder-question-pill">Question {index + 1}</span>
                              <span className="badge badge-warning">Editing</span>
                            </div>
                            <QuestionForm initial={question} onSave={saveQuestion} onCancel={cancelForm} />
                          </>
                        ) : (
                          <>
                            <div className="builder-question-card-head">
                              <div className="builder-question-meta">
                                <span className="builder-question-pill">Question {index + 1}</span>
                                <span className={`badge ${question.type === 'mcq' ? 'badge-primary' : 'badge-accent'}`}>
                                  {question.type === 'mcq' ? 'MCQ' : 'Essay'}
                                </span>
                              </div>
                              <div className="admin-list-card-actions">
                                <button className="btn btn-outline btn-sm" onClick={() => startEdit(index)}>
                                  <PencilIcon size={14} />
                                  Edit
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => deleteQuestion(index)}>
                                  Delete
                                </button>
                              </div>
                            </div>

                            <p className="builder-question-text">{question.text}</p>
                            {question.type === 'mcq' ? (
                              <p className="builder-question-helper">
                                Correct answer: <strong>{question.correctAnswer}</strong> - {question.options[question.correctAnswer]}
                              </p>
                            ) : (
                              <p className="builder-question-helper">
                                {question.hint ? `Marking guide: ${question.hint}` : 'No marking guide added yet.'}
                              </p>
                            )}
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>

                {showForm && editingIndex === null && (
                  <article className="builder-question-card builder-question-card-new">
                    <div className="builder-question-card-head">
                      <span className="builder-question-pill">New Question</span>
                    </div>
                    <QuestionForm initial={null} onSave={saveQuestion} onCancel={cancelForm} />
                  </article>
                )}
              </div>

              <div className="builder-footer-actions">
                <button className="btn btn-ghost" onClick={() => navigate('/admin/quizzes')}>
                  Cancel
                </button>
                <button className="btn btn-accent" onClick={handlePublish} disabled={loading}>
                  <PencilIcon size={16} />
                  {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Publish Quiz'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
