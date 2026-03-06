import { useEffect, useRef } from 'react';

// WebSocket URL - matching Next.js proxy or direct backend URL

export function useAdminAudio() {

    useEffect(() => {
        // Handler for socket events dispatched by SocketProvider
        const handleSocketMessage = (ev: Event) => {
            const customEv = ev as CustomEvent;
            const data = customEv.detail;

            try {
                console.log('📩 Admin Audio: Handled event:', data.type, data);

                // Listen for new order notifications
                if (data.type === 'new_order') {
                    const tableId = data.data?.table_id;
                    const message = tableId
                        ? `Có đơn mới từ bàn ${tableId}`
                        : 'Có đơn hàng mới';
                    playNotification(message);
                }

                // Listen for cash payment requests
                if (data.type === 'cash_payment_request') {
                    playNotification(data.message);
                }

                // Listen for payment confirmations
                if (data.type === 'payment_confirmed') {
                    playNotification(data.message || 'Đơn hàng đã thanh toán');
                }
            } catch (err) {
                console.error('Failed to handle WebSocket event in Admin Audio:', err);
            }
        };

        // Event types to subscripe to
        const subEvents = ['socket-new_order', 'socket-cash_payment_request', 'socket-payment_confirmed'];

        // Add listeners
        subEvents.forEach(e => window.addEventListener(e, handleSocketMessage));

        return () => {
            // Cleanup listeners
            subEvents.forEach(e => window.removeEventListener(e, handleSocketMessage));
        };
    }, []);

    const playNotification = (text: string) => {
        console.log('🔔 Playing notification:', text);

        if (!('speechSynthesis' in window)) {
            console.warn('Browser does not support text-to-speech');
            return;
        }

        // Cancel any currently playing speech to avoid overlap
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN'; // Vietnamese language
        utterance.rate = 1.0;     // Normal speed
        utterance.pitch = 1.0;    // Normal pitch

        window.speechSynthesis.speak(utterance);
    };
}
