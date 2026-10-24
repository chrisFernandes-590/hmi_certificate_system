import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, ChevronRight, CirclePlus, Clock3, MapPin, PencilLine, Users } from 'lucide-react'
import { createEventSchema, updateEventSchema, EVENT_STATUSES, type EventCreateInput, type EventData } from '@hmi/shared'
import { apiFetch } from '../../lib/api-client'
import { fetchAccessibleEvents } from './event-queries'

type EventInput = EventCreateInput
type EventFilter = 'all' | 'draft' | 'published' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
const eventKey = ['events']
const emptyEvents: EventData['event'][] = []
const friendlyError = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'
const formatDate = (date: string) => new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const formatRange = (event: Pick<EventData['event'], 'startDate' | 'endDate'>) => event.endDate ? `${new Date(event.startDate).toLocaleDateString()} – ${new Date(event.endDate).toLocaleDateString()}` : new Date(event.startDate).toLocaleDateString()

function useEvents() {
  return useQuery({ queryKey: eventKey, queryFn: fetchAccessibleEvents })
}

function derivedStatus(event: EventData['event']): Exclude<EventFilter, 'all'> {
  if (event.status !== 'published') return event.status
  const now = Date.now()
  const start = new Date(event.startDate).getTime()
  const end = event.endDate ? new Date(event.endDate).getTime() : start
  if (now < start) return 'upcoming'
  if (now <= end) return 'ongoing'
  return 'completed'
}

export function EventListPage({ admin = false }: { admin?: boolean }) {
  const events = useEvents()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<EventFilter>('all')
  const [page, setPage] = useState(1)
  const notice = (location.state as { notice?: string } | null)?.notice
  const base = admin ? '/admin/events' : '/events'
  const records = events.data?.events ?? emptyEvents
  const filtered = useMemo(() => records.filter((event) => {
    const matchesSearch = event.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    const matchesFilter = filter === 'all' || derivedStatus(event) === filter
    return matchesSearch && matchesFilter
  }), [records, search, filter])
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleEvents = filtered.slice((page - 1) * pageSize, page * pageSize)
  return <EventsLayout title="Events" description="Create and manage the events you can access." admin={admin}>
    <div className="aw-page-heading">
      <div><p>Keep event details and participant workflows in one place.</p></div>
      <Link className="aw-button aw-button--primary" to={`${base}/new`}><CirclePlus size={16} /> Create event</Link>
    </div>
    {notice && <p className="notice success" role="status">{notice}</p>}
    <section className="aw-panel" aria-label="Event list">
      <div className="aw-toolbar aw-events-toolbar">
        <label className="aw-search"><span className="visually-hidden">Search events</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search events…" /></label>
        <label className="aw-filter-label">Status <select value={filter} onChange={(event) => { setFilter(event.target.value as EventFilter); setPage(1) }}>
          <option value="all">All events</option><option value="upcoming">Upcoming</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="draft">Drafts</option><option value="cancelled">Cancelled</option>
        </select></label>
      </div>
      {events.isLoading ? <div className="aw-loading" role="status"><span className="aw-loading-dot" /> Loading your events…</div>
        : events.error ? <p className="notice error" role="alert">{friendlyError(events.error)}</p>
          : filtered.length ? <>
            <div className="aw-table-scroll"><table className="aw-table aw-events-table"><thead><tr><th>Event</th><th>Dates</th><th>Access</th><th>Status</th><th><span className="visually-hidden">Open</span></th></tr></thead><tbody>
              {visibleEvents.map((event) => <tr key={event.id}>
                <td><Link className="aw-event-name-link" to={`${base}/${event.id}`}><span className="aw-event-icon"><CalendarDays size={17} /></span><span><strong>{event.name}</strong><small>{event.description || 'No description provided'}</small></span></Link></td>
                <td>{formatRange(event)}</td><td><span className="aw-access-role">{event.accessRole}</span></td>
                <td><span className={`aw-status-badge aw-status-${derivedStatus(event)}`}>{derivedStatus(event)}</span></td>
                <td><Link className="aw-icon-link" to={`${base}/${event.id}`} aria-label={`Open ${event.name}`}><ChevronRight size={17} /></Link></td>
              </tr>)}
            </tbody></table></div>
            <div className="aw-table-footer"><span>Showing {Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} matching events</span><div><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>‹</button><span className="aw-page-count">{page} / {pageCount}</span><button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>›</button></div></div>
          </> : <div className="aw-empty"><span className="aw-empty-icon"><CalendarDays size={22} /></span><h3>{search || filter !== 'all' ? 'No matching events' : 'No events yet'}</h3><p>{search || filter !== 'all' ? 'Try changing your search or status filter.' : 'Create an event to start managing registrations and certificates.'}</p>{!search && filter === 'all' && <Link className="aw-button aw-button--primary" to={`${base}/new`}>Create event</Link>}</div>}
    </section>
  </EventsLayout>
}

