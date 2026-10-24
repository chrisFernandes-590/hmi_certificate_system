import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDate, parseTime, validDate } from '../src/components/date-time/date-picker-utils.js'

test('parses ISO and locale-specific numeric dates without rollover', () => {
  assert.equal(parseDate('2026-10-24'), '2026-10-24')
  assert.equal(parseDate('24/10/2026', 'en-GB'), '2026-10-24')
  assert.equal(parseDate('10/24/2026', 'en-US'), '2026-10-24')
  assert.equal(parseDate('31/02/2026', 'en-GB'), null)
  assert.equal(validDate(2026, 2, 29), null)
})

test('parses named dates and natural language relative dates', () => {
  assert.equal(parseDate('Oct 24, 2026'), '2026-10-24')
  assert.match(parseDate('tomorrow') ?? '', /^\d{4}-\d{2}-\d{2}$/)
  assert.match(parseDate('next Friday') ?? '', /^\d{4}-\d{2}-\d{2}$/)
  assert.match(parseDate('in 3 days') ?? '', /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(parseDate('next blursday'), null)
})

test('parses typed 12-hour and 24-hour times and rejects invalid values', () => {
  assert.equal(parseTime('330p'), '15:30')
  assert.equal(parseTime('3:30pm'), '15:30')
  assert.equal(parseTime('15:30'), '15:30')
  assert.equal(parseTime('12am'), '00:00')
  assert.equal(parseTime('noon'), '12:00')
  assert.equal(parseTime('midnight'), '00:00')
  assert.equal(parseTime('25:80'), null)
})
