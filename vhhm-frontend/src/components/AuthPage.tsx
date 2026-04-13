'use client';

import { useState, useEffect } from 'react';
import styles from './AuthPage.module.css';
import { useTheme } from './ThemeProvider';

interface AuthPageProps {
  onLogin: (user: any) => void;
  initialVerifyToken?: string | null;
  initialResetToken?: string | null;
}

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset' | 'verify-pending';

const API = '/api';

// ── Field wrapper — MUST be outside AuthPage to keep stable identity ──────────
// If defined inside, React remounts it on every state change, killing input focus
function Field({ label, error, success, children }: {
  label?: string;
  error?: string;
  success?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.fieldGroup}>
      {label && <label className={styles.fieldLabel}>{label}</label>}
      <div className={styles.inputWrapper}>{children}</div>
      {error && <p className={`${styles.fieldStatus} ${styles.fieldError}`}>⚠ {error}</p>}
      {!error && success && <p className={`${styles.fieldStatus} ${styles.fieldSuccess}`}>✓ {success}</p>}
    </div>
  );
}

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '#E2E8F0' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { score: 1, label: 'Too Weak', color: '#EF4444' },
    { score: 2, label: 'Weak',     color: '#F97316' },
    { score: 3, label: 'Fair',     color: '#EAB308' },
    { score: 4, label: 'Strong',   color: '#22C55E' },
    { score: 5, label: 'Very Strong', color: '#0062FF' },
  ];
  const level = levels.find(l => score <= l.score) || levels[4];
  return { score, label: level.label, color: level.color };
}

