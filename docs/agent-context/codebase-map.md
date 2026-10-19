# Codebase Navigation Map: HMI Certificate System

A quick-reference directory mapping technical responsibilities and project features to their exact file paths.

---

## 1. Project Configuration & Workspace

| Path | Description | Status |
| :--- | :--- | :--- |
| `package.json` | Root workspace package manifest | Implemented |
| `pnpm-workspace.yaml` | Workspace configuration (`apps/*`, `packages/*`) | Implemented |
| `pnpm-lock.yaml` | Dependency lockfile for all packages | Implemented |
| `AGENTS.md` | Primary instruction manual for coding agents | Implemented |

---

## 2. Backend Application (`apps/api`)

| Path | Description | Status |
| :--- | :--- | :--- |
| `apps/api/package.json` | API dependencies and scripts (`dev`, `build`, `test`, `start`, database) | Implemented |
| `apps/api/tsconfig.json` | TypeScript configuration (ESNext, NodeNext, outDir `dist`) | Implemented |
| `apps/api/drizzle.config.ts` | Drizzle Kit config (PostgreSQL, schema `./src/db/schema.ts`, verbose+strict) | Implemented |
| `apps/api/.env` | Environment configuration (`PORT`, `DATABASE_URL`) | Implemented |
| `apps/api/.env.example` | Safe local auth/database configuration template | Implemented |
| `apps/api/src/index.ts` | Server startup and auth/event dependency wiring | Implemented |
| `apps/api/src/app.ts` | Hono app factory, global handlers, health, auth and event routes | Implemented |
| `apps/api/src/config/auth-config.ts` | Validated auth environment configuration | Implemented |
| `apps/api/dist/index.js` | Compiled JavaScript output | Generated |
| `apps/api/src/db/index.ts` | Drizzle DB singleton (pg Pool + schema + relations) | Implemented |
| `apps/api/src/db/schema.ts` | Drizzle Kit entry-point shim (re-exports schema/index.ts) | Implemented |
| `apps/api/src/db/schema/users.ts` | `users` table definition + type exports | Implemented |
| `apps/api/src/db/schema/auth.ts` | Credentials, sessions, one-time tokens, external identity tables | Implemented |
| `apps/api/src/db/schema/participants.ts` | `participants` table definition + type exports | Implemented |
| `apps/api/src/db/schema/events.ts` | `events` table + `event_status` enum | Implemented |
| `apps/api/src/db/schema/event-memberships.ts` | Per-event member/admin role and unique user/event membership | Implemented |
| `apps/api/src/repositories/events/` | Drizzle event and membership persistence | Implemented |
| `apps/api/src/services/events/` | Event access, date validation, create, edit and archive rules | Implemented |
| `apps/api/src/routes/events.ts` | Authenticated event list/detail/create/edit/archive routes | Implemented |
| `apps/api/src/db/schema/event-registrations.ts` | `event_registrations` table + `registration_status` enum | Implemented |
| `apps/api/src/db/schema/certificate-templates.ts` | `certificate_templates` table + page_size/orientation enums | Implemented |
| `apps/api/src/db/schema/certificates.ts` | `certificates` table + `certificate_status` enum | Implemented |
| `apps/api/src/db/schema/certificate-assets.ts` | `certificate_assets` table + `asset_type` enum | Implemented |
| `apps/api/src/db/schema/audit-logs.ts` | `audit_logs` table | Implemented |
| `apps/api/src/db/schema/index.ts` | Barrel re-export of all schema modules | Implemented |
| `apps/api/src/db/relations.ts` | Drizzle ORM query relations (separate from FK constraints) | Implemented |
| `apps/api/drizzle/` | Generated SQL migration files | Implemented |
| `apps/api/src/middleware/auth.ts` | Session authentication and browser Origin guard | Implemented |
| `apps/api/src/middleware/rate-limit.ts` | In-memory sensitive auth endpoint throttling | Implemented |
| `apps/api/src/repositories/auth/drizzle-auth-repository.ts` | Drizzle persistence for auth records | Implemented |
| `apps/api/src/services/auth/` | Provider interface, local Argon2id provider, email adapter | Implemented |
| `apps/api/test/` | Authentication provider and route tests | Implemented |
| `apps/api/drizzle/0001_magical_steve_rogers.sql` | Auth tables and removal of empty legacy credential columns | Implemented |
| `apps/api/drizzle/0002_nasty_anthem.sql` | Event membership, archive field and owner-admin backfill | Implemented |

