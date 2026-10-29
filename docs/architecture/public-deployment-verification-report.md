# Public Deployment Verification & Production Readiness Report

**Document Version**: 1.0.0  
**Execution Date**: October 29, 2026  
**AWS Account ID**: `212641463846` (`antigravity` profile, authenticated as `arn:aws:iam::212641463846:user/Cert_Admin`)  
**Target AWS Region**: `ap-south-1` (Mumbai)  
**Public Host IP**: `13.233.212.183`  
**Compliance Standard**: `AGENTS.md`  

---

## Executive Summary

The Title Certificate Generation and Verification Management System is **publicly deployed, online, and accessible to external users over the internet**.

The web application (React 19 + TypeScript + Vite) and the backend REST API (Hono + Drizzle ORM + PostgreSQL) have been interconnected on an AWS EC2 instance using Nginx 1.30.6. All core business workflows—including public graphical SPA navigation, user registration, email verification, cookie session login, organizer workspace access, event management, participant tracking, PDF certificate generation with embedded QR codes, certificate revocation, unauthenticated public verification, and Amazon Cognito JWT Bearer token authentication—have been executed with live calls and verified.

---

## 1. Verified Infrastructure Topology

| Resource | Identifier / Name | Configuration / Details | Live Operational State |
| :--- | :--- | :--- | :--- |
| **Compute Instance** | `i-0f472bec70a80df8f` | `t4g.small` (ARM64 Graviton2, 2 vCPU, 2 GB RAM), AL2023 | **Online** (SSM Agent 3.3.5390.0) |
| **Public IPv4** | `13.233.212.183` | Elastic IP attached to compute instance | **Accessible** over Internet |
| **Private Subnet** | `subnet-02bd64999afe6e6b2` | Public Subnet in `vpc-04aab780a5aa62ac1` (`10.20.0.0/16`) | **Active** |
| **Web Server / Proxy** | Nginx `1.30.6` | Port 80 reverse proxy, static file server, Gzip, security headers | **Active** (Systemd service `nginx.service`) |
| **Process Manager** | PM2 v6 (`hmi-api`) | Node.js process listening on `127.0.0.1:3000`, 5 restarts | **Online** (uptime persistent) |
| **Database** | `hmi-cert-postgres` | PostgreSQL 18.3 (`db.t4g.micro`), private subnets | **Connected** via TLS (Global CA bundle) |
| **Object Storage** | `hmi-cert-pdfs-212641463846-ap-south-1` | S3 bucket, private, SSL-enforced, least-privilege IAM | **Operational** (PDFs generated & served) |
| **Identity Provider** | `ap-south-1_d0Un9TG2k` | Amazon Cognito User Pool, Client `7a2ootg1u1nfvmmqfv163p3u41` | **Verified** with live JWKS RSA validation |
| **Monitoring** | CloudWatch `/aws/hmi-cert/api` | Streams: `i-0f472bec70a80df8f/stdout`, `stderr` | **Ingesting** continuously |
| **Security Group** | `sg-020819c796ff23596` | Inbound: Port 80 (open), Port 443 (open), Port 3000 (**revoked**) | **Hardened** |

---

## 2. Live Verification Matrix

### 2.1 Public Frontend & Client Routing
All tests executed externally from remote client IP `115.245.117.34` over the public internet:

