import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}

// Format price in Vietnamese Dong
// Handles undefined, null, string values, and NaN safely
export function formatPrice(price: number | string | undefined | null): string {
    // Handle undefined/null
    if (price === undefined || price === null) {
        console.warn('[formatPrice] Received undefined/null price');
        return '0 ₫';
    }

    // Convert string to number if needed
    let numPrice: number;
    if (typeof price === 'string') {
        numPrice = parseFloat(price);
    } else {
        numPrice = price;
    }

    // Handle NaN
    if (isNaN(numPrice)) {
        console.warn('[formatPrice] Received NaN price:', price);
        return '0 ₫';
    }

    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(numPrice);
}

// Format time remaining (for countdown)
export function formatTimeRemaining(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Safe number conversion
export function toNumber(value: unknown): number {
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

