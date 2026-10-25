import assert from 'node:assert/strict'
import { test } from 'node:test'
import { S3Client } from '@aws-sdk/client-s3'
import { createApp } from '../src/app.js'
import type { ParticipantImportRepository } from '../src/repositories/participants/participant-import-repository.js'
import { ParticipantImportService } from '../src/services/participants/participant-import-service.js'
import type { ParticipantImportStorage } from '../src/services/participants/participant-import-storage.js'
import { S3ParticipantImportStorage } from '../src/services/participants/participant-import-storage.js'
import type { AuthProvider, AuthSession, AuthUser } from '../src/services/auth/types.js'

const owner: AuthUser = { id: '11111111-1111-4111-8111-111111111111', name: 'Owner', email: 'owner@example.com', emailVerifiedAt: new Date() }
const other: AuthUser = { id: '22222222-2222-4222-8222-222222222222', name: 'Other', email: 'other@example.com', emailVerifiedAt: new Date() }
const eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const jobId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const checksum = `${'A'.repeat(43)}=`
const date = new Date('2026-10-24T00:00:00.000Z')

class MemoryImportRepository {
  job: Record<string, any> | undefined
  participantWrites = 0
  managedInput: Record<string, any> | undefined
  private validationClaimed = false
  private importClaimed = false

  async createUploadSession(input: Record<string, any>) {
    this.job = { ...input, id: input.id ?? jobId, status: 'upload_pending', mapping: null, duplicatePolicy: 'skip', totalRows: 0, validRows: 0, duplicateRows: 0, invalidRows: 0, expectedNew: 0, expectedUpdates: 0, processedRows: 0, createdCount: 0, updatedCount: 0, skippedCount: 0, rowErrors: [], errorMessage: null, cancelRequested: false, objectDeleted: false, lockExpiresAt: null, validatedAt: null, startedAt: null, completedAt: null, createdAt: date, updatedAt: date }
    return this.job
  }
  async refreshUploadUrl(actorId: string, event: string, id: string) { return actorId === owner.id && event === eventId && (id === jobId || id === this.job?.id) && this.job ? { ...this.job, status: this.job.status } : undefined }
  async completeUpload(actorId: string, event: string, id: string, mapping: any, policy: string) { if (actorId !== owner.id || event !== eventId || (id !== jobId && id !== this.job?.id) || !this.job) throw new Error('not found'); this.job.mapping = mapping; this.job.duplicatePolicy = policy; this.job.status = 'validating' }
  async getJob(actorId: string, id: string) { return actorId === owner.id && (id === jobId || id === this.job?.id) ? this.job : undefined }
  async listJobs() { return this.job ? [this.job] : [] }
  async claimValidation(id: string) { if (id !== jobId || !this.job || this.validationClaimed) return undefined; this.validationClaimed = true; return { ...this.job, status: 'validating' } }
  async findExistingEventParticipants() { return [] }
  async saveValidationProgress(_id: string, counts: Record<string, any>) { Object.assign(this.job, counts) }
  async finishValidation(_id: string, counts: Record<string, any>) { Object.assign(this.job, counts, { status: 'validated', validatedAt: date }) }
  async failJob(_id: string, message: string) { if (this.job) Object.assign(this.job, { status: 'failed', errorMessage: message }) }
  async isCancelRequested() { return false }
  async confirm(actorId: string, id: string) { if (actorId !== owner.id || id !== jobId || this.job?.status !== 'validated') throw new Error('not ready for confirmation'); this.job.status = 'queued'; return this.job }
  async claimImport(id: string) { if (id !== jobId || !this.job || this.importClaimed || this.job.status !== 'queued') return undefined; this.importClaimed = true; this.job.status = 'importing'; return { ...this.job } }
  async applyImportChunk(_id: string, rows: any[]) { this.participantWrites += rows.length; this.job.processedRows += rows.length; this.job.createdCount += rows.length; return { processed: rows.length, created: rows.length, updated: 0, skipped: 0 } }
  async finishImport() { Object.assign(this.job, { status: 'completed', completedAt: date }) }
  async cancel(actorId: string, id: string) { if (actorId !== owner.id || id !== jobId || !this.job) return undefined; this.job.cancelRequested = true; this.job.status = 'cancelled'; return this.job }
  async expiredObjects() { return [] }
  async markObjectDeleted() {}
  async getRunnableJobs() { return [] }
  async markCancelled() {}
  async addManagedParticipant(_actorId: string, _eventId: string, input: Record<string, any>) { this.managedInput = input; this.participantWrites++; return { participantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', registrationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', status: 'registered' } }
}

