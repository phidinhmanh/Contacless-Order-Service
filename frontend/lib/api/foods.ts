import { api } from './client';

export const foodsApi = {
    /**
     * List foods with optional filters
     */
    list: (params?: Record<string, string>) =>
        api.get('/foods/', { params }).then(r => r.data),

    /**
     * Get a single food by ID
     */
    getById: (id: number) =>
        api.get(`/foods/${id}`).then(r => r.data),

    /**
     * Create a new food item
     */
    create: (data: {
        name: string;
        description?: string;
        price: number;
        category_id?: number | null;
        image_url?: string;
        is_available?: boolean;
        stock_quantity?: number;
    }) =>
        api.post('/foods/', data).then(r => r.data),

    /**
     * Update a food item
     */
    update: (id: number, data: {
        name?: string;
        description?: string;
        price?: number;
        category_id?: number | null;
        image_url?: string;
        is_available?: boolean;
        stock_quantity?: number;
    }) =>
        api.put(`/foods/${id}`, data).then(r => r.data),

    /**
     * Delete a food item
     */
    delete: (id: number) =>
        api.delete(`/foods/${id}`).then(r => r.data),

    /**
     * Update stock quantity
     */
    updateStock: (id: number, stockQuantity: number) =>
        api.patch(`/foods/${id}/stock`, { stock_quantity: stockQuantity }).then(r => r.data),

    /**
     * Toggle food availability
     */
    toggleAvailability: (id: number, isAvailable: boolean) =>
        api.put(`/foods/${id}`, { is_available: isAvailable }).then(r => r.data),

    /**
     * Upload food image
     */
    uploadImage: (foodId: number, file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        return api.post(`/foods/${foodId}/image`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }).then(r => r.data);
    },
};
