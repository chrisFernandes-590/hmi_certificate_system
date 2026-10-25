import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { AppError } from '../src/errors/app-error.js'
import { apiErrorHandler } from '../src/middleware/error-handler.js'
import { requireProfileType } from '../src/middleware/require-profile.js'
import type { AuthUser } from '../src/services/auth/types.js'
import type { ProfileService } from '../src/services/profiles/profile-service.js'

const user: AuthUser = { id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', name: 'Test User', email: 'test@example.com', emailVerifiedAt: new Date() }

function makeApp(assertActiveType: () => Promise<void>) {
  const profiles = { assertActiveType } as unknown as ProfileService
  const app = new Hono<{ Variables: { authUser: AuthUser; authSessionToken: string } }>()
  app.onError(apiErrorHandler)
  app.use('*', async (c, next) => { c.set('authUser', user); c.set('authSessionToken', 'session-token'); await next() })
  app.get('/', requireProfileType(profiles, 'organizer'), (c) => c.json({ success: true }))
  return app
}

test('organizer profile guard returns PROFILE_MISMATCH when participant profile is active', async () => {
  const app = makeApp(async () => { throw new AppError(403, 'Switch to your organizer profile to continue', undefined, 'PROFILE_MISMATCH') })
  const response = await app.request('/')
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { success: false, error: { statusCode: 403, message: 'Switch to your organizer profile to continue', code: 'PROFILE_MISMATCH' } })
})

test('profile guard allows the matching active profile', async () => {
  const app = makeApp(async () => undefined)
  const response = await app.request('/')
  assert.equal(response.status, 200)
})
