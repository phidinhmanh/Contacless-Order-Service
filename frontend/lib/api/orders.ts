import { api } from './client';

export const ordersApi = {
    /**
     * List orders with optional filters
     * Uses different endpoints based on params:
     * - status: GET /orders/status?status=pending,confirmed (comma-separated)
     * - table_id: GET /orders/table/{table_id}
     * - none: GET /orders/ with skip/limit
     */
    list: (params?: { limit?: number; skip?: number; status?: string | string[]; table_id?: number }) => {
        if (params?.status) {
            const statusParam = Array.isArray(params.status) ? params.status.join(',') : params.status;
            return api.get('/orders/status', { params: { status: statusParam } }).then(r => r.data);
        }
        if (params?.table_id) {
            return api.get(`/orders/table/${params.table_id}`).then(r => r.data);
        }
        return api.get('/orders/', { params: { skip: params?.skip ?? 0, limit: params?.limit ?? 100 } }).then(r => r.data);
    },

    /**
     * Get orders by table ID
     */
    getByTable: (tableId: number) =>
        api.get(`/orders/table/${tableId}`).then(r => r.data),

    /**
     * Get a single order by ID
     */
    getById: (id: number) =>
        api.get(`/orders/${id}`).then(r => r.data),

    /**
     * Create a new order
     */
    create: (data: {
        table_id: number;
        items: Array<{ food_id: number; quantity: number; notes?: string }>;
        notes?: string;
    }) =>
        api.post('/orders/', data).then(r => r.data),

    /**
     * Cancel an order
     */
    cancel: (id: number) =>
        api.post(`/orders/${id}/cancel`).then(r => r.data),

    /**
     * Update order status
     */
    updateStatus: (id: number, status: string, extra?: Record<string, unknown>) =>
        api.put(`/orders/${id}`, { status, ...extra }).then(r => r.data),

    /**
     * Mark order as paid with cash
     */
    payCash: (id: number) =>
        api.post(`/orders/${id}/pay-cash`).then(r => r.data),
};
