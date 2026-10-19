# Frontend Architecture Map (`apps/web`): HMI Certificate System

## 1. Application Overview

The frontend is a Single-Page Application (SPA) built with React 19, TypeScript, Vite, and Tailwind CSS v4. It is housed in `apps/web`.

- **Entry Point**: `apps/web/index.html` loads `apps/web/src/main.tsx`.
- **Mounting**: `main.tsx` mounts `<App />` into `document.getElementById('root')` wrapped in `<StrictMode>`.

---

## 2. Component Organization & Current UI State

```
apps/web/src/
├── main.tsx              # Application bootstrap
├── App.tsx               # Auth routes, forms, verification, protected account page
├── App.css               # Authentication layout styles
├── index.css             # Tailwind v4 directives, design tokens, theme variables
├── assets/               # Static image assets (hero.png, react.svg, vite.svg)
├── components/
│   └── ui/
│       └── button.tsx    # Shadcn Button component built on @base-ui/react
└── lib/
    ├── api-client.ts      # Standardized envelope client
    ├── auth.tsx           # Session context provider
    ├── auth-context.ts    # Shared auth context type/value
    ├── use-auth.ts        # Auth context hook
    └── utils.ts           # Utility functions (cn helper)
```

### Current View (`src/App.tsx`)
Implements registration, login, email verification, recovery/reset, session restoration, logout, a protected account view, and protected event list/detail/create/edit pages. Participant and certificate workflows remain unimplemented.

---

## 3. UI Component System & Styling

### Design Tokens & Theme (`src/index.css`)
- **Engine**: Tailwind CSS v4 loaded via `@import "tailwindcss";` and `@tailwindcss/vite`.
- **Typography**: Geist font family loaded via `@import "@fontsource-variable/geist";`.
- **Color System**: Theme tokens defined in OKLCH color space with full light and dark mode mappings (`@custom-variant dark (&:is(.dark *));`).
- **Animations**: `tw-animate-css` imported for micro-interactions.

### Reusable Components (`src/components/ui/`)
- **`button.tsx`**: Uses `@base-ui/react/button` and `class-variance-authority` (`cva`).
  - **Variants**: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`.
  - **Sizes**: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`.
  - **Utility**: Merges Tailwind classes via `cn` from `src/lib/utils.ts`.

---

## 4. Routing, State & Data Fetching Status

| Capability | Installed Dependency | Current Implementation Status |
| :--- | :--- | :--- |
| **Routing** | `react-router-dom@^7.18.4` | Wired for auth pages plus protected account and event routes. |
| **Server State / API Caching** | `@tanstack/react-query@^5.104.1` | Wired in `main.tsx`; event queries and mutations invalidate the event cache. |
| **Form Management** | `react-hook-form@^7.90.0`, `@hookform/resolvers@^5.9.1` | **Not wired**: No form components or form hooks exist. |
| **Client Validation** | Zod 4 via `@hmi/shared` | Auth forms and event create/edit forms use the same schemas as API routes. |
| **Auth State** | React context | Session restored through `/api/auth/me`; token stays in an HttpOnly cookie. |

---

## 5. Development & Build Commands

Run commands from the repository root:

```bash
# Start Vite development server
pnpm --filter web dev

# Run TypeScript compilation and Vite production bundle
pnpm --filter web build

# Run Oxlint
pnpm --filter web lint

# Preview production build
pnpm --filter web preview
```
