'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Clock,
    CheckCircle,
    ChefHat,
    Bell,
    RefreshCw,
    Volume2,
    VolumeX,
    CreditCard,
    XCircle,
    AlertTriangle,
    History,
    Search,
    Package,
    Utensils,
    Printer
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import api from '@/lib/api';

interface OrderItem {
    id: number;
    food_id: number;
    food_name: string;
    quantity: number;
    unit_price: number;
}

interface Order {
    id: number;
    table_id: number;
    status: string;
    total_price: number;
    special_instructions?: string;
    created_at: string;
    updated_at?: string;
    items: OrderItem[];
}

type OrderStatus = 'paid' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'payment_failed';

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
    pending: { label: 'Chờ xác nhận', icon: Clock, color: 'text-amber-400', bgColor: 'bg-amber-500/15', borderColor: 'border-amber-500' },
    paid: { label: 'Đã thanh toán', icon: CreditCard, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15', borderColor: 'border-emerald-500' },
    confirmed: { label: 'Đã xác nhận', icon: CheckCircle, color: 'text-blue-400', bgColor: 'bg-blue-500/15', borderColor: 'border-blue-500' },
    preparing: { label: 'Đang nấu', icon: ChefHat, color: 'text-orange-400', bgColor: 'bg-orange-500/15', borderColor: 'border-orange-500' },
    ready: { label: 'Sẵn sàng', icon: Bell, color: 'text-green-400', bgColor: 'bg-green-500/15', borderColor: 'border-green-500' },
    completed: { label: 'Hoàn thành', icon: CheckCircle, color: 'text-teal-400', bgColor: 'bg-teal-500/15', borderColor: 'border-teal-500' },
    cancelled: { label: 'Đã hủy', icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/15', borderColor: 'border-red-500' },
    payment_failed: { label: 'Lỗi thanh toán', icon: AlertTriangle, color: 'text-rose-400', bgColor: 'bg-rose-500/15', borderColor: 'border-rose-500' },
};

// Active statuses for Kanban
const KANBAN_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready'];

const getStatusInfo = (status: string) => STATUS_CONFIG[status as OrderStatus] || STATUS_CONFIG.pending;

const getNextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
        'pending': 'confirmed',
        'confirmed': 'preparing',
        'preparing': 'ready',
        'ready': 'completed',
        'paid': 'confirmed',
    };
    return flow[current] || null;
};

const getNextStatusLabel = (current: string): string => {
    const labels: Record<string, string> = {
        'pending': 'Xác nhận',
        'paid': 'Xác nhận',
        'confirmed': 'Bắt đầu nấu',
        'preparing': 'Sẵn sàng',
        'ready': 'Hoàn thành',
    };
    return labels[current] || '';
};

// Time urgency helper
const getTimeUrgency = (dateStr: string): 'normal' | 'warning' | 'urgent' => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins >= 20) return 'urgent';
    if (mins >= 10) return 'warning';
    return 'normal';
};

