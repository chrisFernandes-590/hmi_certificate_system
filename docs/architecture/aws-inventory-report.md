# AWS Infrastructure Inventory & Classification Report

**Account ID:** `212641463846`  
**Authenticated Identity:** `arn:aws:iam::212641463846:user/Cert_Admin` (Profile: `antigravity`)  
**Target Region:** `ap-south-1` (Asia Pacific - Mumbai)  
**Secondary Inspected Region:** `us-east-1` (US East - N. Virginia)  
**Report Generated:** October 28, 2026  
**Status:** Read-only Discovery Complete (Phase 1 & Phase 2)

---

## 1. Executive Summary & Key Discovery

A thorough discovery was conducted across regions and configured AWS CLI profiles.

1. **Multi-Account / Profile Discovery**:
   - Profile `antigravity` is authenticated as `Cert_Admin` with `AdministratorAccess` in Account **`212641463846`** (Mumbai `ap-south-1`).
   - Profile `default` is configured with credentials for Account **`102726256500`** (root identity).
   - The bucket `certify-certificate-bucket` mentioned in the prompt exists in Account **`102726256500`** (`us-east-1`).
   - In the target authenticated Account **`212641463846`**, a dedicated, pre-configured infrastructure suite already exists in **`ap-south-1`**:
     - VPC: `hmi-cert-vpc` (`vpc-04aab780a5aa62ac1`)
     - RDS PostgreSQL 18.3: `hmi-cert-postgres` (db.t4g.micro, private, encrypted)
     - S3 Bucket: `hmi-cert-pdfs-212641463846-ap-south-1` (private, encrypted)
     - VPC S3 Gateway Endpoint: `hmi-cert-vpce-s3` (`vpce-0eb37fc8ea8a2946e`)
     - Security Groups: `hmi-cert-api-sg` and `hmi-cert-rds-sg`

2. **CloudFormation Status**:
   - Zero (0) CloudFormation stacks exist in Account `212641463846`.
   - The existing resources were provisioned manually or via script.
   - Per architecture rules, we must **not** destroy or recreate existing healthy resources. We will create clean, modular CloudFormation templates that import or reference existing resources through parameters, with `DeletionPolicy: Retain`.

---

## 2. Resource Inventory (Account `212641463846`)

### A. Networking (`ap-south-1`)

| Resource | ID / Identifier | CIDR / Configuration | Status & Tags |
| :--- | :--- | :--- | :--- |
| **VPC** | `vpc-04aab780a5aa62ac1` | `10.20.0.0/16` | Available, `Name: hmi-cert-vpc` |
| **Public Subnet 1** | `subnet-02bd64999afe6e6b2` | `10.20.0.0/20` (AZ: `ap-south-1a`) | `Name: hmi-cert-subnet-public1-ap-south-1a` |
| **Public Subnet 2** | `subnet-0f0078eb008458a23` | `10.20.16.0/20` (AZ: `ap-south-1b`) | `Name: hmi-cert-subnet-public2-ap-south-1b` |
| **Private Subnet 1** | `subnet-0e98e1ebe943e8044` | `10.20.128.0/20` (AZ: `ap-south-1a`) | `Name: hmi-cert-subnet-private1-ap-south-1a` |
| **Private Subnet 2** | `subnet-02213cb57c647d762` | `10.20.144.0/20` (AZ: `ap-south-1b`) | `Name: hmi-cert-subnet-private2-ap-south-1b` |
| **Internet Gateway** | `igw-0525858da52786dff` | Attached to `vpc-04aab780a5aa62ac1` | `Name: hmi-cert-igw` |
| **Public Route Table** | `rtb-083ca5394b44f494b` | `0.0.0.0/0` -> `igw-0525858da52786dff` | Associated with Public Subnets 1 & 2 |
| **Private Route Table 1** | `rtb-0b2f5c9f38d8f4bd1` | S3 PrefixList -> `vpce-0eb37fc8ea8a2946e` | Associated with Private Subnet 1 |
| **Private Route Table 2** | `rtb-0aeef677d293dc582` | S3 PrefixList -> `vpce-0eb37fc8ea8a2946e` | Associated with Private Subnet 2 |
| **S3 Gateway Endpoint** | `vpce-0eb37fc8ea8a2946e` | `com.amazonaws.ap-south-1.s3` (Gateway) | `Name: hmi-cert-vpce-s3` (Zero Cost) |
| **NAT Gateways** | *None* | *None* | Cost-conscious architecture (No NAT charges) |

