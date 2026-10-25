import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Activity, ArrowRight, CalendarDays, FileBadge, Users } from 'lucide-react'
import type { EventData } from '@hmi/shared'
import { apiFetch } from '../../lib/api-client'
import { fetchAccessibleEvents } from '../events/event-queries'
import { AdminLayout } from '../design-system/layouts/AdminLayout'
import { useAuth } from '../../lib/use-auth'
import { DashboardSkeleton, DashboardStatsSkeleton, EventListSkeleton, EventRowsSkeleton, LoadingLabel, TableSkeleton } from '../../components/loading/LoadingUi'
import './admin-workspace.css'

const EventListPage = lazy(() => import('../events/events').then((module) => ({ default: module.EventListPage })))
const EventDetailsPage = lazy(() => import('../events/events').then((module) => ({ default: module.EventDetailsPage })))
const EventFormPage = lazy(() => import('../events/events').then((module) => ({ default: module.EventFormPage })))
const EventCertificateManagement = lazy(() => import('../certificates/EventCertificateManagement').then((module) => ({ default: module.EventCertificateManagement })))
const CertificateDetailsPage = lazy(() => import('../certificates/certificates').then((module) => ({ default: module.CertificateDetailsPage })))
const MyCertificatesPage = lazy(() => import('../certificates/certificates').then((module) => ({ default: module.MyCertificatesPage })))
const EventPickerTable = lazy(() => import('../events/EventPickerTable').then((module) => ({ default: module.EventPickerTable })))

type DashboardStats = {
  eventCount: number
  certificateCount: number
  activeCertificateCount: number
  revokedCertificateCount: number
}

const friendlyError = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'
const currentTime = () => Date.now()

