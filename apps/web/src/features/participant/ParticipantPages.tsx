import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api-client'
import { useAuth } from '../../lib/use-auth'
import { ParticipantLayout } from '../design-system'
import { Select } from '../../components/ui/Select'

type EventItem = { id: string; name: string; description?: string | null; startDate: string; status?: string; registrationEligible?: boolean; registrationStatus?: string | null }
type Paged<T> = { items?: T[]; events?: T[]; certificates?: T[]; total?: number }
const pastel = ['#f5e8e0', '#e6edf7', '#e8efe6', '#f4efdc', '#eee8f5', '#e5eff0']
function cover(id: string) { return pastel[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % pastel.length] }
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }

function EventList({ events, onRegister, registering }: { events: EventItem[]; onRegister?: (id: string) => void; registering?: string | null }) {
  if (!events.length) return <p className="participant-empty">🌱 No events to show yet. Explore upcoming events to find your next one.</p>
  return <div className="participant-event-grid">{events.map((event) => <article className="participant-event-card" key={event.id}>
    <div className="participant-event-cover" style={{ backgroundColor: cover(event.id) }} aria-hidden="true">✦</div>
    <div className="participant-event-body"><p className="participant-event-date">{date(event.startDate)}</p><h3>{event.name}</h3>{event.description && <p>{event.description}</p>}
      <div className="participant-event-actions"><Link to={`/events/${event.id}`}>View event</Link>{onRegister && <button disabled={registering === event.id || !event.registrationEligible} onClick={() => onRegister(event.id)}>{registering === event.id ? 'Registering…' : event.registrationStatus ? 'Registered' : event.registrationEligible === false ? 'Registration closed' : 'Register'}</button>}</div>
    </div>
  </article>)}</div>
}

