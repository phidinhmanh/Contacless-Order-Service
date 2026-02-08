#!/bin/bash
set -e

# ============================================================================
# 🍜 CONTACLESS ORDER SERVICE - WSL DEBIAN DEPLOYMENT
# ============================================================================
# Deployment script for WSL2 Debian
# Run: chmod +x deploy-wsl-debian.sh && sudo ./deploy-wsl-debian.sh
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

echo "🚀 Starting Contacless Order Service Deployment (WSL Debian)..."
echo "================================================================"

# --- 2. WSL DETECTION ---
if grep -qi microsoft /proc/version; then
    echo "🐧 Detected WSL environment"

    # Check WSL version - Docker requires WSL2
    if grep -qi "WSL2\|microsoft-standard" /proc/version; then
        echo "✅ WSL2 detected (required for Docker)"
    else
        # Alternative check via kernel version
        KERNEL_VERSION=$(uname -r)
        if [[ $KERNEL_VERSION == *"microsoft"* && ! $KERNEL_VERSION == *"Microsoft"* ]]; then
            echo "✅ WSL2 detected (kernel: $KERNEL_VERSION)"
        else
            echo "❌ WSL1 detected - Docker requires WSL2"
            echo "   To upgrade to WSL2, run in PowerShell as Administrator:"
            echo "   wsl --set-version Debian 2"
            echo ""
            read -p "Continue anyway? (not recommended) (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
else
    echo "ℹ️  Not running in WSL (native Linux detected)"
fi

# --- 3. INSTALL SYSTEM DEPENDENCIES ---
echo "📦 Installing system dependencies for Debian..."
run_cmd apt-get update -qq
run_cmd apt-get install -y -qq \
    git \
    curl \
    openssl \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    gnupg \
    lsb-release

# --- 4. INSTALL UV (ASTRAL PACKAGE MANAGER) ---
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

# --- 5. DOCKER INSTALLATION (WSL-AWARE) ---
if ! command -v docker &> /dev/null; then
    echo "📦 Docker not found."
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "For WSL, we recommend using Docker Desktop for Windows:"
    echo "  1. Download: https://www.docker.com/products/docker-desktop"
    echo "  2. Install Docker Desktop"
    echo "  3. Enable 'WSL 2 based engine' in settings"
    echo "  4. Enable integration with your Debian distro"
    echo "  5. Restart WSL: wsl --shutdown (in PowerShell)"
    echo "  6. Re-run this script"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    read -p "Install Docker Engine directly in WSL instead? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Installing Docker Engine for Debian..."

        # Add Docker's official GPG key
        run_cmd mkdir -p /etc/apt/keyrings
        run_cmd_eval "curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg"

        # Set up the repository
        run_cmd_eval "echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \$(lsb_release -cs) stable\" | tee /etc/apt/sources.list.d/docker.list > /dev/null"

        # Install Docker Engine
        run_cmd apt-get update -qq
        run_cmd apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

        # Note: systemctl may not work in WSL, Docker Desktop handles this
        if command -v systemctl &> /dev/null && systemctl is-system-running &> /dev/null; then
            run_cmd systemctl enable --now docker
            echo "✅ Docker service enabled"
        else
            echo "⚠️  systemctl not available (normal in WSL)"
            echo "   Docker daemon will be managed by init system or Docker Desktop"
        fi

        echo "✅ Docker Engine installed"
    else
        echo "❌ Docker installation cancelled."
        echo "   Please install Docker Desktop for Windows and re-run this script."
        exit 1
    fi
else
    echo "✅ Docker is already installed ($(docker --version))"
fi

# Ensure Docker Compose plugin is present
if ! docker compose version &> /dev/null; then
    echo "📦 Docker Compose plugin missing. Installing..."
    run_cmd apt-get install -y -qq docker-compose-plugin
    echo "✅ Docker Compose plugin installed"
else
    echo "✅ Docker Compose already available ($(docker compose version))"
fi

# Test Docker connectivity
if [[ "${DRY_RUN}" != "1" ]]; then
    if ! docker info &> /dev/null; then
        echo "⚠️  Docker daemon not accessible."
        echo ""
        echo "Troubleshooting:"
        echo "  - If using Docker Desktop: ensure it's running and WSL integration is enabled"
        echo "  - If using Docker Engine: try 'sudo service docker start'"
        echo "  - WSL may need restart: wsl --shutdown (in PowerShell)"
        echo ""
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# --- 6. GIT WORKFLOW (CLONE OR SYNC CODE) ---
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
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    if [ "$CURRENT_BRANCH" != "release" ]; then
        echo "🔀 Switching from $CURRENT_BRANCH to release..."
        run_cmd git checkout release
    fi

    echo "📥 Pulling latest changes..."
    run_cmd git pull origin release
