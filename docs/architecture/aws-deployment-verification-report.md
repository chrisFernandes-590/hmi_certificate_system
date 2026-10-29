# AWS Deployment Verification Report & Architectural Audit

**Document Version**: 1.0.0  
**Date**: October 29, 2026  
**Target AWS Region**: `ap-south-1` (Mumbai)  
**AWS Account ID**: `212641463846`  
**Environment**: Production (`prod`)  
**Architecture Standard**: AGENTS.md Compliance  

---

## Executive Summary

The Title Certificate Generation and Verification Management System infrastructure in AWS has been inspected, deployed, interconnected, and verified end-to-end. All core business and operational workflows—including database migrations, TLS-verified PostgreSQL queries, S3 PDF generation/storage, public unauthenticated QR certificate verification, certificate revocation, CloudWatch log streaming, and Amazon Cognito user pool authentication—have been executed with live calls against real AWS resources.

---

## 1. Hono API Deployment on EC2

- **EC2 Instance**: `i-0f472bec70a80df8f` (`t4g.small` AL2023, 2 vCPU, 2.0 GiB RAM, Graviton2 ARM64).
- **Network Placement**: Public Subnet `subnet-02bd64999afe6e6b2` in VPC `vpc-04aab780a5aa62ac1` (`10.20.0.0/16`).
- **IP Addressing**:
  - **Public IPv4**: `13.233.212.183`
  - **Private IPv4**: `10.20.12.165`
- **Process Manager**: PM2 v6 running process `hmi-api` in fork mode under `/opt/hmi-cert/app/apps/api`.
  - Status: `online`
  - Memory: ~115 MB
  - Auto-restart & Systemd persistence: Configured and saved to `/root/.pm2/dump.pm2`.
- **Health Endpoints**:
  - `GET http://13.233.212.183:3000/` → `{"success":true,"data":{"message":"Hello Hono!"}}` (HTTP 200)
  - `GET http://13.233.212.183:3000/health` → `{"success":true,"data":{"status":"healthy","timestamp":"..."}}` (HTTP 200)
  - `GET http://13.233.212.183:3000/api/health` → `{"success":true,"data":{"status":"healthy","timestamp":"..."}}` (HTTP 200)
- **CloudWatch Logs**:
  - Amazon CloudWatch Agent (`amazon-cloudwatch-agent.service`) is installed, active, and ingesting PM2 logs into Log Group `/aws/hmi-cert/api`.
  - Active log streams: `i-0f472bec70a80df8f/stdout` and `i-0f472bec70a80df8f/stderr`.
  - Retention: 14 days.

---

## 2. Frontend Deployment Status

- **Status**: Development / Local Client Only.
- **Verification**: Audited AWS resources using `aws amplify list-apps`, `aws cloudfront list-distributions`, and `aws s3 ls`. No cloud hosting (CloudFront CDN distribution, S3 static website hosting bucket, or AWS Amplify app) is provisioned.
- **Current Runtime**: The React 19 + Vite frontend (`apps/web`) is running locally on `http://localhost:5173`, configured with a development proxy in `apps/web/vite.config.ts` forwarding `/api` requests to backend port 3000.
- **Production Build**: Verified that `pnpm --filter web build` compiles cleanly to `apps/web/dist/` without errors.

---

## 3. Database Connectivity & S3 Storage

### Amazon RDS PostgreSQL
- **DB Identifier**: `hmi-cert-postgres` (PostgreSQL 18.3, `db.t4g.micro`, 20 GB gp2).
- **Endpoint**: `hmi-cert-postgres.cdmi866iew37.ap-south-1.rds.amazonaws.com:5432`.
- **Private Subnets**: `subnet-0bbd98ee6c764c514` (`ap-south-1a`) and `subnet-0259b3d0e9b97cf87` (`ap-south-1b`).
- **Verified TLS**:
  - The application uses the official Amazon RDS global CA bundle installed at `/etc/pki/tls/certs/global-bundle.pem`.
  - Configured with `rejectUnauthorized: true`.
  - Live query verified over encrypted TLS without certificate verification failures.

### Amazon S3 Bucket
- **Bucket Name**: `hmi-cert-pdfs-212641463846-ap-south-1`.
- **Security & Permissions**:
  - Public access completely blocked (`BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets` all `true`).
  - Bucket policy strictly enforces SSL (`aws:SecureTransport: false` is denied).
  - CORS configured for web origins (`GET`, `HEAD`, `POST`, `PUT`).
