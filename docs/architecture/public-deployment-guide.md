# Public Deployment & Operations Guide

**System**: Title Certificate Generation and Verification Management System  
**Author**: Antigravity DevOps & AWS Architect  
**Version**: 1.0.0  
**Target Region**: AWS `ap-south-1` (Mumbai)  
**Host Architecture**: AWS EC2 AL2023 (`t4g.small` ARM64 Graviton2)  

---

## 1. Architecture Overview

The public deployment integrates the React 19 Single Page Application (SPA) and the Hono REST API onto the application compute host using Nginx as a high-performance reverse proxy and static asset server.

```
                                 [ Internet / External Users ]
                                               │
                        ┌──────────────────────┴──────────────────────┐
                        │ HTTP Port 80 (HTTPS Port 443 future TLS)    │
                        ▼                                             ▼
                 [ Nginx 1.30.6 ]                              [ Nginx 1.30.6 ]
              Static Route (/, /login,                      Reverse Proxy (/api/*,
              /verify, /assets/*)                           /health)
                        │                                             │
                        ▼                                             ▼
             /var/www/hmi-cert/html                         http://127.0.0.1:3000
             (React 19 Vite SPA Build)                     (Hono API Node.js/PM2)
                                                                      │
                                   ┌──────────────────────────────────┴──────────────────┐
                                   ▼                                                     ▼
                        [ Amazon RDS PostgreSQL ]                            [ Amazon S3 Private Bucket ]
                        (PostgreSQL 18.3, Private Subnets,                   (PDF certificates, QR codes,
                         TLS Encrypted with RDS CA Bundle)                    SSL-only, IAM EC2 Role)
```

---

## 2. Server Directory Layout

```
/
├── var/www/hmi-cert/html/            # Frontend static assets (owner: nginx:nginx)
│   ├── index.html                    # Single Page Application HTML entrypoint
│   ├── favicon.svg                   # Brand favicon
│   ├── icons.svg                     # UI sprite/icons
│   └── assets/                       # Content-hashed Vite JavaScript and CSS bundles
├── etc/nginx/
│   ├── nginx.conf                    # Main Nginx configuration (default server disabled)
│   └── conf.d/
│       └── hmi-cert.conf             # Virtual host configuration for HMI Certificate System
├── opt/hmi-cert/app/
│   ├── apps/api/
│   │   ├── .env                      # API runtime configuration
│   │   └── dist/index.js             # Compiled Hono backend application
│   └── node_modules/                 # Runtime dependencies (including aws-jwt-verify, pg)
└── root/.pm2/
    ├── dump.pm2                      # Saved PM2 process list for system reboot survival
    └── logs/
        ├── hmi-api-out.log           # Standard output log (ingested by CloudWatch)
        └── hmi-api-error.log         # Standard error log (ingested by CloudWatch)
```

---

## 3. Step-by-Step Deployment Instructions

### Step 3.1: Build the Frontend Web Application
Run the Vite production build from the workspace root:
```bash
pnpm --filter web build
```
This outputs compiled, optimized, and content-hashed assets to `apps/web/dist/`.

Package the distribution bundle into a tar archive:
```bash
tar -czf web-dist.tar.gz -C apps/web/dist .
```

### Step 3.2: Transfer the Web Bundle to EC2
Using the AWS S3 staging prefix accessible to the EC2 IAM role:
```bash
aws s3 cp web-dist.tar.gz s3://hmi-cert-pdfs-212641463846-ap-south-1/participant-imports/web-dist.tar.gz --profile antigravity --region ap-south-1
```

On the EC2 host (via AWS Systems Manager Session Manager or Run Command):
```bash
mkdir -p /var/www/hmi-cert/html
rm -rf /var/www/hmi-cert/html/*
aws s3 cp s3://hmi-cert-pdfs-212641463846-ap-south-1/participant-imports/web-dist.tar.gz /tmp/web-dist.tar.gz --region ap-south-1
tar -xzf /tmp/web-dist.tar.gz -C /var/www/hmi-cert/html
chown -R nginx:nginx /var/www/hmi-cert
chmod -R 755 /var/www/hmi-cert
rm -f /tmp/web-dist.tar.gz
```

### Step 3.3: Configure Nginx

Install Nginx on Amazon Linux 2023:
```bash
dnf install -y nginx
```

