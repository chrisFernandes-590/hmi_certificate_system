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
| `src/features/events/events.tsx` | Event list/details and two-step create/edit forms; create drafts restore from browser storage for up to seven days |
| `src/features/admin/AdminWorkspace.tsx` | Authenticated admin shell, persisted dashboard summary, published upcoming events, and event-scoped participant/certificate navigation |
| `src/features/admin/EventPickerPage.tsx`, `event-picker.css` | Searchable, sortable, filterable event picker for participant management, with date groups, accessible keyboard navigation, and bounded client pagination |
| `src/features/admin/admin-workspace.css` | Responsive dashboard, event, certificate, and management page styling. Sidebar styling remains in the design-system layout stylesheet. |
| `src/features/admin/csv-import.ts`, `src/features/admin/csv-import.worker.ts` | Worker-based local CSV inspection, column mapping, formatting preview, progress callbacks, and a row cap |
| `src/features/certificates/EventCertificateManagement.tsx` | Event-admin participant search, attendance updates, individual/bulk certificate issue, event certificate search, status/revocation |
| `src/features/certificates/ParticipantImportWizard.tsx` | Direct-to-private-storage upload, server validation review, explicit confirmation, recovery, import history, and error-report download |
| `src/features/certificates/certificates.tsx` | Owner certificate listing/search/details, authorized PDF preview/download, public verification page |
| `src/features/design-system/` | Shared warm-neutral light/dark tokens, status pills, certificate preview, participant layout, and responsive admin navigation |
| `src/features/navigation/` | Shared safe Back links, accessible breadcrumbs, and route metadata with authorized event-name resolution |
| `src/components/loading/LoadingUi.tsx` | Accessible monochrome spinners, route/data skeletons, and retry-on-reload recovery for failed route chunks |
| `src/components/date-time/` | Canonical themed DatePicker, DateTimePicker, DateRangePicker and development showcase; see `docs/agent-context/date-time-pickers.md` for value semantics and the migration audit |
| `src/lib/api-client.ts` | Standard JSON envelope client plus authenticated PDF blob downloads |
| `src/lib/format-event-date.ts` | Shared locale-aware event date and time formatting |
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

The participant importer inspects CSV files locally in a Web Worker, limits
uploads to 20 MB and 20,000 participant rows, then uploads bytes to private storage
(with automatic fallback to the authorized backend upload endpoint if presigned storage PUTs
are blocked). A human-readable 6-step progress dashboard tracks:
(1) Preparing participant list, (2) Checking participant details, (3) Checking for existing participants,
(4) Adding participants to your event, (5) Finishing up, and (6) Import complete.
The dashboard displays live truthful row counts (added, linked, skipped, invalid),
recovers active imports after a page refresh, handles session expiration gracefully,
and confirms immediate temporary CSV deletion upon database commit.
Certificate PDF downloads remain owner-authorized through `/certificates`;
event administrators do not receive access to another participant's private
PDF.

Signup, password recovery/reset, not-found, event, admin, and certificate screens
are split into route or feature chunks. The sign-in screen and shared shell stay
in the entry path. `LoadingUi` supplies route-specific skeletons and compact
spinners. Boneyard was evaluated against its current install/capture workflow,
but was not added because package installation and authenticated browser capture
could not be verified in this restricted network environment. TanStack Query
reuses recently loaded data for 15 seconds, retries eligible failures once, and
clears user-scoped data after successful sign-out.

Shared CSS tokens live in `src/index.css` and are consumed by the design-system
layouts and admin/event/certificate screens. The admin workspace has a persisted
light/dark toggle (`certify-theme`) and an accessible mobile navigation drawer;
the backend authorization and route tree remain authoritative.

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
