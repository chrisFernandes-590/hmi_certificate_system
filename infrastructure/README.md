# HMI Certificate System — AWS Infrastructure Deployment Guide

## Overview

This directory contains modular, auditable AWS CloudFormation templates designed to deploy and connect the required AWS services for the **Title Certificate Generation and Verification Management System**.

The target region is **`ap-south-1` (Mumbai)** using the authenticated AWS CLI profile **`antigravity`**.

---

## Architecture Stacks

| Order | Stack Name | Template | Responsibilities |
| :--- | :--- | :--- | :--- |
| **1** | `hmi-cert-networking-security` | `01-networking-security.yaml` | Ingress rules for port 3000, 80, 443 on existing `hmi-cert-api-sg` (`sg-020819c796ff23596`) |
| **2** | `hmi-cert-iam-roles` | `02-iam-roles.yaml` | EC2 Instance Role & Profile with `AmazonSSMManagedInstanceCore`, S3 least privilege, and Parameter Store read |
| **3** | `hmi-cert-cognito` | `03-cognito.yaml` | Cognito User Pool & Public SPA App Client (SRP auth, no client secret) |
| **4** | *S3 CORS Update* | `s3-cors-config.json` | CORS for browser uploads to `hmi-cert-pdfs-212641463846-ap-south-1` |
| **5** | `hmi-cert-parameters` | `05-parameters.yaml` | SSM Parameter Store runtime configuration |
| **6** | `hmi-cert-ec2-backend` | `06-ec2-backend.yaml` | EC2 Amazon Linux 2023 ARM64 server in public subnet `subnet-02bd64999afe6e6b2` |
| **7** | `hmi-cert-monitoring-alerts` | `07-monitoring-alerts.yaml` | CloudWatch Log Group (`/aws/hmi-cert/api`), Alarms (EC2 status, RDS CPU/Storage), and SNS Alert Topic |

---

## Deployment CLI Commands

All commands use `--profile antigravity --region ap-south-1`.

### Step 1: Deploy Networking Security Group Rules
```bash
aws cloudformation execute-change-set \
  --change-set-name initial-plan \
  --stack-name hmi-cert-networking-security \
  --profile antigravity --region ap-south-1
```

### Step 2: Deploy IAM Roles and Instance Profile
```bash
aws cloudformation execute-change-set \
  --change-set-name initial-plan \
  --stack-name hmi-cert-iam-roles \
  --profile antigravity --region ap-south-1
```

### Step 3: Deploy Cognito User Pool & App Client
```bash
aws cloudformation execute-change-set \
  --change-set-name initial-plan \
  --stack-name hmi-cert-cognito \
  --profile antigravity --region ap-south-1
```

### Step 4: Apply S3 Bucket CORS for Browser Uploads
```bash
aws s3api put-bucket-cors \
  --bucket hmi-cert-pdfs-212641463846-ap-south-1 \
  --cors-configuration file://infrastructure/s3-cors-config.json \
  --profile antigravity --region ap-south-1
```

### Step 5: Deploy SSM Parameters
```bash
# Retrieve Cognito outputs
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name hmi-cert-cognito --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text --profile antigravity --region ap-south-1)
APP_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name hmi-cert-cognito --query "Stacks[0].Outputs[?OutputKey=='AppClientId'].OutputValue" --output text --profile antigravity --region ap-south-1)

aws cloudformation deploy \
  --template-file infrastructure/05-parameters.yaml \
  --stack-name hmi-cert-parameters \
  --parameter-overrides \
    CertificateBucketName=hmi-cert-pdfs-212641463846-ap-south-1 \
    CognitoUserPoolId=$USER_POOL_ID \
    CognitoClientId=$APP_CLIENT_ID \
    AuthWebOrigin=http://localhost:5173 \
    Port=3000 \
  --profile antigravity --region ap-south-1
```

### Step 6: Deploy EC2 Application Server
```bash
INSTANCE_PROFILE=$(aws cloudformation describe-stacks --stack-name hmi-cert-iam-roles --query "Stacks[0].Outputs[?OutputKey=='InstanceProfileName'].OutputValue" --output text --profile antigravity --region ap-south-1)

aws cloudformation deploy \
  --template-file infrastructure/06-ec2-backend.yaml \
  --stack-name hmi-cert-ec2-backend \
  --parameter-overrides \
    VpcId=vpc-04aab780a5aa62ac1 \
    PublicSubnetId=subnet-02bd64999afe6e6b2 \
    ApiSecurityGroupId=sg-020819c796ff23596 \
    InstanceProfileName=$INSTANCE_PROFILE \
    InstanceType=t4g.micro \
  --profile antigravity --region ap-south-1
```

### Step 7: Deploy Monitoring & Alerts
```bash
EC2_ID=$(aws cloudformation describe-stacks --stack-name hmi-cert-ec2-backend --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" --output text --profile antigravity --region ap-south-1)

aws cloudformation deploy \
  --template-file infrastructure/07-monitoring-alerts.yaml \
  --stack-name hmi-cert-monitoring-alerts \
  --parameter-overrides \
    Ec2InstanceId=$EC2_ID \
    RdsInstanceIdentifier=hmi-cert-postgres \
    NotificationEmail="" \
  --profile antigravity --region ap-south-1
```

---

## Safe Verification Commands

1. **Verify EC2 SSM Session Manager (No port 22 needed)**:
   ```bash
   aws ssm start-session --target $EC2_ID --profile antigravity --region ap-south-1
   ```

2. **Verify EC2 to S3 Connectivity**:
   ```bash
   aws ssm send-command \
     --document-name "AWS-RunShellScript" \
     --targets "Key=instanceids,Values=$EC2_ID" \
     --parameters 'commands=["aws s3 ls s3://hmi-cert-pdfs-212641463846-ap-south-1/"]' \
     --profile antigravity --region ap-south-1
   ```

3. **Verify EC2 to RDS Connectivity**:
   ```bash
   aws ssm send-command \
     --document-name "AWS-RunShellScript" \
     --targets "Key=instanceids,Values=$EC2_ID" \
     --parameters 'commands=["nc -zv hmi-cert-postgres.cdmi866iew37.ap-south-1.rds.amazonaws.com 5432"]' \
     --profile antigravity --region ap-south-1
   ```
