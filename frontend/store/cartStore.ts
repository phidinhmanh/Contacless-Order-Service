import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Food, CartItem } from '@/lib/types';

interface CartState {
    items: CartItem[];
    tableId: string | null;
    specialInstructions: string;

    // Actions
    setTableId: (tableId: string) => void;
    addItem: (food: Food) => void;
    removeItem: (foodId: string) => void;
    updateQuantity: (foodId: string, quantity: number) => void;
    clearCart: () => void;
    setSpecialInstructions: (text: string) => void;
    guestCount: number | null;
    setGuestCount: (count: number) => void;
    // Computed
    getTotal: () => number;
    getItemCount: () => number;
    getItemQuantity: (foodId: string) => number;
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            tableId: null,
            specialInstructions: '',
            guestCount: null,
            setGuestCount: (count: number) => set({ guestCount: count }),
            setTableId: (tableId: string) => set({ tableId }),

            addItem: (food: Food) => {
                const { items } = get();
                const existingItem = items.find((item) => item.food.id === food.id);

                if (existingItem) {
                    set({
                        items: items.map((item) =>
                            item.food.id === food.id
                                ? { ...item, quantity: item.quantity + 1 }
                                : item
                        ),
                    });
                } else {
                    set({ items: [...items, { food, quantity: 1 }] });
                }
            },

            removeItem: (foodId: string) => {
                set({ items: get().items.filter((item) => item.food.id !== foodId) });
            },

            updateQuantity: (foodId: string, quantity: number) => {
                if (quantity <= 0) {
                    get().removeItem(foodId);
                    return;
                }

                set({
                    items: get().items.map((item) =>
                        item.food.id === foodId ? { ...item, quantity } : item
                    ),
                });
            },

            clearCart: () => set({ items: [], specialInstructions: '' }),

            setSpecialInstructions: (text: string) =>
                set({ specialInstructions: text }),

            getTotal: () => {
                return get().items.reduce(
                    (total, item) => total + item.food.price * item.quantity,
                    0
                );
            },

            getItemCount: () => {
                return get().items.reduce((count, item) => count + item.quantity, 0);
            },

            getItemQuantity: (foodId: string) => {
                const item = get().items.find((item) => item.food.id === foodId);
                return item?.quantity || 0;
            },
        }),
        {
            name: 'cart-storage',
            partialize: (state) => ({
                items: state.items,
                tableId: state.tableId,
                guestCount: state.guestCount,
                specialInstructions: state.specialInstructions,
            }),
        }
    )
);
