import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, apiRequest } from '../src/lib/api-client.ts'

async function withFetch(response, run) {
  const originalFetch = globalThis.fetch
  const originalError = console.error
  const logged = []
  globalThis.fetch = async () => response
  console.error = (...args) => logged.push(args)
  try { await run(logged) }
  finally { globalThis.fetch = originalFetch; console.error = originalError }
}

test('empty API error responses show friendly copy and log diagnostics', async () => {
  await withFetch(new Response('', { status: 500 }), async (logged) => {
    await assert.rejects(apiRequest('/login', { method: 'POST' }), (error) => {
      assert.ok(error instanceof ApiError)
      assert.match(error.message, /having trouble right now/i)
      assert.doesNotMatch(error.message, /JSON|Response|Unexpected end/i)
      return true
    })
    assert.equal(logged.length, 1)
    assert.match(logged[0][0], /Invalid response/)
  })
})

test('technical server messages are not rendered in the UI', async () => {
  const response = Response.json({ success: false, error: { statusCode: 503, message: 'relation "profiles" does not exist', code: 'DATABASE_MIGRATION_REQUIRED' } }, { status: 503 })
  await withFetch(response, async (logged) => {
    await assert.rejects(apiRequest('/login', { method: 'POST' }), (error) => {
      assert.ok(error instanceof ApiError)
      assert.match(error.message, /sign-in is temporarily unavailable/i)
      assert.doesNotMatch(error.message, /profiles|database|migration/i)
      return true
    })
    assert.equal(logged.length, 1)
    assert.match(logged[0][0], /Request failed/)
  })
})

test('invalid sign-in details use a clear message', async () => {
  const response = Response.json({ success: false, error: { statusCode: 401, message: 'Email or password is incorrect' } }, { status: 401 })
  await withFetch(response, async () => {
    await assert.rejects(apiRequest('/login', { method: 'POST' }), (error) => {
      assert.ok(error instanceof ApiError)
      assert.match(error.message, /check your email and password/i)
      return true
    })
  })
})
