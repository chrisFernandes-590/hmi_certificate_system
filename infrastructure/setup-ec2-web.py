#!/usr/bin/env python3
"""
setup-ec2-web.py: Deploys the built frontend to EC2, configures Nginx, updates API .env, and restarts services.
"""

import os
import re
import subprocess
import sys

def run(cmd, check=True):
    print(f"--> Running: {cmd}")
    res = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.stdout:
        print(res.stdout.strip())
    if res.stderr:
        print(f"[stderr] {res.stderr.strip()}", file=sys.stderr)
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed with code {res.returncode}: {cmd}")
    return res

def main():
    print("=== Starting EC2 Web Deployment ===")

    # 1. Download web build from S3
    s3_uri = "s3://hmi-cert-pdfs-212641463846-ap-south-1/participant-imports/web-dist.tar.gz"
    tar_path = "/tmp/web-dist.tar.gz"
    web_dir = "/var/www/hmi-cert/html"

    print(f"Downloading frontend bundle from {s3_uri}...")
    run(f"aws s3 cp {s3_uri} {tar_path} --region ap-south-1")

    print(f"Extracting frontend bundle to {web_dir}...")
    run(f"mkdir -p {web_dir}")
    # Clean previous web files if any
    run(f"rm -rf {web_dir}/*")
    run(f"tar -xzf {tar_path} -C {web_dir}")
    run(f"chown -R nginx:nginx /var/www/hmi-cert")
    run(f"chmod -R 755 /var/www/hmi-cert")
    print(f"Web assets extracted. Listing {web_dir}:")
    run(f"ls -la {web_dir}")

    # 2. Modify /etc/nginx/nginx.conf to disable default server block
    nginx_conf_path = "/etc/nginx/nginx.conf"
    if os.path.exists(nginx_conf_path):
        with open(nginx_conf_path, "r") as f:
            content = f.read()

        # Backup nginx.conf if not already backed up
        if not os.path.exists(nginx_conf_path + ".orig"):
            with open(nginx_conf_path + ".orig", "w") as f:
                f.write(content)

        # If it contains root /usr/share/nginx/html, comment it out
        if "root         /usr/share/nginx/html;" in content:
            # Pattern matches from `server {` down to its closing brace
            pattern = r"([ \t]*server\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*root\s+/usr/share/nginx/html;[^{}]*(?:\{[^{}]*\}[^{}]*)*\})"
            match = re.search(pattern, content)
            if match:
                matched_block = match.group(1)
                commented = "\n".join("# " + line for line in matched_block.splitlines())
                content = content[:match.start()] + "# [Disabled default server]\n" + commented + content[match.end():]
                with open(nginx_conf_path, "w") as f:
                    f.write(content)
                print("Default server block in /etc/nginx/nginx.conf successfully disabled.")
            else:
                print("Default server block pattern didn't match directly, checking if already modified.")
        else:
            print("Default server block already removed or not present.")

    # 3. Create /etc/nginx/conf.d/hmi-cert.conf
    hmi_nginx_conf = """# HMI Certificate Management System - Nginx Reverse Proxy & Static Site
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

    # Client body size for CSV imports and certificate documents
    client_max_body_size 25M;

    # Standard Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Health check direct pass-through
    location = /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API passthrough to backend Hono process
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

    # Static assets caching (Vite content-hashed bundles)
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
"""
    with open("/etc/nginx/conf.d/hmi-cert.conf", "w") as f:
        f.write(hmi_nginx_conf)
    print("Created /etc/nginx/conf.d/hmi-cert.conf")

    # 4. Verify nginx configuration syntax
    run("nginx -t")

    # 5. Enable and restart nginx
    run("systemctl enable nginx")
    run("systemctl restart nginx")
    run("systemctl status nginx --no-pager")

    # 6. Update /opt/hmi-cert/app/apps/api/.env
    api_env_path = "/opt/hmi-cert/app/apps/api/.env"
    if os.path.exists(api_env_path):
        with open(api_env_path, "r") as f:
            env_content = f.read()

        public_ip = "13.233.212.183"
        env_content = re.sub(r"AUTH_WEB_ORIGIN=.*", f"AUTH_WEB_ORIGIN=http://{public_ip}", env_content)
        env_content = re.sub(r"AUTH_APP_BASE_URL=.*", f"AUTH_APP_BASE_URL=http://{public_ip}", env_content)
        env_content = re.sub(r"CERTIFICATE_PUBLIC_VERIFY_BASE_URL=.*", f"CERTIFICATE_PUBLIC_VERIFY_BASE_URL=http://{public_ip}/verify", env_content)

        with open(api_env_path, "w") as f:
            f.write(env_content)
        print("Updated /opt/hmi-cert/app/apps/api/.env with public IP configuration.")

    # 7. Reload PM2 API process
    run("pm2 reload hmi-api")
    run("pm2 status")

    # 8. Local validation tests
    print("\n--- Validating local endpoints ---")
    run("curl -s -o /dev/null -w 'HTTP GET /: %{http_code}\\n' http://127.0.0.1/")
    run("curl -s -o /dev/null -w 'HTTP GET /login: %{http_code}\\n' http://127.0.0.1/login")
    run("curl -s -o /dev/null -w 'HTTP GET /verify: %{http_code}\\n' http://127.0.0.1/verify")
    run("curl -s -o /dev/null -w 'HTTP GET /health: %{http_code}\\n' http://127.0.0.1/health")
    run("curl -s -o /dev/null -w 'HTTP GET /api/health: %{http_code}\\n' http://127.0.0.1/api/health")

    print("\n=== Deployment Completed Successfully! ===")

if __name__ == "__main__":
    main()
