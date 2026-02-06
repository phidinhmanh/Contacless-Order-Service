import React from 'react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
    const sizes = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <div
            className={cn(
                'animate-spin rounded-full border-2 border-transparent',
                'border-t-primary-500 border-r-primary-500',
                sizes[size],
                className
            )}
        />
    );
}

// Full page loading spinner
export function PageSpinner() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-dark-bg/80 backdrop-blur-sm z-50">
            <div className="flex flex-col items-center gap-4">
                <Spinner size="lg" />
                <p className="text-text-secondary animate-pulse">Đang tải...</p>
            </div>
        </div>
    );
}

// Inline loading state
interface LoadingStateProps {
    message?: string;
}

export function LoadingState({ message = 'Đang tải...' }: LoadingStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Spinner size="md" />
            <p className="text-text-secondary">{message}</p>
        </div>
    );
}