export function EventDetailsPage({ admin = false }: { admin?: boolean }) {
  const { eventId = '' } = useParams()
  const event = useQuery({ queryKey: [...eventKey, eventId], queryFn: () => apiFetch<EventData>(`/events/${eventId}`) })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const archive = useMutation({ mutationFn: () => apiFetch<EventData>(`/events/${eventId}`, { method: 'DELETE' }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: eventKey }); await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }); navigate(admin ? '/admin/events' : '/events', { state: { notice: 'Event archived. Participant and certificate history was retained.' } }) } })
  if (event.isLoading) return <EventsLayout title="Event" admin={admin}><div className="aw-loading" role="status"><span className="aw-loading-dot" /> Loading event…</div></EventsLayout>
  if (event.error || !event.data) return <EventsLayout title="Event" admin={admin}><p className="notice error" role="alert">{friendlyError(event.error)}</p><Link className="aw-button" to={admin ? '/admin/events' : '/events'}>Back to events</Link></EventsLayout>
  const item = event.data.event
  const notice = (location.state as { notice?: string } | null)?.notice
  const base = admin ? '/admin/events' : '/events'
  return <EventsLayout title="" admin={admin}>
    {notice && <p className="notice success" role="status">{notice}</p>}
    <div className="aw-page-heading aw-event-page-heading">
      <div><div className="aw-event-title-row"><h1>{item.name}</h1><span className={`aw-status-badge aw-status-${derivedStatus(item)}`}>{derivedStatus(item)}</span></div><p><CalendarDays size={14} /> {formatRange(item)} <span className="aw-meta-separator">·</span> <span className="aw-access-role">{item.accessRole} access</span></p></div>
      {item.accessRole === 'admin' && <Link className="aw-button" to={`${base}/${item.id}/edit`}><PencilLine size={15} /> Edit event</Link>}
    </div>
    <div className="aw-detail-grid">
      <section className="aw-panel"><header className="aw-panel-head"><h2>Event information</h2></header><p className="aw-event-description">{item.description || 'No description has been added.'}</p><dl className="aw-detail-list"><div><dt><Clock3 size={15} /> Starts</dt><dd>{formatDate(item.startDate)}</dd></div><div><dt><Clock3 size={15} /> Ends</dt><dd>{item.endDate ? formatDate(item.endDate) : 'Not specified'}</dd></div><div><dt>Status</dt><dd><span className={`aw-status-badge aw-status-${item.status}`}>{item.status}</span></dd></div><div><dt>Access</dt><dd>{item.accessRole}</dd></div></dl></section>
      {item.accessRole === 'admin' ? <section className="aw-panel aw-event-workflows"><header className="aw-panel-head"><h2>Manage this event</h2></header><Link to={`/admin/participants/${item.id}`}><span className="aw-workflow-icon"><Users size={17} /></span><span><strong>Participants</strong><small>Review registrations and attendance</small></span><ChevronRight size={17} /></Link><Link to={`/admin/certificates/${item.id}`}><span className="aw-workflow-icon aw-workflow-icon--blue"><CalendarDays size={17} /></span><span><strong>Certificates</strong><small>Issue and manage event certificates</small></span><ChevronRight size={17} /></Link>
        <button className="aw-button aw-button--danger aw-archive-button" disabled={archive.isPending} onClick={() => { if (window.confirm('Archive this event? Its participant and certificate history will be retained.')) archive.mutate() }}>{archive.isPending ? 'Archiving…' : 'Archive event'}</button>
        {archive.error && <p className="notice error" role="alert">{friendlyError(archive.error)}</p>}
      </section> : <section className="aw-panel"><header className="aw-panel-head"><h2>Event access</h2></header><p className="aw-event-description">You have {item.accessRole} access to this event. Event management tools are available to event administrators.</p></section>}
    </div>
  </EventsLayout>
}

