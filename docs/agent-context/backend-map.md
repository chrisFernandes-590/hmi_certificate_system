# Backend Architecture Map (`apps/api`): HMI Certificate System

## 1. Application Overview

The backend application is a Node.js REST API service built with Hono (`hono@^4.13.13`) and `@hono/node-server` (`^2.1.3`). It is located in `apps/api`.

- **Entry Point**: `apps/api/src/index.ts`.
- **Runtime Port**: Configured to 3000 (referenced in `index.ts:L12` and `.env`).
- **Compilation Output**: Compiled to `apps/api/dist/index.js` via `tsc`.

---

## 2. Verified Implementation & Route Registration

The current implementation in `apps/api/src/index.ts` is minimal:

```typescript
// Verified content of apps/api/src/index.ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
```

---

## 3. Architecture Layers & Status

| Layer | Implementation Status | Details |
| :--- | :--- | :--- |
| **HTTP Server** | Implemented | Hono app mounted using `@hono/node-server` on port 3000. |
| **Routing** | Minimal (1 route) | Single root endpoint `GET /`. No sub-routers or feature routes exist. |
| **Middleware** | None registered | No CORS, request logging, body parsing, or auth middleware attached. |
| **Database Access** | Configured / Unconnected | `drizzle.config.ts` exists, but no database client or schema file exists in `src/`. |
| **Validation** | Not implemented | `zod@^4.6.6` is installed in `package.json`, but no validators are attached. |
| **Authentication** | Not implemented | No token verification, session store, or RBAC guards exist. |
| **Services / Business Logic**| Not implemented | No certificate generation, verification, or event logic exists. |
| **Error Handling** | Default | Relies on Hono's default error response. No custom error handler attached. |

---

## 4. Planned Backend Structure

When implementing the domain features, the backend should be organized as follows:

```
apps/api/src/
├── index.ts               # Server startup, global middleware, route mounts
├── db/
│   ├── index.ts           # Drizzle client instance (pg pool connection)
│   └── schema.ts          # Table definitions and relations
├── middleware/
│   ├── auth.ts            # Authentication and authorization guards
│   ├── error.ts           # Global error handler
│   └── cors.ts            # CORS configuration for frontend origin
├── routes/
│   ├── certificates.ts    # Certificate endpoints (issue, get, revoke, verify)
│   ├── events.ts          # Event management endpoints
│   └── participants.ts    # Participant management endpoints
└── services/
    ├── certificate.ts     # Issuance, numbering, and revocation logic
    ├── pdf.ts             # PDF document generation
    └── qr.ts              # QR code payload and image generation
```

---

## 5. Development & Build Commands

Run commands from the repository root:

```bash
# Start backend in watch mode using tsx
pnpm --filter api dev

# Compile TypeScript to dist/index.js
pnpm --filter api build

# Run compiled production server
pnpm --filter api start
```
