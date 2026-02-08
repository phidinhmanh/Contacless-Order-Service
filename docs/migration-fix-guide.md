# Migration Fix Guide

## Problem

Your Alembic migrations have a broken chain. The migration named "initial_migration" (`9b854bad1e9d`) is empty, and the actual migrations that modify tables assume base tables already exist.

## Current Migration Chain (Broken)

```
01c7b4519155_schema_improvements... (revises: 9b854bad1e9d)
  ├─ Tries to ADD COLUMN to 'foods' table
  └─ But 'foods' table doesn't exist yet!

9b854bad1e9d_initial_migration (revises: 766e5ff3335f)
  └─ Does nothing (empty pass statement)
```

## Solution Options

### Option 1: Automated Fix (Recommended)

Run the migration fix script:

```bash
bash scripts/fix-migrations.sh
```

This will:
1. Backup your existing migrations
2. Offer to delete and regenerate migrations from models
3. Guide you through the process

### Option 2: Manual Fix

If you want full control:

```bash
# 1. Backup existing migrations
cp -r alembic/versions alembic/versions_backup_manual

# 2. Remove broken migrations
rm alembic/versions/*.py
touch alembic/versions/__init__.py

# 3. Start services
docker compose -f docker-compose.prod.yml up -d db backend

# 4. Wait for backend to be ready
sleep 10

# 5. Generate fresh migration from your SQLAlchemy models
docker compose -f docker-compose.prod.yml exec backend alembic revision --autogenerate -m "initial_schema"

# 6. Review the generated migration
cat alembic/versions/*_initial_schema.py

# 7. Apply it
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 8. Verify
docker compose -f docker-compose.prod.yml exec backend alembic current
```

### Option 3: Keep Existing Migrations (Advanced)

If you have production data and need to preserve migration history:

1. Find which migration actually creates base tables (not just ALTER)
2. Edit that migration's `down_revision` to `None`
3. Fix the dependency chain
4. Test thoroughly

**Warning:** This is error-prone. Option 1 or 2 is safer.

## After Fixing

Run the deployment script normally:

```bash
sudo ./deploy-wsl-debian.sh
```

Or verify manually:

```bash
bash scripts/verify-deployment.sh
```

## Prevention

To avoid this in the future:

1. **Never manually edit migration chain** - let Alembic handle it
2. **Test migrations on fresh database** before committing
3. **Run `alembic current`** to verify migration state
4. **Use autogenerate** instead of manual migrations:
   ```bash
   alembic revision --autogenerate -m "description"
   ```

## Verification

After fixing, verify everything is correct:

```bash
# Check current migration state
docker compose -f docker-compose.prod.yml exec backend alembic current

# Should show something like:
# abc123def456 (head)

# Check database has tables
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d contacless_order -c "\dt"

# Should show: users, foods, orders, categories, tables, etc.
```

## Troubleshooting

**Q: Migration fails with "relation already exists"**
A: Your database has tables from a previous deployment. Either:
- Drop and recreate database (loses data)
- Use `alembic stamp head` to mark as up-to-date (if schema matches)

**Q: Autogenerate creates empty migration**
A: Your models might not be imported. Check `alembic/env.py` imports your models:
```python
from app.models import Base
target_metadata = Base.metadata
```

**Q: Migration creates wrong changes**
A: Review and edit before applying. Autogenerate is a starting point, not perfect.

## Need Help?

Check logs:
```bash
docker compose -f docker-compose.prod.yml logs backend | grep -i alembic
```

Database connection:
```bash
docker compose -f docker-compose.prod.yml exec backend python -c "from app.db.session import engine; print(engine.url)"
```
