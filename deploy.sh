#!/bin/bash
set -e

# ============================================================================
# 🍜 CONTACLESS ORDER SERVICE - ZERO-TOUCH DEPLOYMENT
# ============================================================================
# Idempotent deployment script for Ubuntu 22.04/24.04 LTS
# Run: chmod +x deploy.sh && sudo ./deploy.sh
# ============================================================================

# --- CONFIGURATION ---
APP_NAME="contacless-order"
FRONTEND_PORT=3000
BACKEND_PORT=8000

# --- 1. SCRIPT PRE-CHECKS ---
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

echo "🚀 Starting Contacless Order Service Deployment..."
echo "================================================"

# --- 2. AUTO-INSTALL DOCKER (IDEMPOTENT) ---
if ! command -v docker &> /dev/null; then
    echo "📦 Docker not found. Installing now..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable --now docker
    echo "✅ Docker installed successfully."
else
    echo "✅ Docker is already installed ($(docker --version))"
fi

# Ensure Docker Compose plugin is present
if ! docker compose version &> /dev/null; then
    echo "📦 Docker Compose plugin missing. Installing..."
    apt-get update -qq && apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose plugin installed."
else
    echo "✅ Docker Compose already available"
fi

# --- 3. CREATE PRODUCTION DOCKER-COMPOSE ---
echo "📝 Generating production docker-compose.yml..."

cat > docker-compose.prod.yml <<'EOF'
version: "3.9"

services:
  # ============ FASTAPI BACKEND ============
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${APP_NAME:-contacless}_backend
    environment:
      - SECRET_KEY=${SECRET_KEY:-changeme-in-production}
      - DATABASE_URL=sqlite:///./restaurant.db
      - VIETQR_BANK_ID=${VIETQR_BANK_ID:-}
      - VIETQR_ACCOUNT_NO=${VIETQR_ACCOUNT_NO:-}
      - VIETQR_ACCOUNT_NAME=${VIETQR_ACCOUNT_NAME:-}
    volumes:
      - ./data:/app/data
      - ./static:/app/static
    expose:
      - "8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped

  # ============ NEXT.JS FRONTEND ============
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: ${APP_NAME:-contacless}_frontend
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    depends_on:
      backend:
        condition: service_healthy
    expose:
      - "3000"
    restart: unless-stopped

  # ============ NGINX REVERSE PROXY ============
  nginx:
    image: nginx:alpine
    container_name: ${APP_NAME:-contacless}_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./static:/app/static:ro
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

  # ============ CLOUDFLARE TUNNEL (OPTIONAL) ============
  # Uncomment to enable free public HTTPS URL via trycloudflare.com
  # tunnel:
  #   image: cloudflare/cloudflared:latest
  #   container_name: ${APP_NAME:-contacless}_tunnel
  #   command: tunnel --url http://nginx:80
  #   depends_on:
  #     - nginx
  #   restart: unless-stopped

volumes:
  data:
EOF

# --- 4. CREATE BACKEND DOCKERFILE ---
if [ ! -f Dockerfile ]; then
    echo "📝 Creating Backend Dockerfile..."
    cat > Dockerfile <<'EOF'
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Copy application code
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

# Create directories for data
RUN mkdir -p data static/images/foods static/qr_codes

# Run migrations and start server
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
EOF
    echo "✅ Backend Dockerfile created"
fi

# --- 5. CREATE FRONTEND DOCKERFILE ---
if [ ! -f frontend/Dockerfile ]; then
    echo "📝 Creating Frontend Dockerfile..."
    cat > frontend/Dockerfile <<'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
EOF
    echo "✅ Frontend Dockerfile created"
fi

# --- 6. CREATE NGINX CONFIG ---
echo "📝 Creating Nginx configuration..."
cat > nginx.conf <<'EOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    upstream backend {
        server backend:8000;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name _;

        # API requests -> FastAPI
        location /api/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket -> FastAPI
        location /ws/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }

        # Static files
        location /static/ {
            alias /app/static/;
            expires 7d;
            add_header Cache-Control "public, immutable";
        }

        # Everything else -> Next.js
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
EOF
echo "✅ Nginx configuration created"

# --- 7. CREATE .env FILE ---
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env <<EOF
APP_NAME=${APP_NAME}
SECRET_KEY=$(openssl rand -hex 32)
VIETQR_BANK_ID=
VIETQR_ACCOUNT_NO=
VIETQR_ACCOUNT_NAME=
EOF
    echo "✅ .env file created (please configure VietQR settings)"
fi

# --- 8. BUILD & DEPLOY ---
echo ""
echo "🏗️ Building and launching containers..."
docker compose -f docker-compose.prod.yml up -d --build

# --- 9. HEALTH CHECK ---
echo ""
echo "⏳ Waiting for services to become healthy..."
sleep 15

# Check backend health
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "⚠️ Backend health check pending (may still be starting)"
fi

# Check frontend
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "⚠️ Frontend health check pending (may still be starting)"
fi

# --- 10. OUTPUT RESULTS ---
echo ""
echo "================================================"
echo "✅ DEPLOYMENT COMPLETE"
echo "================================================"
echo ""
echo "🌐 Local Access:"
echo "   Frontend: http://localhost"
echo "   API Docs: http://localhost/api/docs"
echo ""
echo "📊 Useful Commands:"
echo "   View logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "   Stop:         docker compose -f docker-compose.prod.yml down"
echo "   Restart:      docker compose -f docker-compose.prod.yml restart"
echo ""
echo "🔐 To enable public HTTPS access via Cloudflare Tunnel:"
echo "   1. Edit docker-compose.prod.yml"
echo "   2. Uncomment the 'tunnel' service"
echo "   3. Run: docker compose -f docker-compose.prod.yml up -d tunnel"
echo ""
