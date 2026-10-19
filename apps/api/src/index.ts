import { serve } from '@hono/node-server'
import { authConfig } from './config/auth-config.js'
import { db } from './db/index.js'
import { createApp } from './app.js'
import { DrizzleAuthRepository } from './repositories/auth/drizzle-auth-repository.js'
import { DevelopmentConsoleEmailProvider, DisabledEmailProvider } from './services/auth/email-provider.js'
import { LocalAuthProvider } from './services/auth/local-auth-provider.js'
import { DrizzleEventRepository } from './repositories/events/drizzle-event-repository.js'
import { EventService } from './services/events/event-service.js'

const emailProvider = authConfig.devEmailEnabled
  ? new DevelopmentConsoleEmailProvider()
  : new DisabledEmailProvider()
const authProvider = new LocalAuthProvider(new DrizzleAuthRepository(db), emailProvider, {
  sessionTtlSeconds: authConfig.sessionTtlSeconds,
  verificationTtlSeconds: authConfig.verificationTtlSeconds,
  passwordResetTtlSeconds: authConfig.passwordResetTtlSeconds,
  appBaseUrl: authConfig.appBaseUrl,
})

const app = createApp(authProvider, authConfig, new EventService(new DrizzleEventRepository(db)))

serve({ fetch: app.fetch, port: authConfig.port }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
