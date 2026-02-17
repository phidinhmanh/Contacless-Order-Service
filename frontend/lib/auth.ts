import { authApi, tablesApi, usersApi } from './api';
import type { GuestAuthResponse } from './types';

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Token management
export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_user');
}

// Get user ID from JWT token (for demographics etc.)
export function getUserIdFromToken(): string | null {
    const token = getToken();
    if (!token) return null;

    try {
        // Decode JWT payload (base64)
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        return decoded.sub || null;
    } catch {
        return null;
    }
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
    return !!getToken() && localStorage.getItem('guest_id') !== null;
}

// Guest authentication
export async function guestAuth(tableId: string): Promise<GuestAuthResponse> {
    const response = await authApi.guestAuth(tableId);

    const { access_token, refresh_token, user_id } = response;
    setToken(access_token);
    localStorage.setItem('guest_id', user_id || ''.toString());

    // Store refresh token for token refresh functionality
    if (typeof window !== 'undefined' && refresh_token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    }

    return response;
}

// Phone login
export async function phoneLogin(phone: string, password: string): Promise<void> {
    const response = await authApi.phoneLogin(phone, password);

    const { access_token, refresh_token } = response;
    setToken(access_token);

    if (typeof window !== 'undefined' && refresh_token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    }
}

// Logout
export function logout(): void {
    removeToken();
    // Also call backend to clear cookies
    authApi.logout().catch(() => { });
    if (typeof window !== 'undefined') {
        window.location.href = '/';
    }
}

// Get table ID from URL params
export function getTableIdFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('table_id') || params.get('table');
}

// Update guest demographics on server
export async function updateGuestDemographics(
    gender: string,
    age_group: string
): Promise<void> {
    const userId = getUserIdFromToken();
    if (!userId) {
        console.warn('No user ID found in token, skipping demographics update');
        return;
    }

    try {
        await authApi.updateGuestDemographics(userId, gender, age_group);
        console.log('✅ Guest demographics saved to server');
    } catch (err) {
        console.error('Failed to save guest demographics:', err);
    }
}

// Create or join table session
export async function createTableSession(
    tableId: number,
    guestCount: number,
    leadUserId?: number
): Promise<any> {
    try {
        return await tablesApi.createSession(tableId, {
            guest_count: guestCount,
            lead_user_id: leadUserId,
        });
    } catch (err) {
        console.error('Failed to create/join table session:', err);
        throw err;
    }
}

// Update lead guest info
export async function updateLeadGuestInfo(
    fullName: string,
    phoneNumber: string
): Promise<void> {
    await usersApi.updateLeadInfo(fullName, phoneNumber);
}
