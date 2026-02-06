'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Payment, PaymentStatus } from '@/lib/types';

// Poll interval in milliseconds
const POLL_INTERVAL = 3000;

export default function PaymentStatusPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();

    const transactionId = params.txId as string;
    const isCashPayment = searchParams.get('provider') === 'cash';

    const [status, setStatus] = useState<PaymentStatus>(
        isCashPayment ? 'completed' : 'pending'
    );
    const [isPolling, setIsPolling] = useState(!isCashPayment);
    const [error, setError] = useState('');

    // Poll payment status
    const checkStatus = useCallback(async () => {
        if (isCashPayment) return;

        try {
            const response = await api.get<Payment>(`/payments/status/${transactionId}`);
            const newStatus = response.data.status;
            setStatus(newStatus);

            // Stop polling on terminal states
            if (newStatus === 'completed' || newStatus === 'failed' || newStatus === 'expired') {
                setIsPolling(false);
            }
        } catch (err: any) {
            console.error('Failed to check payment status:', err);
        }
    }, [transactionId, isCashPayment]);

    useEffect(() => {
        if (!isPolling) return;

        const interval = setInterval(checkStatus, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [isPolling, checkStatus]);

    // Initial check
    useEffect(() => {
        if (!isCashPayment) {
            checkStatus();
        }
    }, [checkStatus, isCashPayment]);

    // Handle retry payment
    const handleRetry = () => {
        router.back();
    };

    // Navigate to order tracking
    const handleViewOrder = () => {
        router.push(`/tracking/${transactionId}`);
    };

    // Navigate to menu
    const handleBackToMenu = () => {
        router.push('/menu');
    };

    // Render based on status
    const renderContent = () => {
        switch (status) {
            case 'pending':
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center"
                    >
                        <div className="w-20 h-20 rounded-full bg-primary-500/20 flex items-center justify-center mb-6">
                            <Spinner size="lg" />
                        </div>
                        <h1 className="text-xl font-bold text-text-primary mb-2">
                            Đang chờ xác nhận...
                        </h1>
                        <p className="text-text-secondary text-center max-w-xs">
                            Vui lòng hoàn tất thanh toán trên ứng dụng ngân hàng/ví điện tử
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-text-muted text-sm">
                            <Clock size={16} />
                            <span>Đang kiểm tra trạng thái...</span>
                        </div>
                    </motion.div>
                );

            case 'completed':
                return (
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
                                Theo dõi đơn hàng
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
                );

            case 'failed':
                return (
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
                            Thanh toán thất bại
                        </h1>
                        <p className="text-text-secondary text-center max-w-xs mb-8">
                            {error || 'Đã có lỗi xảy ra. Vui lòng thử lại.'}
                        </p>

                        <div className="w-full max-w-xs space-y-3">
                            <Button onClick={handleRetry} className="w-full" size="lg">
                                <RefreshCw size={18} className="mr-2" />
                                Thử lại
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
                );

            case 'expired':
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                            className="w-24 h-24 rounded-full bg-yellow-500/20 flex items-center justify-center mb-6"
                        >
                            <Clock className="text-yellow-400" size={48} />
                        </motion.div>

                        <h1 className="text-2xl font-bold text-text-primary mb-2">
                            Hết thời gian thanh toán
                        </h1>
                        <p className="text-text-secondary text-center max-w-xs mb-8">
                            Thời gian thanh toán đã hết. Vui lòng tạo thanh toán mới.
                        </p>

                        <div className="w-full max-w-xs space-y-3">
                            <Button onClick={handleRetry} className="w-full" size="lg">
                                Thanh toán lại
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
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-6 relative">
            {renderContent()}
        </div>
    );
}
