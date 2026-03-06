'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UtensilsCrossed, Phone, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { usersApi, authApi } from '@/lib/api';

const ADMIN_TOKEN_KEY = 'admin_access_token';
const ADMIN_USER_KEY = 'admin_user';

export default function AdminLoginPage() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // 1. Get the token
            const authResponse = await authApi.phoneLogin(phone, password);
            const { access_token } = authResponse;

            // 2. Save token
            localStorage.setItem(ADMIN_TOKEN_KEY, access_token);

            // 3. Fetch user profile
            const userData = await usersApi.getMe();

            if (!['manager', 'admin'].includes(userData.role)) {
                // Clean up if they aren't authorized
                localStorage.removeItem(ADMIN_TOKEN_KEY);
                setError('Bạn không có quyền truy cập trang quản lý');
                return;
            }

            // 4. Save user data and cleanup
            localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(userData));
            localStorage.removeItem('access_token'); // Clear customer token

            router.push('/admin');
        } catch (err: any) {
            console.error(err.message)
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mx-auto mb-4">
                        <UtensilsCrossed size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary">Đăng nhập Quản lý</h1>
                    <p className="text-text-muted mt-2">Chỉ dành cho admin và quản lý</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="bg-dark-card rounded-2xl border border-dark-border p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Số điện thoại
                        </label>
                        <div className="relative">
                            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="0987654321"
                                required
                                className="w-full pl-10 pr-4 py-3 bg-dark-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Mật khẩu
                        </label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full pl-10 pr-4 py-3 bg-dark-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Đang đăng nhập...
                            </>
                        ) : (
                            'Đăng nhập'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
