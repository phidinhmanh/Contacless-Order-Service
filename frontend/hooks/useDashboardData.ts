import { useState, useEffect, useCallback } from 'react';
import { ordersApi, analyticsApi, foodsApi, categoriesApi, tablesApi, paymentsApi, usersApi, authApi } from '@/lib/api';
import { StatsData, RecentOrder, PeriodType } from '@/lib/types/analytics';
import type { Order } from '@/lib/types';

/**
 * useDashboardData Hook
 *
 * Single Responsibility: Fetch dashboard-specific data with auto-refresh.
 * Follows SRP by only handling dashboard data fetching and refresh logic.
 *
 * @param autoRefresh - Whether to auto-refresh data (default: true)
 * @param refreshInterval - Interval in milliseconds (default: 30000)
 * @returns Dashboard data, loading state, and control functions
 */
interface DashboardDataResult {
    stats: StatsData;
    recentOrders: RecentOrder[];
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useDashboardData(
    autoRefresh: boolean = true,
    refreshInterval: number = 30000
): DashboardDataResult {
    const [stats, setStats] = useState<StatsData>({
        todayRevenue: 0,
        todayOrders: 0,
        pendingOrders: 0,
        activeTables: 0,
    });
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setError(null);
        try {
            // Use analytics endpoint for accurate stats
            const [analytics, orders, tables] = await Promise.all([
                analyticsApi.revenue(),
                ordersApi.list({ limit: 50 }),
                tablesApi.list(),
            ]);

            // Filter for pending orders
            const pendingOrders = orders.filter((o: Order) =>
                ['pending', 'confirmed', 'preparing'].includes(o.status)
            );

            // Count tables with active orders
            const activeTables = (tables as { status: string }[])
                .filter(t => t.status === 'occupied').length;

            setStats({
                todayRevenue: analytics.total_revenue || 0,
                todayOrders: analytics.order_count || 0,
                pendingOrders: pendingOrders.filter((o: Order) => o.status === 'pending').length,
                activeTables: activeTables,
            });

            // Get recent pending orders
            setRecentOrders(pendingOrders.slice(0, 5));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
            setError(message);
            console.error('Failed to fetch dashboard data:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        if (autoRefresh) {
            const interval = setInterval(fetchData, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [fetchData, autoRefresh, refreshInterval]);

    return {
        stats,
        recentOrders,
        isLoading,
        error,
        refetch: fetchData,
    };
}

/**
 * Hook for fetching dashboard stats only
 */
export function useDashboardStats() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [analyticsRes, ordersRes, tablesRes] = await Promise.all([
                    analyticsApi.revenue(),
                    ordersApi.list({ limit: 50 }),
                    tablesApi.list(),
                ]);

                const analytics = analyticsRes.data;
                const orders = ordersRes.data as RecentOrder[];

                const pendingOrders = orders.filter(o =>
                    ['pending', 'confirmed', 'preparing'].includes(o.status)
                );

                const activeTables = (tablesRes.data as { status: string }[])
                    .filter(t => t.status === 'occupied').length;

                setStats({
                    todayRevenue: analytics.total_revenue || 0,
                    todayOrders: analytics.order_count || 0,
                    pendingOrders: pendingOrders.filter(o => o.status === 'pending').length,
                    activeTables: activeTables,
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch stats');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    return { stats, isLoading, error };
}

/**
 * Hook for fetching recent orders
 */
export function useRecentOrders(limit: number = 5) {
    const [orders, setOrders] = useState<RecentOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const allOrders = await ordersApi.list({ limit: 50 }) as RecentOrder[];

                // Filter for pending/active orders
                const activeOrders = allOrders.filter(o =>
                    ['pending', 'confirmed', 'preparing'].includes(o.status)
                );

                setOrders(activeOrders.slice(0, limit));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch recent orders');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [limit]);

    return { orders, isLoading, error };
}

/**
 * Hook for pending orders count
 */
export function usePendingOrdersCount() {
    const [count, setCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await ordersApi.list({ limit: 100 });
                const orders = response.data as RecentOrder[];
                const pendingCount = orders.filter(o => o.status === 'pending').length;
                setCount(pendingCount);
            } catch (err) {
                console.error('Failed to fetch pending orders count:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    return { count, isLoading };
}
