# 🍜 Contactless Order Service

A full-stack restaurant ordering system designed for contactless dining experiences. Customers scan QR codes at their tables to view menus, place orders, and pay—all without needing to download an app.

## ✨ Features

- 📱 **QR Code Table Access** - No app download required
- 🔐 **Guest Authentication** - Simple table-based login system
- 🍔 **Digital Menu** - Browse menu with categories, images, and pricing
- 🛒 **Shopping Cart** - Add items, customize quantities
- 💳 **VietQR Payment** - Integrated QR-based payment via CASSO
- 👨‍🍳 **Kitchen Display** - Real-time order management with WebSocket updates
- 📊 **Admin Dashboard** - Analytics, order history, user management
- 🌐 **Multi-role Support** - Admin, Manager, Kitchen Staff, Guest

## 🛠️ Tech Stack

### Backend
- **FastAPI** (Python 3.13+)
- **PostgreSQL** + SQLAlchemy ORM
- **Alembic** migrations
- **JWT** authentication
- **WebSockets** for real-time updates
- **uv** package manager

### Frontend
- **Next.js 14+** with App Router
- **TypeScript**
- **Tailwind CSS**
- **Zustand** state management
- **Jest** + **Playwright** testing

### Infrastructure
- **Docker** + Docker Compose
- **Nginx** reverse proxy
- **Cloudflare Tunnel** (optional HTTPS)

## 🚀 Quick Start

### Prerequisites

- **Docker** and **Docker Compose**
- **Git**
- (Optional) **Node.js 20+** for local frontend development
- (Optional) **Python 3.13+** for local backend development

### Development Setup (Local)

```bash
# Clone the repository
git clone https://github.com/phidinhmanh/Contacless-Order-Service.git
cd Contacless-Order-Service

# Copy environment template
cp .env.example .env

# Generate secret key and update .env
# SECRET_KEY=$(openssl rand -hex 32)

# Start all services with Docker
docker compose up -d

# Wait for services to be ready (about 30 seconds)

# Create admin user
docker compose exec backend python scripts/create_admin.py

# Seed initial data (sample menu items)
docker compose exec backend python scripts/seed_data.py
```

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Database: localhost:5432

### Development Without Docker

**Backend:**
```bash
# Install dependencies with uv
uv sync

# Run database (requires Docker or local PostgreSQL)
docker compose up -d db

# Set DATABASE_URL in .env to point to your PostgreSQL

# Run migrations
uv run alembic upgrade head

# Create admin and seed data
uv run python scripts/create_admin.py
uv run python scripts/seed_data.py

# Start development server
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Set NEXT_PUBLIC_API_URL in .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Start development server
npm run dev
```

## 🌍 Production Deployment

### Option 1: Ubuntu/Debian (Native Linux)

**For Ubuntu 22.04/24.04 LTS:**
```bash
# Clone repository
git clone https://github.com/phidinhmanh/Contacless-Order-Service.git
cd Contacless-Order-Service

# Run one-command deployment script
chmod +x deploy.sh
sudo ./deploy.sh

# The script will:
# - Install Docker, uv, system dependencies
# - Build and start all containers
# - Run database migrations
# - Perform health checks
```

### Option 2: WSL Debian (Windows Subsystem for Linux)

**Requirements:**
- Windows 10/11 with WSL2 enabled
- Debian distro installed in WSL
- Docker Desktop for Windows (recommended) OR Docker Engine in WSL

**Deployment:**
```bash
# In WSL Debian terminal
cd /opt  # or your preferred directory
git clone https://github.com/phidinhmanh/Contacless-Order-Service.git
cd Contacless-Order-Service

# Run WSL-specific deployment script
chmod +x deploy-wsl-debian.sh
sudo ./deploy-wsl-debian.sh

# The script will:
# - Detect WSL2 (required for Docker)
# - Guide Docker Desktop installation if needed
# - Build and start all containers
# - Run database migrations
```

**Access from Windows:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs

**Troubleshooting WSL:**
- Restart WSL: `wsl --shutdown` (in PowerShell)
- Check Docker Desktop WSL integration settings
- Ensure WSL2 (not WSL1): `wsl --list --verbose`

### Option 3: Docker Compose (Any Platform)

