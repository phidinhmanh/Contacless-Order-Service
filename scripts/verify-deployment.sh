#!/bin/bash

# ============================================================================
# 🍜 CONTACLESS ORDER SERVICE - DEPLOYMENT VERIFICATION
# ============================================================================
# Post-deployment health check script
# Run: bash scripts/verify-deployment.sh
# ============================================================================

set -e

COMPOSE_FILE="docker-compose.prod.yml"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================================"
echo "🔍 DEPLOYMENT VERIFICATION"
echo "================================================================"
echo ""

# Check if docker-compose.prod.yml exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ docker-compose.prod.yml not found${NC}"
    echo "   Please run this script from the project root directory"
    exit 1
fi

# Function to check if a service is running
check_service() {
    local service=$1
    if docker compose -f "$COMPOSE_FILE" ps "$service" 2>/dev/null | grep -q "Up\|running"; then
        echo -e "${GREEN}✅ $service container is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $service container is not running${NC}"
        return 1
    fi
}

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local name=$2
    if curl -sf "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name is accessible ($url)${NC}"
        return 0
    else
        echo -e "${RED}❌ $name is not accessible ($url)${NC}"
        return 1
    fi
}

# --- 1. CONTAINER STATUS ---
echo -e "${BLUE}1. Checking Container Status${NC}"
echo "-----------------------------------"

REQUIRED_SERVICES=("db" "backend" "frontend" "nginx")
OPTIONAL_SERVICES=("tunnel")

SERVICES_OK=true

for service in "${REQUIRED_SERVICES[@]}"; do
    if ! check_service "$service"; then
        SERVICES_OK=false
    fi
done

# Check optional services
for service in "${OPTIONAL_SERVICES[@]}"; do
    if docker compose -f "$COMPOSE_FILE" ps "$service" 2>/dev/null | grep -q "Up\|running"; then
        echo -e "${GREEN}✅ $service container is running (optional)${NC}"
    else
        echo -e "${YELLOW}ℹ️  $service container is not running (optional - OK)${NC}"
    fi
done

echo ""

# --- 2. DATABASE HEALTH ---
echo -e "${BLUE}2. Checking Database Health${NC}"
echo "-----------------------------------"

if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"

    # Check if database exists
    DB_NAME=$(grep "POSTGRES_DB=" .env 2>/dev/null | cut -d= -f2 || echo "contacless_order")
    if docker compose -f "$COMPOSE_FILE" exec -T db psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        echo -e "${GREEN}✅ Database '$DB_NAME' exists${NC}"
    else
        echo -e "${RED}❌ Database '$DB_NAME' not found${NC}"
        SERVICES_OK=false
    fi
else
    echo -e "${RED}❌ PostgreSQL is not ready${NC}"
    SERVICES_OK=false
fi

echo ""

# --- 3. BACKEND HEALTH ---
echo -e "${BLUE}3. Checking Backend Health${NC}"
echo "-----------------------------------"

if check_endpoint "http://localhost:8000/health" "Backend health endpoint"; then
    # Try to get API version/info
    if curl -sf http://localhost:8000/api/v1/menu > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend API is responding (menu endpoint)${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend API menu endpoint failed (may need seeding)${NC}"
    fi
else
    SERVICES_OK=false
fi

echo ""

# --- 4. FRONTEND HEALTH ---
echo -e "${BLUE}4. Checking Frontend Health${NC}"
echo "-----------------------------------"

if check_endpoint "http://localhost:3000" "Frontend"; then
    # Frontend is accessible
    true
else
    SERVICES_OK=false
fi

echo ""

# --- 5. NGINX REVERSE PROXY ---
echo -e "${BLUE}5. Checking Nginx Reverse Proxy${NC}"
echo "-----------------------------------"

# Check if nginx is proxying to backend
if curl -sf http://localhost/api/v1/menu > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx is proxying API requests correctly${NC}"
else
    echo -e "${YELLOW}⚠️  Nginx API proxy failed (check nginx config or backend)${NC}"
fi

# Check if nginx is proxying to frontend
if curl -sf http://localhost > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx is proxying frontend requests correctly${NC}"
else
    echo -e "${RED}❌ Nginx frontend proxy failed${NC}"
    SERVICES_OK=false
fi

# Check if static files are served
if curl -sf http://localhost/static/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx is serving static files${NC}"
else
    echo -e "${YELLOW}ℹ️  Nginx static file serving not verified (may be empty)${NC}"
fi

echo ""

# --- 6. CLOUDFLARE TUNNEL (OPTIONAL) ---
echo -e "${BLUE}6. Checking Cloudflare Tunnel (Optional)${NC}"
echo "-----------------------------------"

if docker compose -f "$COMPOSE_FILE" ps tunnel 2>/dev/null | grep -q "Up\|running"; then
    echo -e "${GREEN}✅ Tunnel container is running${NC}"

    # Check tunnel logs for successful connection
    if docker compose -f "$COMPOSE_FILE" logs tunnel 2>/dev/null | grep -q "Connection.*registered\|registered tunnel connection"; then
        echo -e "${GREEN}✅ Tunnel connection registered with Cloudflare${NC}"
        echo -e "${BLUE}ℹ️  Check Cloudflare Zero Trust dashboard for public URL${NC}"
    else
        echo -e "${YELLOW}⚠️  Tunnel container running but connection not confirmed${NC}"
        echo "   Check logs: docker compose -f $COMPOSE_FILE logs tunnel"
    fi