export default function AuthPage({ onLogin, initialVerifyToken, initialResetToken }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [role, setRole] = useState<'patient' | 'admin'>('patient');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'info' | 'warning'; msg: string } | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form field states
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [name, setName]         = useState('');
  const [username, setUsername] = useState('');
  const [age, setAge]           = useState('');
  const [gender, setGender]     = useState('Male');

  // Validation
  const [emailErr, setEmailErr]   = useState('');
  const [pwErr, setPwErr]         = useState('');
  const [cfErr, setCfErr]         = useState('');
  const [nameErr, setNameErr]     = useState('');
  const [userErr, setUserErr]     = useState('');

  const strength = getPasswordStrength(password);

  // Handle token-based flows from URL
  useEffect(() => {
    if (initialVerifyToken) {
      handleVerifyToken(initialVerifyToken);
    } else if (initialResetToken) {
      setMode('reset');
    }
  }, [initialVerifyToken, initialResetToken]);

  const clearErrors = () => {
    setEmailErr(''); setPwErr(''); setCfErr(''); setNameErr(''); setUserErr('');
    setAlert(null);
  };

  const validateEmail = (v: string) => {
    if (!v) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address';
    return '';
  };

  const validatePassword = (v: string) => {
    if (!v) return 'Password is required';
    if (v.length < 6) return 'At least 6 characters required';
    return '';
  };

  const handleVerifyToken = async (token: string) => {
    setLoading(true);
    setAlert({ type: 'info', msg: '⏳ Verifying your email...' });
    try {
      const res = await fetch(`${API}/verify-email?token=${token}`);
      const data = await res.json();
      if (res.ok) {
        setAlert({ type: 'success', msg: '✅ Email verified! You can now login.' });
        setMode('login');
      } else {
        setAlert({ type: 'error', msg: `❌ ${data.detail}` });
      }
    } catch {
      setAlert({ type: 'error', msg: '❌ Could not verify. Backend may be offline.' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    if (eErr) { setEmailErr(eErr); return; }
    if (pErr) { setPwErr(pErr); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('vhhm_user', JSON.stringify(data));
        if (data.role === 'admin') {
          // Fetch patients in background
          fetch(`${API}/admin/patients`).catch(() => {});
        }
        onLogin(data);
      } else if (res.status === 403) {
        setPendingEmail(email);
        setMode('verify-pending');
      } else {
        setAlert({ type: 'error', msg: `❌ ${data.detail || 'Login failed'}` });
      }
    } catch {
      // Demo fallback
      const mockUser = { id: Date.now(), email, role, name: email.split('@')[0], gender: 'Other', username: email.split('@')[0] };
      localStorage.setItem('vhhm_user', JSON.stringify(mockUser));
      setAlert({ type: 'warning', msg: '⚠️ Demo Mode: Backend offline. Logging in locally.' });
      setTimeout(() => onLogin(mockUser), 1200);
    } finally {
      setLoading(false);
    }
  };

  // ─── Signup ────────────────────────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    let valid = true;

    const eErr = validateEmail(email);
    if (eErr) { setEmailErr(eErr); valid = false; }

    if (!name.trim()) { setNameErr('Full name is required'); valid = false; }
    if (!username.trim()) { setUserErr('Username is required'); valid = false; }

    const pErr = validatePassword(password);
    if (pErr) { setPwErr(pErr); valid = false; }
    if (password !== confirm) { setCfErr('Passwords do not match'); valid = false; }

    if (!valid) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, name, username, age: parseInt(age) || 0, gender }),
      });
      const data = await res.json();
      if (res.ok) {
        setPendingEmail(email);
        if (data.email_sent) {
          setMode('verify-pending');
        } else {
          setAlert({ type: 'success', msg: '🎉 Account created! You can now login.' });
          setMode('login');
        }
      } else {
        setAlert({ type: 'error', msg: `❌ ${data.detail || 'Signup failed'}` });
      }
    } catch {
      // Demo fallback
      const newUser = { id: Date.now(), email, role, name, username, gender, age: parseInt(age) || 0 };
      if (role === 'patient') {
        const list = JSON.parse(localStorage.getItem('vhhm_local_patients') || '[]');
        list.push({ ...newUser, last_visit: 'Just now', status: 'Stable' });
        localStorage.setItem('vhhm_local_patients', JSON.stringify(list));
      }
      setAlert({ type: 'warning', msg: '⚠️ Demo Mode: Account saved locally.' });
      setTimeout(() => {
        localStorage.setItem('vhhm_user', JSON.stringify(newUser));
        onLogin(newUser);
      }, 1200);
    } finally {
      setLoading(false);
    }
  };

  // ─── Forgot Password ──────────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    const eErr = validateEmail(email);
    if (eErr) { setEmailErr(eErr); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setAlert({ type: 'success', msg: '📧 If that email exists, a reset link has been sent. Check your inbox!' });
    } catch {
      setAlert({ type: 'info', msg: '📧 Reset link sent if account exists. (Demo: Backend offline)' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Reset Password ────────────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    const pErr = validatePassword(password);
    if (pErr) { setPwErr(pErr); return; }
    if (password !== confirm) { setCfErr('Passwords do not match'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: initialResetToken, new_password: password }),
      });
      const data = await res.json();
      if (res.ok) {
        setAlert({ type: 'success', msg: '✅ Password reset! You can now login.' });
        setTimeout(() => setMode('login'), 1500);
      } else {
        setAlert({ type: 'error', msg: `❌ ${data.detail}` });
      }
    } catch {
      setAlert({ type: 'error', msg: '❌ Could not reset. Backend may be offline.' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend Verification ──────────────────────────────────────────────────
  const handleResend = async () => {
    if (!pendingEmail) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const data = await res.json();
      setAlert({ type: 'success', msg: `📧 ${data.message}` });
    } catch {
      setAlert({ type: 'error', msg: '❌ Could not resend. Backend offline.' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────
  const renderAlert = () => {
    if (!alert) return null;
    const cls = {
      error: styles.alertError,
      success: styles.alertSuccess,
      info: styles.alertInfo,
      warning: styles.alertWarning,
    }[alert.type];
    return <div className={`${styles.alert} ${cls}`}>{alert.msg}</div>;
  };

  // ─── Left Panel Features ──────────────────────────────────────────────────
  const features = [
    { icon: '🫀', title: 'Real-Time Vitals Monitoring', desc: 'Heart rate, SpO₂, blood pressure & more' },
    { icon: '🤖', title: 'AI-Powered Diagnostics', desc: 'Powered by clinical-grade machine learning' },
    { icon: '👁️', title: 'Virtual Health Twin', desc: 'Your digital health identity, always synced' },
    { icon: '🔐', title: 'HIPAA-Grade Security', desc: 'End-to-end encrypted health data' },
  ];

  return (
    <div className={styles.authWrapper}>
      {/* Animated Background */}
      <div className={styles.authBg}>
        <div className={`${styles.orb} ${styles.orb1}`} />
        <div className={`${styles.orb} ${styles.orb2}`} />
        <div className={`${styles.orb} ${styles.orb3}`} />
      </div>

      {/* Floating theme toggle */}
      <AuthThemeToggle />

      {/* Left Panel */}
      <div className={styles.leftPanel}>
        <div className={styles.brandSection}>
          <div className={styles.brandLogo}>
            <div className={styles.logoIcon}>🩺</div>
            <div>
              <div className={styles.logoText}>VHHM-AS</div>
              <div className={styles.logoSubtext}>Virtual Health Monitor</div>
            </div>
          </div>

          <h1 className={styles.brandHeadline}>
            Your Health,<br />
            <span>Monitored 24/7</span><br />
            by AI.
          </h1>

          <p className={styles.brandDesc}>
            The next-generation virtual health monitoring platform. 
            Track vitals, consult AI diagnostics, and manage patient 
            care — all in one place.
          </p>

          <div className={styles.featureList}>
            {features.map((f, i) => (
              <div key={i} className={styles.featureItem}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <div className={styles.featureText}>
                  <strong>{f.title}</strong>
                  <span>{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>

          {/* ── Verification Pending ── */}
          {mode === 'verify-pending' && (
            <>
              <div className={styles.verifyBanner}>
                <span className={styles.verifyIcon}>📬</span>
                <p className={styles.verifyTitle}>Check Your Inbox!</p>
                <p className={styles.verifyDesc}>
                  We've sent a verification link to<br />
                  <strong>{pendingEmail}</strong><br /><br />
                  Please click the link in the email to activate your account.
                </p>
                <button className={styles.resendBtn} onClick={handleResend} disabled={loading}>
                  {loading ? 'Resending...' : '📧 Resend Email'}
                </button>
              </div>
              {renderAlert()}
              <div className={styles.toggleBtn} style={{ marginTop: '24px' }}>
                <button className={styles.toggleLink} onClick={() => { setMode('login'); clearErrors(); }}>
                  ← Back to Login
                </button>
              </div>
            </>
          )}

          {/* ── Reset Password ── */}
          {mode === 'reset' && (
            <>
              <div className={styles.formHeader}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔐</div>
                <h1 className={styles.formTitle}>New Password</h1>
                <p className={styles.formSubtitle}>Choose a strong, memorable password</p>
              </div>
              {renderAlert()}
              <form className={styles.form} onSubmit={handleReset}>
                <Field label="New Password" error={pwErr}>
                  <span className={styles.inputIcon}>🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`${styles.input} ${pwErr ? styles.inputError : ''}`}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setPwErr(''); }}
                  />
                  <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </Field>
                {password && (
                  <div className={styles.strengthBar}>
                    <div className={styles.strengthTrack}>
                      <div className={styles.strengthFill} style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }} />
                    </div>
                    <span className={styles.strengthLabel} style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                )}
                <Field label="Confirm Password" error={cfErr}>
                  <span className={styles.inputIcon}>🔒</span>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className={`${styles.input} ${cfErr ? styles.inputError : confirm && !cfErr ? styles.inputSuccess : ''}`}
                    placeholder="Repeat new password"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setCfErr(''); }}
                  />
                  <button type="button" className={styles.passwordToggle} onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? '🙈' : '👁️'}
                  </button>
                </Field>
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? <><div className={styles.spinner} /> Resetting...</> : '🔑 Reset Password'}
                </button>
              </form>
            </>
          )}

          {/* ── Forgot Password ── */}
          {mode === 'forgot' && (
            <>
              <div className={styles.formHeader}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔑</div>
                <h1 className={styles.formTitle}>Forgot Password?</h1>
                <p className={styles.formSubtitle}>Enter your email and we'll send a reset link</p>
              </div>
              {renderAlert()}
              <form className={styles.form} onSubmit={handleForgot}>
                <Field label="Email Address" error={emailErr}>
                  <span className={styles.inputIcon}>✉️</span>
                  <input
                    type="email"
                    className={`${styles.input} ${emailErr ? styles.inputError : email && !emailErr ? styles.inputSuccess : ''}`}
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailErr(''); }}
                    autoFocus
                  />
                </Field>
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? <><div className={styles.spinner} /> Sending...</> : '📧 Send Reset Link'}
                </button>
              </form>
              <div className={styles.toggleBtn} style={{ marginTop: '20px' }}>
                <button className={styles.toggleLink} onClick={() => { setMode('login'); clearErrors(); }}>
                  ← Back to Login
                </button>
              </div>
            </>
          )}

          {/* ── Login ── */}
          {mode === 'login' && (
            <>
              <div className={styles.formHeader}>
                <h1 className={styles.formTitle}>Welcome Back 👋</h1>
                <p className={styles.formSubtitle}>Sign in to your health monitoring portal</p>
              </div>

              {/* Role Switcher */}
              <div className={styles.roleSwitcher}>
                <button
                  type="button"
                  className={`${styles.roleBtn} ${role === 'patient' ? styles.roleBtnActive : ''}`}
                  onClick={() => setRole('patient')}
                >
                  🧑‍🤝‍🧑 Patient
                </button>
                <button
                  type="button"
                  className={`${styles.roleBtn} ${role === 'admin' ? styles.roleBtnActive : ''}`}
                  onClick={() => setRole('admin')}
                >
                  👨‍⚕️ Doctor
                </button>
              </div>

              {renderAlert()}

              <form className={styles.form} onSubmit={handleLogin}>
                <Field label="Email Address" error={emailErr}>
                  <span className={styles.inputIcon}>✉️</span>
                  <input
                    type="email"
                    className={`${styles.input} ${emailErr ? styles.inputError : email && !emailErr ? styles.inputSuccess : ''}`}
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailErr(''); }}
                    autoFocus
                  />
                </Field>

                <Field label="Password" error={pwErr}>
                  <span className={styles.inputIcon}>🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`${styles.input} ${pwErr ? styles.inputError : ''}`}
                    placeholder="Your secure password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setPwErr(''); }}
                  />
                  <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </Field>

                <button type="button" className={styles.forgotLink} onClick={() => { setMode('forgot'); clearErrors(); }}>
                  Forgot password?
                </button>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? <><div className={styles.spinner} /> Signing in...</> : '🚀 Sign In'}
                </button>
              </form>

              <div className={styles.divider}>
                <div className={styles.dividerLine} />
                <span className={styles.dividerText}>New here?</span>
                <div className={styles.dividerLine} />
              </div>

              <div className={styles.toggleBtn}>
                Don't have an account?{' '}
                <button className={styles.toggleLink} onClick={() => { setMode('signup'); clearErrors(); }}>
                  Create one free
                </button>
              </div>
            </>
          )}

          {/* ── Signup ── */}
          {mode === 'signup' && (
            <>
              <div className={styles.formHeader}>
                <h1 className={styles.formTitle}>Create Account 🩺</h1>
                <p className={styles.formSubtitle}>Start your virtual health monitoring journey</p>
              </div>

              {/* Role Switcher */}
              <div className={styles.roleSwitcher}>
                <button
                  type="button"
                  className={`${styles.roleBtn} ${role === 'patient' ? styles.roleBtnActive : ''}`}
                  onClick={() => setRole('patient')}
                >
                  🧑‍🤝‍🧑 Patient
                </button>
                <button
                  type="button"
                  className={`${styles.roleBtn} ${role === 'admin' ? styles.roleBtnActive : ''}`}
                  onClick={() => setRole('admin')}
                >
                  👨‍⚕️ Doctor
                </button>
              </div>

              {renderAlert()}

              <form className={styles.form} onSubmit={handleSignup}>
                <Field label="Full Name" error={nameErr}>
                  <span className={styles.inputIcon}>👤</span>
                  <input
                    type="text"
                    className={`${styles.input} ${nameErr ? styles.inputError : name ? styles.inputSuccess : ''}`}
                    placeholder="Jane Doe"
                    value={name}
                    onChange={e => { setName(e.target.value); setNameErr(''); }}
                  />
                </Field>

                <Field label="Username" error={userErr}>
                  <span className={styles.inputIcon}>🏷️</span>
                  <input
                    type="text"
                    className={`${styles.input} ${userErr ? styles.inputError : username ? styles.inputSuccess : ''}`}
                    placeholder="janedoe123"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setUserErr(''); }}
                  />
                </Field>

                <Field label="Email Address" error={emailErr}>
                  <span className={styles.inputIcon}>✉️</span>
                  <input
                    type="email"
                    className={`${styles.input} ${emailErr ? styles.inputError : email && !emailErr ? styles.inputSuccess : ''}`}
                    placeholder="jane@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailErr(''); }}
                  />
                </Field>

                <div className={styles.twoCol}>
                  <Field label="Age">
                    <span className={styles.inputIcon}>🎂</span>
                    <input
                      type="number"
                      className={styles.input}
                      placeholder="25"
                      min={1} max={120}
                      value={age}
                      onChange={e => setAge(e.target.value)}
                    />
                  </Field>
                  <Field label="Gender">
                    <span className={styles.inputIcon}>⚧️</span>
                    <select
                      className={styles.select}
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                    >
                      <option value="Male">👦 Male</option>
                      <option value="Female">👧 Female</option>
                      <option value="Other">👤 Other</option>
                    </select>
                  </Field>
                </div>

                <Field label="Password" error={pwErr}>
                  <span className={styles.inputIcon}>🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`${styles.input} ${pwErr ? styles.inputError : ''}`}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setPwErr(''); }}
                  />
                  <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </Field>

                {password && (
                  <div className={styles.strengthBar}>
                    <div className={styles.strengthTrack}>
                      <div className={styles.strengthFill} style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }} />
                    </div>
                    <span className={styles.strengthLabel} style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                )}

                <Field label="Confirm Password" error={cfErr}>
                  <span className={styles.inputIcon}>✅</span>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className={`${styles.input} ${cfErr ? styles.inputError : confirm && password === confirm ? styles.inputSuccess : ''}`}
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setCfErr(''); }}
                  />
                  <button type="button" className={styles.passwordToggle} onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? '🙈' : '👁️'}
                  </button>
                </Field>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? <><div className={styles.spinner} /> Creating Account...</> : '🩺 Create My Health Twin'}
                </button>
              </form>

              <div className={styles.toggleBtn} style={{ marginTop: '12px' }}>
                Already have an account?{' '}
                <button className={styles.toggleLink} onClick={() => { setMode('login'); clearErrors(); }}>
                  Sign in
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Auth page floating theme toggle ──────────────────────────────────────────
function AuthThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 10,
        width: '42px',
        height: '42px',
        borderRadius: '12px',
        border: '1.5px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
        color: 'white',
        fontSize: '1.1rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease',
      }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
