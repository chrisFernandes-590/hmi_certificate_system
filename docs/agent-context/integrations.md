# External Integrations: HMI Certificate System

## 1. Verified External Integrations

### PostgreSQL Database (Neon Serverless)
- **Service**: Neon Serverless PostgreSQL.
- **Responsibility**: Primary persistent data store for the application, hosting future certificate, event, participant, and user tables.
- **Integration Layer**: Drizzle ORM (`drizzle-orm`) via `pg` client and Drizzle Kit (`drizzle-kit`).
- **Configuration Path**: `apps/api/drizzle.config.ts` and `apps/api/.env`.
- **Environment Variable**: `DATABASE_URL` (connection string with SSL/channel binding parameters).
- **Security Rule**: The database connection string contains credentials and must strictly remain in `apps/api/.env`. It must never be checked into version control or exposed to the frontend bundle.

### Local Authentication and Email
- **Identity**: Email/password authentication is behind `AuthProvider`; immutable `users.id` UUIDs remain the application identity.
- **Passwords and sessions**: Argon2id hashes credentials. Only SHA-256 hashes of random session and one-time email tokens are stored.
- **Email**: `EmailProvider` separates delivery from auth services. `DEV_EMAIL_ENABLED=true` enables console links in development only. A production mail provider remains to be implemented, and production startup refuses until configured.
- **Web sessions**: HttpOnly SameSite cookies; browser write requests require the configured frontend Origin. Native clients use explicit bearer mode and should keep tokens in Expo SecureStore.

---

## 2. Planned Target AWS Architecture & External Integrations

Per `AGENTS.md` (Sections 2, 8, 9, 10), the target deployment environment is AWS conforming to faculty cloud architecture guidelines. These services are implemented iteratively as tasks demand, not prematurely:

| Service | Target Architecture Role | Current Status | Notes & Constraints |
| :--- | :--- | :--- | :--- |
| **Compute (EC2 / VPC)** | Main application & Hono backend | Planned (Node.js local) | Main app runs on EC2 or equivalent cloud compute within a custom VPC (public/private subnets, security groups, IGW). Do not replace with an entirely serverless architecture. |
| **Database (Amazon RDS)** | Production PostgreSQL database | Dev (Neon PostgreSQL) | Target is Amazon RDS for PostgreSQL located in a private subnet, accessible only by the application security group. |
| **Storage (Amazon S3)** | Private certificate file storage | Planned (Local / Mock) | Buckets are private. No public object URLs; files accessed via backend authorization and short-lived presigned URLs. IAM roles used on EC2 (no hardcoded keys). |
| **Identity (Amazon Cognito)** | Production user authentication & User Pools | Dev (Local email/password) | Target production IdP. Backend validates Cognito tokens and maps verified subject to internal application user UUIDs. |
| **Secrets & Config (SSM)** | Secrets & parameter management | Dev (`.env` files) | Target is AWS Systems Manager Parameter Store or Secrets Manager. Server secrets must never be exposed to frontend bundles (`VITE_`). |
| **Monitoring (CloudWatch)** | Application logs, metrics & alarms | Planned | Structured application logging and meaningful operational alerts. |
| **Cost Alerts (AWS Budgets)**| Budget threshold monitoring | Planned | Cost guardrails to prevent unexpected AWS cloud charges. |
| **IaC (CloudFormation)** | Infrastructure as code | Planned | Infrastructure must ultimately be reproducible via CloudFormation templates. |
| **Notifications (SNS)** | Operational notifications | Planned | Meaningful alerts for operational events. |

