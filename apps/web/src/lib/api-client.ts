import type { ApiResponse, PublicUser } from '@hmi/shared'

export type User = PublicUser
export type Profile = {
  id: string
  userId: string
  type: 'participant' | 'organizer'
  displayName: string
  avatarUrl: string | null
  institution: string | null
  roleLabel: 'student' | 'teacher' | 'other'
  bio: string | null
  status: 'active' | 'suspended' | 'deleted'
  approvalStatus: 'not_requested' | 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export class ApiError extends Error {
  readonly statusCode?: number
  readonly details?: unknown
  readonly code?: string

  constructor(message: string, statusCode?: number, details?: unknown, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.details = details
    this.code = code
  }
}

export function friendlyApiMessage(status: number, path: string, code?: string, serverMessage?: string) {
  if (code === 'PROFILE_MISMATCH') return 'Switch to the organizer profile to continue.'
  if (code === 'DATABASE_MIGRATION_REQUIRED') return 'Sign-in is temporarily unavailable. Please try again shortly.'
  if (path.startsWith('/auth/login') && status === 401) return 'We couldn’t sign you in. Check your email and password, then try again.'
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You don’t have permission to do that. Check your profile and try again.'
  if (status === 404) return 'We couldn’t find what you’re looking for. Refresh the page and try again.'
  if (status === 409) return safeServerMessage(serverMessage) ?? 'This may have changed already. Refresh the page and try again.'
  if (status === 400 || status === 422) return safeServerMessage(serverMessage) ?? 'Please check the information and try again.'
  if (status === 408 || status === 429) return 'Please wait a moment, then try again.'
  if (status >= 500) return 'We’re having trouble right now. Please try again in a little while.'
  return 'We couldn’t complete that request. Please try again.'
}

function safeServerMessage(message?: string) {
  if (!message || /(?:drizzle|query|sqlstate|\brelation\b|\bdatabase\b|\bconstraint\b|\bpostgres(?:ql)?\b|\bjson\b|request body|stack|failed to execute|internal server|\b(?:type|reference|syntax)error\b)/i.test(message)) return undefined
  return message
}

function endpointLabel(path: string) {
  return path.split('?')[0].replace(/\/[A-Za-z0-9_-]{32,}(?=\/|$)/g, '/:id')
}

async function parseResponse<T>(response: Response, path: string): Promise<T> {
  let raw: string
  try { raw = await response.text() }
  catch (error) {
    console.error('[Certify API] Could not read response', { endpoint: endpointLabel(path), status: response.status, error })
    throw new ApiError(friendlyApiMessage(response.status, path), response.status)
  }
  let envelope: ApiResponse<T> | undefined
  let parseError: unknown
  if (raw.trim()) {
    try { envelope = JSON.parse(raw) as ApiResponse<T> }
    catch (error) { parseError = error }
  }

  if (parseError || !raw.trim() || !envelope || typeof envelope !== 'object' || typeof envelope.success !== 'boolean') {
    console.error('[Certify API] Invalid response', {
      endpoint: endpointLabel(path), status: response.status,
      contentType: response.headers.get('content-type'), parseError,
    })
    throw new ApiError(friendlyApiMessage(response.status, path), response.status)
  }

  if (!response.ok || !envelope.success) {
    const failure = envelope.success ? undefined : envelope.error
    console.error('[Certify API] Request failed', {
      endpoint: endpointLabel(path), status: response.status,
      code: failure?.code, message: failure?.message,
    })
    throw new ApiError(
      friendlyApiMessage(response.status, path, failure?.code, failure?.message),
      response.status,
      undefined,
      failure?.code,
    )
  }
  return envelope.data
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch (error) {
    console.error('[Certify API] Network request failed', { endpoint: endpointLabel(path), error })
    throw new ApiError('We couldn’t connect. Check your internet connection and try again.')
  }
  return parseResponse<T>(response, path)
}

export function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(`/auth${path}`, options)
}

export async function apiDownload(path: string): Promise<Blob> {
  let response: Response
  try { response = await fetch(`/api${path}`, { credentials: 'include' }) }
  catch (error) {
    console.error('[Certify API] Download request failed', { endpoint: endpointLabel(path), error })
    throw new ApiError('We couldn’t connect to download this file. Check your connection and try again.')
  }
  if (!response.ok) {
    await parseResponse<never>(response, path)
  }
  return response.blob()
}
