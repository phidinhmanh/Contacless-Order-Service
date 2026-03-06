import { api } from './client';
import type { GuestAuthResponse } from '../types';

export const authApi = {
    /**
     * Guest authentication - creates a guest user for a table
     */
    guestAuth: (tableId: string) =>
        api.post<GuestAuthResponse>('/auth/guest', {
            table_id: parseInt(tableId, 10) || null,
        }, {
            withCredentials: true,
        }).then(r => r.data),

    /**
     * Phone login - authenticate with phone number and password
     */
    phoneLogin: (phone: string, password: string) => {
        const formData = new FormData();
        formData.append('username', phone);
        formData.append('password', password);

        return api.post('/auth/login', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        }).then(r => r.data);
    },

    /**
     * Register a new user
     */
    register: (data: {
        phone_number: string;
        password: string;
        full_name: string;
        email?: string;
    }) =>
        api.post('/auth/register', data).then(r => r.data),

    /**
     * Logout - clear server-side session
     */
    logout: () =>
        api.post('/auth/logout', null, { withCredentials: true }),

    /**
     * Update guest demographics (gender, age_group)
     */
    updateGuestDemographics: (guestId: string, gender: string, ageGroup: string) =>
        api.post('/auth/guest/demographics', null, {
            params: {
                guest_id: guestId,
                gender,
                age_group: ageGroup,
            }
        }),
};
