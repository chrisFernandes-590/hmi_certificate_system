# Frontend Architecture Map (`apps/web`): HMI Certificate System

## Application Overview

The web SPA uses React 19, TypeScript, Vite, React Router, TanStack Query,
Tailwind CSS v4, and the existing authentication styles. `src/main.tsx` provides
the shared QueryClient; `src/App.tsx` defines public and authenticated routes.
The browser uses same-origin `/api` requests with the existing HttpOnly local
session cookie. Cognito is not configured.

## Feature Areas

| Path | Responsibility |
| --- | --- |
| `src/features/auth/` | Login, registration, recovery, email verification |
| `src/features/events/events.tsx` | Event list/details and create/edit forms |
| `src/features/admin/AdminWorkspace.tsx` | Authenticated admin shell, persisted dashboard summary, published upcoming events, and event-scoped participant/certificate navigation |
| `src/features/admin/admin-workspace.css` | Responsive dashboard, event, certificate, and management page styling. Sidebar styling remains in the design-system layout stylesheet. |
| `src/features/admin/csv-import.ts` | Streaming CSV parser for participant uploads with progress callbacks, validation, and a row cap |
| `src/features/certificates/EventCertificateManagement.tsx` | Event-admin participant search, attendance updates, individual/bulk certificate issue, event certificate search, status/revocation |
| `src/features/certificates/certificates.tsx` | Owner certificate listing/search/details, authorized PDF preview/download, public verification page |
| `src/features/design-system/` | Certify theme tokens, shared status pills, print-style certificate preview, and participant/admin layouts |
| `src/features/navigation/` | Shared safe Back links, accessible breadcrumbs, and route metadata with authorized event-name resolution |
| `src/lib/api-client.ts` | Standard JSON envelope client plus authenticated PDF blob downloads |
| `src/App.css` | Event, participant, certificate table and verification layouts |

## Routes and Authorization

- Successful sign-in and the authenticated `/` route land on `/admin/dashboard`.
- `/events/:eventId`: authenticated event detail. Admin-only management controls
  are shown only when API data reports `accessRole: "admin"`; the API remains
  the authorization boundary.
- `/admin/*`: authenticated admin workspace backed by event, participant, and
  certificate APIs. Event routes reuse the existing event screens; participant
  and certificate navigation selects an event and reuses event-admin management.
- `/certificates` and `/certificates/:certificateId`: authenticated user's own
  certificate records and owner-authorized details/PDF actions. The details API
  omits verification URLs and revocation reasons.
- `/verify` and `/verify/:token`: token entry and public verification, no login required. Verification accepts the backend's token format; certificate-number lookup is not supported.

TanStack Query keys include event IDs and active search/filter/page values.
Attendance, issue, and revoke mutations invalidate their dependent event and
certificate queries. Zod validates issue/revoke inputs; existing event forms
continue to use their shared Zod schemas. React Hook Form is installed but the
current form modules do not use it.

The admin preview streams CSV participant files in-browser, limits uploads to
20 MB and 20,000 participant rows, yields during parsing, and renders only the
first 50 imported rows while validating the full file. XLSX is accepted by the
picker but reports that spreadsheet parsing support is not configured.
Certificate PDF downloads remain owner-authorized through `/certificates`;
event administrators do not receive access to another participant's private
PDF.

Authenticated admin, event, account, certificate-list, and certificate-detail
routes use shared route-derived breadcrumbs and explicit parent-route Back links.
Public auth and verification screens keep their public workflow links and do not
show dashboard breadcrumbs. Certificate previews are inline on the owner's list.
Participant detail, CSV-import, and event settings routes are not currently
registered screens. The dashboard API does not return participant totals or
recent activity; the UI identifies these gaps and uses real published upcoming
events.

## Development and Validation

From the repository root, run `pnpm --filter web dev`, `pnpm --filter web
build`, and `pnpm --filter web lint`. There is no separate frontend unit-test
script configured.
