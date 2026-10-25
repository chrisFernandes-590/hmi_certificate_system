import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, FileSpreadsheet, LoaderCircle, RotateCcw, UploadCloud, Users, X } from 'lucide-react'
import { ApiError, apiDownload, apiFetch, friendlyApiMessage } from '../../lib/api-client'
import { inspectParticipantCsv, validateParticipantCsvLocally, type CsvColumnMapping, type CsvImportProgress, type CsvInspection, type LocalCsvValidation } from '../admin/csv-import'
import { Select } from '../../components/ui/Select'
import './participant-import.css'

type ImportJob = {
  id: string
  eventId: string
  status: string
  fileName: string
  contentType: string
  fileSizeBytes: number
  checksumSha256: string
  duplicatePolicy: 'skip' | 'update'
  totalRows: number
  validRows: number
  duplicateRows: number
  invalidRows: number
  expectedNew: number
  expectedUpdates: number
  processedRows: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  rowErrors: Array<{ row: number; name: string; email: string; reason: string; existingParticipantId?: string }>
  errorMessage: string | null
  cancelRequested: boolean
  expiresAt: string
  validatedAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

type ImportHistoryItem = Pick<
  ImportJob,
  'id' | 'status' | 'fileName' | 'totalRows' | 'validRows' | 'duplicateRows' | 'invalidRows' | 'createdCount' | 'updatedCount' | 'skippedCount' | 'createdAt'
>

type UploadTicket = {
  uploadId: string
  url: string
  headers: Record<string, string>
  expiresAt: string
  fallbackUrl?: string
}

type MappingState = Partial<CsvColumnMapping>
type StepStatus = 'pending' | 'active' | 'complete' | 'failed'

type StepItem = {
  number: number
  title: string
  description: string
  status: StepStatus
  detail?: string
}

const MAX_BYTES = 20 * 1024 * 1024
const storageKey = (eventId: string) => `hmi:participant-import:v1:${eventId}`
const readableSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const statusLabel: Record<string, string> = {
  upload_pending: 'Upload pending',
  uploaded: 'Uploaded',
  validating: 'Checking existing participants',
  validated: 'Ready to import',
  queued: 'Queued',
  importing: 'Adding participants to event',
  completed: 'Import complete',
  partial: 'Paused with partial results',
  failed: 'Import failed',
  cancelled: 'Cancelled',
}

const friendlyError = (error: unknown) => {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

export function ParticipantImportWizard({ eventId, eventName }: { eventId: string; eventName: string }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<XMLHttpRequest | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [inspection, setInspection] = useState<CsvInspection | null>(null)
  const [mapping, setMapping] = useState<MappingState>({})
  const [localValidation, setLocalValidation] = useState<LocalCsvValidation | null>(null)
  const [progress, setProgress] = useState<CsvImportProgress>({ bytesRead: 0, totalBytes: 0, rowsParsed: 0 })
  const [localBusy, setLocalBusy] = useState(false)
  const [busy, setBusy] = useState<'idle' | 'hashing' | 'uploading' | 'completing' | 'confirming' | 'cancelling'>('idle')
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadBytes, setUploadBytes] = useState({ loaded: 0, total: 0 })
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'update'>('skip')
  const [jobId, setJobId] = useState(() => {
    try { return localStorage.getItem(storageKey(eventId)) ?? '' } catch { return '' }
  })
  const [selectedJobId, setSelectedJobId] = useState(jobId)
  const [dragging, setDragging] = useState(false)

  const jobQuery = useQuery({
    queryKey: ['participant-import-job', eventId, selectedJobId],
    queryFn: () => apiFetch<{ job: ImportJob }>(`/admin/import-jobs/${selectedJobId}`),
    enabled: Boolean(selectedJobId),
    refetchInterval: (query) => ['uploaded', 'validating', 'queued', 'importing'].includes(query.state.data?.job.status ?? '') ? 1200 : false,
  })

  const historyQuery = useQuery({
    queryKey: ['participant-import-history', eventId],
    queryFn: () => apiFetch<{ jobs: ImportHistoryItem[] }>(`/events/${eventId}/participants/import-jobs`),
  })

  const job = jobQuery.data?.job
  const hasValidMapping = mapping.name !== undefined && mapping.email !== undefined && mapping.name !== mapping.email
  const mappedPreview = useMemo(() => localValidation?.previewRows ?? [], [localValidation])

  // Derive session expiration from state or query errors
  const isSessionExpired = sessionExpired || (jobQuery.error instanceof ApiError && jobQuery.error.statusCode === 401)

  // Perform local parsing and validation
  useEffect(() => {
    if (!file || !inspection || !hasValidMapping) return
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setLocalBusy(true) })
    queueMicrotask(() => { if (!cancelled) setProgress({ bytesRead: 0, totalBytes: file.size, rowsParsed: 0 }) })

    void validateParticipantCsvLocally(file, mapping as CsvColumnMapping, setProgress)
      .then((result) => {
        if (!cancelled) {
          setLocalValidation(result)
          setError('')
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLocalValidation(null)
          setError(friendlyError(reason))
        }
      })
      .finally(() => {
        if (!cancelled) setLocalBusy(false)
      })

    return () => { cancelled = true }
  }, [file, hasValidMapping, inspection, mapping])

  // Persist current active jobId for event
  useEffect(() => {
    if (!jobId) return
    try { localStorage.setItem(storageKey(eventId), jobId) } catch { /* best effort */ }
  }, [eventId, jobId])

  // Invalidate participants cache upon completion or partial import
  useEffect(() => {
    if (job?.status === 'completed' || job?.status === 'partial') {
      void queryClient.invalidateQueries({ queryKey: ['event-participants', eventId] })
    }
  }, [eventId, job?.status, queryClient])

  async function selectFile(next: File | undefined) {
    if (!next) return
    if (job?.status === 'upload_pending' && (job.fileName !== next.name || job.fileSizeBytes !== next.size)) {
      await cancelJob(job.id, false)
      setJobId('')
      setSelectedJobId('')
      try { localStorage.removeItem(storageKey(eventId)) } catch { /* best effort */ }
    }
    if (inputRef.current) inputRef.current.value = ''
    setFile(next)
    setInspection(null)
    setLocalValidation(null)
    setMapping({})
    setProgress({ bytesRead: 0, totalBytes: next.size, rowsParsed: 0 })
    setError('')
    setSessionExpired(false)

    if (!next.name.toLowerCase().endsWith('.csv')) {
      setError('Choose a .csv file.')
      return
    }
    if (next.size < 1 || next.size > MAX_BYTES) {
      setError('CSV files must be smaller than 20 MB.')
      return
    }

    setLocalBusy(true)
    try {
      const result = await inspectParticipantCsv(next, setProgress)
      setInspection(result)
      setMapping({
        name: result.suggested.name,
        email: result.suggested.email,
        phone: result.suggested.phone,
        organization: result.suggested.organization,
      })
      setError('')
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setLocalBusy(false)
    }
  }

  function changeMapping(field: keyof CsvColumnMapping, value: string) {
    const index = value === '' ? undefined : Number(value)
    setLocalValidation(null)
    setMapping((current) => ({ ...current, [field]: index }))
  }

  async function beginUpload(forceFreshTicket = false) {
    if (!file || !inspection || !localValidation || !hasValidMapping) return
    setError('')
    setSessionExpired(false)
    setBusy('hashing')

    try {
      const checksumSha256 = await sha256Base64(file)
      let ticket: UploadTicket

      if (
        !forceFreshTicket &&
        job?.status === 'upload_pending' &&
        job.fileSizeBytes === file.size &&
        job.checksumSha256 === checksumSha256 &&
        job.fileName === file.name
      ) {
        // Renew existing upload ticket
        try {
          ticket = await apiFetch<UploadTicket>(`/events/${eventId}/participants/import/${job.id}/upload-url`, {
            method: 'POST',
            body: '{}',
          })
        } catch {
          // If renewal failed, create a fresh ticket
          ticket = await apiFetch<UploadTicket>(`/events/${eventId}/participants/import/upload-url`, {
            method: 'POST',
            body: JSON.stringify({
              fileName: file.name,
              contentType: file.type || 'text/csv',
              fileSizeBytes: file.size,
              checksumSha256,
            }),
          })
        }
      } else {
        if (job?.status === 'upload_pending') await cancelJob(job.id, false)
        ticket = await apiFetch<UploadTicket>(`/events/${eventId}/participants/import/upload-url`, {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'text/csv',
            fileSizeBytes: file.size,
            checksumSha256,
          }),
        })
      }

      setJobId(ticket.uploadId)
      setSelectedJobId(ticket.uploadId)
      setBusy('uploading')
      setUploadPercent(0)
      setUploadBytes({ loaded: 0, total: file.size })

      await uploadCsvDirect(
        file,
        ticket,
        (percent, loaded, total) => {
          setUploadPercent(percent)
          setUploadBytes({ loaded, total })
        },
        uploadRef,
        eventId,
      )

      setBusy('completing')
      await apiFetch(`/events/${eventId}/participants/import/${ticket.uploadId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ mapping, duplicatePolicy }),
      })

      setJobId(ticket.uploadId)
      setSelectedJobId(ticket.uploadId)
      await jobQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: ['participant-import-history', eventId] })
      setBusy('idle')
    } catch (reason) {
      setBusy('idle')
      if (reason instanceof ApiError && reason.statusCode === 401) {
        setSessionExpired(true)
        setError('Your login session has expired. Please log in again to continue.')
      } else if (!(reason instanceof Error && reason.message === 'Upload cancelled.')) {
        setError(friendlyError(reason))
      }
    }
  }

  async function confirmImport() {
    if (!job) return
    setBusy('confirming')
    setError('')
    try {
      await apiFetch(`/admin/import-jobs/${job.id}/confirm`, { method: 'POST', body: '{}' })
      setJobId(job.id)
      await jobQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: ['participant-import-history', eventId] })
    } catch (reason) {
      if (reason instanceof ApiError && reason.statusCode === 401) {
        setSessionExpired(true)
        setError('Your login session has expired. Please log in again to continue.')
      } else {
        setError(friendlyError(reason))
      }
    } finally {
      setBusy('idle')
    }
  }

  async function cancelJob(id: string, reset = true) {
    if (uploadRef.current) {
      uploadRef.current.abort()
      uploadRef.current = null
    }
    setBusy('cancelling')
    let cancelled = false
    try {
      await apiFetch(`/admin/import-jobs/${id}/cancel`, { method: 'POST', body: '{}' })
      cancelled = true
    } catch (reason) {
      if (reset) setError(friendlyError(reason))
    } finally {
      setBusy('idle')
      void queryClient.invalidateQueries({ queryKey: ['participant-import-history', eventId] })
      if (reset && cancelled) resetWizard()
    }
  }

  function resetWizard() {
    uploadRef.current?.abort()
    uploadRef.current = null
    setFile(null)
    setInspection(null)
    setLocalValidation(null)
    setMapping({})
    setError('')
    setSessionExpired(false)
    setProgress({ bytesRead: 0, totalBytes: 0, rowsParsed: 0 })
    setUploadPercent(0)
    setUploadBytes({ loaded: 0, total: 0 })
    setSelectedJobId('')
    setJobId('')
    try { localStorage.removeItem(storageKey(eventId)) } catch { /* best effort */ }
    if (inputRef.current) inputRef.current.value = ''
  }

  async function downloadReport() {
    if (!job) return
    try {
      const blob = await apiDownload(`/admin/import-jobs/${job.id}/errors.csv`)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${job.fileName.replace(/\.csv$/i, '')}-validation-errors.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (reason) {
      setError(friendlyError(reason))
    }
  }

  function scrollToParticipants() {
    const target = document.getElementById('participants-heading') || document.getElementById('participants-table')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const isBusy = busy !== 'idle' || localBusy
  const resumePending = job?.status === 'upload_pending' && !file
  const hasActiveOrCompletedJob = Boolean(job && job.status !== 'upload_pending')
  const showDashboard = hasActiveOrCompletedJob || busy === 'uploading' || busy === 'completing' || busy === 'confirming'
  const showLocalReview = !showDashboard
  const canRetryUpload = Boolean(file && (job?.status === 'upload_pending' || error.includes('authorization expired') || error.includes('Storage rejected')))

  // Calculate the 6 canonical human-readable progress steps
  const steps: StepItem[] = useMemo(() => {
    // Step 1: Preparing participant list
    let s1Status: StepStatus = 'pending'
    if (file && (localBusy && !inspection)) s1Status = 'active'
    else if (inspection && hasValidMapping) s1Status = 'complete'
    else if (file) s1Status = 'active'

    // Step 2: Checking participant details
    let s2Status: StepStatus = 'pending'
    if (s1Status === 'complete') {
      if (localBusy && inspection) s2Status = 'active'
      else if (busy === 'hashing' || busy === 'uploading') s2Status = 'active'
      else if (job?.status === 'upload_pending') s2Status = 'active'
      else if (job && job.status !== 'upload_pending') s2Status = 'complete'
      else if (localValidation) s2Status = 'complete'
    }

    // Step 3: Checking for existing participants
    let s3Status: StepStatus = 'pending'
    if (['uploaded', 'validating'].includes(job?.status ?? '')) s3Status = 'active'
    else if (['validated', 'queued', 'importing', 'completed', 'partial'].includes(job?.status ?? '')) s3Status = 'complete'
    else if (job?.status === 'failed' && !job.validatedAt) s3Status = 'failed'

    // Step 4: Adding participants to your event
    let s4Status: StepStatus = 'pending'
    if (['queued', 'importing'].includes(job?.status ?? '') || busy === 'confirming') s4Status = 'active'
    else if (job?.status === 'completed' || (job?.status === 'partial' && job.processedRows > 0)) s4Status = 'complete'
    else if (job?.status === 'failed' && Boolean(job.validatedAt)) s4Status = 'failed'

    // Step 5: Finishing up
    let s5Status: StepStatus = 'pending'
    if (job?.status === 'completed') s5Status = 'complete'
    else if (job?.status === 'importing' && job.processedRows >= job.totalRows) s5Status = 'active'

    // Step 6: Import complete
    let s6Status: StepStatus = 'pending'
    if (job?.status === 'completed') s6Status = 'complete'

    return [
      {
        number: 1,
        title: 'Preparing participant list',
        description: 'Reading the file and identifying its columns.',
        status: s1Status,
        detail: inspection ? `${inspection.rowCount.toLocaleString()} rows detected · ${inspection.headers.length} columns` : undefined,
      },
      {
        number: 2,
        title: 'Checking participant details',
        description: 'Validating names, email addresses, and required fields.',
        status: s2Status,
        detail: localValidation ? `${localValidation.validRows.toLocaleString()} valid · ${localValidation.invalidRows.toLocaleString()} formatting issues` : undefined,
      },
      {
        number: 3,
        title: 'Checking for existing participants',
        description: 'Identifying duplicates and existing event memberships.',
        status: s3Status,
        detail: job?.validatedAt ? `${job.expectedNew.toLocaleString()} new · ${job.expectedUpdates.toLocaleString()} to link · ${job.duplicateRows.toLocaleString()} existing duplicates` : undefined,
      },
      {
        number: 4,
        title: 'Adding participants to your event',
        description: 'Saving new records and linking existing participants as appropriate.',
        status: s4Status,
        detail: ['queued', 'importing'].includes(job?.status ?? '')
          ? `${job?.processedRows.toLocaleString()} of ${job?.totalRows.toLocaleString()} rows saved`
          : job?.status === 'completed'
            ? `${job?.createdCount.toLocaleString()} added · ${job?.updatedCount.toLocaleString()} linked`
            : undefined,
      },
      {
        number: 5,
        title: 'Finishing up',
        description: 'Confirming saved records and cleaning up the temporary file.',
        status: s5Status,
        detail: job?.status === 'completed' ? 'Database committed and temporary CSV securely deleted' : undefined,
      },
      {
        number: 6,
        title: 'Import complete',
        description: 'Displaying the final summary.',
        status: s6Status,
        detail: job?.status === 'completed' ? `Finished for ${eventName}` : undefined,
      },
    ]
  }, [file, inspection, hasValidMapping, localBusy, busy, localValidation, job, eventName])

  // Overall progress percentage calculation
  const overallPercent = useMemo(() => {
    if (job?.status === 'completed') return 100
    if (busy === 'uploading') return Math.round(uploadPercent * 0.25)
    if (job?.status === 'uploaded' || job?.status === 'validating') return 35
    if (job?.status === 'validated') return 50
    if (['queued', 'importing'].includes(job?.status ?? '')) {
      const rowRatio = job && job.totalRows > 0 ? (job.processedRows / job.totalRows) : 0
      return Math.min(95, Math.round(50 + rowRatio * 45))
    }
    return 0
  }, [job, busy, uploadPercent])

  const totalRowCount = job?.totalRows ?? inspection?.rowCount ?? 0
  const addedCount = job?.createdCount ?? 0
  const linkedCount = job?.updatedCount ?? 0
  const skippedCount = job?.skippedCount ?? (localValidation?.duplicateRows ?? 0)
  const invalidCount = job?.invalidRows ?? (localValidation?.invalidRows ?? 0)

  return (
    <section className="pi-panel" aria-labelledby="pi-heading">
      <div className="pi-heading">
        <div>
          <h3 id="pi-heading">Import participants</h3>
          <p>Review the CSV locally, validate it on the server, then confirm participant changes.</p>
        </div>
        <FileSpreadsheet size={18} aria-hidden="true" />
      </div>

      {isSessionExpired && (
        <div className="pi-error" role="alert">
          <AlertCircle size={16} />
          <div>
            <strong>Your login session has expired.</strong>{' '}
            <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
              Sign in again
            </a>{' '}
            to refresh authorization and continue your import.
          </div>
        </div>
      )}

      {resumePending && (
        <div className="pi-resume" role="status">
          <span>
            A pending upload for <strong>{job?.fileName}</strong> can be resumed. Select that file again to continue.
          </span>
          <button type="button" onClick={() => void cancelJob(job.id)}>
            Discard pending upload
          </button>
        </div>
      )}

      {showLocalReview && (
        <>
          <div
            className={`pi-dropzone${dragging ? ' is-dragging' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              void selectFile(event.dataTransfer.files[0])
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="Select participant CSV"
              onChange={(event) => void selectFile(event.target.files?.[0])}
            />
            <UploadCloud size={22} aria-hidden="true" />
            <strong>{file ? file.name : 'Choose or drop a CSV file'}</strong>
            <span>
              {file
                ? `${readableSize(file.size)} · ${file.type || 'CSV file'} · inspected only in this browser`
                : 'CSV up to 20 MB, 20,000 participant rows'}
            </span>
            <button type="button" className="pi-button" onClick={() => inputRef.current?.click()}>
              {file ? 'Change file' : 'Choose CSV'}
            </button>
          </div>

          {localBusy && (
            <div className="pi-progress" role="status">
              <LoaderCircle size={15} className="pi-spin" />
              {inspection ? 'Checking mapped rows locally' : 'Inspecting CSV locally'} · {Math.round((progress.bytesRead / Math.max(progress.totalBytes, 1)) * 100)}% · {progress.rowsParsed.toLocaleString()} rows
            </div>
          )}

          {inspection && (
            <>
              <div className="pi-file-summary">
                <span><strong>{inspection.rowCount.toLocaleString()}</strong> rows found locally</span>
                <span>Server duplicates have not been checked yet.</span>
              </div>

              <div className="pi-mapping">
                <strong>Map columns</strong>
                <label>
                  Name
                  <Select
                    value={mapping.name !== undefined ? String(mapping.name) : ''}
                    onValueChange={(val) => changeMapping('name', val)}
                    options={[
                      { value: '', label: 'Select a column' },
                      ...inspection.headers.map((header, index) => ({
                        value: String(index),
                        label: header || `Column ${index + 1}`,
                      })),
                    ]}
                    fullWidth
                  />
                </label>
                <label>
                  Email
                  <Select
                    value={mapping.email !== undefined ? String(mapping.email) : ''}
                    onValueChange={(val) => changeMapping('email', val)}
                    options={[
                      { value: '', label: 'Select a column' },
                      ...inspection.headers.map((header, index) => ({
                        value: String(index),
                        label: header || `Column ${index + 1}`,
                      })),
                    ]}
                    fullWidth
                  />
                </label>
                <label>
                  Phone (optional)
                  <Select
                    value={mapping.phone !== undefined ? String(mapping.phone) : ''}
                    onValueChange={(val) => changeMapping('phone', val)}
                    options={[
                      { value: '', label: 'Not mapped' },
                      ...inspection.headers.map((header, index) => ({
                        value: String(index),
                        label: header || `Column ${index + 1}`,
                      })),
                    ]}
                    fullWidth
                  />
                </label>
                <label>
                  Organization (optional)
                  <Select
                    value={mapping.organization !== undefined ? String(mapping.organization) : ''}
                    onValueChange={(val) => changeMapping('organization', val)}
                    options={[
                      { value: '', label: 'Not mapped' },
                      ...inspection.headers.map((header, index) => ({
                        value: String(index),
                        label: header || `Column ${index + 1}`,
                      })),
                    ]}
                    fullWidth
                  />
                </label>
              </div>

              <label className="pi-policy">
                When an existing event participant is found
                <Select
                  value={duplicatePolicy}
                  onValueChange={(val) => setDuplicatePolicy(val as 'skip' | 'update')}
                  options={[
                    { value: 'skip', label: 'Skip duplicates (recommended)' },
                    { value: 'update', label: 'Update existing guest details' },
                  ]}
                  fullWidth
                />
              </label>

              {localValidation && (
                <div className="pi-local-stats" role="status">
                  <span>{localValidation.validRows.toLocaleString()} locally valid</span>
                  <span>{localValidation.duplicateRows.toLocaleString()} repeated emails</span>
                  <span>{localValidation.invalidRows.toLocaleString()} formatting issues</span>
                </div>
              )}

              {mappedPreview.length > 0 && (
                <div className="pi-preview-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Local check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappedPreview.slice(0, 8).map((row) => (
                        <tr key={row.row}>
                          <td>{row.row}</td>
                          <td>{row.name || '—'}</td>
                          <td>{row.email || '—'}</td>
                          <td>
                            {row.issue ? <span className="pi-bad">{row.issue}</span> : <span className="pi-good">Ready</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pi-actions-row">
                <button
                  type="button"
                  className="pi-button pi-primary"
                  disabled={isBusy || !localValidation || !hasValidMapping}
                  onClick={() => void beginUpload(false)}
                >
                  {busy === 'hashing' ? 'Preparing secure upload…' : 'Upload and validate'}
                </button>

                {canRetryUpload && (
                  <button
                    type="button"
                    className="pi-button"
                    disabled={isBusy}
                    onClick={() => void beginUpload(true)}
                  >
                    <RotateCcw size={14} /> Retry upload
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Human-Readable Progress Dashboard */}
      {showDashboard && (
        <div className="pi-dashboard" role="region" aria-label="Import progress dashboard">
          <div className="pi-dashboard-header">
            <div>
              <h4>{job?.fileName ?? file?.name ?? 'Participant Import'}</h4>
              <p>
                {eventName} · {readableSize(job?.fileSizeBytes ?? file?.size ?? 0)} ·{' '}
                <span className={`pi-status pi-status--${job?.status ?? 'uploading'}`}>
                  {statusLabel[job?.status ?? 'uploading'] ?? 'Processing'}
                </span>
              </p>
            </div>
            {job?.status !== 'completed' && job?.status !== 'cancelled' && (
              <button
                type="button"
                className="pi-icon-button"
                aria-label="Cancel import"
                disabled={isBusy}
                onClick={() => (job ? void cancelJob(job.id) : uploadRef.current?.abort())}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Progress Bar with Truthful Percentage */}
          <div className="pi-dashboard-progress">
            <div className="pi-dashboard-progress-meta">
              <span>
                {job?.status === 'completed'
                  ? 'Import completed successfully'
                  : busy === 'uploading'
                    ? `Uploading file: ${readableSize(uploadBytes.loaded)} of ${readableSize(uploadBytes.total)} (${uploadPercent}%)`
                    : ['queued', 'importing'].includes(job?.status ?? '')
                      ? `Processing records (${job?.processedRows ?? 0} of ${job?.totalRows ?? 0})`
                      : ['uploaded', 'validating'].includes(job?.status ?? '')
                        ? 'Checking participant records…'
                        : job?.status === 'validated'
                          ? 'Validation complete — review and confirm'
                          : 'Processing import…'}
              </span>
              <span>{overallPercent}%</span>
            </div>
            <div className="pi-dashboard-progress-bar">
              <div
                className={`pi-dashboard-progress-fill${job?.status === 'completed' ? ' is-complete' : ''}`}
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="pi-metrics-grid">
            <div className="pi-metric-card">
              <strong>{totalRowCount.toLocaleString()}</strong>
              <span>Total rows</span>
            </div>
            <div className="pi-metric-card is-good">
              <strong>{addedCount.toLocaleString()}</strong>
              <span>Added</span>
            </div>
            <div className="pi-metric-card">
              <strong>{linkedCount.toLocaleString()}</strong>
              <span>Linked</span>
            </div>
            <div className="pi-metric-card">
              <strong>{skippedCount.toLocaleString()}</strong>
              <span>Skipped</span>
            </div>
            <div className={`pi-metric-card ${invalidCount > 0 ? 'is-warning' : ''}`}>
              <strong>{invalidCount.toLocaleString()}</strong>
              <span>Invalid</span>
            </div>
          </div>

          {/* 6 Step Cards */}
          <ol className="pi-step-list" aria-label="Import steps">
            {steps.map((step) => (
              <li
                key={step.number}
                className={`pi-step-item is-${step.status}`}
              >
                <div className="pi-step-icon">
                  {step.status === 'complete' ? (
                    <CheckCircle2 size={14} />
                  ) : step.status === 'active' ? (
                    <LoaderCircle size={14} className="pi-spin" />
                  ) : step.status === 'failed' ? (
                    <AlertCircle size={14} />
                  ) : (
                    <span>{step.number}</span>
                  )}
                </div>
                <div className="pi-step-content">
                  <div className="pi-step-title">
                    <span>{step.number}. {step.title}</span>
                    <small>
                      {step.status === 'complete'
                        ? 'Done'
                        : step.status === 'active'
                          ? 'In progress'
                          : step.status === 'failed'
                            ? 'Failed'
                            : 'Waiting'}
                    </small>
                  </div>
                  <p className="pi-step-desc">{step.description}</p>
                  {step.detail && <p className="pi-step-desc" style={{ color: 'var(--foreground)' }}>{step.detail}</p>}
                </div>
              </li>
            ))}
          </ol>

          {/* Validation Review State */}
          {job?.status === 'validated' && (
            <div className="pi-job" style={{ border: 'none', padding: 0 }}>
              <div className="pi-confirm-heading">
                <CheckCircle2 size={17} />
                <strong>Server check complete — ready for import</strong>
              </div>
              <p className="pi-review-event">
                Review verified counts for <strong>{eventName}</strong>:
              </p>
              <div className="pi-result-stats">
                <span><strong>{job.totalRows}</strong>Total rows</span>
                <span><strong>{job.validRows}</strong>Valid rows</span>
                <span><strong>{job.expectedNew}</strong>New participants</span>
                <span><strong>{job.expectedUpdates}</strong>Updates</span>
                <span><strong>{job.duplicateRows}</strong>Duplicates</span>
                <span><strong>{job.invalidRows}</strong>Invalid</span>
              </div>
              <p className="pi-review-event">
                Duplicate policy: <strong>{job.duplicatePolicy === 'update' ? 'Update existing guest details' : 'Skip duplicates'}</strong>
              </p>
              {job.rowErrors.length > 0 && (
                <div className="pi-validation-errors">
                  <strong>Server validation issues</strong>
                  <ul>
                    {job.rowErrors.slice(0, 8).map((item) => (
                      <li key={`${item.row}-${item.email}`}>
                        Row {item.row}: {item.reason} {item.email && <span>({item.email})</span>}
                      </li>
                    ))}
                  </ul>
                  {job.rowErrors.length > 8 && (
                    <button type="button" className="pi-text-button" onClick={() => void downloadReport()}>
                      Download all {job.rowErrors.length} validation errors (.csv)
                    </button>
                  )}
                </div>
              )}
              <div className="pi-actions-row">
                <button
                  type="button"
                  className="pi-button pi-primary"
                  disabled={isBusy || (job.expectedNew + job.expectedUpdates === 0)}
                  onClick={() => void confirmImport()}
                >
                  {busy === 'confirming' ? 'Starting import…' : `Import ${job.expectedNew + job.expectedUpdates} participants`}
                </button>
                <button
                  type="button"
                  className="pi-button"
                  disabled={isBusy}
                  onClick={() => void cancelJob(job.id)}
                >
                  Change file or column mapping
                </button>
                <button
                  type="button"
                  className="pi-button"
                  disabled={isBusy}
                  onClick={() => void cancelJob(job.id)}
                >
                  Cancel without importing
                </button>
              </div>
              <p className="pi-no-write">No database changes occur until you confirm the import.</p>
            </div>
          )}

          {/* Terminal Completed State */}
          {job?.status === 'completed' && (
            <div className="pi-final-summary" role="status">
              <CheckCircle2 size={18} />
              <span>
                Import complete: <strong>{job.createdCount}</strong> added, <strong>{job.updatedCount}</strong> updated/linked, <strong>{job.skippedCount}</strong> duplicates skipped.
              </span>
              <div className="pi-cleanup-badge">
                <CheckCircle2 size={13} />
                <span>Temporary CSV file has been securely removed</span>
              </div>
              <div className="pi-actions-row" style={{ width: '100%', marginTop: '.6rem' }}>
                <button type="button" className="pi-button pi-primary" onClick={scrollToParticipants}>
                  <Users size={14} /> View participants in event
                </button>
                <button type="button" className="pi-button" onClick={resetWizard}>
                  Start another CSV import
                </button>
              </div>
            </div>
          )}

          {/* Partial State */}
          {job?.status === 'partial' && (
            <div className="pi-final-summary is-warning" role="status">
              <AlertCircle size={18} />
              <span>
                {job.errorMessage ?? 'Import paused.'} {job.processedRows} of {job.totalRows} rows were processed.
              </span>
              <button type="button" className="pi-button" disabled={isBusy} onClick={() => void confirmImport()}>
                Resume import
              </button>
            </div>
          )}

          {/* Failed State */}
          {job?.status === 'failed' && (
            <div className="pi-final-summary is-warning" role="alert">
              <AlertCircle size={18} />
              <span>{job.errorMessage ?? 'The import failed before completing.'}</span>
              {job.validatedAt && job.processedRows < job.totalRows && (
                <button type="button" className="pi-button" disabled={isBusy} onClick={() => void confirmImport()}>
                  Retry import
                </button>
              )}
              <button type="button" className="pi-button" onClick={resetWizard}>
                Try another file
              </button>
            </div>
          )}

          {/* Cancelled State */}
          {job?.status === 'cancelled' && (
            <div style={{ display: 'grid', gap: '.4rem' }}>
              <p className="pi-muted">
                This import was cancelled. Temporary files were cleaned up immediately.
              </p>
              <button type="button" className="pi-button" onClick={resetWizard} style={{ justifySelf: 'start' }}>
                Start over
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="pi-error" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {jobQuery.error && selectedJobId && !isSessionExpired && (
        <div className="pi-error" role="alert">
          <AlertCircle size={15} />
          <span>{friendlyError(jobQuery.error)}</span>
        </div>
      )}

      {historyQuery.data?.jobs?.length ? (
        <details className="pi-history">
          <summary>Import history ({historyQuery.data.jobs.length})</summary>
          <ul>
            {historyQuery.data.jobs.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJobId(item.id)
                    setJobId(item.id)
                    setFile(null)
                    setInspection(null)
                    setLocalValidation(null)
                  }}
                >
                  <span>{item.fileName}</span>
                  <small>
                    {statusLabel[item.status] ?? item.status} · {item.totalRows} rows · {new Date(item.createdAt).toLocaleString()}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}

async function sha256Base64(file: File) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))
  let binary = ''
  digest.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function uploadCsvDirect(
  file: File,
  ticket: UploadTicket,
  onProgress: (percent: number, loaded: number, total: number) => void,
  uploadRef: MutableRefObject<XMLHttpRequest | null>,
  eventId: string,
): Promise<void> {
  const performUpload = (url: string, headers: Record<string, string>, withCredentials = false): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest()
      uploadRef.current = request
      request.open('PUT', url)
      if (withCredentials) {
        request.withCredentials = true
      }
      Object.entries(headers).forEach(([name, value]) => {
        if (name.toLowerCase() !== 'host') {
          try {
            request.setRequestHeader(name, value)
          } catch {
            /* ignore restricted headers */
          }
        }
      })
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100), event.loaded, event.total)
        }
      }
      request.onerror = () => reject(new Error('Network connection failed. Check your connection and retry.'))
      request.onabort = () => reject(new Error('Upload cancelled.'))
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve()
        } else if (request.status === 401) {
          reject(new ApiError('Your session has expired. Please log in again.', 401))
        } else if (request.status === 403) {
          reject(new ApiError('Upload authorization expired. Retry to renew it.', 403))
        } else if (request.status === 413) {
          reject(new ApiError('CSV file exceeds 20 MB size limit.', 413))
        } else {
          let serverMessage: string | undefined
          let code: string | undefined
          try {
            const body = JSON.parse(request.responseText)
            if (typeof body?.error?.message === 'string') serverMessage = body.error.message
            if (typeof body?.error?.code === 'string') code = body.error.code
          } catch {
            /* ignore non-JSON errors */
          }
          console.error('[Certify API] Upload request failed', {
            status: request.status,
            code,
            message: serverMessage,
          })
          reject(new ApiError(friendlyApiMessage(request.status, '/participants/import/upload', code, serverMessage), request.status, undefined, code))
        }
      }
      request.onloadend = () => {
        if (uploadRef.current === request) uploadRef.current = null
      }
      request.send(file)
    })
  }

  // First try the primary URL (direct storage / presigned URL).
  // If storage rejects with 403 (e.g. Neon Object Storage without client PUT CORS) or network error,
  // automatically fall back to the backend authorized route with cookies.
  return performUpload(ticket.url, ticket.headers, false).catch((primaryError: unknown) => {
    const isAuthOrStorageFailure =
      primaryError instanceof Error &&
      (
        (primaryError as ApiError).statusCode === 403 ||
        primaryError.message.includes('403') ||
        primaryError.message.includes('Network connection') ||
        primaryError.message.includes('Storage rejected')
      )

    const fallback = ticket.fallbackUrl || `/api/events/${eventId}/participants/import/${ticket.uploadId}/file`

    if (isAuthOrStorageFailure && fallback) {
      const fallbackHeaders: Record<string, string> = {
        'Content-Type': file.type || 'text/csv',
      }
      return performUpload(fallback, fallbackHeaders, true)
    }

    throw primaryError
  })
}