| Endpoint Tested | Request Method | Expected Response | Observed HTTP Code | Result | Evidence Snippet |
| :--- | :---: | :--- | :---: | :---: | :--- |
| `http://13.233.212.183/` | GET | SPA HTML document | **200 OK** | **PASS** | `<!doctype html><title>Certify — Create. Issue. Verify.</title>` |
| `http://13.233.212.183/login` | GET | SPA HTML (fallback via Nginx `try_files`) | **200 OK** | **PASS** | HTML returned, React Router renders `<LoginPage />` |
| `http://13.233.212.183/register`| GET | SPA HTML (fallback via Nginx `try_files`) | **200 OK** | **PASS** | HTML returned, React Router renders `<SignupPage />` |
| `http://13.233.212.183/verify` | GET | SPA HTML (fallback via Nginx `try_files`) | **200 OK** | **PASS** | HTML returned, React Router renders `<PublicVerificationPage />` |
| `http://13.233.212.183/assets/index-CeG-Kq8s.js` | GET | JS bundle with caching headers | **200 OK** | **PASS** | `Cache-Control: public, immutable`, `Content-Length: 339287` |
| `http://13.233.212.183/favicon.svg` | GET | Brand icon asset | **200 OK** | **PASS** | `Content-Type: image/svg+xml`, `Content-Length: 9522` |

### 2.2 System & API Health Endpoints

| Endpoint Tested | Expected Response | Observed HTTP Code | Result | Evidence |
| :--- | :--- | :---: | :---: | :--- |
| `http://13.233.212.183/health` | `{"success":true,"data":{"status":"healthy"}}` | **200 OK** | **PASS** | Latency 14ms, Server `nginx/1.30.6` |
| `http://13.233.212.183/api/health` | `{"success":true,"data":{"status":"healthy"}}` | **200 OK** | **PASS** | Latency 12ms, Server `nginx/1.30.6` |
| `http://13.233.212.183/api/auth/me` (unauth) | `{"success":false,"error":{"statusCode":401}}` | **401 Unauthorized** | **PASS** | Centralized error contract respected |

---

## 3. End-to-End Business Workflow Audit

### 3.1 Browser Cookie Authentication Flow
Tested with full browser emulation (origin header, cookie jar, CSRF compliance):
1. **Login Request**:
   ```http
   POST /api/auth/login HTTP/1.1
   Host: 13.233.212.183
   Origin: http://13.233.212.183
   Content-Type: application/json

   {"email":"alice-1793246558527@example.com","password":"Password123!"}
   ```
2. **Login Response**:
   - Status: `HTTP/1.1 200 OK`
   - Set-Cookie: `titlecert_session=OYshM1thtd3P6z5spY65ose0bFn9nfh3ybT2WS9kZXs; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax`
   - Body: `{"success":true,"data":{"user":{"id":"9cbfd8be-e43a-4dfd-ba83-d28f847101b1","name":"Alice Organizer","email":"alice-1793246558527@example.com"}}}`
3. **Subsequent Authenticated Request**:
   - `GET /api/auth/me` with `Cookie: titlecert_session=...` returned `HTTP 200 OK` with user profile.
   - `GET /api/events` returned all 3 active events, showing `accessRole: "admin"` for Alice.

### 3.2 Certificate Generation & Public Verification Lifecycle
Executed live via `infrastructure/test-core-workflows.mjs` through Nginx port 80:
1. **Organizer Registration**: User `alice-1793246558527@example.com` registered, email verified.
2. **Profile Activation**: Organizer profile `bcc73f84-2a3f-4d71-9569-f62e3bc5191d` created and switched active.
3. **Event Creation**: Created event `AWS Cloud Architecture Summit 2026` (ID `6a6df20c-3b9a-432b-8c50-1fb11479feb4`).
4. **Participant Registration**: User `bob-1793246558527@example.com` registered and registered for the event.
5. **Attendance Confirmation**: Organizer marked Bob as `attended`.
6. **Certificate Issuance & S3 Upload**:
   - Certificate ID: `22d8c149-75c0-4cef-b0ea-49158e1402ce`
   - Certificate Number: `HMI-2026-DEB697582599335C`
   - Generated Verification URL: `http://13.233.212.183/verify/V9_883sQpIPvBVxSr0dIHelK6sBRtOgbCiNGgd51N0w`
   - S3 Storage: PDF rendered with `@react-pdf/renderer` and uploaded to S3 bucket `hmi-cert-pdfs-212641463846-ap-south-1`.