else
    echo -e "${YELLOW}ℹ️  Tunnel is not enabled (optional)${NC}"
    echo "   To enable: see docs/cloudflare-tunnel-setup.md"
fi

echo ""

# --- 7. DATABASE MIGRATIONS ---
echo -e "${BLUE}7. Checking Database Migrations${NC}"
echo "-----------------------------------"

if docker compose -f "$COMPOSE_FILE" exec -T backend alembic current 2>&1 | grep -q "head\|[a-f0-9]\{12\}"; then
    echo -e "${GREEN}✅ Database migrations are up to date${NC}"
else
    echo -e "${YELLOW}⚠️  Database migrations may not be applied${NC}"
    echo "   Run: docker compose -f $COMPOSE_FILE exec backend alembic upgrade head"
fi

echo ""

# --- 8. ENVIRONMENT CONFIGURATION ---
echo -e "${BLUE}8. Checking Environment Configuration${NC}"
echo "-----------------------------------"

if [ -f .env ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"

    # Check for required environment variables
    REQUIRED_VARS=("SECRET_KEY" "DATABASE_URL" "POSTGRES_USER" "POSTGRES_PASSWORD" "POSTGRES_DB")
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${var}=" .env 2>/dev/null; then
            VALUE=$(grep "^${var}=" .env | cut -d= -f2)
            if [ -n "$VALUE" ] && [ "$VALUE" != "" ]; then
                echo -e "${GREEN}  ✓ $var is set${NC}"
            else
                echo -e "${RED}  ✗ $var is empty${NC}"
                SERVICES_OK=false
            fi
        else
            echo -e "${RED}  ✗ $var is missing${NC}"
            SERVICES_OK=false
        fi
    done

    # Check optional variables
    if grep -q "^VIETQR_BANK_ID=" .env && [ -n "$(grep "^VIETQR_BANK_ID=" .env | cut -d= -f2)" ]; then
        echo -e "${GREEN}  ✓ VietQR credentials configured${NC}"
    else
        echo -e "${YELLOW}  ℹ️  VietQR credentials not configured (optional)${NC}"
    fi

    if grep -q "^CLOUDFLARE_TUNNEL_TOKEN=" .env && [ -n "$(grep "^CLOUDFLARE_TUNNEL_TOKEN=" .env | cut -d= -f2)" ]; then
        echo -e "${GREEN}  ✓ Cloudflare tunnel token configured${NC}"
    else
        echo -e "${YELLOW}  ℹ️  Cloudflare tunnel token not configured (optional)${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
    SERVICES_OK=false
fi

echo ""

# --- 9. VOLUME MOUNTS ---
echo -e "${BLUE}9. Checking Volume Mounts${NC}"
echo "-----------------------------------"

REQUIRED_DIRS=("static" "data" "nginx")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅ $dir directory exists${NC}"
    else
        echo -e "${RED}❌ $dir directory missing${NC}"
        SERVICES_OK=false
    fi
done

echo ""

# --- SUMMARY ---
echo "================================================================"
if [ "$SERVICES_OK" = true ]; then
    echo -e "${GREEN}✅ DEPLOYMENT VERIFICATION PASSED${NC}"
    echo ""
    echo "Your Contactless Order Service is running correctly!"
    echo ""
    echo "🌐 Access URLs:"
    echo "   Frontend:    http://localhost:3000"
    echo "   Backend API: http://localhost:8000"
    echo "   API Docs:    http://localhost:8000/docs"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Create admin user (if not done):"
    echo "      docker compose -f docker-compose.prod.yml exec backend python scripts/create_admin.py"
    echo ""
    echo "   2. Seed initial data (if not done):"
    echo "      docker compose -f docker-compose.prod.yml exec backend python scripts/seed_data.py"
    echo ""
    echo "   3. Configure payment gateway (optional):"
    echo "      Edit .env and set VIETQR_* variables"
    echo ""
    echo "   4. Enable Cloudflare Tunnel (optional):"
    echo "      See docs/cloudflare-tunnel-setup.md"
else
    echo -e "${RED}❌ DEPLOYMENT VERIFICATION FAILED${NC}"
    echo ""
    echo "Some checks failed. Please review the errors above."
    echo ""
    echo "📊 Troubleshooting:"
    echo "   - View all logs:     docker compose -f docker-compose.prod.yml logs -f"
    echo "   - View backend logs: docker compose -f docker-compose.prod.yml logs -f backend"
    echo "   - View db logs:      docker compose -f docker-compose.prod.yml logs -f db"
    echo "   - Restart services:  docker compose -f docker-compose.prod.yml restart"
    echo "   - Rebuild:           docker compose -f docker-compose.prod.yml up -d --build"
    exit 1
fi
echo "================================================================"
