'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { OrderStatusStepper } from '@/components/OrderStatusStepper';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Order } from '@/lib/types';
import { useCartStore } from '@/store/cartStore';

// Poll interval in milliseconds (10 seconds)
const POLL_INTERVAL = 10000;

export default function OrderTrackingPage() {
    const router = useRouter();
    const params = useParams();
    const orderId = params.id as string;

    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState('');

    // Fetch order status
    const fetchOrder = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setIsRefreshing(true);

        try {
            const response = await api.get<Order>(`/orders/${orderId}`);
            setOrder(response.data);
            setError('');
        } catch (err: any) {
            setError('Không thể tải thông tin đơn hàng.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [orderId]);

    // Initial fetch and polling
    useEffect(() => {
        fetchOrder();

        const interval = setInterval(() => fetchOrder(false), POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchOrder]);

    // Listen for real-time WebSocket updates
    useEffect(() => {
        const handleOrderUpdate = (event: Event) => {
            const customEvent = event as CustomEvent;
            const data = customEvent.detail;

            // Check if this update is for our order
            if (data?.order?.id === orderId || data?.order_id === orderId) {
                console.log('🔔 Order status changed via WebSocket, refreshing...');
                fetchOrder(false);
            }
        };

        // Listen for order_update and order_cancelled events
        window.addEventListener('socket-order_update', handleOrderUpdate);
        window.addEventListener('socket-order_cancelled', handleOrderUpdate);
        window.addEventListener('refresh-orders', () => fetchOrder(false));

        return () => {
            window.removeEventListener('socket-order_update', handleOrderUpdate);
            window.removeEventListener('socket-order_cancelled', handleOrderUpdate);
            window.removeEventListener('refresh-orders', () => fetchOrder(false));
        };
    }, [orderId, fetchOrder]);

    const clearCart = useCartStore((state) => state.clearCart);

    // Keep cart items when ordering more
    const orderMore = () => {
        router.push('/menu');
    };

    // Clear cart when starting fresh (after order completed)
    const goBackToMenu = () => {
        clearCart();
        router.push('/menu');
    };

    // Manual refresh
    const handleRefresh = () => {
        fetchOrder(true);
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
            <div className="min-h-screen flex flex-col items-center justify-center p-6">
                <p className="text-red-400 mb-4">{error || 'Không tìm thấy đơn hàng'}</p>
                <Button onClick={() => router.push('/menu')}>Quay lại thực đơn</Button>
            </div>
        );
    }

    const isCompleted = order.status === 'ready' || order.status === 'completed';

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-dark-bg/95 backdrop-blur-md border-b border-dark-border">
                <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/menu')}
                            className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-text-primary">
                                Theo dõi đơn hàng
                            </h1>
                            <p className="text-sm text-text-muted">
                                #{orderId.slice(-8).toUpperCase()}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                    >
                        <RefreshCw
                            size={18}
                            className={isRefreshing ? 'animate-spin' : ''}
                        />
                    </button>
                </div>
            </header>

            {/* Error Message */}
            {error && (
                <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 p-4">
                {/* Status Stepper */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-dark-card border border-dark-border rounded-2xl p-6 mb-6"
                >
                    <OrderStatusStepper currentStatus={order.status} />
                </motion.div>

                {/* Order Details */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-dark-card border border-dark-border rounded-2xl p-4"
                >
                    <h3 className="font-semibold text-text-primary mb-4">
                        Chi tiết đơn hàng
                    </h3>

                    <div className="space-y-3 mb-4">
                        {order.items.map((item, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between py-2 border-b border-dark-border last:border-0"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 text-xs font-bold flex items-center justify-center">
                                        {item.quantity}
                                    </span>
                                    <span className="text-text-primary">{item.food_name}</span>
                                </div>
                                <span className="text-text-secondary">
                                    {formatPrice(item.subtotal)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {order.special_instructions && (
                        <div className="p-3 bg-dark-bg rounded-xl mb-4">
                            <p className="text-sm text-text-muted mb-1">Ghi chú:</p>
                            <p className="text-text-secondary text-sm">
                                {order.special_instructions}
                            </p>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-dark-border">
                        <span className="font-medium text-text-primary">Tổng cộng</span>
                        <span className="text-lg font-bold text-primary-400">
                            {formatPrice(order.total_amount)}
                        </span>
                    </div>
                </motion.div>
            </main>

            {/* Bottom Action */}
            <div className="sticky bottom-0 p-4 bg-dark-bg/95 backdrop-blur border-t border-dark-border safe-bottom">
                {order.payment_status === 'unpaid' ? (
                    <div className="space-y-3">
                        <div className="text-center p-3 bg-primary-500/10 border border-primary-500/20 rounded-xl">
                            <p className="text-primary-400 font-medium text-sm">
                                💳 Đơn hàng đang chờ thanh toán
                            </p>
                        </div>
                        <Button
                            onClick={() => router.push(`/payment?order_id=${orderId}`)}
                            className="w-full bg-primary-500 hover:bg-primary-600 text-white"
                            size="lg"
                        >
                            Thanh toán ngay
                        </Button>
                        <Button
                            onClick={orderMore}
                            variant="outline"
                            className="w-full"
                        >
                            Đặt thêm món
                        </Button>
                    </div>
                ) : isCompleted ? (
                    <div className="space-y-4">
                        <div className="text-center">
                            <p className="text-secondary-400 font-medium">
                                🎉 Đơn hàng đã sẵn sàng!
                            </p>
                            <p className="text-text-muted text-sm">
                                Vui lòng đến quầy để nhận món
                            </p>
                        </div>
                        <Button
                            onClick={goBackToMenu}
                            className="w-full"
                        >
                            Quay lại thực đơn
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-center text-text-muted text-sm">
                            Tự động cập nhật mỗi 10 giây
                        </p>
                        <Button
                            onClick={orderMore}
                            variant="outline"
                            className="w-full"
                        >
                            Đặt thêm món
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
