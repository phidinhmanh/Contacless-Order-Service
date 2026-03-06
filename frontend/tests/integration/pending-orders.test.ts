/** @jest-environment node */
/**
 * Order Status Filter Tests
 *
 * Tests filtering orders by non-completed statuses.
 * Verifies that the API returns orders that are not yet completed.
 *
 * Run: npm test -- pending-orders.test.ts
 * Run specific: TEST_API_URL=http://localhost:8000 npm test -- pending-orders.test.ts
 */

import axios from 'axios';
import {
    createTestApiClient,
    setAdminToken,
    setCustomerToken,
    clearTestToken,
    getTestApiUrl,
} from '../testUtils';

describe('Get Non-Completed Orders', () => {
    const API_BASE_URL = getTestApiUrl();
    let adminToken: string;

    beforeAll(async () => {
        // Login as admin to get token (requires form-urlencoded data)
        try {
            const params = new URLSearchParams();
            params.append('username', '0386868686');
            params.append('password', 'AdminPassword123!');

            const response = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            adminToken = response.data.access_token;
            setAdminToken(adminToken);
        } catch (error) {
            console.error('Failed to login as admin:', error);
            throw new Error('Cannot proceed without admin token. Make sure backend is running and admin user exists.');
        }
    });

    afterAll(() => {
        clearTestToken();
    });

    it('should get orders with pending status', async () => {
        const api = createTestApiClient();

        const response = await api.get('/orders/status', {
            params: { status: 'pending' }
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);

        // Verify all returned orders have pending status
        if (response.data.length > 0) {
            response.data.forEach((order: { status: string }) => {
                expect(order.status).toBe('pending');
            });
        }
    });

    it('should get orders with confirmed status', async () => {
        const api = createTestApiClient();

        const response = await api.get('/orders/status', {
            params: { status: 'confirmed' }
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);

        // Verify all returned orders have confirmed status
        if (response.data.length > 0) {
            response.data.forEach((order: { status: string }) => {
                expect(order.status).toBe('confirmed');
            });
        }
    });

    it('should get orders with preparing status', async () => {
        const api = createTestApiClient();

        const response = await api.get('/orders/status', {
            params: { status: 'preparing' }
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);

        if (response.data.length > 0) {
            response.data.forEach((order: { status: string }) => {
                expect(order.status).toBe('preparing');
            });
        }
    });

    it('should get orders with ready status', async () => {
        const api = createTestApiClient();

        const response = await api.get('/orders/status', {
            params: { status: 'ready' }
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);

        if (response.data.length > 0) {
            response.data.forEach((order: { status: string }) => {
                expect(order.status).toBe('ready');
            });
        }
    });

    it('should get orders with multiple non-completed statuses', async () => {
        const api = createTestApiClient();

        const response = await api.get('/orders/status', {
            params: { status: 'pending,confirmed,preparing,ready' }
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);

        // Verify all returned orders have non-completed statuses
        const completedStatuses = ['completed', 'cancelled'];
        if (response.data.length > 0) {
            response.data.forEach((order: { status: string }) => {
                expect(completedStatuses).not.toContain(order.status);
            });
        }
    });

    it('should exclude completed orders when filtering', async () => {
        const api = createTestApiClient();

        // Get all non-completed orders
        const response = await api.get('/orders/status', {
            params: { status: 'pending,confirmed,preparing,ready,paid' }
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);

        // Verify no completed orders in response
        const completedStatuses = ['completed', 'cancelled'];
        if (response.data.length > 0) {
            response.data.forEach((order: { status: string }) => {
                expect(completedStatuses).not.toContain(order.status);
            });
        }
    });

    it('should get cancelled orders separately', async () => {
        const api = createTestApiClient();

        const response = await api.get('/orders/status', {
            params: { status: 'cancelled' }
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);

        if (response.data.length > 0) {
            response.data.forEach((order: { status: string }) => {
                expect(order.status).toBe('cancelled');
            });
        }
    });

    it('should return empty array for status with no orders', async () => {
        const api = createTestApiClient();

        const response = await api.get('/orders/status', {
            params: { status: 'nonexistent_status' }
        });

        // Should return empty array or 200 with []
        expect([200, 422]).toContain(response.status);
        if (response.status === 200) {
            expect(Array.isArray(response.data)).toBe(true);
            expect(response.data.length).toBe(0);
        }
    });

    it('should allow access without authentication (public endpoint)', async () => {
        // The /orders/status endpoint is public - no auth required
        const unauthenticatedApi = createTestApiClient();

        const response = await unauthenticatedApi.get('/orders/status', {
            params: { status: 'pending' }
        });

        // Should return 200 with empty array or results (no auth required)
        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
    });
});

describe('Order Lifecycle - Non-Completed to Cancelled', () => {
    const API_BASE_URL = getTestApiUrl();
    let adminToken: string;
    let userToken: string;
    let tableId: number;
    let testFoodId: number;
    let api: ReturnType<typeof createTestApiClient>;

    beforeAll(async () => {
        api = createTestApiClient();

        // Login as admin
        const adminParams = new URLSearchParams();
        adminParams.append('username', '0386868686');
        adminParams.append('password', 'AdminPassword123!');
        const adminResponse = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, adminParams, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        adminToken = adminResponse.data.access_token;
        setAdminToken(adminToken);

        // Register and login as test user
        const testPhone = `090${Date.now().toString().slice(-7)}`;
        await api.post('/auth/register', {
            phone_number: testPhone,
            password: 'TestUser123!',
            full_name: 'Test User'
        });

        const userParams = new URLSearchParams();
        userParams.append('username', testPhone);
        userParams.append('password', 'TestUser123!');
        const userResponse = await api.post('/auth/login', userParams, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        userToken = userResponse.data.access_token;

        // Get a table and available food
        const tablesResponse = await api.get('/tables/');
        tableId = tablesResponse.data[0]?.id || 1;

        const foodsResponse = await api.get('/foods/');
        const food = foodsResponse.data.find((f: { is_available: boolean; stock_quantity: number }) => f.is_available && f.stock_quantity >= 2);
        if (!food) {
            throw new Error('No available food with sufficient stock for testing');
        }
        testFoodId = food.id;
    });

    afterAll(() => {
        clearTestToken();
    });

    it('should find order in ready status after kitchen prepares it', async () => {
        clearTestToken();
        setCustomerToken(userToken);

        // Create order as user
        const orderResponse = await api.post('/orders/', {
            table_id: tableId,
            items: [{ food_id: testFoodId, quantity: 1 }]
        });
        const orderId = orderResponse.data.id;

        // Verify order is in pending status initially
        expect(orderResponse.data.status).toBe('pending');

        // Admin/kitchen confirms and prepares the order
        clearTestToken();
        setAdminToken(adminToken);

        // Transition to confirmed
        await api.put(`/orders/${orderId}`, { status: 'confirmed' });

        // Transition to preparing
        await api.put(`/orders/${orderId}`, { status: 'preparing' });

        // Transition to ready
        const readyResponse = await api.put(`/orders/${orderId}`, { status: 'ready' });
        expect(readyResponse.data.status).toBe('ready');

        // Verify order is accessible via ready status endpoint
        const readyOrdersResponse = await api.get('/orders/status', {
            params: { status: 'ready' }
        });

        expect(readyOrdersResponse.status).toBe(200);
        const foundOrder = readyOrdersResponse.data.find((o: { id: number }) => o.id === orderId);
        expect(foundOrder).toBeDefined();
        expect(foundOrder.status).toBe('ready');
    });

    it('should NOT find order in ready status after order is cancelled', async () => {
        clearTestToken();
        setCustomerToken(userToken);

        // Create a new order
        const orderResponse = await api.post('/orders/', {
            table_id: tableId,
            items: [{ food_id: testFoodId, quantity: 1 }]
        });
        const orderId = orderResponse.data.id;

        // Admin/kitchen transitions to ready
        clearTestToken();
        setAdminToken(adminToken);

        await api.put(`/orders/${orderId}`, { status: 'confirmed' });
        await api.put(`/orders/${orderId}`, { status: 'preparing' });
        await api.put(`/orders/${orderId}`, { status: 'ready' });

        // Verify order is in ready status - should be found
        let readyOrdersResponse = await api.get('/orders/status', {
            params: { status: 'ready' }
        });
        let foundOrder = readyOrdersResponse.data.find((o: { id: number }) => o.id === orderId);
        expect(foundOrder).toBeDefined();

        // Cancel the order
        await api.post(`/orders/${orderId}/cancel`);

        // Verify order is no longer in ready status
        readyOrdersResponse = await api.get('/orders/status', {
            params: { status: 'ready' }
        });

        foundOrder = readyOrdersResponse.data.find((o: { id: number }) => o.id === orderId);
        expect(foundOrder).toBeUndefined();

        // Verify order is in cancelled status
        const cancelledOrdersResponse = await api.get('/orders/status', {
            params: { status: 'cancelled' }
        });

        foundOrder = cancelledOrdersResponse.data.find((o: { id: number }) => o.id === orderId);
        expect(foundOrder).toBeDefined();
        expect(foundOrder.status).toBe('cancelled');
    });

    it('should NOT find order in non-completed statuses after cancellation', async () => {
        clearTestToken();
        setCustomerToken(userToken);

        // Create a new order
        const orderResponse = await api.post('/orders/', {
            table_id: tableId,
            items: [{ food_id: testFoodId, quantity: 1 }]
        });
        const orderId = orderResponse.data.id;

        // Admin/kitchen transitions to ready
        clearTestToken();
        setAdminToken(adminToken);

        await api.put(`/orders/${orderId}`, { status: 'confirmed' });
        await api.put(`/orders/${orderId}`, { status: 'preparing' });
        await api.put(`/orders/${orderId}`, { status: 'ready' });

        // Verify order is in ready status - should be found
        let nonCompletedResponse = await api.get('/orders/status', {
            params: { status: 'pending,confirmed,preparing,ready' }
        });

        let foundOrder = nonCompletedResponse.data.find((o: { id: number }) => o.id === orderId);
        expect(foundOrder).toBeDefined();

        // Cancel the order
        await api.post(`/orders/${orderId}/cancel`);

        // Verify order is NOT in non-completed statuses anymore
        nonCompletedResponse = await api.get('/orders/status', {
            params: { status: 'pending,confirmed,preparing,ready' }
        });

        foundOrder = nonCompletedResponse.data.find((o: { id: number }) => o.id === orderId);
        expect(foundOrder).toBeUndefined();
    });
});
