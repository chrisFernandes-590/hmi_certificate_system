# API Contracts & Endpoint Specification: HMI Certificate System

## 1. Implemented Endpoint

The Hono API currently exposes one endpoint.

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

`index.ts` registers `apiErrorHandler` with `app.onError` and
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
`index.ts`. For each endpoint:

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
