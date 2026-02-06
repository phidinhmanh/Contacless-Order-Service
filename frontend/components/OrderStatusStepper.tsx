'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, ChefHat, Bell, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';

interface Step {
    status: OrderStatus;
    label: string;
    labelVi: string;
    icon: React.ReactNode;
}

const steps: Step[] = [
    {
        status: 'pending',
        label: 'Order Received',
        labelVi: 'Đã nhận đơn',
        icon: <Clock size={20} />,
    },
    {
        status: 'confirmed',
        label: 'Kitchen Confirmed',
        labelVi: 'Bếp xác nhận',
        icon: <Check size={20} />,
    },
    {
        status: 'preparing',
        label: 'Cooking',
        labelVi: 'Đang nấu',
        icon: <ChefHat size={20} />,
    },
    {
        status: 'ready',
        label: 'Ready for Pickup',
        labelVi: 'Sẵn sàng lấy',
        icon: <Bell size={20} />,
    },
];

const statusOrder: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];

interface OrderStatusStepperProps {
    currentStatus: OrderStatus;
    className?: string;
}

export function OrderStatusStepper({
    currentStatus,
    className,
}: OrderStatusStepperProps) {
    const currentIndex = statusOrder.indexOf(currentStatus);

    const getStepState = (stepStatus: OrderStatus) => {
        const stepIndex = statusOrder.indexOf(stepStatus);
        if (stepIndex < currentIndex) return 'completed';
        if (stepIndex === currentIndex) return 'active';
        return 'pending';
    };

    return (
        <div className={cn('space-y-0', className)}>
            {steps.map((step, index) => {
                const state = getStepState(step.status);
                const isLast = index === steps.length - 1;

                return (
                    <div key={step.status} className="flex">
                        {/* Icon and Line */}
                        <div className="flex flex-col items-center mr-4">
                            {/* Icon Circle */}
                            <motion.div
                                initial={false}
                                animate={{
                                    scale: state === 'active' ? 1.1 : 1,
                                    backgroundColor:
                                        state === 'completed'
                                            ? '#2EC4B6'
                                            : state === 'active'
                                                ? '#FF6B35'
                                                : '#1F2A48',
                                }}
                                transition={{ duration: 0.3 }}
                                className={cn(
                                    'w-12 h-12 rounded-full flex items-center justify-center',
                                    'border-2 transition-colors duration-300',
                                    state === 'completed' && 'border-secondary-500 text-white',
                                    state === 'active' &&
                                    'border-primary-500 text-white shadow-lg shadow-primary-500/30',
                                    state === 'pending' && 'border-dark-border text-text-muted'
                                )}
                            >
                                {state === 'completed' ? <Check size={20} /> : step.icon}
                            </motion.div>

                            {/* Connecting Line */}
                            {!isLast && (
                                <div className="relative w-0.5 h-16 bg-dark-border my-1">
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{
                                            height:
                                                state === 'completed' || state === 'active'
                                                    ? '100%'
                                                    : 0,
                                        }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                        className={cn(
                                            'absolute top-0 left-0 w-full',
                                            state === 'completed'
                                                ? 'bg-secondary-500'
                                                : 'bg-primary-500'
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Step Content */}
                        <div className="flex-1 pb-8">
                            <motion.div
                                initial={false}
                                animate={{
                                    opacity: state === 'pending' ? 0.5 : 1,
                                }}
                                className="pt-3"
                            >
                                <h3
                                    className={cn(
                                        'font-semibold text-base',
                                        state === 'completed' && 'text-secondary-400',
                                        state === 'active' && 'text-primary-400',
                                        state === 'pending' && 'text-text-muted'
                                    )}
                                >
                                    {step.labelVi}
                                </h3>
                                <p className="text-sm text-text-muted mt-0.5">{step.label}</p>

                                {/* Animated cooking indicator */}
                                {state === 'active' && step.status === 'preparing' && (
                                    <motion.div
                                        animate={{ opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                        className="mt-2 flex items-center gap-2 text-primary-400 text-sm"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-primary-400" />
                                        Đang chuẩn bị...
                                    </motion.div>
                                )}

                                {/* Ready notification indicator */}
                                {state === 'active' && step.status === 'ready' && (
                                    <motion.div
                                        animate={{ scale: [1, 1.05, 1] }}
                                        transition={{ duration: 0.5, repeat: Infinity }}
                                        className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-secondary-500/20 text-secondary-400 rounded-full text-sm font-medium"
                                    >
                                        <Bell size={14} />
                                        Sẵn sàng lấy!
                                    </motion.div>
                                )}
                            </motion.div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
