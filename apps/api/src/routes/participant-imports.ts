import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { AppError } from '../errors/app-error.js'
import { successResponse } from '../lib/api-response.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { createAuthMiddleware, createCsrfMiddleware } from '../middleware/auth.js'
import type { AuthProvider, AuthUser } from '../services/auth/types.js'
import { ParticipantImportService, PARTICIPANT_IMPORT_MAX_BYTES } from '../services/participants/participant-import-service.js'
import type { ProfileService } from '../services/profiles/profile-service.js'
import { requireProfileType } from '../middleware/require-profile.js'

type Variables = { authUser: AuthUser; authSessionToken: string }
const uuidSchema = z.uuid()
const uploadSchema = z.object({ fileName: z.string().trim().min(1).max(255), contentType: z.string().trim().min(1).max(100), fileSizeBytes: z.number().int().min(1), checksumSha256: z.string().regex(/^[A-Za-z0-9+/]{43}=$/) }).strict()
const mappingSchema = z.object({ name: z.number().int().min(0).max(99), email: z.number().int().min(0).max(99), phone: z.number().int().min(0).max(99).optional(), organization: z.number().int().min(0).max(99).optional() }).strict()
const completeSchema = z.object({ mapping: mappingSchema, duplicatePolicy: z.enum(['skip', 'update']).default('skip') }).strict()
const manualParticipantSchema = z.object({ name: z.string().trim().min(1).max(200), email: z.string().trim().email().max(320), phone: z.string().trim().max(50).optional().nullable(), organization: z.string().trim().max(200).optional().nullable() }).strict()

async function parseBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  let body: unknown
  try { body = await c.req.json() } catch { throw new AppError(400, 'Request body must be valid JSON') }
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new AppError(400, 'Invalid request body', parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })))
  return parsed.data
}

function parseUuid(value: string | undefined, label: string) {
  const parsed = uuidSchema.safeParse(value)
  if (!parsed.success) throw new AppError(400, `${label} must be a valid UUID`)
  return parsed.data
}

function jobDto(job: Awaited<ReturnType<ParticipantImportService['getJob']>>) {
  return {
    id: job.id, eventId: job.eventId, status: job.status, fileName: job.sourceFileName, contentType: job.contentType,
    fileSizeBytes: job.fileSizeBytes, checksumSha256: job.checksumSha256, duplicatePolicy: job.duplicatePolicy, totalRows: job.totalRows, validRows: job.validRows,
    duplicateRows: job.duplicateRows, invalidRows: job.invalidRows, expectedNew: job.expectedNew, expectedUpdates: job.expectedUpdates,
    processedRows: job.processedRows, createdCount: job.createdCount, updatedCount: job.updatedCount, skippedCount: job.skippedCount,
    rowErrors: job.rowErrors.slice(0, 50), errorMessage: job.errorMessage, cancelRequested: job.cancelRequested,
    expiresAt: job.expiresAt.toISOString(), validatedAt: job.validatedAt?.toISOString() ?? null,
    startedAt: job.startedAt?.toISOString() ?? null, completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString(),
  }
}

