'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {

        const connect = () => {
            // Get tokens from localStorage
            const adminToken = localStorage.getItem('admin_access_token');
            const guestToken = localStorage.getItem('access_token');
            const token = adminToken || guestToken;

            if (!token) {
                console.log('🔌 SocketProvider: No token found, postponing connection...');
                // Try again in 5s if still no token
                const timeout = setTimeout(connect, 5000);
                return () => clearTimeout(timeout);
            }

            const wsUrlBase = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/v1/ws/kitchen';
            const wsUrl = `${wsUrlBase}${wsUrlBase.includes('?') ? '&' : '?'}token=${token}`;

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('🔌 SocketProvider: Connected');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // 1. Dispatch generic refresh events
                    if (['menu_update', 'tables_update'].includes(data.type)) {
                        console.log(`🔄 Received ${data.type}, refreshing UI...`);
                        router.refresh();
                    }

                    if (['new_order', 'order_update', 'order_cancelled'].includes(data.type)) {
                        console.log(`🔔 Received ${data.type}, dispatching refresh-orders...`);
                        window.dispatchEvent(new Event('refresh-orders'));
                        router.refresh();
                    }

                    // 2. Dispatch detailed events for specific hooks (like AdminAudio)
                    const customEvent = new CustomEvent(`socket-${data.type}`, { detail: data });
                    window.dispatchEvent(customEvent);

                } catch (err) {
                    console.error('Socket parse error:', err);
                }
            };

            ws.onclose = (event) => {
                if (event.code === 1008) {
                    console.error('🔌 SocketProvider: Auth Failure (1008). Not auto-reconnecting.');
                    return;
                }
                console.log('Socket disconnected. Reconnecting in 3s...');
                setTimeout(connect, 3000);
            };

            ws.onerror = (err) => {
                console.error('Socket error:', err);
                ws.close();
            };
        };

        const cleanup = connect();

        return () => {
            if (cleanup && typeof cleanup === 'function') cleanup();
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [router]);

    return <>{children}</>;
}
