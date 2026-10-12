# Agent Guidelines & Repository Context: HMI Certificate System

## 1. Project Purpose & Verified Technology Stack

The **HMI Certificate System** is a platform designed for certificate creation, issuance, participant management, public verification, and certificate revocation. The repository is in an early scaffolding stage where core tools and application frameworks have been installed, but domain-specific features are currently planned rather than implemented.

### Verified Technology Stack

| Layer | Technology | Version / Configuration | Notes |
| :--- | :--- | :--- | :--- |
| **Workspace** | pnpm Monorepo | `pnpm@12.11.2` (`pnpm-workspace.yaml`) | Monorepo managing `apps/*` and `packages/*` |
| **Backend API** | Hono | `hono@^4.13.13`, `@hono/node-server@^2.1.3` | Runs on Node.js; TypeScript with `tsx` watch mode |
| **Database / ORM** | Drizzle ORM & PostgreSQL | `drizzle-orm@^0.45.4`, `pg@^8.23.1`, `drizzle-kit@^0.31.11` | Configured for PostgreSQL (`DATABASE_URL`), schema uncreated |
| **Frontend SPA** | React + Vite | `react@^19.2.8`, `vite@^8.3.0`, TypeScript | Single-page application configured with path alias `@/*` |
| **Styling & UI** | Tailwind CSS v4 & Shadcn | `tailwindcss@^4.3.3`, `@base-ui/react@^1.9.0` | Uses `@tailwindcss/vite`, Nova style preset, Geist font |
| **Linting** | Oxlint | `oxlint@^1.81.0` | Configured in `apps/web/.oxlintrc.json` |
| **Validation** | Zod | `zod@^4.6.6` | Installed in both `apps/api` and `apps/web` |
| **Routing & Query** | React Router & React Query | `react-router-dom@^7.18.4`, `@tanstack/react-query@^5.104.1` | Installed in `apps/web`, not yet wired into App |

---

## 2. Repository Structure

```
hmi_certificate_system/
├── AGENTS.md                  # This file: primary instructions for AI coding agents
├── package.json               # Root monorepo manifest
├── pnpm-workspace.yaml        # Workspace definition (apps/*, packages/*)
├── pnpm-lock.yaml             # Workspace lockfile
├── apps/
│   ├── api/                   # Backend application
│   │   ├── package.json       # API dependencies & scripts
│   │   ├── tsconfig.json      # NodeNext TypeScript configuration
│   │   ├── drizzle.config.ts  # Drizzle kit configuration (PostgreSQL)
│   │   ├── .env               # Environment configuration (PORT, DATABASE_URL)
│   │   ├── src/
│   │   │   └── index.ts       # Hono API entry point (minimal starter endpoint)
│   │   └── dist/
│   │       └── index.js       # Compiled JavaScript output
│   └── web/                   # Frontend SPA application
│       ├── package.json       # Frontend dependencies & scripts
│       ├── vite.config.ts     # Vite bundler configuration (@/ path alias)
│       ├── tsconfig.json      # Project references (app & node)
│       ├── tsconfig.app.json  # Application TypeScript configuration
│       ├── tsconfig.node.json # Bundler TypeScript configuration
│       ├── components.json    # Shadcn UI configuration (base-nova preset)
│       ├── .oxlintrc.json     # Oxlint linter configuration
│       ├── index.html         # HTML entry point
│       └── src/
│           ├── main.tsx       # React entry point
│           ├── App.tsx        # Starter UI component (counter demo)
│           ├── index.css      # Design tokens, Tailwind v4 imports, theme
│           ├── components/ui/ # Reusable UI components (button.tsx)
│           └── lib/utils.ts   # Helper utilities (cn export)
├── packages/
│   └── shared/                # Intended for shared types/schemas (empty directory)
└── docs/                      # Architectural documentation & agent context maps
    ├── architecture/          # Overview, database, API contracts, ADRs
    └── agent-context/         # Feature maps, codebase maps, workflow docs
```

