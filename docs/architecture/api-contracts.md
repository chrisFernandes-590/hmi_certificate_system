# API Contracts & Endpoint Specification: HMI Certificate System

## 1. Implemented Endpoints

The Hono API exposes a health endpoint and local authentication endpoints.

### `GET /`

- **Purpose**: Basic connectivity check.
- **Authentication**: None.
- **Response**: `200 OK`, `application/json`:

```json
{
  "success": true,
  "data": { "message": "Hello Hono!" }
}
```

### Authentication (`/api/auth`)

All request bodies are JSON. Registration requires `{ "name", "email", "password" }`; verification accepts `{ "token" }`; login accepts `{ "email", "password" }`; forgot-password accepts `{ "email" }`; reset accepts `{ "token", "password" }`. Passwords must be 12–128 characters. Registration and recovery return `202` with generic text to limit account enumeration. Accounts must verify their email before sign-in. `GET /me` requires a web session cookie; native clients can send `X-Auth-Client: native` with `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register and request email verification |
| `POST` | `/api/auth/verify-email` | Consume a one-time verification token |
| `POST` | `/api/auth/login` | Create a server-managed session |
| `POST` | `/api/auth/logout` | Revoke the active session |
| `GET` | `/api/auth/me` | Restore the current user |
| `POST` | `/api/auth/forgot-password` | Request a password reset |
| `POST` | `/api/auth/reset-password` | Consume reset token and replace password |

Successful authenticated responses expose only `id`, `name`, `email`, and `emailVerifiedAt`; credentials and token hashes are never returned. Browser mutations require a matching `Origin` header and use `HttpOnly; SameSite=Lax` cookies. Native login returns an access token for platform secure storage.

### Local setup and client portability

Copy `apps/api/.env.example` to `apps/api/.env`, set `DATABASE_URL`, and run the database migration before starting the API. For local verification/reset links set `DEV_EMAIL_ENABLED=true` while `NODE_ENV=development`; the API prints links to its console. The default is disabled. Production startup is blocked until a real `EmailProvider` is configured. Run `pnpm --filter api test` for auth tests.

For Expo/React Native, send `X-Auth-Client: native` and use the returned bearer token on `/me` and `/logout`. Store it only in Expo SecureStore and clear it after logout. `AuthProvider` keeps provider operations separate from application user UUIDs and authorization. A future Cognito adapter should validate Cognito identities and attach a verified provider subject to the existing `users.id` through controlled linking; do not match/link based on unverified email. Event memberships and certificate ownership continue to reference the application UUID.

## 2. Response Conventions

Successful responses use `successResponse(c, data, statusCode?)`. The status
defaults to `200`; use a 2xx status such as `201` for a newly created resource.

```json
{
  "success": true,
  "data": { "id": "example-id" }
}
```

Failed responses use a 4xx or 5xx HTTP status and the `errorResponse` envelope.
`details` is omitted when it is not provided.

```json
{
  "success": false,
  "error": {
    "statusCode": 404,
    "message": "Certificate not found",
    "details": { "certificateId": "example-id" }
  }
}
```

The `statusCode` in the body matches the HTTP status. Never mark a failed
operation as a success. Only include client-safe information in `details`.

## 3. `AppError`

`AppError` extends `Error` and takes an HTTP error status, a client-facing
message, and optional client-safe details. Throw it from a route or service;
the global handler converts it to the standardized error response.

```typescript
throw new AppError(404, 'Certificate not found')

throw new AppError(400, 'Invalid certificate data', [
  { field: 'participantId', message: 'Required' }
])
```

## 4. Async Routes and Global Error Handling

Wrap new Hono route callbacks with `asyncHandler`. It preserves the callback's
parameter and response types and lets rejected async work reach Hono's global
error handler. Do not add route-level `try-catch` blocks just to format errors.

```typescript
app.get('/api/certificates/:id', asyncHandler(async (c) => {
  const certificate = await loadCertificate(c.req.param('id'))
  if (!certificate) throw new AppError(404, 'Certificate not found')

  return successResponse(c, certificate)
}))
```

`createApp` in `apps/api/src/app.ts` registers `apiErrorHandler` with `app.onError` and
`apiNotFoundHandler` with `app.notFound` before route definitions. The global
handler:

- Returns `AppError` with its status, message, and optional details.
- Converts thrown Zod validation errors to `400 Validation failed`, exposing
  only issue paths and messages.
- Converts Hono `HTTPException` 4xx errors to the same envelope and status.
- Logs unexpected errors server-side and returns a generic `500 Internal
  server error` response without a stack trace or internal error details.
- Returns unknown routes as `404 Route not found` in the same envelope.

Hono awaits route handlers and forwards rejected promises to `onError`.
`asyncHandler` provides a consistent async route signature; it does not replace
the global error handler.

## 5. Adding Endpoints

Add a route in the relevant `apps/api/src/routes/` module and mount it from
`apps/api/src/app.ts`. For each endpoint:

1. Keep its existing validation, authorization, and business logic.
2. Wrap async handlers in `asyncHandler`.
3. Return successful data through `successResponse`; choose an appropriate 2xx
   status when needed.
4. Throw `AppError` for expected failures, using an appropriate 4xx status and
   client-safe message/details. Let unexpected errors propagate to `onError`.
5. Avoid manual response envelopes and redundant `try-catch` blocks.

The following certificate, event, and participant endpoints are planned and are
not currently implemented:

| Endpoint | Method | Purpose | Auth |
| :--- | :--- | :--- | :--- |
| `/api/certificates` | `POST` | Create and issue certificates | Admin/Issuer |
| `/api/certificates` | `GET` | List or filter certificates | Admin/Issuer |
| `/api/certificates/:id` | `GET` | Fetch certificate details | Admin/Issuer |
| `/api/certificates/verify/:code` | `GET` | Verify a certificate | Public |
| `/api/certificates/:id/pdf` | `GET` | Download certificate PDF | Optional/token-based |
| `/api/certificates/:id/revoke` | `PATCH` | Revoke a certificate | Admin |
| `/api/events` | `GET` / `POST` | Manage events | Admin |
| `/api/participants` | `GET` / `POST` | Manage participants | Admin |
