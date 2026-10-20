import { useState } from 'react'
import { getIdTokenResult, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { QuestionMasterMark } from './Icons'

const injectFonts = () => {
  if (document.getElementById('auth-fonts')) return
  const link = document.createElement('link')
  link.id = 'auth-fonts'
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap'
  document.head.appendChild(link)
}

const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .auth-root {
    min-height: 100vh;
    display: flex;
    font-family: 'DM Sans', sans-serif;
    background: #fff;
  }

  .auth-panel-left {
    width: 420px;
    flex-shrink: 0;
    background: #1a1a2e;
    padding: 48px 44px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }

  .auth-panel-left::before {
    content: '';
    position: absolute;
    top: -80px; right: -80px;
    width: 320px; height: 320px;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 50%;
  }

  .auth-panel-left::after {
    content: '';
    position: absolute;
    bottom: -60px; left: -60px;
    width: 240px; height: 240px;
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 50%;
  }

  .auth-logo-row {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 1;
  }

  .auth-logo-mark {
    width: 42px; height: 42px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .auth-logo-text {
    font-family: 'Playfair Display', serif;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    letter-spacing: -0.3px;
  }

  .auth-panel-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 48px 0;
    position: relative;
    z-index: 1;
  }

  .auth-panel-tagline {
    font-family: 'Playfair Display', serif;
    font-size: 32px;
    font-weight: 700;
    color: #fff;
    line-height: 1.25;
    margin-bottom: 16px;
    letter-spacing: -0.5px;
  }

  .auth-panel-tagline span {
    color: #EF9F27;
  }

  .auth-panel-desc {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    line-height: 1.7;
    max-width: 300px;
    margin-bottom: 40px;
  }

  .auth-features { display: flex; flex-direction: column; gap: 20px; }

  .auth-feature {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .auth-feature-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #534AB7;
    flex-shrink: 0;
    margin-top: 6px;
  }

  .auth-feature-text strong {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
    margin-bottom: 2px;
  }

  .auth-feature-text p {
    font-size: 12px;
    color: rgba(255,255,255,0.4);
    font-weight: 300;
  }

  .auth-panel-footer {
    font-size: 11px;
    color: rgba(255,255,255,0.2);
    position: relative; z-index: 1;
  }

  .auth-panel-right {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    background: #fff;
  }

  .auth-form-box {
    width: 100%;
    max-width: 400px;
  }

  .auth-form-heading {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 6px;
    letter-spacing: -0.4px;
  }

  .auth-form-sub {
    font-size: 14px;
    color: #888;
    margin-bottom: 32px;
    font-weight: 300;
  }

  .auth-field { margin-bottom: 18px; }

  .auth-field label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #444;
    margin-bottom: 7px;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  .auth-field input {
    width: 100%;
    padding: 12px 14px;
    border: 1.5px solid #E8E6F8;
    border-radius: 10px;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    color: #1a1a2e;
    background: #FAFAFE;
    outline: none;
    transition: border-color 0.15s;
  }

  .auth-field input:focus {
    border-color: #534AB7;
    background: #fff;
  }

  .auth-password-wrap { position: relative; }

  .auth-password-wrap input { padding-right: 44px; }

  .auth-eye {
    position: absolute;
    right: 12px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none;
    cursor: pointer;
    font-size: 16px;
    color: #aaa;
    padding: 4px;
    line-height: 1;
  }

  .auth-error {
    background: #FCEBEB;
    border: 1px solid #F09595;
    color: #791F1F;
    border-radius: 9px;
    padding: 11px 14px;
    font-size: 13px;
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .auth-submit {
    width: 100%;
    padding: 13px;
    background: #534AB7;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    margin-top: 4px;
  }

  .auth-submit:hover:not(:disabled) { background: #3C3489; }
  .auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  .auth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 22px 0;
    color: #ccc;
    font-size: 12px;
  }

  .auth-divider::before,
  .auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #eee;
  }

  .auth-toggle {
    width: 100%;
    padding: 12px;
    background: transparent;
    border: 1.5px solid #E8E6F8;
    border-radius: 10px;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    color: #534AB7;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .auth-toggle:hover {
    border-color: #534AB7;
    background: #EEEDFE;
  }

  .auth-role-selector {
    display: flex;
    gap: 0;
    margin-bottom: 18px;
    background: #F3F2FC;
    border-radius: 10px;
    padding: 4px;
    border: 1.5px solid #E8E6F8;
  }

  .auth-role-option {
    flex: 1;
    padding: 10px 14px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    background: transparent;
    color: #888;
    transition: all 0.2s ease;
  }

  .auth-role-option.active {
    background: #534AB7;
    color: #fff;
    box-shadow: 0 2px 8px rgba(83, 74, 183, 0.3);
  }

  .auth-role-option:not(.active):hover {
    color: #534AB7;
  }

  .auth-role-hint {
    font-size: 11.5px;
    color: #999;
    margin: -10px 0 18px 2px;
    line-height: 1.4;
  }

  @media (max-width: 768px) {
    .auth-root { flex-direction: column; }

    .auth-panel-left {
      width: 100%;
      padding: 32px 24px;
      min-height: auto;
    }

    .auth-panel-body { padding: 28px 0 24px; }

    .auth-panel-tagline { font-size: 24px; }

    .auth-panel-desc {
      display: block;
      margin-bottom: 28px;
    }

    .auth-features {
      flex-direction: column;
      gap: 16px;
    }

    .auth-feature-text p { display: block; }

    .auth-panel-footer { display: block; }

    .auth-panel-right { padding: 32px 20px 48px; }

    .auth-form-heading { font-size: 24px; }
  }

  @media (max-width: 400px) {
    .auth-panel-left { padding: 24px 18px; }
    .auth-panel-right { padding: 24px 16px 40px; }
    .auth-features { display: flex; }
  }
`

export default function Auth() {
  injectFonts()

  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState('student')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (mode === 'signup' && password !== confirmPassword) {
        setError('Passwords do not match.')
        setSubmitting(false)
        return
      }
      if (mode === 'login') {
        const { user } = await signInWithEmailAndPassword(auth, email, password)
        try {
          await httpsCallable(functions, 'bootstrapSuperAdmin')({})
          await user.getIdToken(true)
        } catch {
          // Normal users are expected to receive a permission-denied response here.
        }
        const tokenResult = await getIdTokenResult(user, true)
        const claims = tokenResult.claims || {}
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const data = userDoc.exists() ? userDoc.data() : {}
        const userStatus = data.status || 'approved'
        const userRole = claims.role || (data.role === 'admin' && userStatus === 'pending' ? 'admin' : 'student')

        if (userRole === 'admin' && userStatus === 'pending') {
          navigate('/pending-approval', { replace: true })
        } else if (userRole === 'admin') {
          navigate('/admin/dashboard', { replace: true })
        } else {
          navigate('/student/take-quiz', { replace: true })
        }
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        const userEmail = email.trim().toLowerCase()
        const role = selectedRole
        const status = selectedRole === 'student' ? 'approved' : 'pending'

        try {
          await setDoc(doc(db, 'users', user.uid), {
            name: name.trim(),
            email: userEmail,
            role,
            status,
            createdAt: new Date()
          })
        } catch (firestoreErr) {
          console.warn('Could not save user profile to Firestore:', firestoreErr.message)
        }

        if (role === 'admin' && status === 'pending') {
          navigate('/pending-approval', { replace: true })
        } else if (role === 'admin') {
          navigate('/admin/dashboard', { replace: true })
        } else {
          navigate('/student/take-quiz', { replace: true })
        }
      }
    } catch (err) {
      const code = err.code || ''
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Invalid email or password.')
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.')
      } else if (code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.')
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.')
      } else {
        console.error('Auth error:', err.code, err.message)
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function toggleMode() {
    setMode((m) => m === 'login' ? 'signup' : 'login')
    setError('')
    setName('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setSelectedRole('student')
  }

  return (
    <>
      <style>{css}</style>
      <div className="auth-root">
        <div className="auth-panel-left">
          <div className="auth-logo-row">
            <div className="auth-logo-mark"><QuestionMasterMark size={42} /></div>
            <span className="auth-logo-text">Question Master</span>
          </div>

          <div className="auth-panel-body">
            <h2 className="auth-panel-tagline">
              Knowledge<br />
              <span>examined.</span>
            </h2>
            <p className="auth-panel-desc">
              Create quizzes, assess answers, and deliver results all in one seamless platform built for educators.
            </p>
            <div className="auth-features">
              {[
                { label: 'Smart Quiz Builder', sub: 'MCQ and essay questions' },
                { label: 'Auto Grading', sub: 'MCQs marked instantly' },
                { label: 'Student Dashboard', sub: 'Results delivered fast' },
              ].map((f) => (
                <div className="auth-feature" key={f.label}>
                  <div className="auth-feature-dot" />
                  <div className="auth-feature-text">
                    <strong>{f.label}</strong>
                    <p>{f.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-panel-footer">
            © {new Date().getFullYear()} Question Master
          </div>
        </div>

        <div className="auth-panel-right">
          <div className="auth-form-box">
            <h1 className="auth-form-heading">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="auth-form-sub">
              {mode === 'login'
                ? 'Sign in to continue to your dashboard'
                : 'Join Question Master today'}
            </p>

            <form onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <>
                  <div className="auth-field">
                    <label htmlFor="auth-name">User Name</label>
                    <input
                      id="auth-name"
                      type="text"
                      placeholder="e.g. Chidi Okeke"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                      autoFocus
                    />
                  </div>

                  <div className="auth-field">
                    <label>I am signing up as</label>
                    <div className="auth-role-selector">
                      <button
                        type="button"
                        className={`auth-role-option ${selectedRole === 'student' ? 'active' : ''}`}
                        onClick={() => setSelectedRole('student')}
                      >
                        Student
                      </button>
                      <button
                        type="button"
                        className={`auth-role-option ${selectedRole === 'admin' ? 'active' : ''}`}
                        onClick={() => setSelectedRole('admin')}
                      >
                        Admin
                      </button>
                    </div>
                    {selectedRole === 'admin' && (
                      <p className="auth-role-hint">
                        Admin accounts require approval from the super admin before gaining access.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="auth-field">
                <label htmlFor="auth-email">Email address</label>
                <input
                  id="auth-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus={mode === 'login'}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="auth-password">Password</label>
                <div className="auth-password-wrap">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                        <line x1="2" x2="22" y1="2" y2="22"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>


              {mode === 'signup' && (
                <div className="auth-field">
                  <label htmlFor="auth-confirm-password">Confirm Password</label>
                  <div className="auth-password-wrap">
                    <input
                      id="auth-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="auth-eye"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                          <line x1="2" x2="22" y1="2" y2="22"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting
                  ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                  : (mode === 'login' ? 'Sign in' : 'Create account')}
              </button>
            </form>

            <div className="auth-divider">or</div>

            <button className="auth-toggle" type="button" onClick={toggleMode}>
              {mode === 'login'
                ? 'Create a new account'      
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
