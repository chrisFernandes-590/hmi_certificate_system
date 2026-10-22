# HMI Certificate System — Mobile App

React Native (Expo SDK 58, Expo Router, TypeScript) client for the existing Hono API.
It talks to the API only; it does not duplicate business logic, and the backend enforces
all authorization (event admin, certificate ownership).

## Prerequisites

- Node.js 20+ and the repo's pnpm (`packageManager` in the root `package.json`)
- Android Studio emulator **or** a physical Android phone with Expo Go / a dev build
- The API running with a PostgreSQL database (see `apps/api/.env.example`)

## Setup

```bash
# from the repo root – installs the whole workspace (updates pnpm-lock.yaml for apps/mobile)
pnpm install

cp apps/mobile/.env.example apps/mobile/.env   # then edit the URL, see below
```

## Run

```bash
# Terminal 1 – API (listens on PORT, default 3000)
pnpm --filter api dev

# Terminal 2 – mobile
pnpm --filter @hmi/mobile start        # press "a" for Android
# or: pnpm --filter @hmi/mobile android
```

## API URL (`EXPO_PUBLIC_API_BASE_URL`)

Set the API **origin** only — the client appends `/api` itself.

| Where the app runs | Value |
| --- | --- |
| Android emulator | `http://10.0.2.2:3000` (emulator alias for your PC's `localhost`) |
| Physical Android phone | `http://<PC-LAN-IP>:3000` e.g. `http://192.168.1.10:3000` |
| iOS simulator | `http://localhost:3000` |
| Deployed | `https://your-api-domain` |

On a physical device `localhost`/`10.0.2.2` point at the phone itself, so use your PC's LAN IP
(`ipconfig` on Windows → IPv4 Address). The phone and PC must be on the same Wi-Fi, and Windows
Firewall must allow inbound TCP on the API port. Restart `expo start` (use `-c`) after changing `.env`.

Only non-secret values belong in `EXPO_PUBLIC_*` variables — they are embedded in the app bundle.

## Auth

Login sends `X-Auth-Client: native`; the API returns an access token that is stored in
Expo SecureStore and sent as `Authorization: Bearer …`. On start the app restores the session via
`GET /api/auth/me`. A `401` on an authenticated request clears the stored token and returns to sign-in.
The API's CSRF middleware skips native-client requests, so no `Origin` header is needed
(do not weaken it — the check is deliberately bypassed only for `X-Auth-Client: native`).

## Checks

```bash
pnpm --filter @hmi/mobile typecheck
pnpm --filter @hmi/mobile export        # Android production bundle (outputs ./dist, git-ignored)
pnpm --filter api test
pnpm --filter web build
```

## Screens

Auth (login, register, verify email, forgot/reset password) · Dashboard · Events (search, pagination,
detail, register/cancel, create/edit/archive for admins) · My Events · Participants & attendance ·
Event certificates (search, issue single/bulk with per-recipient results, revoke with reason) ·
My Certificates (search, detail, PDF download/share) · Public verification (`/verify`) · Profile / sign out.

## Troubleshooting

- **"Cannot reach the server"** — wrong `EXPO_PUBLIC_API_BASE_URL`, API not running, firewall, or phone on a different network.
- **Cleartext HTTP blocked** (standalone/dev builds, not Expo Go) — use HTTPS, or enable cleartext traffic for development builds via `expo-build-properties`.
- **Cannot verify email / reset password in development** — set `DEV_EMAIL_ENABLED=true` with `NODE_ENV=development` in `apps/api/.env`; the API prints the links/tokens to its console. Enter the token on the verify/reset screen.
- **Certificate PDFs fail** — the API needs S3 configured (`AWS_REGION`, `CERTIFICATE_S3_BUCKET`, …). See `docs/architecture/api-contracts.md`.
- **Stale bundle / odd module errors** — `pnpm --filter @hmi/mobile start -c`.
- **TypeScript says `--jsx` is not set** — dependencies aren't installed/linked (`expo/tsconfig.base` unresolved). Run `pnpm install` at the repo root and restart the TS server.
