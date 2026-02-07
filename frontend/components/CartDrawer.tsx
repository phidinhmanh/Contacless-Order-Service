'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Trash2, ShoppingBag, User, Phone, Users } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/Button';
import { Textarea, Input } from '@/components/ui/Input'; // Assuming Input exists or Textarea usage
import api from '@/lib/api';
import { createTableSession, getTableIdFromUrl } from '@/lib/auth';

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onCheckout: () => void;
    isLoading?: boolean;
}

export function CartDrawer({
    isOpen,
    onClose,
    onCheckout,
    isLoading = false,
}: CartDrawerProps) {
    const {
        items,
        updateQuantity,
        removeItem,
        clearCart,
        getTotal,
        specialInstructions,
        setSpecialInstructions,
        guestCount,
        setGuestCount,
    } = useCartStore();

    const [userInfo, setUserInfo] = useState<{ full_name?: string; phone_number?: string } | null>(null);
    const [showGuestCountStep, setShowGuestCountStep] = useState(false);

    const total = getTotal();
    const isEmpty = items.length === 0;

    // Fetch user info when drawer opens
    useEffect(() => {
        if (isOpen) {
            api.get('/users/me')
                .then(res => {
                    setUserInfo(res.data);
                })
                .catch(() => {
                    // Ignore auth errors (guest)
                });
        }
    }, [isOpen]);

    const handleCheckoutClick = async () => {
        // Step 1: Check if guest count is set
        if (!guestCount) {
            setShowGuestCountStep(true);
            return;
        }
        onCheckout();
    };

    const handleGuestCountSelect = async (count: number) => {
        setGuestCount(count);

        // Create table session with guest count
        const tableId = getTableIdFromUrl();
        if (tableId) {
            const parsed = Number.parseInt(tableId, 10);
            if (Number.isFinite(parsed)) {
                try {
                    await createTableSession(parsed, count);
                } catch (e) {
                    console.error('Session creation failed', e);
                }
            }
        }

        setShowGuestCountStep(false);
        onCheckout();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className={cn(
                            'fixed bottom-0 left-0 right-0 z-50',
                            'bg-dark-surface rounded-t-3xl',
                            'max-h-[85vh] overflow-hidden',
                            'flex flex-col'
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-dark-border">
                            <div className="flex items-center gap-3">
                                <ShoppingBag className="text-primary-500" size={24} />
                                <h2 className="text-lg font-bold text-text-primary">
                                    Giỏ hàng ({items.length})
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {isEmpty ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <ShoppingBag className="text-text-muted mb-4" size={48} />
                                    <p className="text-text-secondary mb-2">Giỏ hàng trống</p>
                                    <p className="text-text-muted text-sm">
                                        Thêm món ăn từ thực đơn
                                    </p>
                                </div>
                            ) : showGuestCountStep ? (
                                <div className="space-y-4">
                                    <div className="bg-primary-500/10 p-4 rounded-xl border border-primary-500/20 mb-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Users className="text-primary-400" size={20} />
                                            <h3 className="text-primary-400 font-medium">Bàn mình đi bao nhiêu người?</h3>
                                        </div>
                                        <p className="text-text-muted text-sm">Thông tin này giúp chúng tôi phục vụ tốt hơn.</p>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        {[1, 2, 3, 4, 5, 6].map((num) => (
                                            <button
                                                key={num}
                                                type="button"
                                                onClick={() => handleGuestCountSelect(num)}
                                                className={cn(
                                                    'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                                                    'hover:border-primary-500 hover:bg-primary-500/10',
                                                    'border-dark-border bg-dark-bg'
                                                )}
                                            >
                                                <span className="text-xl font-bold text-text-primary">
                                                    {num === 6 ? '6+' : num}
                                                </span>
                                                <span className="text-xs text-text-muted">người</span>
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowGuestCountStep(false)}
                                        className="w-full mt-3 text-sm text-text-muted hover:text-text-primary"
                                    >
                                        ← Quay lại
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Cart Items */}
                                    <div className="space-y-3 mb-4">
                                        {items.map((item) => (
                                            <div
                                                key={item.food.id}
                                                className="flex items-center gap-3 p-3 bg-dark-card rounded-xl"
                                            >
                                                {/* Item Info */}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-text-primary text-sm truncate">
                                                        {item.food.name}
                                                    </h3>
                                                    <p className="text-primary-400 text-sm font-semibold">
                                                        {formatPrice(item.food.price)}
                                                    </p>
                                                </div>

                                                {/* Quantity Controls */}
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() =>
                                                            updateQuantity(item.food.id, item.quantity - 1)
                                                        }
                                                        className="w-8 h-8 rounded-full bg-dark-border text-text-primary hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors"
                                                    >
                                                        {item.quantity === 1 ? (
                                                            <Trash2 size={14} />
                                                        ) : (
                                                            <Minus size={14} />
                                                        )}
                                                    </button>
                                                    <span className="w-8 text-center text-sm font-medium text-text-primary">
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        onClick={() =>
                                                            updateQuantity(item.food.id, item.quantity + 1)
                                                        }
                                                        className="w-8 h-8 rounded-full bg-primary-500 text-white hover:bg-primary-600 flex items-center justify-center transition-colors"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>

                                                {/* Subtotal */}
                                                <div className="text-right min-w-[80px]">
                                                    <p className="text-text-primary font-semibold text-sm">
                                                        {formatPrice(item.food.price * item.quantity)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Special Instructions */}
                                    <div className="mb-4">
                                        <Textarea
                                            label="Ghi chú đặc biệt"
                                            placeholder="Ví dụ: Không hành, ít cay..."
                                            value={specialInstructions}
                                            onChange={(e) => setSpecialInstructions(e.target.value)}
                                            rows={2}
                                        />
                                    </div>

                                    {/* Clear Cart */}
                                    <button
                                        onClick={clearCart}
                                        className="text-red-400 text-sm hover:text-red-300 transition-colors"
                                    >
                                        Xóa tất cả
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {!showGuestCountStep && (
                            <div className="p-4 border-t border-dark-border bg-dark-bg/50 backdrop-blur">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-text-secondary">Tổng cộng</span>
                                    <span className="text-2xl font-bold text-primary-400">
                                        {formatPrice(total)}
                                    </span>
                                </div>
                                <Button
                                    onClick={handleCheckoutClick}
                                    disabled={isEmpty}
                                    isLoading={isLoading}
                                    className="w-full"
                                    size="lg"
                                >
                                    Đặt món
                                </Button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
