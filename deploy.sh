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
POSTGRES_USER_DEFAULT="postgres"
POSTGRES_PASSWORD_DEFAULT="postgres"
POSTGRES_DB_DEFAULT="contacless_order"
DRY_RUN="${DRY_RUN:-0}"

run_cmd() {
    if [[ "${DRY_RUN}" == "1" ]]; then
        echo "🧪 DRY RUN: $*"
        return 0
    fi
    "$@"
}

run_cmd_eval() {
    if [[ "${DRY_RUN}" == "1" ]]; then
        echo "🧪 DRY RUN: $*"
        return 0
    fi
    eval "$@"
}

# --- 1. SCRIPT PRE-CHECKS ---
if [[ $EUID -ne 0 && "${DRY_RUN}" != "1" ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

echo "🚀 Starting Contacless Order Service Deployment..."
echo "================================================"

# --- 2. INSTALL SYSTEM DEPENDENCIES ---
echo "📦 Installing system dependencies..."
run_cmd apt-get update -qq
run_cmd apt-get install -y -qq git curl openssl python3 python3-pip python3-venv

# --- 3. INSTALL UV (ASTRAL PACKAGE MANAGER) ---
if ! command -v uv &> /dev/null; then
    echo "📦 Installing uv (Astral package manager)..."
    run_cmd_eval "curl -LsSf https://astral.sh/uv/install.sh | sh"
    if [[ "${DRY_RUN}" != "1" ]]; then
        export PATH="$HOME/.cargo/bin:$PATH"
    fi
    echo "✅ uv install step completed."
else
    echo "✅ uv is already installed ($(uv --version))"
fi

# --- 4. AUTO-INSTALL DOCKER (IDEMPOTENT) ---
if ! command -v docker &> /dev/null; then
    echo "📦 Docker not found. Installing now..."
    run_cmd curl -fsSL https://get.docker.com -o get-docker.sh
    run_cmd sh get-docker.sh
    run_cmd rm get-docker.sh
    run_cmd systemctl enable --now docker
    echo "✅ Docker install step completed."
else
    echo "✅ Docker is already installed ($(docker --version))"
fi

# Ensure Docker Compose plugin is present
if ! docker compose version &> /dev/null; then
    echo "📦 Docker Compose plugin missing. Installing..."
    run_cmd apt-get install -y -qq docker-compose-plugin
    echo "✅ Docker Compose plugin install step completed."
else
    echo "✅ Docker Compose already available"
fi

# --- 5. GIT WORKFLOW (CLONE OR SYNC CODE) ---
echo "🔄 Setting up code from GitHub..."

# Clone if the directory doesn't exist, otherwise sync
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "📥 Cloning repository to $DEPLOY_DIR..."
    run_cmd git clone "$GITHUB_REPO" "$DEPLOY_DIR"
    if [[ "${DRY_RUN}" != "1" ]]; then
        cd "$DEPLOY_DIR"
    fi
else
    if [[ "${DRY_RUN}" != "1" ]]; then
        cd "$DEPLOY_DIR"
    fi
    run_cmd git fetch origin
    
    # Check if we are already on release branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$CURRENT_BRANCH" != "release" ]; then
        echo "🔀 Switching from $CURRENT_BRANCH to release..."
        run_cmd git checkout release
    fi
    
    echo "📥 Pulling latest changes..."
    run_cmd git pull origin release
fi
echo "✅ Code sync complete."

# --- 6. ENSURE CONFIG DIRECTORIES ---
run_cmd mkdir -p nginx data static/images/foods static/qr_codes

# --- 7. CREATE .env FILE (IF MISSING) ---
if [ ! -f .env ] && [[ "${DRY_RUN}" != "1" ]]; then
    echo "📝 Creating bootstrap .env file..."
    cat > .env <<EOF
APP_NAME=${APP_NAME}
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_USER=${POSTGRES_USER_DEFAULT}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD_DEFAULT}
POSTGRES_DB=${POSTGRES_DB_DEFAULT}
DATABASE_URL=postgresql://${POSTGRES_USER_DEFAULT}:${POSTGRES_PASSWORD_DEFAULT}@db:5432/${POSTGRES_DB_DEFAULT}
VIETQR_BANK_ID=
VIETQR_ACCOUNT_NO=
VIETQR_ACCOUNT_NAME=
EOF
    echo "✅ .env file created"
else
    if [[ "${DRY_RUN}" == "1" ]]; then
        echo "🧪 DRY RUN: skipping .env creation/update"
    fi
    # Ensure DATABASE_URL exists in existing .env
    if [[ "${DRY_RUN}" != "1" ]] && ! grep -q "POSTGRES_USER=" .env; then
        echo "POSTGRES_USER=${POSTGRES_USER_DEFAULT}" >> .env
        echo "✅ POSTGRES_USER added to existing .env"
    fi
    if [[ "${DRY_RUN}" != "1" ]] && ! grep -q "POSTGRES_PASSWORD=" .env; then
        echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD_DEFAULT}" >> .env
        echo "✅ POSTGRES_PASSWORD added to existing .env"
    fi
    if [[ "${DRY_RUN}" != "1" ]] && ! grep -q "POSTGRES_DB=" .env; then
        echo "POSTGRES_DB=${POSTGRES_DB_DEFAULT}" >> .env
        echo "✅ POSTGRES_DB added to existing .env"
    fi
    if [[ "${DRY_RUN}" != "1" ]] && ! grep -q "DATABASE_URL=" .env; then
        echo "DATABASE_URL=postgresql://${POSTGRES_USER_DEFAULT}:${POSTGRES_PASSWORD_DEFAULT}@db:5432/${POSTGRES_DB_DEFAULT}" >> .env
        echo "✅ DATABASE_URL added to existing .env"
    fi
