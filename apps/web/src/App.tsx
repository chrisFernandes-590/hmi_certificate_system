import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { apiRequest, type User } from './lib/api-client'
import { useAuth } from './lib/use-auth'
import './App.css'

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <main className="auth-shell"><p>Restoring your session…</p></main>
  return user ? children : <Navigate to="/login" replace />
}

function AuthLayout({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">HMI CERTIFICATES</p><h1>{title}</h1>{children}{footer && <div className="auth-footer">{footer}</div>}</section></main>
}

function FormPage({ kind }: { kind: 'login' | 'register' | 'forgot' | 'reset' }) {
  const navigate = useNavigate()
  const [query] = useSearchParams()
  const { refresh } = useAuth()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const config = {
    login: { title: 'Sign in', path: '/login', button: 'Sign in' },
    register: { title: 'Create your account', path: '/register', button: 'Create account' },
    forgot: { title: 'Reset your password', path: '/forgot-password', button: 'Send reset link' },
    reset: { title: 'Choose a new password', path: '/reset-password', button: 'Update password' },
  }[kind]
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    const form = new FormData(event.currentTarget)
    const body: Record<string, string> = Object.fromEntries(form.entries()) as Record<string, string>
    if (kind === 'reset') body.token = query.get('token') ?? ''
    try {
      const result = await apiRequest<{ user?: User; message?: string }>(config.path, { method: 'POST', body: JSON.stringify(body) })
      if (kind === 'login') { await refresh(); navigate('/account') }
      else if (kind === 'register') setMessage('If the address can be registered, a verification email has been sent. Open its link to verify your email before signing in.')
      else if (kind === 'forgot') setMessage(result.message ?? 'If an account exists for that address, reset instructions have been sent.')
      else setMessage('Password updated. You can now sign in.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed. Please try again.') }
    finally { setBusy(false) }
  }
  return <AuthLayout title={config.title} footer={kind === 'login' ? <><Link to="/register">Create account</Link><Link to="/forgot-password">Forgot password?</Link></> : kind === 'register' ? <Link to="/login">Already have an account? Sign in</Link> : <Link to="/login">Back to sign in</Link>}>
    <form className="auth-form" onSubmit={submit}>
      {kind === 'register' && <Field label="Name" name="name" autoComplete="name" required />}
      {kind !== 'reset' && <Field label="Email" name="email" type="email" autoComplete="email" required />}
      {(kind === 'login' || kind === 'register' || kind === 'reset') && <Field label={kind === 'reset' ? 'New password' : 'Password'} name={kind === 'reset' ? 'password' : 'password'} type="password" autoComplete={kind === 'login' ? 'current-password' : 'new-password'} minLength={kind === 'login' ? 1 : 12} maxLength={128} required />}
      {error && <p className="notice error" role="alert">{error}</p>}
      {message && <p className="notice success" role="status">{message}</p>}
      <button disabled={busy} type="submit">{busy ? 'Please wait…' : config.button}</button>
    </form>
  </AuthLayout>
}

function Field(props: { label: string; name: string; type?: string; autoComplete: string; required?: boolean; minLength?: number; maxLength?: number }) {
  const { label, ...inputProps } = props
  return <label className="field">{label}<input {...inputProps} /></label>
}

function VerifyPage() {
  const [query] = useSearchParams()
  const token = query.get('token')
  const [message, setMessage] = useState(token ? 'Verifying your email…' : 'Verification link is missing its token.')
  const [error, setError] = useState(!token)
  const started = useRef(false)
  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    void apiRequest<{ message: string }>('/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then((result) => setMessage(result.message)).catch((cause: unknown) => { setMessage(cause instanceof Error ? cause.message : 'Verification failed.'); setError(true) })
  }, [token])
  return <AuthLayout title="Email verification"><p className={error ? 'notice error' : 'notice'}>{message}</p><Link to="/login">Continue to sign in</Link></AuthLayout>
}

function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function signOut() {
    setBusy(true); setError('')
    try { await logout(); navigate('/login') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign out. Please try again.') }
    finally { setBusy(false) }
  }
  return <AuthLayout title="Your account"><p>Signed in as <strong>{user?.name}</strong></p><p>{user?.email}</p>{error && <p className="notice error" role="alert">{error}</p>}<button disabled={busy} onClick={signOut}>{busy ? 'Signing out…' : 'Sign out'}</button></AuthLayout>
}

function AppRoutes() {
  const { user } = useAuth()
  return <Routes>
    <Route path="/" element={<Navigate to={user ? '/account' : '/login'} replace />} />
    <Route path="/login" element={<FormPage kind="login" />} />
    <Route path="/register" element={<FormPage kind="register" />} />
    <Route path="/forgot-password" element={<FormPage kind="forgot" />} />
    <Route path="/reset-password" element={<FormPage kind="reset" />} />
    <Route path="/verify-email" element={<VerifyPage />} />
    <Route path="/account" element={<Protected><AccountPage /></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>
}