```bash
# Clone and navigate to project
git clone https://github.com/phidinhmanh/Contacless-Order-Service.git
cd Contacless-Order-Service

# Create .env file
cp .env.example .env

# Edit .env and set required variables:
# - SECRET_KEY (generate with: openssl rand -hex 32)
# - POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
# - DATABASE_URL

# Build and start production containers
docker compose -f docker-compose.prod.yml up -d --build

# Wait for database to be ready
docker compose -f docker-compose.prod.yml exec db pg_isready -U postgres

# Run migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Create admin user
docker compose -f docker-compose.prod.yml exec backend python scripts/create_admin.py

# Seed data
docker compose -f docker-compose.prod.yml exec backend python scripts/seed_data.py

# Verify deployment
bash scripts/verify-deployment.sh
```

## 🔐 Cloudflare Tunnel Setup (Public HTTPS Access)

Expose your app to the internet securely with automatic HTTPS, no port forwarding required.

**Quick Setup:**
1. Get a Cloudflare account and add your domain
2. Create a tunnel at [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
3. Copy your tunnel token
4. Add token to `.env`:
   ```bash
   CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiY2RhNzM5YjUtNzk1Yy00ZTJj...
   ```
5. Uncomment tunnel service in `docker-compose.prod.yml`
6. Start tunnel: `docker compose -f docker-compose.prod.yml up -d tunnel`

**Detailed Instructions:** See [docs/cloudflare-tunnel-setup.md](docs/cloudflare-tunnel-setup.md)

## 📋 Post-Deployment Checklist

- [ ] Create admin user: `docker compose -f docker-compose.prod.yml exec backend python scripts/create_admin.py`
- [ ] Seed menu data: `docker compose -f docker-compose.prod.yml exec backend python scripts/seed_data.py`
- [ ] Configure VietQR credentials in `.env` (for payments)
- [ ] Test guest login flow with QR codes
- [ ] Test order placement and kitchen view
- [ ] Verify WebSocket connections work
- [ ] Run verification script: `bash scripts/verify-deployment.sh`
- [ ] (Optional) Set up Cloudflare Tunnel for public access
- [ ] (Optional) Configure domain DNS

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://postgres:postgres@localhost:5432/contacless_order` |
| `SECRET_KEY` | JWT signing key (use `openssl rand -hex 32`) | Yes | - |
| `POSTGRES_USER` | Database username | Yes | `postgres` |
| `POSTGRES_PASSWORD` | Database password | Yes | `postgres` |
| `POSTGRES_DB` | Database name | Yes | `contacless_order` |
| `VIETQR_BANK_ID` | Bank ID for VietQR | No | - |
| `VIETQR_ACCOUNT_NO` | Account number for VietQR | No | - |
| `VIETQR_ACCOUNT_NAME` | Account name for VietQR | No | - |
| `CASSO_API_KEY` | CASSO webhook API key | No | - |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare tunnel authentication token | No | - |

### User Roles

- **ADMIN**: Full system access, user management
- **MANAGER**: Order management, menu updates, analytics
- **KITCHEN**: View and update order status
- **GUEST**: Browse menu, place orders, pay

## 🧪 Testing

### Backend Tests
```bash
# Run all tests
uv run pytest

# With coverage
uv run pytest --cov=app --cov-report=term-missing

# Specific test file
uv run pytest tests/test_orders.py -v
```

### Frontend Tests
```bash
cd frontend

# Unit tests
npm test

# E2E tests
npx playwright test

# E2E with UI
npx playwright test --ui
```

## 📊 Useful Commands

### View Logs
```bash
docker compose -f docker-compose.prod.yml logs -f          # All services
docker compose -f docker-compose.prod.yml logs -f backend  # Backend only
docker compose -f docker-compose.prod.yml logs -f frontend # Frontend only
docker compose -f docker-compose.prod.yml logs -f tunnel   # Tunnel only
```

### Database Operations
```bash
# Access database shell
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d contacless_order

# Run migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Create new migration
docker compose -f docker-compose.prod.yml exec backend alembic revision --autogenerate -m "description"

# Rollback migration
docker compose -f docker-compose.prod.yml exec backend alembic downgrade -1
```

### Container Management
```bash
# Restart all services
docker compose -f docker-compose.prod.yml restart

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Stop all services
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes (⚠️ deletes data)
docker compose -f docker-compose.prod.yml down -v
```

### Backend Shell
```bash
# Access Python shell in backend container
docker compose -f docker-compose.prod.yml exec backend bash

# Run Python scripts
docker compose -f docker-compose.prod.yml exec backend python scripts/create_admin.py
docker compose -f docker-compose.prod.yml exec backend python scripts/seed_data.py
docker compose -f docker-compose.prod.yml exec backend python scripts/regenerate_qrs.py
```

## 🐛 Troubleshooting

### Backend Returns 404
- Check backend logs: `docker compose -f docker-compose.prod.yml logs backend`
- Verify migrations ran: `docker compose -f docker-compose.prod.yml exec backend alembic current`
- Ensure database is seeded: Run `scripts/seed_data.py`

### Frontend Can't Connect to Backend
- Verify `NEXT_PUBLIC_API_URL` environment variable
- Check if backend is accessible: `curl http://localhost:8000/health`
- Review nginx logs: `docker compose -f docker-compose.prod.yml logs nginx`

### Database Connection Failed
- Check database is running: `docker compose -f docker-compose.prod.yml ps db`
- Verify `DATABASE_URL` in `.env`
- Check database logs: `docker compose -f docker-compose.prod.yml logs db`

### WebSocket Connection Issues
- Verify nginx config has WebSocket headers (see `nginx/nginx.conf`)
- Check browser console for WebSocket errors
- Ensure `/ws/` path is proxied correctly

### Cloudflare Tunnel Not Connecting
- Verify `CLOUDFLARE_TUNNEL_TOKEN` is set in `.env`
- Check tunnel logs: `docker compose -f docker-compose.prod.yml logs tunnel`
- Ensure tunnel is uncommented in `docker-compose.prod.yml`
- See [docs/cloudflare-tunnel-setup.md](docs/cloudflare-tunnel-setup.md) for detailed troubleshooting

### WSL-Specific Issues
- Docker daemon not accessible: Ensure Docker Desktop is running with WSL integration
- Permission denied: Try running with `sudo`
- Restart WSL: `wsl --shutdown` in PowerShell, then restart WSL
- Check WSL version: `wsl --list --verbose` (must be WSL2)

## 📂 Project Structure

```
├── app/                    # Backend application
│   ├── api/v1/endpoints/   # API routes
│   ├── core/               # Config, security, dependencies
│   ├── crud/               # Database operations
│   ├── models/             # SQLAlchemy models
│   ├── schemas/            # Pydantic schemas
│   └── services/           # Business logic
├── frontend/               # Next.js application
│   ├── app/                # App Router pages
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   └── store/              # Zustand stores
├── tests/                  # Backend tests
├── scripts/                # Utility scripts
├── nginx/                  # Nginx configuration
├── docs/                   # Documentation
├── alembic/                # Database migrations
├── deploy.sh               # Ubuntu deployment script
├── deploy-wsl-debian.sh    # WSL Debian deployment script
└── docker-compose*.yml     # Docker configurations
```

## 📚 Documentation

- [CLAUDE.md](CLAUDE.md) - Project conventions and AI assistant guidance
- [Cloudflare Tunnel Setup](docs/cloudflare-tunnel-setup.md) - Public HTTPS access guide
- [Customer Flow](Flow_customer.md) - End-to-end customer journey
- [Test Customer Flow](Test_customer_flow.md) - Test case documentation
- [Git Flow Rules](git_flow_rule.md) - Branching and commit conventions
- [Frontend README](frontend/README.md) - Frontend-specific documentation

## 🔒 Security

- JWT-based authentication with secure token expiration
- Password hashing with bcrypt
- CORS configured for production domains
- SQL injection protection via SQLAlchemy ORM
- Environment variable separation for secrets
- Optional Cloudflare Zero Trust access policies
- HTTPS via Cloudflare Tunnel

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

See [git_flow_rule.md](git_flow_rule.md) for detailed Git workflow.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Frontend powered by [Next.js](https://nextjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Package management via [uv](https://docs.astral.sh/uv/)
- Secure tunneling with [Cloudflare](https://www.cloudflare.com/)

## 📞 Support

For issues and feature requests:
- Open an issue on [GitHub](https://github.com/phidinhmanh/Contacless-Order-Service/issues)
- Check existing documentation in `docs/`
- Review troubleshooting section above

---

**Made with ❤️ for seamless contactless dining**
