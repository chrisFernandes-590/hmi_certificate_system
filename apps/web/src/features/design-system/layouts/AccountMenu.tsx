import { useState, type FormEvent } from 'react'
import { Check, ChevronDown, Sparkles } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../lib/use-auth'
import { Select } from '../../../components/ui/Select'

export function AccountMenu() {
  const { user, profiles, activeProfile, switchProfile, createOrganizer, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(() => window.localStorage.getItem('certify-account-menu-open') === 'true')
  const [dialog, setDialog] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [roleLabel, setRoleLabel] = useState<'student' | 'teacher' | 'other'>('teacher')
  const organizer = profiles.find((profile) => profile.type === 'organizer')

  async function chooseProfile(type: 'participant' | 'organizer') {
    if (activeProfile?.type === type) return
    setBusy(true)
    try {
      await switchProfile(type)
      const participantRoute = location.pathname.startsWith('/admin') ? '/app' : location.pathname
      const organizerRoute = location.pathname.startsWith('/app') ? '/admin/dashboard' : location.pathname
      navigate(type === 'participant' ? participantRoute : organizerRoute)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not switch profiles.') }
    finally { setBusy(false) }
  }

  async function submitOrganizer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      const profile = await createOrganizer({
        displayName: user?.name ?? 'Organizer',
        institution: String(form.get('institution') || ''),
        roleLabel,
        bio: String(form.get('bio') || ''),
        termsAccepted: true,
      })
      setComplete(profile.approvalStatus === 'approved')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create your organizer profile.') }
    finally { setBusy(false) }
  }

  return <>
    <details className="certify-account-menu" open={open} onToggle={(event) => { const next = event.currentTarget.open; setOpen(next); window.localStorage.setItem('certify-account-menu-open', String(next)) }}>
      <summary aria-expanded={open} aria-controls="certify-account-panel">
        <span className="account-avatar">{user?.name?.slice(0, 1) ?? 'P'}</span>
        <span className="certify-account-name">{user?.name ?? 'Your account'}</span>
        <span className={`certify-profile-tag ${activeProfile?.type === 'organizer' ? 'is-organizer' : ''}`}>{activeProfile?.type === 'organizer' ? 'Organizer' : 'Participant'}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="certify-account-panel" id="certify-account-panel">
        <p className="certify-menu-heading">PROFILES</p>
        <button type="button" disabled={busy} onClick={() => void chooseProfile('participant')}><span>Participant profile</span>{activeProfile?.type === 'participant' && <Check size={15} />}</button>
        {organizer ? organizer.approvalStatus === 'pending' ? <div className="certify-pending-profile">Event admin profile <span>Pending approval</span></div> : <button type="button" disabled={busy || organizer.status !== 'active'} onClick={() => void chooseProfile('organizer')}><span>Event admin profile</span>{activeProfile?.type === 'organizer' && <Check size={15} />}</button> : <button className="certify-create-profile" type="button" onClick={() => { setDialog(true); setError('') }}><Sparkles size={15} /><span>Host your own events<br /><small>Create organizer profile</small></span></button>}
        {organizer?.status === 'suspended' && <p className="certify-menu-error">Your organizer profile is suspended. Contact support for help.</p>}
        <div className="certify-menu-divider" />
        <Link to="/app/settings">Account settings</Link>
        <Link to="/app/settings">Profile</Link>
        <button type="button" className="certify-signout" onClick={async () => { await logout(); navigate('/login') }}>Sign out</button>
        {error && <p className="certify-menu-error" role="alert">{error}</p>}
      </div>
    </details>
    {dialog && <div className="certify-dialog-backdrop" role="presentation"><section className="certify-organizer-dialog" role="dialog" aria-modal="true" aria-labelledby="organizer-dialog-title">
      <button className="certify-dialog-close" type="button" aria-label="Close" onClick={() => { setDialog(false); setComplete(false) }}>×</button>
      {complete ? <><h2 id="organizer-dialog-title">Your organizer profile is ready</h2><p>You can host events and issue certificates. Your participant profile stays exactly as it is.</p><button className="certify-primary-action" type="button" onClick={() => { setDialog(false); setComplete(false); void chooseProfile('organizer') }}>Switch to organizer profile</button></> : <form onSubmit={(event) => void submitOrganizer(event)}>
        <h2 id="organizer-dialog-title">Host events and issue certificates</h2><p>Your participant profile stays exactly as it is.</p>
        <label>Organization or institution<input name="institution" defaultValue={organizer?.institution ?? ''} maxLength={160} /></label>
        <label>Your role<Select aria-label="Your role" value={roleLabel} onValueChange={(value) => setRoleLabel(value as 'student' | 'teacher' | 'other')} options={[{ value: 'teacher', label: 'Teacher' }, { value: 'student', label: 'Student club lead' }, { value: 'other', label: 'Organizer' }]} /></label>
        <label>What will you host? <span>(optional)</span><textarea name="bio" rows={3} maxLength={500} /></label>
        <label className="certify-terms"><input required type="checkbox" />I agree to the organizer terms.</label>
        {error && <p className="certify-menu-error" role="alert">{error}</p>}
        <button className="certify-primary-action" disabled={busy} type="submit">{busy ? 'Creating profile…' : 'Create organizer profile'}</button>
      </form>}
    </section></div>}
  </>
}
