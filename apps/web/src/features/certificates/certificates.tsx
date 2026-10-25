import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiDownload, apiFetch } from '../../lib/api-client'
import { RouteNavigation } from '../navigation/RouteNavigation'
import { CertificateListSkeleton, DetailSkeleton, LoadingLabel } from '../../components/loading/LoadingUi'
import { Select } from '../../components/ui/Select'

type Certificate = {
  id: string
  certificateNumber: string
  eventId: string
  eventName: string
  title: string
  description: string | null
  status: 'draft' | 'issued' | 'revoked'
  issuedAt: string | null
  revokedAt: string | null
  createdAt: string
}
type CertificateList = { certificates: Certificate[]; total: number; page: number; pageSize: number }
type Verification =
  | { result: 'not_found'; valid: false }
  | { result: 'valid' | 'revoked'; valid: boolean; certificate: { certificateNumber: string; title: string; participantName: string; eventName: string; issuedAt: string | null; revokedAt: string | null } }

const friendlyError = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString() : '—'

export function MyCertificatesPage({ admin = false }: { admin?: boolean }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [previewId, setPreviewId] = useState('')
  const params = new URLSearchParams({ page: String(page), pageSize: '50' })
  if (search.trim()) params.set('search', search.trim())
  if (status) params.set('status', status)
  const certificates = useQuery({
    queryKey: ['my-certificates', search, status, page],
    queryFn: () => apiFetch<CertificateList>(`/me/certificates?${params.toString()}`),
  })
  const download = useMutation({
    mutationFn: (certificate: Certificate) => apiDownload(`/certificates/${certificate.id}/pdf`).then((blob) => ({ blob, certificate })),
    onSuccess: ({ blob, certificate }) => saveBlob(blob, `${certificate.certificateNumber}.pdf`),
  })
  const [previewUrl, setPreviewUrl] = useState('')
  const preview = useMutation({
    mutationFn: (certificateId: string) => apiDownload(`/certificates/${certificateId}/pdf?disposition=inline`),
    onSuccess: (blob) => setPreviewUrl(URL.createObjectURL(blob)),
  })
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])
  const content = <section className={`auth-card event-card certificate-page aw-page${admin ? ' admin-event-card' : ''}`}>
    {!admin && <RouteNavigation />}
    <header className="aw-page-heading"><div><h1>My certificates</h1><p>Find and download certificates issued to your account.</p></div></header>
    <div className="certificate-toolbar">
      <label className="field">Search certificates<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Certificate number, event, title" /></label>
      <Select
        inlineLabel="Status"
        value={status}
        onValueChange={(val) => { setStatus(val); setPage(1) }}
        options={[
          { value: '', label: 'All statuses' },
          { value: 'issued', label: 'Issued', color: 'green' },
          { value: 'revoked', label: 'Revoked', color: 'red' },
          { value: 'draft', label: 'Draft', color: 'gray' },
        ]}
        aria-label="Filter certificates by status"
      />
    </div>
    {certificates.isLoading ? <CertificateListSkeleton /> : certificates.error ? <p className="notice error" role="alert">{friendlyError(certificates.error)} <button type="button" onClick={() => void certificates.refetch()}>Retry</button></p> : certificates.data?.certificates.length ? <>
      <p className="notice">{certificates.data.total} certificate{certificates.data.total === 1 ? '' : 's'} found.</p>
      <ul className="certificate-list">{certificates.data.certificates.map((certificate) => <li key={certificate.id}>
        <div><strong>{certificate.title}</strong><span>{certificate.eventName} · {certificate.certificateNumber}</span><span>Issued {formatDate(certificate.issuedAt)} · <StatusLabel status={certificate.status} /></span></div>
        <div className="certificate-actions">
          {certificate.status !== 'draft' && <><button className="button-secondary" type="button" onClick={() => { setPreviewId(certificate.id); setPreviewUrl(''); preview.mutate(certificate.id) }}>Preview</button><button className="button-secondary" type="button" disabled={download.isPending} onClick={() => download.mutate(certificate)}>{download.isPending ? <LoadingLabel>Preparing</LoadingLabel> : 'Download PDF'}</button></>}
          <Link className="aw-button" to={`${admin ? '/admin/my-certificates' : '/certificates'}/${certificate.id}`}>Details</Link>
        </div>
      </li>)}</ul>
      {download.error && <p className="notice error" role="alert">{friendlyError(download.error)}</p>}
      <Pagination page={page} pageSize={50} total={certificates.data.total} onPage={setPage} />
    </> : <p className="empty-state">No certificates match these filters.</p>}
    <p className="certificate-back"><Link to={admin ? '/admin/dashboard' : '/account'}>{admin ? 'Back to admin workspace' : 'Back to account'}</Link></p>
    {previewId && <section className="pdf-preview" aria-label="Certificate PDF preview">
      <div className="pdf-preview-heading"><h2>Certificate preview</h2><button className="button-secondary" type="button" onClick={() => { setPreviewId(''); setPreviewUrl(''); preview.reset() }}>Close preview</button></div>
      {preview.isPending ? <p role="status"><LoadingLabel>Loading PDF</LoadingLabel></p> : preview.error ? <p className="notice error" role="alert">{friendlyError(preview.error)} <button type="button" onClick={() => preview.mutate(previewId)}>Retry</button></p> : previewUrl && <iframe title="Certificate PDF" src={previewUrl} />}
    </section>}
  </section>
  return admin ? content : <main className="auth-shell">{content}</main>
}

