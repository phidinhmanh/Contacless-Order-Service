// ============================================
// Analytics Types - Single Source of Truth
// ============================================

// Revenue Analytics
export interface RevenueData {
    period: { start: string; end: string };
    total_revenue: number;
    order_count: number;
    average_order_value: number;
    currency: string;
}

// Popular Items
export interface ItemStat {
    food_name: string;
    quantity: number;
    revenue: number;
}

// Peak Hours
export interface PeakHour {
    time_slot: string;
    order_count: number;
}

// Customer Segments
export interface CustomerSegments {
    total_customers: number;
    new_customers: number;
    returning_customers: number;
    retention_rate: number;
}

// Retention Data
export interface RetentionData {
    rate_14d: number;
    rate_30d: number;
    returning_users_14d: number;
    returning_users_30d: number;
}

// Customer/User Data
export interface CustomerData {
    id: number;
    gender?: 'male' | 'female' | 'unknown' | string;
    [key: string]: unknown;
}

// Gender Distribution
export interface GenderStat {
    gender: string;
    count: number;
    percent: number;
    label: string;
    color: string;
}

// Dashboard Stats
export interface StatsData {
    todayRevenue: number;
    todayOrders: number;
    pendingOrders: number;
    activeTables: number;
}

// Recent Order
export interface RecentOrder {
    id: number;
    table_id: number;
    status: string;
    total_price: number;
    created_at: string;
    items: { food_name: string; quantity: number }[];
}

// Period Type
export type PeriodType = 'day' | 'week' | 'month';

// Date Period Result
export interface DatePeriodResult {
    startDate: Date;
    endDate: Date;
    startDateStr: string;
    endDateStr: string;
    daysParam: number;
}

// Analytics API Response Types
export interface AnalyticsAPIResponse<T> {
    data: T;
    status: number;
    message?: string;
}

// Export Options
export interface ExportOptions {
    endpoint: string;
    filename: string;
    params?: Record<string, unknown>;
}
