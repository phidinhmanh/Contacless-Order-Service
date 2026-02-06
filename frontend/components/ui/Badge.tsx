import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
    className?: string;
}

export function Badge({
    variant = 'default',
    size = 'md',
    children,
    className,
}: BadgeProps) {
    const variants = {
        default: 'bg-dark-card text-text-primary border border-dark-border',
        success: 'bg-secondary-500/20 text-secondary-400 border border-secondary-500/30',
        warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
        error: 'bg-red-500/20 text-red-400 border border-red-500/30',
        info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-base',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center font-medium rounded-full',
                variants[variant],
                sizes[size],
                className
            )}
        >
            {children}
        </span>
    );
}

// Count badge for cart FAB
interface CountBadgeProps {
    count: number;
    className?: string;
}

export function CountBadge({ count, className }: CountBadgeProps) {
    if (count <= 0) return null;

    return (
        <span
            className={cn(
                'absolute -top-2 -right-2 flex items-center justify-center',
                'min-w-[20px] h-5 px-1.5 rounded-full',
                'bg-primary-500 text-white text-xs font-bold',
                'shadow-lg shadow-primary-500/50',
                'animate-pulse',
                className
            )}
        >
            {count > 99 ? '99+' : count}
        </span>
    );
}
