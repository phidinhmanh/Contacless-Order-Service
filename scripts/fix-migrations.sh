#!/bin/bash

# ============================================================================
# 🔧 FIX ALEMBIC MIGRATIONS - Create True Initial Migration
# ============================================================================
# This script fixes broken migration chain by creating a proper initial
# migration that creates all base tables from SQLAlchemy models
# ============================================================================

set -e

COMPOSE_FILE="docker-compose.prod.yml"

echo "🔧 Fixing Alembic Migration Chain"
echo "================================="
echo ""

# Check if running from project root
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ Error: docker-compose.prod.yml not found"
    echo "   Please run this script from the project root directory"
    exit 1
fi

# Backup existing migrations
echo "📦 Backing up existing migrations..."
BACKUP_DIR="alembic/versions_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r alembic/versions/*.py "$BACKUP_DIR/" 2>/dev/null || true
echo "✅ Backed up to $BACKUP_DIR"
echo ""

# Option 1: Clean slate approach
echo "🗑️  Option 1: Clean Slate (Recommended for fresh deployment)"
echo "   This will:"
echo "   - Delete all existing migrations"
echo "   - Generate one complete initial migration from models"
echo "   - Preserve data if DB already exists"
echo ""

read -p "Use clean slate approach? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 Removing old migrations..."
    rm -f alembic/versions/*.py

    echo "📝 Creating __init__.py..."
    touch alembic/versions/__init__.py

    echo "✅ Old migrations removed"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Start database: docker compose -f $COMPOSE_FILE up -d db"
    echo "   2. Start backend: docker compose -f $COMPOSE_FILE up -d backend"
    echo "   3. Generate migration: docker compose -f $COMPOSE_FILE exec backend alembic revision --autogenerate -m 'initial_schema'"
    echo "   4. Apply migration: docker compose -f $COMPOSE_FILE exec backend alembic upgrade head"
    echo ""
    echo "Or run full deployment:"
    echo "   sudo ./deploy-wsl-debian.sh"

else
    # Option 2: Fix migration chain manually
    echo ""
    echo "🔧 Option 2: Manual Fix"
    echo "   You chose to manually fix migrations."
    echo ""
    echo "Current migration files (sorted by timestamp):"
    ls -1t alembic/versions/*.py | grep -v __init__ | while read file; do
        revision=$(grep "^revision:" "$file" | cut -d"'" -f2)
        down_rev=$(grep "^down_revision:" "$file" | cut -d"'" -f2)
        echo "   - $(basename $file)"
        echo "     Revision: $revision"
        echo "     Depends on: $down_rev"
        echo ""
    done

    echo "🔍 To fix manually:"
    echo "   1. Identify the TRUE first migration (creates base tables)"
    echo "   2. Set its down_revision to None"
    echo "   3. Fix the dependency chain"
    echo ""
    echo "   Or delete all and regenerate (see Option 1)"
fi

echo ""
echo "📚 Documentation:"
echo "   Alembic docs: https://alembic.sqlalchemy.org/en/latest/"
echo "   Backup location: $BACKUP_DIR"
