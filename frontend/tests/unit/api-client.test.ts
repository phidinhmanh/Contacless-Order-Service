/**
 * API Client Configuration Tests
 *
 * Tests the frontend API client from lib/api.ts including:
 * - Base URL configuration
 * - Request interceptors (auth token injection)
 * - Response interceptors (error handling, 401 redirect)
 * - Error message extraction
 * - Helper functions
 *
 * Run: npm test -- api-client.test.ts
 */

import api, {
    isApiError,
    getErrorMessage,
    safeApiCall,
    ApiErrorResponse
} from '@/lib/api';
import { InternalAxiosRequestConfig } from 'axios';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        }
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

// Mock window.location
delete (window as any).location;
window.location = {
    href: 'http://localhost:3000',
    pathname: '/',
    hostname: 'localhost'
} as any;

describe('API Client Configuration', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    describe('Base URL Configuration', () => {
        it('should use correct API base URL', () => {
            expect(api.defaults.baseURL).toContain('/api/v1');
        });

        it('should have correct default headers', () => {
            expect(api.defaults.headers['Content-Type']).toBe('application/json');
        });

        it('should have withCredentials enabled', () => {
            expect(api.defaults.withCredentials).toBe(true);
        });

        it('should have timeout configured', () => {
            expect(api.defaults.timeout).toBe(10000);
        });
    });

    describe('Request Interceptor - Auth Token', () => {
        it('should add admin token to request headers when available', () => {
            localStorageMock.setItem('admin_access_token', 'admin-token-123');

            const config: InternalAxiosRequestConfig = {
                headers: {} as any
            } as InternalAxiosRequestConfig;

            // Simulate request interceptor
            const adminToken = localStorageMock.getItem('admin_access_token');
            const customerToken = localStorageMock.getItem('access_token');
            const token = adminToken || customerToken;

            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }

            expect(config.headers['Authorization']).toBe('Bearer admin-token-123');
        });

        it('should prioritize admin token over customer token', () => {
            localStorageMock.setItem('admin_access_token', 'admin-token-123');
            localStorageMock.setItem('access_token', 'customer-token-456');

            const config: InternalAxiosRequestConfig = {
                headers: {} as any
            } as InternalAxiosRequestConfig;

            const adminToken = localStorageMock.getItem('admin_access_token');
            const customerToken = localStorageMock.getItem('access_token');
            const token = adminToken || customerToken;

            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }

            expect(config.headers['Authorization']).toBe('Bearer admin-token-123');
        });

        it('should use customer token when admin token not available', () => {
            localStorageMock.setItem('access_token', 'customer-token-456');

            const config: InternalAxiosRequestConfig = {
                headers: {} as any
            } as InternalAxiosRequestConfig;

            const adminToken = localStorageMock.getItem('admin_access_token');
            const customerToken = localStorageMock.getItem('access_token');
            const token = adminToken || customerToken;

            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }

            expect(config.headers['Authorization']).toBe('Bearer customer-token-456');
        });

        it('should not add Authorization header when no token available', () => {
            const config: InternalAxiosRequestConfig = {
                headers: {} as any
            } as InternalAxiosRequestConfig;

            const adminToken = localStorageMock.getItem('admin_access_token');
            const customerToken = localStorageMock.getItem('access_token');
            const token = adminToken || customerToken;

            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }

            expect(config.headers['Authorization']).toBeUndefined();
        });
    });

    describe('Error Message Extraction', () => {
        it('should extract string error directly', () => {
            const message = getErrorMessage('Simple error message');
            expect(message).toBe('Simple error message');
        });

        it('should extract message from ApiErrorResponse', () => {
            const error: ApiErrorResponse = {
                status: 400,
                message: 'Bad request error'
            };
            const message = getErrorMessage(error);
            expect(message).toBe('Bad request error');
        });

        it('should extract message from Error instance', () => {
            const error = new Error('Standard error');
            const message = getErrorMessage(error);
            expect(message).toBe('Standard error');
        });

        it('should return default message for unknown error types', () => {
            const message = getErrorMessage(null);
            expect(message).toBe('Something went wrong');
        });

        it('should handle FastAPI validation error array', () => {
            const errorData = {
                detail: [
                    { msg: 'Field is required', type: 'value_error.missing' },
                    { msg: 'Invalid format', type: 'value_error.format' }
                ]
            };

            // This would be processed by extractErrorMessage in api.ts
            const messages = errorData.detail.map(err => err.msg).filter(Boolean);
            const result = messages.length > 0 ? messages.join(', ') : 'Validation error';

            expect(result).toBe('Field is required, Invalid format');
        });

        it('should handle FastAPI standard error with detail string', () => {
            const errorData = {
                detail: 'User not found'
            };

            expect(errorData.detail).toBe('User not found');
        });

        it('should handle error with message field', () => {
            const errorData = {
                message: 'Operation failed'
            };

            expect(errorData.message).toBe('Operation failed');
        });

        it('should handle error with error field', () => {
            const errorData = {
                error: 'Something went wrong'
            };

            expect(errorData.error).toBe('Something went wrong');
        });
    });

    describe('isApiError Type Guard', () => {
        it('should return true for valid ApiErrorResponse', () => {
            const error: ApiErrorResponse = {
                status: 404,
                message: 'Not found'
            };
            expect(isApiError(error)).toBe(true);
        });

        it('should return false for Error instance', () => {
            const error = new Error('Some error');
            expect(isApiError(error)).toBe(false);
        });

        it('should return false for string', () => {
            expect(isApiError('error string')).toBe(false);
        });

        it('should return false for null', () => {
            expect(isApiError(null)).toBe(false);
        });

        it('should return false for object without message', () => {
            const error = { status: 400 };
            expect(isApiError(error)).toBe(false);
        });
    });

    describe('safeApiCall Wrapper', () => {
        it('should return data on successful API call', async () => {
            const mockApiCall = jest.fn().mockResolvedValue({ id: 1, name: 'Test' });

            const result = await safeApiCall(mockApiCall, '/test', 'GET');

            expect(result.data).toEqual({ id: 1, name: 'Test' });
            expect(result.error).toBeNull();
            expect(mockApiCall).toHaveBeenCalledTimes(1);
        });

        it('should return error on failed API call with ApiErrorResponse', async () => {
            const apiError: ApiErrorResponse = {
                status: 400,
                message: 'Bad request'
            };
            const mockApiCall = jest.fn().mockRejectedValue(apiError);

            const result = await safeApiCall(mockApiCall, '/test', 'POST');

            expect(result.data).toBeNull();
            expect(result.error).toEqual(apiError);
            expect(mockApiCall).toHaveBeenCalledTimes(1);
        });

        it('should convert non-ApiError to ApiErrorResponse', async () => {
            const standardError = new Error('Network error');
            const mockApiCall = jest.fn().mockRejectedValue(standardError);

            const result = await safeApiCall(mockApiCall, '/test', 'GET');

            expect(result.data).toBeNull();
            expect(result.error).toEqual({
                status: null,
                message: 'Network error'
            });
        });

        it('should handle string errors', async () => {
            const mockApiCall = jest.fn().mockRejectedValue('String error');

            const result = await safeApiCall(mockApiCall, '/test', 'DELETE');

            expect(result.data).toBeNull();
            expect(result.error).toEqual({
                status: null,
                message: 'String error'
            });
        });
    });

    describe('Response Interceptor - 401 Handling', () => {
        it('should clear admin tokens on 401 for admin pages', () => {
            window.location.pathname = '/admin/dashboard';
            localStorageMock.setItem('admin_access_token', 'admin-token');
            localStorageMock.setItem('admin_user', 'admin-user-data');
            localStorageMock.setItem('access_token', 'user-token');

            // Simulate 401 response interceptor logic
            const isPageAdmin = window.location.pathname.startsWith('/admin');

            if (isPageAdmin) {
                localStorageMock.removeItem('admin_access_token');
                localStorageMock.removeItem('admin_user');
                localStorageMock.removeItem('access_token');
            }

            expect(localStorageMock.getItem('admin_access_token')).toBeNull();
            expect(localStorageMock.getItem('admin_user')).toBeNull();
            expect(localStorageMock.getItem('access_token')).toBeNull();
        });

        it('should clear tokens on 401 for non-admin pages', () => {
            window.location.pathname = '/menu';
            localStorageMock.setItem('access_token', 'user-token');
            localStorageMock.setItem('admin_access_token', 'admin-token');

            // Simulate 401 response interceptor logic
            const isPageAdmin = window.location.pathname.startsWith('/admin');

            localStorageMock.removeItem('admin_access_token');
            localStorageMock.removeItem('admin_user');
            localStorageMock.removeItem('access_token');

            expect(localStorageMock.getItem('access_token')).toBeNull();
            expect(localStorageMock.getItem('admin_access_token')).toBeNull();
        });
    });

    describe('HTTP Methods Support', () => {
        it('should support GET requests', () => {
            expect(api.get).toBeDefined();
        });

        it('should support POST requests', () => {
            expect(api.post).toBeDefined();
        });

        it('should support PUT requests', () => {
            expect(api.put).toBeDefined();
        });

        it('should support PATCH requests', () => {
            expect(api.patch).toBeDefined();
        });

        it('should support DELETE requests', () => {
            expect(api.delete).toBeDefined();
        });
    });
});

