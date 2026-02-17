import { api } from './client';

export const usersApi = {
    /**
     * Get current user profile
     */
    getMe: () =>
        api.get('/users/me').then(r => r.data),

    /**
     * List users with optional filters
     */
    list: (params?: { limit?: number; skip?: number }) =>
        api.get('/users', { params }).then(r => r.data),

    /**
     * Update lead guest information
     */
    updateLeadInfo: (fullName: string, phoneNumber: string) =>
        api.patch('/users/me/lead-info', null, {
            params: {
                full_name: fullName,
                phone_number: phoneNumber,
            }
        }).then(r => r.data),
};
