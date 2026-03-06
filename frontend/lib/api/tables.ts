import { api } from './client';

export const tablesApi = {
    /**
     * List all tables
     */
    list: () =>
        api.get('/tables/').then(r => r.data),

    /**
     * Get a single table by ID
     */
    getById: (id: number) =>
        api.get(`/tables/${id}`).then(r => r.data),

    /**
     * Create a new table
     */
    create: (data: {
        table_number: number;
        capacity?: number;
        location?: string;
    }) =>
        api.post('/tables/', data).then(r => r.data),

    /**
     * Update a table
     */
    update: (id: number, data: {
        table_number?: number;
        capacity?: number;
        location?: string;
        status?: string;
    }) =>
        api.put(`/tables/${id}`, data).then(r => r.data),

    /**
     * Delete a table
     */
    delete: (id: number) =>
        api.delete(`/tables/${id}`).then(r => r.data),

    /**
     * Regenerate QR code for a table
     */
    regenerateQr: (id: number) =>
        api.post(`/tables/${id}/regenerate-qr`).then(r => r.data),

    /**
     * Create or join a table session
     */
    createSession: (tableId: number, data: {
        guest_count: number;
        lead_user_id?: number;
    }) =>
        api.post(`/tables/${tableId}/session`, data).then(r => r.data),
};
