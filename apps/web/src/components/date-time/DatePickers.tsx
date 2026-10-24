import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { dateKey, formatDate, fromKey, monthLabel, monthStart, parseDate, parseTime } from './date-picker-utils.js'
import './date-pickers.css'

type CommonProps = { id?: string; name?: string; value?: string | null; defaultValue?: string | null; onChange?: (value: string | null) => void; placeholder?: string; disabled?: boolean; min?: string; max?: string; weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6; locale?: string; label?: string }
type RangeValue = { start: string | null; end: string | null; includeTime?: boolean; timeZone?: string }
type RangeProps = Omit<CommonProps, 'value' | 'defaultValue' | 'onChange'> & { value?: RangeValue; defaultValue?: RangeValue; onChange?: (value: RangeValue) => void; includeTime?: boolean }
const pad = (value: number) => String(value).padStart(2, '0')

function useValue(props: CommonProps) {
  const controlled = props.value !== undefined
  const [inner, setInner] = useState(props.defaultValue ?? null)
  const value = controlled ? props.value ?? null : inner
  const set = (next: string | null) => { if (!controlled) setInner(next); props.onChange?.(next) }
  return [value, set] as const
}

export function DatePicker(props: CommonProps) { return <Picker {...props} mode="date" /> }
export function DateTimePicker(props: CommonProps) { return <Picker {...props} mode="datetime" /> }
export function DateRangePicker(props: RangeProps) {
  const controlled = props.value !== undefined
  const [inner, setInner] = useState<RangeValue>(props.defaultValue ?? { start: null, end: null, includeTime: props.includeTime ?? false, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  const value = controlled ? props.value! : inner
  const update = (next: RangeValue) => { if (!controlled) setInner(next); props.onChange?.(next) }
  const [open, setOpen] = useState(false), [selectingEnd, setSelectingEnd] = useState(false), [hourCycle, setHourCycle] = useState<12 | 24>(12)
  const chosen = (date: string | null) => { if (!date) { update({ ...value, start: null, end: null }); setSelectingEnd(false); return }; const withTime = (old: string | null) => value.includeTime ? `${date}T${old?.slice(11, 16) || '09:00'}` : date; if (!selectingEnd || !value.start) { update({ ...value, start: withTime(value.start), end: null }); setSelectingEnd(true) } else { const selected = withTime(value.end), [start, end] = selected < value.start ? [selected, value.start] : [value.start, selected]; update({ ...value, start, end }); setSelectingEnd(false) } }
  const label = value.start ? `${formatDate(value.start, props.locale, Boolean(value.includeTime))}${value.end ? ` – ${formatDate(value.end, props.locale, Boolean(value.includeTime))}` : ''}` : ''
  const invalidRange = Boolean(value.start && value.end && value.end < value.start)
  const generatedId = useId(), id = props.id ?? generatedId
  return <div className="date-picker-wrap"><button id={id} className="date-trigger" type="button" disabled={props.disabled} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}><CalendarDays size={15}/><span>{label || props.placeholder || 'Select date range'}</span></button>{props.name && <input type="hidden" name={props.name} value={JSON.stringify(value)} />}{open && <CalendarPanel anchorId={id} value={value.start} min={props.min} max={props.max} locale={props.locale} weekStartsOn={props.weekStartsOn} onSelect={chosen} onClose={() => setOpen(false)} range={value} afterCalendar={<><label className="date-toggle"><input type="checkbox" checked={Boolean(value.end)} onChange={(e) => { if (!e.target.checked) update({ ...value, end: null }); else setSelectingEnd(true) }}/> End date</label><label className="date-toggle"><input type="checkbox" checked={Boolean(value.includeTime)} onChange={(e) => { const includeTime = e.target.checked; update({ ...value, includeTime, start: includeTime && value.start && !value.start.includes('T') ? `${value.start}T09:00` : value.start, end: includeTime && value.end && !value.end.includes('T') ? `${value.end}T09:00` : value.end }) }}/> Include time</label></>} timeSection={value.includeTime && value.start ? <div className="date-time-section"><div className="date-range-time"><span>Start</span><TimeField value={value.start?.slice(11,16) || '09:00'} hourCycle={hourCycle} onChange={(v) => update({ ...value, start: `${value.start?.slice(0,10)}T${v}` })}/><TimeChips value={value.start?.slice(11,16) || '09:00'} hourCycle={hourCycle} onChange={(v) => update({ ...value, start: `${value.start?.slice(0,10)}T${v}` })}/></div>{value.end && <div className="date-range-time"><span>End</span><TimeField value={value.end.slice(11,16) || '09:00'} hourCycle={hourCycle} onChange={(v) => update({ ...value, end: `${value.end?.slice(0,10)}T${v}` })} onBlur={() => { if (value.start && value.end?.slice(0,10) === value.start.slice(0,10) && value.end.slice(11,16) < value.start.slice(11,16)) update({ ...value, end: `${value.end.slice(0,10)}T${value.start.slice(11,16)}` }) }}/><TimeChips value={value.end.slice(11,16) || '09:00'} hourCycle={hourCycle} onChange={(v) => update({ ...value, end: `${value.end?.slice(0,10)}T${v}` })}/></div>}{invalidRange && <span className="date-error" role="alert">The end date and time must not precede the start.</span>}</div> : null} footer={<PickerFooter hourCycle={hourCycle} setHourCycle={setHourCycle} onClear={() => chosen(null)} clearDisabled={!value.start}/>} />}</div>
}

function Picker(props: CommonProps & { mode: 'date' | 'datetime' }) {
  const [value, setValue] = useValue(props), [open, setOpen] = useState(false), [typed, setTyped] = useState(''), [error, setError] = useState('')
  const [hourCycle, setHourCycle] = useState<12 | 24>(12)
  const generatedId = useId(), id = props.id ?? generatedId, time = props.mode === 'datetime'
  const date = value ? value.slice(0, 10) : null
  const display = formatDate(value, props.locale, time)
  const applyTyped = () => { if (!typed.trim()) return; const parsed = parseDate(typed, props.locale); if (!parsed) { setError('Enter a valid date, such as 24/10/2026 or tomorrow.'); return }; setValue(time ? `${parsed}T${(value?.slice(11, 16) || '09:00')}` : parsed); setError(''); setTyped('') }
  const select = (next: string | null) => { setValue(next ? time ? `${next}T${value?.slice(11, 16) || '09:00'}` : next : null); if (!time) setOpen(false) }
  const setTime = (raw: string) => { const parsed = parseTime(raw); if (parsed && date) { setValue(`${date}T${parsed}`); setError('') } else if (parsed) setError('Choose a date before setting a time.'); else if (raw) setError('Enter a time such as 3:30 PM or 15:30.') }
  const dateTime = value?.slice(0, 16) ?? ''
  return <div className="date-picker-wrap"><button id={id} className="date-trigger" type="button" disabled={props.disabled} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(!open); setError('') }}><CalendarDays size={15}/><span>{display || props.placeholder || 'Select date'}</span></button>{props.name && <input type="hidden" name={props.name} value={dateTime}/ >}{open && <CalendarPanel anchorId={id} value={date} min={props.min} max={props.max} locale={props.locale} weekStartsOn={props.weekStartsOn} onSelect={select} onClose={() => setOpen(false)} beforeCalendar={<div className="date-typed"><input aria-label="Type a date" placeholder="Type a date…" value={typed} onChange={(e) => { setTyped(e.target.value); setError('') }} onBlur={() => { if (typed) applyTyped() }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); applyTyped() } }} /></div>} timeSection={time ? <div className="date-time-section"><TimeField value={value?.slice(11,16) ?? '09:00'} hourCycle={hourCycle} onChange={setTime}/><TimeChips value={value?.slice(11,16) ?? '09:00'} hourCycle={hourCycle} onChange={setTime}/>{error && <span className="date-error" role="alert">{error}</span>}</div> : error ? <span className="date-error" role="alert">{error}</span> : null} footer={<PickerFooter hourCycle={hourCycle} setHourCycle={setHourCycle} showFormat={time} onClear={() => { setValue(null); setOpen(false) }} clearDisabled={!value}/>}/>}</div>
}

