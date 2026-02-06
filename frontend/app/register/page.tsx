'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UtensilsCrossed, Phone, Lock, User, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        phone_number: '',
        full_name: '',
        gender: 'male',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate
        if (formData.password !== formData.confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }

        if (formData.password.length < 8) {
            setError('Mật khẩu phải có ít nhất 8 ký tự');
            return;
        }

        setIsLoading(true);

        try {
            await api.post('/auth/register', {
                phone_number: formData.phone_number,
                full_name: formData.full_name,
                gender: formData.gender,
                password: formData.password,
            });

            setSuccess(true);

            // Redirect to login after 2 seconds
            setTimeout(() => {
                router.push('/admin/login');
            }, 2000);
        } catch (err: any) {
            console.error('Register error:', err);
            const detail = err.response?.data?.detail;
            let message = 'Đăng ký thất bại. Vui lòng thử lại.';
            if (typeof detail === 'string') {
                message = detail;
            } else if (Array.isArray(detail)) {
                message = detail.map((d: any) => d.msg).join(', ');
            }
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
                <div className="w-full max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} className="text-green-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary mb-2">Đăng ký thành công!</h1>
                    <p className="text-text-muted">Đang chuyển đến trang đăng nhập...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mx-auto mb-4">
                        <UtensilsCrossed size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary">Đăng ký</h1>
                    <p className="text-text-muted mt-2">Tạo tài khoản mới</p>
                </div>

                {/* Register Form */}
                <form onSubmit={handleSubmit} className="bg-dark-card rounded-2xl border border-dark-border p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Họ và tên
                        </label>
                        <div className="relative">
                            <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                type="text"
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleChange}
                                placeholder="Nguyễn Văn A"
                                required
                                className="w-full pl-10 pr-4 py-3 bg-dark-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Số điện thoại
                        </label>
                        <div className="relative">
                            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                type="tel"
                                name="phone_number"
                                value={formData.phone_number}
                                onChange={handleChange}
                                placeholder="0987654321"
                                required
                                className="w-full pl-10 pr-4 py-3 bg-dark-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Giới tính
                        </label>
                        <select
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-dark-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="male">Nam</option>
                            <option value="female">Nữ</option>
                            <option value="other">Khác</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Mật khẩu
                        </label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Ít nhất 8 ký tự"
                                required
                                minLength={8}
                                className="w-full pl-10 pr-4 py-3 bg-dark-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Xác nhận mật khẩu
                        </label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Nhập lại mật khẩu"
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
                                Đang đăng ký...
                            </>
                        ) : (
                            'Đăng ký'
                        )}
                    </button>
                </form>

                <p className="text-center text-text-muted text-sm mt-6">
                    Đã có tài khoản?{' '}
                    <Link href="/admin/login" className="text-primary-400 hover:underline">
                        Đăng nhập
                    </Link>
                </p>
            </div>
        </div>
    );
}
