import { lazy, Suspense, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Plus, X } from 'lucide-react'
import { ApiError, apiFetch } from '../../lib/api-client'
import { LoadingLabel, TableSkeleton } from '../../components/loading/LoadingUi'

const ParticipantImportWizard = lazy(() => import('./ParticipantImportWizard').then((module) => ({ default: module.ParticipantImportWizard })))

type Participant = { participantId: string; userId: string | null; name: string; email: string; phone: string | null; organization: string | null; registrationId: string; status: 'registered' | 'attended' | 'absent' | 'cancelled'; registeredAt: string }
type ParticipantPage = { participants: Participant[]; total: number; page: number; pageSize: number }
type EventCertificate = { id: string; certificateNumber: string; participantId: string; participantName: string; title: string; status: 'draft' | 'issued' | 'revoked'; issuedAt: string | null; revokedAt: string | null; createdAt: string }
type CertificatePage = { certificates: EventCertificate[]; total: number; page: number; pageSize: number }
type IssuanceResult = { participantId: string; success: boolean; certificate?: { id: string; certificateNumber: string }; error?: { statusCode: number; message: string } }

const issueFields = z.object({ title: z.string().trim().min(1).max(140), description: z.string().trim().max(2000) })
const revokeReasonSchema = z.string().trim().min(3).max(500)
const friendlyError = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString() : '—'

function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages < 2) return null
  return <nav className="pagination" aria-label="Pages"><button className="button-secondary" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="button-secondary" type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></nav>
}