function TimeField({ value, hourCycle, onChange, onBlur }: { value: string; hourCycle: 12 | 24; onChange: (v: string) => void; onBlur?: () => void }) {
  const hour = Number(value.slice(0, 2)) || 0, minute = Number(value.slice(3, 5)) || 0, isPm = hour >= 12
  const shownHour = hourCycle === 12 ? String(hour % 12 || 12).padStart(2, '0') : String(hour).padStart(2, '0')
  const refs = useRef<Array<HTMLSpanElement | null>>([]), buffer = useRef({ segment: -1, digits: '' })
  const periodSuffix = useRef(false)
  const [cleared, setCleared] = useState<Record<number, boolean>>({}), [invalidText, setInvalidText] = useState('')
  const segments = hourCycle === 12 ? ['hour', 'minute', 'period'] : ['hour', 'minute']
  const writeHour = (next: number) => { const normalized = hourCycle === 12 ? ((next - 1 + 12) % 12) + 1 : (next + 24) % 24; const actual = hourCycle === 12 ? normalized % 12 + (isPm ? 12 : 0) : normalized; onChange(`${pad(actual)}:${pad(minute)}`) }
  const writeMinute = (next: number) => { const normalized = (next + 60) % 60; onChange(`${pad(hour)}:${pad(normalized)}`) }
  const focusSegment = (index: number) => refs.current[(index + segments.length) % segments.length]?.focus()
  const applyPaste = (text: string) => { const parsed = parseTime(text); if (parsed) { onChange(parsed); setInvalidText(''); setCleared({}) } else setInvalidText(text) }
  const onSegmentKey = (event: React.KeyboardEvent<HTMLSpanElement>, index: number) => {
    const segment = segments[index]
    if (/^\d$/.test(event.key) && segment !== 'period') {
      event.preventDefault(); periodSuffix.current = false; setInvalidText(''); setCleared((current) => ({ ...current, [index]: false })); const digits = `${buffer.current.segment === index ? buffer.current.digits : ''}${event.key}`.slice(-2); buffer.current = { segment: index, digits }
      if (segment === 'hour') { const number = Number(digits); if ((digits.length === 2) || (hourCycle === 12 ? number > 1 : number > 2)) { writeHour(number); buffer.current = { segment: -1, digits: '' }; focusSegment(index + 1) } else if (digits.length === 1 && number !== 0) writeHour(number) }
      else { const number = Number(digits); if (digits.length === 2 || number >= 6) { writeMinute(number); buffer.current = { segment: -1, digits: '' }; if (hourCycle === 12) focusSegment(index + 1) } else writeMinute(number) }
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); focusSegment(index + (event.key === 'ArrowRight' ? 1 : -1)); return }
    if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); buffer.current = { segment: -1, digits: '' }; setCleared((current) => ({ ...current, [index]: true })); return }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setCleared((current) => ({ ...current, [index]: false })); const direction = event.key === 'ArrowUp' ? 1 : -1; if (segment === 'hour') writeHour(hour + direction); else if (segment === 'minute') writeMinute(minute + direction * (event.altKey ? 15 : event.shiftKey ? 1 : 5)); else onChange(`${pad((hour + 12) % 24)}:${pad(minute)}`); return }
    if ((event.key.toLowerCase() === 'a' || event.key.toLowerCase() === 'p') && hourCycle === 12) { event.preventDefault(); periodSuffix.current = true; setInvalidText(''); setCleared((current) => ({ ...current, 2: false })); onChange(`${pad(hour % 12 + (event.key.toLowerCase() === 'p' ? 12 : 0))}:${pad(minute)}`); focusSegment(2); return }
    if (event.key.toLowerCase() === 'm' && hourCycle === 12 && periodSuffix.current) { event.preventDefault(); periodSuffix.current = false; return }
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); applyPaste('noon'); return }
    if (event.key.toLowerCase() === 'm') { event.preventDefault(); applyPaste('midnight'); return }
    if (event.key === 'Enter') { event.preventDefault(); const pending = buffer.current; if (pending.segment === index && pending.digits) { if (segment === 'hour') writeHour(Number(pending.digits)); else if (segment === 'minute') writeMinute(Number(pending.digits)); buffer.current = { segment: -1, digits: '' } }; return }
    if (event.key.length === 1 && event.key !== ':') setInvalidText(event.key)
    if (event.key === 'Tab') buffer.current = { segment: -1, digits: '' }
  }
  const labels = [cleared[0] ? '--' : shownHour, cleared[1] ? '--' : pad(minute), ...(hourCycle === 12 ? [cleared[2] ? '--' : isPm ? 'PM' : 'AM'] : [])]
  const values = [hourCycle === 12 ? hour % 12 || 12 : hour, minute, ...(hourCycle === 12 ? [isPm ? 1 : 0] : [])]
  const minimums = [hourCycle === 12 ? 1 : 0, 0, ...(hourCycle === 12 ? [0] : [])], maximums = [hourCycle === 12 ? 12 : 23, 59, ...(hourCycle === 12 ? [1] : [])]
  return <div className={`date-time-control${invalidText ? ' has-error' : ''}`}><div className="date-time-field" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) { const pending = buffer.current; if (pending.segment >= 0 && pending.digits) { if (segments[pending.segment] === 'hour') writeHour(Number(pending.digits)); else if (segments[pending.segment] === 'minute') writeMinute(Number(pending.digits)); buffer.current = { segment: -1, digits: '' } }; onBlur?.() } }}><Clock3 size={15} aria-hidden="true"/><div className="date-time-segments" role="group" aria-label="Time" aria-invalid={Boolean(invalidText)} onPaste={(event) => { event.preventDefault(); applyPaste(event.clipboardData.getData('text')) }} aria-live="polite">{segments.map((segment, index) => <span key={segment}><span ref={(node) => { refs.current[index] = node }} role="spinbutton" aria-label={segment === 'period' ? 'Period' : segment[0].toUpperCase() + segment.slice(1)} aria-valuenow={cleared[index] ? undefined : values[index]} aria-valuemin={minimums[index]} aria-valuemax={maximums[index]} aria-valuetext={cleared[index] ? 'Empty' : segment === 'hour' ? `${values[index]} o'clock` : segment === 'minute' ? `${values[index]} minutes` : labels[index]} tabIndex={0} className="date-time-segment" onFocus={() => { buffer.current = { segment: index, digits: '' } }} onKeyDown={(event) => onSegmentKey(event, index)}>{labels[index]}</span>{index < segments.length - 1 && <span className="date-time-separator" aria-hidden="true">{index === 0 ? ':' : ''}</span>}</span>)}</div></div>{invalidText && <small className="date-time-hint" role="alert">“{invalidText}” isn’t a valid time. Try 3:30 PM</small>}</div>
}

