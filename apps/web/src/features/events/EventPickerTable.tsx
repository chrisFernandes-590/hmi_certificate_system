import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, CirclePlus, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { EventDto } from '@hmi/shared'
import { fetchAccessibleEvents } from './event-queries'
import { eventListStatusLabel, formatPickerDateRange, getEventListStatus, type EventListStatus } from './event-picker-utils'
import { BackButton } from '../navigation/BackButton'
import { Breadcrumbs, type BreadcrumbItem } from '../navigation/Breadcrumbs'
import './event-picker-table.css'

export type EventPickerColumn = {
  header: string
  render: (event: EventDto) => ReactNode
  className?: string
}

type EventPickerTableProps = {
  title: string
  subtitle: string
  breadcrumb: BreadcrumbItem[]
  backTo?: string
  introLine?: string
  primaryAction?: { label: string; href: string }
  getRowHref: (event: EventDto) => string
  extraColumns?: EventPickerColumn[]
  emptyState?: { title?: string; description?: string; primaryAction?: { label: string; href: string } }
  adminOnly?: boolean
  notice?: string
}

const PAGE_SIZE = 10
const STATUS_OPTIONS: Array<{ value: 'all' | EventListStatus; label: string }> = [
  { value: 'all', label: 'All events' },
  { value: 'draft', label: 'Drafts' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'live', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function EventPickerTable({
  title, subtitle, breadcrumb, backTo, introLine, primaryAction,
  getRowHref, extraColumns = [], emptyState, adminOnly = false, notice,
}: EventPickerTableProps) {
  const query = useQuery({ queryKey: ['events'], queryFn: fetchAccessibleEvents })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<'all' | EventListStatus>('all')
  const [page, setPage] = useState(1)
  const [focusIndex, setFocusIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<Array<HTMLAnchorElement | null>>([])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase()), 200)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    function keyboardShortcut(event: globalThis.KeyboardEvent) {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        setSearch('')
        setFilter('all')
        setPage(1)
      }
    }
    document.addEventListener('keydown', keyboardShortcut)
    return () => document.removeEventListener('keydown', keyboardShortcut)
  }, [])

  const events = query.data?.events ?? []
  const availableEvents = adminOnly ? events.filter((event) => event.accessRole === 'admin') : events
  const filtered = useMemo(() => availableEvents.filter((event) => {
    const status = getEventListStatus(event)
    const matchesSearch = !debouncedSearch || `${event.name} ${event.description ?? ''}`.toLocaleLowerCase().includes(debouncedSearch)
    return matchesSearch && (filter === 'all' || filter === status)
  }), [availableEvents, debouncedSearch, filter])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleEvents = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const hasQuery = Boolean(debouncedSearch || filter !== 'all')
  const emptyAction = emptyState?.primaryAction ?? primaryAction ?? { label: 'Create event', href: '/admin/events/new' }

  function clearSearch() {
    setSearch('')
    setDebouncedSearch('')
    setFilter('all')
    setPage(1)
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const next = Math.max(0, Math.min(visibleEvents.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
    setFocusIndex(next)
    rowRefs.current[next]?.focus()
  }

  function setPageAndFocus(nextPage: number) {
    setPage(nextPage)
    setFocusIndex(0)
  }

  const first = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const last = Math.min(currentPage * PAGE_SIZE, filtered.length)

  return <section className="aw-page event-picker-page">
    {breadcrumb.length > 0 && <div className="event-picker-route-navigation">{backTo && <BackButton to={backTo} />}<Breadcrumbs items={breadcrumb} /></div>}
    <header className="aw-page-heading event-picker-heading"><div><h1>{title}</h1><p>{subtitle}</p></div></header>
    <div className="aw-page-heading event-picker-intro"><p>{introLine ?? 'Keep event details and participant workflows in one place.'}</p>{primaryAction && <Link className="aw-button aw-button--primary" to={primaryAction.href}><CirclePlus size={16} /> {primaryAction.label}</Link>}</div>
    {notice && <p className="notice success" role="status">{notice}</p>}
    <section className="aw-panel event-picker-panel" aria-label={`${title} event list`}>
      <div className="aw-toolbar event-picker-toolbar">
        <label className="aw-search event-picker-search"><Search size={15} aria-hidden="true" /><span className="visually-hidden">Search events by name or description</span><input ref={inputRef} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search events…" />{search && <button type="button" aria-label="Clear search" onClick={clearSearch}><X size={14} /></button>}</label>
        <label className="aw-filter-label">Status <select value={filter} onChange={(event) => { setFilter(event.target.value as typeof filter); setPage(1) }}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      {query.error && query.data && <div className="event-picker-error" role="status"><span>Could not refresh events. {query.error instanceof Error ? query.error.message : 'Try again.'}</span><button className="aw-button" type="button" onClick={() => void query.refetch()}>Retry</button></div>}
      {query.isLoading ? <><div className="aw-table-scroll event-picker-table-scroll" role="status" aria-label="Loading events"><table className="aw-table aw-events-table event-picker-table"><thead><tr><th>Event</th><th>Dates</th><th className="event-picker-access">Access</th>{extraColumns.map((column) => <th className="event-picker-extra" key={column.header}>{column.header}</th>)}<th>Status</th><th><span className="visually-hidden">Open event</span></th></tr></thead><tbody>{Array.from({ length: 5 }, (_, row) => <tr className="event-picker-skeleton-row" key={row}>{Array.from({ length: extraColumns.length + 5 }, (_, column) => <td className={column === 2 ? 'event-picker-access' : column > 2 && column <= 2 + extraColumns.length ? 'event-picker-extra' : ''} key={column}><span className="event-picker-bone" /></td>)}</tr>)}</tbody></table></div><div className="aw-table-footer event-picker-footer" aria-hidden="true"><span className="event-picker-bone event-picker-footer-bone" /><div><span className="event-picker-bone event-picker-page-bone" /></div></div></>
        : query.error && !query.data ? <div className="event-picker-error" role="alert"><span>{query.error instanceof Error ? query.error.message : 'Events could not be loaded.'}</span><button className="aw-button" type="button" onClick={() => void query.refetch()}>Retry</button></div>
          : availableEvents.length === 0 ? <div className="aw-empty event-picker-empty"><span className="aw-empty-icon"><CalendarDays size={22} /></span><h3>{emptyState?.title ?? 'No events yet'}</h3><p>{emptyState?.description ?? 'Create an event to start managing registrations and certificates.'}</p>{emptyAction && <Link className="aw-button aw-button--primary" to={emptyAction.href}>{emptyAction.label}</Link>}</div>
            : <>
              <div className="aw-table-scroll event-picker-table-scroll"><table className="aw-table aw-events-table event-picker-table">
                <thead><tr><th scope="col">Event</th><th scope="col">Dates</th><th className="event-picker-access" scope="col">Access</th>{extraColumns.map((column) => <th className={`event-picker-extra ${column.className ?? ''}`} key={column.header} scope="col">{column.header}</th>)}<th scope="col">Status</th><th scope="col"><span className="visually-hidden">Open event</span></th></tr></thead>
                <tbody>
                  {visibleEvents.map((event, index) => {
                    const status = getEventListStatus(event)
                    const href = getRowHref(event)
                    return <tr key={event.id} className="event-picker-row">
                      <td><Link ref={(element) => { rowRefs.current[index] = element }} tabIndex={index === focusIndex ? 0 : -1} className="aw-event-name-link event-picker-row-link" to={href} aria-label={`Open ${event.name}`} onKeyDown={(keyEvent) => handleRowKeyDown(keyEvent, index)}><span className="aw-event-icon"><CalendarDays size={17} aria-hidden="true" /></span><span><strong>{event.name}</strong><small>{event.description || 'No description provided'}</small></span></Link></td>
                      <td className="event-picker-date">{formatPickerDateRange(event)}</td>
                      <td className="event-picker-access"><span className="aw-access-role">{event.accessRole ?? '—'}</span></td>
                      {extraColumns.map((column) => <td className={`event-picker-extra ${column.className ?? ''}`} key={column.header}>{column.render(event)}</td>)}
                      <td><span className={`aw-status-badge aw-status-${status === 'live' ? 'ongoing' : status}`}>{eventListStatusLabel(status)}</span></td>
                      <td><span className="aw-icon-link event-picker-chevron-link" aria-hidden="true"><ChevronRight size={17} /></span></td>
                    </tr>
                  })}
                  {!visibleEvents.length && <tr><td className="event-picker-no-results" colSpan={extraColumns.length + 5}>{hasQuery ? <>No events match “{search.trim() || STATUS_OPTIONS.find((option) => option.value === filter)?.label}”.</> : 'No events match your filters.'}<button className="event-picker-clear" type="button" onClick={clearSearch}>Clear search</button></td></tr>}
                </tbody>
              </table></div>
              <div className="aw-table-footer event-picker-footer"><span>Showing {first}-{last} of {filtered.length} matching events</span><div><button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPageAndFocus(currentPage - 1)}><ChevronLeft size={14} /></button><span className="aw-page-count">{currentPage} / {pageCount}</span><button type="button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => setPageAndFocus(currentPage + 1)}><ChevronRight size={14} /></button></div></div>
            </>}
    </section>
  </section>
}
