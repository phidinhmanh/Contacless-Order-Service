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
import { OutOfStockPopup } from '@/components/OutOfStockPopup';

import { useCartStore } from '@/store/cartStore';
import { useMenuStore } from '@/store/menuStore';
import { ordersApi} from '@/lib/api';

export default function MenuPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const { items, tableId, getItemCount, specialInstructions, clearCart } = useCartStore();
    const itemCount = getItemCount();

    // Use cached menu store
    const {
        categories,
        foods,
        isLoading,
        error: menuError,
        lastFetched,
        fetchMenu
    } = useMenuStore();

    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isOrdering, setIsOrdering] = useState(false);
    const [error, setError] = useState('');
    const [outOfStockFood, setOutOfStockFood] = useState<string | null>(null);
    const [isOutOfStockPopupOpen, setIsOutOfStockPopupOpen] = useState(false);

    // Fetch menu on mount (uses cache if valid)
    useEffect(() => {
        console.log('🔄 MenuPage: Fetching menu...', {
            cachedCategories: categories.length,
            cachedFoods: foods.length,
            lastFetched: lastFetched,
            isLoading,
        });
        fetchMenu().catch((err) => {
            console.error('❌ MenuPage: fetchMenu failed:', err);
        });
    }, [fetchMenu]);

    // Sync menu error to local error state
    useEffect(() => {
        if (menuError) {
            console.warn('⚠️ MenuPage: menuError detected:', menuError);
            setError(menuError);
        }
    }, [menuError]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Filter foods by category and search
    const filteredFoods = useMemo(() => {
        let result = foods;

        // Filter by category (handle both category_id and category as field names)
        if (activeCategory) {
            result = result.filter((food) => {
                const foodCategoryId = food.category_id ? String(food.category_id) : null;
                return foodCategoryId === activeCategory;
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
            const orderRequest = {
                table_id: Number(tableId),
                items: items.map((item) => ({
                    food_id: Number(item.food.id),
                    quantity: item.quantity,
                })),
                special_instructions: specialInstructions || undefined,
            };

            const response = await ordersApi.create(orderRequest);
            const orderId = response.id;

            clearCart();
            setIsCartOpen(false);
            router.push(`/order/${orderId}`);
        } catch (err: any) {
            const errorMessage = err.message || '';

            // Check if it's a stock-related error
            if (errorMessage.includes('sold out') ||
                errorMessage.includes('insufficient stock') ||
                errorMessage.includes('hết') ||
                errorMessage.includes('không đủ')) {

                // Extract food name from error message if available
                const foodMatch = errorMessage.match(/Food '([^']+)'/);
                const foodName = foodMatch ? foodMatch[1] : null;

                // Close cart drawer to prevent overlap with out-of-stock popup
                setIsCartOpen(false);
                setOutOfStockFood(foodName);
                setIsOutOfStockPopupOpen(true);
            } else {
                setError(errorMessage || 'Không thể đặt món. Vui lòng thử lại.');
            }
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

    if (!mounted) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center">
                {/* Return a simple skeleton or loading state that matches SSR */}
                <div className="animate-pulse bg-dark-card w-12 h-12 rounded-full" />
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

            {/* Out of Stock Popup */}
            <OutOfStockPopup
                isOpen={isOutOfStockPopupOpen}
                onClose={() => {
                    setIsOutOfStockPopupOpen(false);
                    setOutOfStockFood(null);
                }}
                foodName={outOfStockFood || undefined}
            />

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
