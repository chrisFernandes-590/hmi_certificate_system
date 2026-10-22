/**
 * Typed API client for the HMI Certificate System backend.
 *
 * Base URL is configured via EXPO_PUBLIC_API_BASE_URL (the server origin).
 * The client always appends /api exactly once before the path.
 *
 * Authenticated requests use:
 *   X-Auth-Client: native
 *   Authorization: Bearer <accessToken>
 *
 * The CSRF middleware skips its check when X-Auth-Client === 'native',
 * so write operations work without an Origin header match.
 *
 * Responses follow:
 *   Success: { success: true, data: T }
 *   Failure: { success: false, error: { statusCode, message, details? } }
 */

import type { ApiResponse } from '@hmi/shared'

const API_ORIGIN = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:3000').replace(/\/+$/, '')
const API_BASE = `${API_ORIGIN}/api`

// Token getter is set by the auth context after initialisation.
let _getToken: (() => string | null) | null = null

export function setTokenGetter(getter: () => string | null) {
  _getToken = getter
}

// Called when an authenticated request is rejected with 401 (expired/revoked session).
let _onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: (() => void) | null) {
  _onUnauthorized = handler
}

const REQUEST_TIMEOUT_MS = 20_000

/** Build a query string, skipping undefined/empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = _getToken?.()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Auth-Client': 'native',
    ...extra,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function parseEnvelope<T>(response: Response, hadToken: boolean): Promise<T> {
  let envelope: ApiResponse<T> | null = null
  try {
    envelope = (await response.json()) as ApiResponse<T>
  } catch {
    envelope = null
  }
  if (!response.ok || !envelope || envelope.success !== true) {
    if (response.status === 401 && hadToken) _onUnauthorized?.()
    if (envelope && envelope.success === false) {
      throw new ApiError(envelope.error.statusCode ?? response.status, envelope.error.message, envelope.error.details)
    }
    throw new ApiError(response.status, `Unexpected server response (${response.status})`)
  }
  return envelope.data
}

async function request(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw new ApiError(
      0,
      aborted
        ? 'The server took too long to respond. Please try again.'
        : `Cannot reach the server at ${API_ORIGIN}. Check your connection and EXPO_PUBLIC_API_BASE_URL.`,
    )
  } finally {
    clearTimeout(timer)
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {},
): Promise<T> {
  const { headers: extraHeaders, ...rest } = options
  const hadToken = Boolean(_getToken?.())
  const response = await request(`${API_BASE}${path}`, { ...rest, headers: buildHeaders(extraHeaders) })
  return parseEnvelope<T>(response, hadToken)
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' })
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'DELETE',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

/**
 * Download the PDF bytes for a certificate.
 * Returns the response as a Uint8Array. The caller is responsible
 * for saving or sharing the file using expo-file-system / expo-sharing.
 * Never returns a storage URL — the stream is owner-authorized by the API.
 */
export async function apiDownloadPdf(
  certificateId: string,
  disposition: 'attachment' | 'inline' = 'attachment',
): Promise<{ bytes: Uint8Array; filename: string }> {
  const token = _getToken?.()
  const headers: Record<string, string> = { 'X-Auth-Client': 'native' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await request(
    `${API_BASE}/certificates/${encodeURIComponent(certificateId)}/pdf?disposition=${disposition}`,
    { headers },
  )

  if (!response.ok) {
    if (response.status === 401 && token) _onUnauthorized?.()
    let message = `PDF download failed (${response.status})`
    try {
      const envelope = (await response.json()) as ApiResponse<never>
      if (!envelope.success) message = envelope.error.message
    } catch {
      /* non-JSON error body — use HTTP status fallback */
    }
    throw new ApiError(response.status, message)
  }

  const contentDisposition = response.headers.get('content-disposition') ?? ''
  const filenameMatch = /filename="?([^";\n]+)"?/i.exec(contentDisposition)
  const filename = filenameMatch?.[1] ?? `certificate-${certificateId}.pdf`
  const buffer = await response.arrayBuffer()
  return { bytes: new Uint8Array(buffer), filename }
}
