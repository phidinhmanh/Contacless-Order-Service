import { api } from './client';

export const paymentsApi = {
    /**
     * Initiate a payment for an order
     */
    initiate: (data: {
        order_id: number;
        payment_method: 'vietqr' | 'cash' | 'card';
        amount?: number;
    }) =>
        api.post('/payments/initiate', data).then(r => r.data),

    /**
     * Get payment status by payment ID
     */
    getStatus: (paymentId: number) =>
        api.get(`/payments/${paymentId}`).then(r => r.data),
};
