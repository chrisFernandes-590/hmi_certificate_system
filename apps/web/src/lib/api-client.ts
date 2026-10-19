export type User = { id: string; name: string; email: string; emailVerifiedAt: string | null }
type Envelope<T> = { success: true; data: T } | { success: false; error: { statusCode: number; message: string; details?: unknown } }

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const envelope = await response.json() as Envelope<T>
  if (!response.ok || !envelope.success) {
    if (!envelope.success) throw new Error(envelope.error.message)
    throw new Error(`Request failed (${response.status})`)
  }
  return envelope.data
}
