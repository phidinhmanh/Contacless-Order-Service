'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usersApi, authApi } from '@/lib/api';

interface AdminUser {
    id: number;
    phone_number: string;
    full_name: string;
    role: string;
}

interface AdminAuthContextType {
    user: AdminUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (phone: string, password: string) => Promise<void>;
    logout: () => void;
    error: string | null;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function useAdminAuth() {
    const context = useContext(AdminAuthContext);
    if (!context) {
        throw new Error('useAdminAuth must be used within AdminAuthProvider');
    }
    return context;
}

const ADMIN_TOKEN_KEY = 'admin_access_token';
const ADMIN_USER_KEY = 'admin_user';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AdminUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Check for existing session on mountp
    useEffect(() => {
        const token = localStorage.getItem(ADMIN_TOKEN_KEY);
        const savedUser = localStorage.getItem(ADMIN_USER_KEY);

        if (token && savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                if (['manager', 'admin'].includes(parsedUser.role)) {
                    setUser(parsedUser);
                } else {
                    // Invalid role, clear storage
                    localStorage.removeItem(ADMIN_TOKEN_KEY);
                    localStorage.removeItem(ADMIN_USER_KEY);
                }
            } catch {
                localStorage.removeItem(ADMIN_TOKEN_KEY);
                localStorage.removeItem(ADMIN_USER_KEY);
            }
        }
        setIsLoading(false);
    }, []);

    const login = useCallback(async (phone: string, password: string) => {
        setError(null);
        setIsLoading(true);

        try {
            const authResponse = await authApi.phoneLogin(phone, password);
            const { access_token } = authResponse;

            // Fetch user profile to check role
            const userData = await usersApi.getMe();

            if (!['manager', 'admin'].includes(userData.role)) {
                throw new Error('Bạn không có quyền truy cập trang quản lý');
            }

            // Save to localStorage
            localStorage.setItem(ADMIN_TOKEN_KEY, access_token);
            localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(userData));

            setUser(userData);
            router.push('/admin');
        } catch (err: any) {
            const message = err.response?.data?.detail || err.message || 'Đăng nhập thất bại';
            setError(message);
            throw new Error(message);
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    const logout = useCallback(() => {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(ADMIN_USER_KEY);
        setUser(null);
        router.push('/admin/login');
    }, [router]);

    return (
        <AdminAuthContext.Provider value={{
            user,
            isLoading,
            isAuthenticated: !!user,
            login,
            logout,
            error,
        }}>
            {children}
        </AdminAuthContext.Provider>
    );
}
