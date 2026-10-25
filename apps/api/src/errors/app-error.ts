import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class AppError extends Error {
  readonly statusCode: ContentfulStatusCode
  readonly details?: unknown
  readonly code?: string

  constructor(statusCode: ContentfulStatusCode, message: string, details?: unknown, code?: string) {
    if (statusCode < 400 || statusCode > 599) {
      throw new RangeError('AppError statusCode must be an HTTP error status (400-599)')
    }

    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.details = details
    this.code = code
  }
}
