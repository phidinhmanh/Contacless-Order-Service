/**
 * Test Utilities for Node.js Environment
 *
 * Provides utilities for running tests that use lib/api in Node.js environment.
 * This handles the fact that localStorage is not available in Node.js.
 *
 * Usage:
 * import { createTestApiClient, setTestToken, clearTestToken } from './testUtils';
 *
 * beforeAll(() => {
 *     const api = createTestApiClient();
 *     const token = await loginAsTestUser();
 *     setTestToken(token);
 * });
 */

import axios, { AxiosInstance } from 'axios';

// Mock localStorage for Node.js environment
const storage: Record<string, string> = {};

// Setup global localStorage mock for Node.js tests
export function setupTestEnvironment(): void {
    // Mock localStorage
    if (typeof global.localStorage !== 'undefined') {
        return; // Already set up
    }

    Object.defineProperty(global, 'localStorage', {
        value: {
            getItem: (key: string): string | null => storage[key] || null,
            setItem: (key: string, value: string): void => {
                storage[key] = value;
            },
            removeItem: (key: string): void => {
                delete storage[key];
            },
            clear: (): void => {
                Object.keys(storage).forEach(key => delete storage[key]);
            },
        },
        writable: true,
        configurable: true,
    });

    // Mock window.location
    if (typeof global.window === 'undefined') {
        Object.defineProperty(global, 'window', {
            value: {
                location: {
                    href: 'http://localhost:3000',
                    pathname: '/',
                    hostname: 'localhost',
                },
            },
            writable: true,
            configurable: true,
        });
    }
}

/**
 * Create a test API client with proper configuration for Node.js tests
 * This is the main function tests should use to make API calls
 */
export function createTestApiClient(baseUrl?: string): AxiosInstance {
    const API_BASE_URL = baseUrl || process.env.TEST_API_URL || 'http://localhost:8000';

    const client = axios.create({
        baseURL: `${API_BASE_URL}/api/v1`,
        headers: {
            'Content-Type': 'application/json',
        },
        timeout: 10000,
    });

    // Request interceptor - add auth token from localStorage mock
    client.interceptors.request.use(
        (config) => {
            const adminToken = storage['admin_access_token'];
            const customerToken = storage['access_token'];
            const token = adminToken || customerToken;

            if (token) {
                config.headers = config.headers || {};
                config.headers['Authorization'] = `Bearer ${token}`;
            }

            return config;
        }
    );

    // Response interceptor - handle errors
    client.interceptors.response.use(
        (response) => response,
        (error) => {
            const status = error.response?.status || null;
            const responseData = error.response?.data;
            const message = extractErrorMessage(responseData);

            return Promise.reject({
                status,
                message,
                details: responseData,
            });
        }
    );

    return client;
}

// Extract error message from various API error formats
function extractErrorMessage(data: unknown): string {
    if (!data) return 'Something went wrong';
    if (typeof data === 'string') return data;

    if (typeof data === 'object' && data !== null) {
        const errorData = data as Record<string, unknown>;

        if (Array.isArray(errorData.detail)) {
            const messages = errorData.detail
                .map((err: { msg?: string; message?: string }) => err.msg || err.message)
                .filter(Boolean);
            return messages.length > 0 ? messages.join(', ') : 'Validation error';
        }

        if (typeof errorData.detail === 'string') {
            return errorData.detail;
        }

        if (typeof errorData.message === 'string') {
            return errorData.message;
        }

        if (typeof errorData.error === 'string') {
            return errorData.error;
        }
    }

    return 'Something went wrong';
}

/**
 * Set admin token for tests
 */
export function setAdminToken(token: string): void {
    storage['admin_access_token'] = token;
}

/**
 * Set customer token for tests
 */
export function setCustomerToken(token: string): void {
    storage['access_token'] = token;
}

/**
 * Set both tokens (admin takes priority)
 */
export function setTestToken(adminToken?: string, customerToken?: string): void {
    if (adminToken) {
        setAdminToken(adminToken);
    }
    if (customerToken) {
        setCustomerToken(customerToken);
    }
}

/**
 * Clear all test tokens
 */
export function clearTestToken(): void {
    delete storage['admin_access_token'];
    delete storage['access_token'];
    delete storage['admin_user'];
}

/**
 * Clear all storage (including tokens)
 */
export function clearAllStorage(): void {
    Object.keys(storage).forEach(key => delete storage[key]);
}

/**
 * Get API_BASE_URL for tests
 * Reads from TEST_API_URL environment variable or defaults to localhost
 */
export function getTestApiUrl(): string {
    return process.env.TEST_API_URL || 'http://localhost:8000';
}

/**
 * Get the full API v1 URL
 */
export function getTestApiV1Url(): string {
    return `${getTestApiUrl()}/api/v1`;
}

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
        'status' in error &&
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

// Initialize test environment on import
setupTestEnvironment();
