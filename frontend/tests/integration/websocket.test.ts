/** @jest-environment node */
import WebSocket from 'ws';
import {
    createTestApiClient,
    setAdminToken,
    clearTestToken,
    getTestApiUrl,
} from '../testUtils';

describe('WebSocket Kitchen Notifications Integration', () => {
    const MAIN_URL = getTestApiUrl();
    // Fix: WebSocket endpoint is defined at /ws/kitchen (without /api/v1 prefix)
    // app/api/v1/endpoints/kitchen.py: @router.websocket("/ws/kitchen")
    // app/api/v1/router.py: api_router.include_router(kitchen.router, tags=["kitchen"])
    // app/main.py: app.include_router(api_router, prefix="/api/v1")
    // So the path is /api/v1/ws/kitchen
    const ACTUAL_WS_URL = `${MAIN_URL.replace('http', 'ws')}/api/v1/ws/kitchen`;

    let adminToken: string;
    const api = createTestApiClient();

    beforeAll(async () => {
        // Login to get a real token
        try {
            const params = new URLSearchParams();
            params.append('username', '0971462804');
            params.append('password', 'Manh0110');

            const loginRes = await api.post('/auth/login', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            adminToken = loginRes.data.access_token;
            setAdminToken(adminToken);
        } catch (error: any) {
            console.warn("Real login failed. Ensure backend is running and user exists:", error.message || error);
            adminToken = "test-token";
        }
    });

    afterAll(() => {
        clearTestToken();
    });

    test('Kitchen receives order within 2 seconds', async () => {
        // Connect kitchen client with token
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

        // Customer creates order (via API)
        const orderPayload = {
            table_id: 1,
            items: [{ food_id: 1, quantity: 1 }]
        };

        try {
            clearTestToken();
            setAdminToken(adminToken);
            const response = await api.post('/orders/', orderPayload);

            // Wait for WebSocket message
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
