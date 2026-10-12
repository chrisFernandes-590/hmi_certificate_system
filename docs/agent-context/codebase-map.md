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
| `apps/api/package.json` | API package dependencies, scripts (`dev`, `build`, `start`) | Implemented |
| `apps/api/tsconfig.json` | TypeScript configuration (ESNext, NodeNext, outDir `dist`) | Implemented |
| `apps/api/drizzle.config.ts` | Drizzle Kit config (PostgreSQL, schema `./src/db/schema.ts`) | Implemented |
| `apps/api/.env` | Environment configuration (`PORT`, `DATABASE_URL`) | Implemented |
| `apps/api/src/index.ts` | Backend entry point; Hono server initialization & routes | Implemented |
| `apps/api/dist/index.js` | Compiled JavaScript output | Generated |
| `apps/api/src/db/schema.ts` | Target path for Drizzle ORM database tables & relations | Planned / Not created |
| `apps/api/drizzle/` | Target directory for generated SQL migrations | Planned / Not created |
| `apps/api/src/routes/` | Target directory for modular Hono route handlers | Planned / Not created |
| `apps/api/src/services/` | Target directory for domain business logic (certificates) | Planned / Not created |

---

## 3. Frontend Application (`apps/web`)

| Path | Description | Status |
| :--- | :--- | :--- |
| `apps/web/package.json` | Frontend package dependencies & scripts (`dev`, `build`, `lint`) | Implemented |
| `apps/web/vite.config.ts` | Vite bundler config with React, Tailwind v4, `@/` alias | Implemented |
| `apps/web/tsconfig.json` | Solution tsconfig referencing `tsconfig.app` and `tsconfig.node` | Implemented |
| `apps/web/tsconfig.app.json` | TypeScript configuration for client application code | Implemented |
| `apps/web/tsconfig.node.json` | TypeScript configuration for Vite/node build scripts | Implemented |
| `apps/web/components.json` | Shadcn UI configuration (`base-nova` preset, `@base-ui/react`) | Implemented |
| `apps/web/.oxlintrc.json` | Oxlint linter rules and plugins | Implemented |
| `apps/web/index.html` | HTML container mounting React `#root` | Implemented |
| `apps/web/src/main.tsx` | Frontend entry point mounting `<App />` via `createRoot` | Implemented |
| `apps/web/src/App.tsx` | Root UI component (starter counter template) | Implemented |
| `apps/web/src/App.css` | Starter template CSS styles | Implemented |
| `apps/web/src/index.css` | Global styles, Tailwind v4 imports, Geist font, theme tokens | Implemented |
| `apps/web/src/lib/utils.ts` | Helper function exporting `cn` utility | Implemented |
| `apps/web/src/components/ui/button.tsx` | Shadcn Button primitive with CVA variants | Implemented |
| `apps/web/src/routes/` | Target directory for React Router route components | Planned / Not created |
| `apps/web/src/features/` | Target directory for certificate feature modules | Planned / Not created |

---

## 4. Shared Package (`packages/shared`)

| Path | Description | Status |
| :--- | :--- | :--- |
| `packages/shared/` | Workspace directory for cross-cutting types & schemas | Directory exists, empty |
| `packages/shared/package.json` | Target package manifest for shared code | Planned / Not created |
| `packages/shared/src/index.ts` | Target barrel export for shared DTOs & Zod schemas | Planned / Not created |