export function PublicCertificateVerificationPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [verificationCode, setVerificationCode] = useState('')
  const [inputError, setInputError] = useState('')
  const verification = useQuery({ queryKey: ['public-certificate-verification', token], queryFn: () => apiFetch<Verification>(`/verify/${encodeURIComponent(token)}`), enabled: Boolean(token), retry: false })
  function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = verificationCode.trim()
    if (!/^[A-Za-z0-9_-]{43}$/.test(value)) { setInputError('Enter the 43-character verification code from the certificate.'); return }
    setInputError('')
    navigate(`/verify/${encodeURIComponent(value)}`)
  }
  return <main className="auth-shell"><section className="auth-card event-card verification-card">
    <p className="eyebrow">HMI CERTIFICATES</p><h1>Verify a certificate</h1><p className="notice">Check the current status of an HMI certificate using its verification code.</p>
    {!token && <form className="verification-code-form" onSubmit={submitVerification}><label className="field">Verification code<input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} autoComplete="off" placeholder="Paste verification code" /></label>{inputError && <p className="notice error" role="alert">{inputError}</p>}<button className="button-primary" type="submit">Verify certificate</button><small>Certificate numbers are not accepted here; use the verification code printed on the certificate.</small></form>}
    {verification.isLoading ? <p role="status"><LoadingLabel>Checking certificate</LoadingLabel></p>
      : verification.error ? <p className="notice error" role="alert">{friendlyError(verification.error)} <button type="button" onClick={() => void verification.refetch()}>Retry</button></p>
        : verification.data?.result === 'not_found' ? <div className="verification-status is-invalid"><strong>Certificate not found</strong><p>This verification code does not match an issued certificate.</p></div>
          : verification.data && <>
            <div className={`verification-status ${verification.data.valid ? 'is-valid' : 'is-invalid'}`}><strong>{verification.data.valid ? 'Valid certificate' : 'Revoked certificate'}</strong><p>{verification.data.valid ? 'The current certificate record is valid.' : 'The current certificate record has been revoked.'}</p></div>
            <dl className="event-details verification-details"><dt>Certificate</dt><dd>{verification.data.certificate.certificateNumber}</dd><dt>Recipient</dt><dd>{verification.data.certificate.participantName}</dd><dt>Event</dt><dd>{verification.data.certificate.eventName}</dd><dt>Title</dt><dd>{verification.data.certificate.title}</dd><dt>Issued</dt><dd>{formatDate(verification.data.certificate.issuedAt)}</dd>{verification.data.certificate.revokedAt && <><dt>Revoked</dt><dd>{formatDate(verification.data.certificate.revokedAt)}</dd></>}</dl>
          </>}
    <p className="certificate-back"><Link to="/verify">Verify another certificate</Link></p>
  </section></main>
}

