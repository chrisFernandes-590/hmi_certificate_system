import type { EventDto } from '@hmi/shared'

export type EventListStatus = 'draft' | 'upcoming' | 'live' | 'completed' | 'cancelled'

export function getEventListStatus(event: EventDto, now = Date.now()): EventListStatus {
  if (event.status === 'draft') return 'draft'
  if (event.status === 'cancelled') return 'cancelled'
  if (event.status === 'completed') return 'completed'
  const start = new Date(event.startDate).getTime()
  const end = event.endDate ? new Date(event.endDate).getTime() : endOfLocalDay(start)
  if (start > now) return 'upcoming'
  return now <= end ? 'live' : 'completed'
}

function endOfLocalDay(time: number) {
  const date = new Date(time)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

export function eventListStatusLabel(status: EventListStatus) {
  return status === 'draft' ? 'Draft' : status === 'live' ? 'Live' : status[0].toUpperCase() + status.slice(1)
}

export function formatPickerDateRange(event: Pick<EventDto, 'startDate' | 'endDate'>, locale = 'en-GB') {
  const formatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const start = new Date(event.startDate)
  if (!Number.isFinite(start.getTime())) return 'Date unavailable'
  const startLabel = formatter.format(start)
  if (!event.endDate) return startLabel
  const end = new Date(event.endDate)
  if (!Number.isFinite(end.getTime())) return startLabel
  const endLabel = formatter.format(end)
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`
}