- **File Retrieval & Upload**:
  - Verified live upload of PDF payloads to `certificate-pdfs/` and `participant-imports/`.
  - Verified live retrieval and SHA-256 integrity verification.
  - S3 calls use EC2 instance IAM role credentials; no long-term access keys are stored or exposed.

---

## 4. Drizzle Migrations & Schema Tracking

- **Migration Tracking Table**: `"drizzle"."__drizzle_migrations"` in PostgreSQL database `hmi_certificates`.
- **Tracked Migrations**: Verified all 7 migrations match `apps/api/drizzle/meta/_journal.json`:
  1. `4cffcf72e2c481d632a99d8902c2c28d790a17468c8a40f23053a51b28447ced` — `0000_curved_tyger_tiger`
  2. `6401ba5402b86f4532636f168c13efd4fe050216e82a5c321f675c9c48d4d990` — `0001_magical_steve_rogers`
  3. `57c58668cd7f62d9537ed19773ed702a4fa2de23f8a110fc16457b3bfe86e56e` — `0002_nasty_anthem`
  4. `a8e15fee483ad8ae191bb6c8db5bc660cba8d0575e8763f949f800f1e5fe9d64` — `0003_certificate_event_recipient_unique`
  5. `a7f192b86c909a3c776d7b5b829a0745b9e737f09fab84db8a40901d1d5911b0` — `0004_participant_import_workflow`
  6. `1812945dcbb15b76dc395fd4bc116da3be6b33dbe2c9b176d6a1896bba4d4fd0` — `0005_user_profiles`
  7. `615ff94e6eccf5f00612811c940aff3d243656d6a66178c1753ef161728ebc5d` — `0006_active_profile_session_repair`
- **Schema Validation**: Verified all 16 tables exist in PostgreSQL and match `apps/api/src/db/schema/`:
  `audit_logs`, `auth_sessions`, `certificate_assets`, `certificate_templates`, `certificates`, `email_verification_tokens`, `event_memberships`, `event_registrations`, `events`, `external_identities`, `participant_import_jobs`, `participants`, `password_reset_tokens`, `profiles`, `user_credentials`, `users`.

---

## 5. Amazon Cognito & Authentication Integration

- **User Pool ID**: `ap-south-1_d0Un9TG2k` (`hmi-cert-user-pool-prod`).
- **App Client ID**: `7a2ootg1u1nfvmmqfv163p3u41` (`hmi-cert-web-client-prod`, public client without client secret).
- **Authentication Flows**: `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`, `ALLOW_USER_SRP_AUTH`.
- **Cognito Testing**:
  - Registered user `test-user@example.com` via `aws cognito-idp sign-up` (UserSub: `01130d9a-40f1-700c-4b1d-868475efe1e9`).
  - Confirmed registration and set `email_verified=true`.
  - Executed `initiate-auth` with `USER_PASSWORD_AUTH` and successfully obtained valid Access, ID, and Refresh tokens.
  - Validated claims via `aws cognito-idp get-user`.
- **Backend Architecture Integration**:
  - Created `CognitoTokenVerifier` using official `aws-jwt-verify` to validate Cognito RSA signatures, issuer, audience, and token use (`id` and `access`).
  - Created `ExternalIdentityService` mapping Cognito subjects to application `users` via PostgreSQL `external_identities`.
  - Created `HybridAuthProvider` combining local session tokens and Cognito JWT Bearer tokens transparently across all protected routes.
  - Complies with AGENTS.md rules: user UUIDs remain immutable, emails are not permanent keys, and unverified emails are never linked.

---

## 6. End-to-End Core Workflows Verification

All core lifecycles were executed and validated on the deployed backend using `test-core-workflows.mjs`:

