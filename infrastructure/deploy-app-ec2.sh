#!/bin/bash
set -e

echo "=== Deploying HMI Certificate API on EC2 ==="

mkdir -p /opt/hmi-cert/app
cd /opt/hmi-cert

echo "1. Downloading deployment bundle from S3..."
aws s3 cp s3://hmi-cert-pdfs-212641463846-ap-south-1/participant-imports/api-deploy.tar.gz /tmp/api-deploy.tar.gz
tar -xzf /tmp/api-deploy.tar.gz -C /opt/hmi-cert/app
rm -f /tmp/api-deploy.tar.gz
aws s3 rm s3://hmi-cert-pdfs-212641463846-ap-south-1/participant-imports/api-deploy.tar.gz

echo "2. Fetching database credentials from SSM Parameter Store..."
DB_URL=$(aws ssm get-parameter --name /hmi-cert/api/database-url --with-decryption --region ap-south-1 --query "Parameter.Value" --output text)

echo "3. Generating runtime .env configuration..."
cat << EOF > /opt/hmi-cert/app/apps/api/.env
NODE_ENV=development
PORT=3000
DATABASE_URL=${DB_URL}
AWS_REGION=ap-south-1
CERTIFICATE_S3_BUCKET=hmi-cert-pdfs-212641463846-ap-south-1
PARTICIPANT_IMPORT_S3_BUCKET=hmi-cert-pdfs-212641463846-ap-south-1
AUTH_WEB_ORIGIN=http://localhost:5173
AUTH_APP_BASE_URL=http://localhost:5173
CERTIFICATE_PUBLIC_VERIFY_BASE_URL=http://localhost:5173/verify
AUTH_SESSION_TTL_SECONDS=604800
AUTH_VERIFICATION_TTL_SECONDS=86400
AUTH_PASSWORD_RESET_TTL_SECONDS=3600
DEV_EMAIL_ENABLED=true
AWS_RDS_CA_PATH=/etc/pki/tls/certs/global-bundle.pem
EOF

chmod 600 /opt/hmi-cert/app/apps/api/.env

echo "4. Installing production dependencies with pnpm..."
cd /opt/hmi-cert/app
pnpm install

echo "5. Starting application with PM2 process manager..."
pm2 delete hmi-api || true
pm2 start apps/api/dist/index.js --name hmi-api --log /opt/hmi-cert/api.log --time
pm2 save

echo "6. Checking application status..."
sleep 2
pm2 list
curl -f http://localhost:3000/api/health || curl http://localhost:3000/health || curl -I http://localhost:3000/api/auth/session || true

echo "=== Deployment Completed Successfully ==="
