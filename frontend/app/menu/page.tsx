'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, ShoppingBag, X, ClipboardList } from 'lucide-react';
import { CategoryTabs } from '@/components/CategoryTabs';
import { FoodCard } from '@/components/FoodCard';
import { CartDrawer } from '@/components/CartDrawer';
import { CountBadge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';

import { useCartStore } from '@/store/cartStore';
import { useMenuStore } from '@/store/menuStore';
import api from '@/lib/api';
import type { CreateOrderRequest } from '@/lib/types';

export default function MenuPage() {
    const router = useRouter();
    const { items, tableId, getItemCount, specialInstructions, clearCart } = useCartStore();
    const itemCount = getItemCount();

    // Use cached menu store
    const {
        categories,
        foods,
        isLoading,
        error: menuError,
        fetchMenu
    } = useMenuStore();

    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isOrdering, setIsOrdering] = useState(false);
    const [error, setError] = useState('');

    // Fetch menu on mount (uses cache if valid)
    useEffect(() => {
        fetchMenu();
    }, [fetchMenu]);

    // Sync menu error to local error state
    useEffect(() => {
        if (menuError) setError(menuError);
    }, [menuError]);

    // Filter foods by category and search
    const filteredFoods = useMemo(() => {
        let result = foods;

        // Filter by category (handle both category_id and category as field names)
        if (activeCategory) {
            result = result.filter((food) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const f = food as unknown as Record<string, any>;
                return f.category_id === activeCategory || f.category === activeCategory;
            });
        }

        // Filter by search query (client-side)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(
                (food) =>
                    food.name.toLowerCase().includes(query) ||
                    food.description?.toLowerCase().includes(query)
            );
        }

        return result;
    }, [foods, activeCategory, searchQuery]);

    // Handle order submission
    const handleCheckout = async () => {
        if (items.length === 0 || !tableId) return;

        setIsOrdering(true);
        try {
            const orderRequest: CreateOrderRequest = {
                table_id: tableId,
                items: items.map((item) => ({
                    food_id: item.food.id,
                    quantity: item.quantity,
                })),
                special_instructions: specialInstructions || undefined,
            };

            const response = await api.post('/orders/', orderRequest);
            const orderId = response.data.id;

            clearCart();
            setIsCartOpen(false);
            router.push(`/order/${orderId}`);
        } catch (err: any) {
            setError(err.message || 'Không thể đặt món. Vui lòng thử lại.');
        } finally {
            setIsOrdering(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingState message="Đang tải thực đơn..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-dark-bg/95 backdrop-blur-md border-b border-dark-border">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                        <h1 className="text-xl font-bold text-text-primary">Thực đơn</h1>
                        {tableId && (
                            <span className="px-3 py-1 bg-dark-card rounded-full text-sm text-text-secondary">
                                Bàn {tableId}
                            </span>
                        )}
                        {/* Track Order Button */}
                        <button
                            onClick={() => router.push('/order/track')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-primary-500/10 text-primary-400 rounded-full text-sm font-medium hover:bg-primary-500/20 transition-colors"
                        >
                            <ClipboardList size={16} />
                            Theo dõi đơn
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Input
                            type="text"
                            placeholder="Tìm món ăn..."
                            icon={<Search size={18} />}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pr-10"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Tabs */}
                <CategoryTabs
                    categories={categories}
                    activeCategory={activeCategory}
                    onCategoryChange={setActiveCategory}
                />
            </header>

            {/* Error Message */}
            {error && (
                <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
                    {error}
                    <button
                        onClick={() => setError('')}
                        className="ml-2 text-red-300 hover:text-red-100"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Food Grid */}
            <main className="flex-1 px-4 py-4">
                {filteredFoods.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 mb-4 rounded-full bg-dark-card flex items-center justify-center">
                            <Search size={24} className="text-text-muted" />
                        </div>
                        <p className="text-text-secondary mb-1">Không tìm thấy món ăn</p>
                        <p className="text-text-muted text-sm">
                            Thử tìm kiếm với từ khóa khác
                        </p>
                    </div>
                ) : (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={{
                            hidden: { opacity: 0 },
                            visible: {
                                opacity: 1,
                                transition: { staggerChildren: 0.05 },
                            },
                        }}
                        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
                    >
                        {filteredFoods.map((food) => (
                            <motion.div
                                key={food.id}
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    visible: { opacity: 1, y: 0 },
                                }}
                            >
                                <FoodCard food={food} />
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </main>

            {/* Cart FAB */}
            {itemCount > 0 && (
                <motion.button
                    initial={{ scale: 0, y: 100 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0, y: 100 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsCartOpen(true)}
                    className="fixed bottom-6 right-6 z-30 w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-2xl shadow-primary-500/40 flex items-center justify-center"
                >
                    <ShoppingBag size={28} />
                    <CountBadge count={itemCount} />
                </motion.button>
            )}

            {/* Cart Drawer */}
            <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                onCheckout={handleCheckout}
                isLoading={isOrdering}
            />


        </div>
    );
}
