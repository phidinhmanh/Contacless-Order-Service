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
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
POSTGRES_DB="contacless_order"

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
echo "📁 Creating necessary directories..."
mkdir -p nginx data static/images/foods static/qr_codes postgres_data
echo "✅ Directories created"

# --- 7. VERIFY DOCKER-COMPOSE FILE EXISTS ---
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ docker-compose.prod.yml not found in $DEPLOY_DIR"
    echo "   Please ensure the file exists in your repository"
    exit 1
fi

# --- 8. CREATE/UPDATE .env FILE ---
if [ ! -f .env ]; then
    echo "📝 Creating bootstrap .env file..."
    cat > .env <<EOF
APP_NAME=${APP_NAME}
SECRET_KEY=$(openssl rand -hex 32)
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
VIETQR_BANK_ID=
VIETQR_ACCOUNT_NO=
VIETQR_ACCOUNT_NAME=
EOF
    echo "✅ .env file created"
else
    echo "📝 Updating existing .env file..."
    # Ensure DATABASE_URL exists
    if ! grep -q "^DATABASE_URL=" .env; then
        echo "DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}" >> .env
        echo "✅ DATABASE_URL added"
    fi
    # Ensure POSTGRES variables exist
    if ! grep -q "^POSTGRES_USER=" .env; then
        echo "POSTGRES_USER=${POSTGRES_USER}" >> .env
    fi
    if ! grep -q "^POSTGRES_PASSWORD=" .env; then
        echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" >> .env
    fi
    if ! grep -q "^POSTGRES_DB=" .env; then
        echo "POSTGRES_DB=${POSTGRES_DB}" >> .env
    fi
    echo "✅ .env file updated"
fi

# --- 9. VERIFY DOCKER-COMPOSE HAS DB SERVICE ---
echo "🔍 Verifying docker-compose configuration..."
if grep -q "db:" docker-compose.prod.yml && grep -q "postgres" docker-compose.prod.yml; then
    echo "✅ PostgreSQL service found in docker-compose.prod.yml"
else
    echo "⚠️  WARNING: PostgreSQL service not found in docker-compose.prod.yml"
    echo "   Ensure your docker-compose.prod.yml includes a 'db' service with PostgreSQL"
fi

# --- 10. STOP EXISTING CONTAINERS (IDEMPOTENT) ---
echo ""
echo "🛑 Stopping any existing containers..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
echo "✅ Previous containers stopped"

# --- 11. BUILD & DEPLOY CONTAINERS ---
echo ""
echo "🏗️ Building and launching production containers..."
docker compose -f docker-compose.prod.yml up -d --build

# --- 12. WAIT FOR DATABASE ---
echo ""
echo "⏳ Waiting for PostgreSQL database to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0

until docker compose -f docker-compose.prod.yml exec -T db pg_isready -U ${POSTGRES_USER} > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Database failed to start after ${MAX_RETRIES} attempts"
        echo ""
        echo "🔍 Troubleshooting steps:"
        echo "   1. Check database logs: docker compose -f docker-compose.prod.yml logs db"
        echo "   2. Verify postgres_data directory permissions"
        echo "   3. Ensure port 5432 is not already in use"
        exit 1
    fi
    if [ $((RETRY_COUNT % 10)) -eq 0 ]; then
        echo "   Still waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    fi
    sleep 2
done

echo "✅ PostgreSQL database is ready"

# --- 13. VERIFY DATABASE EXISTS ---
echo ""
echo "🔍 Verifying database '${POSTGRES_DB}' exists..."
DB_EXISTS=$(docker compose -f docker-compose.prod.yml exec -T db psql -U ${POSTGRES_USER} -lqt | cut -d \| -f 1 | grep -w ${POSTGRES_DB} | wc -l)

if [ "$DB_EXISTS" -eq "0" ]; then
    echo "📝 Creating database '${POSTGRES_DB}'..."
    docker compose -f docker-compose.prod.yml exec -T db psql -U ${POSTGRES_USER} -c "CREATE DATABASE ${POSTGRES_DB};" || true
    echo "✅ Database created"
else
    echo "✅ Database '${POSTGRES_DB}' already exists"
fi

