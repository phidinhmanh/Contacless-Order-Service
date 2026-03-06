# API Refactoring Changes - Implementation Guide

## Import Changes

All files need to update their imports from:
```typescript
import api from '@/lib/api';
```

To:
```typescript
import { ordersApi, analyticsApi, foodsApi, categoriesApi, tablesApi, paymentsApi, usersApi, authApi } from '@/lib/api';
```

## API Call Replacements

### Orders API
- `api.get('/orders/', { params })` → `ordersApi.list(params)`
- `api.get(\`/orders/${id}\`)` → `ordersApi.getById(id)`
- `api.post('/orders/', data)` → `ordersApi.create(data)`
- `api.post(\`/orders/${id}/cancel\`)` → `ordersApi.cancel(id)`
- `api.put(\`/orders/${id}\`, { status })` → `ordersApi.updateStatus(id, status)`
- `api.post(\`/orders/${id}/pay-cash\`)` → `ordersApi.payCash(id)`

### Analytics API
- `api.get('/analytics/revenue', { params })` → `analyticsApi.revenue(params)`
- `api.get('/analytics/popular-items', { params })` → `analyticsApi.popularItems(params)`
- `api.get('/analytics/peak-hours', { params })` → `analyticsApi.peakHours(params)`
- `api.get('/analytics/customers')` → `analyticsApi.customers()`
- `api.get('/analytics/retention')` → `analyticsApi.retention()`

### Foods API
- `api.get('/foods/', { params })` → `foodsApi.list(params)`
- `api.post('/foods/', data)` → `foodsApi.create(data)`
- `api.put(\`/foods/${id}\`, data)` → `foodsApi.update(id, data)`
- `api.delete(\`/foods/${id}\`)` → `foodsApi.delete(id)`
- `api.patch(\`/foods/${id}/stock\`, { stock_quantity })` → `foodsApi.updateStock(id, stock_quantity)`
- `api.post(\`/foods/${id}/image\`, formData, { headers })` → `foodsApi.uploadImage(id, file)`

### Categories API
- `api.get('/categories', { params })` → `categoriesApi.list(params)`
- `api.post('/categories', data)` → `categoriesApi.create(data)`
- `api.put(\`/categories/${id}\`, data)` → `categoriesApi.update(id, data)`
- `api.delete(\`/categories/${id}\`)` → `categoriesApi.delete(id)`

### Tables API
- `api.get('/tables/')` → `tablesApi.list()`
- `api.post('/tables/', data)` → `tablesApi.create(data)`
- `api.put(\`/tables/${id}\`, data)` → `tablesApi.update(id, data)`
- `api.delete(\`/tables/${id}\`)` → `tablesApi.delete(id)`
- `api.post(\`/tables/${id}/regenerate-qr\`)` → `tablesApi.regenerateQr(id)`
- `api.post(\`/tables/${id}/session\`, data)` → `tablesApi.createSession(id, data)`

### Payments API
- `api.post('/payments/initiate', data)` → `paymentsApi.initiate(data)`
- `api.get(\`/payments/${id}\`)` → `paymentsApi.getStatus(id)`

### Users API
- `api.get('/users/me')` → `usersApi.getMe()`
- `api.get('/users', { params })` → `usersApi.list(params)`
- `api.patch('/users/me/lead-info', null, { params })` → `usersApi.updateLeadInfo(fullName, phoneNumber)`

### Auth API
- `api.post('/auth/register', data)` → `authApi.register(data)`
- `api.post('/auth/login', formData, { headers })` → `authApi.phoneLogin(phone, password)`
- `api.post('/auth/guest', data, { withCredentials })` → `authApi.guestAuth(tableId)`
- `api.post('/auth/logout', null, { withCredentials })` → `authApi.logout()`
- `api.post('/auth/guest/demographics', null, { params })` → `authApi.updateGuestDemographics(guestId, gender, ageGroup)`

## Files to Refactor

1. ✅ frontend/lib/auth.ts
2. frontend/app/admin/orders/page.tsx
3. frontend/app/admin/foods/page.tsx
4. frontend/app/admin/categories/page.tsx
5. frontend/app/admin/tables/page.tsx
6. frontend/app/admin/login/page.tsx
7. frontend/app/menu/page.tsx
8. frontend/app/order/[id]/page.tsx
9. frontend/app/order/track/page.tsx
10. frontend/app/payment/page.tsx
11. frontend/app/register/page.tsx
12. frontend/contexts/AdminAuthContext.tsx
13. frontend/components/CartDrawer.tsx
14. frontend/hooks/useDashboardData.ts
15. frontend/hooks/useAnalyticsData.ts
16. frontend/hooks/useExportReport.ts

## Note on Response Handling

The new API functions return the data directly (already unwrapped from `.data`), so:

**Before:**
```typescript
const response = await api.get('/orders/');
const orders = response.data;
```

**After:**
```typescript
const orders = await ordersApi.list();
```
