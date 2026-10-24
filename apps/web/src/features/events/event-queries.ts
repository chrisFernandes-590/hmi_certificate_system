import type { EventListData } from '@hmi/shared'
import { apiFetch } from '../../lib/api-client'

export async function fetchAccessibleEvents(): Promise<EventListData> {
  const pageSize = 100
  const firstPage = await apiFetch<EventListData & { total: number }>(`/events?page=1&pageSize=${pageSize}`)
  const pageCount = Math.ceil(firstPage.total / pageSize)
  if (pageCount <= 1) return firstPage
  const remainingPages = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) =>
    apiFetch<EventListData>(`/events?page=${index + 2}&pageSize=${pageSize}`),
  ))
  return { events: [...firstPage.events, ...remainingPages.flatMap((page) => page.events)] }
}
