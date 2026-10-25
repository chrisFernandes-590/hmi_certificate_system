import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { AppError } from '../../errors/app-error.js'
import type { Database } from '../../db/index.js'
import { auditLogs, eventMemberships, eventRegistrations, events, participantImportJobs, participants, users, type ParticipantImportJob } from '../../db/schema.js'
import type { ImportContact, ImportCounters, ImportChunkResult, NewImportJob, NewManagedParticipant, ParticipantImportRepository, ParticipantImportSource } from './participant-import-repository.js'

const activeStatuses = ['upload_pending', 'uploaded', 'validating', 'validated', 'queued', 'importing', 'partial'] as const
const emailExpression = sql<string>`lower(coalesce(${users.email}, ${participants.email}))`

export class DrizzleParticipantImportRepository implements ParticipantImportRepository {
  constructor(private readonly db: Database) {}

  async createUploadSession(input: NewImportJob) {
    return this.db.transaction(async (tx) => {
      await this.assertAdmin(tx, input.actorUserId, input.eventId)
      const [active] = await tx.select({ id: participantImportJobs.id }).from(participantImportJobs)
        .where(and(eq(participantImportJobs.eventId, input.eventId), inArray(participantImportJobs.status, [...activeStatuses]))).limit(1)
      if (active) throw new Error('An import is already in progress for this event')
      const [job] = await tx.insert(participantImportJobs).values({ ...input, status: 'upload_pending' }).returning()
      await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, action: 'PARTICIPANT_IMPORT_UPLOAD_SESSION_CREATED', entityType: 'participant_import', entityId: job.id, metadata: { eventId: input.eventId, fileSizeBytes: input.fileSizeBytes } })
      return job
    })
  }

  async refreshUploadUrl(actorId: string, eventId: string, jobId: string) {
    await this.assertAdmin(this.db, actorId, eventId)
    const [job] = await this.db.select().from(participantImportJobs)
      .where(and(eq(participantImportJobs.id, jobId), eq(participantImportJobs.eventId, eventId), eq(participantImportJobs.status, 'upload_pending'))).limit(1)
    return job ? toSource(job) : undefined
  }

  async completeUpload(actorId: string, eventId: string, jobId: string, mapping: ParticipantImportSource['mapping'] & {}, policy: ParticipantImportSource['duplicatePolicy']) {
    await this.db.transaction(async (tx) => {
      await this.assertAdmin(tx, actorId, eventId)
      const [job] = await tx.update(participantImportJobs).set({ status: 'uploaded', mapping, duplicatePolicy: policy, updatedAt: new Date() })
        .where(and(eq(participantImportJobs.id, jobId), eq(participantImportJobs.eventId, eventId), eq(participantImportJobs.status, 'upload_pending'))).returning({ id: participantImportJobs.id })
      if (!job) throw new Error('Import upload session is no longer awaiting completion')
      await tx.insert(auditLogs).values({ actorUserId: actorId, action: 'PARTICIPANT_IMPORT_UPLOADED', entityType: 'participant_import', entityId: jobId, metadata: { eventId } })
    })
  }

  async getJob(actorId: string, jobId: string) {
    const [job] = await this.db.select({ job: participantImportJobs }).from(participantImportJobs)
      .innerJoin(events, eq(events.id, participantImportJobs.eventId))
      .innerJoin(eventMemberships, and(eq(eventMemberships.eventId, events.id), eq(eventMemberships.userId, actorId), eq(eventMemberships.role, 'admin')))
      .where(and(eq(participantImportJobs.id, jobId), isNull(events.archivedAt))).limit(1)
    return job?.job
  }

  async listJobs(actorId: string, eventId: string, pageSize: number) {
    const rows = await this.db.select({ job: participantImportJobs }).from(participantImportJobs)
      .innerJoin(events, eq(events.id, participantImportJobs.eventId))
      .innerJoin(eventMemberships, and(eq(eventMemberships.eventId, events.id), eq(eventMemberships.userId, actorId), eq(eventMemberships.role, 'admin')))
      .where(and(eq(participantImportJobs.eventId, eventId), isNull(events.archivedAt)))
      .orderBy(desc(participantImportJobs.createdAt)).limit(pageSize)
    return rows.map((row) => row.job)
  }

  async claimValidation(jobId: string, now: Date) {
    const [job] = await this.db.update(participantImportJobs).set({ status: 'validating', lockExpiresAt: new Date(now.getTime() + 120_000), updatedAt: now })
      .where(and(eq(participantImportJobs.id, jobId), eq(participantImportJobs.cancelRequested, false), or(eq(participantImportJobs.status, 'uploaded'), and(eq(participantImportJobs.status, 'validating'), or(isNull(participantImportJobs.lockExpiresAt), lt(participantImportJobs.lockExpiresAt, now))))))
      .returning()
    return job ? toSource(job) : undefined
  }

  async findExistingEventParticipants(eventId: string, emails: string[]) {
    if (!emails.length) return []
    return this.db.select({ participantId: participants.id, email: emailExpression, name: sql<string>`coalesce(${users.name}, ${participants.name}, '')`, userId: participants.userId })
      .from(eventRegistrations).innerJoin(participants, eq(eventRegistrations.participantId, participants.id))
      .leftJoin(users, eq(participants.userId, users.id))
      .where(and(eq(eventRegistrations.eventId, eventId), inArray(emailExpression, emails)))
  }

  async saveValidationProgress(jobId: string, counters: ImportCounters, lockExpiresAt: Date) {
    await this.db.update(participantImportJobs).set({ ...counters, lockExpiresAt, updatedAt: new Date() })
      .where(and(eq(participantImportJobs.id, jobId), eq(participantImportJobs.status, 'validating')))
  }

  async finishValidation(jobId: string, counters: ImportCounters, now: Date) {
    await this.db.transaction(async (tx) => {
      const [job] = await tx.update(participantImportJobs).set({ ...counters, status: 'validated', validatedAt: now, lockExpiresAt: null, expiresAt: new Date(now.getTime() + 7 * 86_400_000), updatedAt: now })
        .where(and(eq(participantImportJobs.id, jobId), eq(participantImportJobs.status, 'validating'))).returning({ id: participantImportJobs.id, eventId: participantImportJobs.eventId })
      if (job) await tx.insert(auditLogs).values({ actorUserId: null, action: 'PARTICIPANT_IMPORT_VALIDATED', entityType: 'participant_import', entityId: jobId, metadata: { eventId: job.eventId, totalRows: counters.totalRows, validRows: counters.validRows, duplicateRows: counters.duplicateRows, invalidRows: counters.invalidRows } })
    })
  }

  async failJob(jobId: string, message: string, now: Date) {
    await this.db.transaction(async (tx) => {
      const [job] = await tx.update(participantImportJobs).set({ status: sql`CASE WHEN ${participantImportJobs.processedRows} > 0 THEN 'partial' ELSE 'failed' END`, errorMessage: message.slice(0, 500), lockExpiresAt: null, expiresAt: new Date(now.getTime() + 7 * 86_400_000), updatedAt: now, completedAt: now })
        .where(and(eq(participantImportJobs.id, jobId), inArray(participantImportJobs.status, ['uploaded', 'validating', 'queued', 'importing']))).returning({ id: participantImportJobs.id, eventId: participantImportJobs.eventId })
      if (job) await tx.insert(auditLogs).values({ actorUserId: null, action: 'PARTICIPANT_IMPORT_FAILED', entityType: 'participant_import', entityId: jobId, metadata: { eventId: job.eventId } })
    })
  }

  async isCancelRequested(jobId: string) {
    const [job] = await this.db.select({ cancelRequested: participantImportJobs.cancelRequested, status: participantImportJobs.status }).from(participantImportJobs).where(eq(participantImportJobs.id, jobId)).limit(1)
    return !job || job.cancelRequested || job.status === 'cancelled'
  }

  async confirm(actorId: string, jobId: string, now: Date) {
    return this.db.transaction(async (tx) => {
      const [job] = await tx.select().from(participantImportJobs).where(eq(participantImportJobs.id, jobId)).for('update').limit(1)
      if (!job) return undefined
      await this.assertAdmin(tx, actorId, job.eventId)
      if (job.status === 'validated' || ((job.status === 'partial' || job.status === 'failed') && job.validatedAt !== null && job.processedRows < job.totalRows)) {
        await this.assertRegistrationOpen(tx, job.eventId, now)
        if (job.expectedNew + job.expectedUpdates === 0) throw new Error('There are no eligible participant changes to import')
        const [queued] = await tx.update(participantImportJobs).set({ status: 'queued', cancelRequested: false, errorMessage: null, updatedAt: now }).where(and(eq(participantImportJobs.id, jobId), inArray(participantImportJobs.status, ['validated', 'partial', 'failed']))).returning()
        if (queued) await tx.insert(auditLogs).values({ actorUserId: actorId, action: 'PARTICIPANT_IMPORT_CONFIRMED', entityType: 'participant_import', entityId: jobId, metadata: { eventId: job.eventId, expectedNew: job.expectedNew, expectedUpdates: job.expectedUpdates } })
        return queued
      }
      if (['queued', 'importing', 'completed'].includes(job.status)) return job
      throw new Error('This import is not ready for confirmation')
    })
  }

  async claimImport(jobId: string, now: Date) {
    const [job] = await this.db.update(participantImportJobs).set({ status: 'importing', lockExpiresAt: new Date(now.getTime() + 120_000), startedAt: sql`coalesce(${participantImportJobs.startedAt}, ${now})`, updatedAt: now })
      .where(and(eq(participantImportJobs.id, jobId), eq(participantImportJobs.cancelRequested, false), or(eq(participantImportJobs.status, 'queued'), and(eq(participantImportJobs.status, 'importing'), or(isNull(participantImportJobs.lockExpiresAt), lt(participantImportJobs.lockExpiresAt, now))))))
      .returning()
    return job ? toSource(job) : undefined
  }

  async applyImportChunk(jobId: string, rows: ImportContact[], now: Date): Promise<ImportChunkResult> {
    return this.db.transaction(async (tx) => {
      const [job] = await tx.select().from(participantImportJobs).where(eq(participantImportJobs.id, jobId)).for('update').limit(1)
      if (!job || job.status !== 'importing' || job.cancelRequested) return { processed: 0, created: 0, updated: 0, skipped: 0 }
      await this.assertRegistrationOpen(tx, job.eventId, now)
      const validEmails = [...new Set(rows.filter((row) => !row.error).map((row) => row.email))]
      const currentRows = validEmails.length ? await tx.select({ participantId: participants.id, email: emailExpression, name: sql<string>`coalesce(${users.name}, ${participants.name}, '')`, userId: participants.userId })
        .from(eventRegistrations).innerJoin(participants, eq(eventRegistrations.participantId, participants.id)).leftJoin(users, eq(participants.userId, users.id))
        .where(and(eq(eventRegistrations.eventId, job.eventId), inArray(emailExpression, validEmails))) : []
      const currentByEmail = new Map(currentRows.map((row) => [row.email, row]))
      const guestRows = validEmails.length ? await tx.select({ id: participants.id, email: participants.email, name: participants.name, phone: participants.phone, organization: participants.organization, userId: participants.userId })
        .from(participants).where(and(inArray(participants.email, validEmails), isNull(participants.userId))) : []
      const guestByEmail = new Map(guestRows.flatMap((row) => row.email ? [[row.email, row] as const] : []))
      let created = 0
      let updated = 0
      let skipped = 0

      const toInsertGuests: Array<{ name: string; email: string; phone: string | null; organization: string | null }> = []
      const toUpdateGuests: Array<{ id: string; name: string; phone: string | null; organization: string | null }> = []
      const pendingRegistrations: Array<{ row: ImportContact; guest?: { id: string; name: string | null; userId: string | null } }> = []

      for (const row of rows) {
        if (row.error) { skipped++; continue }
        const current = currentByEmail.get(row.email)
        if (current) {
          if (job.duplicatePolicy !== 'update' || current.userId) { skipped++; continue }
          toUpdateGuests.push({ id: current.participantId, name: row.name, phone: row.phone, organization: row.organization })
          currentByEmail.set(row.email, { ...current, name: row.name })
          const guest = guestByEmail.get(row.email)
          if (guest) guestByEmail.set(row.email, { ...guest, name: row.name, phone: row.phone, organization: row.organization })
          updated++
          continue
        }

        const guest = guestByEmail.get(row.email)
        if (!guest) {
          toInsertGuests.push({ name: row.name, email: row.email, phone: row.phone, organization: row.organization })
          pendingRegistrations.push({ row })
        } else {
          if (job.duplicatePolicy === 'update' && !guest.userId && (guest.name !== row.name || guest.phone !== row.phone || guest.organization !== row.organization)) {
            toUpdateGuests.push({ id: guest.id, name: row.name, phone: row.phone, organization: row.organization })
            guestByEmail.set(row.email, { ...guest, name: row.name, phone: row.phone, organization: row.organization })
            updated++
          }
          pendingRegistrations.push({ row, guest })
        }
      }

      if (toInsertGuests.length > 0) {
        const uniqueToInsert = Array.from(new Map(toInsertGuests.map((item) => [item.email, item])).values())
        const inserted = await tx.insert(participants).values(uniqueToInsert).onConflictDoNothing().returning({
          id: participants.id, email: participants.email, name: participants.name, phone: participants.phone, organization: participants.organization, userId: participants.userId
        })
        for (const item of inserted) {
          if (item.email) guestByEmail.set(item.email, item)
        }
        const missingEmails = uniqueToInsert.map((i) => i.email).filter((e) => !guestByEmail.has(e))
        if (missingEmails.length > 0) {
          const found = await tx.select({
            id: participants.id, email: participants.email, name: participants.name, phone: participants.phone, organization: participants.organization, userId: participants.userId
          }).from(participants).where(and(inArray(participants.email, missingEmails), isNull(participants.userId)))
          for (const item of found) {
            if (item.email) guestByEmail.set(item.email, item)
          }
        }
      }

      for (const u of toUpdateGuests) {
        await tx.update(participants).set({ name: u.name, phone: u.phone, organization: u.organization, updatedAt: now }).where(eq(participants.id, u.id))
      }

      const toRegister: Array<{ eventId: string; participantId: string; status: 'registered'; registeredAt: Date; updatedAt: Date; email: string; name: string; userId: string | null }> = []
      const seenRegParticipantIds = new Set<string>()

      for (const item of pendingRegistrations) {
        const guest = item.guest ?? guestByEmail.get(item.row.email)
        if (!guest) { skipped++; continue }
        if (seenRegParticipantIds.has(guest.id)) { skipped++; continue }
        seenRegParticipantIds.add(guest.id)
        toRegister.push({
          eventId: job.eventId,
          participantId: guest.id,
          status: 'registered',
          registeredAt: now,
          updatedAt: now,
          email: item.row.email,
          name: guest.name ?? item.row.name,
          userId: guest.userId,
        })
      }

      if (toRegister.length > 0) {
        const regValues = toRegister.map(({ eventId, participantId, status, registeredAt, updatedAt }) => ({
          eventId, participantId, status, registeredAt, updatedAt
        }))
        const registered = await tx.insert(eventRegistrations).values(regValues).onConflictDoNothing().returning({ id: eventRegistrations.id, participantId: eventRegistrations.participantId })
        const registeredIds = new Set(registered.map((r) => r.participantId))
        for (const item of toRegister) {
          if (registeredIds.has(item.participantId)) {
            currentByEmail.set(item.email, { participantId: item.participantId, email: item.email, name: item.name, userId: item.userId })
            created++
          } else {
            skipped++
          }
        }
      }

      const processed = rows.length
      await tx.update(participantImportJobs).set({ processedRows: job.processedRows + processed, createdCount: job.createdCount + created, updatedCount: job.updatedCount + updated, skippedCount: job.skippedCount + skipped, lockExpiresAt: new Date(now.getTime() + 120_000), updatedAt: now })
        .where(and(eq(participantImportJobs.id, jobId), eq(participantImportJobs.status, 'importing')))
      return { processed, created, updated, skipped }
    })
  }

  async finishImport(jobId: string, now: Date) {
    await this.db.transaction(async (tx) => {
      const [job] = await tx.update(participantImportJobs).set({ status: 'completed', lockExpiresAt: null, expiresAt: new Date(now.getTime() + 7 * 86_400_000), completedAt: now, updatedAt: now })
        .where(and(eq(participantImportJobs.id, jobId), eq(participantImportJobs.status, 'importing'))).returning({ id: participantImportJobs.id, eventId: participantImportJobs.eventId, createdCount: participantImportJobs.createdCount, updatedCount: participantImportJobs.updatedCount, skippedCount: participantImportJobs.skippedCount })
      if (job) await tx.insert(auditLogs).values({ actorUserId: null, action: 'PARTICIPANT_IMPORT_COMPLETED', entityType: 'participant_import', entityId: jobId, metadata: { eventId: job.eventId, createdCount: job.createdCount, updatedCount: job.updatedCount, skippedCount: job.skippedCount } })
    })
  }

  async cancel(actorId: string, jobId: string, now: Date) {
    return this.db.transaction(async (tx) => {
      const [job] = await tx.select().from(participantImportJobs).where(eq(participantImportJobs.id, jobId)).for('update').limit(1)
      if (!job) return undefined
      await this.assertAdmin(tx, actorId, job.eventId)
      if (job.status === 'completed' || job.status === 'cancelled') return job
      const activeWorker = job.status === 'validating' || job.status === 'importing'
      const [updated] = await tx.update(participantImportJobs).set({ status: activeWorker ? job.status : 'cancelled', cancelRequested: true, lockExpiresAt: activeWorker ? job.lockExpiresAt : null, expiresAt: new Date(now.getTime() + 7 * 86_400_000), completedAt: activeWorker ? null : now, updatedAt: now })
        .where(eq(participantImportJobs.id, jobId)).returning()
      await tx.insert(auditLogs).values({ actorUserId: actorId, action: 'PARTICIPANT_IMPORT_CANCELLED', entityType: 'participant_import', entityId: jobId, metadata: { eventId: job.eventId, duringProcessing: activeWorker } })
      return updated
    })
  }

  async expiredObjects(now: Date, limit: number) {
    const rows = await this.db.select({ id: participantImportJobs.id, objectKey: participantImportJobs.objectKey, status: participantImportJobs.status }).from(participantImportJobs)
      .where(and(lt(participantImportJobs.expiresAt, now), eq(participantImportJobs.objectDeleted, false), inArray(participantImportJobs.status, ['upload_pending', 'uploaded', 'validating', 'validated', 'queued', 'completed', 'partial', 'failed', 'cancelled']), or(isNull(participantImportJobs.lockExpiresAt), lt(participantImportJobs.lockExpiresAt, now))))
      .limit(limit)
    return rows
  }

  async markObjectDeleted(jobId: string, now: Date) {
    await this.db.transaction(async (tx) => {
      const [job] = await tx.update(participantImportJobs).set({ status: sql`CASE WHEN ${participantImportJobs.status} IN ('upload_pending', 'uploaded', 'validating', 'validated', 'queued', 'partial', 'failed') THEN 'cancelled' ELSE ${participantImportJobs.status} END`, objectDeleted: true, cancelRequested: true, lockExpiresAt: null, completedAt: sql`coalesce(${participantImportJobs.completedAt}, ${now})`, updatedAt: now })
        .where(and(eq(participantImportJobs.id, jobId), eq(participantImportJobs.objectDeleted, false))).returning({ id: participantImportJobs.id, eventId: participantImportJobs.eventId })
      if (job) await tx.insert(auditLogs).values({ actorUserId: null, action: 'PARTICIPANT_IMPORT_OBJECT_EXPIRED', entityType: 'participant_import', entityId: job.id, metadata: { eventId: job.eventId } })
    })
  }

  async getRunnableJobs(now: Date, limit: number) {
    const rows = await this.db.select({ id: participantImportJobs.id }).from(participantImportJobs)
      .where(or(eq(participantImportJobs.status, 'uploaded'), eq(participantImportJobs.status, 'queued'), and(inArray(participantImportJobs.status, ['validating', 'importing']), or(isNull(participantImportJobs.lockExpiresAt), lt(participantImportJobs.lockExpiresAt, now)))))
      .limit(limit)
    return rows.map((row) => row.id)
  }

  async markCancelled(jobId: string, now: Date) {
    await this.db.transaction(async (tx) => {
      const [job] = await tx.update(participantImportJobs).set({ status: 'cancelled', lockExpiresAt: null, completedAt: now, expiresAt: new Date(now.getTime() + 7 * 86_400_000), updatedAt: now })
        .where(and(eq(participantImportJobs.id, jobId), eq(participantImportJobs.cancelRequested, true), inArray(participantImportJobs.status, ['validating', 'importing']))).returning({ id: participantImportJobs.id, eventId: participantImportJobs.eventId })
      if (job) await tx.insert(auditLogs).values({ actorUserId: null, action: 'PARTICIPANT_IMPORT_CANCELLED', entityType: 'participant_import', entityId: job.id, metadata: { eventId: job.eventId, duringProcessing: true } })
    })
  }

  async addManagedParticipant(actorId: string, eventId: string, input: NewManagedParticipant, now: Date) {
    return this.db.transaction(async (tx) => {
      await this.assertAdmin(tx, actorId, eventId)
      const [event] = await tx.select({ status: events.status, startDate: events.startDate }).from(events).where(and(eq(events.id, eventId), isNull(events.archivedAt))).limit(1)
      if (!event || event.status !== 'published' || event.startDate <= now) throw new AppError(422, 'Participants can only be added while registration is open.')
      const existing = await tx.select({ participantId: participants.id }).from(eventRegistrations).innerJoin(participants, eq(eventRegistrations.participantId, participants.id)).leftJoin(users, eq(participants.userId, users.id))
        .where(and(eq(eventRegistrations.eventId, eventId), eq(emailExpression, input.email))).limit(1)
      if (existing[0]) throw new AppError(409, 'A participant with this email is already registered.', { participantId: existing[0].participantId })
      let [participant] = await tx.select({ id: participants.id }).from(participants).where(and(eq(participants.email, input.email), isNull(participants.userId))).limit(1)
      if (!participant) [participant] = await tx.insert(participants).values(input).onConflictDoNothing().returning({ id: participants.id })
      if (!participant) [participant] = await tx.select({ id: participants.id }).from(participants).where(and(eq(participants.email, input.email), isNull(participants.userId))).limit(1)
      if (!participant) throw new Error('Could not create this participant because the email is already assigned to another profile.')
      const [registration] = await tx.insert(eventRegistrations).values({ eventId, participantId: participant.id, status: 'registered', registeredAt: now, updatedAt: now }).onConflictDoNothing().returning({ id: eventRegistrations.id, status: eventRegistrations.status })
      if (!registration) throw new AppError(409, 'A participant with this email is already registered for this event.')
      await tx.insert(auditLogs).values({ actorUserId: actorId, action: 'PARTICIPANT_CREATED_BY_ADMIN', entityType: 'participant', entityId: participant.id, metadata: { eventId } })
      return { participantId: participant.id, registrationId: registration.id, status: registration.status }
    })
  }

  private async assertAdmin(executor: Database | Parameters<Parameters<Database['transaction']>[0]>[0], actorId: string, eventId: string) {
    const [event] = await executor.select({ id: events.id }).from(events).innerJoin(eventMemberships, eq(eventMemberships.eventId, events.id))
      .where(and(eq(events.id, eventId), eq(eventMemberships.userId, actorId), eq(eventMemberships.role, 'admin'), isNull(events.archivedAt))).limit(1)
    if (!event) throw new Error('Event admin access is required')
  }

  private async assertRegistrationOpen(executor: Database | Parameters<Parameters<Database['transaction']>[0]>[0], eventId: string, now: Date) {
    const [event] = await executor.select({ status: events.status, startDate: events.startDate }).from(events)
      .where(and(eq(events.id, eventId), isNull(events.archivedAt))).limit(1)
    if (!event || event.status !== 'published' || event.startDate <= now) throw new AppError(422, 'Participants can only be imported while registration is open.')
  }
}

function toSource(job: ParticipantImportJob): ParticipantImportSource {
  return { id: job.id, eventId: job.eventId, actorUserId: job.actorUserId, bucket: job.bucket, objectKey: job.objectKey, sourceFileName: job.sourceFileName, contentType: job.contentType, fileSizeBytes: job.fileSizeBytes, checksumSha256: job.checksumSha256, mapping: job.mapping, duplicatePolicy: job.duplicatePolicy, status: job.status, processedRows: job.processedRows, totalRows: job.totalRows, cancelRequested: job.cancelRequested, objectDeleted: job.objectDeleted }
}