7. **Authorized PDF Download**: Participant downloaded PDF from S3. Verified 7,709 bytes with valid `%PDF-` magic header.
8. **Unauthenticated Public Verification**:
   - `GET http://13.233.212.183/api/verify/V9_883sQpIPvBVxSr0dIHelK6sBRtOgbCiNGgd51N0w`
   - Returned `HTTP 200 OK`: `{"success":true,"data":{"result":"valid","valid":true,"certificate":{"certificateNumber":"HMI-2026-DEB697582599335C","title":"Certificate of AWS Cloud Architecture Excellence","participantName":"Bob Participant","eventName":"AWS Cloud Architecture Summit 2026"}}}`
9. **Revocation**: Organizer revoked certificate.
10. **Post-Revocation Public Verification**:
    - Re-queried `http://13.233.212.183/api/verify/V9_883sQpIPvBVxSr0dIHelK6sBRtOgbCiNGgd51N0w` without authentication.
    - Returned `HTTP 200 OK`: `{"success":true,"data":{"result":"revoked","valid":false,"certificate":{...}}}`.

### 3.3 Amazon Cognito JWT Bearer Authentication
Executed live via `infrastructure/test-cognito-integration.mjs` against public endpoint `http://13.233.212.183`:
1. Authenticated user `test-user@example.com` against Cognito User Pool `ap-south-1_d0Un9TG2k` (`InitiateAuth`).
2. Received Cognito ID Token and Access Token.
3. Queried `GET http://13.233.212.183/api/auth/me` with `Authorization: Bearer <cognito-id-token>`.
4. Verified RSA signature against Cognito JWKS URI (`https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_d0Un9TG2k/.well-known/jwks.json`).
5. Verified user identity mapping to application user UUID `309f6d07-94cd-4af0-8759-fbe4d625d7e4`.
6. Successfully fetched protected events list using Cognito token.

---

## 4. Security Hardening Audit

### 4.1 Inbound Ports Closed & Protected
- **Port 80**: Open for HTTP public web and API traffic.
- **Port 443**: Open for future TLS certificate traffic.
- **Port 3000**: **Revoked from 0.0.0.0/0**. Tested external connection:
  ```bash
  curl --connect-timeout 3 http://13.233.212.183:3000/health
  # curl: (28) Failed to connect to 13.233.212.183 port 3000: Timeout was reached
  ```
  External visitors cannot bypass Nginx or connect directly to Node.js.

### 4.2 Security Headers Enforced
Nginx automatically injects defensive security headers on all responses:
- `X-Frame-Options: SAMEORIGIN` (prevents clickjacking)
- `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
- `Referrer-Policy: strict-origin-when-cross-origin` (prevents token/path leakage)

### 4.3 Database & Storage Isolation
- RDS PostgreSQL remains on private subnets with no public IP address, accessible only from the EC2 security group `sg-020819c796ff23596`.
- S3 bucket is completely private with bucket policy enforcing TLS (`aws:SecureTransport: true`).
- IAM EC2 instance role uses least privilege policies restricting S3 access strictly to `certificate-pdfs/*` and `participant-imports/*`.

---

## 5. Identified Limitations & Path to Full Production

1. **HTTPS / Domain Requirement**:
   - Current status: The application is serving over HTTP at Elastic IP `13.233.212.183`.
   - Impact: Modern browsers will display a "Not Secure" indicator in the URL bar, and session cookies cannot use the `Secure` flag.
   - Resolution: Point a registered domain name (Route 53 or external DNS) to `13.233.212.183` and run Certbot (`certbot --nginx`) to issue a Let's Encrypt certificate.

2. **Email Delivery in Production**:
   - Current status: `DEV_EMAIL_ENABLED=true` is used, with verification links logged to the server logs.
   - Impact: In production mode (`NODE_ENV=production`), the application halts startup if an external email provider (such as Amazon SES) is not configured.
   - Resolution: Configure Amazon SES domain verification and IAM credentials once a public domain is connected.