export function EventFormPage({ mode, admin = false }: { mode: 'create' | 'edit'; admin?: boolean }) {
  const { eventId = '' } = useParams()
  const edit = mode === 'edit'
  const existing = useQuery({ queryKey: [...eventKey, eventId], queryFn: () => apiFetch<EventData>(`/events/${eventId}`), enabled: edit })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [validation, setValidation] = useState('')
  const [name, setName] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [status, setStatus] = useState<EventInput['status'] | null>(null)
  const mutation = useMutation({
    mutationFn: (input: EventInput) => apiFetch<EventData>(edit ? `/events/${eventId}` : '/events', { method: edit ? 'PATCH' : 'POST', body: JSON.stringify(input) }),
    onSuccess: async ({ event }) => { await queryClient.invalidateQueries({ queryKey: eventKey }); await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }); navigate(`${admin ? '/admin/events' : '/events'}/${event.id}`, { state: { notice: edit ? 'Event updated successfully.' : 'Event created successfully.' } }) },
  })
  if (edit && existing.isLoading) return <EventsLayout title="Edit event" admin={admin}><div className="aw-loading" role="status"><span className="aw-loading-dot" /> Loading event…</div></EventsLayout>
  if (edit && (existing.error || !existing.data || existing.data.event.accessRole !== 'admin')) return <EventsLayout title="Edit event" admin={admin}><p className="notice error" role="alert">{existing.error ? friendlyError(existing.error) : 'Event admin access is required.'}</p><Link className="aw-button" to={admin ? '/admin/events' : '/events'}>Back to events</Link></EventsLayout>
  const item = existing.data?.event
  const currentName = name ?? item?.name ?? ''
  const currentDescription = description ?? item?.description ?? ''
  const currentStart = startDate ?? (item ? toLocalInput(item.startDate) : '')
  const currentEnd = endDate ?? (item?.endDate ? toLocalInput(item.endDate) : '')
  const currentStatus = status ?? item?.status ?? 'draft'
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setValidation('')
    const form = new FormData(event.currentTarget)
    const rawInput: EventInput = { name: String(form.get('name') ?? '').trim(), description: String(form.get('description') ?? '').trim() || null, startDate: localDateTimeToIso(String(form.get('startDate') ?? '')), endDate: form.get('endDate') ? localDateTimeToIso(String(form.get('endDate'))) : null, status: String(form.get('status') ?? 'draft') as EventInput['status'] }
    const parsed = (edit ? updateEventSchema : createEventSchema).safeParse(rawInput)
    if (!parsed.success) { setValidation(parsed.error.issues[0]?.message ?? 'Please check the event details.'); return }
    if (rawInput.endDate && new Date(rawInput.endDate) < new Date(rawInput.startDate)) { setValidation('The end date must be after the start date.'); return }
    mutation.mutate(parsed.data as EventInput)
  }
  return <EventsLayout title={edit ? 'Edit event' : 'Create a new event'} description="Add the event information used to manage registrations and certificates." admin={admin}>
    <div className="aw-form-intro"><span className="aw-form-step"><span>1</span> Event details</span><span className="aw-form-step-line" /><span className="aw-form-step is-current"><span>2</span> Schedule & settings</span></div>
    <div className="aw-wizard-layout aw-event-form-layout">
      <form className="aw-panel aw-event-form" onSubmit={submit}>
        <div className="aw-panel-head"><div><h2>Basic information</h2><p>These details identify your event across the workspace.</p></div></div>
        <label className="aw-field">Event name <span className="aw-required">Required</span><input name="name" required maxLength={200} value={currentName} onChange={(event) => setName(event.target.value)} placeholder="e.g. Tech Innovators Hackathon" /><small>{currentName.length}/200 characters</small></label>
        <label className="aw-field">Description <span className="aw-optional">Optional</span><textarea name="description" rows={4} maxLength={5000} value={currentDescription} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the event and what participants can expect." /><small>{currentDescription.length}/5000 characters</small></label>
        <h3 className="aw-subhead">Schedule</h3>
        <div className="aw-form-grid"><label className="aw-field">Start date and time <span className="aw-required">Required</span><input name="startDate" type="datetime-local" required value={currentStart} onChange={(event) => setStartDate(event.target.value)} /></label><label className="aw-field">End date and time <span className="aw-optional">Optional</span><input name="endDate" type="datetime-local" value={currentEnd} onChange={(event) => setEndDate(event.target.value)} /></label></div>
        <label className="aw-field">Event status<select name="status" value={currentStatus} onChange={(event) => setStatus(event.target.value as EventInput['status'])}>{EVENT_STATUSES.map((value) => <option key={value} value={value}>{value[0]?.toUpperCase()}{value.slice(1)}</option>)}</select><small>Choose a status supported by the event workflow.</small></label>
        {validation && <p className="notice error" role="alert">{validation}</p>}{mutation.error && <p className="notice error" role="alert">{friendlyError(mutation.error)}</p>}
        <div className="aw-wizard-footer"><Link className="aw-button" to={edit && item ? `${admin ? '/admin/events' : '/events'}/${item.id}` : admin ? '/admin/events' : '/events'}>Cancel</Link><button className="aw-button aw-button--primary" disabled={mutation.isPending} type="submit">{mutation.isPending ? 'Saving…' : edit ? 'Save changes' : 'Create event'} <ChevronRight size={15} /></button></div>
      </form>
      <aside className="aw-preview-column"><section className="aw-panel aw-event-preview"><div className="aw-preview-icon"><CalendarDays size={24} /></div><span className={`aw-status-badge aw-status-${currentStatus}`}>{currentStatus}</span><h2>{currentName || 'Event name will appear here'}</h2><p>{currentDescription || 'Add a description to introduce this event to participants.'}</p><div className="aw-preview-meta"><span><Clock3 size={14} /> {currentStart ? formatDate(localDateTimeToIso(currentStart)) : 'Start date · End date'}</span><span><MapPin size={14} /> Location is not part of the current event record</span></div><small>Preview reflects fields supported by the current event API.</small></section></aside>
    </div>
  </EventsLayout>
}

function toLocalInput(value: string) { const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16) }
function localDateTimeToIso(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString() : value }
function EventsLayout({ title, description, children, admin = false }: { title: string; description?: string; children: React.ReactNode; admin?: boolean }) {
  const content = <section className={`aw-page${admin ? '' : ' auth-card event-card'}`}>
    {!admin && <p className="eyebrow">HMI CERTIFICATES</p>}
    {title && <header className="aw-page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div></header>}
    {children}
  </section>
  return admin ? content : <main className="auth-shell">{content}</main>
}
