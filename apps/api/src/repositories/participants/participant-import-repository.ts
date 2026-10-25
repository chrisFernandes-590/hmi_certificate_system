import type { ParticipantDuplicatePolicy, ParticipantImportJob, ParticipantImportMapping, ParticipantImportRowError } from '../../db/schema.js'

export type ParticipantImportSource = { id: string; eventId: string; actorUserId: string; bucket: string; objectKey: string; sourceFileName: string; contentType: string; fileSizeBytes: number; checksumSha256: string; mapping: ParticipantImportMapping | null; duplicatePolicy: ParticipantDuplicatePolicy; status: ParticipantImportJob['status']; processedRows: number; totalRows: number; cancelRequested: boolean; objectDeleted: boolean }
export type ImportCounters = { totalRows: number; validRows: number; duplicateRows: number; invalidRows: number; expectedNew: number; expectedUpdates: number; rowErrors: ParticipantImportRowError[] }
export type ImportContact = { row: number; name: string; email: string; phone: string | null; organization: string | null; error?: string }
export type ImportChunkResult = { processed: number; created: number; updated: number; skipped: number }
export type NewImportJob = { id: string; eventId: string; actorUserId: string; bucket: string; objectKey: string; sourceFileName: string; contentType: string; fileSizeBytes: number; checksumSha256: string; expiresAt: Date }
export type NewManagedParticipant = { name: string; email: string; phone: string | null; organization: string | null }

export interface ParticipantImportRepository {
  createUploadSession(input: NewImportJob): Promise<ParticipantImportJob>
  refreshUploadUrl(actorId: string, eventId: string, jobId: string): Promise<ParticipantImportSource | undefined>
  completeUpload(actorId: string, eventId: string, jobId: string, mapping: ParticipantImportMapping, policy: ParticipantDuplicatePolicy): Promise<void>
  getJob(actorId: string, jobId: string): Promise<ParticipantImportJob | undefined>
  listJobs(actorId: string, eventId: string, pageSize: number): Promise<ParticipantImportJob[]>
  claimValidation(jobId: string, now: Date): Promise<ParticipantImportSource | undefined>
  findExistingEventParticipants(eventId: string, emails: string[]): Promise<Array<{ participantId: string; email: string; name: string; userId: string | null }>>
  saveValidationProgress(jobId: string, counters: ImportCounters, lockExpiresAt: Date): Promise<void>
  finishValidation(jobId: string, counters: ImportCounters, now: Date): Promise<void>
  failJob(jobId: string, message: string, now: Date): Promise<void>
  isCancelRequested(jobId: string): Promise<boolean>
  confirm(actorId: string, jobId: string, now: Date): Promise<ParticipantImportJob | undefined>
  claimImport(jobId: string, now: Date): Promise<ParticipantImportSource | undefined>
  applyImportChunk(jobId: string, rows: ImportContact[], now: Date): Promise<ImportChunkResult>
  finishImport(jobId: string, now: Date): Promise<void>
  cancel(actorId: string, jobId: string, now: Date): Promise<ParticipantImportJob | undefined>
  expiredObjects(now: Date, limit: number): Promise<Array<{ id: string; objectKey: string; status: ParticipantImportJob['status'] }>>
  markObjectDeleted(jobId: string, now: Date): Promise<void>
  getRunnableJobs(now: Date, limit: number): Promise<string[]>
  markCancelled(jobId: string, now: Date): Promise<void>
  addManagedParticipant(actorId: string, eventId: string, input: NewManagedParticipant, now: Date): Promise<{ participantId: string; registrationId: string; status: string }>
}
