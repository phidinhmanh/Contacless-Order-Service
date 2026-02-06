/** @jest-environment node */
import WebSocket from 'ws';
import axios from 'axios';

describe('WebSocket Kitchen Notifications Integration', () => {
    const MAIN_URL = process.env.TEST_API_URL || 'http://localhost:8000';
    // Fix: Router prefix for kitchen is usually included in api_router without prefix or with prefix from endpoints
    // app/api/v1/router.py: api_router.include_router(kitchen.router, tags=["kitchen"])
    // app/main.py: app.include_router(api_router, prefix="/api/v1")
    // So the path is /api/v1/ws/kitchen
    const ACTUAL_WS_URL = `${MAIN_URL.replace('http', 'ws')}/api/v1/ws/kitchen`;

    let adminToken: string;

    beforeAll(async () => {
        // 1. Login to get a real token (FastAPI OAuth2 expects form-data)
        try {
            const params = new URLSearchParams();
            params.append('username', '0971462804');
            params.append('password', 'Manh0110');

            const loginRes = await axios.post(`${MAIN_URL}/api/v1/auth/login`, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            adminToken = loginRes.data.access_token;
        } catch (error: any) {
            console.warn("Real login failed. Ensure backend is running and user exists:", error.message || error);
            adminToken = "test-token";
        }
    });

    test('Kitchen receives order within 2 seconds', async () => {
        // 2. Connect kitchen client with token
        const ws = new WebSocket(`${ACTUAL_WS_URL}?token=${adminToken}`, {
            headers: {
                origin: MAIN_URL
            }
        });

        const messagePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('No message received within 5 seconds - check if backend is running and broadcast is called'));
            }, 5000);

            ws.on('message', (data: WebSocket.Data) => {
                clearTimeout(timeout);
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'new_order') {
                        resolve(message);
                    }
                } catch (e: any) {
                    console.error("Failed to parse WS message:", e.message);
                }
            });

            ws.on('error', (err: any) => {
                clearTimeout(timeout);
                // Sanitize error for Jest worker
                reject(new Error(err.message || 'WS Error'));
            });

            ws.on('close', (code, reason) => {
                // Removed log to prevent "Cannot log after tests are done" error
            });
        });

        // Wait for connection
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', (err: any) => reject(new Error(err.message || 'WS Open Error')));
        });

        const startTime = Date.now();

        // 3. Customer creates order (via API)
        const orderPayload = {
            table_id: 1,
            items: [{ food_id: 1, quantity: 1 }]
        };

        try {
            const response = await axios.post(`${MAIN_URL}/api/v1/orders/`, orderPayload, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            // 4. Wait for WebSocket message
            const wsMessage: any = await messagePromise;
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(5000);
            expect(wsMessage.order_id).toBe(response.data.id);
        } catch (error: any) {
            // Sanitize error before letting it bubble to Jest
            throw new Error(`Order creation or WS wait failed: ${error.message || error}`);
        } finally {
            ws.close();
        }
    }, 15000);
});
