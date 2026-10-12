# Database Architecture & Schema Status: HMI Certificate System

## 1. Current Implementation State

> [!IMPORTANT]
> **No database tables, migrations, or schema definitions are currently implemented in the codebase.**
> Drizzle Kit configuration exists, but the schema file and migrations directory have not yet been created.

### Verified Database Configuration

- **ORM**: Drizzle ORM (`drizzle-orm@^0.45.4`) with Drizzle Kit (`drizzle-kit@^0.31.11`).
- **Database Engine**: PostgreSQL via `pg` (`pg@^8.23.1`).
- **Provider**: Neon Serverless PostgreSQL (indicated by connection endpoint in `apps/api/.env`).
- **Configuration File**: `apps/api/drizzle.config.ts`.

```typescript
// Verified content of apps/api/drizzle.config.ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### File Locations (Configured vs. Actual)

| File / Directory | Configured Purpose | Current Existence Status |
| :--- | :--- | :--- |
| `apps/api/src/db/schema.ts` | Drizzle ORM table and relation definitions | **Missing / Planned** (directory `src/db/` does not exist) |
| `apps/api/drizzle/` | Generated SQL migration files | **Missing / Planned** (directory does not exist) |
| `apps/api/drizzle.config.ts` | Drizzle Kit CLI configuration | **Verified / Implemented** |
| `apps/api/.env` | Environment configuration (`DATABASE_URL`) | **Verified / Implemented** |

---

## 2. Existing Tables & Schema

- **Tables**: `None`
- **Relationships / Foreign Keys**: `None`
- **Unique Constraints**: `None`
- **Indexes**: `None`

---

## 3. Planned Domain Entities & Data Integrity Guidelines

When implementing the database schema in `apps/api/src/db/schema.ts`, the following domain requirements and integrity rules apply:

### Anticipated Entities
1. **Certificates**:
   - Unique certificate number / verification code.
   - Associated participant and event identifiers.
   - Status tracking (`issued`, `revoked`, `pending`).
   - Issuance date and optional expiry date.
   - Revocation metadata (timestamp, reason, revoking authority).
2. **Participants**:
   - Recipient name, email, and identification details.
3. **Events / Programs**:
   - Event title, description, date range, and organization/issuer.
4. **Templates / Layouts (Optional/Planned)**:
   - Certificate template metadata, signature assets, and design references.

### Required Data Integrity Rules
- **Unique Constraints**: Certificate numbers/hashes must have a strict `UNIQUE` constraint to guarantee that duplicate numbers cannot be issued.
- **Foreign Key Constraints**: Certificate records must enforce foreign key integrity against participant and event tables, with appropriate `ON DELETE` rules (e.g., `RESTRICT` to prevent accidental deletion of audited records).
- **Audit Fields**: All tables should record timestamps (`created_at`, `updated_at`).
- **Revocation Immutability**: Revocation should preserve history and not destroy historical certificate records.
