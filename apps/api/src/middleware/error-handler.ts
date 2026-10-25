import type { ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { AppError } from '../errors/app-error.js'
import { errorResponse } from '../lib/api-response.js'

export const apiErrorHandler: ErrorHandler = (error, c) => {
  if (error instanceof AppError) {
    return errorResponse(c, error)
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message
    }))

    return errorResponse(c, new AppError(400, 'Validation failed', details))
  }

  if (error instanceof HTTPException && error.status >= 400 && error.status < 500) {
    return errorResponse(c, new AppError(error.status, error.message))
  }

  const schemaCause = getIncompleteSchemaCause(error)
  if (schemaCause) {
    // Log only PostgreSQL's safe code/message. The wrapping Drizzle error
    // includes bound parameters such as user IDs and hashed session tokens.
    console.error('[API] Required database migration is missing', schemaCause)
    return errorResponse(c, new AppError(
      503,
      'Account profile storage is not initialized. Apply the latest database migration and retry.',
      undefined,
      'DATABASE_MIGRATION_REQUIRED',
    ))
  }

  console.error('Unhandled API error', error)
  return errorResponse(c, new AppError(500, 'Internal server error'))
}

function getIncompleteSchemaCause(error: unknown): { postgresCode: string; databaseMessage: string } | undefined {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const record = current as { code?: unknown; cause?: unknown }
    if ((record.code === '42P01' || record.code === '42703') && typeof (current as { message?: unknown }).message === 'string') {
      return { postgresCode: record.code, databaseMessage: (current as { message: string }).message }
    }
    current = record.cause
  }
  return undefined
}

export const apiNotFoundHandler: NotFoundHandler = (c) => {
  return errorResponse(c, new AppError(404, 'Route not found'))
}
