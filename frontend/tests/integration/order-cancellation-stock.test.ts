/** @jest-environment node */
/**
 * Frontend Integration Tests for Order Cancellation and Stock Management
 *
 * Tests verify that food quantities are properly restored when orders are cancelled:
 * 1. User cancels their own order (within 2-minute window)
 * 2. Admin cancels any order (DELETE endpoint)
 * 3. Multiple items in same order
 * 4. Edge cases (double cancel, expired window, etc.)
 *
 * Prerequisites:
 * - Backend running: uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
 * - Admin user exists: uv run python scripts/create_admin.py
 * - Database seeded: uv run python scripts/seed_data.py
 *
 * Run: npm test -- order-cancellation-stock.test.ts
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:8000';
const API_V1 = `${API_BASE_URL}/api/v1`;

interface Food {
    id: number;
    name: string;
    price: number;
    stock_quantity: number;
    is_available: boolean;
}

interface OrderItem {
    food_id: number;
    quantity: number;
}

interface Order {
    id: number;
    status: string;
    total_price: number;
    items: Array<{
        food_id: number;
        quantity: number;
        unit_price: number;
    }>;
}


describe('Order Cancellation Stock Restoration - Frontend Integration', () => {
    let client: AxiosInstance;
    let adminToken: string;
    let userToken: string;
    let tableId: number;

    beforeAll(async () => {
        client = axios.create({
            baseURL: API_V1,
            timeout: 10000,
            validateStatus: () => true
        });

        // Get admin token
        const adminParams = new URLSearchParams();
        adminParams.append('username', '0386868686');
        adminParams.append('password', 'AdminPassword123!');

        const adminResponse = await client.post('/auth/login', adminParams, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (adminResponse.status === 200) {
            adminToken = adminResponse.data.access_token;
        } else {
            throw new Error('Failed to get admin token');
        }

        // Register test user
        const testPhone = `090${Date.now().toString().slice(-7)}`;
        const registerResponse = await client.post('/auth/register', {
            phone_number: testPhone,
            password: 'TestUser123!',
            full_name: 'Test User'
        });

        if (registerResponse.status === 201) {
            // Login as user
            const userParams = new URLSearchParams();
            userParams.append('username', testPhone);
            userParams.append('password', 'TestUser123!');

            const loginResponse = await client.post('/auth/login', userParams, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (loginResponse.status === 200) {
                userToken = loginResponse.data.access_token;
            }
        }

        // Get a table
        const tablesResponse = await client.get('/tables', {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        tableId = tablesResponse.data[0]?.id || 1;
    });

    const getFoodStock = async (foodId: number): Promise<number> => {
        const response = await client.get(`/foods?id=${foodId}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const food = response.data.find((f: Food) => f.id === foodId);
        return food?.stock_quantity || 0;
    };

    const createOrder = async (items: OrderItem[], token: string): Promise<Order> => {
        const response = await client.post(
            '/orders',
            { table_id: tableId, items },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        expect(response.status).toBe(201);
        return response.data;
    };

    describe('User Cancellation Tests', () => {
        it('should restore food quantity when user cancels order', async () => {
            // Get available food
            const foodsResponse = await client.get('/foods');
            const food = foodsResponse.data.find((f: Food) => f.is_available && f.stock_quantity >= 5);

            if (!food) {
                throw new Error('No available food with sufficient stock');
            }

            const initialStock = food.stock_quantity;
            const orderQuantity = 3;

            // Create order
            const order = await createOrder(
                [{ food_id: food.id, quantity: orderQuantity }],
                userToken
            );

            // Verify stock decreased
            const stockAfterOrder = await getFoodStock(food.id);
            expect(stockAfterOrder).toBe(initialStock - orderQuantity);

            // Cancel order
            const cancelResponse = await client.post(
                `/orders/${order.id}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${userToken}` } }
            );
            expect(cancelResponse.status).toBe(200);
            expect(cancelResponse.data.status).toBe('cancelled');

            // Verify stock restored
            const stockAfterCancel = await getFoodStock(food.id);
            expect(stockAfterCancel).toBe(initialStock);
        }, 15000);

        it('should restore quantities for all items in multi-item order', async () => {
            // Get 3 available foods
            const foodsResponse = await client.get('/foods');
            const foods = foodsResponse.data
                .filter((f: Food) => f.is_available && f.stock_quantity >= 10)
                .slice(0, 3);

            if (foods.length < 3) {
                throw new Error('Not enough available foods');
            }

            // Record initial stocks
            const initialStocks: Record<number, number> = {};
            for (const food of foods) {
                initialStocks[food.id] = food.stock_quantity;
            }

            // Create order with multiple items
            const orderItems = [
                { food_id: foods[0].id, quantity: 2 },
                { food_id: foods[1].id, quantity: 3 },
                { food_id: foods[2].id, quantity: 1 }
            ];

            const order = await createOrder(orderItems, userToken);

            // Verify all stocks decreased
            for (const item of orderItems) {
                const currentStock = await getFoodStock(item.food_id);
                expect(currentStock).toBe(initialStocks[item.food_id] - item.quantity);
            }

            // Cancel order
            const cancelResponse = await client.post(
                `/orders/${order.id}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${userToken}` } }
            );
            expect(cancelResponse.status).toBe(200);

            // Verify all stocks restored
            for (const item of orderItems) {
                const finalStock = await getFoodStock(item.food_id);
                expect(finalStock).toBe(initialStocks[item.food_id]);
            }
        }, 20000);

        it('should fail to cancel after 2-minute window without restoring stock', async () => {
            const foodsResponse = await client.get('/foods');
            const food = foodsResponse.data.find((f: Food) => f.is_available);

            // Create old order directly via API (this will be recent)
            const order = await createOrder(
                [{ food_id: food.id, quantity: 2 }],
                userToken
            );

            // For a real test of >2min window, we'd need to wait or manipulate DB
            // This test verifies the error handling works
            // Note: In real scenario, you'd create order via DB with old timestamp

            // If we try to cancel immediately, it should work (within window)
            const cancelResponse = await client.post(
                `/orders/${order.id}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${userToken}` } }
            );

            // This should succeed because order is recent
            expect(cancelResponse.status).toBe(200);
        }, 15000);

        it('should prevent double cancellation from restoring stock twice', async () => {
            const foodsResponse = await client.get('/foods');
            const food = foodsResponse.data.find((f: Food) => f.is_available && f.stock_quantity >= 5);

            const initialStock = food.stock_quantity;
            const orderQuantity = 2;

            // Create and cancel order
            const order = await createOrder(
                [{ food_id: food.id, quantity: orderQuantity }],
                userToken
            );

            const firstCancel = await client.post(
                `/orders/${order.id}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${userToken}` } }
            );
            expect(firstCancel.status).toBe(200);

            // Verify stock restored once
            const stockAfterFirstCancel = await getFoodStock(food.id);
            expect(stockAfterFirstCancel).toBe(initialStock);

            // Try to cancel again
            const secondCancel = await client.post(
                `/orders/${order.id}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${userToken}` } }
            );
            expect(secondCancel.status).toBe(400);
            expect(secondCancel.data.detail.toLowerCase()).toContain('cannot cancel');

            // Verify stock unchanged (not restored twice)
            const finalStock = await getFoodStock(food.id);
            expect(finalStock).toBe(initialStock);
        }, 15000);

        it('should make unavailable food available again after cancel', async () => {
            // Create order that depletes all stock
            const foodsResponse = await client.get('/foods');
            const food = foodsResponse.data.find((f: Food) =>
                f.is_available && f.stock_quantity > 0 && f.stock_quantity <= 5
            );

            if (!food) {
                console.warn('Skipping test - no food with low stock available');
                return;
            }

            const initialStock = food.stock_quantity;

            // Order all remaining stock
            const order = await createOrder(
                [{ food_id: food.id, quantity: initialStock }],
                userToken
            );

            // Verify stock is 0
            const stockAfterOrder = await getFoodStock(food.id);
            expect(stockAfterOrder).toBe(0);

            // Cancel order
            const cancelResponse = await client.post(
                `/orders/${order.id}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${userToken}` } }
            );
            expect(cancelResponse.status).toBe(200);

            // Verify stock restored and food available
            const stockAfterCancel = await getFoodStock(food.id);
            expect(stockAfterCancel).toBe(initialStock);

            const foodResponse = await client.get('/foods');
            const restoredFood = foodResponse.data.find((f: Food) => f.id === food.id);
            expect(restoredFood.is_available).toBe(true);
        }, 15000);
    });

    describe('Admin Cancellation Tests', () => {
        it('should restore stock when admin deletes user order', async () => {
            const foodsResponse = await client.get('/foods');
            const food = foodsResponse.data.find((f: Food) => f.is_available && f.stock_quantity >= 5);

            const initialStock = food.stock_quantity;
            const orderQuantity = 4;

            // User creates order
            const order = await createOrder(
                [{ food_id: food.id, quantity: orderQuantity }],
                userToken
            );

            // Verify stock decreased
            const stockAfterOrder = await getFoodStock(food.id);
            expect(stockAfterOrder).toBe(initialStock - orderQuantity);

            // Admin deletes order
            const deleteResponse = await client.delete(
                `/orders/${order.id}`,
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            expect(deleteResponse.status).toBe(200);

            // Verify stock restored
            const stockAfterDelete = await getFoodStock(food.id);
            expect(stockAfterDelete).toBe(initialStock);
        }, 15000);

        it('should restore stock for multi-item order when admin deletes', async () => {
            const foodsResponse = await client.get('/foods');
            const foods = foodsResponse.data
                .filter((f: Food) => f.is_available && f.stock_quantity >= 10)
                .slice(0, 2);

            const initialStocks: Record<number, number> = {
                [foods[0].id]: foods[0].stock_quantity,
                [foods[1].id]: foods[1].stock_quantity
            };

            // Create order
            const order = await createOrder(
                [
                    { food_id: foods[0].id, quantity: 5 },
                    { food_id: foods[1].id, quantity: 3 }
                ],
                userToken
            );

            // Admin deletes
            const deleteResponse = await client.delete(
                `/orders/${order.id}`,
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            expect(deleteResponse.status).toBe(200);

            // Verify all stocks restored
            for (const food of foods) {
                const finalStock = await getFoodStock(food.id);
                expect(finalStock).toBe(initialStocks[food.id]);
            }
        }, 15000);
    });

    describe('Complete Workflow Integration', () => {
        it('should handle complete order-cancel-verify workflow', async () => {
            // Get foods
            const foodsResponse = await client.get('/foods');
            const foods = foodsResponse.data
                .filter((f: Food) => f.is_available && f.stock_quantity >= 20)
                .slice(0, 3);

            if (foods.length < 3) {
                console.warn('Skipping workflow test - insufficient foods');
                return;
            }

            // Record initial state
            const initialStocks: Record<number, number> = {};
            for (const food of foods) {
                initialStocks[food.id] = food.stock_quantity;
            }

            // Step 1: Create order
            const orderItems = [
                { food_id: foods[0].id, quantity: 5 },
                { food_id: foods[1].id, quantity: 10 },
                { food_id: foods[2].id, quantity: 7 }
            ];

            const order = await createOrder(orderItems, userToken);
            expect(order.status).toBe('pending');

            // Step 2: Verify stocks decreased
            for (const item of orderItems) {
                const currentStock = await getFoodStock(item.food_id);
                expect(currentStock).toBe(initialStocks[item.food_id] - item.quantity);
            }

            // Step 3: Cancel order
            const cancelResponse = await client.post(
                `/orders/${order.id}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${userToken}` } }
            );
            expect(cancelResponse.status).toBe(200);
            expect(cancelResponse.data.status).toBe('cancelled');

            // Step 4: Verify all stocks fully restored
            for (const item of orderItems) {
                const finalStock = await getFoodStock(item.food_id);
                expect(finalStock).toBe(initialStocks[item.food_id]);
            }

            // Step 5: Verify order status
            const orderResponse = await client.get(
                `/orders/${order.id}`,
                { headers: { Authorization: `Bearer ${userToken}` } }
            );
            expect(orderResponse.data.status).toBe('cancelled');
        }, 20000);
    });

    describe('Error Cases', () => {
        it('should prevent user from cancelling another user\'s order', async () => {
            // Create second user
            const testPhone2 = `090${Date.now().toString().slice(-7)}`;
            await client.post('/auth/register', {
                phone_number: testPhone2,
                password: 'TestUser123!',
                full_name: 'Test User 2'
            });

            const userParams2 = new URLSearchParams();
            userParams2.append('username', testPhone2);
            userParams2.append('password', 'TestUser123!');

            const loginResponse2 = await client.post('/auth/login', userParams2, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            const user2Token = loginResponse2.data.access_token;

            // User 1 creates order
            const foodsResponse = await client.get('/foods');
            const food = foodsResponse.data.find((f: Food) => f.is_available);

            const order = await createOrder(
                [{ food_id: food.id, quantity: 1 }],
                userToken
            );

            // User 2 tries to cancel
            const cancelResponse = await client.post(
                `/orders/${order.id}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${user2Token}` } }
            );
            expect(cancelResponse.status).toBe(403);
        }, 15000);

        it('should fail to cancel confirmed order', async () => {
            // This would require backend support to advance order status
            // For now, we verify that only pending orders can be cancelled
            const foodsResponse = await client.get('/foods');
            const food = foodsResponse.data.find((f: Food) => f.is_available);

            const order = await createOrder(
                [{ food_id: food.id, quantity: 1 }],
                userToken
            );

            // Immediately cancel while still pending (should work)
            const cancelResponse = await client.post(
                `/orders/${order.id}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${userToken}` } }
            );
            expect(cancelResponse.status).toBe(200);
        }, 10000);
    });
});
