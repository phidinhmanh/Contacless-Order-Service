import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export function Input({
    label,
    error,
    icon,
    className,
    ...props
}: InputProps) {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    {label}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                        {icon}
                    </div>
                )}
                <input
                    className={cn(
                        'w-full bg-dark-card border border-dark-border rounded-xl',
                        'px-4 py-3 text-text-primary placeholder:text-text-muted',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                        'transition-all duration-200',
                        'min-h-touch',
                        icon && 'pl-10',
                        error && 'border-red-500 focus:ring-red-500',
                        className
                    )}
                    {...props}
                />
            </div>
            {error && (
                <p className="mt-1.5 text-sm text-red-400">{error}</p>
            )}
        </div>
    );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export function Textarea({
    label,
    error,
    className,
    ...props
}: TextareaProps) {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    {label}
                </label>
            )}
            <textarea
                className={cn(
                    'w-full bg-dark-card border border-dark-border rounded-xl',
                    'px-4 py-3 text-text-primary placeholder:text-text-muted',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'transition-all duration-200 resize-none',
                    error && 'border-red-500 focus:ring-red-500',
                    className
                )}
                {...props}
            />
            {error && (
                <p className="mt-1.5 text-sm text-red-400">{error}</p>
            )}
        </div>
    );
}
