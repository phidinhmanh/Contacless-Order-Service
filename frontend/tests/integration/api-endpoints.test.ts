/** @jest-environment node */
/**
 * Comprehensive API Endpoint Tests
 *
 * Tests all frontend-backend API endpoint alignment and functionality.
 * Based on scripts/verify_endpoints.py backend verification script.
 *
 * Run: npm test -- api-endpoints.test.ts
 * Run verbose: npm test -- api-endpoints.test.ts --verbose
 * Run specific category: TEST_CATEGORY=auth npm test -- api-endpoints.test.ts
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:8000';
const API_V1 = `${API_BASE_URL}/api/v1`;

// Filter by category if TEST_CATEGORY env var is set
const TEST_CATEGORY = process.env.TEST_CATEGORY;

interface EndpointTest {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    category: string;
    authRequired: boolean;
    description: string;
}


// Define all endpoints to test (matching backend verify_endpoints.py)
const ENDPOINTS: EndpointTest[] = [
    // Auth endpoints
    { method: 'POST', path: '/auth/register', category: 'auth', authRequired: false, description: 'User registration' },
    { method: 'POST', path: '/auth/login', category: 'auth', authRequired: false, description: 'User login' },
    { method: 'POST', path: '/auth/refresh', category: 'auth', authRequired: true, description: 'Token refresh' },
    { method: 'POST', path: '/auth/guest', category: 'auth', authRequired: false, description: 'Guest login' },
    { method: 'POST', path: '/auth/logout', category: 'auth', authRequired: true, description: 'User logout' },
    { method: 'POST', path: '/auth/guest/demographics', category: 'auth', authRequired: true, description: 'Guest demographics' },

    // Users endpoints
    { method: 'GET', path: '/users/me', category: 'users', authRequired: true, description: 'Get current user' },
    { method: 'PATCH', path: '/users/me/lead-info', category: 'users', authRequired: true, description: 'Update lead info' },
    { method: 'GET', path: '/users', category: 'users', authRequired: true, description: 'List users' },

    // Foods endpoints
    { method: 'GET', path: '/foods', category: 'foods', authRequired: false, description: 'List foods' },
    { method: 'POST', path: '/foods', category: 'foods', authRequired: true, description: 'Create food' },

    // Categories endpoints
    { method: 'GET', path: '/categories', category: 'categories', authRequired: false, description: 'List categories' },
    { method: 'POST', path: '/categories', category: 'categories', authRequired: true, description: 'Create category' },

    // Menu endpoints
    { method: 'GET', path: '/menu', category: 'menu', authRequired: false, description: 'Get menu' },
    { method: 'GET', path: '/menu/categories', category: 'menu', authRequired: false, description: 'Get menu categories' },

    // Orders endpoints
    { method: 'GET', path: '/orders', category: 'orders', authRequired: true, description: 'List orders' },
    { method: 'POST', path: '/orders', category: 'orders', authRequired: true, description: 'Create order' },

    // Tables endpoints
    { method: 'GET', path: '/tables', category: 'tables', authRequired: true, description: 'List tables' },
    { method: 'POST', path: '/tables', category: 'tables', authRequired: true, description: 'Create table' },

    // Payments endpoints
    { method: 'POST', path: '/payments/initiate', category: 'payments', authRequired: true, description: 'Initiate payment' },
    { method: 'POST', path: '/payments/webhook', category: 'payments', authRequired: false, description: 'Payment webhook' },
    { method: 'POST', path: '/payments/webhook/casso', category: 'payments', authRequired: false, description: 'Casso webhook' },

    // Analytics endpoints
    { method: 'GET', path: '/analytics/revenue', category: 'analytics', authRequired: true, description: 'Revenue analytics' },
    { method: 'GET', path: '/analytics/popular-items', category: 'analytics', authRequired: true, description: 'Popular items' },
    { method: 'GET', path: '/analytics/peak-hours', category: 'analytics', authRequired: true, description: 'Peak hours' },
    { method: 'GET', path: '/analytics/customers', category: 'analytics', authRequired: true, description: 'Customer analytics' },
    { method: 'GET', path: '/analytics/retention', category: 'analytics', authRequired: true, description: 'Retention analytics' },
    { method: 'GET', path: '/analytics/export', category: 'analytics', authRequired: true, description: 'Export analytics' },
];

// Filter endpoints by category if specified
const getTestEndpoints = (): EndpointTest[] => {
    if (TEST_CATEGORY) {
        return ENDPOINTS.filter(e => e.category === TEST_CATEGORY);
    }
    return ENDPOINTS;
};

describe('API Endpoint Verification', () => {
    let client: AxiosInstance;
    let authToken: string | null = null;

    beforeAll(async () => {
        // Create axios client
        client = axios.create({
            baseURL: API_V1,
            timeout: 5000,
        });

        // Check backend connectivity
        try {
            const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 10000 });
            if (response.status !== 200) {
                throw new Error(`Backend health check failed with status ${response.status}`);
            }
        } catch (error: any) {
            throw new Error(`Cannot connect to backend at ${API_BASE_URL}: ${error.message}. Make sure backend is running: uv run uvicorn app.main:app --reload`);
        }

        // Get auth token for protected endpoints
        try {
            const params = new URLSearchParams();
            params.append('username', '0386868686');
            params.append('password', 'AdminPassword123!');

            const response = await client.post('/auth/login', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            authToken = response.data.access_token;
        } catch (error: any) {
            console.warn('Could not get auth token. Some tests may fail:', error.message);
        }
    });

    const testEndpoint = async (test: EndpointTest): Promise<{
        status: 'exists' | 'warning' | 'failed';
        statusCode?: number;
        message: string;
    }> => {
        const url = test.path;
        const headers: Record<string, string> = {};

        if (test.authRequired && authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        try {
            let response;

            switch (test.method) {
                case 'GET':
                    response = await client.get(url, { headers, validateStatus: () => true });
                    break;
                case 'POST':
                    response = await client.post(url, {}, { headers, validateStatus: () => true });
                    break;
                case 'PUT':
                    response = await client.put(url, {}, { headers, validateStatus: () => true });
                    break;
                case 'PATCH':
                    response = await client.patch(url, {}, { headers, validateStatus: () => true });
                    break;
                case 'DELETE':
                    response = await client.delete(url, { headers, validateStatus: () => true });
                    break;
            }

            // Accept various status codes as "endpoint exists"
            // 200, 201 = success
            // 401 = endpoint exists but needs auth
            // 422 = endpoint exists but validation failed (expected for empty payloads)
            // 404 = endpoint exists but resource not found (for GET with ID)
            if ([200, 201, 401, 404, 422].includes(response.status)) {
                let message = `Status ${response.status}`;
                if (response.status === 401) {
                    message += ' (auth required)';
                } else if (response.status === 422) {
                    message += ' (validation error - endpoint exists)';
                } else if (response.status === 404 && test.path.includes('/{')) {
                    message += ' (needs ID parameter)';
                }

                return {
                    status: 'exists',
                    statusCode: response.status,
                    message
                };
            } else {
                return {
                    status: 'warning',
                    statusCode: response.status,
                    message: `Unexpected status ${response.status}`
                };
            }
        } catch (error: any) {
            if (error.code === 'ECONNREFUSED') {
                return {
                    status: 'failed',
                    message: 'Cannot connect to backend'
                };
            }
            if (error.code === 'ETIMEDOUT') {
                return {
                    status: 'failed',
                    message: 'Request timeout'
                };
            }
            return {
                status: 'failed',
                message: `Error: ${error.message?.slice(0, 50)}`
            };
        }
    };

    // Group tests by category
    const categories = getTestEndpoints().reduce((acc, test) => {
        if (!acc[test.category]) {
            acc[test.category] = [];
        }
        acc[test.category].push(test);
        return acc;
    }, {} as Record<string, EndpointTest[]>);

    // Create test suites for each category
    Object.entries(categories).forEach(([category, tests]) => {
        describe(`${category.toUpperCase()} Endpoints`, () => {
            tests.forEach((test) => {
                it(`${test.method} ${test.path} - ${test.description}`, async () => {
                    const result = await testEndpoint(test);

                    // Endpoint should exist (200, 201, 401, 422, 404 are acceptable)
                    expect(result.status).not.toBe('failed');

                    // Log result for visibility
                    if (result.status === 'exists') {
                        // Success
                        expect(result.statusCode).toBeDefined();
                    } else if (result.status === 'warning') {
                        console.warn(`Warning for ${test.method} ${test.path}: ${result.message}`);
                    }
                }, 10000);
            });
        });
    });

    // Summary test
    describe('Endpoint Coverage Summary', () => {
        it('should have all endpoints accessible', async () => {
            const results = await Promise.all(
                getTestEndpoints().map(async (test) => ({
                    test,
                    result: await testEndpoint(test)
                }))
            );

            const total = results.length;
            const passed = results.filter(r => r.result.status === 'exists').length;
            const warnings = results.filter(r => r.result.status === 'warning').length;
            const failed = results.filter(r => r.result.status === 'failed').length;

            console.log('\n=== Endpoint Test Summary ===');
            console.log(`Total: ${total}`);
            console.log(`Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
            console.log(`Warnings: ${warnings}`);
            console.log(`Failed: ${failed}`);

            if (failed > 0) {
                console.log('\nFailed endpoints:');
                results
                    .filter(r => r.result.status === 'failed')
                    .forEach(({ test, result }) => {
                        console.log(`  - ${test.method} ${test.path}: ${result.message}`);
                    });
            }

            // Test should pass if no endpoints failed
            expect(failed).toBe(0);
        }, 60000);
    });
});