export default function OrdersPage() {
    const [todayRevenue, setTodayRevenue] = useState(0);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [lastOrderCount, setLastOrderCount] = useState(-1);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [mobileStatus, setMobileStatus] = useState<OrderStatus>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [historyFilter, setHistoryFilter] = useState<OrderStatus | 'all'>('all');

    const fetchData = useCallback(async () => {
        try {
            const [ordersRes, revenueRes] = await Promise.all([
                api.get('/orders/?limit=500'),
                api.get('/analytics/revenue')
            ]);

            const allOrders = ordersRes.data as Order[];
            setTodayRevenue(revenueRes.data.total_revenue || 0);

            const pendingCount = allOrders.filter(o => o.status === 'pending').length;
            // Play sound if orders increased (and not first load)
            if (pendingCount > lastOrderCount && soundEnabled && lastOrderCount !== -1) {
                const audio = new Audio('/sounds/notification.mp3');
                audio.play().catch(() => { });
            }
            setLastOrderCount(pendingCount);
            setOrders(allOrders);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [lastOrderCount, soundEnabled]);

    useEffect(() => {
        fetchData();

        const handleRefresh = () => fetchData();
        window.addEventListener('refresh-orders', handleRefresh);

        return () => {
            window.removeEventListener('refresh-orders', handleRefresh);
        };
    }, [fetchData]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchData();
    };

    const handleStatusChange = async (orderId: number, newStatus: string) => {
        try {
            await api.put(`/orders/${orderId}`, { status: newStatus });
            console.log(`📦 Order #${orderId} status changed to: ${newStatus}`);
            setOrders(prev => prev.map(o =>
                o.id === orderId ? { ...o, status: newStatus } : o
            ));
        } catch (error) {
            console.error('Failed to update order:', error);
            fetchData();
        }
    };

    const handleCancel = async (orderId: number) => {
        if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
        await handleStatusChange(orderId, 'cancelled');
    };

    // Filtered orders
    const activeOrders = useMemo(() => {
        let filtered = orders.filter(o => KANBAN_STATUSES.includes(o.status as OrderStatus) || o.status === 'paid');

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(o =>
                o.id.toString().includes(query) ||
                o.table_id?.toString().includes(query) ||
                o.items?.some(i => i.food_name?.toLowerCase().includes(query))
            );
        }
        return filtered;
    }, [orders, searchQuery]);

    const historyOrders = useMemo(() => {
        let filtered = orders.filter(o => ['completed', 'cancelled', 'payment_failed'].includes(o.status));
        if (historyFilter !== 'all') {
            filtered = filtered.filter(o => o.status === historyFilter);
        }
        return filtered;
    }, [orders, historyFilter]);

    // Revenue (fetched from backend)

    const getOrdersByStatus = (status: string) => activeOrders.filter(o => o.status === status);

    const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

    const getTimeAgo = (dateStr: string) => {
        const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
        if (mins < 1) return 'Vừa xong';
        if (mins < 60) return `${mins}p`;
        return `${Math.floor(mins / 60)}h${mins % 60}p`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Compact Header */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Title + Live Indicator */}
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-text-primary">Đơn hàng</h1>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded-full">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs text-green-400 font-medium">Live</span>
                    </div>
                </div>

                {/* Search + Actions */}
                <div className="flex-1 flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm mã đơn, bàn, món..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-dark-card border border-dark-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-primary-500 focus:outline-none transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={cn(
                            'p-2 rounded-xl transition-colors',
                            soundEnabled ? 'bg-primary-500/10 text-primary-400' : 'bg-dark-border text-text-muted'
                        )}
                        title={soundEnabled ? 'Tắt âm' : 'Bật âm'}
                    >
                        {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>

                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-2 bg-dark-card border border-dark-border rounded-xl text-text-secondary hover:text-text-primary transition-colors"
                        title="Làm mới"
                    >
                        <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Compact KPIs */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border rounded-xl">
                        <CreditCard className="text-emerald-400" size={18} />
                        <div>
                            <p className="text-xs text-text-muted">Hôm nay</p>
                            <p className="text-lg font-bold text-emerald-400">{formatPrice(todayRevenue)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border rounded-xl">
                        <Package className="text-primary-400" size={18} />
                        <div>
                            <p className="text-xs text-text-muted">Đang xử lý</p>
                            <p className="text-lg font-bold text-primary-400">{activeOrders.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-dark-card rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('active')}
                    className={cn(
                        'px-4 py-2 rounded-lg font-medium text-sm transition-all',
                        activeTab === 'active'
                            ? 'bg-primary-500 text-white shadow-lg'
                            : 'text-text-muted hover:text-text-primary'
                    )}
                >
                    <ChefHat size={16} className="inline mr-2" />
                    Đang xử lý ({activeOrders.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={cn(
                        'px-4 py-2 rounded-lg font-medium text-sm transition-all',
                        activeTab === 'history'
                            ? 'bg-primary-500 text-white shadow-lg'
                            : 'text-text-muted hover:text-text-primary'
                    )}
                >
                    <History size={16} className="inline mr-2" />
                    Lịch sử ({historyOrders.length})
                </button>
            </div>

            {/* Active Orders */}
            {activeTab === 'active' && (
                <>
                    {/* Mobile: Status Tabs */}
                    <div className="xl:hidden flex gap-1 p-1 bg-dark-card rounded-xl overflow-x-auto">
                        {KANBAN_STATUSES.map(status => {
                            const info = getStatusInfo(status);
                            const count = getOrdersByStatus(status).length;
                            return (
                                <button
                                    key={status}
                                    onClick={() => setMobileStatus(status)}
                                    className={cn(
                                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                                        mobileStatus === status
                                            ? `${info.bgColor} ${info.color}`
                                            : 'text-text-muted hover:text-text-primary'
                                    )}
                                >
                                    <info.icon size={16} />
                                    {info.label}
                                    {count > 0 && (
                                        <span className={cn(
                                            'px-1.5 py-0.5 rounded-full text-xs',
                                            mobileStatus === status ? 'bg-white/20' : 'bg-dark-border'
                                        )}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Mobile: Single Column */}
                    <div className="xl:hidden space-y-3">
                        {getOrdersByStatus(mobileStatus).length === 0 ? (
                            <EmptyState status={mobileStatus} />
                        ) : (
                            getOrdersByStatus(mobileStatus).map(order => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    onStatusChange={handleStatusChange}
                                    onCancel={handleCancel}
                                    getTimeAgo={getTimeAgo}
                                    formatTime={formatTime}
                                />
                            ))
                        )}
                    </div>

                    {/* Desktop: Kanban Board */}
                    <div className="hidden xl:grid xl:grid-cols-4 gap-4">
                        {KANBAN_STATUSES.map(status => {
                            const info = getStatusInfo(status);
                            const statusOrders = getOrdersByStatus(status);
                            return (
                                <div key={status} className="flex flex-col min-h-[400px]">
                                    {/* Column Header */}
                                    <div className={cn(
                                        'flex items-center gap-2 p-3 bg-dark-card rounded-t-xl border-t-4',
                                        info.borderColor
                                    )}>
                                        <info.icon size={18} className={info.color} />
                                        <span className="font-medium text-text-primary">{info.label}</span>
                                        <span className={cn(
                                            'ml-auto px-2 py-0.5 rounded-full text-xs font-medium',
                                            statusOrders.length > 0 ? `${info.bgColor} ${info.color}` : 'bg-dark-border text-text-muted'
                                        )}>
                                            {statusOrders.length}
                                        </span>
                                    </div>

                                    {/* Column Content */}
                                    <div className="flex-1 bg-dark-border/20 rounded-b-xl p-2 space-y-2 overflow-y-auto">
                                        {statusOrders.length === 0 ? (
                                            <EmptyState status={status} />
                                        ) : (
                                            statusOrders.map(order => (
                                                <OrderCard
                                                    key={order.id}
                                                    order={order}
                                                    onStatusChange={handleStatusChange}
                                                    onCancel={handleCancel}
                                                    getTimeAgo={getTimeAgo}
                                                    formatTime={formatTime}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {/* Filter */}
                    <div className="flex items-center gap-3">
                        <select
                            value={historyFilter}
                            onChange={e => setHistoryFilter(e.target.value as OrderStatus | 'all')}
                            className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="completed">Hoàn thành</option>
                            <option value="cancelled">Đã hủy</option>
                            <option value="payment_failed">Lỗi thanh toán</option>
                        </select>
                        <span className="text-sm text-text-muted">
                            {historyOrders.length} đơn
                        </span>
                    </div>

                    {/* History Table */}
                    <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-dark-border/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Mã</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Bàn</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Món</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Tổng</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">Trạng thái</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Thời gian</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {historyOrders.slice(0, 50).map(order => {
                                        const info = getStatusInfo(order.status);
                                        return (
                                            <tr key={order.id} className="hover:bg-dark-border/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="font-mono font-bold text-primary-400">
                                                        #{order.id.toString().padStart(4, '0')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-text-secondary">
                                                    {order.table_id || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-text-secondary">
                                                    <div className="max-w-[200px] truncate text-sm">
                                                        {order.items?.map(i => `${i.food_name} ×${i.quantity}`).join(', ') || '—'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={cn(
                                                        'font-semibold',
                                                        order.status === 'completed' ? 'text-emerald-400' : 'text-text-muted'
                                                    )}>
                                                        {formatPrice(order.total_price)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                                                        info.bgColor, info.color
                                                    )}>
                                                        <info.icon size={12} />
                                                        {info.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-text-muted">
                                                    {formatDate(order.created_at)} {formatTime(order.created_at)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {historyOrders.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                                <History className="w-12 h-12 mb-3 opacity-30" />
                                <p>Chưa có lịch sử đơn hàng</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Empty State Component
function EmptyState({ status }: { status: OrderStatus }) {
    const info = getStatusInfo(status);
    const Icon = info.icon;

    const messages: Record<OrderStatus, string> = {
        pending: 'Đang chờ đơn mới...',
        confirmed: 'Chưa có đơn xác nhận',
        preparing: 'Chưa có đơn đang nấu',
        ready: 'Chưa có đơn sẵn sàng',
        paid: 'Chưa có thanh toán',
        completed: 'Chưa hoàn thành đơn nào',
        cancelled: 'Không có đơn hủy',
        payment_failed: 'Không có lỗi thanh toán',
    };

    return (
        <div className="flex flex-col items-center justify-center h-40 text-text-muted">
            <Icon className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm">{messages[status]}</p>
        </div>
    );
}

// Order Card Component
function OrderCard({
    order,
    onStatusChange,
    onCancel,
    getTimeAgo,
    formatTime
}: {
    order: Order;
    onStatusChange: (id: number, status: string) => void;
    onCancel: (id: number) => void;
    getTimeAgo: (date: string) => string;
    formatTime: (date: string) => string;
}) {
    const nextStatus = getNextStatus(order.status);
    const nextLabel = getNextStatusLabel(order.status);
    const isPaid = order.status === 'paid';
    const urgency = getTimeUrgency(order.created_at);

    return (
        <div className={cn(
            "bg-dark-card rounded-xl border p-3 space-y-3 transition-all hover:shadow-lg hover:shadow-primary-500/5",
            isPaid ? "border-emerald-500/50" : "border-dark-border",
            urgency === 'urgent' && "border-red-500/50 bg-red-500/5",
            urgency === 'warning' && "border-amber-500/50 bg-amber-500/5"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-primary-400">
                        #{order.id.toString().padStart(4, '0')}
                    </span>
                    {isPaid && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                            💳 Đã TT
                        </span>
                    )}
                </div>
                <div className={cn(
                    'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded',
                    urgency === 'urgent' && 'bg-red-500/20 text-red-400',
                    urgency === 'warning' && 'bg-amber-500/20 text-amber-400',
                    urgency === 'normal' && 'text-text-muted'
                )}>
                    <Clock size={12} />
                    {getTimeAgo(order.created_at)}
                </div>
            </div>

            {/* Table + Time */}
            <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-primary-500/10 text-primary-400 rounded text-sm font-medium">
                    <Utensils size={14} className="inline mr-1" />
                    Bàn {order.table_id || '—'}
                </span>
                <span className="text-xs text-text-muted ml-auto">
                    {formatTime(order.created_at)}
                </span>
            </div>

            {/* Items */}
            <div className="space-y-1">
                {order.items?.slice(0, 4).map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-text-secondary">
                            {item.food_name} <span className="text-text-muted">×{item.quantity}</span>
                        </span>
                    </div>
                ))}
                {order.items?.length > 4 && (
                    <p className="text-xs text-text-muted">+{order.items.length - 4} món khác</p>
                )}
            </div>

            {/* Special Instructions */}
            {order.special_instructions && (
                <div className="text-xs text-orange-400 bg-orange-500/10 rounded-lg p-2">
                    📝 {order.special_instructions}
                </div>
            )}

            {/* Total - PROMINENT */}
            <div className="pt-2 border-t border-dark-border">
                <span className={cn(
                    "text-xl font-bold",
                    isPaid ? "text-emerald-400" : "text-text-primary"
                )}>
                    {formatPrice(order.total_price)}
                </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                {nextStatus && nextLabel && (
                    <button
                        onClick={() => onStatusChange(order.id, nextStatus)}
                        className="flex-1 py-2.5 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 active:scale-[0.98] transition-all text-sm"
                    >
                        {nextLabel}
                    </button>
                )}
                {(order.status === 'pending' || order.status === 'paid') && (
                    <button
                        onClick={() => onCancel(order.id)}
                        className="px-4 py-2.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 active:scale-[0.98] transition-all text-sm font-medium"
                    >
                        Hủy
                    </button>
                )}

                <button
                    onClick={() => {
                        window.open(
                            `/print/orders/${order.id}`,
                            'Receipt',
                            'width=400,height=600,toolbar=0,scrollbars=1,status=1'
                        );
                    }}
                    className="p-2.5 bg-dark-border text-text-secondary rounded-lg hover:bg-dark-border/80 active:scale-[0.98] transition-all"
                    title="In hóa đơn"
                >
                    <Printer size={18} />
                </button>
            </div>
        </div>
    );
}
