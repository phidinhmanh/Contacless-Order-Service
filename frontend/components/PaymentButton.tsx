'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import type { PaymentProvider } from '@/lib/types';

interface PaymentButtonProps {
    provider: PaymentProvider;
    onSelect: (provider: PaymentProvider) => void;
    isLoading?: boolean;
    disabled?: boolean;
}

const providerConfig: Record<
    PaymentProvider,
    { name: string; logo: string; color: string; description: string }
> = {
    vietqr: {
        name: 'Chuyển khoản ngân hàng',
        logo: '/images/vietqr-logo.png',
        color: 'from-cyan-500 to-blue-600',
        description: 'Quét mã QR - Tiền về ngay (0% phí)',
    },
    cash: {
        name: 'Tiền mặt',
        logo: '/images/cash-icon.png',
        color: 'from-green-500 to-green-600',
        description: 'Thanh toán tại quầy',
    },
};

export function PaymentButton({
    provider,
    onSelect,
    isLoading = false,
    disabled = false,
}: PaymentButtonProps) {
    const config = providerConfig[provider];

    return (
        <button
            onClick={() => onSelect(provider)}
            disabled={disabled || isLoading}
            className={cn(
                'w-full p-4 rounded-2xl',
                'bg-dark-card border border-dark-border',
                'flex items-center gap-4',
                'transition-all duration-200',
                'hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/10',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'min-h-touch'
            )}
        >
            {/* Provider Logo */}
            <div
                className={cn(
                    'w-14 h-14 rounded-xl flex items-center justify-center',
                    'bg-gradient-to-br',
                    config.color
                )}
            >
                {isLoading ? (
                    <Spinner size="sm" className="border-white" />
                ) : (
                    <div className="w-8 h-8 relative">
                        {/* Fallback icon if image not available */}
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                            {config.name.charAt(0)}
                        </div>
                    </div>
                )}
            </div>

            {/* Provider Info */}
            <div className="flex-1 text-left">
                <h3 className="font-semibold text-text-primary">{config.name}</h3>
                <p className="text-sm text-text-secondary">{config.description}</p>
            </div>

            {/* Arrow */}
            <svg
                className="w-5 h-5 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                />
            </svg>
        </button>
    );
}
