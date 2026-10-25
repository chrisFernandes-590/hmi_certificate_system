import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronDown, ChevronRight, Clock3, Search, Users, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { EventDto } from '@hmi/shared'
import { fetchAccessibleEvents } from '../events/event-queries'
import { formatEventDate, isDateOnlyEvent } from '../../lib/format-event-date'
import './event-picker.css'

type SortOrder = 'date-desc' | 'date-asc' | 'name'
type DateGroup = 'Upcoming' | 'Past'
const PAGE_SIZE = 50
const now = () => Date.now()
const friendlyError = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'

function eventTime(event: EventDto) { return new Date(event.startDate).getTime() }
function dateGroup(event: EventDto, time: number): DateGroup {
  const end = event.endDate ? new Date(event.endDate).getTime() : eventTime(event)
  return end < time ? 'Past' : 'Upcoming'
}
function statusFor(event: EventDto, time: number) {
  if (event.status === 'cancelled') return { label: 'Cancelled', tone: 'cancelled' }
  if (event.status === 'draft') return { label: 'Draft', tone: 'past' }
  const start = eventTime(event)
  const end = event.endDate ? new Date(event.endDate).getTime() : start
  const today = new Date(start).toLocaleDateString() === new Date(time).toLocaleDateString()
  if (start <= time && (end >= time || (today && !event.endDate))) return { label: 'Today / Live', tone: 'live' }
  if (start < time) return { label: 'Past', tone: 'past' }
  return { label: 'Upcoming', tone: 'upcoming' }
}
function relativeDate(value: string, time: number) {
  const delta = new Date(value).getTime() - time
  const days = Math.round(Math.abs(delta) / 86_400_000)
  if (days > 7) return undefined
  if (days === 0) return delta >= 0 ? 'today' : 'today'
  return delta >= 0 ? `in ${days} ${days === 1 ? 'day' : 'days'}` : `${days} ${days === 1 ? 'day' : 'days'} ago`
}

