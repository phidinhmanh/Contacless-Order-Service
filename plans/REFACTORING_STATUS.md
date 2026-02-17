# API Refactoring Status

## ✅ COMPLETED (100%)

### Core Infrastructure
All API service modules have been created and are fully functional:

1. ✅ [`frontend/lib/api/client.ts`](../frontend/lib/api/client.ts) - Axios instance with interceptors
2. ✅ [`frontend/lib/api/auth.ts`](../frontend/lib/api/auth.ts) - Auth API (login, register, guest, demographics)
3. ✅ [`frontend/lib/api/orders.ts`](../frontend/lib/api/orders.ts) - Orders API (list, create, cancel, updateStatus, payCash)
4. ✅ [`frontend/lib/api/foods.ts`](../frontend/lib/api/foods.ts) - Foods API (list, create, update, delete, updateStock, uploadImage)
5. ✅ [`frontend/lib/api/categories.ts`](../frontend/lib/api/categories.ts) - Categories API (list, create, update, delete, toggleActive)
6. ✅ [`frontend/lib/api/tables.ts`](../frontend/lib/api/tables.ts) - Tables API (list, create, update, delete, regenerateQr, createSession)
7. ✅ [`frontend/lib/api/payments.ts`](../frontend/lib/api/payments.ts) - Payments API (initiate, getStatus)
8. ✅ [`frontend/lib/api/analytics.ts`](../frontend/lib/api/analytics.ts) - Analytics API (revenue, popularItems, peakHours, customers, retention)
9. ✅ [`frontend/lib/api/users.ts`](../frontend/lib/api/users.ts) - Users API (getMe, list, updateLeadInfo)
10. ✅ [`frontend/lib/api/index.ts`](../frontend/lib/api/index.ts) - Central re-export module
11. ✅ [`frontend/lib/api.ts`](../frontend/lib/api.ts) - Backward compatibility wrapper

### Refactored Files
1. ✅ [`frontend/lib/auth.ts`](../frontend/lib/auth.ts) - Now uses authApi, tablesApi, usersApi
2. ✅ [`frontend/app/admin/orders/page.tsx`](../frontend/app/admin/orders/page.tsx) - Now uses ordersApi, analyticsApi

## 📋 REMAINING FILES (Manual Refactoring Needed)

The following files still use raw `api.get/post/put/delete` calls and need to be refactored:

### Admin Pages
1. ⏳ `frontend/app/admin/foods/page.tsx`
   - Replace: `api.get('/foods/')` → `foodsApi.list(params)`
   - Replace: `api.get('/categories')` → `categoriesApi.list()`
   - Replace: `api.post('/foods/', data)` → `foodsApi.create(data)`
   - Replace: `api.put(\`/foods/${id}\`, data)` → `foodsApi.update(id, data)`
   - Replace: `api.delete(\`/foods/${id}\`)` → `foodsApi.delete(id)`
   - Replace: `api.patch(\`/foods/${id}/stock\`, { stock_quantity })` → `foodsApi.updateStock(id, stock_quantity)`
   - Replace: `api.post(\`/foods/${id}/image\`, formData, headers)` → `foodsApi.uploadImage(id, file)`

2. ⏳ `frontend/app/admin/categories/page.tsx`
   - Replace: `api.get('/categories?include_inactive=true')` → `categoriesApi.list({ include_inactive: true })`
   - Replace: `api.post('/categories', data)` → `categoriesApi.create(data)`
   - Replace: `api.put(\`/categories/${id}\`, data)` → `categoriesApi.update(id, data)`
   - Replace: `api.delete(\`/categories/${id}\`)` → `categoriesApi.delete(id)`

3. ⏳ `frontend/app/admin/tables/page.tsx`
   - Replace: `api.get('/tables/')` → `tablesApi.list()`
   - Replace: `api.get('/orders/?limit=200')` → `ordersApi.list({ limit: 200 })`
   - Replace: `api.post('/tables/', data)` → `tablesApi.create(data)`
   - Replace: `api.put(\`/tables/${id}\`, data)` → `tablesApi.update(id, data)`
   - Replace: `api.delete(\`/tables/${id}\`)` → `tablesApi.delete(id)`
   - Replace: `api.post(\`/tables/${id}/regenerate-qr\`)` → `tablesApi.regenerateQr(id)`

4. ⏳ `frontend/app/admin/login/page.tsx`
   - Replace: `api.post('/auth/login', params, headers)` → `authApi.phoneLogin(phone, password)`
   - Replace: `api.get('/users/me', headers)` → `usersApi.getMe()`

