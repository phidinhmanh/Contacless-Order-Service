'use client';

import React, { useState } from 'react';
import {
    TrendingUp,
    ShoppingBag,
    Users,
    Clock,
    Star,
    RefreshCw,
    User as UserIcon,
    Calendar,
    BarChart3,
    Download
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';

// Hooks
import { useDatePeriod } from '@/hooks/useDatePeriod';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { useGenderStats } from '@/hooks/useGenderStats';
import { useAnalyticsExport } from '@/hooks/useExportReport';

// Types
import { PeriodType } from '@/lib/types/analytics';

export default function AnalyticsPage() {
    const [period, setPeriod] = useState<PeriodType>('week');

    // Use hooks - each has Single Responsibility
    const { startDateStr, endDateStr } = useDatePeriod(period);
    const {
        revenueStats,
        popularItems,
        peakHours,
        customerSegments,
        retention,
        customers,
        isLoading
    } = useAnalyticsData(period);
    const genderData = useGenderStats(customers);
    const { exportAnalytics, isExporting } = useAnalyticsExport();

    const peakHour = peakHours.find(p => p.order_count > 0) || peakHours[0];

    const handleExport = async () => {
        await exportAnalytics(startDateStr, endDateStr);
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Thống kê</h1>
                    <p className="text-text-muted text-sm">Phân tích doanh thu và khách hàng</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-dark-card rounded-xl border border-dark-border p-1">
                        {(['day', 'week', 'month'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={cn(
                                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                    period === p
                                        ? 'bg-primary-500 text-white shadow-lg'
                                        : 'text-text-muted hover:text-text-primary'
                                )}
                            >
                                {p === 'day' ? 'Hôm nay' : p === 'week' ? '7 ngày' : '30 ngày'}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border rounded-xl text-text-secondary hover:text-text-primary hover:border-text-muted transition-all disabled:opacity-50"
                    >
                        <Download size={18} />
                        <span className="hidden sm:inline">
                            {isExporting ? 'Đang xuất...' : 'Xuất báo cáo'}
                        </span>
                    </button>
                    <button className="p-2 bg-dark-card border border-dark-border rounded-xl text-text-muted hover:text-text-primary transition-colors" title="Chọn ngày">
                        <Calendar size={20} />
                    </button>
                </div>
            </div>

            {/* Primary KPIs - Performance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricCard
                    icon={TrendingUp}
                    label="Doanh thu"
                    value={formatPrice(revenueStats?.total_revenue || 0)}
                    gradient="from-emerald-500 to-green-600"
                    size="large"
                />
                <MetricCard
                    icon={ShoppingBag}
                    label="Đơn hàng"
                    value={revenueStats?.order_count?.toString() || '0'}
                    gradient="from-blue-500 to-indigo-600"
                />
                <MetricCard
                    icon={BarChart3}
                    label="TB/Đơn"
                    value={formatPrice(revenueStats?.average_order_value || 0)}
                    gradient="from-purple-500 to-violet-600"
                />
            </div>

            {/* Customer Overview - Compact */}
            <div className="bg-dark-card rounded-2xl border border-dark-border p-4">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="text-primary-400" size={20} />
                    <h2 className="font-semibold text-text-primary">Khách hàng</h2>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-dark-border/30 rounded-xl">
                        <p className="text-3xl font-bold text-text-primary">{customerSegments?.total_customers || 0}</p>
                        <p className="text-xs text-text-muted mt-1">Tổng cộng</p>
                    </div>
                    <div className="text-center p-3 bg-dark-border/30 rounded-xl">
                        <p className="text-3xl font-bold text-green-400">{customerSegments?.new_customers || 0}</p>
                        <p className="text-xs text-text-muted mt-1">Khách mới</p>
                    </div>
                    <div className="text-center p-3 bg-dark-border/30 rounded-xl">
                        <p className="text-3xl font-bold text-purple-400">{customerSegments?.returning_customers || 0}</p>
                        <p className="text-xs text-text-muted mt-1">Quay lại</p>
                    </div>
                </div>
            </div>

            {/* Retention & Gender Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Retention */}
                <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
                    <div className="p-4 border-b border-dark-border">
                        <h2 className="font-semibold text-text-primary flex items-center gap-2">
                            <RefreshCw size={18} className="text-primary-400" />
                            Tỷ lệ giữ chân
                        </h2>
                    </div>
                    <div className="p-4">
                        {(retention?.rate_14d === 0 && retention?.rate_30d === 0) ? (
                            <EmptyState message="Chưa có dữ liệu retention" />
                        ) : (
                            <div className="space-y-4">
                                <RetentionBar
                                    label="14 ngày"
                                    rate={retention?.rate_14d || 0}
                                    users={retention?.returning_users_14d || 0}
                                    color="from-purple-500 to-pink-500"
                                />
                                <RetentionBar
                                    label="30 ngày"
                                    rate={retention?.rate_30d || 0}
                                    users={retention?.returning_users_30d || 0}
                                    color="from-blue-500 to-cyan-500"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Gender - Donut Chart */}
                <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
                    <div className="p-4 border-b border-dark-border">
                        <h2 className="font-semibold text-text-primary flex items-center gap-2">
                            <UserIcon size={18} className="text-primary-400" />
                            Phân bố giới tính
                        </h2>
                    </div>
                    <div className="p-4">
                        {genderData.length === 0 ? (
                            <EmptyState message="Chưa có dữ liệu khách hàng" />
                        ) : (
                            <div className="flex items-center justify-center gap-8">
                                {/* Donut Chart */}
                                <DonutChart data={genderData} />

                                {/* Legend */}
                                <div className="space-y-2">
                                    {genderData.map(item => (
                                        <div key={item.gender} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="text-sm text-text-secondary">{item.label}</span>
                                            <span className="text-sm font-medium text-text-primary ml-auto">{item.percent.toFixed(0)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Popular Items & Hourly Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Popular Items */}
                <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
                    <div className="p-4 border-b border-dark-border">
                        <h2 className="font-semibold text-text-primary flex items-center gap-2">
                            <Star size={18} className="text-yellow-500" />
                            Món ăn phổ biến
                        </h2>
                    </div>
                    <div className="divide-y divide-dark-border max-h-80 overflow-y-auto">
                        {popularItems.length === 0 ? (
                            <EmptyState message="Chưa có dữ liệu món ăn" />
                        ) : (
                            popularItems.map((item, index) => (
                                <div key={item.food_name} className="p-3 flex items-center gap-3 hover:bg-dark-border/30 transition-colors">
                                    <div className={cn(
                                        'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs',
                                        index === 0 ? 'bg-yellow-500 text-black' :
                                            index === 1 ? 'bg-gray-400 text-white' :
                                                index === 2 ? 'bg-orange-600 text-white' :
                                                    'bg-dark-border text-text-muted'
                                    )}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-text-primary text-sm truncate">{item.food_name}</p>
                                        <p className="text-xs text-text-muted">{item.quantity} phần</p>
                                    </div>
                                    <span className="text-sm font-medium text-emerald-400">{formatPrice(item.revenue)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Hourly Distribution */}
                <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
                    <div className="p-4 border-b border-dark-border flex items-center justify-between">
                        <h2 className="font-semibold text-text-primary flex items-center gap-2">
                            <Clock size={18} className="text-primary-400" />
                            Phân bố theo giờ
                        </h2>
                        {peakHour && peakHour.order_count > 0 && (
                            <span className="text-xs px-2 py-1 bg-primary-500/20 text-primary-400 rounded-full">
                                Cao điểm: {peakHour.time_slot}
                            </span>
                        )}
                    </div>
                    <div className="p-4">
                        {peakHours.length === 0 || peakHours.every(p => p.order_count === 0) ? (
                            <EmptyState message="Chưa có dữ liệu đơn hàng" />
                        ) : (
                            <div className="flex items-end gap-1 h-32">
                                {peakHours.slice(0, 12).map((slot) => {
                                    const maxCount = Math.max(...peakHours.map(p => p.order_count), 1);
                                    const height = (slot.order_count / maxCount) * 100;
                                    const isMax = slot.order_count === maxCount && slot.order_count > 0;
                                    return (
                                        <div key={slot.time_slot} className="flex-1 flex flex-col items-center group">
                                            <div
                                                className={cn(
                                                    'w-full rounded-t transition-all cursor-pointer',
                                                    isMax ? 'bg-primary-500' : 'bg-primary-500/30 hover:bg-primary-500/50'
                                                )}
                                                style={{ height: `${Math.max(height, 4)}%` }}
                                                title={`${slot.time_slot} - ${slot.order_count} đơn`}
                                            />
                                            <span className="text-[9px] text-text-muted mt-1 group-hover:text-text-primary transition-colors">
                                                {slot.time_slot.split(':')[0]}h
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================
// Reusable Components
// ============================================

// Reusable Metric Card
function MetricCard({
    icon: Icon,
    label,
    value,
    gradient,
    size = 'normal'
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    gradient: string;
    size?: 'normal' | 'large';
}) {
    return (
        <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
            <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br',
                    gradient
                )}>
                    <Icon size={20} className="text-white" />
                </div>
                <span className="text-text-muted text-sm">{label}</span>
            </div>
            <p className={cn(
                'font-bold text-text-primary',
                size === 'large' ? 'text-3xl' : 'text-2xl'
            )}>
                {value}
            </p>
        </div>
    );
}

// Retention Bar
function RetentionBar({ label, rate, users, color }: { label: string; rate: number; users: number; color: string }) {
    return (
        <div>
            <div className="flex justify-between mb-2">
                <span className="text-text-secondary text-sm">{label}</span>
                <span className="font-bold text-text-primary">{rate.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-dark-border rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all bg-gradient-to-r', color)}
                    style={{ width: `${Math.min(rate, 100)}%` }}
                />
            </div>
            <p className="text-xs text-text-muted mt-1">{users} khách quay lại</p>
        </div>
    );
}

// Donut Chart (SVG-based)
function DonutChart({ data }: { data: { label: string; percent: number; color: string }[] }) {
    const size = 120;
    const strokeWidth = 20;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    let offset = 0;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {data.map((item, i) => {
                const dashLength = (item.percent / 100) * circumference;
                const dashOffset = -offset;
                offset += dashLength;

                return (
                    <circle
                        key={i}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={item.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                        strokeDashoffset={dashOffset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        className="transition-all duration-500"
                    />
                );
            })}
            <text x="50%" y="50%" textAnchor="middle" dy=".3em" className="fill-text-primary text-lg font-bold">
                {data.reduce((sum, d) => sum + d.percent, 0).toFixed(0)}%
            </text>
        </svg>
    );
}

// Empty State
function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-8 text-text-muted">
            <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">{message}</p>
        </div>
    );
}
