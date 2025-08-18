#!/bin/bash
set -euo pipefail

# ------- Vars from Terraform templatefile(...) -------
DB_USER="${db_user}"
DB_PASSWORD="${db_password}"
DB_NAME="${db_name}"

BACKEND_IMAGE="${backend_image}"
FRONTEND_IMAGE="${frontend_image}"

AWS_REGION="${aws_region}"
S3_BUCKET="${s3_bucket}"
S3_PUBLIC_READ="${s3_public_read}"

CW_LOGS_BACKEND="${cw_logs_backend}"
CW_LOGS_FRONTEND="${cw_logs_frontend}"
CW_LOGS_POSTGRES="${cw_logs_postgres}"
# ----------------------------------------------------

# --- Install Docker (Amazon Linux 2023) ---
if command -v dnf >/dev/null 2>&1; then
  dnf -y update
  dnf -y install docker
else
  yum -y update || true
  yum -y install docker || true
fi
systemctl enable --now docker
usermod -aG docker ec2-user || true

# --- App network & persistent dirs ---
docker network create resqpost-net || true
docker volume create resqpost_pgdata || true
mkdir -p /opt/resqpost/uploads
chmod 777 /opt/resqpost/uploads

# --- Start Postgres (container) ---
docker rm -f resqpost-db 2>/dev/null || true
docker run -d --name resqpost-db \
  --network resqpost-net \
  -e POSTGRES_DB="$DB_NAME" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -v resqpost_pgdata:/var/lib/postgresql/data \
  --health-cmd="pg_isready -U $DB_USER -d $DB_NAME" \
  --health-interval=10s --health-timeout=5s --health-retries=10 \
  --log-driver=awslogs \
  --log-opt awslogs-region="$AWS_REGION" \
  --log-opt awslogs-group="$CW_LOGS_POSTGRES" \
  --log-opt awslogs-create-group=true \
  --restart unless-stopped \
  postgres:15-alpine

# Wait for DB healthy
echo "[BOOT] Waiting for Postgres to become healthy..."
for i in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' resqpost-db 2>/dev/null || echo starting)"
  if [ "$status" = "healthy" ]; then
    echo "[BOOT] Postgres is healthy."
    break
  fi
  sleep 2
done

# --- Backend (Flask via gunicorn/eventlet) ---
docker pull "$BACKEND_IMAGE" || true
docker rm -f resqpost-backend 2>/dev/null || true

# URL-encode DB password for SQLAlchemy URL (handles !:@/# etc.)
DB_PASS_URLENCODED="$(
  DB_PASSWORD="$DB_PASSWORD" python3 - <<'PY'
import os, urllib.parse
print(urllib.parse.quote(os.environ["DB_PASSWORD"]))
PY
)"

DATABASE_URL="postgresql+psycopg2://$DB_USER:$DB_PASS_URLENCODED@resqpost-db:5432/$DB_NAME"

docker run -d --name resqpost-backend \
  --network resqpost-net --network-alias backend \
  -p 5000:5000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SECRET_KEY="prod-secret" \
  -e FLASK_ENV="production" \
  -e TZ="America/Toronto" \
  -e AWS_REGION="$AWS_REGION" \
  -e S3_BUCKET="$S3_BUCKET" \
  -e S3_PUBLIC_READ="$S3_PUBLIC_READ" \
  -e S3_SIGN_EXPIRES=300 \
  -v /opt/resqpost/uploads:/app/uploads \
  --log-driver=awslogs \
  --log-opt awslogs-region="$AWS_REGION" \
  --log-opt awslogs-group="$CW_LOGS_BACKEND" \
  --log-opt awslogs-create-group=true \
  --restart unless-stopped \
  "$BACKEND_IMAGE" \
  gunicorn -k eventlet -w 1 -b 0.0.0.0:5000 \
    --access-logfile - --error-logfile - --log-level info app:app

# --- Frontend Nginx config with S3 redirect ---
mkdir -p /opt/resqpost/nginx
if [ "$AWS_REGION" = "us-east-1" ]; then
  S3_HOST="$S3_BUCKET.s3.amazonaws.com"
else
  S3_HOST="$S3_BUCKET.s3.$AWS_REGION.amazonaws.com"
fi

cat >/opt/resqpost/nginx/default.conf <<NGX
server {
  listen 80;
  root /usr/share/nginx/html;
  client_max_body_size 25m;
  access_log /dev/stdout;
  error_log  /dev/stderr notice;
  location / { index index.html index.htm; try_files \$uri \$uri/ /index.html; }
  location ^~ /api/ {
    proxy_pass http://backend:5000;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_redirect off;
  }
  location ^~ /uploads/ { return 302 https://$S3_HOST\$uri; }
  location ~* \.(?:js|css)$ { add_header Cache-Control "public, max-age=0, must-revalidate"; try_files \$uri =404; }
  location ~* \.(?:png|jpg|jpeg|gif|ico|svg|webp|avif)$ { expires 1y; add_header Cache-Control "public, immutable"; try_files \$uri =404; }
  location = /index.html { add_header Cache-Control "no-store" always; }
}
NGX

# Run frontend with the mounted config
docker rm -f resqpost-frontend 2>/dev/null || true
docker run -d --name resqpost-frontend \
  --network resqpost-net \
  -p 80:80 \
  -v /opt/resqpost/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro \
  --log-driver=awslogs \
  --log-opt awslogs-region="$AWS_REGION" \
  --log-opt awslogs-group="$CW_LOGS_FRONTEND" \
  --log-opt awslogs-create-group=true \
  --restart unless-stopped \
  "$FRONTEND_IMAGE"


# Redirect legacy /uploads/* to S3 if a bucket is configured
if [ -n "$S3_BUCKET" ]; then
  if [ "$AWS_REGION" = "us-east-1" ]; then
    S3_HOST="$S3_BUCKET.s3.amazonaws.com"
  else
    S3_HOST="$S3_BUCKET.s3.$AWS_REGION.amazonaws.com"
  fi

  # NOTE: $S3_HOST is expanded by *this* shell. \$uri stays literal for Nginx.
  docker exec -i resqpost-frontend sh -lc "cat > /etc/nginx/conf.d/s3-uploads.conf" <<NGX
location ^~ /uploads/ {
  return 302 https://$S3_HOST\$uri;
}
NGX

  docker exec resqpost-frontend nginx -s reload || docker exec resqpost-frontend kill -HUP 1 || true
fi

echo "[BOOT] All containers launched."
docker ps