export function ParticipantPage({ section = 'home' }: { section?: 'home' | 'explore' | 'events' | 'certificates' | 'settings' }) {
  const { user, activeProfile, profiles, refresh } = useAuth()
  const participantProfile = profiles.find((profile) => profile.type === 'participant')
  const [events, setEvents] = useState<EventItem[]>([])
  const [myEvents, setMyEvents] = useState<EventItem[]>([])
  const [certificates, setCertificates] = useState<Array<Record<string, unknown>>>([])
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [registering, setRegistering] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [failure, setFailure] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [institution, setInstitution] = useState('')
  const [roleLabel, setRoleLabel] = useState<'student' | 'teacher' | 'other'>('other')
  const [bio, setBio] = useState('')

  useEffect(() => {
    if (!participantProfile) return
    setDisplayName(participantProfile.displayName)
    setInstitution(participantProfile.institution ?? '')
    setRoleLabel(participantProfile.roleLabel)
    setBio(participantProfile.bio ?? '')
  }, [participantProfile])

  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim()), 200); return () => window.clearTimeout(timer) }, [query])
  useEffect(() => {
    let current = true
    const search = section === 'explore' ? `&search=${encodeURIComponent(debounced)}` : ''
    const tasks: Promise<unknown>[] = []
    if (section === 'home' || section === 'explore') tasks.push(apiFetch<Paged<EventItem>>(`/events?page=1&pageSize=${section === 'home' ? 6 : 20}${search}`).then((value) => { if (current) setEvents(value.events ?? value.items ?? []) }))
    if (section === 'home' || section === 'events') tasks.push(apiFetch<Paged<EventItem>>('/me/events?page=1&pageSize=20').then((value) => { if (current) setMyEvents(value.events ?? value.items ?? []) }))
    if (section === 'home' || section === 'certificates') tasks.push(apiFetch<Paged<Record<string, unknown>>>('/me/certificates?page=1&pageSize=3').then((value) => { if (current) setCertificates(value.certificates ?? value.items ?? []) }))
    void Promise.all(tasks).catch((cause: unknown) => { if (current) setFailure(cause instanceof Error ? cause.message : 'Could not load your workspace.') })
    return () => { current = false }
  }, [section, debounced])

  async function register(eventId: string) {
    setRegistering(eventId); setNotice(''); setFailure('')
    try { await apiFetch(`/events/${eventId}/registration`, { method: 'POST', body: '{}' }); setNotice("You're in! Your registration is confirmed."); setEvents((items) => items.map((event) => event.id === eventId ? { ...event, registrationStatus: 'registered' } : event)) }
    catch (cause) { setFailure(cause instanceof Error ? cause.message : 'Registration could not be completed. Please retry.') }
    finally { setRegistering(null) }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFailure(''); setSaveMessage('')
    try {
      await apiFetch('/profiles/participant', { method: 'PATCH', body: JSON.stringify({ displayName, institution, roleLabel, bio }) })
      await refresh()
      setSaveMessage('Your participant profile has been updated. Issued certificates keep the name printed when they were created.')
    } catch (cause) { setFailure(cause instanceof Error ? cause.message : 'Could not save your profile. Please retry.') }
    finally { setSaving(false) }
  }

  const titles = { home: 'Your learning, in one place', explore: 'Explore events', events: 'My events', certificates: 'My certificates', settings: 'Your profile' }
  const firstName = user?.name.split(/\s+/)[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return <ParticipantLayout><div className="participant-page">
    <p className="participant-eyebrow">{section === 'home' ? 'YOUR PARTICIPANT SPACE' : 'PARTICIPANT'}</p>
    <h1>{section === 'home' ? `${greeting}, ${firstName} 👋` : titles[section]}</h1>
    <p className="participant-intro">{activeProfile?.roleLabel === 'teacher' ? 'Find meaningful events to learn, share, and recognize your progress.' : 'A little curiosity can lead somewhere great. Find your next event.'}</p>
    {notice && <p className="participant-notice" role="status">{notice}</p>}{failure && <p className="participant-error" role="alert">{failure}</p>}
    {(section === 'home' || section === 'events') && <section className="participant-section"><header><h2>{section === 'home' ? 'Up next' : 'Your registrations'}</h2>{section === 'home' && <Link to="/app/events">View my events</Link>}</header><EventList events={myEvents} /></section>}
    {(section === 'home' || section === 'explore') && <section className="participant-section"><header><h2>{section === 'home' ? 'Discover events' : 'Upcoming events'}</h2>{section === 'home' && <Link to="/app/explore">Explore all events</Link>}</header>{section === 'explore' && <label className="participant-search">Search events<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try a topic or event name" /></label>}<EventList events={events} onRegister={register} registering={registering} /></section>}
    {(section === 'home' || section === 'certificates') && <section className="participant-section"><header><h2>Your certificates</h2>{section === 'home' && <Link to="/app/certificates">View all</Link>}</header>{certificates.length ? <div className="participant-certificate-list">{certificates.map((item, index) => <Link key={String(item.id ?? index)} to={`/certificates/${String(item.id ?? '')}`}><span>🏅</span><strong>{String(item.eventName ?? item.name ?? 'Certificate')}</strong><small>{String(item.status ?? 'Issued')}</small></Link>)}</div> : <p className="participant-empty">🎓 Your first certificate is one event away. <Link to="/app/explore">Find an event</Link></p>}</section>}
    {section === 'settings' && <section className="participant-section"><h2>Participant profile</h2><p className="participant-settings-note">This is the name used for future certificates. Certificates already issued keep their original name.</p>{saveMessage && <p className="participant-notice" role="status">{saveMessage}</p>}<form className="participant-settings-form" onSubmit={(event) => void saveProfile(event)}>
      <label>Display name<input required maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
      <label>Email<input value={user?.email ?? ''} readOnly /></label>
      <label>Institution<input maxLength={160} value={institution} onChange={(event) => setInstitution(event.target.value)} /></label>
      <label>Your role<Select aria-label="Your role" value={roleLabel} onValueChange={(value) => setRoleLabel(value as 'student' | 'teacher' | 'other')} options={[{ value: 'student', label: 'Student' }, { value: 'teacher', label: 'Teacher' }, { value: 'other', label: 'Other' }]} /></label>
      <label>Short bio<textarea rows={3} maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} /></label>
      <button className="certify-primary-action" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save profile'}</button>
    </form><p>Account sign-in details and notification/privacy preferences are not editable here yet.</p><p>Active profile: {activeProfile?.type ?? 'Participant'} · Available profiles: {profiles.length}</p></section>}
  </div></ParticipantLayout>
}
