# Database Architecture & Schema Status: HMI Certificate System

## 1. Current Implementation State

> [!NOTE]
> **Schema fully implemented.** All 8 domain tables, 6 PostgreSQL enums, check constraints, foreign keys, indexes, and Drizzle query relations have been defined and a migration file has been generated.

### Verified Database Configuration

- **ORM**: Drizzle ORM (`drizzle-orm@^0.45.4`) with Drizzle Kit (`drizzle-kit@^0.31.11`).
- **Database Engine**: PostgreSQL via `pg` (`pg@^8.23.1`).
- **Provider**: Neon Serverless PostgreSQL (connection endpoint in `apps/api/.env`).
- **Configuration File**: `apps/api/drizzle.config.ts` — `verbose: true`, `strict: true`.
- **Schema Entry-Point**: `apps/api/src/db/schema.ts` (shim re-exporting `src/db/schema/index.ts`).
- **DB Connection Module**: `apps/api/src/db/index.ts` — pg Pool + Drizzle instance with schema and relations.

### File Locations

| File / Directory | Purpose | Status |
| :--- | :--- | :--- |
| `apps/api/src/db/schema.ts` | Drizzle Kit entry-point shim | **Implemented** |
| `apps/api/src/db/schema/` | Modular per-table schema files | **Implemented** |
| `apps/api/src/db/relations.ts` | Drizzle ORM query relations | **Implemented** |
| `apps/api/src/db/index.ts` | pg Pool + Drizzle db singleton | **Implemented** |
| `apps/api/drizzle/` | Generated SQL migration files | **Implemented** |
| `apps/api/drizzle.config.ts` | Drizzle Kit CLI configuration | **Implemented** |
| `apps/api/.env` | Environment configuration (`DATABASE_URL`) | **Implemented** |

---

## 2. Implemented Tables & Schema

### Tables

| Table | PK | Notable Constraints | Indexes |
| :--- | :--- | :--- | :--- |
| `users` | uuid | `email` UNIQUE | — |
| `participants` | uuid | `user_id` UNIQUE, age CHECK (0–150) | — |
| `events` | uuid | end_date >= start_date CHECK | — |
| `event_registrations` | uuid | UNIQUE(event_id, participant_id) | event_id, participant_id (+ unique) |
| `certificate_templates` | uuid | layout_config JSONB NOT NULL | — |
| `certificates` | uuid | certificate_number UNIQUE, verification_token UNIQUE | (event_id, status), (participant_id, issued_at) |
| `certificate_assets` | uuid | file_size_bytes > 0 CHECK | — |
| `audit_logs` | uuid | entity_id typed uuid | (entity_type, entity_id, created_at) |

### PostgreSQL Enums

| Enum | Values |
| :--- | :--- |
| `event_status` | `draft`, `published`, `completed`, `cancelled` |
| `registration_status` | `registered`, `attended`, `absent`, `cancelled` |
| `certificate_status` | `draft`, `issued`, `revoked` |
| `page_size` | `A4`, `Letter` |
| `orientation` | `landscape`, `portrait` |
| `asset_type` | `pdf`, `preview_image` |

### Foreign Key `ON DELETE` Policy

| FK | Policy | Rationale |
| :--- | :--- | :--- |
| `participants.user_id → users.id` | CASCADE | Participant profile follows account deletion |
| `events.owner_id → users.id` | RESTRICT | Prevent orphaned events |
| `event_registrations.event_id/participant_id` | RESTRICT | Preserve registration history |
| `certificate_templates.owner_id → users.id` | RESTRICT | Templates belong to an owner |
| `certificates.participant_id / event_id / issuer_id` | RESTRICT | Preserve issued certificate history |
| `certificates.template_id` | SET NULL | Templates can be retired without invalidating certificates |
| `certificate_assets.certificate_id` | RESTRICT | Clean storage before deleting certificate |
| `audit_logs.actor_user_id` | SET NULL | Preserve audit trail even if actor account is removed |

---

## 3. Migration

- **File**: `apps/api/drizzle/0000_curved_tyger_tiger.sql`
- **Generated**: Drizzle Kit `generate` — no tables applied to production yet.
- **TypeScript check**: `pnpm --filter api build` exits 0 (no errors).

### Commands

```bash
# Generate a new migration from schema changes
pnpm --filter api drizzle-kit generate

# Inspect pending migration (preview only)
pnpm --filter api drizzle-kit migrate --dry-run

# Apply migrations to the target database
pnpm --filter api drizzle-kit migrate
```

> [!WARNING]
> Do NOT run `drizzle-kit migrate` against the production Neon database without a backup and review of the generated SQL.

---

## 4. Application-Layer Validation Required

The following invariants cannot be fully enforced at the DB layer alone:

| Rule | Where to enforce |
| :--- | :--- |
| `certificate_status` state machine (draft→issued→revoked only) | Service layer before DB write |
| `layout_config` JSONB structure | Zod schema validation in API route handler |
| Duplicate certificate issuance (same participant + event) | Service layer query before `INSERT` |
| Age sensibility beyond 0–150 range | Zod schema + form validation |
| `issued_at` must be set when status transitions to `issued` | Service layer |
| `revoked_at` + `revoked_reason` required on revocation | Service layer |
