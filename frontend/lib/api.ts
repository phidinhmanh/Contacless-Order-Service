import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getToken, removeToken } from './auth';
import { errorLogger, createApiErrorFromAxios } from './errorLogger';

const getApiBaseUrl = () => {
    // If explicitly set in environment, use it
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    // In browser (client-side), use relative URL
    if (typeof window !== 'undefined') {
        // Check if we're on localhost for development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:8000';
        }
        // Otherwise use relative URL (same domain as frontend)
        return '';
    }

    // Server-side rendering fallback
    return 'http://backend:8000';
};

const API_BASE_URL = getApiBaseUrl();
// Extract error message from various API error formats
function extractErrorMessage(data: unknown): string {
    // Handle null/undefined
    if (!data) return 'Something went wrong';

    // Handle string directly
    if (typeof data === 'string') return data;

    // Handle object with detail field
    if (typeof data === 'object' && data !== null) {
        const errorData = data as Record<string, unknown>;

        // FastAPI validation error: { detail: [{ type, loc, msg, input }] }
        if (Array.isArray(errorData.detail)) {
            const messages = errorData.detail
                .map((err: { msg?: string; message?: string }) => err.msg || err.message)
                .filter(Boolean);
            return messages.length > 0 ? messages.join(', ') : 'Validation error';
        }

        // Standard error: { detail: "message" }
        if (typeof errorData.detail === 'string') {
            return errorData.detail;
        }

        // Alternative: { message: "..." }
        if (typeof errorData.message === 'string') {
            return errorData.message;
        }

        // Alternative: { error: "..." }
        if (typeof errorData.error === 'string') {
            return errorData.error;
        }
    }

    return 'Something went wrong';
}

// Create axios instance
const api: AxiosInstance = axios.create({
    baseURL: `${API_BASE_URL}/api/v1`,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
    withCredentials: true,
});

// Request interceptor - add auth token
// Priority: admin_access_token > access_token > existing header
api.interceptors.request.use(
    (config) => {
        if (typeof window === 'undefined') return config;

        const adminToken = localStorage.getItem('admin_access_token');
        const customerToken = localStorage.getItem('access_token'); // Ensure key matches your login save logic

        const token = adminToken || customerToken;

        if (token) {
            // hard-set the header to ensure it's not overwritten
            config.headers = config.headers || {};
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        // Debug: log API requests
        console.log(`📡 API Request: ${config.method?.toUpperCase()} ${config.url}`);

        return config;
    }
);

// Response interceptor - handle responses and errors
api.interceptors.response.use(
    (response) => {
        // Debug: log successful responses
        console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`);
        return response;
    },
    (error: AxiosError) => {
        const endpoint = error.config?.url || 'unknown';
        const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
        const status = error.response?.status || null;
        const responseData = error.response?.data;

        // Debug: log failed responses
        console.error(`❌ API Error: ${method} ${endpoint} - Status: ${status} - Message: ${error.message}`);

        // Log error to error stack
        errorLogger.log(createApiErrorFromAxios(error, endpoint, method));

        // Status handled by switch below
        const message = extractErrorMessage(responseData);

        // Handle specific status codes
        switch (status) {
            case 401:
                // Unauthorized - clear tokens and redirect based on context
                if (typeof window !== 'undefined') {
                    const isPageAdmin = window.location.pathname.startsWith('/admin');

                    // Clear both potential tokens
                    localStorage.removeItem('admin_access_token');
                    localStorage.removeItem('admin_user');
                    removeToken(); // Clears standard access_token

                    if (isPageAdmin && window.location.pathname !== '/admin/login') {
                        window.location.href = '/admin/login';
                    } else if (!isPageAdmin) {
                        window.location.href = '/';
                    }
                }
                break;
        }

        // Return a clean error object with string message
        return Promise.reject({
            status,
            message, // Always a string now
            details: responseData, // Keep raw data for debugging
        });
    }
);

export default api;

// API error type
export interface ApiErrorResponse {
    status: number | null;
    message: string;
    details?: unknown;
}

// Helper to check if error is ApiErrorResponse
export function isApiError(error: unknown): error is ApiErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error && // ✅ MUST check for status
    'message' in error &&
    typeof (error as ApiErrorResponse).message === 'string' &&
    (typeof (error as ApiErrorResponse).status === 'number' || 
     (error as ApiErrorResponse).status === null)
  );
}
// Get safe error message from any error
export function getErrorMessage(error: unknown): string {
    if (isApiError(error)) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Something went wrong';
}

// Safe API call wrapper with try-catch and error logging
export async function safeApiCall<T>(
    apiCall: () => Promise<T>,
    endpoint: string,
    method: string = 'GET'
): Promise<{ data: T | null; error: ApiErrorResponse | null }> {
    try {
        const data = await apiCall();
        return { data, error: null };
    } catch (error) {
        const apiError: ApiErrorResponse = isApiError(error)
            ? error
            : { status: null, message: getErrorMessage(error) };

        return { data: null, error: apiError };
    }
}