---

## 3. Targeted Code Exploration Workflow

Agents MUST NOT perform unguided, repository-wide searches. Instead, follow this structured 10-step workflow for all tasks:

1. **Read `AGENTS.md`**: Understand verified project boundaries and execution rules.
2. **Read `docs/agent-context/codebase-map.md`**: Locate the files responsible for the relevant area.
3. **Identify the affected layer**: Determine if the task touches backend (`apps/api`), frontend (`apps/web`), shared contracts (`packages/shared`), or database schema.
4. **Read relevant context documents**: Consult specific docs (e.g., `docs/agent-context/frontend-map.md` or `docs/agent-context/backend-map.md`) before viewing code.
5. **Inspect target implementation files**: Read only the relevant files and their direct imports.
6. **Expand investigation only as needed**: Trace dependencies only when necessary to understand contracts, types, or data flow.
7. **Make changes strictly within authorized scope**: Adhere strictly to the requested feature or fix without modifying unrelated code.
8. **Update documentation**: When making meaningful structural or behavioral changes, update the corresponding markdown context files.
9. **Run validation checks**: Execute existing lint, typecheck, or build commands relevant to the modified package.
10. **Report outcome**: Provide a clear summary of modified files, verification checks executed, and any remaining questions or risks.

---

## 4. Architectural Boundaries & Verified Invariants

### Current Implementation State vs. Planned Features
- **Backend**: Only `GET /` returning `"Hello Hono!"` is currently implemented in `apps/api/src/index.ts`. Database connection is configured in `drizzle.config.ts`, but no schema or tables exist yet.
- **Frontend**: The UI in `apps/web/src/App.tsx` is currently the starter Vite counter template. React Router and TanStack Query are installed as dependencies but not yet initialized.
- **Shared Package**: `packages/shared` is currently an empty directory with no package manifest or shared code.
- **Certificate Lifecycle**: Features such as certificate generation, PDF/QR code rendering, public verification, and revocation are planned domain features that have not yet been built.

### Invariants & Guardrails
- **Environment & Secrets**: Never log, hardcode, or commit secret keys or connection credentials. Backend accesses environment variables via `process.env`.
- **Package Isolation**: Run package-specific commands using `pnpm --filter <package>` or within the package directory. Do not run commands that cross package boundaries unexpectedly.
- **Database Authority**: Once the certificate schema is implemented, the database is the authoritative source for certificate validity. Verification must always check database status (e.g., revoked flags), not client-supplied assertions.

---

## 5. Development, Validation & Build Commands

All commands use `pnpm` from the repository root:

### Workspace Root
```bash
# Workspace status / test placeholder
pnpm test
```

### Backend (`apps/api`)
```bash
# Start development server with hot-reload (tsx watch)
pnpm --filter api dev

# Typecheck / build backend to dist/
pnpm --filter api build

# Run compiled backend server
pnpm --filter api start
```

### Frontend (`apps/web`)
```bash
# Start Vite development server
pnpm --filter web dev

# Run TypeScript checks and Vite production build
pnpm --filter web build

# Run Oxlint linter
pnpm --filter web lint

# Preview production build locally
pnpm --filter web preview
```

---

## 6. Context Maintenance & Documentation Map

When modifying or expanding the codebase, consult and update the following context documents:

- **System Architecture**: `docs/architecture/overview.md`
- **Database Schema & Migrations**: `docs/architecture/database.md`
- **API Endpoints & Contracts**: `docs/architecture/api-contracts.md`
- **Architectural Decisions**: `docs/architecture/decisions.md`
- **Codebase Navigation Index**: `docs/agent-context/codebase-map.md`
- **Frontend Organization**: `docs/agent-context/frontend-map.md`
- **Backend Organization**: `docs/agent-context/backend-map.md`
- **Certificate Workflow**: `docs/agent-context/certificate-workflow.md`
- **External Integrations**: `docs/agent-context/integrations.md`
