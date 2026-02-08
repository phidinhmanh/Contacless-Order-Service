'use client';

import React from 'react';
import Image from 'next/image';
import { Plus, Minus } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cartStore';
import type { Food } from '@/lib/types';

interface FoodCardProps {
    food: Food;
}

export function FoodCard({ food }: FoodCardProps) {
    const { addItem, updateQuantity, getItemQuantity } = useCartStore();
    const quantity = getItemQuantity(food.id);
    const isUnavailable = !food.is_available;

    const handleAdd = () => {
        if (isUnavailable) return;
        addItem(food);
    };

    const handleIncrease = () => {
        updateQuantity(food.id, quantity + 1);
    };

    const handleDecrease = () => {
        updateQuantity(food.id, quantity - 1);
    };

    return (
        <div
            className={cn(
                'food-card relative bg-dark-card rounded-2xl overflow-hidden',
                'border border-dark-border',
                'transform transition-all duration-300',
                isUnavailable
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:scale-[1.02] hover:shadow-xl hover:shadow-primary-500/10'
            )}
        >
            {/* Food Image */}
            <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                    src={food.image_url || '/images/placeholder-food.svg'}
                    alt={food.name}
                    fill
                    className={cn(
                        'object-cover transition-transform duration-300',
                        !isUnavailable && 'group-hover:scale-110'
                    )}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />

                {/* Sold Out Overlay */}
                {isUnavailable && (
                    <div className="absolute inset-0 bg-dark-bg/70 backdrop-blur-sm flex items-center justify-center">
                        <span className="px-4 py-2 bg-red-500/80 text-white font-bold rounded-lg transform -rotate-12">
                            Hết món
                        </span>
                    </div>
                )}

                {/* Quantity badge (if in cart) */}
                {quantity > 0 && !isUnavailable && (
                    <div className="absolute top-2 right-2 bg-primary-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                        x{quantity}
                    </div>
                )}
            </div>

            {/* Food Info */}
            <div className="p-3">
                <h3 className="font-semibold text-text-primary text-sm line-clamp-2 mb-1">
                    {food.name}
                </h3>

                {food.description && (
                    <p className="text-text-muted text-xs line-clamp-1 mb-2">
                        {food.description}
                    </p>
                )}

                <div className="flex items-center justify-between gap-2">
                    <span className="text-primary-400 font-bold text-sm">
                        {formatPrice(food.price)}
                    </span>

                    {/* Add/Quantity Controls */}
                    {!isUnavailable && (
                        <>
                            {quantity === 0 ? (
                                <button
                                    onClick={handleAdd}
                                    data-testid={`add-to-cart-${food.id}`}
                                    className={cn(
                                        'flex items-center justify-center',
                                        'w-9 h-9 rounded-full',
                                        'bg-primary-500 text-white',
                                        'hover:bg-primary-600',
                                        'transition-colors duration-200',
                                        'shadow-lg shadow-primary-500/30'
                                    )}
                                    aria-label="Thêm vào giỏ"
                                >
                                    <Plus size={18} />
                                </button>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleDecrease}
                                        className="w-8 h-8 rounded-full bg-dark-border text-text-primary hover:bg-dark-card flex items-center justify-center transition-colors"
                                        aria-label="Giảm số lượng"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="w-6 text-center text-sm font-medium text-text-primary">
                                        {quantity}
                                    </span>
                                    <button
                                        onClick={handleIncrease}
                                        className="w-8 h-8 rounded-full bg-primary-500 text-white hover:bg-primary-600 flex items-center justify-center transition-colors"
                                        aria-label="Tăng số lượng"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