### B. Security Groups (`ap-south-1`)

| Security Group ID | Group Name | Description | Inbound Rules | Outbound Rules |
| :--- | :--- | :--- | :--- | :--- |
| `sg-020819c796ff23596` | `hmi-cert-api-sg` | Security group for HMI certificate API server | *Currently empty* (Needs HTTP 3000/80) | `0.0.0.0/0` (All traffic) |
| `sg-0eceb8b60da05d7ec` | `hmi-cert-rds-sg` | Allow PostgreSQL access from HMI API only | TCP `5432` from `sg-020819c796ff23596` | `0.0.0.0/0` (All traffic) |
| `sg-092f1da7ad81a6757` | `default` | Default VPC security group | Self-referencing default | `0.0.0.0/0` |

### C. Database — Amazon RDS (`ap-south-1`)

| Setting | Value | Verification Notes |
| :--- | :--- | :--- |
| **DB Instance Identifier** | `hmi-cert-postgres` | Available |
| **Engine & Version** | PostgreSQL 18.3 | Target database engine |
| **Instance Class** | `db.t4g.micro` | 2 vCPU, 1 GB RAM, ARM Graviton2 (Cost-optimized) |
| **Allocated Storage** | 20 GB gp2 | Storage Autoscaling enabled |
| **Storage Encryption** | Enabled | Encrypted with AWS KMS key `1a7ebad5-b3d1-48e6-981d-4052200879d7` |
| **Public Accessibility** | `False` | Securely private; isolated in private subnets |
| **Subnet Group** | `hmi-cert-db-subnet-group` | Covers Private Subnet 1 & Private Subnet 2 |
| **Multi-AZ** | `False` | Single-AZ deployment per budget guidelines |
| **Master Username** | `hmi_admin` | PostgreSQL admin user |
| **Database Name** | `hmi_certificates` | Target database for Drizzle ORM |
| **Endpoint Address** | `hmi-cert-postgres.cdmi866iew37.ap-south-1.rds.amazonaws.com` | Port: `5432` |
| **Backup Retention** | 1 day | Automated backups enabled |

### D. Object Storage — Amazon S3

| Bucket Name | Region | Account | Public Access Block | Default Encryption | Role / Classification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `hmi-cert-pdfs-212641463846-ap-south-1` | `ap-south-1` | `212641463846` | Full Block Enabled | AES256 (SSE-S3) | Existing in target account; matches VPC & RDS region. |
| `certify-certificate-bucket` | `us-east-1` | `102726256500` | Full Block Enabled | AES256 (SSE-S3) | Owned by second account (`default` profile). |
| `crce-tag-lifecycle-leroy` | `us-east-1` | `212641463846` | Full Block Enabled | AES256 (SSE-S3) | Unrelated workload. Do not touch. |
| `resume-website-sample` | `us-east-1` | `212641463846` | Full Block Enabled | AES256 (SSE-S3) | Unrelated static site. Do not touch. |

### E. Compute, IAM, Identity, and Monitoring (`ap-south-1`)

- **EC2 Instances**: 0 running or stopped instances in `ap-south-1`.
- **IAM Instance Profiles**: 0 instance profiles. (An EC2 role for SSM + S3 + CloudWatch is missing).
- **Cognito User Pools**: 0 user pools in `ap-south-1` or `us-east-1`. (Missing).
- **Systems Manager Parameter Store**: 0 parameters. (Missing secrets/config storage).
- **Secrets Manager**: 0 secrets.
- **CloudWatch Log Groups / Alarms**: 0 log groups or alarms in `ap-south-1`. (Missing).
- **SNS Topics**: 0 topics in `ap-south-1`. (Missing).
- **AWS Budgets**: 1 budget configured in `212641463846` (`AWS Budget`, $1.00 USD monthly limit).

