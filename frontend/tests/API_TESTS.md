# Frontend API Endpoint Tests

Comprehensive test suite for verifying frontend-backend API endpoint alignment and the API client configuration.

## Test Files

### 1. `tests/integration/api-endpoints.test.ts`
Tests all API endpoints to ensure they exist and respond correctly.

**Coverage:**
- ✅ Auth endpoints (register, login, refresh, guest, logout)
- ✅ Users endpoints (me, lead-info, list)
- ✅ Foods endpoints (list, create)
- ✅ Categories endpoints (list, create)
- ✅ Menu endpoints (menu, categories)
- ✅ Orders endpoints (list, create)
- ✅ Tables endpoints (list, create)
- ✅ Payments endpoints (initiate, webhooks)
- ✅ Analytics endpoints (revenue, popular-items, peak-hours, customers, retention, export)

### 2. `tests/unit/api-client.test.ts`
Tests the API client configuration from `lib/api.ts`.

**Coverage:**
- ✅ Base URL configuration
- ✅ Request interceptor (auth token injection)
- ✅ Response interceptor (error handling, 401 redirect)
- ✅ Error message extraction
- ✅ Helper functions (isApiError, getErrorMessage, safeApiCall)
- ✅ Token priority (admin > customer)
- ✅ FastAPI error format handling

## Running Tests

### Run All API Tests
```bash
cd frontend
npm test
```

### Run Endpoint Tests Only
```bash
npm test -- api-endpoints.test.ts
```

### Run API Client Tests Only
```bash
npm test -- api-client.test.ts
```

### Run Specific Category
```bash
TEST_CATEGORY=auth npm test -- api-endpoints.test.ts
TEST_CATEGORY=orders npm test -- api-endpoints.test.ts
TEST_CATEGORY=payments npm test -- api-endpoints.test.ts
```

### Run in Watch Mode
```bash
npm test -- --watch api-endpoints.test.ts
```

### Run with Verbose Output
```bash
npm test -- --verbose api-endpoints.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage api-client.test.ts
```

## Prerequisites

### 1. Backend Must Be Running
```bash
# In project root
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Admin User Must Exist
```bash
# Create admin user if not exists
uv run python scripts/create_admin.py
```

The tests use these credentials:
- Username: `0386868686`
- Password: `AdminPassword123!`

### 3. Database Must Be Seeded
```bash
# Seed test data
uv run python scripts/seed_data.py
```

## Environment Variables

### `TEST_API_URL`
Override the default API base URL.

```bash
TEST_API_URL=http://192.168.1.100:8000 npm test -- api-endpoints.test.ts
```

Default: `http://localhost:8000`

### `TEST_CATEGORY`
Filter endpoint tests by category.

```bash
TEST_CATEGORY=auth npm test -- api-endpoints.test.ts
```

Available categories:
- `auth` - Authentication endpoints
- `users` - User management
- `foods` - Food items
- `categories` - Food categories
- `menu` - Menu display
- `orders` - Order management
- `tables` - Table management
- `payments` - Payment processing
- `analytics` - Business analytics

## Test Results

### Successful Test Output
```
PASS tests/integration/api-endpoints.test.ts
  API Endpoint Verification
    AUTH Endpoints
      ✓ POST /auth/register - User registration (234ms)
      ✓ POST /auth/login - User login (156ms)
      ✓ POST /auth/refresh - Token refresh (89ms)
    ...
    Endpoint Coverage Summary
      ✓ should have all endpoints accessible (2345ms)

=== Endpoint Test Summary ===
Total: 27
Passed: 27 (100.0%)
Warnings: 0
Failed: 0
```

### Expected Status Codes
Tests accept these status codes as "endpoint exists":
- `200` - Success
- `201` - Created
- `401` - Unauthorized (endpoint exists but needs auth)
- `404` - Not Found (endpoint exists but resource not found)
- `422` - Validation Error (endpoint exists but payload is invalid)

## Integration with Backend Verification

These frontend tests mirror the backend verification script:
```bash
# Backend endpoint verification
uv run python scripts/verify_endpoints.py

# Frontend endpoint verification
npm test -- api-endpoints.test.ts
```

Both test the same endpoints to ensure frontend-backend alignment.

## Troubleshooting

### Backend Not Running
```
Error: Cannot connect to backend at http://localhost:8000
```

**Solution:**
```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Auth Token Not Available
```
Warning: Could not get auth token. Some tests may fail
```

**Solution:**
1. Ensure admin user exists: `uv run python scripts/create_admin.py`
2. Check credentials in test file match admin user
3. Verify database is accessible

### Tests Timing Out
```
Timeout - Async callback was not invoked within the 10000 ms timeout
```

**Solution:**
1. Check backend is responding: `curl http://localhost:8000/health`
2. Increase timeout in test file (change from 10000 to 30000)
3. Check database connection is not slow

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::8000
```

**Solution:**
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :8000
kill -9 <PID>
```

## Continuous Integration

### GitHub Actions
```yaml
name: Frontend API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.13'
      - name: Install uv
        run: pip install uv
      - name: Start backend
        run: |
          uv sync
          uv run alembic upgrade head
          uv run python scripts/seed_data.py
          uv run python scripts/create_admin.py
          uv run uvicorn app.main:app &
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install frontend dependencies
        run: |
          cd frontend
          npm install
      - name: Run API tests
        run: |
          cd frontend
          npm test -- api-endpoints.test.ts
```

## Test Maintenance

### Adding New Endpoints
1. Add endpoint to backend (`app/api/v1/endpoints/`)
2. Update `scripts/verify_endpoints.py` with new endpoint
3. Update `tests/integration/api-endpoints.test.ts` ENDPOINTS array:
   ```typescript
   {
     method: 'GET',
     path: '/new-endpoint',
     category: 'category-name',
     authRequired: true,
     description: 'Description'
   }
   ```

### Updating Auth Credentials
If admin credentials change, update in test file:
```typescript
// tests/integration/api-endpoints.test.ts
params.append('username', 'new-username');
params.append('password', 'new-password');
```

## Related Documentation
- Backend endpoint verification: `scripts/verify_endpoints.py`
- API client implementation: `frontend/lib/api.ts`
- Backend API routes: `app/api/v1/endpoints/`
- E2E tests: `frontend/tests/e2e/`