export function EventCertificateManagement({ eventId, eventName = 'this event', focus }: { eventId: string; eventName?: string; focus?: 'participants' | 'certificates' }) {
  const queryClient = useQueryClient()
  const [participantSearch, setParticipantSearch] = useState('')
  const [participantPage, setParticipantPage] = useState(1)
  const [certificateSearch, setCertificateSearch] = useState('')
  const [certificateStatus, setCertificateStatus] = useState('')
  const [certificatePage, setCertificatePage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [title, setTitle] = useState('Certificate of Achievement')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')
  const [results, setResults] = useState<IssuanceResult[]>([])
  const [revokeId, setRevokeId] = useState('')
  const [revokeReason, setRevokeReason] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addOrganization, setAddOrganization] = useState('')
  const [addError, setAddError] = useState<{ message: string; duplicateId?: string } | null>(null)

  const participantParams = new URLSearchParams({ page: String(participantPage), pageSize: '50' })
  if (participantSearch.trim()) participantParams.set('search', participantSearch.trim())
  const certificateParams = new URLSearchParams({ page: String(certificatePage), pageSize: '50' })
  if (certificateSearch.trim()) certificateParams.set('search', certificateSearch.trim())
  if (certificateStatus) certificateParams.set('status', certificateStatus)

  const participants = useQuery({
    queryKey: ['event-participants', eventId, participantSearch, participantPage],
    queryFn: () => apiFetch<ParticipantPage>(`/events/${eventId}/participants?${participantParams.toString()}`),
  })
  const certificates = useQuery({
    queryKey: ['event-certificates', eventId, certificateSearch, certificateStatus, certificatePage],
    queryFn: () => apiFetch<CertificatePage>(`/events/${eventId}/certificates?${certificateParams.toString()}`),
  })
  const certificateByParticipant = useMemo(() => new Map((certificates.data?.certificates ?? []).map((certificate) => [certificate.participantId, certificate])), [certificates.data])

  const attendance = useMutation({
    mutationFn: ({ participantId, status }: { participantId: string; status: Participant['status'] }) => apiFetch(`/events/${eventId}/participants/${participantId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['event-participants', eventId] }) },
  })
  const issueOne = useMutation({
    mutationFn: (participantId: string) => apiFetch<{ certificate: { id: string; certificateNumber: string } }>(`/events/${eventId}/certificates`, { method: 'POST', body: JSON.stringify({ participantId, title: checkedFields().title, description: checkedFields().description || undefined }) }),
    onSuccess: async (response, participantId) => {
      setResults([{ participantId, success: true, certificate: response.certificate }])
      await invalidateCertificateData()
    },
  })
  const issueBulk = useMutation({
    mutationFn: (participantIds: string[]) => apiFetch<{ results: IssuanceResult[]; issuedCount: number; failedCount: number }>(`/events/${eventId}/certificates/bulk`, { method: 'POST', body: JSON.stringify({ participantIds, title: checkedFields().title, description: checkedFields().description || undefined }) }),
    onSuccess: async (response) => {
      setResults(response.results)
      setSelected([])
      await invalidateCertificateData()
    },
  })
  const revoke = useMutation({
    mutationFn: ({ certificateId, reason }: { certificateId: string; reason: string }) => apiFetch(`/certificates/${certificateId}/revoke`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
    onSuccess: async () => {
      setRevokeId(''); setRevokeReason('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['event-certificates', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ])
    },
  })
  const addParticipant = useMutation({
    mutationFn: () => apiFetch<{ participant: { participantId: string; registrationId: string; status: string } }>(`/events/${eventId}/participants`, { method: 'POST', body: JSON.stringify({ name: addName, email: addEmail, phone: addPhone || null, organization: addOrganization || null }) }),
    onSuccess: async () => {
      setAddOpen(false); setAddName(''); setAddEmail(''); setAddPhone(''); setAddOrganization(''); setAddError(null); setParticipantPage(1)
      await queryClient.invalidateQueries({ queryKey: ['event-participants', eventId] })
    },
    onError: (error) => {
      const message = friendlyError(error)
      const details = error instanceof ApiError && error.details && typeof error.details === 'object' ? error.details as { participantId?: unknown } : undefined
      const duplicateId = typeof details?.participantId === 'string' ? details.participantId : message.match(/\(([0-9a-f-]{36})\)/i)?.[1]
      setAddError({ message, ...(duplicateId ? { duplicateId } : {}) })
    },
  })

  function checkedFields() {
    const parsed = issueFields.safeParse({ title, description })
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the certificate title and description.')
    return parsed.data
  }
  async function invalidateCertificateData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['event-certificates', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['event-participants', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['my-certificates'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    ])
  }
  function issueFor(participantId: string) {
    setFormError('')
    try { checkedFields(); issueOne.mutate(participantId) }
    catch (error) { setFormError(friendlyError(error)) }
  }
  function issueSelected() {
    setFormError('')
    try { checkedFields(); issueBulk.mutate(selected) }
    catch (error) { setFormError(friendlyError(error)) }
  }
  function submitRevocation(certificateId: string) {
    const parsed = revokeReasonSchema.safeParse(revokeReason)
    if (!parsed.success) { setFormError('Enter a revocation reason of at least 3 characters.'); return }
    setFormError('')
    revoke.mutate({ certificateId, reason: parsed.data })
  }

  return <section className="certificate-manager" data-focus={focus} aria-label={focus === 'participants' ? 'Event participants' : focus === 'certificates' ? 'Event certificates' : 'Event participants and certificates'}>
    {!focus && <div className="manager-heading"><div><p className="eyebrow">EVENT ADMINISTRATION</p><h2>Participants and certificates</h2></div></div>}
    <section className="manager-section" aria-labelledby="participants-heading">
      <div className="section-heading"><div><h3 id="participants-heading">Participants and attendance</h3><p>Update attendance and issue certificates to registered or attended participants.</p><button type="button" className="button-secondary" onClick={() => { setAddError(null); setAddOpen(true) }}><Plus size={14} /> Add participant</button></div>
        <label className="search-field">Search participants<input value={participantSearch} onChange={(event) => { setParticipantSearch(event.target.value); setParticipantPage(1) }} placeholder="Name" /></label>
      </div>
      {participants.isLoading ? <TableSkeleton label="Loading participants" columns={6} /> : participants.error ? <p className="notice error" role="alert">{friendlyError(participants.error)} <button type="button" onClick={() => void participants.refetch()}>Retry</button></p> : !participants.data?.participants.length ? <p className="empty-state">No participants match this search.</p> : <div className="table-scroll" id="participants-table"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone / organization</th><th>Attendance</th><th>Certificate</th><th>Action</th></tr></thead><tbody>
        {participants.data.participants.map((participant) => {
          const certificate = certificateByParticipant.get(participant.participantId)
          const eligible = participant.status === 'registered' || participant.status === 'attended'
          return <tr key={participant.participantId}>
            <td>{participant.name}</td><td>{participant.email}</td><td>{[participant.phone, participant.organization].filter(Boolean).join(' · ') || '—'}</td>
            <td><select aria-label={`Attendance for ${participant.name}`} value={participant.status} disabled={participant.status === 'cancelled' || attendance.isPending} onChange={(event) => attendance.mutate({ participantId: participant.participantId, status: event.target.value as Participant['status'] })}>
              <option value="registered">Registered</option><option value="attended">Attended</option><option value="absent">Absent</option>{participant.status === 'cancelled' && <option value="cancelled">Cancelled</option>}
            </select></td>
            <td>{certificate ? <span className={`status-label status-${certificate.status}`}>{certificate.status}</span> : eligible ? <label className="selection-label"><input type="checkbox" checked={selected.includes(participant.participantId)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, participant.participantId] : current.filter((id) => id !== participant.participantId))} />Select</label> : <span className="muted-text">Not eligible</span>}</td>
            <td>{eligible && !certificate && <button className="button-secondary" type="button" disabled={issueOne.isPending || issueBulk.isPending} onClick={() => issueFor(participant.participantId)}>Issue individually</button>}</td>
          </tr>
        })}
      </tbody></table></div>}
      {participants.data && <p className="muted-text">Showing {participants.data.participants.length} of {participants.data.total} participants.</p>}
      {participants.data && <Pagination page={participantPage} pageSize={50} total={participants.data.total} onPage={setParticipantPage} />}
      {attendance.error && <p className="notice error" role="alert">Could not update attendance: {friendlyError(attendance.error)}</p>}
      {addOpen && <div className="aw-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddOpen(false) }}><form className="aw-modal" role="dialog" aria-modal="true" aria-labelledby="add-participant-heading" onSubmit={(event) => { event.preventDefault(); setAddError(null); addParticipant.mutate() }}>
        <button type="button" className="aw-modal-close" aria-label="Close dialog" onClick={() => setAddOpen(false)}><X size={18} /></button><h2 id="add-participant-heading">Add participant</h2><p>Add one person to {eventName}. Their registration starts as registered.</p>
        <label className="field">Name<input required maxLength={200} value={addName} onChange={(event) => setAddName(event.target.value)} autoFocus /></label>
        <label className="field">Email<input required type="email" maxLength={320} value={addEmail} onChange={(event) => setAddEmail(event.target.value)} /></label>
        <label className="field">Phone (optional)<input maxLength={50} value={addPhone} onChange={(event) => setAddPhone(event.target.value)} /></label>
        <label className="field">Organization (optional)<input maxLength={200} value={addOrganization} onChange={(event) => setAddOrganization(event.target.value)} /></label>
        {addError && <p className="notice error" role="alert">{addError.message}{addError.duplicateId && <button type="button" className="duplicate-participant-link" onClick={() => { setParticipantSearch(addEmail.trim()); setParticipantPage(1); setAddOpen(false) }}>Find existing participant</button>}</p>}
        {addParticipant.isSuccess && <p className="notice success" role="status">Participant added successfully.</p>}
        <div className="aw-modal-actions"><button type="button" className="button-secondary" onClick={() => setAddOpen(false)}>Cancel</button><button type="submit" className="button-primary" disabled={addParticipant.isPending}>{addParticipant.isPending ? <LoadingLabel>Adding</LoadingLabel> : 'Add participant'}</button></div>
      </form></div>}
    </section>

    {focus !== 'certificates' && <Suspense fallback={<div className="aw-loading" role="status"><LoadingLabel>Loading import tools</LoadingLabel></div>}><ParticipantImportWizard eventId={eventId} eventName={eventName} /></Suspense>}

    <section className="manager-section" aria-labelledby="issue-heading">
      <h3 id="issue-heading">Issue certificates</h3>
      <div className="issuance-fields">
        <label className="field">Certificate title<input value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="field">Description (optional)<input value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} /></label>
      </div>
      <button className="button-primary" type="button" disabled={!selected.length || issueBulk.isPending || issueOne.isPending} aria-busy={issueBulk.isPending} onClick={issueSelected}>{issueBulk.isPending ? <LoadingLabel>Issuing certificates</LoadingLabel> : `Issue to ${selected.length} selected`}</button>
      {formError && <p className="notice error" role="alert">{formError}</p>}
      {issueOne.error && <p className="notice error" role="alert">{friendlyError(issueOne.error)}</p>}
      {issueBulk.error && <p className="notice error" role="alert">{friendlyError(issueBulk.error)}</p>}
      {results.length > 0 && <div className="issuance-results" role="status"><strong>Issuance results</strong><ul>{results.map((result, index) => {
        const name = participants.data?.participants.find((person) => person.participantId === result.participantId)?.name ?? 'Participant'
        return <li key={`${result.participantId}-${index}`}>{name}: {result.success ? `issued ${result.certificate?.certificateNumber}` : result.error?.message ?? 'issuance failed'}</li>
      })}</ul></div>}
    </section>

    <section className="manager-section" aria-labelledby="certificates-heading">
      <div className="section-heading"><div><h3 id="certificates-heading">Event certificates</h3><p>Search issued records and review their current status.</p></div>
        <div className="certificate-toolbar"><label className="search-field">Search<input value={certificateSearch} onChange={(event) => { setCertificateSearch(event.target.value); setCertificatePage(1) }} placeholder="Number, participant, title" /></label>
          <label className="search-field">Status<select value={certificateStatus} onChange={(event) => { setCertificateStatus(event.target.value); setCertificatePage(1) }}><option value="">All</option><option value="issued">Issued</option><option value="revoked">Revoked</option><option value="draft">Draft</option></select></label></div>
      </div>
      {certificates.isLoading ? <TableSkeleton label="Loading certificates" columns={5} /> : certificates.error ? <p className="notice error" role="alert">{friendlyError(certificates.error)} <button type="button" onClick={() => void certificates.refetch()}>Retry</button></p> : certificates.data?.certificates.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Recipient</th><th>Certificate</th><th>Issued</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {certificates.data.certificates.map((certificate) => <tr key={certificate.id}><td>{certificate.participantName}</td><td><strong>{certificate.certificateNumber}</strong><span className="table-subtitle">{certificate.title}</span></td><td>{dateLabel(certificate.issuedAt)}</td><td><span className={`status-label status-${certificate.status}`}>{certificate.status}</span></td><td>{certificate.status === 'issued' ? revokeId === certificate.id ? <div className="revoke-form"><input aria-label="Reason for revocation" value={revokeReason} maxLength={500} onChange={(event) => setRevokeReason(event.target.value)} placeholder="Reason (required)" /><button className="danger-link" type="button" disabled={revoke.isPending} onClick={() => submitRevocation(certificate.id)}>Confirm revoke</button><button className="button-secondary" type="button" onClick={() => { setRevokeId(''); setRevokeReason('') }}>Cancel</button></div> : <button className="danger-link" type="button" onClick={() => setRevokeId(certificate.id)}>Revoke</button> : <span className="muted-text">{certificate.status === 'revoked' ? `Revoked ${dateLabel(certificate.revokedAt)}` : 'Pending'}</span>}</td></tr>)}
      </tbody></table></div> : <p className="empty-state">No certificates match this search.</p>}
      {certificates.data && <p className="muted-text">Showing {certificates.data.certificates.length} of {certificates.data.total} certificates.</p>}
      {certificates.data && <Pagination page={certificatePage} pageSize={50} total={certificates.data.total} onPage={setCertificatePage} />}
      {revoke.error && <p className="notice error" role="alert">{friendlyError(revoke.error)}</p>}
      {revoke.isSuccess && <p className="notice success" role="status">Certificate status updated. Public verification now reflects the revocation.</p>}
    </section>
  </section>
}