---

## 3. Resource Classification (Phase 2)

### Category 1: Existing and Suitable for Reuse
1. **VPC (`vpc-04aab780a5aa62ac1`) & Subnets**: Perfectly configured dual-AZ VPC with 2 public subnets (`10.20.0.0/20`, `10.20.16.0/20`) and 2 private subnets (`10.20.128.0/20`, `10.20.144.0/20`).
2. **Internet Gateway (`igw-0525858da52786dff`) & Route Tables**: Public route table already attached to IGW.
3. **S3 Gateway Endpoint (`vpce-0eb37fc8ea8a2946e`)**: Free VPC endpoint giving private subnets and future EC2 direct high-speed S3 access without NAT data charges.
4. **RDS PostgreSQL (`hmi-cert-postgres`)**: Modern PostgreSQL 18.3 on `db.t4g.micro`, 20GB encrypted storage, private accessibility, automated backups. Database name: `hmi_certificates`.
5. **Security Groups**: `hmi-cert-rds-sg` already restricts port 5432 to `hmi-cert-api-sg`.
6. **S3 Bucket (`hmi-cert-pdfs-212641463846-ap-south-1`)**: Private, AES256 encrypted, zero objects, co-located in Mumbai with compute and database.

### Category 2: Existing Requiring Configuration
1. **Security Group `hmi-cert-api-sg` (`sg-020819c796ff23596`)**: Needs inbound TCP port `3000` (or `80`) to allow frontend API calls from the browser.
2. **S3 Bucket `hmi-cert-pdfs-212641463846-ap-south-1`**: Needs CORS configuration allowing `PUT` from the frontend origin (`http://localhost:5173` or deployed web domain) for presigned participant CSV imports.

### Category 3: Missing and Needing Creation
1. **IAM Role & Instance Profile for EC2**:
   - `AmazonSSMManagedInstanceCore` for secure keyless SSH/terminal via AWS Systems Manager Session Manager.
   - S3 least-privilege policy allowing `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` for `certificate-pdfs/*` and `participant-imports/*`.
   - CloudWatch Logs policy allowing writing application logs to `/aws/hmi-cert/api`.
2. **EC2 Instance for Hono API**:
   - Linux instance (Amazon Linux 2023 ARM64 on `t4g.micro` or `t4g.small` to match Graviton efficiency).
   - Deployed into Public Subnet 1 (`subnet-02bd64999afe6e6b2`) with public IPv4 for external client access.
   - User Data script to install Node.js 22, configure PM2 / systemd, pull SSM config, and start the Hono API server.
3. **Cognito User Pool & App Client**:
   - User Pool: `hmi-cert-user-pool` with email sign-in, self-service registration, and verification code delivery.
   - App Client: `hmi-cert-web-client` (Public SPA client, no client secret, SRP auth flow enabled).
4. **Systems Manager Parameter Store**:
   - Secure parameters for runtime configuration:
     - `/hmi-cert/api/database-url`: PostgreSQL connection string.
     - `/hmi-cert/api/s3-bucket`: Target certificate bucket name.
     - `/hmi-cert/api/cognito-user-pool-id`: Cognito pool ID.
     - `/hmi-cert/api/cognito-client-id`: Cognito app client ID.
     - `/hmi-cert/api/auth-web-origin`: Frontend origin.
5. **CloudWatch Monitoring & SNS**:
   - CloudWatch Log Group: `/aws/hmi-cert/api` (retention 14 days to minimize costs).
   - Metric Alarms: RDS High CPU (>80%), RDS Low Storage (<2GB), EC2 StatusCheckFailed.
   - SNS Topic: `hmi-cert-operational-alerts` with email subscription for alarms.