class MemoryImportStorage implements ParticipantImportStorage {
  readonly csv = new TextEncoder().encode('Name,Email\nAri Example,ari@example.com\n')
  deletedKeys: string[] = []
  uploadedBytes: Uint8Array | undefined
  currentUploadId?: string
  async createUploadUrl(input: { uploadId: string }) {
    this.currentUploadId = input.uploadId
    return { url: 'https://storage.invalid/presigned', headers: { 'content-type': 'text/csv' }, expiresAt: new Date(date.getTime() + 600_000) }
  }
  async head() { return { fileSizeBytes: this.csv.byteLength, contentType: 'text/csv', checksumSha256: checksum, uploadId: this.currentUploadId ?? jobId } }
  async *getStream() { yield this.csv }
  async put() {}
  async putBytes(_key: string, bytes: Uint8Array, _contentType?: string, metadata?: Record<string, string>) {
    this.uploadedBytes = bytes
    if (metadata?.['upload-id']) this.currentUploadId = metadata['upload-id']
  }
  async delete(key: string) { this.deletedKeys.push(key) }
}

const auth = {
  register: async () => {}, verifyEmail: async () => owner,
  authenticate: async (): Promise<AuthSession> => ({ user: owner, expiresAt: date, sessionToken: 'x'.repeat(43) }),
  getSession: async (token: string) => token === 'owner' ? owner : token === 'other' ? other : undefined,
  endSession: async () => {}, requestPasswordReset: async () => {}, completePasswordReset: async () => {},
} satisfies AuthProvider

const waitForStatus = async (repository: MemoryImportRepository, status: string) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (repository.job?.status === status) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  assert.equal(repository.job?.status, status, `expected job status ${status}`)
}

test('CSV upload is metadata-only, validation does not write participants, and explicit confirmation imports', async () => {
  const repository = new MemoryImportRepository()
  const storage = new MemoryImportStorage()
  const service = new ParticipantImportService(repository as unknown as ParticipantImportRepository, storage, 'private-import-bucket', () => date)
  const ticket = await service.createUpload(owner.id, eventId, { fileName: 'people.csv', contentType: 'text/csv', fileSizeBytes: storage.csv.byteLength, checksumSha256: checksum })
  assert.equal(ticket.url, 'https://storage.invalid/presigned')
  assert.equal(repository.participantWrites, 0)

  await service.completeUpload(owner.id, eventId, jobId, { mapping: { name: 0, email: 1 }, duplicatePolicy: 'skip' })
  await waitForStatus(repository, 'validated')
  assert.equal(repository.job?.expectedNew, 1)
  assert.equal(repository.participantWrites, 0)

  await service.confirm(owner.id, jobId)
  await waitForStatus(repository, 'completed')
  assert.equal(repository.participantWrites, 1)
})

test('import job status is hidden from users who do not own the event admin session', async () => {
  const repository = new MemoryImportRepository()
  const storage = new MemoryImportStorage()
  const service = new ParticipantImportService(repository as unknown as ParticipantImportRepository, storage, 'private-import-bucket', () => date)
  await service.createUpload(owner.id, eventId, { fileName: 'people.csv', contentType: 'text/csv', fileSizeBytes: storage.csv.byteLength, checksumSha256: checksum })
  const app = createApp(auth, { webOrigin: 'http://localhost:5173', sessionTtlSeconds: 3600, secureCookies: false }, undefined, undefined, undefined, service)
  const response = await app.request(`/api/admin/import-jobs/${jobId}`, { headers: { cookie: 'titlecert_session=other' } })
  assert.equal(response.status, 404)
})