fi
echo "✅ Code sync complete."

# --- 7. ENSURE CONFIG DIRECTORIES ---
run_cmd mkdir -p nginx data static/images/foods static/qr_codes

# Create docs directory if needed
run_cmd mkdir -p docs

# --- 8. CREATE .env FILE (IF MISSING) ---
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
CLOUDFLARE_TUNNEL_TOKEN=
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
    if [[ "${DRY_RUN}" != "1" ]] && ! grep -q "CLOUDFLARE_TUNNEL_TOKEN=" .env; then
        echo "CLOUDFLARE_TUNNEL_TOKEN=" >> .env
        echo "✅ CLOUDFLARE_TUNNEL_TOKEN added to existing .env"
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

# --- 9. BUILD & DEPLOY CONTAINERS ---
echo ""
echo "🏗️ Building and launching production containers..."
run_cmd docker compose -f docker-compose.prod.yml up -d --build

# --- 10. WAIT FOR DATABASE ---
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

# --- 11. VERIFY DATABASE EXISTS ---
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

# --- 12. RUN DATABASE MIGRATIONS ---
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
        echo "   This might be normal if models aren't set up yet"
    fi
fi

# Run migrations inside the backend container
echo "🔄 Applying migrations..."
if run_cmd docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head 2>&1 | tee /tmp/migration_output.log; then
    echo "✅ Database migrations completed successfully"
else
    # Check for specific errors
    if grep -qi "relation.*does not exist" /tmp/migration_output.log 2>/dev/null; then
        echo ""
        echo "❌ Migration failed: Database tables don't exist"
        echo ""
        echo "🔧 SOLUTION:"
        echo "   Your migrations assume tables already exist."
        echo "   Run the migration fix script:"
        echo ""
        echo "   bash scripts/fix-migrations.sh"
        echo ""
        echo "   Or manually regenerate migrations:"
        echo "   1. Backup: cp -r alembic/versions alembic/versions_backup"
        echo "   2. Delete: rm alembic/versions/*.py && touch alembic/versions/__init__.py"
        echo "   3. Generate: docker compose -f docker-compose.prod.yml exec backend alembic revision --autogenerate -m 'initial_schema'"
        echo "   4. Apply: docker compose -f docker-compose.prod.yml exec backend alembic upgrade head"
        echo ""
    else
        echo "❌ Database migration failed"
        echo "   Check logs with: docker compose -f docker-compose.prod.yml logs backend"
    fi

    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# --- 13. HEALTH CHECK ---
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

# --- 14. OUTPUT RESULTS ---
echo ""
echo "================================================================"
echo "✅ DEPLOYMENT COMPLETE (WSL Debian)"
echo "================================================================"
echo ""
echo "🌐 Access from Windows:"
echo "   Frontend:    http://localhost:${FRONTEND_PORT}"
echo "   Backend API: http://localhost:${BACKEND_PORT}"
echo "   API Docs:    http://localhost:${BACKEND_PORT}/docs"
echo ""
echo "🌐 Access from LAN (if WSL2 networking configured):"
echo "   Use Windows host IP address"
echo ""
echo "🗄️  Database Info:"
echo "   Host:     db (internal) / localhost:5432 (from Windows)"
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
echo "   1. See docs/cloudflare-tunnel-setup.md for detailed instructions"
echo "   2. Get your tunnel token from Cloudflare Zero Trust dashboard"
echo "   3. Add CLOUDFLARE_TUNNEL_TOKEN to .env file"
echo "   4. Edit docker-compose.prod.yml and uncomment the 'tunnel' service"
echo "   5. Run: docker compose -f docker-compose.prod.yml up -d tunnel"
echo ""
echo "🔧 Next steps:"
echo "   1. Create admin: docker compose -f docker-compose.prod.yml exec backend python scripts/create_admin.py"
echo "   2. Seed data:    docker compose -f docker-compose.prod.yml exec backend python scripts/seed_data.py"
echo "   3. Configure VietQR credentials in .env"
echo "   4. Verify:       bash scripts/verify-deployment.sh"
echo ""