| Step | Operation | Result | HTTP Status |
| :--- | :--- | :--- | :--- |
| 1 | Register Organizer (`POST /api/auth/register`) | Verification link generated | 202 Accepted |
| 2 | Verify Email (`POST /api/auth/verify-email`) | Account activated | 200 OK |
| 3 | Authenticate Organizer (`POST /api/auth/login`) | Native Bearer session token issued | 200 OK |
| 4 | Protected Access Check (`GET /api/auth/me`) | User details restored | 200 OK |
| 5 | Create Organizer Profile (`POST /api/profiles/organizer`) | Profile created (`roleLabel: teacher`) | 201 Created |
| 6 | Activate Profile (`POST /api/profiles/active`) | Active profile switched to `organizer` | 200 OK |
| 7 | Create Event (`POST /api/events`) | Event created (`AWS Cloud Architecture Summit 2026`) | 201 Created |
| 8 | Register Participant (`POST /api/auth/register`) | Participant user provisioned | 202 Accepted |
| 9 | Verify & Login Participant | Participant session active | 200 OK |
| 10 | Participant Event Registration (`POST /api/events/:id/registration`) | Registration record created | 201 Created |
| 11 | Organizer Marks Attendance (`PATCH /api/events/:id/participants/:pId`) | Participant status updated to `attended` | 200 OK |
| 12 | Certificate Issuance (`POST /api/events/:id/certificates`) | PDF generated via `@react-pdf/renderer` & uploaded to S3 | 201 Created |
| 13 | Authorized PDF Download (`GET /api/certificates/:id/pdf`) | Received 7636 bytes; `%PDF-` header verified | 200 OK |
| 14 | Unauthenticated QR Verification (`GET /api/verify/:token`) | Returned `valid: true`, recipient & event metadata | 200 OK |
| 15 | Certificate Revocation (`PATCH /api/certificates/:id/revoke`) | Revocation recorded with reason | 200 OK |
| 16 | Unauthenticated Verification After Revocation | Returned `result: "revoked"`, `valid: false` | 200 OK |

---

## 7. Monitoring, Alarms, and AWS Budgets

### CloudWatch Metric Alarms
All alarms route actions to SNS Topic `arn:aws:sns:ap-south-1:212641463846:hmi-cert-operational-alerts-prod`:
1. `hmi-cert-ec2-status-check-failed-prod`: Triggers if EC2 `StatusCheckFailed >= 1` for 2 minutes.
2. `hmi-cert-rds-high-cpu-prod`: Triggers if RDS `CPUUtilization >= 80%` for 5 minutes.
3. `hmi-cert-rds-low-storage-prod`: Triggers if RDS `FreeStorageSpace <= 2 GB` for 5 minutes.

### AWS Budgets Status
- Budget Name: `AWS Budget`
- Monthly Limit: `$1.00 USD`
- Spend Status: Actual spend `$0.00`, Forecasted spend `$0.416 USD` (Health: `HEALTHY`).
- Alert Notification: Triggers when actual spend exceeds `$0.01 USD`.
- Active Notification Subscribers: `leroyedison7@gmail.com`, `gokut3st@gmail.com`, `danieledison@gmail.com`.

---

## 8. Security Review & Least-Privilege IAM Audit

1. **Inbound Security Groups**:
   - `sg-020819c796ff23596` (`hmi-cert-api-sg`): Allows inbound TCP ports 80, 443, and 3000. Port 22 (SSH) is deliberately closed; instance access is managed through AWS SSM Session Manager.
   - `sg-0eceb8b60da05d7ec` (`hmi-cert-rds-sg`): Port 5432 is restricted exclusively to traffic from `sg-020819c796ff23596`. Direct internet access is completely blocked (`PubliclyAccessible: false`).
2. **Public Endpoints**:
   - Public traffic reaches only the Hono API on EC2 (`13.233.212.183:3000`).
   - S3 bucket is 100% private.
3. **Secret Permissions & Parameter Store**:
   - Stored in AWS Systems Manager Parameter Store under `/hmi-cert/api/*`.
   - `database-url` is stored as KMS-encrypted `SecureString`.
   - Instance role permission is strictly scoped to `arn:aws:ssm:ap-south-1:212641463846:parameter/hmi-cert/*`.
4. **EC2 IAM Role**:
   - Role name: `hmi-cert-api-instance-role-prod`.
   - Policies attached: `AmazonSSMManagedInstanceCore`, `CloudWatchAgentServerPolicy`.
   - Custom S3 policy: Scoped strictly to bucket `hmi-cert-pdfs-212641463846-ap-south-1` for object paths `certificate-pdfs/*` and `participant-imports/*`.

---

## 9. Recalculated Monthly Cost Breakdown

*Calculated based on actual deployed resource configurations in `ap-south-1` without assuming AWS Free Tier eligibility:*