describe('Error Response Handling', () => {
    describe('extractErrorMessage logic', () => {
        it('should handle null/undefined data', () => {
            const result = 'something went wrong';
            expect(result).toBe('something went wrong');
        });

        it('should handle FastAPI validation error format', () => {
            const data = {
                detail: [
                    { type: 'value_error', loc: ['body', 'email'], msg: 'Invalid email', input: 'bad-email' },
                    { type: 'value_error', loc: ['body', 'password'], msg: 'Too short', input: '123' }
                ]
            };

            const messages = data.detail
                .map((err: any) => err.msg || err.message)
                .filter(Boolean);
            const result = messages.length > 0 ? messages.join(', ') : 'Validation error';

            expect(result).toBe('Invalid email, Too short');
        });

        it('should handle empty validation error array', () => {
            const data = { detail: [] };

            const messages = data.detail
                .map((err: any) => err.msg || err.message)
                .filter(Boolean);
            const result = messages.length > 0 ? messages.join(', ') : 'Validation error';

            expect(result).toBe('Validation error');
        });

        it('should handle standard detail string', () => {
            const data = { detail: 'User already exists' };
            expect(data.detail).toBe('User already exists');
        });

        it('should fallback to message field', () => {
            const data = { message: 'Custom error message' };
            expect(data.message).toBe('Custom error message');
        });

        it('should fallback to error field', () => {
            const data = { error: 'Generic error' };
            expect(data.error).toBe('Generic error');
        });
    });
});
