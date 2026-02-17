# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Contacless Order Service** is a full-stack restaurant ordering system designed for contactless dining experiences. Customers scan QR codes at their tables to view menus, place orders, and pay—all without needing to download an app.

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.13+)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Migrations**: Alembic
- **Package Manager**: [uv](https://docs.astral.sh/uv/) (Astral's fast Python package manager)
- **Auth**: JWT tokens via python-jose, password hashing with passlib/bcrypt
- **Real-time**: WebSockets for kitchen notifications
- **Payments**: VietQR integration with CASSO webhook

### Frontend
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand (cart store)
- **Testing**: Jest (unit), Playwright (E2E)

## Common Commands

### Backend
```bash
# Install dependencies (use uv, not pip)
uv sync

# Run development server
uv run uvicorn app.main:app --reload

# Run all tests
uv run pytest

# Run specific test file
uv run pytest tests/test_orders.py -v

# Run tests with coverage
uv run pytest --cov=app --cov-report=term-missing

# Database migrations
uv run alembic upgrade head          # Apply migrations
uv run alembic revision --autogenerate -m "description"  # Create migration

# Seed data and create admin
uv run python scripts/seed_data.py
uv run python scripts/create_admin.py
```

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Run unit tests
npm test

# Run E2E tests
npx playwright test
```

### Docker (Production)
```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# One-command deploy (Ubuntu 22.04/24.04 LTS)
bash deploy.sh

# One-command deploy (WSL Debian - requires WSL2)
bash deploy-wsl-debian.sh

# Verify deployment
bash scripts/verify-deployment.sh
```

### WSL Debian Deployment
```bash
# For WSL Debian (requires WSL2 and Docker Desktop or Docker Engine)
chmod +x deploy-wsl-debian.sh
sudo ./deploy-wsl-debian.sh

# Access from Windows browser
http://localhost:3000        # Frontend
http://localhost:8000/docs   # API docs

# Check WSL version (must be WSL2)
wsl --list --verbose         # Run in PowerShell

# Restart WSL if needed
wsl --shutdown               # Run in PowerShell, then restart WSL
```

## Project Architecture

```
├── app/
│   ├── api/v1/endpoints/    # API routes (auth, orders, payments, etc.)
│   ├── core/                # Config, security, dependencies
│   ├── crud/                # Database operations
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   └── services/            # Business logic (websocket, payments)
├── frontend/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # Reusable UI components
│   ├── contexts/            # React contexts
│   ├── hooks/               # Custom hooks
│   └── store/               # Zustand stores
├── tests/                   # Backend pytest tests
├── scripts/                 # Utility scripts (seeding, admin creation)
└── alembic/                 # Database migrations
```

## Key API Endpoints

- `POST /api/v1/auth/login` - Staff/Admin login
- `POST /api/v1/auth/guest-login` - Guest login with table ID
- `GET /api/v1/menu` - Public menu with categories
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders/{id}` - Get order status
- `POST /api/v1/payments/initiate` - Start VietQR payment
- `POST /api/v1/payments/webhook/casso` - Payment webhook
- `GET /api/v1/analytics/*` - Business metrics (admin only)

## User Roles

- **ADMIN**: Full system access, user management
- **MANAGER**: Order management, menu updates, analytics
- **KITCHEN**: View/update order status
- **GUEST**: Browse menu, place orders, pay

## Important Conventions

1. **Always use `uv` for Python dependencies** - Never use pip directly
2. **Bind to 0.0.0.0** - Required for Docker and LAN access
3. **Run seed scripts after DB reset** - `create_admin.py` required for login
4. **Use analytics endpoints** - Don't calculate metrics client-side
5. **Check `stack.md`** - Contains known errors and prevention rules

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT signing key (use `openssl rand -hex 32`)
- `VIETQR_*` - Payment gateway credentials
- `CASSO_API_KEY` - Payment webhook authentication

## Testing Guidelines

- Backend tests use pytest with async fixtures
- Use `conftest.py` fixtures for database sessions and test users
- Frontend unit tests mock API calls
- Playwright E2E tests run against dev server

## Skills Reference

Check `.agent/skills/` for detailed guidance on:
- `uv-package-manager` - Python dependency management
- `db-integrity` - Database migrations and transactions
- `error-prevention` - Error tracking in stack.md
- `frontend-engineering` - Frontend best practices
- `fullstack-type-sync` - Keep Pydantic/TypeScript schemas in sync
- `security-auditor` - RBAC and endpoint security
- `windows-debug` - Windows-specific debugging
