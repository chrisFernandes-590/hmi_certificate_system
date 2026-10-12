# Architectural Decision Records (ADRs): HMI Certificate System

This document captures architectural and technology decisions established in the existing repository configuration and dependencies.

---

### ADR-001: pnpm Workspaces Monorepo Structure

- **Decision**: Organize the project as a pnpm monorepo with workspace packages partitioned under `apps/*` and `packages/*`.
- **Reason**: Allows co-locating the backend API (`apps/api`), frontend SPA (`apps/web`), and shared contracts (`packages/shared`) in a single repository while sharing tooling and ensuring strict package boundaries.
- **Relevant Files**:
  - `pnpm-workspace.yaml`
  - `package.json`
  - `apps/api/package.json`
  - `apps/web/package.json`
- **Known Trade-offs**: Requires using scoped filter flags (e.g. `pnpm --filter <app> <cmd>`) or navigating to app subdirectories to run commands.

---

### ADR-002: Hono on Node.js for Backend API

- **Decision**: Use the Hono framework with `@hono/node-server` for the backend REST API.
- **Reason**: Hono provides a lightweight, standard-compliant HTTP interface (Web Fetch API standards), fast routing, and first-class TypeScript inference with minimal overhead.
- **Relevant Files**:
  - `apps/api/package.json`
  - `apps/api/src/index.ts`
  - `apps/api/tsconfig.json`
- **Known Trade-offs**: Smaller legacy middleware ecosystem compared to Express, but superior performance and modern API ergonomics.

---

### ADR-003: Drizzle ORM with PostgreSQL for Data Layer

- **Decision**: Adopt Drizzle ORM (`drizzle-orm`, `drizzle-kit`) with PostgreSQL (`pg` driver) for schema definitions and migrations.
- **Reason**: Drizzle provides compile-time TypeScript type safety that matches SQL semantics closely without heavy runtime overhead or binary query engines. Configured to connect to Neon PostgreSQL via `DATABASE_URL`.
- **Relevant Files**:
  - `apps/api/drizzle.config.ts`
  - `apps/api/package.json`
  - `apps/api/.env`
- **Known Trade-offs**: The schema file (`apps/api/src/db/schema.ts`) and migrations directory must be explicitly generated and maintained. Currently uncreated.

---

### ADR-004: Vite + React 19 for Frontend SPA

- **Decision**: Build the web interface using Vite and React 19.
- **Reason**: Vite delivers instant server start, fast HMR, and streamlined ES module bundling. React 19 provides the latest UI rendering capabilities.
- **Relevant Files**:
  - `apps/web/vite.config.ts`
  - `apps/web/package.json`
  - `apps/web/src/main.tsx`
- **Known Trade-offs**: Client-side rendering requires managing routing (`react-router-dom`) and data caching (`@tanstack/react-query`) on the client.

---

### ADR-005: Tailwind CSS v4 & Shadcn (Base UI) for Design System

- **Decision**: Use Tailwind CSS v4 (`@tailwindcss/vite`) combined with Shadcn UI configured with the Nova preset and `@base-ui/react` primitives.
- **Reason**: Tailwind CSS v4 uses a modern CSS-first architecture (`@theme inline`, OKLCH color spaces) without requiring a `tailwind.config.js`. Base UI provides accessible, unstyled primitives.
- **Relevant Files**:
  - `apps/web/src/index.css`
  - `apps/web/components.json`
  - `apps/web/vite.config.ts`
  - `apps/web/src/components/ui/button.tsx`
  - `apps/web/src/lib/utils.ts`
- **Known Trade-offs**: Tailwind v4 configuration differs from v3; custom theme tokens are defined directly in CSS using `@theme inline`.

---

### ADR-006: Oxlint for Fast Frontend Linting

- **Decision**: Use Oxlint (`oxlint@^1.81.0`) for code quality checks in `apps/web`.
- **Reason**: Oxlint is a high-speed, Rust-based JavaScript/TypeScript linter with built-in React rules.
- **Relevant Files**:
  - `apps/web/.oxlintrc.json`
  - `apps/web/package.json`
- **Known Trade-offs**: Fast execution speed, but advanced type-aware rules require additional configuration and plugins.
