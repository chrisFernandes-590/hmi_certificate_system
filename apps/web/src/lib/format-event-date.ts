/** Formats event timestamps in the viewer's locale and local time zone. */
export function formatEventDate(value: string, locale?: string, dateOnly = false): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Date unavailable'
  const options: Intl.DateTimeFormatOptions = dateOnly
    ? { dateStyle: 'medium' }
    : { dateStyle: 'medium', timeStyle: 'short' }
  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function isDateOnlyEvent(value: string): boolean {
  return /T00:00:00(?:\.000)?Z$/.test(value)
}
