'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { cn, formatTimeRemaining } from '@/lib/utils';

interface CountdownTimerProps {
    /** Duration in seconds */
    duration: number;
    /** Called when timer reaches zero */
    onExpire?: () => void;
    /** Whether to start the timer automatically */
    autoStart?: boolean;
    /** Custom label */
    label?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Style variant */
    variant?: 'default' | 'warning' | 'danger';
    className?: string;
}

export function CountdownTimer({
    duration,
    onExpire,
    autoStart = true,
    label,
    size = 'md',
    variant = 'default',
    className,
}: CountdownTimerProps) {
    const [timeRemaining, setTimeRemaining] = useState(duration);
    const [isRunning, setIsRunning] = useState(autoStart);

    useEffect(() => {
        if (!isRunning || timeRemaining <= 0) return;

        const interval = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    setIsRunning(false);
                    onExpire?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isRunning, timeRemaining, onExpire]);

    // Dynamic variant based on time remaining
    const getVariant = useCallback(() => {
        if (variant !== 'default') return variant;
        if (timeRemaining <= 30) return 'danger';
        if (timeRemaining <= 60) return 'warning';
        return 'default';
    }, [variant, timeRemaining]);

    const currentVariant = getVariant();

    const sizes = {
        sm: 'text-sm',
        md: 'text-lg',
        lg: 'text-2xl',
    };

    const variants = {
        default: 'text-text-primary bg-dark-card border-dark-border',
        warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
        danger: 'text-red-400 bg-red-500/10 border-red-500/30 animate-pulse',
    };

    if (timeRemaining <= 0) {
        return null;
    }

    return (
        <div
            className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-full border',
                variants[currentVariant],
                className
            )}
        >
            {/* Timer icon */}
            <svg
                className={cn('w-4 h-4', currentVariant === 'danger' && 'animate-spin')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>

            {label && <span className="text-text-secondary text-sm">{label}</span>}

            <span className={cn('font-mono font-bold', sizes[size])}>
                {formatTimeRemaining(timeRemaining)}
            </span>
        </div>
    );
}

// Progress bar variant for longer countdowns
interface CountdownProgressProps {
    duration: number;
    onExpire?: () => void;
    label?: string;
}

export function CountdownProgress({
    duration,
    onExpire,
    label = 'Thời gian còn lại',
}: CountdownProgressProps) {
    const [timeRemaining, setTimeRemaining] = useState(duration);

    useEffect(() => {
        if (timeRemaining <= 0) return;

        const interval = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    onExpire?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [timeRemaining, onExpire]);

    const progress = (timeRemaining / duration) * 100;
    const isLow = progress < 20;

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">{label}</span>
                <span
                    className={cn(
                        'font-mono font-bold',
                        isLow ? 'text-red-400' : 'text-text-primary'
                    )}
                >
                    {formatTimeRemaining(timeRemaining)}
                </span>
            </div>
            <div className="h-2 bg-dark-card rounded-full overflow-hidden">
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        isLow
                            ? 'bg-gradient-to-r from-red-500 to-red-600'
                            : 'bg-gradient-to-r from-primary-500 to-secondary-500'
                    )}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