test('import API rejects raw CSV bodies instead of receiving file bytes', async () => {
  const repository = new MemoryImportRepository()
  const service = new ParticipantImportService(repository as unknown as ParticipantImportRepository, new MemoryImportStorage(), 'private-import-bucket', () => date)
  const app = createApp(auth, { webOrigin: 'http://localhost:5173', sessionTtlSeconds: 3600, secureCookies: false }, undefined, undefined, undefined, service)
  const response = await app.request(`/api/events/${eventId}/participants/import/upload-url`, {
    method: 'POST',
    headers: { cookie: 'titlecert_session=owner', origin: 'http://localhost:5173', 'content-type': 'text/csv' },
    body: 'Name,Email\nAri Example,ari@example.com',
  })
  assert.equal(response.status, 400)
  assert.equal(repository.job, undefined)
})

test('cancelling a validated import before confirmation prevents participant writes', async () => {
  const repository = new MemoryImportRepository()
  const storage = new MemoryImportStorage()
  const service = new ParticipantImportService(repository as unknown as ParticipantImportRepository, storage, 'private-import-bucket', () => date)
  await service.createUpload(owner.id, eventId, { fileName: 'people.csv', contentType: 'text/csv', fileSizeBytes: storage.csv.byteLength, checksumSha256: checksum })
  await service.completeUpload(owner.id, eventId, jobId, { mapping: { name: 0, email: 1 }, duplicatePolicy: 'skip' })
  await waitForStatus(repository, 'validated')
  await service.cancel(owner.id, jobId)
  await assert.rejects(() => service.confirm(owner.id, jobId))
  assert.equal(repository.participantWrites, 0)
})

