import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, ChevronRight, CirclePlus, Clock3, MapPin, PencilLine, Users } from 'lucide-react'
import { DateTimePicker } from '../../components/date-time/DatePickers'
import { createEventSchema, updateEventSchema, EVENT_STATUSES, type EventCreateInput, type EventData } from '@hmi/shared'
import { apiFetch } from '../../lib/api-client'
import { formatEventDate } from '../../lib/format-event-date'
import { fetchAccessibleEvents } from './event-queries'
import { DetailSkeleton, EventListSkeleton, LoadingLabel } from '../../components/loading/LoadingUi'

type EventInput = EventCreateInput
type EventFilter = 'all' | 'draft' | 'published' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
const eventKey = ['events']
const emptyEvents: EventData['event'][] = []
const friendlyError = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'
const formatDate = (date: string) => formatEventDate(date)
const formatRange = (event: Pick<EventData['event'], 'startDate' | 'endDate'>) => event.endDate ? `${new Date(event.startDate).toLocaleDateString()} – ${new Date(event.endDate).toLocaleDateString()}` : new Date(event.startDate).toLocaleDateString()
const eventDraftLifetime = 7 * 24 * 60 * 60 * 1000

type EventFormDraft = {
  savedAt: number
  step: 0 | 1
  name: string
  description: string
  startDate: string
  endDate: string
  status: EventInput['status']
}

function readEventDraft(key: string): EventFormDraft | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const draft = value as Partial<EventFormDraft>
    const valid = typeof draft.savedAt === 'number' && Date.now() - draft.savedAt < eventDraftLifetime && (draft.step === 0 || draft.step === 1) && typeof draft.name === 'string' && typeof draft.description === 'string' && typeof draft.startDate === 'string' && typeof draft.endDate === 'string' && typeof draft.status === 'string' && EVENT_STATUSES.includes(draft.status as typeof EVENT_STATUSES[number])
    if (!valid) {
      localStorage.removeItem(key)
      return null
    }
    return draft as EventFormDraft
  } catch {
    clearEventDraft(key)
    return null
  }
}

function clearEventDraft(key: string) {
  try { localStorage.removeItem(key) } catch { /* Storage may be unavailable in private browsing. */ }
}

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
      {events.isLoading ? <EventListSkeleton />
        : events.error ? <p className="notice error" role="alert">{friendlyError(events.error)} <button type="button" onClick={() => void events.refetch()}>Retry</button></p>
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
  if (event.isLoading) return <EventsLayout title="Event" admin={admin}><DetailSkeleton label="Loading event details" /></EventsLayout>
  if (event.error || !event.data) return <EventsLayout title="Event" admin={admin}><p className="notice error" role="alert">{friendlyError(event.error)} {event.error && <button type="button" onClick={() => void event.refetch()}>Retry</button>}</p><Link className="aw-button" to={admin ? '/admin/events' : '/events'}>Back to events</Link></EventsLayout>
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
        <button className="aw-button aw-button--danger aw-archive-button" disabled={archive.isPending} aria-busy={archive.isPending} onClick={() => { if (window.confirm('Archive this event? Its participant and certificate history will be retained.')) archive.mutate() }}>{archive.isPending ? <LoadingLabel>Archiving</LoadingLabel> : 'Archive event'}</button>
        {archive.error && <p className="notice error" role="alert">{friendlyError(archive.error)}</p>}
      </section> : <section className="aw-panel"><header className="aw-panel-head"><h2>Event access</h2></header><p className="aw-event-description">You have {item.accessRole} access to this event. Event management tools are available to event administrators.</p></section>}
    </div>
  </EventsLayout>
}