function AdminDashboard() {
  const { user } = useAuth()
  const stats = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => apiFetch<DashboardStats>('/events/admin-dashboard') })
  const events = useQuery({ queryKey: ['events'], queryFn: fetchAccessibleEvents })
  const upcoming = (events.data?.events ?? []).filter((event) => event.status === 'published' && new Date(event.startDate).getTime() >= currentTime()).sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime()).slice(0, 4)
  return <>
    <div className="aw-page-heading aw-dashboard-heading"><div><p className="aw-eyebrow">YOUR WORKSPACE</p><h2>Welcome back, {user?.name?.split(' ')[0] || 'there'}</h2><p>Here’s an overview of the events and certificates you manage.</p></div><Link className="aw-button aw-button--primary" to="/admin/events/new">+ Create event</Link></div>
    {stats.isLoading ? <DashboardStatsSkeleton /> : stats.error ? <p className="notice error" role="alert">{friendlyError(stats.error)} <button type="button" onClick={() => void stats.refetch()}>Retry</button></p> : <div className="aw-stats">
      <Stat label="Events you administer" value={stats.data?.eventCount} icon={<CalendarDays size={18} />} />
      <Stat label="Participants" value="—" note="Total not provided by API" icon={<Users size={18} />} tone="blue" />
      <Stat label="Certificates issued" value={stats.data?.activeCertificateCount} icon={<FileBadge size={18} />} tone="green" />
      <Stat label="Revoked certificates" value={stats.data?.revokedCertificateCount} icon={<FileBadge size={18} />} tone="red" />
    </div>}
    <section className="aw-dashboard-grid">
      <section className="aw-panel"><header className="aw-panel-head"><div><h2>Upcoming events</h2><p>Published events scheduled next</p></div><Link to="/admin/events">View all <ArrowRight size={14} /></Link></header>
        {events.isLoading ? <EventRowsSkeleton /> : events.error ? <p className="notice error" role="alert">{friendlyError(events.error)} <button type="button" onClick={() => void events.refetch()}>Retry</button></p> : upcoming.length ? <ul className="aw-upcoming-list">{upcoming.map((event) => <li key={event.id}><span className="aw-event-icon"><CalendarDays size={17} /></span><Link to={`/admin/events/${event.id}`}><strong>{event.name}</strong><small>{new Date(event.startDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</small></Link><span className="aw-status-badge aw-status-upcoming">Upcoming</span></li>)}</ul> : <div className="aw-empty aw-empty--compact"><CalendarDays size={20} /><p>No upcoming published events.</p><Link to="/admin/events/new">Create an event</Link></div>}
      </section>
      <section className="aw-panel"><header className="aw-panel-head"><div><h2>Recent activity</h2><p>Changes across your events</p></div><Activity size={17} /></header><div className="aw-unavailable"><span><Activity size={17} /></span><strong>Activity feed isn’t available yet</strong><p>The API does not currently provide recent event activity. No sample activity is shown.</p></div></section>
    </section>
    <div className="aw-quick-actions"><Link to="/admin/events"><CalendarDays size={16} /> Manage events</Link><Link to="/admin/participants"><Users size={16} /> Participants</Link><Link to="/admin/certificates"><FileBadge size={16} /> Certificates</Link></div>
  </>
}

function Stat({ label, value, icon, tone = 'default', note }: { label: string; value: number | string | undefined; icon: ReactNode; tone?: string; note?: string }) {
  return <article className="aw-stat"><span className={`aw-stat-icon aw-stat-icon--${tone}`}>{icon}</span><div className="aw-stat-copy"><strong>{typeof value === 'number' ? value.toLocaleString() : value ?? '—'}</strong><span>{label}</span>{note && <small>{note}</small>}</div></article>
}

const participantColumns = [{
  header: 'Participants',
  className: 'participants-extra-column',
  render: (event: EventData['event']) => <span className="participants-count"><Users size={14} aria-hidden="true" /><span>{event.participantCount == null ? <span className="event-picker-muted">—</span> : event.participantCount.toLocaleString()}</span>{event.pendingParticipantCount != null && event.pendingParticipantCount > 0 && <span className="event-picker-pending">{event.pendingParticipantCount.toLocaleString()} pending</span>}</span>,
}]

const certificateColumns = [{
  header: 'Certificates',
  className: 'certificates-extra-column',
  render: (event: EventData['event']) => {
    const eligible = event.eligibleParticipantCount
    const issued = event.issuedCertificateCount
    if (eligible == null || eligible === 0) return <span className="event-picker-muted">—</span>
    const progress = Math.min(100, ((issued ?? 0) / eligible) * 100)
    return <span className="event-picker-certificate-count"><span>{issued == null ? '—' : issued.toLocaleString()} / {eligible.toLocaleString()}</span><span className="event-picker-certificate-track" aria-label={`${Math.round(progress)} percent of eligible participants have an issued certificate`}><i style={{ width: `${progress}%` }} /></span></span>
  },
}]

function EventManagementPage({ section }: { section: 'participants' | 'certificates' }) {
  const { eventId = '' } = useParams()
  const event = useQuery({ queryKey: ['events', eventId], queryFn: () => apiFetch<EventData>(`/events/${eventId}`) })
  if (event.isLoading) return <div role="status" className="aw-loading"><LoadingLabel>Loading event</LoadingLabel></div>
  if (event.error || !event.data) return <p className="notice error" role="alert">{friendlyError(event.error)} {event.error && <button type="button" onClick={() => void event.refetch()}>Retry</button>}</p>
  if (event.data.event.accessRole !== 'admin') return <p className="notice error" role="alert">Event admin access is required.</p>
  return <><div className="aw-page-heading aw-event-management-heading"><div><h2>{section === 'participants' ? 'Participants' : 'Certificates'}</h2><p>{section === 'participants' ? `Manage registrations and attendance for ${event.data.event.name}.` : `Issue and manage certificates for ${event.data.event.name}.`}</p></div><Link className="aw-button" to={`/admin/events/${eventId}`}>Event overview</Link></div><EventCertificateManagement eventId={eventId} eventName={event.data.event.name} focus={section} /></>
}

export function AdminWorkspace() {
  const { pathname } = useLocation()
  const fallback = pathname.endsWith('/dashboard') ? <DashboardSkeleton />
    : pathname.includes('/participants/') || pathname.includes('/certificates/') ? <TableSkeleton />
      : pathname.includes('/my-certificates') ? <TableSkeleton label="Loading certificates" />
        : <EventListSkeleton />
  return <AdminLayout title="Admin workspace">
    <Suspense fallback={fallback}><Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="events" element={<EventListPage admin />} />
      <Route path="events/new" element={<EventFormPage mode="create" admin />} />
      <Route path="events/:eventId/edit" element={<EventFormPage mode="edit" admin />} />
      <Route path="events/:eventId" element={<EventDetailsPage admin />} />
      <Route path="participants" element={<EventPickerTable title="Participants" subtitle="Choose an event to manage its participants, approvals and attendance." breadcrumb={[{ label: 'Dashboard', to: '/admin/dashboard' }, { label: 'Participants' }]} introLine="Review registrations, approve participants and track attendance in one place." extraColumns={participantColumns} emptyState={{ description: 'Create an event to start managing participant registrations and attendance.', primaryAction: { label: 'Create event', href: '/admin/events/new' } }} adminOnly getRowHref={(event) => `/admin/participants/${event.id}`} />} />
      <Route path="participants/:eventId" element={<EventManagementPage section="participants" />} />
      <Route path="certificates" element={<EventPickerTable title="Certificates" subtitle="Choose an event to design templates and issue certificates." breadcrumb={[{ label: 'Dashboard', to: '/admin/dashboard' }, { label: 'Certificates' }]} introLine="Manage templates, eligibility and issued certificates for each event." extraColumns={certificateColumns} emptyState={{ description: 'Create an event to start managing certificate eligibility and issuance.', primaryAction: { label: 'Create event', href: '/admin/events/new' } }} adminOnly getRowHref={(event) => `/admin/certificates/${event.id}`} />} />
      <Route path="certificates/:eventId" element={<EventManagementPage section="certificates" />} />
      <Route path="my-certificates" element={<MyCertificatesPage admin />} />
      <Route path="my-certificates/:certificateId" element={<CertificateDetailsPage admin />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes></Suspense>
  </AdminLayout>
}
