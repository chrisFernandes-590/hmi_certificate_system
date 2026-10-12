# System Architecture Overview: HMI Certificate System

## 1. System Summary

The **HMI Certificate System** is structured as a TypeScript monorepo using `pnpm` workspaces. It consists of two primary application packages:
- `apps/api`: A backend REST API server built with Hono and running on Node.js.
- `apps/web`: A frontend Single Page Application (SPA) built with React 19, Vite, and Tailwind CSS v4.

An additional workspace directory, `packages/shared`, exists for shared domain types and validation schemas across frontend and backend, but currently contains no files.

```mermaid
graph TD
    User["Client Browser"]
    Web["Frontend SPA (apps/web)<br/>React 19 + Vite + Tailwind v4"]
    API["Backend API (apps/api)<br/>Hono on Node.js (:3000)"]
    DB[("PostgreSQL Database<br/>Neon Serverless")]
    Shared["packages/shared<br/>(Planned Shared Types)"]

    User -->|HTTP / HTML / JS| Web
    Web -.->|HTTP / REST (Planned)| API
    API -->|pg / Drizzle ORM (Planned)| DB
    Web -.->|Imports| Shared
    API -.->|Imports| Shared
```

---

## 2. Actual Application Components

### A. Backend Application (`apps/api`)
- **Runtime Environment**: Node.js with native ES Modules (`"type": "module"`).
- **HTTP Framework**: [Hono](https://hono.dev/) (`hono@^4.13.13`) with `@hono/node-server` (`^2.1.3`).
- **Entry Point**: `apps/api/src/index.ts`.
- **Current State**: A basic HTTP server listening on port 3000 with a single health route (`GET /` responding with `"Hello Hono!"`).
- **Data Layer Config**: `apps/api/drizzle.config.ts` targets PostgreSQL via Drizzle Kit. Database schema file (`src/db/schema.ts`) is referenced in config but not yet created on disk.

### B. Frontend Application (`apps/web`)
- **Runtime & Bundler**: [Vite](https://vite.dev/) (`vite@^8.3.0`) with `@vitejs/plugin-react` (`^6.1.1`).
- **UI Framework**: React 19 (`react@^19.2.8`, `react-dom@^19.2.8`).
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite@^4.3.3`, `tailwindcss@^4.3.3`) and `tw-animate-css`.
- **Design System & Components**: Shadcn configuration (`components.json`) using the Nova style preset and `@base-ui/react` primitives.
- **Entry Point**: `apps/web/index.html` mounting `apps/web/src/main.tsx`.
- **Current State**: Displays the default starter Vite/React counter template in `apps/web/src/App.tsx`. Includes one generated Shadcn UI component (`apps/web/src/components/ui/button.tsx`) and CSS theme variables in `apps/web/src/index.css`.

### C. Shared Package (`packages/shared`)
- **Directory**: `packages/shared`.
- **Current State**: Empty folder. A `package.json` manifest and shared TypeScript definitions (such as Zod schemas and certificate DTOs) are planned but not yet implemented.

---

## 3. Communication Patterns

### Frontend to Backend
- **Planned Pattern**: The frontend will communicate with the backend over HTTP/REST JSON endpoints using `@tanstack/react-query` and fetch/client utilities.
- **Current Pattern**: No frontend-to-backend communication is currently implemented. The frontend starter app (`App.tsx`) and backend API (`index.ts`) operate independently.

### Backend to Database
- **Planned Pattern**: Database access will use Drizzle ORM queries and migrations over PostgreSQL.
- **Current Pattern**: Drizzle is configured in `apps/api/drizzle.config.ts` reading `DATABASE_URL` from `apps/api/.env`. However, no schema or migration files exist, and no database connection is initialized at runtime in `apps/api/src/index.ts`.

---

## 4. Architectural Boundaries

1. **Frontend Isolation**: The frontend in `apps/web` must not have direct database access or require backend Node.js modules. It interacts strictly via HTTP APIs.
2. **Backend Domain Isolation**: The backend API in `apps/api` owns data persistence, business invariants, authorization, and certificate signing/issuance logic.
3. **Shared Contracts**: When domain types and validation schemas are extracted, they should reside in `packages/shared` so both frontend form validation and backend request validation stay strictly in sync.
4. **Environment Variables**: Sensitive configuration (`DATABASE_URL`, future JWT secrets) remains confined to `apps/api/.env` and must never be exposed to the client bundle.

---

## 5. Verified Source File References

| Component | Responsibility | Verified Path |
| :--- | :--- | :--- |
| Monorepo Config | Workspace packages declaration | `pnpm-workspace.yaml` |
| Root Manifest | Project metadata and package manager definition | `package.json` |
| Backend Entry | HTTP server instantiation and route registration | `apps/api/src/index.ts` |
| Backend Config | Drizzle ORM PostgreSQL configuration | `apps/api/drizzle.config.ts` |
| Frontend HTML | HTML shell mounting `#root` | `apps/web/index.html` |
| Frontend Entry | React DOM root mounting `App` | `apps/web/src/main.tsx` |
| Frontend App | Root UI component (starter counter) | `apps/web/src/App.tsx` |
| Styling Tokens | Global styles, Tailwind v4 imports, theme OKLCH variables | `apps/web/src/index.css` |
| UI Component | Shadcn Button primitive | `apps/web/src/components/ui/button.tsx` |
| UI Utility | Classnames merger (`cn`) | `apps/web/src/lib/utils.ts` |
