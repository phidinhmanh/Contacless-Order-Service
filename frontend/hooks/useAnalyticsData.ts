import { useState, useEffect, useCallback } from 'react';
import { usersApi, analyticsApi } from '@/lib/api';
import {
    RevenueData,
    ItemStat,
    PeakHour,
    CustomerSegments,
    RetentionData,
    CustomerData,
    PeriodType,
} from '@/lib/types/analytics';
import { useDatePeriod } from '@/hooks/useDatePeriod';

/**
 * useAnalyticsData Hook
 *
 * Single Responsibility: Fetch analytics data from API.
 * Follows SRP by only handling analytics data fetching.
 * Follows DIP by depending on abstracted API calls.
 *
 * @param period - The time period for analytics data
 * @returns Analytics data, loading state, and error state
 */
interface AnalyticsDataResult {
    revenueStats: RevenueData | null;
    popularItems: ItemStat[];
    peakHours: PeakHour[];
    customerSegments: CustomerSegments | null;
    retention: RetentionData | null;
    customers: CustomerData[];
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useAnalyticsData(period: PeriodType): AnalyticsDataResult {
    const [revenueStats, setRevenueStats] = useState<RevenueData | null>(null);
    const [popularItems, setPopularItems] = useState<ItemStat[]>([]);
    const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
    const [customerSegments, setCustomerSegments] = useState<CustomerSegments | null>(null);
    const [retention, setRetention] = useState<RetentionData | null>(null);
    const [customers, setCustomers] = useState<CustomerData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Centralized date period calculation so all analytics requests
    // (including export and charts) share the exact same range logic.
    const { startDateStr, endDateStr, daysParam } = useDatePeriod(period);


    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Execute concurrent requests using the same period mapping
            // as `useDatePeriod` and the backend analytics service.
            const [revenue, popular, peak, segments, retention, users] =
                await Promise.all([
                    // Revenue uses explicit ISO timestamps
                    analyticsApi.revenue({ start_date: startDateStr, end_date: endDateStr }),

                    // Others use the numeric days parameter
                    analyticsApi.popularItems({ days: daysParam, limit: 10 }),
                    analyticsApi.peakHours({ days: daysParam }),
                    analyticsApi.customers(),
                    analyticsApi.retention(),
                    usersApi.list({ limit: 100 }).catch(() => []),
                ]);

            // Update states with fetched data
            setRevenueStats(revenue);
            setPopularItems(popular || []);
            setPeakHours(peak || []);
            setCustomerSegments(segments);
            setRetention(retention);
            setCustomers(users || []);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch data');
        } finally {
            setIsLoading(false);
        }
    }, [period, startDateStr, endDateStr, daysParam]); // Refetch when the user clicks a different period

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        revenueStats,
        popularItems,
        peakHours,
        customerSegments,
        retention,
        customers,
        isLoading,
        error,
        refetch: fetchData,
    };
}

/**
 * Hook for fetching individual analytics endpoints
 */
export function useRevenueData(period: PeriodType) {
    const [data, setData] = useState<RevenueData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await analyticsApi.revenue();
                setData(response.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch revenue data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [period]);

    return { data, isLoading, error };
}

export function usePopularItems(period: PeriodType, limit: number = 10) {
    const [data, setData] = useState<ItemStat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
                const data = await analyticsApi.popularItems({ days, limit });
                setData(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch popular items');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [period, limit]);

    return { data, isLoading, error };
}

export function usePeakHours(period: PeriodType) {
    const [data, setData] = useState<PeakHour[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
                const response = await analyticsApi.peakHours({ days: days });
                setData(response.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch peak hours');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [period]);

    return { data, isLoading, error };
}

export function useCustomerSegments() {
    const [data, setData] = useState<CustomerSegments | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await analyticsApi.customers();
                setData(response.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch customer segments');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    return { data, isLoading, error };
}

export function useRetentionData() {
    const [data, setData] = useState<RetentionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await analyticsApi.retention();
                setData(response.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch retention data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    return { data, isLoading, error };
}