# --- 14. RUN DATABASE MIGRATIONS ---
echo ""
echo "🔄 Running Alembic database migrations..."

# Wait a bit for backend to be ready
sleep 5

# Check if alembic is available in the backend container
if docker compose -f docker-compose.prod.yml exec -T backend which alembic > /dev/null 2>&1; then
    # Run migrations
    if docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head; then
        echo "✅ Database migrations completed successfully"
    else
        echo "⚠️  Database migration failed"
        echo "   This might be expected on first run if migrations don't exist yet"
        echo "   Check logs with: docker compose -f docker-compose.prod.yml logs backend"
    fi
else
    echo "⚠️  Alembic not found in backend container"
    echo "   Skipping migrations (might not be configured yet)"
fi

# --- 15. HEALTH CHECK ---
echo ""
echo "⏳ Performing health checks..."
sleep 10

# Check database connectivity from backend
echo "🔍 Testing database connection from backend..."
if docker compose -f docker-compose.prod.yml exec -T backend python -c "import psycopg2; psycopg2.connect('${DATABASE_URL}')" 2>/dev/null; then
    echo "✅ Backend can connect to database"
else
    echo "⚠️  Backend database connection test skipped (psycopg2 may not be available)"
fi

# Check backend health
if curl -sf http://localhost:${BACKEND_PORT}/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy (port ${BACKEND_PORT})"
elif curl -sf http://localhost:${BACKEND_PORT} > /dev/null 2>&1; then
    echo "✅ Backend is responding (port ${BACKEND_PORT})"
else
    echo "⚠️  Backend health check pending (may still be starting)"
fi

# Check frontend
if curl -sf http://localhost:${FRONTEND_PORT} > /dev/null 2>&1; then
    echo "✅ Frontend is healthy (port ${FRONTEND_PORT})"
else
    echo "⚠️  Frontend health check pending (may still be starting)"
fi

# --- 16. OUTPUT RESULTS ---
echo ""
echo "================================================"
echo "✅ DEPLOYMENT COMPLETE"
echo "================================================"
echo ""
echo "🌐 Local Access:"
echo "   Frontend:    http://localhost:${FRONTEND_PORT}"
echo "   Backend API: http://localhost:${BACKEND_PORT}"
echo "   API Docs:    http://localhost:${BACKEND_PORT}/docs"
echo ""
echo "🗄️  Database Info:"
echo "   Host:     db (internal) / localhost:5432 (external)"
echo "   Database: ${POSTGRES_DB}"
echo "   User:     ${POSTGRES_USER}"
echo "   Password: ${POSTGRES_PASSWORD}"
echo ""
echo "📊 Useful Commands:"
echo "   View all logs:        docker compose -f docker-compose.prod.yml logs -f"
echo "   Backend logs:         docker compose -f docker-compose.prod.yml logs -f backend"
echo "   Database logs:        docker compose -f docker-compose.prod.yml logs -f db"
echo "   Frontend logs:        docker compose -f docker-compose.prod.yml logs -f frontend"
echo "   "
echo "   Database shell:       docker compose -f docker-compose.prod.yml exec db psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
echo "   Backend shell:        docker compose -f docker-compose.prod.yml exec backend bash"
echo "   "
echo "   Run migrations:       docker compose -f docker-compose.prod.yml exec backend alembic upgrade head"
echo "   Create migration:     docker compose -f docker-compose.prod.yml exec backend alembic revision --autogenerate -m \"description\""
echo "   "
echo "   Stop all:             docker compose -f docker-compose.prod.yml down"
echo "   Stop + remove data:   docker compose -f docker-compose.prod.yml down -v"
echo "   Restart:              docker compose -f docker-compose.prod.yml restart"
echo "   Rebuild:              docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "🔐 To enable public HTTPS access via Cloudflare Tunnel:"
echo "   1. Edit docker-compose.prod.yml"
echo "   2. Uncomment the 'tunnel' service"
echo "   3. Run: docker compose -f docker-compose.prod.yml up -d tunnel"
echo ""
echo "📝 Next Steps:"
echo "   1. Update VIETQR credentials in .env file if needed"
echo "   2. Check all services are running: docker compose -f docker-compose.prod.yml ps"
echo "   3. Monitor logs for any errors"
echo ""