### Customer Pages
5. ⏳ `frontend/app/menu/page.tsx`
   - Replace: `api.post('/orders/', orderRequest)` → `ordersApi.create(orderRequest)`

6. ⏳ `frontend/app/order/[id]/page.tsx`
   - Replace: `api.post(\`/orders/${orderId}/cancel\`)` → `ordersApi.cancel(orderId)`

7. ⏳ `frontend/app/order/track/page.tsx`
   - Replace: `api.get(endpoint)` → `ordersApi.list(params)`

8. ⏳ `frontend/app/payment/page.tsx`
   - Replace: `api.get(\`/payments/${id}\`)` → `paymentsApi.getStatus(id)`
   - Replace: `api.post(\`/orders/${id}/pay-cash\`)` → `ordersApi.payCash(id)`
   - Replace: `api.post('/payments/initiate', data)` → `paymentsApi.initiate(data)`

9. ⏳ `frontend/app/register/page.tsx`
   - Replace: `api.post('/auth/register', data)` → `authApi.register(data)`

### Components & Contexts
10. ⏳ `frontend/contexts/AdminAuthContext.tsx`
    - Replace: `api.post('/auth/login', formData, headers)` → `authApi.phoneLogin(phone, password)`
    - Replace: `api.get('/users/me')` → `usersApi.getMe()`

11. ⏳ `frontend/components/CartDrawer.tsx`
    - Replace: `api.get('/users/me')` → `usersApi.getMe()`

### Hooks
12. ⏳ `frontend/hooks/useDashboardData.ts`
    - Replace: `api.get('/analytics/revenue')` → `analyticsApi.revenue()`
    - Replace: `api.get('/orders/?limit=50')` → `ordersApi.list({ limit: 50 })`
    - Replace: `api.get('/tables/')` → `tablesApi.list()`

13. ⏳ `frontend/hooks/useAnalyticsData.ts`
    - Replace: `api.get(\`/analytics/revenue?start_date=...\`)` → `analyticsApi.revenue({ start_date, end_date })`
    - Replace: `api.get(\`/analytics/popular-items?days=${days}&limit=10\`)` → `analyticsApi.popularItems({ days, limit: 10 })`
    - Replace: `api.get(\`/analytics/peak-hours?days=${days}\`)` → `analyticsApi.peakHours({ days })`
    - Replace: `api.get('/analytics/customers')` → `analyticsApi.customers()`
    - Replace: `api.get('/analytics/retention')` → `analyticsApi.retention()`
    - Replace: `api.get('/users', { params })` → `usersApi.list(params)`

14. ✅ `frontend/hooks/useExportReport.ts` - Keep using raw `api` (needs axios response object)

## 🔧 How to Refactor Each File

### Step 1: Update Imports
```typescript
// Before
import api from '@/lib/api';

// After
import { ordersApi, analyticsApi, foodsApi, categoriesApi, tablesApi, paymentsApi, usersApi, authApi } from '@/lib/api';
```

### Step 2: Replace API Calls
```typescript
// Before
const response = await api.get('/orders/?limit=500');
const orders = response.data;

// After
const orders = await ordersApi.list({ limit: 500 });
```

### Step 3: Handle Response Data
The new API functions return data directly (already unwrapped from `.data`), so remove `.data` access:

```typescript
// Before
const [ordersRes, revenueRes] = await Promise.all([
    api.get('/orders/'),
    api.get('/analytics/revenue')
]);
const orders = ordersRes.data;
const revenue = revenueRes.data;

// After
const [orders, revenue] = await Promise.all([
    ordersApi.list(),
    analyticsApi.revenue()
]);
```

## 📚 Reference Documents

- [`plans/refactor-api-calls.md`](refactor-api-calls.md) - Original architecture plan
- [`plans/api-refactoring-changes.md`](api-refactoring-changes.md) - Detailed replacement guide
- [`scripts/refactor-api-calls.js`](../scripts/refactor-api-calls.js) - Automated refactoring script (partial)

## ✨ Benefits Achieved

1. **Centralized API calls** - All endpoints defined in one place per domain
2. **Easy debugging** - Add breakpoints in service modules
3. **Type-safe** - Return types defined once per function
4. **Consistent error handling** - Interceptors apply to all calls
5. **Easy to mock** - Mock service modules instead of axios
6. **Discoverable** - All available API calls visible in `frontend/lib/api/`

## 🚀 Next Steps

To complete the refactoring:

1. Go through each file in the "REMAINING FILES" section
2. Follow the "How to Refactor Each File" guide
3. Test each page after refactoring
4. Run `npm run build` to check for TypeScript errors
5. Update this document as files are completed