### Category 4: Existing Unrelated / Unsafe to Modify
- S3 Bucket `crce-tag-lifecycle-leroy` (us-east-1)
- S3 Bucket `resume-website-sample` (us-east-1)
- EC2 Instance `i-05c9f898452e272dd` (`FreshRSS-Prod-Lab4`, us-east-1)
- Default VPC `vpc-0eca6fc1a623cea52` (ap-south-1)
- Unrelated IAM users (`user1`, `role-auditor`, etc.) and roles (`CRCE-SafeRole`, `CRCE-UnsafeRole`).

### Category 5: Uncertain Decision Requiring User Input
- **S3 Bucket Selection**:
  - *Option A (Recommended)*: Use `hmi-cert-pdfs-212641463846-ap-south-1` in Account `212641463846` (`ap-south-1`). All infrastructure remains in the same account and same region, with zero inter-region data transfer fees and zero cross-account IAM friction, routed securely through `vpce-0eb37fc8ea8a2946e`.
  - *Option B*: Use `certify-certificate-bucket` in Account `102726256500` (`us-east-1`). This requires configuring cross-account IAM role assumption / cross-account bucket policies and incurs cross-region data transfer charges between Mumbai and N. Virginia.
- **RDS Master Password**:
  - The master username is `hmi_admin`. Does the user possess the existing master password, or should we issue an RDS `modify-db-instance --master-user-password` to set a fresh secure password and store it in SSM Parameter Store? (Modifying the master password on RDS takes effect immediately without instance reboot or data loss).

---

## 4. CloudFormation Architecture & Modular Template Design (Phase 3)

We will structure the CloudFormation templates under `infrastructure/`:

```
infrastructure/
├── 01-networking-security.yaml  # API Security Group update / rules
├── 02-iam-roles.yaml           # EC2 IAM Role & Instance Profile (SSM + S3 + CW)
├── 03-cognito.yaml             # Cognito User Pool & Public App Client
├── 04-s3-configuration.yaml    # S3 CORS & Bucket Configuration
├── 05-parameters.yaml          # SSM Parameter Store for application config
├── 06-ec2-backend.yaml         # EC2 AL2023 instance with systemd service & user-data
├── 07-monitoring-alerts.yaml   # CloudWatch Log Group, Metric Alarms & SNS Topic
└── parameters/
    ├── dev.json                # Parameter values referencing existing VPC, subnets, RDS
    └── prod.json
```

---

## 5. Cost & Security Analysis (Phase 7)

### Estimated Monthly AWS Cost (ap-south-1):
- **RDS PostgreSQL (`db.t4g.micro`, 20GB gp2)**: ~$13.50 / month (or $0 if within AWS Free Tier 750 hrs/month for 12 months).
- **EC2 Instance (`t4g.micro`, AL2023, 10GB gp3)**: ~$6.20 / month (or $0 under Free Tier).
- **S3 Storage & Requests**: Minimal (<$0.50 / month for certificates and import CSVs).
- **VPC Gateway Endpoint (S3)**: **$0.00** (Free, no hourly or data fees).
- **Cognito User Pools**: **$0.00** (Free tier covers up to 50,000 monthly active users).
- **Systems Manager Parameter Store (Standard)**: **$0.00** (Free).
- **CloudWatch Logs & Metrics**: ~$0.50 / month (5GB free ingestion).
- **SNS (Email Alerts)**: **$0.00** (First 1,000 email notifications free).
- **Estimated Total**: **~$20.00 / month** (Without Free Tier) or **~$0 - $5 / month** (With AWS Free Tier).

### Security Posture:
- Database is completely private with no public IP address.
- Port 5432 is strictly whitelisted to the API security group.
- EC2 uses keyless AWS Systems Manager Session Manager (no port 22 exposed to internet).
- IAM roles use least privilege (scoped to `/certificate-pdfs/*` and `/participant-imports/*`).
- No permanent AWS access keys or secrets embedded in source code or frontend bundles.