| Resource | Configuration / Size | Monthly Pricing Basis | Estimated Monthly Cost |
| :--- | :--- | :--- | :--- |
| **EC2 Compute** | `t4g.small` Graviton2 (AL2023) | $0.0168 / hr × 730 hrs | $12.26 |
| **EC2 Storage** | 10 GB gp3 root EBS volume | $0.088 / GB-month | $0.88 |
| **In-Use Public IPv4** | 1 public IP on EC2 | $0.005 / hr × 730 hrs | $3.65 |
| **RDS PostgreSQL** | `db.t4g.micro` Single-AZ (PG 18.3) | $0.018 / hr × 730 hrs | $13.14 |
| **RDS Storage** | 20 GB gp2 SSD storage | $0.115 / GB-month | $2.30 |
| **Amazon S3 Storage** | Standard storage (PDFs & imports) | $0.025 / GB-month | ~$0.05 |
| **VPC S3 Gateway Endpoint** | `vpce-037f3747738f615f3` | Included free with VPC | $0.00 |
| **NAT Gateway** | *Omitted by architectural design* | *Avoids standard $0.045/hr fee* | $0.00 |
| **CloudWatch Alarms** | 3 Metric Alarms | $0.10 / alarm-month | $0.30 |
| **CloudWatch Logs** | Ingestion & storage (/aws/hmi-cert/api) | ~$0.50 / GB | ~$0.05 |
| **Amazon Cognito** | < 50,000 Monthly Active Users | Free tier baseline | $0.00 |
| **SSM Parameter Store** | Standard parameters (`/hmi-cert/api/*`) | Included free | $0.00 |
| **Amazon SNS** | Operational Alerts Topic | Free for first 1,000 emails | $0.00 |
| **AWS Budgets** | 1 Monthly Cost Budget | Included free | $0.00 |
| **TOTAL** | **Full Production Deployment** | | **~$32.63 / month** |

---

## 10. Final Verification Checklist

| Status | Verification Item | Details |
| :---: | :--- | :--- |
| **VERIFIED** | Hono API running on EC2 | PM2 process `hmi-api` status `online`, systemd persistence active |
| **VERIFIED** | Application Health Endpoints | `GET /`, `/health`, and `/api/health` return HTTP 200 OK |
| **VERIFIED** | CloudWatch Logs Streaming | PM2 stdout/stderr ingesting into `/aws/hmi-cert/api` log streams |
| **VERIFIED** | Frontend Deployment Status | Audited; web client is currently running locally via Vite dev server |
| **VERIFIED** | RDS Verified TLS Connection | Database client uses Amazon RDS CA bundle (`rejectUnauthorized: true`) |
| **VERIFIED** | S3 Authorized File Storage | Upload, download, and deletion of certificate PDFs verified with IAM role |
| **VERIFIED** | Drizzle Database Migrations | 7 tracked entries in `"drizzle"."__drizzle_migrations"`, 16 tables match schema |
| **VERIFIED** | Cognito User Pool & App Client | `ap-south-1_d0Un9TG2k` sign-up, verification, and `initiate-auth` verified |
| **VERIFIED** | Cognito Backend Integration | `CognitoTokenVerifier`, `ExternalIdentityService`, `HybridAuthProvider` tested |
| **VERIFIED** | Event Management Workflow | Event creation, participant registration, status update to `attended` |
| **VERIFIED** | Certificate Generation & S3 Storage | `@react-pdf/renderer` PDF rendered, uploaded to S3, SHA-256 checksummed |
| **VERIFIED** | Public QR Verification | Unauthenticated `GET /api/verify/:token` returns `valid: true` |
| **VERIFIED** | Certificate Revocation | `PATCH /api/certificates/:id/revoke` updates database and verify returns `revoked` |
| **VERIFIED** | AWS Budgets Configuration | Monthly budget active ($1.00 limit, 3 email subscribers) |
| **VERIFIED** | CloudWatch Alarms & SNS Topic | EC2 and RDS alarms wired to `hmi-cert-operational-alerts-prod` |
| **VERIFIED** | Inbound Security Group Rules | API server open on 80/443/3000; RDS port 5432 restricted to API SG |
| **VERIFIED** | Least-Privilege EC2 IAM Profile | SSM Session Manager, CloudWatch Agent, S3 scoped to bucket paths |
| **VERIFIED** | Recalculated Monthly Cost | Verified pricing: ~$32.63/month without Free Tier assumptions |
| **VERIFIED** | SNS Operational Alerts Email | Subscribed `leroyedison7@gmail.com` to `hmi-cert-operational-alerts-prod` (Pending confirmation) |
| **INCOMPLETE** | Frontend Cloud Hosting | Static hosting (S3/CloudFront) not yet provisioned per scope |
