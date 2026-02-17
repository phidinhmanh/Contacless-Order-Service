import { api } from './client';

export const analyticsApi = {
    /**
     * Get revenue analytics
     */
    revenue: (params?: { start_date?: string; end_date?: string }) =>
        api.get('/analytics/revenue', { params }).then(r => r.data),

    /**
     * Get popular items analytics
     */
    popularItems: (params?: { days?: number; limit?: number }) =>
        api.get('/analytics/popular-items', { params }).then(r => r.data),

    /**
     * Get peak hours analytics
     */
    peakHours: (params?: { days?: number }) =>
        api.get('/analytics/peak-hours', { params }).then(r => r.data),

    /**
     * Get customer analytics
     */
    customers: () =>
        api.get('/analytics/customers').then(r => r.data),

    /**
     * Get customer retention analytics
     */
    retention: () =>
        api.get('/analytics/retention').then(r => r.data),
};