test('manual participant entry normalizes email independently from CSV import', async () => {
  const repository = new MemoryImportRepository()
  const service = new ParticipantImportService(repository as unknown as ParticipantImportRepository, new MemoryImportStorage(), 'private-import-bucket', () => date)
  const app = createApp(auth, { webOrigin: 'http://localhost:5173', sessionTtlSeconds: 3600, secureCookies: false }, undefined, undefined, undefined, service)
  const response = await app.request(`/api/events/${eventId}/participants`, {
    method: 'POST',
    headers: { cookie: 'titlecert_session=owner', origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Ari Example', email: '  ARI@EXAMPLE.COM  ', phone: ' 555 ', organization: ' HMI ' }),
  })
  assert.equal(response.status, 201)
  assert.deepEqual(repository.managedInput, { name: 'Ari Example', email: 'ari@example.com', phone: '555', organization: 'HMI' })
})

test('signed upload URL binds the checksum and upload metadata without exposing the host header', async () => {
  const client = new S3Client({ region: 'us-east-1', credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret-test-key' } })
  try {
    const storage = new S3ParticipantImportStorage(client, 'private-import-bucket')
    const signed = await storage.createUploadUrl({ key: `participant-imports/${eventId}/${jobId}/object.csv`, uploadId: jobId, contentType: 'text/csv', checksumSha256: checksum })
    const url = new URL(signed.url)
    assert.ok(url.searchParams.has('X-Amz-Signature'))
    assert.match(url.searchParams.get('X-Amz-SignedHeaders') ?? '', /x-amz-checksum-sha256/)
    assert.equal(signed.headers['x-amz-meta-upload-id'], jobId)
    assert.equal(signed.headers['x-amz-checksum-sha256'], checksum)
    assert.equal(signed.headers.host, undefined)
  } finally {
    client.destroy()
  }
})

test('direct file upload endpoint verifies checksum, writes to storage, and supports renewal', async () => {
  const repository = new MemoryImportRepository()
  const storage = new MemoryImportStorage()
  const service = new ParticipantImportService(repository as unknown as ParticipantImportRepository, storage, 'private-import-bucket', () => date)
  const app = createApp(auth, { webOrigin: 'http://localhost:5173', sessionTtlSeconds: 3600, secureCookies: false }, undefined, undefined, undefined, service)

  const crypto = await import('node:crypto')
  const csvChecksum = crypto.createHash('sha256').update(storage.csv).digest('base64')
  const ticket = await service.createUpload(owner.id, eventId, { fileName: 'people.csv', contentType: 'text/csv', fileSizeBytes: storage.csv.byteLength, checksumSha256: csvChecksum })
  assert.ok(ticket.uploadId)

  const uploadRes = await app.request(`/api/events/${eventId}/participants/import/${ticket.uploadId}/file`, {
    method: 'PUT',
    headers: { cookie: 'titlecert_session=owner', origin: 'http://localhost:5173', 'content-type': 'text/csv' },
    body: storage.csv,
  })
  assert.equal(uploadRes.status, 200)
  assert.ok(storage.uploadedBytes)
  assert.equal(storage.uploadedBytes.byteLength, storage.csv.byteLength)

  const renewRes = await app.request(`/api/events/${eventId}/participants/import/${ticket.uploadId}/upload-url`, {
    method: 'POST',
    headers: { cookie: 'titlecert_session=owner', origin: 'http://localhost:5173' },
  })
  assert.equal(renewRes.status, 200)
})

test('temporary CSV file is immediately deleted after successful import commit', async () => {
  const repository = new MemoryImportRepository()
  const storage = new MemoryImportStorage()
  const service = new ParticipantImportService(repository as unknown as ParticipantImportRepository, storage, 'private-import-bucket', () => date)

  await service.createUpload(owner.id, eventId, { fileName: 'people.csv', contentType: 'text/csv', fileSizeBytes: storage.csv.byteLength, checksumSha256: checksum })
  await service.completeUpload(owner.id, eventId, jobId, { mapping: { name: 0, email: 1 }, duplicatePolicy: 'skip' })
  await waitForStatus(repository, 'validated')
  assert.equal(storage.deletedKeys.length, 0)

  await service.confirm(owner.id, jobId)
  await waitForStatus(repository, 'completed')
  assert.equal(repository.participantWrites, 1)
  assert.equal(storage.deletedKeys.length, 1)
})

test('cancelling an import immediately deletes the temporary CSV file from storage', async () => {
  const repository = new MemoryImportRepository()
  const storage = new MemoryImportStorage()
  const service = new ParticipantImportService(repository as unknown as ParticipantImportRepository, storage, 'private-import-bucket', () => date)

  await service.createUpload(owner.id, eventId, { fileName: 'people.csv', contentType: 'text/csv', fileSizeBytes: storage.csv.byteLength, checksumSha256: checksum })
  await service.completeUpload(owner.id, eventId, jobId, { mapping: { name: 0, email: 1 }, duplicatePolicy: 'skip' })
  await waitForStatus(repository, 'validated')
  assert.equal(storage.deletedKeys.length, 0)

  await service.cancel(owner.id, jobId)
  assert.equal(storage.deletedKeys.length, 1)
})

test('completeUpload produces human-readable actionable error on size or checksum mismatch', async () => {
  const repository = new MemoryImportRepository()
  const storage = new MemoryImportStorage()
  const service = new ParticipantImportService(repository as unknown as ParticipantImportRepository, storage, 'private-import-bucket', () => date)

  await service.createUpload(owner.id, eventId, { fileName: 'people.csv', contentType: 'text/csv', fileSizeBytes: 99999, checksumSha256: checksum })
  
  // Size mismatch: storage.csv.byteLength != 99999
  await assert.rejects(
    () => service.completeUpload(owner.id, eventId, jobId, { mapping: { name: 0, email: 1 }, duplicatePolicy: 'skip' }),
    (err: any) => {
      assert.equal(err.statusCode, 422)
      assert.match(err.message, /Uploaded file size mismatch/)
      assert.match(err.message, /The network transfer may have been interrupted/)
      return true
    }
  )
})