fi

if [[ "${DRY_RUN}" != "1" ]]; then
    set -a
    # shellcheck source=/dev/null
    source .env
    set +a
fi

POSTGRES_USER="${POSTGRES_USER:-$POSTGRES_USER_DEFAULT}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$POSTGRES_PASSWORD_DEFAULT}"
POSTGRES_DB="${POSTGRES_DB:-$POSTGRES_DB_DEFAULT}"

# --- 8. BUILD & DEPLOY CONTAINERS ---
echo ""
echo "🏗️ Building and launching production containers..."
run_cmd docker compose -f docker-compose.prod.yml up -d --build

# --- 12. WAIT FOR DATABASE ---
echo ""
echo "⏳ Waiting for PostgreSQL database to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0

until run_cmd docker compose -f docker-compose.prod.yml exec -T db pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Database failed to start after ${MAX_RETRIES} attempts"
        run_cmd docker compose -f docker-compose.prod.yml logs db --tail 50
        exit 1
    fi
    echo "   Waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    run_cmd sleep 2
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

# Check if migrations exist
MIGRATION_COUNT=$(find alembic/versions -name "*.py" ! -name "__init__.py" 2>/dev/null | wc -l)

if [ "$MIGRATION_COUNT" -eq "0" ]; then
    echo "⚠️  No migration files found!"
    echo ""
    echo "📝 Creating initial migration from models..."
    if run_cmd docker compose -f docker-compose.prod.yml exec -T backend alembic revision --autogenerate -m "initial_schema"; then
        echo "✅ Initial migration created"
    else
        echo "❌ Failed to create migration"
    fi
fi

# Run migrations inside the backend container
echo "🔄 Applying migrations..."

# Capture output and exit code properly
set +e  # Temporarily disable exit on error
MIGRATION_OUTPUT=$(mktemp)
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head 2>&1 | tee "$MIGRATION_OUTPUT"
MIGRATION_EXIT_CODE=${PIPESTATUS[0]:-$?}
set -e  # Re-enable exit on error

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo "✅ Database migrations completed successfully"
    rm -f "$MIGRATION_OUTPUT"
else
    echo ""
    echo "❌ Database migration FAILED (exit code: $MIGRATION_EXIT_CODE)"
    echo ""

    # Check for specific error patterns
    if grep -qi "relation.*does not exist" "$MIGRATION_OUTPUT" 2>/dev/null; then
        echo "🔍 Error: Database tables don't exist - migration chain broken"
        echo ""
        echo "🔧 SOLUTION:"
        echo "   bash scripts/fix-migrations.sh"
        echo ""
        echo "   Or see: docs/migration-fix-guide.md"
        echo ""
    fi

    cat "$MIGRATION_OUTPUT"
    rm -f "$MIGRATION_OUTPUT"

    echo ""
    echo "❌ Deployment failed - fix migrations before continuing"
    exit 1
fi

# --- 15. HEALTH CHECK ---
echo ""
echo "⏳ Waiting for services to become healthy..."
run_cmd sleep 10

# Check backend health
if run_cmd curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Backend health check pending (may still be starting)"
fi

# Check frontend
if run_cmd curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
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
