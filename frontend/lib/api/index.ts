// Re-export the axios instance and utilities
export { api, isApiError, getErrorMessage, safeApiCall } from './client';
export type { ApiErrorResponse } from './client';

// Re-export all API service modules
export { authApi } from './auth';
export { ordersApi } from './orders';
export { foodsApi } from './foods';
export { categoriesApi } from './categories';
export { tablesApi } from './tables';
export { paymentsApi } from './payments';
export { analyticsApi } from './analytics';
export { usersApi } from './users';