Ensure the default server block in `/etc/nginx/nginx.conf` is disabled or commented out so it does not conflict with virtual host configurations in `/etc/nginx/conf.d/`.

Create `/etc/nginx/conf.d/hmi-cert.conf`:
```nginx
# HMI Certificate Management System - Nginx Reverse Proxy & Static Site
server {
    listen 80;
    listen [::]:80;
    server_name _;

    root /var/www/hmi-cert/html;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # Client body size for file uploads and imports
    client_max_body_size 25M;

    # Standard Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Direct health check pass-through
    location = /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API reverse proxy to Hono backend
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # Static assets long-term caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # React Single Page Application (SPA) routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Validate and start Nginx:
```bash
nginx -t
systemctl enable --now nginx
```

### Step 3.4: Configure Backend Environment Variables
Update `/opt/hmi-cert/app/apps/api/.env` with the public host address:
```ini
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://hmi_admin:<password>@hmi-cert-postgres.cdmi866iew37.ap-south-1.rds.amazonaws.com:5432/hmi_certificates?sslmode=require
AWS_REGION=ap-south-1
CERTIFICATE_S3_BUCKET=hmi-cert-pdfs-212641463846-ap-south-1
PARTICIPANT_IMPORT_S3_BUCKET=hmi-cert-pdfs-212641463846-ap-south-1
AUTH_WEB_ORIGIN=http://13.233.212.183
AUTH_APP_BASE_URL=http://13.233.212.183
CERTIFICATE_PUBLIC_VERIFY_BASE_URL=http://13.233.212.183/verify
AUTH_SESSION_TTL_SECONDS=604800
AUTH_VERIFICATION_TTL_SECONDS=86400
AUTH_PASSWORD_RESET_TTL_SECONDS=3600
DEV_EMAIL_ENABLED=true
AWS_RDS_CA_PATH=/etc/pki/tls/certs/global-bundle.pem
COGNITO_USER_POOL_ID=ap-south-1_d0Un9TG2k
COGNITO_CLIENT_ID=7a2ootg1u1nfvmmqfv163p3u41
```

Reload PM2 with updated environment:
```bash
pm2 restart hmi-api --update-env
pm2 save
```

### Step 3.5: Network Security Hardening
In EC2 Security Group `sg-020819c796ff23596` (`hmi-cert-api-sg`):
- **Port 80 (HTTP)**: Allow `0.0.0.0/0` (Nginx entrypoint).
- **Port 443 (HTTPS)**: Allow `0.0.0.0/0` (Future TLS entrypoint).
- **Port 3000 (API)**: Revoke `0.0.0.0/0`. Port 3000 must only be accessed locally over `127.0.0.1` by Nginx.

---

## 4. HTTPS and Custom Domain Configuration (Next Phase)

When a domain name (e.g. `certificates.example.com`) is assigned:

1. **DNS Record**: Point an `A` record or Route 53 alias to the EC2 Public Elastic IP `13.233.212.183`.
2. **Automated TLS (Certbot)**:
   ```bash
   dnf install -y certbot python3-certbot-nginx
   certbot --nginx -d certificates.example.com
   ```
3. **Environment Updates**:
   Update `AUTH_WEB_ORIGIN`, `AUTH_APP_BASE_URL`, and `CERTIFICATE_PUBLIC_VERIFY_BASE_URL` in `.env` to `https://certificates.example.com`.
4. **Cookie Security**:
   Set `NODE_ENV=production` once Amazon SES domain email identity is verified, automatically enabling `Secure` cookie attributes.

---

## 5. Operations & Troubleshooting Commands

| Task | Command |
| :--- | :--- |
| **Check Nginx Status** | `systemctl status nginx` |
| **Test Nginx Config** | `nginx -t` |
| **Reload Nginx Config** | `systemctl reload nginx` |
| **Check PM2 Status** | `pm2 status` |
| **View Live API Logs** | `pm2 logs hmi-api` |
| **Restart API Process** | `pm2 restart hmi-api --update-env` |
| **View CloudWatch Logs** | `aws logs tail /aws/hmi-cert/api --follow` |
| **Verify Local API Health**| `curl -i http://127.0.0.1:3000/health` |
| **Verify Public Health** | `curl -i http://13.233.212.183/health` |
