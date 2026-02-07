import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getToken, removeToken } from './auth';
import { errorLogger, createApiErrorFromAxios } from './errorLogger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

        return config;
    }
);
// Response interceptor - handle errors and log them
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        const endpoint = error.config?.url || 'unknown';
        const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
        const status = error.response?.status || null;
        const responseData = error.response?.data;
        const requestData = error.config?.data;

        // Status handled by switch below
        const message = extractErrorMessage(responseData);

        // Log error to error stack
        errorLogger.log(createApiErrorFromAxios(error, endpoint, method));


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
        'message' in error &&
        typeof (error as ApiErrorResponse).message === 'string'
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
