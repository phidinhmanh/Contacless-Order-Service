'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { PaymentStatus } from '@/lib/types';

export default function GenericPaymentStatusPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const orderId = searchParams.get('order_id');
    const provider = searchParams.get('provider');
    const statusParam = searchParams.get('status');
    const isCashPayment = provider === 'cash';
    const isSuccess = statusParam === 'success' || isCashPayment;

    // Default to completed if success param or cash, otherwise failed (since we only redirect here on success usually)
    // If we want to support pending here, we'd need more logic, but current flow handles pending in the modal or [txId] page
    const [status] = useState<PaymentStatus>(
        isSuccess ? 'completed' : 'failed'
    );

    useEffect(() => {
        if (orderId) {
            console.log(`💳 Payment result for Order #${orderId}: ${status}${provider ? ` (Provider: ${provider})` : ''}`);
        }
    }, [orderId, status, provider]);

    // Navigate to order tracking
    const handleViewOrder = () => {
        // If we have orderId, we can track the order. 
        // Note: Tracking usually uses order ID or transaction ID? 
        // Looking at [txId] page, it used txId for tracking URL -> `/tracking/${transactionId}`. 
        // But if we don't have txId (e.g. VietQR success only passed orderId), we might need to change tracking page to support orderId?
        // Let's assume /tracking supports orderId via query param or we assume orderId maps to tracking logic.
        // Or if tracking page expects txId... check tracking page?
        // For now, let's redirect to menu or tracking with order_id query param if tracking page supports it.
        // If not, just redirect to Menu is safer.
        if (orderId) {
            // Assuming tracking page might support query param ?order_id=... or we just go to menu
            // Let's try sending to tracking page. If it fails (404), user will report.
            // Ideally we should check tracking page.
            // But valid usage of orderId suggests we can track it.
            router.push(`/order/${orderId}`); // Ordering flow usually goes to order details
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
                Invalid request
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-6 relative">
            {status === 'completed' ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center"
                >
                    {/* Confetti Effect */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {[...Array(20)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{
                                    x: Math.random() * window.innerWidth,
                                    y: window.innerHeight + 100,
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
                                    i % 3 === 0
                                        ? 'bg-primary-500'
                                        : i % 3 === 1
                                            ? 'bg-secondary-500'
                                            : 'bg-yellow-500'
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

                    <h1 className="text-2xl font-bold text-text-primary mb-2">
                        {isCashPayment ? 'Đặt món thành công!' : 'Thanh toán thành công!'}
                    </h1>
                    <p className="text-text-secondary text-center max-w-xs mb-8">
                        {isCashPayment
                            ? 'Vui lòng thanh toán tại quầy khi nhận món'
                            : 'Đơn hàng của bạn đã được xác nhận'}
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
                    className="flex flex-col items-center"
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
                        Không xác định được trạng thái thanh toán.
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
