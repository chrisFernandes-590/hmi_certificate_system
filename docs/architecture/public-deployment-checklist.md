# Public Deployment Readiness Checklist

**Project**: Title Certificate Generation and Verification Management System  
**Target Environment**: AWS EC2 AL2023 (`ap-south-1`)  
**Public Host IP**: `13.233.212.183`  
**Current Status**: **Fully Deployed & Publicly Verified**  

---

## 1. Infrastructure Readiness

- [x] **VPC & Subnets**: Custom VPC `10.20.0.0/16` with public and private subnets, Internet Gateway, and route tables.
- [x] **Compute Host**: EC2 `i-0f472bec70a80df8f` (`t4g.small` ARM64 Graviton2) online with AWS Systems Manager.
- [x] **Static Public IP**: Elastic IP `13.233.212.183` associated with EC2 instance.
- [x] **Database Host**: Amazon RDS PostgreSQL 18.3 in private subnets, TLS CA bundle installed and active.
- [x] **S3 Storage**: Bucket `hmi-cert-pdfs-212641463846-ap-south-1` private with enforced SSL transport policy.
- [x] **IAM Roles**: EC2 instance profile `hmi-cert-api-instance-profile-prod` with scoped least-privilege policies.
- [x] **Identity Provider**: Amazon Cognito User Pool `ap-south-1_d0Un9TG2k` and App Client `7a2ootg1u1nfvmmqfv163p3u41` provisioned.
- [x] **CloudWatch Monitoring**: CloudWatch Agent active, ingesting PM2 logs to `/aws/hmi-cert/api`.

---

## 2. Web Server & Proxy Readiness

- [x] **Nginx Installed**: Nginx 1.30.6 installed and enabled as a systemd service (`nginx.service`).
- [x] **Conflict Resolution**: Default server block in `/etc/nginx/nginx.conf` disabled to prevent port 80 collisions.
- [x] **Virtual Host**: `/etc/nginx/conf.d/hmi-cert.conf` configured with `listen 80;` and `server_name _;`.
- [x] **Single Page App Routing**: `try_files $uri $uri/ /index.html;` configured for client-side React Router navigation.
- [x] **Reverse Proxy**: `location /api/` proxying to `http://127.0.0.1:3000/api/` with real client IP and host forwarding headers.
- [x] **Health Check Routing**: `location = /health` proxying directly to `http://127.0.0.1:3000/health`.
- [x] **Asset Caching**: `location /assets/` configured with 1-year immutable caching for Vite bundles.
- [x] **Gzip Compression**: Enabled for JS, CSS, JSON, SVG, and HTML content.
- [x] **Security Headers**: `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` injected on all responses.
- [x] **Upload Limits**: `client_max_body_size 25M;` configured for CSV participant imports and certificates.

---

## 3. Application & Environment Configuration

- [x] **Production Web Build**: React 19 + Vite frontend compiled to `/var/www/hmi-cert/html` with proper permissions (`nginx:nginx`, 755/644).
- [x] **Backend API Runtime**: Node.js / Hono running under PM2 v6 (`hmi-api`, fork mode, startup persistence).
- [x] **CORS & CSRF Origin**: `AUTH_WEB_ORIGIN=http://13.233.212.183` configured in `/opt/hmi-cert/app/apps/api/.env`.
- [x] **Base Application URL**: `AUTH_APP_BASE_URL=http://13.233.212.183` configured in `.env`.
- [x] **Public Verification Base URL**: `CERTIFICATE_PUBLIC_VERIFY_BASE_URL=http://13.233.212.183/verify` configured in `.env`.
- [x] **Database Connection String**: Pointing to RDS with `sslmode=require` and verified CA bundle path.
- [x] **Cognito Configuration**: `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` defined in `.env`.

---

## 4. End-to-End Functional Verification

- [x] **Public Web Access**: `http://13.233.212.183/` renders Single Page Application in browser.
- [x] **Direct Route Refresh**: Visiting `/login`, `/register`, `/verify`, `/account` directly returns HTTP 200 via SPA fallback.
- [x] **Static Asset Delivery**: Content-hashed assets in `/assets/` return HTTP 200 with `Cache-Control: public, immutable`.
- [x] **Health Endpoints**: Both `/health` and `/api/health` return HTTP 200 `{"status":"healthy"}`.
- [x] **Cookie Session Authentication**: Browser login issues `titlecert_session` HttpOnly cookie; protected `/api/auth/me` validates session.
- [x] **Organizer Workspace**: Organizer profile created, active profile toggled, and organizer capabilities unlocked.
- [x] **Event Management**: Event creation, status updates, and participant list retrieval verified.
- [x] **Participant Management**: Participant registration and attendance marking verified.
- [x] **PDF Certificate Generation**: `@react-pdf/renderer` generates valid PDF (magic bytes `%PDF-` verified) and uploads to private S3 bucket.
- [x] **QR Code & Verification URL**: Certificate includes verification URL pointing to `http://13.233.212.183/verify/<token>`.
- [x] **Authorized PDF Download**: Participant can securely download issued PDF from private S3 bucket.
- [x] **Public Unauthenticated Verification**: Anyone can verify certificate validity at `GET /api/verify/<token>` without logging in.
- [x] **Certificate Revocation**: Organizer can revoke certificate; public verification immediately reflects `revoked` state.
- [x] **Amazon Cognito Bearer Authentication**: Native clients can authenticate with Cognito User Pool and access protected API routes via Bearer token.

---

## 5. Security & Network Hardening

- [x] **Direct API Access Blocked**: Port 3000 revoked from security group `sg-020819c796ff23596`. Direct external connections to Node.js time out.
- [x] **Reverse Proxy Enforced**: All public HTTP traffic must traverse Nginx on Port 80.
- [x] **PostgreSQL Isolated**: Amazon RDS remains in private subnets with no public access.
- [x] **S3 Storage Private**: S3 bucket has public access blocked and enforces SSL in transit.
- [x] **Credential Hygiene**: No AWS access keys, database passwords, or JWT secrets exposed in public files or git repository.

---

## 6. Next Phase: Production Enhancements

- [ ] **Custom Domain Name**: Register or point a domain name (e.g. `certificates.example.com`) to Elastic IP `13.233.212.183`.
- [ ] **HTTPS / TLS Certificate**: Run `certbot --nginx -d certificates.example.com` to provision free Let's Encrypt SSL/TLS.
- [ ] **Enforce HTTPS Redirect**: Add Nginx HTTP-to-HTTPS redirect (`return 301 https://$host$request_uri;`).
- [ ] **Amazon SES Production Email**: Verify domain identity in Amazon SES to send production emails and transition `NODE_ENV=production`.
- [ ] **CloudFront CDN Distribution**: Optional global edge caching for static assets and AWS WAF integration.
