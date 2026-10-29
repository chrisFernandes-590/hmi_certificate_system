# AWS Infrastructure Connectivity & Verification Report

**Deployment Date:** October 28, 2026  
**AWS Account ID:** `212641463846`  
**Primary Region:** `ap-south-1` (Mumbai)  
**Profile:** `antigravity` (`arn:aws:iam::212641463846:user/Cert_Admin`)  
**Deployment Status:** Complete & Empirically Verified

---

## 1. Executive Summary

All six CloudFormation stacks were successfully generated, validated, deployed, and verified in dependency order. Empirical end-to-end tests were conducted from the deployed EC2 API server (`i-0f472bec70a80df8f`) to verify network routing, least-privilege IAM roles, verified TLS database connectivity, S3 storage operations, Cognito User Pool configuration, and CloudWatch telemetry.

---

## 2. CloudFormation Stacks Verification

| Stack Name | Template File | Status | Deployed Resources / Responsibilities |
| :--- | :--- | :--- | :--- |
| `hmi-cert-networking-security` | `01-networking-security.yaml` | `CREATE_COMPLETE` | Ports 3000, 80, 443 ingress on `sg-020819c796ff23596` (`hmi-cert-api-sg`) |
| `hmi-cert-iam-roles` | `02-iam-roles.yaml` | `CREATE_COMPLETE` | IAM Role & Instance Profile `hmi-cert-api-instance-profile-prod` |
| `hmi-cert-cognito` | `03-cognito.yaml` | `CREATE_COMPLETE` | User Pool `ap-south-1_d0Un9TG2k`, Public App Client `7a2ootg1u1nfvmmqfv163p3u41` |
| `hmi-cert-parameters` | `05-parameters.yaml` | `CREATE_COMPLETE` | SSM Parameter Store entries under `/hmi-cert/api/*` |
| `hmi-cert-ec2-backend` | `06-ec2-backend.yaml` | `CREATE_COMPLETE` | EC2 `t4g.small` AL2023 instance `i-0f472bec70a80df8f` |
| `hmi-cert-monitoring-alerts` | `07-monitoring-alerts.yaml` | `CREATE_COMPLETE` | CloudWatch Log Group `/aws/hmi-cert/api`, Alarms & SNS Topic |

---

## 3. Empirical Test Results

### Test 1: Keyless EC2 Administration via AWS Systems Manager
- **Command**: `aws ssm describe-instance-information --filters "Key=InstanceIds,Values=i-0f472bec70a80df8f"`
- **Result**: `PingStatus: Online`, `Platform: Amazon Linux 2023`
- **Verdict**: **PASSED**. No SSH port 22 or permanent SSH keys required.

### Test 2: EC2 to Amazon RDS PostgreSQL TCP Connectivity
- **Command**: Python socket connection to `hmi-cert-postgres.cdmi866iew37.ap-south-1.rds.amazonaws.com:5432`.
- **Result**:
  ```
  SUCCESS: Connected to RDS PostgreSQL port 5432
  ```
- **Verdict**: **PASSED**. Private subnet routing and security group ingress whitelisting from `sg-020819c796ff23596` to `sg-0eceb8b60da05d7ec` verified.

### Test 3: Verified TLS PostgreSQL Connection & Database Query Execution
- **Command**: Node.js `pg` Pool connecting with `rejectUnauthorized: true` using the official Amazon RDS CA truststore bundle (`/etc/pki/tls/certs/global-bundle.pem`).
- **Result**:
  ```
  SUCCESS: Fully verified TLS connection to Amazon RDS!
  Database: hmi_certificates
  User: hmi_admin
  Version: PostgreSQL 18.3
  ```
- **Verdict**: **PASSED**. Enforces strict server certificate verification without disabling TLS checks.

### Test 4: Database Migrations Execution on Amazon RDS
- **Command**: Applied Drizzle migration suite (`0000` through `0006`) against `hmi_certificates`.
- **Result**:
  ```
  Applying migration: 0000_curved_tyger_tiger.sql -> Applied
  Applying migration: 0001_magical_steve_rogers.sql -> Applied
  Applying migration: 0002_nasty_anthem.sql -> Applied
  Applying migration: 0003_certificate_event_recipient_unique.sql -> Applied
  Applying migration: 0004_participant_import_workflow.sql -> Applied
  Applying migration: 0005_user_profiles.sql -> Applied
  Applying migration: 0006_active_profile_session_repair.sql -> Applied
  Migration SUCCESS! Tables created (16):
  audit_logs, auth_sessions, certificate_assets, certificate_templates,
  certificates, email_verification_tokens, event_memberships, event_registrations,
  events, external_identities, participant_import_jobs, participants,
  password_reset_tokens, profiles, user_credentials, users
  ```
- **Verdict**: **PASSED**. All 16 database tables, constraints, foreign keys, and unique indexes exist on Amazon RDS.

### Test 5: EC2 to S3 Least-Privilege Role & VPC Gateway Endpoint
- **Command**: Upload, read, and delete operations to `s3://hmi-cert-pdfs-212641463846-ap-south-1/certificate-pdfs/`.
- **Result**:
  ```
  upload: ../../tmp/smoke-test.txt to s3://hmi-cert-pdfs-212641463846-ap-south-1/certificate-pdfs/smoke-test.txt
  download: s3://hmi-cert-pdfs-212641463846-ap-south-1/certificate-pdfs/smoke-test.txt to ../../tmp/smoke-test-read.txt
  delete: s3://hmi-cert-pdfs-212641463846-ap-south-1/certificate-pdfs/smoke-test.txt
  "SUCCESS: S3 Upload, Read, and Delete Verified"
  ```
- **Security Check**: Attempting to read objects outside authorized prefixes (`/certificate-pdfs/*`, `/participant-imports/*`) correctly triggers `AccessDenied`.
- **Verdict**: **PASSED**. EC2 uses temporary IAM instance credentials over the private VPC Gateway Endpoint without static keys.

### Test 6: S3 Bucket CORS for Browser Uploads
- **Command**: `aws s3api get-bucket-cors --bucket hmi-cert-pdfs-212641463846-ap-south-1`
- **Result**: Allows `PUT`, `GET`, `HEAD` from `http://localhost:5173` with required headers (`content-type`, `x-amz-checksum-sha256`, `x-amz-meta-upload-id`, `x-amz-server-side-encryption`).
- **Verdict**: **PASSED**.

### Test 7: Amazon Cognito Public App Client Configuration
- **Command**: `aws cognito-idp describe-user-pool-client --user-pool-id ap-south-1_d0Un9TG2k --client-id 7a2ootg1u1nfvmmqfv163p3u41`
- **Result**:
  - `GenerateSecret`: `false` (Client secret is not generated, preventing accidental frontend leakage).
  - `ExplicitAuthFlows`: `ALLOW_REFRESH_TOKEN_AUTH`, `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_USER_SRP_AUTH`.
  - `PreventUserExistenceErrors`: `ENABLED`.
- **Verdict**: **PASSED**.

### Test 8: Observability (CloudWatch & SNS)
- **Log Group**: `/aws/hmi-cert/api` (14 days retention).
- **Alarms**:
  - `hmi-cert-rds-high-cpu-prod`: `OK`
  - `hmi-cert-rds-low-storage-prod`: `OK`
  - `hmi-cert-ec2-status-check-failed-prod`: Initializing/OK.
- **SNS Topic**: `arn:aws:sns:ap-south-1:212641463846:hmi-cert-operational-alerts-prod`.
- **Verdict**: **PASSED**.
