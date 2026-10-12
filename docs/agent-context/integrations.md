# External Integrations: HMI Certificate System

## 1. Verified External Integrations

### PostgreSQL Database (Neon Serverless)
- **Service**: Neon Serverless PostgreSQL.
- **Responsibility**: Primary persistent data store for the application, hosting future certificate, event, participant, and user tables.
- **Integration Layer**: Drizzle ORM (`drizzle-orm`) via `pg` client and Drizzle Kit (`drizzle-kit`).
- **Configuration Path**: `apps/api/drizzle.config.ts` and `apps/api/.env`.
- **Environment Variable**: `DATABASE_URL` (connection string with SSL/channel binding parameters).
- **Security Rule**: The database connection string contains credentials and must strictly remain in `apps/api/.env`. It must never be checked into version control or exposed to the frontend bundle.

---

## 2. Unintegrated Services (Current Status)

The following services are commonly used in certificate systems but are **not currently integrated or configured** in this codebase:

| Integration Area | Status | Notes |
| :--- | :--- | :--- |
| **Object / Cloud Storage** | None | No AWS S3, Cloudflare R2, or blob storage SDKs are installed. PDF storage is unconfigured. |
| **Email Delivery** | None | No email client (Resend, SendGrid, Nodemailer) is installed for delivering certificates. |
| **External Auth / OAuth** | None | No third-party authentication services (Clerk, Auth0, Supabase) are configured. |
| **External QR / PDF Services** | None | Generation is intended to be handled locally/in-process once dependencies are added. |