export function createParticipantImportRoutes(auth: AuthProvider, imports: ParticipantImportService, webOrigin: string, profiles?: ProfileService) {
  const routes = new Hono<{ Variables: Variables }>()
  const requireAuth = createAuthMiddleware(auth)
  const requireOrganizer = requireProfileType(profiles, 'organizer')
  const requireCsrf = createCsrfMiddleware(webOrigin)
  routes.use('*', requireAuth, requireOrganizer)

  routes.post('/events/:eventId/participants/import/upload-url', requireCsrf, asyncHandler(async (c) => {
    const input = await parseBody(c, uploadSchema)
    return successResponse(c, await imports.createUpload(c.get('authUser').id, parseUuid(c.req.param('eventId'), 'Event ID'), input), 201)
  }))
  routes.post('/events/:eventId/participants/import/:uploadId/upload-url', requireCsrf, asyncHandler(async (c) => {
    return successResponse(c, await imports.renewUpload(c.get('authUser').id, parseUuid(c.req.param('eventId'), 'Event ID'), parseUuid(c.req.param('uploadId'), 'Upload ID')))
  }))

  const handleUploadFile = asyncHandler(async (c: Context) => {
    const eventId = parseUuid(c.req.param('eventId'), 'Event ID')
    const uploadId = parseUuid(c.req.param('uploadId'), 'Upload ID')
    const contentType = c.req.header('content-type') || 'text/csv'
    const contentLength = Number(c.req.header('content-length') || 0)
    if (contentLength > PARTICIPANT_IMPORT_MAX_BYTES) {
      throw new AppError(413, 'CSV files must be smaller than 20 MB.')
    }
    const body = await c.req.arrayBuffer()
    const bytes = new Uint8Array(body)
    const result = await imports.receiveUploadFile(c.get('authUser').id, eventId, uploadId, bytes, contentType)
    return successResponse(c, result)
  })

  routes.put('/events/:eventId/participants/import/:uploadId/file', requireCsrf, handleUploadFile)
  routes.post('/events/:eventId/participants/import/:uploadId/file', requireCsrf, handleUploadFile)

  routes.post('/events/:eventId/participants/import/:uploadId/complete', requireCsrf, asyncHandler(async (c) => {
    const input = await parseBody(c, completeSchema)
    return successResponse(c, await imports.completeUpload(c.get('authUser').id, parseUuid(c.req.param('eventId'), 'Event ID'), parseUuid(c.req.param('uploadId'), 'Upload ID'), input))
  }))
  routes.get('/events/:eventId/participants/import-jobs', asyncHandler(async (c) => {
    const jobs = await imports.listJobs(c.get('authUser').id, parseUuid(c.req.param('eventId'), 'Event ID'))
    return successResponse(c, { jobs: jobs.map((job) => jobDtoFromRecord(job)) })
  }))
  routes.get('/admin/import-jobs/:jobId', asyncHandler(async (c) => {
    return successResponse(c, { job: jobDto(await imports.getJob(c.get('authUser').id, parseUuid(c.req.param('jobId'), 'Import job ID'))) })
  }))
  routes.get('/admin/import-jobs/:jobId/errors.csv', asyncHandler(async (c) => {
    const report = await imports.errorReport(c.get('authUser').id, parseUuid(c.req.param('jobId'), 'Import job ID'))
    c.header('content-type', 'text/csv; charset=utf-8')
    c.header('content-disposition', `attachment; filename="${report.fileName}"`)
    c.header('cache-control', 'private, no-store')
    return c.body(report.csv)
  }))
  routes.post('/admin/import-jobs/:jobId/confirm', requireCsrf, asyncHandler(async (c) => {
    const job = await imports.confirm(c.get('authUser').id, parseUuid(c.req.param('jobId'), 'Import job ID'))
    return successResponse(c, { job: jobDto(job) }, job.status === 'queued' ? 202 : 200)
  }))
  routes.post('/admin/import-jobs/:jobId/cancel', requireCsrf, asyncHandler(async (c) => {
    const job = await imports.cancel(c.get('authUser').id, parseUuid(c.req.param('jobId'), 'Import job ID'))
    return successResponse(c, { job: jobDto(job) })
  }))
  routes.post('/events/:eventId/participants', requireCsrf, asyncHandler(async (c) => {
    const input = await parseBody(c, manualParticipantSchema)
    const participant = await imports.createManagedParticipant(c.get('authUser').id, parseUuid(c.req.param('eventId'), 'Event ID'), { name: input.name, email: input.email, phone: input.phone ?? null, organization: input.organization ?? null })
    return successResponse(c, { participant }, 201)
  }))
  return routes
}

function jobDtoFromRecord(job: { id: string; eventId: string; status: string; sourceFileName: string; contentType: string; fileSizeBytes: number; duplicatePolicy: string; totalRows: number; validRows: number; duplicateRows: number; invalidRows: number; expectedNew: number; expectedUpdates: number; processedRows: number; createdCount: number; updatedCount: number; skippedCount: number; rowErrors: Array<{ row: number; name: string; email: string; reason: string; existingParticipantId?: string }>; errorMessage: string | null; cancelRequested: boolean; expiresAt: Date; validatedAt: Date | null; startedAt: Date | null; completedAt: Date | null; createdAt: Date; updatedAt: Date }) {
  return { id: job.id, eventId: job.eventId, status: job.status, fileName: job.sourceFileName, contentType: job.contentType, fileSizeBytes: job.fileSizeBytes, duplicatePolicy: job.duplicatePolicy, totalRows: job.totalRows, validRows: job.validRows, duplicateRows: job.duplicateRows, invalidRows: job.invalidRows, expectedNew: job.expectedNew, expectedUpdates: job.expectedUpdates, processedRows: job.processedRows, createdCount: job.createdCount, updatedCount: job.updatedCount, skippedCount: job.skippedCount, rowErrors: [], errorMessage: job.errorMessage, cancelRequested: job.cancelRequested, expiresAt: job.expiresAt.toISOString(), validatedAt: job.validatedAt?.toISOString() ?? null, startedAt: job.startedAt?.toISOString() ?? null, completedAt: job.completedAt?.toISOString() ?? null, createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString() }
}
