/** @param {number} value */
const pad = (value) => String(value).padStart(2, '0')
/** @param {Date} date */
export const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
/** @param {string} value */
export const fromKey = (value) => { const [year, month, day] = value.slice(0, 10).split('-').map(Number); return new Date(year, month - 1, day) }
/** @param {Date} date */
export const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
/** @param {Date} date @param {string} [locale] */
export const monthLabel = (date, locale) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)

/** @param {number} year @param {number} month @param {number} day */
export function validDate(year, month, day) { const value = new Date(year, month - 1, day); return value.getFullYear() === year && value.getMonth() === month - 1 && value.getDate() === day ? dateKey(value) : null }

/** @param {string} text @param {string} [locale] @returns {string | null} */
export function parseDate(text, locale) {
  const input = text.trim().toLowerCase(); if (!input) return null
  const today = new Date(); const result = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (input === 'today') return dateKey(result)
  if (input === 'tomorrow') { result.setDate(result.getDate() + 1); return dateKey(result) }
  const relative = input.match(/^in\s+(\d+)\s+days?$/); if (relative) { result.setDate(result.getDate() + Number(relative[1])); return dateKey(result) }
  const weekday = input.match(/^(?:next\s+)?(sun|sunday|mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)$/)
  if (weekday) { const weekdays = ['sun','mon','tue','wed','thu','fri','sat']; const index = weekdays.findIndex((day) => weekday[1].startsWith(day)); const delta = (index - result.getDay() + 7) % 7 || 7; result.setDate(result.getDate() + delta); return dateKey(result) }
  const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (iso) return validDate(+iso[1], +iso[2], +iso[3])
  const numeric = input.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/); if (numeric) { const us = (locale ?? Intl.DateTimeFormat().resolvedOptions().locale).toLowerCase().startsWith('en-us'); return us ? validDate(+numeric[3], +numeric[1], +numeric[2]) : validDate(+numeric[3], +numeric[2], +numeric[1]) }
  const named = input.match(/^([a-z]{3,9})\s+(\d{1,2})(?:,?\s+(\d{4}))?$/); if (named) { const month = new Date(`${named[1]} 1, 2000`).getMonth() + 1; return validDate(named[3] ? +named[3] : today.getFullYear(), month, +named[2]) }
  return null
}

/** @param {string | null} value @param {string} [locale] @param {boolean} [time] */
export function formatDate(value, locale, time = false) { if (!value) return ''; const date = time ? new Date(value) : fromKey(value); return new Intl.DateTimeFormat(locale, time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date) }

/** @param {string} text @returns {string | null} */
export function parseTime(text) { const input = text.trim().toLowerCase().replace(/\s/g, ''); if (input === 'noon') return '12:00'; if (input === 'midnight') return '00:00'; const compact = input.match(/^(\d{3,4})([ap])m?$/); if (compact) { const digits = compact[1], hour = +digits.slice(0, -2), minute = +digits.slice(-2); if (hour < 1 || hour > 12 || minute > 59) return null; return `${pad(hour % 12 + (compact[2] === 'p' ? 12 : 0))}:${pad(minute)}` }; const match = input.match(/^(\d{1,2})(?::?(\d{2}))?([ap])?m?$/); if (!match) return null; let hour = +match[1], minute = +(match[2] ?? 0); if (minute > 59 || hour > (match[3] ? 12 : 23) || hour < 0) return null; if (match[3]) { if (hour < 1) return null; hour = hour % 12 + (match[3] === 'p' ? 12 : 0) }; return `${pad(hour)}:${pad(minute)}` }
