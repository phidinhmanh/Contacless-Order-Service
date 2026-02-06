'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { UtensilsCrossed, User, Phone, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { guestAuth, phoneLogin, isAuthenticated } from '@/lib/auth';
import { useCartStore } from '@/store/cartStore';

// 1. Tách logic UI chính ra một component con
function WelcomeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Lấy table_id từ URL và cập nhật vào Store
    const tableId = searchParams.get('table_id') || searchParams.get('table') || '1';
    const setTableId = useCartStore((state) => state.setTableId);

    // Cập nhật tableId vào store khi component mount
    useEffect(() => {
        setTableId(tableId);
    }, [tableId, setTableId]);

    const [isLoading, setIsLoading] = useState(false);
    const [showLoginForm, setShowLoginForm] = useState(false);
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isAuthenticated()) {
            router.push('/menu');
        }
    }, [router]);

    const handleStartOrdering = async () => {
        setIsLoading(true);
        setError('');
        try {
            await guestAuth(tableId);
            router.push('/menu');
        } catch (err: any) {
            setError(err.message || 'Không thể kết nối. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePhoneLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await phoneLogin(phone, password);
            router.push('/menu');
        } catch (err: any) {
            setError(err.message || 'Sai số điện thoại hoặc mật khẩu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-dark-bg via-dark-surface to-dark-bg">
            <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', duration: 0.8 }}
                className="mb-8"
            >
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-2xl shadow-primary-500/30">
                    <UtensilsCrossed size={56} className="text-white" />
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center mb-8"
            >
                <h1 className="text-3xl font-bold text-text-primary mb-2">Chào mừng!</h1>
                <p className="text-text-secondary">Đặt món dễ dàng, không cần chờ đợi</p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="mb-8"
            >
                <Badge size="lg" variant="info">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        Bàn số {tableId}
                    </span>
                </Badge>
            </motion.div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center"
                >
                    {error}
                </motion.div>
            )}

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="w-full max-w-sm space-y-4"
            >
                {showLoginForm ? (
                    <form onSubmit={handlePhoneLogin} className="space-y-4">
                        <Input
                            type="tel"
                            placeholder="Số điện thoại"
                            icon={<Phone size={18} />}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                        />
                        <Input
                            type="password"
                            placeholder="Mật khẩu"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
                            Đăng nhập
                        </Button>
                        <div className="flex items-center gap-4 text-sm">
                            <button
                                type="button"
                                onClick={() => setShowLoginForm(false)}
                                className="flex-1 text-center text-text-secondary hover:text-text-primary py-2"
                            >
                                ← Quay lại
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/register')}
                                className="flex-1 flex items-center justify-center gap-1 text-primary-400 hover:text-primary-300 py-2"
                            >
                                <UserPlus size={16} /> Đăng ký
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <Button
                            onClick={handleStartOrdering}
                            isLoading={isLoading}
                            className="w-full"
                            size="lg"
                        >
                            Bắt đầu đặt món
                        </Button>
                        <button
                            onClick={() => setShowLoginForm(true)}
                            className="w-full flex items-center justify-center gap-2 text-text-secondary hover:text-primary-400 transition-colors py-3"
                        >
                            <User size={18} /> Đăng nhập với số điện thoại
                        </button>
                    </>
                )}
            </motion.div>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-12 text-text-muted text-xs text-center"
            >
                Powered by Contactless Order Service
            </motion.p>
        </div>
    );
}

// 2. Export mặc định bao bọc bởi Suspense để Next.js build thành công
export default function WelcomePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-dark-bg">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500"></div>
            </div>
        }>
            <WelcomeContent />
        </Suspense>
    );
}