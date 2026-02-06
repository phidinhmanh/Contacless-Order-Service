'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Clock,
    CheckCircle,
    ChefHat,
    Bell,
    Package,
    RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn, formatPrice } from '@/lib/utils';
import api from '@/lib/api';
import { useCartStore } from '@/store/cartStore';
import type { Order } from '@/lib/types';

// Local interfaces removed in favor of global types

const STATUS_STEPS = [
    { key: 'pending', label: 'Đang chờ', icon: Clock },
    { key: 'confirmed', label: 'Đã xác nhận', icon: CheckCircle },
    { key: 'preparing', label: 'Đang chuẩn bị', icon: ChefHat },
    { key: 'ready', label: 'Sẵn sàng', icon: Bell },
    { key: 'completed', label: 'Hoàn thành', icon: Package },
];

export default function TrackOrderPage() {
    const router = useRouter();
    const { tableId } = useCartStore();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchOrders = async () => {
        try {
            setIsLoading(true);
            // Fetch orders for this table
            const endpoint = tableId
                ? `/orders/?table_id=${tableId}&limit=10`
                : '/orders/?limit=10';
            const response = await api.get(endpoint);

            // Filter to show only active orders (not cancelled or completed more than 1 hour ago)
            const activeOrders = response.data.filter((order: Order) => {
                if (order.status === 'cancelled') return false;
                if (order.status === 'completed') {
                    const completedTime = new Date(order.created_at).getTime();
                    const hourAgo = Date.now() - 3600000;
                    return completedTime > hourAgo;
                }
                return true;
            });

            setOrders(activeOrders);
        } catch (err) {
            console.error('Failed to fetch orders:', err);
            setError('Không thể tải đơn hàng');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        // Auto-refresh every 10 seconds
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, [tableId]);

    const getStatusIndex = (status: string) => {
        return STATUS_STEPS.findIndex(s => s.key === status);
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="min-h-screen bg-dark-bg">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-dark-bg/95 backdrop-blur-md border-b border-dark-border">
                <div className="flex items-center justify-between px-4 py-3">
                    <Link
                        href="/menu"
                        className="flex items-center gap-2 text-text-secondary hover:text-text-primary"
                    >
                        <ArrowLeft size={20} />
                        Quay lại
                    </Link>
                    <h1 className="font-bold text-text-primary">Theo dõi đơn hàng</h1>
                    <button
                        onClick={fetchOrders}
                        className="p-2 text-text-muted hover:text-primary-400 transition-colors"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="p-4 space-y-4">
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
                        {error}
                    </div>
                )}

                {isLoading && orders.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-12">
                        <Package size={48} className="mx-auto mb-4 text-text-muted" />
                        <p className="text-text-muted">Chưa có đơn hàng nào</p>
                        <Link
                            href="/menu"
                            className="inline-block mt-4 px-4 py-2 bg-primary-500 text-white rounded-xl font-medium"
                        >
                            Đặt món ngay
                        </Link>
                    </div>
                ) : (
                    orders.map((order) => {
                        const currentIndex = getStatusIndex(order.status);
                        const isPendingPayment = order.payment_status === 'unpaid';

                        return (
                            <div
                                key={order.id}
                                onClick={() => router.push(`/tracking/${order.id}`)}
                                className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden cursor-pointer hover:border-primary-500/50 transition-colors"
                            >
                                {/* Order Header */}
                                <div className="p-4 border-b border-dark-border flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-primary-400 font-mono font-bold">
                                            #{order.id.toString().padStart(4, '0')}
                                        </span>
                                        {isPendingPayment && (
                                            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-bold rounded-full border border-red-500/20">
                                                CẦN THANH TOÁN
                                            </span>
                                        )}
                                        <span className="text-text-muted text-sm">
                                            {formatTime(order.created_at)}
                                        </span>
                                    </div>
                                    <span className="text-text-primary font-medium">
                                        {formatPrice(order.total_price)}
                                    </span>
                                </div>

                                {/* Status Progress */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-6">
                                        {STATUS_STEPS.slice(0, -1).map((step, index) => {
                                            const Icon = step.icon;
                                            const isActive = index <= currentIndex;
                                            const isCurrent = index === currentIndex;

                                            return (
                                                <React.Fragment key={step.key}>
                                                    <div className="flex flex-col items-center">
                                                        <div className={cn(
                                                            'w-10 h-10 rounded-full flex items-center justify-center',
                                                            'transition-all duration-300',
                                                            isCurrent
                                                                ? 'bg-primary-500 text-white scale-110 shadow-lg shadow-primary-500/30'
                                                                : isActive
                                                                    ? 'bg-green-500 text-white'
                                                                    : 'bg-dark-border text-text-muted'
                                                        )}>
                                                            <Icon size={18} />
                                                        </div>
                                                        <span className={cn(
                                                            'text-xs mt-1 text-center',
                                                            isCurrent ? 'text-primary-400 font-medium' :
                                                                isActive ? 'text-green-400' : 'text-text-muted'
                                                        )}>
                                                            {step.label}
                                                        </span>
                                                    </div>
                                                    {index < STATUS_STEPS.length - 2 && (
                                                        <div className={cn(
                                                            'flex-1 h-1 mx-1 rounded-full',
                                                            index < currentIndex ? 'bg-green-500' : 'bg-dark-border'
                                                        )} />
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>

                                    {/* Order Items */}
                                    <div className="space-y-2">
                                        {order.items?.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex justify-between text-sm"
                                            >
                                                <span className="text-text-secondary">
                                                    {item.food_name} x{item.quantity}
                                                </span>
                                                <span className="text-text-muted">
                                                    {formatPrice(item.unit_price * item.quantity)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Auto-refresh notice */}
                {orders.length > 0 && (
                    <p className="text-center text-text-muted text-xs">
                        Tự động cập nhật mỗi 10 giây
                    </p>
                )}
            </main>
        </div>
    );
}
