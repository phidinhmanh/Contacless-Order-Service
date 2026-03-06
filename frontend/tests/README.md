# Frontend Testing Guide

## Quick Start

### Prerequisites (REQUIRED!)

**⚠️ Tests will fail if backend is not running!**

```bash
# Terminal 1: Start backend
cd "D:\Work\project UET\Contacless Order Service"
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Seed database (first time only)
uv run python scripts/seed_data.py
uv run python scripts/create_admin.py

# Terminal 3: Run tests
cd frontend
npx playwright test
```

### Common Test Commands

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test mobile
npx playwright test order-flow
npx playwright test offline

# Run with UI (recommended for debugging)
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Run on specific browser
npx playwright test --project=chromium
npx playwright test --project=webkit
npx playwright test --project=firefox

# Debug mode (step through test)
npx playwright test --debug

# Update snapshots (if using visual regression)
npx playwright test --update-snapshots
```

## Test Structure

### E2E Tests (`tests/e2e/`)

1. **`mobile.spec.ts`** - Mobile UI responsiveness tests
   - Menu displays correctly on 375px viewport
   - No horizontal overflow on welcome page

2. **`order-flow.spec.ts`** - Complete order journey
   - Guest scans QR → Browses menu → Orders → Pays with VietQR
   - Tests demographic modal, cart functionality, payment flow

3. **`offline.spec.ts`** - Offline behavior
   - Cart persistence using localStorage
   - Error handling when network is unavailable

4. **`race-condition.spec.ts`** - Concurrent operations
   - Multiple users ordering same item
   - Stock quantity edge cases

### Integration Tests (`tests/integration/`)

1. **`api-endpoints.test.ts`** - API endpoint verification
   - Tests all 27 backend endpoints
   - Validates status codes (200, 201, 401, 404, 422)
   - Can filter by category: `TEST_CATEGORY=auth npm test -- api-endpoints.test.ts`

2. **`order-cancellation-stock.test.ts`** - Stock restoration logic
   - User cancels order → food quantity restored
   - Admin deletes order → stock updated
   - Prevents double-restoration

### Unit Tests (`tests/unit/`)

1. **`api-client.test.ts`** - API client behavior
   - Request/response interceptors
   - Token priority (admin_access_token > access_token)
   - Error message extraction

## Test Patterns

### Correct Navigation Flow

```typescript
// ✅ CORRECT - Navigate to home with table_id
await page.goto('/?table_id=1');
await page.getByRole('button', { name: /Bắt đầu đặt món/i }).click();

// Close demographic modal
const closeButton = page.locator('button').filter({ has: page.locator('svg') }).first();
await closeButton.waitFor({ state: 'visible', timeout: 5000 });
await closeButton.click();

// Wait for menu page
await page.waitForURL(/.*\/menu/);
await page.waitForSelector('.food-card', { state: 'visible', timeout: 10000 });
```

```typescript
// ❌ INCORRECT - /table/1 route doesn't exist
await page.goto('/table/1');
```

### Waiting for API Responses

```typescript
// Wait for navigation
await page.waitForURL(/.*\/menu/);

// Check for error states first
const errorMessage = page.locator('[class*="red"]').filter({ hasText: /error/i });
await expect(errorMessage).not.toBeVisible();

// Wait for content to load
await page.waitForSelector('.food-card', { state: 'visible', timeout: 10000 });

// Or wait for network to settle
await page.waitForLoadState('networkidle');
```

### Selecting Elements

```typescript
// ✅ Use data-testid for stable selectors
await page.locator('[data-testid="add-to-cart-1"]').click();

// ✅ Use semantic roles
await page.getByRole('button', { name: /Bắt đầu đặt món/i }).click();

// ✅ Use CSS classes for dynamic content
const foodCards = page.locator('.food-card');

// ❌ Avoid brittle text selectors
await page.locator('button:has-text("✕")').click(); // Won't work with SVG icons
```

## Troubleshooting

### Tests Timeout at `page.waitForURL(/.*\/menu/)`

**Cause**: Backend not running or guest auth failing

**Solution**:
```bash
# Check backend is running
curl http://localhost:8000/api/v1/foods

# Check backend logs for errors
# Verify database connection
# Ensure seed data exists
```

### `.food-card` Elements Not Found

**Cause**: Navigation to wrong route or API returning empty array

**Solution**:
- Verify navigating to `/?table_id=1` not `/table/1`
- Check backend `/api/v1/foods` returns food items
- Run `uv run python scripts/seed_data.py`

### Demographic Modal Close Button Not Found

**Cause**: Looking for text "✕" instead of SVG icon

**Solution**:
```typescript
// Use this selector
const closeButton = page.locator('button').filter({ has: page.locator('svg') }).first();
await closeButton.waitFor({ state: 'visible' });
await closeButton.click();
```

### Horizontal Overflow on Mobile

**Cause**: Elements exceeding 375px viewport

**Solution**:
- Check for fixed-width elements without `max-w-full`
- Ensure images use `w-full max-w-[XXXpx]`
- Test with: `npx playwright test mobile --headed`

## Environment Variables

```bash
# Custom backend URL for tests
TEST_API_URL=http://192.168.1.100:8000 npm test

# Filter API endpoint tests by category
TEST_CATEGORY=auth npm test -- api-endpoints.test.ts
TEST_CATEGORY=orders npm test -- api-endpoints.test.ts
```

## CI/CD Integration

For GitHub Actions or other CI systems:

```yaml
- name: Install dependencies
  run: |
    cd frontend
    npm ci
    npx playwright install --with-deps

- name: Start backend
  run: |
    uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 &
    sleep 5

- name: Seed database
  run: |
    uv run python scripts/seed_data.py
    uv run python scripts/create_admin.py

- name: Run Playwright tests
  run: |
    cd frontend
    npx playwright test

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: frontend/playwright-report/
```

## Related Documentation

- **API Testing**: `tests/API_TESTS.md`
- **Test Fixes**: `../docs/TEST_FIXES_SUMMARY.md`
- **Order Cancellation**: `../docs/ORDER_CANCEL_TESTS_SUMMARY.md`
- **Main README**: `../CLAUDE.md`