export function CertificateDetailsPage({ admin = false }: { admin?: boolean }) {
  const { certificateId = '' } = useParams()
  const certificate = useQuery({
    queryKey: ['my-certificate', certificateId],
    queryFn: () => apiFetch<{ certificate: Omit<Certificate, 'issuedAt' | 'revokedAt' | 'createdAt'> & { issuedAt: string | null; revokedAt: string | null; createdAt: string; updatedAt: string } }>(`/certificates/${certificateId}`),
  })
  const download = useMutation({
    mutationFn: () => apiDownload(`/certificates/${certificateId}/pdf`),
    onSuccess: (blob) => saveBlob(blob, `${certificate.data?.certificate.certificateNumber ?? 'certificate'}.pdf`),
  })
  const content = <section className={`aw-page aw-certificate-details${admin ? '' : ' auth-card event-card'}`}>
    {!admin && <p className="eyebrow">HMI CERTIFICATES</p>}
    <header className="aw-page-heading"><div><h1>Certificate details</h1><p>Certificate information and owner-authorized actions.</p></div></header>
    {certificate.isLoading ? <DetailSkeleton label="Loading certificate details" /> : certificate.error || !certificate.data ? <div><p className="notice error" role="alert">{friendlyError(certificate.error)} <button type="button" onClick={() => void certificate.refetch()}>Retry</button></p><Link className="aw-button" to={admin ? '/admin/my-certificates' : '/certificates'}>Back to my certificates</Link></div> : <>
      <section className="aw-panel"><div className="aw-certificate-detail-heading"><div><p className="aw-eyebrow">{certificate.data.certificate.certificateNumber}</p><h2>{certificate.data.certificate.title}</h2><p>{certificate.data.certificate.eventName}</p></div><StatusLabel status={certificate.data.certificate.status} /></div>
        <dl className="aw-detail-list"><div><dt>Certificate number</dt><dd>{certificate.data.certificate.certificateNumber}</dd></div><div><dt>Event</dt><dd><Link to={`/events/${certificate.data.certificate.eventId}`}>{certificate.data.certificate.eventName}</Link></dd></div><div><dt>Description</dt><dd>{certificate.data.certificate.description || 'No description provided.'}</dd></div><div><dt>Issued</dt><dd>{formatDate(certificate.data.certificate.issuedAt)}</dd></div><div><dt>Status</dt><dd><StatusLabel status={certificate.data.certificate.status} /></dd></div>{certificate.data.certificate.revokedAt && <div><dt>Revoked</dt><dd>{formatDate(certificate.data.certificate.revokedAt)}</dd></div>}</dl>
        <div className="aw-certificate-detail-actions"><Link className="aw-button" to={admin ? '/admin/my-certificates' : '/certificates'}>Back to my certificates</Link>{certificate.data.certificate.status !== 'draft' && <button className="aw-button aw-button--primary" type="button" disabled={download.isPending} onClick={() => download.mutate()}>{download.isPending ? <LoadingLabel>Preparing PDF</LoadingLabel> : 'Download PDF'}</button>}</div>
        {download.error && <p className="notice error" role="alert">{friendlyError(download.error)}</p>}
        <p className="aw-detail-limit-note">Verification details and revocation reason are not included in the current owner certificate response.</p>
      </section>
    </>}
  </section>
  return admin ? content : <main className="auth-shell">{content}</main>
}

function StatusLabel({ status }: { status: Certificate['status'] }) {
  return <span className={`status-label status-${status}`}>{status}</span>
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages < 2) return null
  return <nav className="pagination" aria-label="Certificate pages"><button className="button-secondary" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="button-secondary" type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></nav>
}
