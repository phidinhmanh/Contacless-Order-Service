import { useMemo } from 'react';
import { PeriodType, DatePeriodResult } from '@/lib/types/analytics';

// Vietnam timezone offset (UTC+7)
const VIETNAM_TZ_OFFSET_HOURS = 7;

/**
 * Helper to format a date to ISO string with Vietnam timezone offset
 * (e.g., 2026-02-09T00:00:00+07:00)
 */
const formatToVietnamISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
};

/**
 * Get the current date/time in Vietnam timezone as a Date object
 * This creates a Date that represents the correct Vietnam time
 */
const getNowInVietnamTime = (): Date => {
    const now = new Date();
    // Get the UTC timestamp
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    // Add Vietnam offset (UTC+7)
    const vietnamTime = new Date(utcTime + (VIETNAM_TZ_OFFSET_HOURS * 60 * 60 * 1000));
    return vietnamTime;
};

/**
 * Create a Date object that represents midnight (00:00:00) in Vietnam timezone
 * for the given date components
 */
const createVietnamMidnight = (year: number, month: number, day: number): Date => {
    // Create a Date at midnight Vietnam time
    // Since Vietnam is UTC+7, midnight ICT = 17:00 UTC previous day
    const utcDate = new Date(Date.UTC(year, month - 1, day, VIETNAM_TZ_OFFSET_HOURS, 0, 0));
    // Adjust by subtracting the offset to get the correct UTC representation
    return new Date(utcDate.getTime() - (VIETNAM_TZ_OFFSET_HOURS * 60 * 60 * 1000));
};

export function useDatePeriod(period: PeriodType): DatePeriodResult {
    const result = useMemo((): DatePeriodResult => {
        const now = getNowInVietnamTime();

        let start: Date;

        if (period === 'day') {
            // Start of today in Vietnam time (00:00:00 ICT)
            start = createVietnamMidnight(now.getFullYear(), now.getMonth() + 1, now.getDate());
        } else if (period === 'week') {
            // 7 days ago, starting at 00:00:00 ICT
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(now.getDate() - 7);
            start = createVietnamMidnight(
                sevenDaysAgo.getFullYear(),
                sevenDaysAgo.getMonth() + 1,
                sevenDaysAgo.getDate()
            );
        } else if (period === 'month') {
            // 30 days ago, starting at 00:00:00 ICT
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(now.getDate() - 30);
            start = createVietnamMidnight(
                thirtyDaysAgo.getFullYear(),
                thirtyDaysAgo.getMonth() + 1,
                thirtyDaysAgo.getDate()
            );
        } else {
            // Default to today
            start = createVietnamMidnight(now.getFullYear(), now.getMonth() + 1, now.getDate());
        }

        // Format dates for API (Vietnam timezone)
        const startDateStr = formatToVietnamISO(start);
        const endDateStr = formatToVietnamISO(now);

        const daysParam = period === 'day' ? 1 : period === 'week' ? 7 : 30;

        return {
            startDate: start,
            endDate: now,
            startDateStr, // Sent to /analytics/revenue
            endDateStr,   // Sent to /analytics/revenue
            daysParam,    // Sent to /analytics/popular-items
        };
    }, [period]);

    return result;
}

/**
 * Alternative: Get date range for a specific number of days
 * Useful for custom date ranges
 */
export function getDateRangeForDays(days: number): { startDate: Date; endDate: Date } {
    const now = getNowInVietnamTime();
    const start = new Date(now);
    start.setDate(now.getDate() - days);
    const adjustedStart = createVietnamMidnight(start.getFullYear(), start.getMonth() + 1, start.getDate());

    return {
        startDate: adjustedStart,
        endDate: now,
    };
}

/**
 * Format date for display
 */
export function formatDateForDisplay(date: Date): string {
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

/**
 * Format time for display
 */
export function formatTimeForDisplay(date: Date): string {
    return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    });
}