export function EventFormPage({ mode, admin = false }: { mode: 'create' | 'edit'; admin?: boolean }) {
  const { eventId = '' } = useParams()
  const edit = mode === 'edit'
  const draftKey = `hmi:event-create-draft:v1:${admin ? 'admin' : 'events'}`
  const [restoredDraft] = useState(() => edit ? null : readEventDraft(draftKey))
  const existing = useQuery({ queryKey: [...eventKey, eventId], queryFn: () => apiFetch<EventData>(`/events/${eventId}`), enabled: edit })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [validation, setValidation] = useState('')
  const [activeStep, setActiveStep] = useState<0 | 1>(() => restoredDraft?.step ?? 0)
  const [draftRestored, setDraftRestored] = useState(Boolean(restoredDraft))
  const [name, setName] = useState<string | null>(() => restoredDraft?.name ?? null)
  const [description, setDescription] = useState<string | null>(() => restoredDraft?.description ?? null)
  const [startDate, setStartDate] = useState<string | null>(() => restoredDraft?.startDate ?? null)
  const [endDate, setEndDate] = useState<string | null>(() => restoredDraft?.endDate ?? null)
  const [status, setStatus] = useState<EventInput['status'] | null>(() => restoredDraft?.status ?? null)
  const [draftRevision, setDraftRevision] = useState(0)
  const mutation = useMutation({
    mutationFn: (input: EventInput) => apiFetch<EventData>(edit ? `/events/${eventId}` : '/events', { method: edit ? 'PATCH' : 'POST', body: JSON.stringify(input) }),
    onSuccess: async ({ event }) => { if (!edit) clearEventDraft(draftKey); await queryClient.invalidateQueries({ queryKey: eventKey }); await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }); navigate(`${admin ? '/admin/events' : '/events'}/${event.id}`, { state: { notice: edit ? 'Event updated successfully.' : 'Event created successfully.' } }) },
  })
  const item = existing.data?.event
  const currentName = name ?? item?.name ?? ''
  const currentDescription = description ?? item?.description ?? ''
  const currentStart = startDate ?? (item ? toLocalInput(item.startDate) : '')
  const currentEnd = endDate ?? (item?.endDate ? toLocalInput(item.endDate) : '')
  const currentStatus = status ?? item?.status ?? 'draft'

  useEffect(() => {
    if (edit) return
    if (![currentName, currentDescription, currentStart, currentEnd].some((value) => value.trim()) && currentStatus === 'draft') {
      clearEventDraft(draftKey)
      return
    }
    const draft: EventFormDraft = { savedAt: Date.now(), step: activeStep, name: currentName, description: currentDescription, startDate: currentStart, endDate: currentEnd, status: currentStatus }
    try { localStorage.setItem(draftKey, JSON.stringify(draft)) } catch { /* Drafts are best effort when browser storage is unavailable. */ }
  }, [activeStep, currentDescription, currentEnd, currentName, currentStart, currentStatus, draftKey, draftRevision, edit])

  if (edit && existing.isLoading) return <EventsLayout title="Edit event" admin={admin}><DetailSkeleton label="Loading event details" /></EventsLayout>
  if (edit && (existing.error || !existing.data || existing.data.event.accessRole !== 'admin')) return <EventsLayout title="Edit event" admin={admin}><p className="notice error" role="alert">{existing.error ? friendlyError(existing.error) : 'Event admin access is required.'} {existing.error && <button type="button" onClick={() => void existing.refetch()}>Retry</button>}</p><Link className="aw-button" to={admin ? '/admin/events' : '/events'}>Back to events</Link></EventsLayout>
  function continueToSchedule() {
    setValidation('')
    if (!currentName.trim()) {
      setValidation('Event name is required before continuing.')
      return
    }
    setActiveStep(1)
  }
  function discardDraft() {
    clearEventDraft(draftKey)
    setName('')
    setDescription('')
    setStartDate('')
    setEndDate('')
    setStatus('draft')
    setActiveStep(0)
    setValidation('')
    setDraftRestored(false)
    setDraftRevision((revision) => revision + 1)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setValidation('')
    if (activeStep === 0) {
      continueToSchedule()
      return
    }
    const rawInput: EventInput = { name: currentName.trim(), description: currentDescription.trim() || null, startDate: localDateTimeToIso(currentStart), endDate: currentEnd ? localDateTimeToIso(currentEnd) : null, status: currentStatus }
    const parsed = (edit ? updateEventSchema : createEventSchema).safeParse(rawInput)
    if (!parsed.success) { setValidation(parsed.error.issues[0]?.message ?? 'Please check the event details.'); return }
    if (rawInput.endDate && new Date(rawInput.endDate) < new Date(rawInput.startDate)) { setValidation('The end date must be after the start date.'); return }
    mutation.mutate(parsed.data as EventInput)
  }
  return <EventsLayout title={edit ? 'Edit event' : 'Create a new event'} description="Add the event information used to manage registrations and certificates." admin={admin}>
    <div className="aw-form-intro" role="group" aria-label="Event form steps"><button type="button" className={`aw-form-step${activeStep === 0 ? ' is-current' : ''}`} aria-current={activeStep === 0 ? 'step' : undefined} onClick={() => { setActiveStep(0); setValidation('') }}><span>1</span> Event details</button><span className="aw-form-step-line" /><button type="button" className={`aw-form-step${activeStep === 1 ? ' is-current' : ''}`} aria-current={activeStep === 1 ? 'step' : undefined} onClick={continueToSchedule}><span>2</span> Schedule & settings</button></div>
    {draftRestored && !edit && <div className="aw-event-draft-notice" role="status"><span>Your saved draft was restored. Drafts expire after 7 days.</span><button type="button" onClick={discardDraft}>Discard draft</button></div>}
    <div className="aw-wizard-layout aw-event-form-layout">
      <form className="aw-panel aw-event-form" onSubmit={submit}>
        <div className="aw-panel-head"><div><h2>{activeStep === 0 ? 'Basic information' : 'Schedule & settings'}</h2><p>{activeStep === 0 ? 'These details identify your event across the workspace.' : 'Choose when the event takes place and its current status.'}</p></div></div>
        {activeStep === 0 ? <>
          <label className="aw-field">Event name <span className="aw-required">Required</span><input name="name" required maxLength={200} value={currentName} onChange={(event) => setName(event.target.value)} placeholder="e.g. Tech Innovators Hackathon" /><small>{currentName.length}/200 characters</small></label>
          <label className="aw-field">Description <span className="aw-optional">Optional</span><textarea name="description" rows={4} maxLength={5000} value={currentDescription} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the event and what participants can expect." /><small>{currentDescription.length}/5000 characters</small></label>
        </> : <>
          <div className="aw-form-grid"><div className="aw-field"><label htmlFor="event-start-date">Start date and time <span className="aw-required">Required</span></label><DateTimePicker id="event-start-date" name="startDate" value={currentStart} onChange={(value) => setStartDate(value)} placeholder="Select start date and time" /></div><div className="aw-field"><label htmlFor="event-end-date">End date and time <span className="aw-optional">Optional</span></label><DateTimePicker id="event-end-date" name="endDate" value={currentEnd} onChange={(value) => setEndDate(value)} placeholder="Select end date and time" /></div></div>
          <label className="aw-field">Event status<select name="status" value={currentStatus} onChange={(event) => setStatus(event.target.value as EventInput['status'])}>{EVENT_STATUSES.map((value) => <option key={value} value={value}>{value[0]?.toUpperCase()}{value.slice(1)}</option>)}</select><small>Choose a status supported by the event workflow.</small></label>
        </>}
        {validation && <p className="notice error" role="alert">{validation}</p>}{mutation.error && <p className="notice error" role="alert">{friendlyError(mutation.error)}</p>}
        <div className="aw-wizard-footer"><Link className="aw-button" onClick={() => { if (!edit) clearEventDraft(draftKey) }} to={edit && item ? `${admin ? '/admin/events' : '/events'}/${item.id}` : admin ? '/admin/events' : '/events'}>Cancel</Link><div className="aw-wizard-actions">{activeStep === 1 && <button className="aw-button" type="button" onClick={() => { setActiveStep(0); setValidation('') }}>Back</button>}<button className="aw-button aw-button--primary" disabled={mutation.isPending} type="submit">{activeStep === 0 ? 'Continue' : mutation.isPending ? <LoadingLabel>Saving</LoadingLabel> : edit ? 'Save changes' : 'Create event'} {activeStep === 0 && <ChevronRight size={15} />}</button></div></div>
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
