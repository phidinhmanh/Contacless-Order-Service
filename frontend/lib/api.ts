/**
 * @deprecated This file is kept for backward compatibility.
 * Please import from '@/lib/api' (which uses the new api/ directory structure) instead.
 *
 * Old: import api from '@/lib/api';
 * New: import { api } from '@/lib/api';
 */

// Re-export everything from the new api directory
export { api as default, api, isApiError, getErrorMessage, safeApiCall } from './api/client';
export type { ApiErrorResponse } from './api/client';

// Re-export all API service modules
export { authApi } from './api/auth';
export { ordersApi } from './api/orders';
export { foodsApi } from './api/foods';
export { categoriesApi } from './api/categories';
export { tablesApi } from './api/tables';
export { paymentsApi } from './api/payments';
export { analyticsApi } from './api/analytics';
export { usersApi } from './api/users';
