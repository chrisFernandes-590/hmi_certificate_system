import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { apiRequest } from './lib/api-client'
import { useAuth } from './lib/use-auth'
import './App.css'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RouteNavigation } from './features/navigation/RouteNavigation'
import { DatePickerDemo } from './components/date-time/DatePickerDemo'
import { AuthShellSkeleton, CertificateListSkeleton, DashboardSkeleton, DetailSkeleton, EventListSkeleton, LoadingLabel, RouteErrorBoundary, TableSkeleton } from './components/loading/LoadingUi'
import { SelectShowcase } from './components/ui/SelectShowcase'

const AdminWorkspace = lazy(() => import('./features/admin/AdminWorkspace').then((module) => ({ default: module.AdminWorkspace })))
const EventListPage = lazy(() => import('./features/events/events').then((module) => ({ default: module.EventListPage })))
const EventDetailsPage = lazy(() => import('./features/events/events').then((module) => ({ default: module.EventDetailsPage })))
const EventFormPage = lazy(() => import('./features/events/events').then((module) => ({ default: module.EventFormPage })))
const MyCertificatesPage = lazy(() => import('./features/certificates/certificates').then((module) => ({ default: module.MyCertificatesPage })))
const CertificateDetailsPage = lazy(() => import('./features/certificates/certificates').then((module) => ({ default: module.CertificateDetailsPage })))
const PublicCertificateVerificationPage = lazy(() => import('./features/certificates/certificates').then((module) => ({ default: module.PublicCertificateVerificationPage })))
const SignupPage = lazy(() => import('./features/auth/pages/SignupPage').then((module) => ({ default: module.SignupPage })))
const ForgotPasswordPage = lazy(() => import('./features/auth/pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./features/auth/pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })))
const NotFoundPage = lazy(() => import('./features/errors/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const ParticipantPage = lazy(() => import('./features/participant/ParticipantPages').then((module) => ({ default: module.ParticipantPage })))

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <AuthShellSkeleton />
  return user ? children : <Navigate to="/login" replace />
}

function OrganizerProfileGuard() {
  const { loading, profiles, activeProfile, switchProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (loading) return <AuthShellSkeleton />
  if (activeProfile?.type === 'organizer' && activeProfile.status === 'active') return <AdminWorkspace />
  const organizer = profiles.find((profile) => profile.type === 'organizer')
  return <AuthLayout title="Organizer workspace">
    {organizer?.approvalStatus === 'pending' ? <p>Your organizer profile is waiting for approval. You can continue using your participant profile while you wait.</p> : organizer?.status === 'suspended' ? <p>Your organizer profile is suspended. Contact support for help.</p> : organizer ? <><p>This page is in your organizer profile. Switch profiles and continue?</p><button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await switchProfile('organizer') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not switch profiles.') } finally { setBusy(false) } }}>{busy ? 'Switching…' : 'Switch to organizer profile and continue'}</button></> : <><p>Host events and issue certificates with an organizer profile. Your participant profile stays available.</p><Link to="/app">Go to your participant space to create an organizer profile</Link></>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <p><Link to="/app">Return to participant space</Link></p>
  </AuthLayout>
}

function AuthLayout({ title, children, footer, navigation = false }: { title: string; children: ReactNode; footer?: ReactNode; navigation?: boolean }) {
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">HMI CERTIFICATES</p>{navigation && <RouteNavigation />}<h1>{title}</h1>{children}{footer && <div className="auth-footer">{footer}</div>}</section></main>
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
  return <AuthLayout title="Your account" navigation><p>Signed in as <strong>{user?.name}</strong></p><p>{user?.email}</p><p><Link to="/admin/dashboard">Open admin workspace</Link></p><p><Link to="/events">Manage events</Link></p><p><Link to="/certificates">My certificates</Link></p>{error && <p className="notice error" role="alert">{error}</p>}<button disabled={busy} aria-busy={busy} onClick={signOut}>{busy ? <LoadingLabel>Signing out</LoadingLabel> : 'Sign out'}</button></AuthLayout>
}

function AppRoutes() {
  const { user, activeProfile } = useAuth()
  const location = useLocation()
  const pathname = location.pathname
  const fallback = pathname.startsWith('/admin/dashboard') ? <DashboardSkeleton />
    : /^\/certificates\/[^/]+$/.test(pathname) || /^\/events\/[^/]+$/.test(pathname) || /^\/admin\/events\/[^/]+$/.test(pathname) ? <DetailSkeleton />
    : pathname.includes('/participants/') || pathname.includes('/certificates/') ? <TableSkeleton />
      : pathname === '/certificates' || pathname === '/admin/my-certificates' ? <CertificateListSkeleton />
        : pathname.includes('/events') ? <EventListSkeleton />
          : <AuthShellSkeleton />
  return <RouteErrorBoundary key={pathname}><Suspense fallback={fallback}><Routes>
    {import.meta.env.DEV && <Route path="/__picker-preview" element={<DatePickerDemo />} />}
    {import.meta.env.DEV && <Route path="/__select-showcase" element={<SelectShowcase />} />}
    <Route path="/" element={<Navigate to={user ? (activeProfile?.type === 'organizer' ? '/admin/dashboard' : '/app') : '/login'} replace />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<SignupPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/verify-email" element={<VerifyPage />} />
    <Route path="/verify" element={<PublicCertificateVerificationPage />} />
    <Route path="/verify/:token" element={<PublicCertificateVerificationPage />} />
    <Route path="/account" element={<Protected><AccountPage /></Protected>} />
    <Route path="/admin/*" element={<Protected><OrganizerProfileGuard /></Protected>} />
    <Route path="/app" element={<Protected><ParticipantPage /></Protected>} />
    <Route path="/app/explore" element={<Protected><ParticipantPage section="explore" /></Protected>} />
    <Route path="/app/events" element={<Protected><ParticipantPage section="events" /></Protected>} />
    <Route path="/app/certificates" element={<Protected><ParticipantPage section="certificates" /></Protected>} />
    <Route path="/app/settings" element={<Protected><ParticipantPage section="settings" /></Protected>} />
    <Route path="/certificates" element={<Protected><MyCertificatesPage /></Protected>} />
    <Route path="/certificates/:certificateId" element={<Protected><CertificateDetailsPage /></Protected>} />
    <Route path="/events" element={<Protected><EventListPage /></Protected>} />
    <Route path="/events/new" element={<Protected><EventFormPage mode="create" /></Protected>} />
    <Route path="/events/:eventId" element={<Protected><EventDetailsPage /></Protected>} />
    <Route path="/events/:eventId/edit" element={<Protected><EventFormPage mode="edit" /></Protected>} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></Suspense></RouteErrorBoundary>
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>
}
