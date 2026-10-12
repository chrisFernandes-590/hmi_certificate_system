# API Contracts & Endpoint Specification: HMI Certificate System

## 1. Verified API Implementation

The backend API server (`apps/api/src/index.ts`) is running Hono on Node.js at port 3000. Currently, only a single root endpoint is implemented in source code.

---

### `GET /`

- **Endpoint**: `/`
- **HTTP Method**: `GET`
- **Purpose**: Root health check / basic connectivity verification.
- **Implementation**: Defined in `apps/api/src/index.ts:L6-L8`.
- **Authentication**: None (public).
- **Request Headers**: None required.
- **Request Parameters / Body**: None.
- **Response**:
  - **Status Code**: `200 OK`
  - **Content-Type**: `text/plain; charset=UTF-8`
  - **Body**: `"Hello Hono!"`
- **Validation**: None.
- **Error Handling**: Standard Hono default exception handling.

---

## 2. Planned API Contracts

The following API contracts represent anticipated endpoints required by the certificate domain. None of these endpoints are currently implemented.

| Endpoint | Method | Planned Purpose | Status | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `/api/certificates` | `POST` | Create and issue new certificate(s) | Planned | Yes (Admin/Issuer) |
| `/api/certificates` | `GET` | List or filter certificates | Planned | Yes (Admin/Issuer) |
| `/api/certificates/:id` | `GET` | Fetch certificate details | Planned | Yes (Admin/Issuer) |
| `/api/certificates/verify/:code` | `GET` | Public certificate verification | Planned | No (Public) |
| `/api/certificates/:id/pdf` | `GET` | Generate and download certificate PDF | Planned | Optional/Token-based |
| `/api/certificates/:id/revoke` | `PATCH` | Revoke an issued certificate | Planned | Yes (Admin) |
| `/api/events` | `GET` / `POST` | Manage associated events | Planned | Yes (Admin) |
| `/api/participants` | `GET` / `POST` | Manage participant records | Planned | Yes (Admin) |

---

## 3. Anticipated Error Handling & Validation Standards

When implementing future API routes, follow these conventions:

- **Validation**: Use Zod (`zod@^4.6.6` is installed in `apps/api`) via Hono's Zod validator middleware (`@hono/zod-validator` or native schema validation).
- **Standard Error Response**:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Human-readable error description",
      "details": []
    }
  }
  ```
- **HTTP Status Codes**:
  - `200 OK` / `201 Created` for successful operations.
  - `400 Bad Request` for schema validation failures.
  - `401 Unauthorized` for missing or invalid authentication credentials.
  - `403 Forbidden` for insufficient role permissions.
  - `404 Not Found` for nonexistent certificates, events, or participants.
  - `500 Internal Server Error` for unhandled runtime exceptions.
