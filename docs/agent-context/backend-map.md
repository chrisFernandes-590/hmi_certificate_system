# Backend Architecture Map (`apps/api`): HMI Certificate System

## 1. Application Overview

The backend application is a Node.js REST API service built with Hono (`hono@^4.13.13`) and `@hono/node-server` (`^2.1.3`). It is located in `apps/api`.

- **Entry Point**: `apps/api/src/index.ts`.
- **Runtime Port**: Configured to 3000 (referenced in `index.ts:L12` and `.env`).
- **Compilation Output**: Compiled to `apps/api/dist/index.js` via `tsc`.

---

## 2. Verified Implementation & Route Registration

`src/index.ts` wires the database repositories, event service, local auth provider, email
adapter, and HTTP server. `src/app.ts` creates the Hono app, registers global
error and not-found handlers, then mounts the health, auth, and event routes. See
`docs/architecture/api-contracts.md` for endpoint and response details.

---

## 3. Architecture Layers & Status

| Layer | Implementation Status | Details |
| :--- | :--- | :--- |
| **HTTP Server** | Implemented | Hono app mounted using `@hono/node-server` on port 3000. |
| **Routing** | Implemented | `createApp` mounts health, `/api/auth/*`, and `/api/events/*` routes. |
| **Middleware** | Implemented | Standard errors, validation, cookie/bearer auth, Origin checks, and in-memory sensitive-route throttles. |
| **Database Access** | Implemented | `src/db/index.ts` provides Drizzle over PostgreSQL; auth records are in `src/db/schema/auth.ts`. |
| **Validation** | Implemented | Auth request bodies use Zod and the common error envelope. |
| **Authentication** | Implemented (local) | `LocalAuthProvider`, Drizzle repository, hashed sessions, Argon2id, and auth middleware. Cognito is future work. |
| **Services / Business Logic**| Partially implemented | Event service validates dates and enforces event-scoped admin permissions. Certificate logic remains unimplemented. |
| **Error Handling** | Implemented | `AppError`, validation errors, Hono 4xx exceptions, unexpected errors, and unknown routes use standardized error responses. Unexpected exceptions are logged and masked from clients. |

---

## 4. Planned Backend Structure

When implementing the domain features, the backend should be organized as follows:

```
apps/api/src/
├── index.ts               # Server startup and dependency wiring
├── app.ts                 # Hono app factory, routes, global error handlers
├── db/
│   ├── index.ts           # Drizzle client instance (pg pool connection)
│   └── schema.ts          # Table definitions and relations
├── middleware/
│   ├── auth.ts            # Session auth and CSRF origin guard
│   ├── rate-limit.ts      # In-process sensitive-route throttling
│   ├── async-handler.ts   # Wrap async route callbacks; forward rejections to Hono
│   ├── error-handler.ts   # Global error and not-found response handlers
│   └── cors.ts            # CORS configuration for frontend origin
├── errors/
│   └── app-error.ts      # Expected API errors with status, message, optional details
├── lib/
│   └── api-response.ts   # Standard success and error response helpers
├── routes/
│   ├── certificates.ts    # Certificate endpoints (issue, get, revoke, verify)
│   ├── events.ts          # Event management endpoints
│   └── participants.ts    # Participant management endpoints
└── services/
    └── auth/              # Provider abstraction, local Argon2id provider, mail adapter
    ├── certificate.ts     # Issuance, numbering, and revocation logic (planned)
    ├── pdf.ts             # PDF document generation (planned)
    └── qr.ts              # QR code payload and image generation (planned)
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