---

## 3. Frontend Application (`apps/web`)

| Path | Description | Status |
| :--- | :--- | :--- |
| `apps/web/package.json` | Frontend package dependencies & scripts (`dev`, `build`, `lint`) | Implemented |
| `apps/web/vite.config.ts` | Vite bundler config and `/api` development proxy | Implemented |
| `apps/web/tsconfig.json` | Solution tsconfig referencing `tsconfig.app` and `tsconfig.node` | Implemented |
| `apps/web/tsconfig.app.json` | TypeScript configuration for client application code | Implemented |
| `apps/web/tsconfig.node.json` | TypeScript configuration for Vite/node build scripts | Implemented |
| `apps/web/components.json` | Shadcn UI configuration (`base-nova` preset, `@base-ui/react`) | Implemented |
| `apps/web/.oxlintrc.json` | Oxlint linter rules and plugins | Implemented |
| `apps/web/index.html` | HTML container mounting React `#root` | Implemented |
| `apps/web/src/main.tsx` | Frontend entry point mounting `<App />` via `createRoot` | Implemented |
| `apps/web/src/App.tsx` | Auth pages, event routes and protected account route | Implemented |
| `apps/web/src/features/auth/` | Login, signup, password recovery and reset pages with shared layout and design tokens | Implemented |
| `apps/web/src/features/events/events.tsx` | Event list/detail/create/edit views and TanStack Query operations | Implemented |
| `apps/web/src/lib/api-client.ts` | Central client for standard API envelopes and `/api` requests | Implemented |
| `apps/web/src/lib/auth.tsx` | Session restoration and logout provider | Implemented |
| `apps/web/src/index.css` | Global styles, Tailwind v4 imports, Geist font, theme tokens | Implemented |
| `apps/web/src/lib/utils.ts` | Helper function exporting `cn` utility | Implemented |
| `apps/web/src/components/ui/button.tsx` | Shadcn Button primitive with CVA variants | Implemented |
| `apps/web/src/routes/` | Target directory for React Router route components | Planned / Not created |
| `apps/web/src/features/` | Target directory for certificate feature modules | Planned / Not created |

---

## 4. Shared Package (`packages/shared`)

| Path | Description | Status |
| :--- | :--- | :--- |
| `packages/shared/package.json` | Workspace package manifest for `@hmi/shared` | Implemented |
| `packages/shared/src/index.js` | Runtime exports for shared constants and schemas | Implemented |
| `packages/shared/src/constants/events.js` | Event status and membership role values | Implemented |
| `packages/shared/src/schemas/events.js` | Shared Zod event create/update validation | Implemented |
| `packages/shared/src/types/index.d.ts` | Event DTO/input, public user, and response envelope types | Implemented |

---

## 5. Architecture & Context Documentation

| Path | Description | Status |
| :--- | :--- | :--- |
| `docs/architecture/overview.md` | System overview, components, and communication patterns | Implemented |
| `docs/architecture/project-structure.md` | Complete monorepo directory layout and layer guide | Implemented |
| `docs/architecture/database.md` | Database architecture, Neon connection, and Drizzle status | Implemented |
| `docs/architecture/api-contracts.md` | Hono endpoints, verified routes, and planned REST specs | Implemented |
| `docs/architecture/decisions.md` | Architectural Decision Records (ADR-001 through ADR-006) | Implemented |
| `docs/agent-context/codebase-map.md` | Codebase quick-reference directory map (this file) | Implemented |

