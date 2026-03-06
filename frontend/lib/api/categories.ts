import { api } from './client';

export const categoriesApi = {
    /**
     * List categories with optional filters
     */
    list: (params?: { include_inactive?: boolean }) =>
        api.get('/categories', { params }).then(r => r.data),

    /**
     * Get a single category by ID
     */
    getById: (id: number) =>
        api.get(`/categories/${id}`).then(r => r.data),

    /**
     * Create a new category
     */
    create: (data: {
        name: string;
        description?: string;
        display_order?: number;
        is_active?: boolean;
    }) =>
        api.post('/categories', data).then(r => r.data),

    /**
     * Update a category
     */
    update: (id: number, data: {
        name?: string;
        description?: string;
        display_order?: number;
        is_active?: boolean;
    }) =>
        api.put(`/categories/${id}`, data).then(r => r.data),

    /**
     * Delete a category
     */
    delete: (id: number) =>
        api.delete(`/categories/${id}`).then(r => r.data),

    /**
     * Toggle category active status
     */
    toggleActive: (id: number, isActive: boolean) =>
        api.put(`/categories/${id}`, { is_active: isActive }).then(r => r.data),
};
