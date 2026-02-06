'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    TrendingUp,
    ShoppingBag,
    Users,
    Clock,
    ArrowRight,
    AlertCircle
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import api from '@/lib/api';

interface StatsData {
    todayRevenue: number;
    todayOrders: number;
    pendingOrders: number;
    activeTables: number;
}

interface RecentOrder {
    id: number;
    table_id: number;
    status: string;
    total_price: number;
    created_at: string;
    items: { food_name: string; quantity: number }[];
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<StatsData>({
        todayRevenue: 0,
        todayOrders: 0,
        pendingOrders: 0,
        activeTables: 0,
    });
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Use analytics endpoint for accurate stats
                const [analyticsRes, ordersRes, tablesRes] = await Promise.all([
                    api.get('/analytics/revenue'),
                    api.get('/orders/?limit=50'),
                    api.get('/tables/'),
                ]);

                const analytics = analyticsRes.data;
                const orders = ordersRes.data as RecentOrder[];

                // Filter for pending orders
                const pendingOrders = orders.filter(o =>
                    ['pending', 'confirmed', 'preparing'].includes(o.status)
                );

                // Count tables with active orders
                const activeTables = (tablesRes.data as { status: string }[])
                    .filter(t => t.status === 'occupied').length;

                setStats({
                    todayRevenue: analytics.total_revenue || 0,
                    todayOrders: analytics.order_count || 0,
                    pendingOrders: pendingOrders.filter(o => o.status === 'pending').length,
                    activeTables: activeTables,
                });

                // Get recent pending orders
                setRecentOrders(pendingOrders.slice(0, 5));
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const statsCards = [
        {
            label: 'Doanh thu hôm nay',
            value: formatPrice(stats.todayRevenue),
            icon: TrendingUp,
            color: 'from-green-500 to-emerald-600',
        },
        {
            label: 'Đơn hàng hôm nay',
            value: stats.todayOrders.toString(),
            icon: ShoppingBag,
            color: 'from-blue-500 to-indigo-600',
        },
        {
            label: 'Đơn chờ xử lý',
            value: stats.pendingOrders.toString(),
            icon: Clock,
            color: 'from-orange-500 to-amber-600',
            highlight: stats.pendingOrders > 0,
        },
        {
            label: 'Bàn đang phục vụ',
            value: stats.activeTables.toString(),
            icon: Users,
            color: 'from-purple-500 to-violet-600',
        },
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/20 text-yellow-400';
            case 'confirmed': return 'bg-blue-500/20 text-blue-400';
            case 'preparing': return 'bg-orange-500/20 text-orange-400';
            case 'ready': return 'bg-green-500/20 text-green-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return 'Chờ xác nhận';
            case 'confirmed': return 'Đã xác nhận';
            case 'preparing': return 'Đang chuẩn bị';
            case 'ready': return 'Sẵn sàng';
            case 'completed': return 'Hoàn thành';
            case 'cancelled': return 'Đã hủy';
            default: return status;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-text-primary">Tổng quan</h1>
                <p className="text-text-muted">Xin chào! Đây là thống kê hôm nay.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statsCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.label}
                            className={cn(
                                'relative bg-dark-card rounded-2xl p-4 border border-dark-border',
                                'overflow-hidden',
                                card.highlight && 'ring-2 ring-orange-500/50'
                            )}
                        >
                            <div className={cn(
                                'absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20',
                                `bg-gradient-to-br ${card.color}`
                            )} />
                            <div className="relative">
                                <div className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                                    `bg-gradient-to-br ${card.color}`
                                )}>
                                    <Icon size={20} className="text-white" />
                                </div>
                                <p className="text-2xl font-bold text-text-primary">{card.value}</p>
                                <p className="text-sm text-text-muted">{card.label}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pending Orders Alert */}
            {stats.pendingOrders > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <AlertCircle className="text-orange-400" size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="font-medium text-orange-400">
                            Có {stats.pendingOrders} đơn hàng đang chờ xác nhận
                        </p>
                        <p className="text-sm text-text-muted">
                            Vui lòng xử lý để khách hàng không phải chờ lâu
                        </p>
                    </div>
                    <Link
                        href="/admin/orders"
                        className="px-4 py-2 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors flex items-center gap-2"
                    >
                        Xem đơn
                        <ArrowRight size={16} />
                    </Link>
                </div>
            )}

            {/* Recent Orders */}
            <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
                <div className="p-4 border-b border-dark-border flex items-center justify-between">
                    <h2 className="font-semibold text-text-primary">Đơn hàng gần đây</h2>
                    <Link
                        href="/admin/orders"
                        className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
                    >
                        Xem tất cả
                        <ArrowRight size={14} />
                    </Link>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="p-8 text-center text-text-muted">
                        Chưa có đơn hàng nào đang chờ xử lý
                    </div>
                ) : (
                    <div className="divide-y divide-dark-border">
                        {recentOrders.map((order) => (
                            <div key={order.id} className="p-4 hover:bg-dark-border/30 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-primary-400">
                                            #{order.id.toString().padStart(4, '0')}
                                        </span>
                                        <span className="text-text-muted">•</span>
                                        <span className="text-text-secondary">Bàn {order.table_id}</span>
                                    </div>
                                    <span className={cn(
                                        'px-2 py-1 rounded-full text-xs font-medium',
                                        getStatusColor(order.status)
                                    )}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-text-muted">
                                        {order.items?.slice(0, 2).map(i => `${i.food_name} x${i.quantity}`).join(', ')}
                                        {order.items?.length > 2 && ` +${order.items.length - 2} món`}
                                    </p>
                                    <span className="font-medium text-text-primary">
                                        {formatPrice(order.total_price)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
