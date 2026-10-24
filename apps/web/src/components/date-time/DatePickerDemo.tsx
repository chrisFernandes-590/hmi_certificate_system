import { useState } from 'react'
import { DatePicker, DateRangePicker, DateTimePicker } from './DatePickers'

/** Development-only showcase. Keep out of production routes. */
export function DatePickerDemo() {
  const [date, setDate] = useState<string | null>(null)
  const [dateTime, setDateTime] = useState<string | null>(null)
  const [dark, setDark] = useState(false)
  const [range, setRange] = useState<{ start: string | null; end: string | null; includeTime?: boolean; timeZone?: string }>({ start: null, end: null, includeTime: false, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  return <section className={dark ? 'dark' : undefined} aria-label="Date picker development demo" style={{ display: 'grid', gap: 16, maxWidth: 360, padding: 20, background: 'var(--background)', color: 'var(--foreground)' }}>
    <label><input type="checkbox" checked={dark} onChange={(event) => setDark(event.target.checked)} /> Dark theme preview</label>
    <label style={{ display: 'grid', gap: 6 }}>Single date<DatePicker value={date} onChange={setDate} placeholder="Empty" min="2020-01-01" max="2035-12-31" /></label>
    <form aria-label="Example event form">
      <label style={{ display: 'grid', gap: 6 }}>Date and time<DateTimePicker name="demoDateTime" value={dateTime} onChange={setDateTime} /></label>
    </form>
    <label style={{ display: 'grid', gap: 6 }}>Date range<DateRangePicker value={range} onChange={setRange} /></label>
  </section>
}