function TimeChips({ value, hourCycle, onChange }: { value: string; hourCycle: 12 | 24; onChange: (v: string) => void }) {
  const choices = ['09:00', '12:00', '15:00', '18:00']
  return <div className="date-time-chips" aria-label="Quick times">{choices.map((choice) => <button type="button" key={choice} aria-pressed={value === choice} className={value === choice ? 'is-selected' : ''} onClick={() => onChange(choice)}>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: hourCycle === 12 }).format(new Date(`2000-01-01T${choice}`))}</button>)}</div>
}

function PickerFooter({ hourCycle, setHourCycle, onClear, clearDisabled = false, showFormat = true }: { hourCycle: 12 | 24; setHourCycle: (value: 12 | 24) => void; onClear: () => void; clearDisabled?: boolean; showFormat?: boolean }) {
  return <div className="date-footer">{showFormat && <div className="date-hour-cycle" aria-label="Time format"><button type="button" aria-pressed={hourCycle === 12} onClick={() => setHourCycle(12)}>12h</button><button type="button" aria-pressed={hourCycle === 24} onClick={() => setHourCycle(24)}>24h</button></div>}<button type="button" className="date-clear" disabled={clearDisabled} onClick={onClear}>Clear</button></div>
}

function CalendarPanel({ anchorId, value, min, max, locale, weekStartsOn = 1, onSelect, onClose, range, beforeCalendar, afterCalendar, timeSection, footer }: { anchorId: string; value: string | null; min?: string; max?: string; locale?: string; weekStartsOn?: number; onSelect: (v: string) => void; onClose: () => void; range?: RangeValue; beforeCalendar?: React.ReactNode; afterCalendar?: React.ReactNode; timeSection?: React.ReactNode; footer?: React.ReactNode }) {
  const [todayKey] = useState(() => dateKey(new Date()))
  const initial = value ? fromKey(value) : fromKey(todayKey), [month, setMonth] = useState(monthStart(initial)), [view, setView] = useState<'days'|'months'|'years'>('days'), panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const placement = useRef<'above' | 'below' | null>(null)
  useLayoutEffect(() => {
    const position = () => {
      const dialog = panel.current, anchor = document.getElementById(anchorId)
      if (!dialog || !anchor) return
      if (window.matchMedia('(max-width: 639px), (max-height: 680px)').matches) { placement.current = null; dialog.style.top = ''; dialog.style.left = ''; return }
      const anchorRect = anchor.getBoundingClientRect(), dialogRect = dialog.getBoundingClientRect(), margin = 8, gap = 6
      const left = Math.min(Math.max(margin, anchorRect.left), window.innerWidth - dialogRect.width - margin)
      const below = anchorRect.bottom + gap, above = anchorRect.top - dialogRect.height - gap
      if (!placement.current) {
        const belowFits = below + dialogRect.height <= window.innerHeight - margin
        const aboveFits = above >= margin
        placement.current = belowFits ? 'below' : aboveFits ? 'above' : anchorRect.bottom < window.innerHeight / 2 ? 'below' : 'above'
      }
      const preferred = placement.current === 'below' ? below : above
      const top = Math.max(margin, Math.min(preferred, window.innerHeight - dialogRect.height - margin))
      dialog.style.left = `${left}px`; dialog.style.top = `${top}px`
    }
    position()
    const onResize = () => { placement.current = null; position() }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', position, true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position)
    if (panel.current) observer?.observe(panel.current)
    const anchor = document.getElementById(anchorId)
    if (anchor) observer?.observe(anchor)
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('scroll', position, true); observer?.disconnect() }
  }, [anchorId])
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; const click = (e: MouseEvent) => { if (panel.current && !panel.current.parentElement?.contains(e.target as Node)) onClose() }; document.addEventListener('keydown', key); document.addEventListener('mousedown', click); return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', click) } }, [onClose])
  const first = new Date(month.getFullYear(), month.getMonth(), 1), offset = (first.getDay() - weekStartsOn + 7) % 7, gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - offset), days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  const week = Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(locale,{weekday:'short'}).format(new Date(2024,0,1+(i+weekStartsOn-1+7)%7)))
  const move = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))
  const handleDayKey = (e: React.KeyboardEvent<HTMLButtonElement>, day: Date) => { let next: Date | null = null; const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key as 'ArrowLeft']; if (delta !== undefined) { next = new Date(day); next.setDate(next.getDate() + delta) } else if (e.key === 'Home' || e.key === 'End') { next = new Date(day); const offset = (day.getDay() - weekStartsOn + 7) % 7; next.setDate(day.getDate() + (e.key === 'Home' ? -offset : 6 - offset)) } else if (e.key === 'PageUp' || e.key === 'PageDown') { next = new Date(day.getFullYear(), day.getMonth() + (e.key === 'PageUp' ? -1 : 1) * (e.shiftKey ? 12 : 1), Math.min(day.getDate(), 28)) } if (next) { e.preventDefault(); setMonth(monthStart(next)); window.requestAnimationFrame(() => document.getElementById(`day-${id}-${dateKey(next!)}`)?.focus()) } }
  return <><div className="date-overlay" aria-hidden="true" onClick={onClose}/><div className="date-dialog" role="dialog" aria-modal="true" aria-label="Choose date" ref={panel} id={id} onKeyDown={(e) => { if ((e.key === 't' || e.key === 'T') && e.target instanceof HTMLButtonElement && e.target.classList.contains('date-day')) { onSelect(todayKey); e.preventDefault() } }}><div className="date-dialog-content">
    <div className="date-sheet-handle"/>
    <header className="date-cal-head"><button type="button" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft size={16}/></button><button type="button" className="date-month-label" aria-live="polite" onClick={() => setView(view === 'days' ? 'months' : 'years')}>{monthLabel(month, locale)}</button><button type="button" aria-label="Next month" onClick={() => move(1)}><ChevronRight size={16}/></button></header>
    <div className="date-presets"><button type="button" onClick={() => onSelect(todayKey)}>Today</button><button type="button" onClick={() => { const d = fromKey(todayKey); d.setDate(d.getDate() + 1); onSelect(dateKey(d)) }}>Tomorrow</button><button type="button" onClick={() => { const d = fromKey(todayKey); d.setDate(d.getDate() + 7); onSelect(dateKey(d)) }}>Next week</button><button type="button" onClick={() => { const d = fromKey(todayKey); d.setMonth(d.getMonth() + 1); onSelect(dateKey(d)) }}>In one month</button></div>
    {beforeCalendar && <div className="date-before-calendar">{beforeCalendar}</div>}
    {view === 'months' ? <div className="date-month-grid">{Array.from({ length: 12 }, (_, i) => <button type="button" key={i} onClick={() => { setMonth(new Date(month.getFullYear(), i, 1)); setView('days') }}>{new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, i, 1))}</button>)}</div> : view === 'years' ? <div className="date-month-grid date-year-grid">{Array.from({ length: 16 }, (_, i) => month.getFullYear() - 7 + i).map((year) => <button type="button" key={year} onClick={() => { setMonth(new Date(year, month.getMonth(), 1)); setView('months') }}>{year}</button>)}</div> : <><div className="date-calendar-grid date-weekdays" role="row">{week.map((day, i) => <span role="columnheader" key={i}>{day}</span>)}</div><div className="date-calendar-grid" role="grid" aria-label={monthLabel(month, locale)}>{days.map((day) => { const key = dateKey(day), disabled = (min && key < min.slice(0, 10)) || (max && key > max.slice(0, 10)), selected = key === value, inRange = range?.start && range.end && key >= range.start.slice(0, 10) && key <= range.end.slice(0, 10); return <button key={key} type="button" role="gridcell" aria-label={new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(day)} aria-selected={selected} disabled={Boolean(disabled)} className={`date-day${day.getMonth() !== month.getMonth() ? ' is-outside' : ''}${selected ? ' is-selected' : ''}${key === todayKey ? ' is-today' : ''}${inRange ? ' is-range' : ''}`} onClick={() => onSelect(key)} onKeyDown={(event) => handleDayKey(event, day)} id={`day-${id}-${key}`} tabIndex={selected || (!value && key === todayKey) ? 0 : -1}>{day.getDate()}</button> })}</div></>}
    {afterCalendar && <div className="date-options">{afterCalendar}</div>}
    <div className={`date-time-reveal${timeSection ? ' is-visible' : ''}`}><div className="date-time-reveal-inner">{timeSection}</div></div>
    </div>{footer && <footer className="date-picker-footer">{footer}</footer>}</div></>
}
