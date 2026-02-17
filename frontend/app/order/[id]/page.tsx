'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    CheckCircle,
    X,
    Home,
    UtensilsCrossed,
    CreditCard,
    ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CountdownTimer } from '@/components/CountdownTimer';
import { LoadingState } from '@/components/ui/Spinner';
import { ordersApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Order } from '@/lib/types';

// Cancel window duration in seconds (120 seconds = 2 minutes)
const CANCEL_WINDOW_SECONDS = 120;

export default function OrderConfirmationPage() {
    const router = useRouter();
    const params = useParams();
    const orderId = params.id as string;

    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCancelling, setIsCancelling] = useState(false);
    const [canCancel, setCanCancel] = useState(true);
    const [error, setError] = useState('');

    // Fetch order details
    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const orderData = await ordersApi.getById(Number(orderId));
                setOrder(orderData);
                console.log(`📊 Order #${orderData.id} fetched. Current status: ${orderData.status}`);

                // Check if cancel window has passed
                const createdAt = new Date(orderData.created_at).getTime();
                const now = Date.now();
                const elapsed = (now - createdAt) / 1000;

                if (elapsed >= CANCEL_WINDOW_SECONDS) {
                    setCanCancel(false);
                }
            } catch (err: any) {
                console.error(err.messages)
                setError('Không thể tải thông tin đơn hàng.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrder();
    }, [orderId]);

    // Handle cancel window expiration
    const handleCancelExpire = useCallback(() => {
        setCanCancel(false);
    }, []);

    // Handle order cancellation
    const handleCancel = async () => {
        if (!canCancel || isCancelling) return;

        setIsCancelling(true);
        try {
            await ordersApi.cancel(Number(orderId));
            router.push('/menu');
        } catch (err: any) {
            console.error(err.messages)
            setError(err.message || 'Không thể hủy đơn hàng.');
        } finally {
            setIsCancelling(false);
        }
    };

    // Navigate to payment
    const handleProceedToPayment = () => {
        router.push(`/payment?order_id=${orderId}`);
    };

    const handleBackToMenu = () => {
        router.push('/menu');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingState message="Đang tải..." />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
                <p className="text-red-400 mb-4">{error || 'Không tìm thấy đơn hàng'}</p>
                <Button onClick={handleBackToMenu}>Quay lại thực đơn</Button>
            </div>
        );
    }

    const isPaid = order.status === 'paid' || order.status === 'completed' || order.status === 'ready' || order.status === 'preparing' || order.status === 'confirmed';
    const isPending = order.status === 'pending';

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col">
            {/* Header with Home Button */}
            <div className="absolute top-0 left-0 p-4 z-10 w-full flex justify-between items-start pointer-events-none">
                <button
                    onClick={handleBackToMenu}
                    className="w-10 h-10 rounded-full bg-dark-card/80 backdrop-blur border border-dark-border flex items-center justify-center text-text-secondary hover:text-text-primary pointer-events-auto transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center pt-20 pb-28">
                {/* Success Checkmark */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', duration: 0.6 }}
                    className="mb-4"
                >
                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                </motion.div>

                {/* Status Message */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <h1 className="text-2xl font-bold text-text-primary mb-1">
                        {isPaid ? 'Đơn hàng đã được xác nhận' : 'Đặt món thành công!'}
                    </h1>
                    <p className="text-text-secondary mb-6">
                        {isPaid
                            ? 'Bếp đang chuẩn bị món ăn của bạn'
                            : 'Vui lòng thanh toán để hoàn tất'}
                    </p>
                </motion.div>

                {/* Order ID - LARGE */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mb-8"
                >
                    <p className="text-text-muted text-sm uppercase tracking-wider mb-1">Mã số đơn hàng</p>
                    <p className="text-4xl font-black text-primary-400 tracking-tight">
                        #{orderId.slice(-4).toUpperCase()}
                    </p>
                </motion.div>

                {/* Order Summary Box - LIGHTER */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="w-full max-w-sm bg-dark-card/50 border border-dark-border/50 rounded-2xl overflow-hidden backdrop-blur-sm"
                >
                    <div className="p-4 border-b border-dark-border/50 bg-dark-card/30">
                        <h3 className="font-medium text-text-primary flex items-center justify-center gap-2">
                            <UtensilsCrossed size={16} className="text-primary-400" />
                            Chi tiết đơn hàng
                        </h3>
                    </div>
                    <div className="p-4">
                        <div className="space-y-3 mb-4">
                            {order.items.map((item, index) => {
                                const itemPrice = item.unit_price || item.price || 0;
                                const itemTotal = Number(itemPrice) * Number(item.quantity || 1);
                                const itemName = item.food_name || 'Món ăn';

                                return (
                                    <div key={index} className="flex justify-between text-sm">
                                        <div className="flex items-start gap-2 text-left">
                                            <span className="text-text-muted font-medium w-6 shrink-0">
                                                x{item.quantity}
                                            </span>
                                            <span className="text-text-secondary">{String(itemName)}</span>
                                        </div>
                                        <span className="text-text-primary font-medium">
                                            {formatPrice(itemTotal)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="border-t border-dark-border/50 pt-3 flex justify-between items-center">
                            <span className="text-text-muted">Tổng cộng</span>
                            <span className="text-xl font-bold text-primary-400">
                                {formatPrice(order.total_price || order.total_amount)}
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* Cancel Timer */}
                {canCancel && isPending && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-6"
                    >
                        <CountdownTimer
                            duration={CANCEL_WINDOW_SECONDS}
                            onExpire={handleCancelExpire}
                            label="Hủy đơn trong"
                            size="md"
                        />
                    </motion.div>
                )}
            </div>

            {/* Action Buttons - Sticky Footer */}
            <div className="fixed bottom-0 left-0 w-full p-4 bg-dark-bg/95 backdrop-blur border-t border-dark-border z-20 safe-bottom">
                <div className="flex gap-3 max-w-sm mx-auto">
                    {/* Secondary Action */}
                    {isPending && canCancel ? (
                        <Button
                            variant="destructive"
                            onClick={handleCancel}
                            isLoading={isCancelling}
                            className="flex-shrink-0 w-28"
                        >
                            <X size={18} className="mr-1" />
                            Hủy đơn
                        </Button>
                    ) : (
                        <Button
                            variant="secondary"
                            onClick={handleBackToMenu}
                            className="flex-1"
                        >
                            <Home size={18} className="mr-2" />
                            Về trang chủ
                        </Button>
                    )}

                    {/* Primary Action */}
                    {isPending ? (
                        <Button onClick={handleProceedToPayment} className="flex-1" size="lg">
                            <CreditCard size={18} className="mr-2" />
                            Thanh toán
                        </Button>
                    ) : (
                        <Button onClick={handleBackToMenu} variant="primary" className="flex-1" size="lg">
                            <UtensilsCrossed size={18} className="mr-2" />
                            Đặt thêm món
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
