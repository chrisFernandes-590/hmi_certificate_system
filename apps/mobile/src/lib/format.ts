export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** Extract a 43-char verification token from a pasted token or a /verify/<token> URL. */
export function extractVerifyToken(input: string): string {
  const trimmed = input.trim()
  const match = /([A-Za-z0-9_-]{43})(?:[/?#].*)?$/.exec(trimmed)
  return match ? match[1] : trimmed
}
