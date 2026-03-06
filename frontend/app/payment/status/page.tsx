'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { PaymentStatus } from '@/lib/types';

// 1. Tách logic UI và xử lý SearchParams vào component con
function PaymentResultContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const orderId = searchParams.get('order_id');
    const provider = searchParams.get('provider');
    const statusParam = searchParams.get('status');
    const isCashPayment = provider === 'cash';
    const isSuccess = statusParam === 'success' || isCashPayment;

    const [status] = useState<PaymentStatus>(
        isSuccess ? 'completed' : 'failed'
    );

    useEffect(() => {
        if (orderId) {
            console.log(`💳 Kết quả thanh toán cho Đơn hàng #${orderId}: ${status}${provider ? ` (Phương thức: ${provider})` : ''}`);
        }
    }, [orderId, status, provider]);

    const handleViewOrder = () => {
        if (orderId) {
            // Điều hướng về trang chi tiết đơn hàng (tracking)
            // Trong Next.js App Router, thường là /order/[id] hoặc /tracking/[id]
            router.push(`/order/${orderId}`);
        } else {
            router.push('/menu');
        }
    };

    const handleBackToMenu = () => {
        router.push('/menu');
    };

    if (!orderId) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6 text-text-muted">
                Yêu cầu không hợp lệ
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {status === 'completed' ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center z-10"
                >
                    {/* Confetti Effect */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {[...Array(20)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{
                                    x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
                                    y: (typeof window !== 'undefined' ? window.innerHeight : 1000) + 100,
                                    rotate: 0,
                                }}
                                animate={{
                                    y: -100,
                                    rotate: 720,
                                }}
                                transition={{
                                    duration: 2 + Math.random() * 2,
                                    delay: Math.random() * 0.5,
                                    repeat: Infinity,
                                }}
                                className={cn(
                                    'absolute w-3 h-3 rounded-sm',
                                    i % 3 === 0 ? 'bg-primary-500' : i % 3 === 1 ? 'bg-secondary-500' : 'bg-yellow-500'
                                )}
                            />
                        ))}
                    </div>

                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.2 }}
                        className="w-24 h-24 rounded-full bg-secondary-500/20 flex items-center justify-center mb-6"
                    >
                        <CheckCircle className="text-secondary-400" size={48} />
                    </motion.div>

                    <h1 className="text-2xl font-bold text-text-primary mb-2 text-center">
                        {isCashPayment ? 'Đặt món thành công!' : 'Thanh toán thành công!'}
                    </h1>
                    <p className="text-text-secondary text-center max-w-xs mb-8">
                        {isCashPayment
                            ? 'Vui lòng thanh toán tại quầy khi nhận món. Nhà bếp đang chuẩn bị cho bạn!'
                            : 'Đơn hàng của bạn đã được xác nhận và đang được xử lý.'}
                    </p>

                    <div className="w-full max-w-xs space-y-3">
                        <Button onClick={handleViewOrder} className="w-full" size="lg">
                            Xem đơn hàng
                            <ArrowRight size={18} className="ml-2" />
                        </Button>
                        <Button
                            onClick={handleBackToMenu}
                            variant="ghost"
                            className="w-full"
                        >
                            Quay lại thực đơn
                        </Button>
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center z-10"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.2 }}
                        className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mb-6"
                    >
                        <XCircle className="text-red-400" size={48} />
                    </motion.div>

                    <h1 className="text-2xl font-bold text-text-primary mb-2">
                        Có lỗi xảy ra
                    </h1>
                    <p className="text-text-secondary text-center max-w-xs mb-8">
                        Không xác định được trạng thái thanh toán hoặc thanh toán bị hủy.
                    </p>

                    <div className="w-full max-w-xs space-y-3">
                        <Button onClick={handleBackToMenu} className="w-full" size="lg">
                            Quay lại thực đơn
                        </Button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// 2. Export mặc định bọc trong Suspense để tránh lỗi "missing-suspense-with-csr-bailout"
export default function GenericPaymentStatusPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-6">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-text-secondary animate-pulse">Đang tải kết quả...</p>
            </div>
        }>
            <PaymentResultContent />
        </Suspense>
    );
}