function EventToolbar({
  search, onSearch, sort, onSort, filter, onFilter, inputRef,
}: {
  search: string; onSearch: (value: string) => void; sort: SortOrder; onSort: (value: SortOrder) => void
  filter: 'all' | 'upcoming' | 'past'; onFilter: (value: 'all' | 'upcoming' | 'past') => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const [openMenu, setOpenMenu] = useState<'sort' | 'filter' | null>(null)
  useEffect(() => {
    function close(event: PointerEvent) {
      if (!(event.target instanceof Element) || !event.target.closest('.ep-menu-wrap')) setOpenMenu(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  const sortLabel = sort === 'date-desc' ? 'Date ↓' : sort === 'date-asc' ? 'Date ↑' : 'Name A–Z'
  const filterLabel = filter === 'all' ? 'All' : filter === 'upcoming' ? 'Upcoming' : 'Past'
  return <div className="ep-toolbar">
    <label className="ep-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search events</span><input ref={inputRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search events…" /><kbd>/</kbd>{search && <button type="button" aria-label="Clear search" onClick={() => onSearch('')}><X size={14} /></button>}</label>
    <div className="ep-toolbar-actions">
      <div className="ep-menu-wrap"><button type="button" className="ep-menu-trigger" aria-haspopup="menu" aria-expanded={openMenu === 'sort'} onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}>Sort <span>{sortLabel}</span><ChevronDown size={13} /></button>
        {openMenu === 'sort' && <div className="ep-menu" role="menu" aria-label="Sort events">{([['date-desc', 'Date ↓'], ['date-asc', 'Date ↑'], ['name', 'Name A–Z']] as const).map(([value, label]) => <button role="menuitemradio" aria-checked={sort === value} key={value} onClick={() => { onSort(value); setOpenMenu(null) }}>{label}</button>)}</div>}
      </div>
      <div className="ep-menu-wrap"><button type="button" className="ep-menu-trigger" aria-haspopup="menu" aria-expanded={openMenu === 'filter'} onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}>Filter <span>{filterLabel}</span><ChevronDown size={13} /></button>
        {openMenu === 'filter' && <div className="ep-menu" role="menu" aria-label="Filter events">{([['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']] as const).map(([value, label]) => <button role="menuitemradio" aria-checked={filter === value} key={value} onClick={() => { onFilter(value); setOpenMenu(null) }}>{label}</button>)}</div>}
      </div>
    </div>
  </div>
}

function EventStatusTag({ event, time }: { event: EventDto; time: number }) {
  const status = statusFor(event, time)
  return <span className={`ep-status ep-status--${status.tone}`}>{status.label}</span>
}

function EventRow({ event, time, index, setRef, onKeyDown }: {
  event: EventDto; time: number; index: number; setRef: (index: number, element: HTMLAnchorElement | null) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLAnchorElement>, index: number) => void
}) {
  const date = formatEventDate(event.startDate, undefined, isDateOnlyEvent(event.startDate))
  const relative = relativeDate(event.startDate, time)
  const accessibleDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', ...(isDateOnlyEvent(event.startDate) ? {} : { timeStyle: 'short' }) }).format(new Date(event.startDate))
  const participantsText = event.participantCount == null ? 'participant count unavailable' : `${event.participantCount.toLocaleString()} participants`
  const status = statusFor(event, time)
  const ariaLabel = `${event.name}, ${accessibleDate}, ${participantsText}, ${status.label}`
  return <Link ref={(element) => setRef(index, element)} to={`/admin/participants/${event.id}`} className="ep-row" aria-label={ariaLabel} title={event.name} onKeyDown={(event) => onKeyDown(event, index)}>
    <span className="ep-name"><CalendarDays size={16} aria-hidden="true" /><span>{event.name}</span></span>
    <span className="ep-date" title={relative ? `${date} (${relative})` : date}><Clock3 size={14} aria-hidden="true" />{date}</span>
    <span className="ep-participants"><Users size={14} aria-hidden="true" /><span>{event.participantCount == null ? '–' : event.participantCount.toLocaleString()}</span>{event.pendingParticipantCount != null && event.pendingParticipantCount > 0 && <span className="ep-pending">{event.pendingParticipantCount} pending</span>}</span>
    <span className="ep-row-status"><EventStatusTag event={event} time={time} /><ChevronRight className="ep-row-chevron" size={16} aria-hidden="true" /></span>
  </Link>
}

function EventGroup({ title, items, count, time, offset, collapsed, onToggle, setRef, onKeyDown }: {
  title: DateGroup; items: EventDto[]; count: number; time: number; offset: number; collapsed: boolean; onToggle: () => void
  setRef: (index: number, element: HTMLAnchorElement | null) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLAnchorElement>, index: number) => void
}) {
  if (!items.length) return null
  return <section className="ep-group" aria-label={`${title} events`}>
    <button type="button" className="ep-group-heading" aria-expanded={!collapsed} onClick={onToggle}><ChevronRight className={collapsed ? '' : 'is-expanded'} size={14} aria-hidden="true" /><span>{title}</span><span className="ep-group-count">{count}</span></button>
    {!collapsed && <div role="list">{items.map((event, index) => <div role="listitem" key={event.id}><EventRow event={event} time={time} index={offset + index} setRef={setRef} onKeyDown={onKeyDown} /></div>)}</div>}
  </section>
}

export function EventPickerPage() {
  const query = useQuery({ queryKey: ['events'], queryFn: fetchAccessibleEvents })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState<SortOrder>('date-desc')
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all')
  const [collapsed, setCollapsed] = useState<Partial<Record<DateGroup, boolean>>>({})
  const [page, setPage] = useState(0)
  const [focusIndex, setFocusIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const time = now()

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase()), 200)
    return () => window.clearTimeout(timer)
  }, [search])
  useEffect(() => {
    function keyboardShortcut(event: KeyboardEvent) {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault(); inputRef.current?.focus()
      }
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        setSearch(''); inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', keyboardShortcut)
    return () => document.removeEventListener('keydown', keyboardShortcut)
  }, [])

  const manageable = query.data?.events.filter((event) => event.accessRole === 'admin') ?? []
  const filtered = useMemo(() => manageable.filter((event) => {
    if (debouncedSearch && !event.name.toLocaleLowerCase().includes(debouncedSearch)) return false
    const group = dateGroup(event, time)
    return filter === 'all' || filter === group.toLocaleLowerCase()
  }).sort((left, right) => sort === 'name'
    ? left.name.localeCompare(right.name)
    : sort === 'date-asc' ? eventTime(left) - eventTime(right) : eventTime(right) - eventTime(left)), [manageable, debouncedSearch, filter, sort, time])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const groups: DateGroup[] = filter === 'past' ? ['Past'] : filter === 'upcoming' ? ['Upcoming'] : ['Upcoming', 'Past']
  const indexedGroups = groups.map((group) => ({ group, items: paged.filter((event) => dateGroup(event, time) === group) }))
  let rowIndex = 0
  const offsets = indexedGroups.map(({ items }) => { const offset = rowIndex; rowIndex += items.length; return offset })

  function rowKeyDown(event: React.KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.max(0, Math.min(paged.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
      if (rowRefs.current[index]) rowRefs.current[index]!.tabIndex = -1
      if (rowRefs.current[next]) rowRefs.current[next]!.tabIndex = 0
      setFocusIndex(next)
      rowRefs.current[next]?.focus()
    }
  }
  function rowRef(index: number, element: HTMLAnchorElement | null) {
    rowRefs.current[index] = element
    if (element) element.tabIndex = index === focusIndex ? 0 : -1
  }

  return <section className="ep-page">
    <header className="ep-header"><span className="ep-hero" aria-hidden="true">👥</span><h2>Participants</h2><p>Choose an event to manage its participants, approvals and certificates.</p></header>
    {query.isLoading ? <div className="ep-list-area" role="status" aria-label="Loading events"><div className="ep-column-head"><span>Name</span><span>Date</span><span>Participants</span><span>Status</span></div>{Array.from({ length: 5 }, (_, index) => <div className="ep-skeleton-row" key={index} aria-hidden="true"><i /><i /><i /><i /></div>)}</div>
      : query.error ? <div className="ep-error" role="alert"><span>{friendlyError(query.error)}</span><button type="button" onClick={() => void query.refetch()}>Retry</button></div>
      : manageable.length === 0 ? <div className="ep-empty"><span aria-hidden="true">📅</span><strong>No events yet</strong><p>Create an event to start managing participants.</p><Link to="/admin/events/new" className="ep-primary">Create event</Link></div>
      : <>
        <EventToolbar search={search} onSearch={(value) => { setSearch(value); setPage(0) }} sort={sort} onSort={(value) => { setSort(value); setPage(0) }} filter={filter} onFilter={(value) => { setFilter(value); setPage(0) }} inputRef={inputRef} />
        <div className="ep-list-area">
          <div className="ep-column-head" aria-hidden="true"><span>Name</span><span>Date</span><span>Participants</span><span>Status</span></div>
          {!filtered.length ? <div className="ep-no-results"><span>{debouncedSearch ? <>No events match “{search.trim()}”</> : 'No events in this filter'}</span>{debouncedSearch && <button type="button" onClick={() => setSearch('')}>Clear search</button>}</div>
            : <>{indexedGroups.map(({ group, items }, index) => <EventGroup key={group} title={group} items={items} count={filtered.filter((event) => dateGroup(event, time) === group).length} time={time} offset={offsets[index]} collapsed={Boolean(collapsed[group])} onToggle={() => setCollapsed((value) => ({ ...value, [group]: !value[group] }))} setRef={rowRef} onKeyDown={rowKeyDown} />)}</>}
        </div>
        {filtered.length > PAGE_SIZE && <nav className="ep-pagination" aria-label="Event pages"><span>{(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}</span><button disabled={page === 0} onClick={() => { setPage((value) => value - 1); setFocusIndex(0) }}>Previous</button><button disabled={page + 1 >= pages} onClick={() => { setPage((value) => value + 1); setFocusIndex(0) }}>Next</button></nav>}
      </>}
  </section>
}
