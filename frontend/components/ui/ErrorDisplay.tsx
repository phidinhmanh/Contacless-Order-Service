'use client';

import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/api';

interface ErrorDisplayProps {
    /** The error to display - can be any type, will be safely converted to string */
    error: unknown;
    /** Optional title for the error */
    title?: string;
    /** Callback to retry the failed action */
    onRetry?: () => void;
    /** Callback to dismiss the error */
    onDismiss?: () => void;
    /** Variant style */
    variant?: 'inline' | 'banner' | 'toast';
    /** Additional className */
    className?: string;
}

/**
 * Safe error display component that handles any error type
 * Never crashes React by attempting to render objects directly
 */
export function ErrorDisplay({
    error,
    title,
    onRetry,
    onDismiss,
    variant = 'inline',
    className,
}: ErrorDisplayProps) {
    // Always extract a safe string message
    const message = getErrorMessage(error);

    if (variant === 'toast') {
        return (
            <div
                className={cn(
                    'flex items-start gap-3 p-4 rounded-xl',
                    'bg-red-500/10 border border-red-500/30',
                    'animate-fade-in',
                    className
                )}
            >
                <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    {title && (
                        <p className="font-medium text-red-400 text-sm mb-1">{title}</p>
                    )}
                    <p className="text-text-secondary text-sm">{message}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                            aria-label="Thử lại"
                        >
                            <RefreshCw size={16} />
                        </button>
                    )}
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                            aria-label="Đóng"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (variant === 'banner') {
        return (
            <div
                className={cn(
                    'w-full p-4 bg-red-500/10 border-y border-red-500/30',
                    className
                )}
            >
                <div className="flex items-center gap-3 max-w-lg mx-auto">
                    <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
                    <p className="flex-1 text-text-secondary text-sm">{message}</p>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="text-red-400 hover:text-red-300 text-sm font-medium"
                        >
                            Thử lại
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Default: inline
    return (
        <div
            className={cn(
                'flex items-start gap-2 p-3 rounded-lg',
                'bg-red-500/10 border border-red-500/20',
                className
            )}
        >
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                {title && (
                    <p className="font-medium text-red-400 text-sm">{title}</p>
                )}
                <p className="text-text-muted text-sm">{message}</p>
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="text-red-400 hover:text-red-300 text-xs font-medium flex-shrink-0"
                >
                    Thử lại
                </button>
            )}
        </div>
    );
}

/**
 * Simple inline error text - for use in forms or small spaces
 */
export function ErrorText({
    error,
    className,
}: {
    error: unknown;
    className?: string;
}) {
    const message = getErrorMessage(error);
    return (
        <p className={cn('text-red-400 text-sm', className)}>
            {message}
        </p>
    );
}
