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
GITHUB_REPO="https://github.com/phidinhmanh/Contacless-Order-Service.git"
DEPLOY_DIR="/opt/contacless-order"

# --- 1. SCRIPT PRE-CHECKS ---
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

echo "🚀 Starting Contacless Order Service Deployment..."
echo "================================================"

# --- 2. INSTALL SYSTEM DEPENDENCIES ---
echo "📦 Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq git curl openssl python3 python3-pip python3-venv postgresql-client

# --- 3. INSTALL UV (ASTRAL PACKAGE MANAGER) ---
if ! command -v uv &> /dev/null; then
    echo "📦 Installing uv (Astral package manager)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
    echo "✅ uv installed successfully."
else
    echo "✅ uv is already installed ($(uv --version))"
fi

# --- 4. AUTO-INSTALL DOCKER (IDEMPOTENT) ---
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
    apt-get install -y -qq docker-compose-plugin
    echo "✅ Docker Compose plugin installed."
else
    echo "✅ Docker Compose already available"
fi

# --- 5. GIT WORKFLOW (CLONE OR SYNC CODE) ---
echo "🔄 Setting up code from GitHub..."

# Clone if the directory doesn't exist, otherwise sync
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "📥 Cloning repository to $DEPLOY_DIR..."
    git clone "$GITHUB_REPO" "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
else
    cd "$DEPLOY_DIR"
    git fetch origin
    
    # Check if we are already on release branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$CURRENT_BRANCH" != "release" ]; then
        echo "🔀 Switching from $CURRENT_BRANCH to release..."
        git checkout release
    fi
    
    echo "📥 Pulling latest changes..."
    git pull origin release
fi
echo "✅ Code sync complete."

# --- 6. ENSURE CONFIG DIRECTORIES ---
mkdir -p nginx data static/images/foods static/qr_codes

# --- 7. CREATE .env FILE (IF MISSING) ---
if [ ! -f .env ]; then
    echo "📝 Creating bootstrap .env file..."
    cat > .env <<EOF
APP_NAME=${APP_NAME}
SECRET_KEY=$(openssl rand -hex 32)
DATABASE_URL=postgresql://postgres:postgres@db:5432/contacless_order
VIETQR_BANK_ID=
VIETQR_ACCOUNT_NO=
VIETQR_ACCOUNT_NAME=
EOF
    echo "✅ .env file created"
else
    # Ensure DATABASE_URL exists in existing .env
    if ! grep -q "DATABASE_URL=" .env; then
        echo "DATABASE_URL=postgresql://postgres:postgres@db:5432/contacless_order" >> .env
        echo "✅ DATABASE_URL added to existing .env"
    fi
fi

# --- 8. BUILD & DEPLOY CONTAINERS ---
echo ""
echo "🏗️ Building and launching production containers..."
docker compose -f docker-compose.prod.yml up -d --build

# --- 9. WAIT FOR DATABASE ---
echo ""
echo "⏳ Waiting for PostgreSQL database to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

until docker compose -f docker-compose.prod.yml exec -T db pg_isready -U postgres > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Database failed to start after ${MAX_RETRIES} attempts"
        exit 1
    fi
    echo "   Waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

echo "✅ PostgreSQL database is ready"

# --- 10. RUN DATABASE MIGRATIONS ---
echo ""
echo "🔄 Running Alembic database migrations..."

# Run migrations inside the backend container
if docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migration failed"
    echo "   Check logs with: docker compose -f docker-compose.prod.yml logs backend"
    exit 1
fi

# --- 11. HEALTH CHECK ---
echo ""
echo "⏳ Waiting for services to become healthy..."
sleep 10

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

# --- 12. OUTPUT RESULTS ---
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
echo "   View logs:       docker compose -f docker-compose.prod.yml logs -f"
echo "   Backend logs:    docker compose -f docker-compose.prod.yml logs -f backend"
echo "   Database logs:   docker compose -f docker-compose.prod.yml logs -f db"
echo "   Stop:            docker compose -f docker-compose.prod.yml down"
echo "   Restart:         docker compose -f docker-compose.prod.yml restart"
echo "   Run migrations:  docker compose -f docker-compose.prod.yml exec backend alembic upgrade head"
echo ""
echo "🔐 To enable public HTTPS access via Cloudflare Tunnel:"
echo "   1. Edit docker-compose.prod.yml"
echo "   2. Uncomment the 'tunnel' service"
echo "   3. Run: docker compose -f docker-compose.prod.yml up -d tunnel"
echo ""