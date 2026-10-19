import type { ApiResponse, PublicUser } from '@hmi/shared'

export type User = PublicUser

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const envelope = await response.json() as ApiResponse<T>
  if (!response.ok || !envelope.success) {
    if (!envelope.success) throw new Error(envelope.error.message)
    throw new Error(`Request failed (${response.status})`)
  }
  return envelope.data
}

export function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(`/auth${path}`, options)
}
