import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { apiErrorHandler } from '../src/middleware/error-handler.js'

for (const [label, postgresCode, databaseMessage] of [
  ['missing relation', '42P01', 'relation "profiles" does not exist'],
  ['missing column', '42703', 'column "active_profile_id" does not exist'],
] as const) {
test(`PostgreSQL ${label} returns a safe migration-required response`, async () => {
  const app = new Hono()
  app.onError(apiErrorHandler)
  app.get('/', () => {
    const cause = Object.assign(new Error(databaseMessage), { code: postgresCode })
    throw Object.assign(new Error('Failed query'), { cause })
  })

  const originalConsoleError = console.error
  const logged: unknown[][] = []
  console.error = (...args: unknown[]) => logged.push(args)
  try {
    const response = await app.request('/')
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      success: false,
      error: {
        statusCode: 503,
        message: 'Account profile storage is not initialized. Apply the latest database migration and retry.',
        code: 'DATABASE_MIGRATION_REQUIRED',
      },
    })
    assert.equal(logged.length, 1)
    assert.deepEqual(logged[0][1], { postgresCode, databaseMessage })
  } finally {
    console.error = originalConsoleError
  }
})
}
