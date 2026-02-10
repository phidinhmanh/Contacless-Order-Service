import { useMemo } from 'react';
import { CustomerData, GenderStat } from '@/lib/types/analytics';

/**
 * useGenderStats Hook
 * 
 * Single Responsibility: Process customer data to gender distribution statistics.
 * Follows SRP by only handling gender data calculation and transformation.
 * 
 * @param customers - Array of customer data
 * @returns Array of gender statistics with percentages and labels
 */
export function useGenderStats(customers: CustomerData[]): GenderStat[] {
    return useMemo((): GenderStat[] => {
        if (!customers || !Array.isArray(customers)) {
            return [];
        }

        // Count genders
        const stats = customers.reduce((acc, c) => {
            const gender = c.gender || 'unknown';
            acc[gender] = (acc[gender] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Calculate total
        const total = Object.values(stats).reduce(
            (sum: number, count: unknown) => sum + (count as number),
            0
        );

        // Map to GenderStat array with Vietnamese labels and colors
        return Object.entries(stats).map(([gender, count]) => ({
            gender,
            count: count as number,
            percent: total > 0 ? ((count as number) / total) * 100 : 0,
            label: gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : 'Khác',
            color: gender === 'male' 
                ? '#3b82f6'  // blue-500
                : gender === 'female' 
                    ? '#ec4899'  // pink-500
                    : '#6b7280'  // gray-500
        }));
    }, [customers]);
}

/**
 * Calculate gender distribution from raw counts
 */
export function calculateGenderDistribution(counts: {
    male: number;
    female: number;
    other: number;
}): GenderStat[] {
    const total = counts.male + counts.female + counts.other;

    return [
        {
            gender: 'male',
            count: counts.male,
            percent: total > 0 ? (counts.male / total) * 100 : 0,
            label: 'Nam',
            color: '#3b82f6',
        },
        {
            gender: 'female',
            count: counts.female,
            percent: total > 0 ? (counts.female / total) * 100 : 0,
            label: 'Nữ',
            color: '#ec4899',
        },
        {
            gender: 'other',
            count: counts.other,
            percent: total > 0 ? (counts.other / total) * 100 : 0,
            label: 'Khác',
            color: '#6b7280',
        },
    ];
}

/**
 * Get gender label by key
 */
export function getGenderLabel(gender: string): string {
    switch (gender.toLowerCase()) {
        case 'male':
        case 'nam':
            return 'Nam';
        case 'female':
        case 'nữ':
            return 'Nữ';
        default:
            return 'Khác';
    }
}

/**
 * Get gender color by key
 */
export function getGenderColor(gender: string): string {
    switch (gender.toLowerCase()) {
        case 'male':
            return '#3b82f6';
        case 'female':
            return '#ec4899';
        default:
            return '#6b7280';
    }
}
