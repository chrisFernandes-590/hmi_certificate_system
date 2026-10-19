import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { successResponse } from './lib/api-response.js'
import { asyncHandler } from './middleware/async-handler.js'
import { apiErrorHandler, apiNotFoundHandler } from './middleware/error-handler.js'

const app = new Hono()

app.onError(apiErrorHandler)
app.notFound(apiNotFoundHandler)

app.get('/', asyncHandler((c) => {
  return successResponse(c, { message: 'Hello Hono!' })
}))

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
