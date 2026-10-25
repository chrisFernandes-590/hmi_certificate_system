import assert from 'node:assert/strict'
import { test } from 'node:test'
import { eventListStatusLabel, formatPickerDateRange, getEventListStatus } from '../src/features/events/event-picker-utils.ts'

const baseEvent = {
  id: 'event-1', name: 'HTLDR', description: null,
  startDate: '2026-10-24T09:00:00.000Z', endDate: '2026-10-26T17:00:00.000Z',
  status: 'published', ownerId: 'owner-1', createdAt: '', updatedAt: '', archivedAt: null, accessRole: 'admin',
}

test('event picker lifecycle status has one shared label mapping', () => {
  assert.deepEqual([
    getEventListStatus({ ...baseEvent, status: 'draft' }, Date.parse('2026-10-25T12:00:00Z')),
    getEventListStatus(baseEvent, Date.parse('2026-10-23T12:00:00Z')),
    getEventListStatus(baseEvent, Date.parse('2026-10-25T12:00:00Z')),
    getEventListStatus(baseEvent, Date.parse('2026-10-27T12:00:00Z')),
    getEventListStatus({ ...baseEvent, status: 'cancelled' }, Date.parse('2026-10-25T12:00:00Z')),
  ], ['draft', 'upcoming', 'live', 'completed', 'cancelled'])
  assert.equal(eventListStatusLabel('live'), 'Live')
})

test('event picker dates use day/month/year and omit times', () => {
  assert.equal(formatPickerDateRange(baseEvent), '24/10/2026 – 26/10/2026')
  assert.equal(formatPickerDateRange({ ...baseEvent, endDate: '2026-10-24T16:00:00.000Z' }), '24/10/2026')
  assert.equal(formatPickerDateRange({ ...baseEvent, startDate: 'invalid' }), 'Date unavailable')
})
