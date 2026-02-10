import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
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
            const [revenueRes, popularRes, peakRes, segmentsRes, retentionRes, usersRes] =
                await Promise.all([
                    // Revenue uses explicit ISO timestamps
                    api.get(`/analytics/revenue?start_date=${encodeURIComponent(startDateStr)}&end_date=${encodeURIComponent(endDateStr)}`),

                    // Others use the numeric days parameter
                    api.get(`/analytics/popular-items?days=${daysParam}&limit=10`),
                    api.get(`/analytics/peak-hours?days=${daysParam}`),
                    api.get('/analytics/customers'),
                    api.get('/analytics/retention'),
                    api.get('/users', { params: { limit: 100 } }).catch(() => ({ data: [] })),
                ]);

            // Update states with fetched data
            setRevenueStats(revenueRes.data);
            setPopularItems(popularRes.data || []);
            setPeakHours(peakRes.data || []);
            setCustomerSegments(segmentsRes.data);
            setRetention(retentionRes.data);
            setCustomers(usersRes.data || []);
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
                const response = await api.get('/analytics/revenue');
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
                const response = await api.get(`/analytics/popular-items?days=${days}&limit=${limit}`);
                setData(response.data);
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
                const response = await api.get(`/analytics/peak-hours?days=${days}`);
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
                const response = await api.get('/analytics/customers');
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
                const response = await api.get('/analytics/retention');
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
