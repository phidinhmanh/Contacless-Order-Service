import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import type { Food } from '@/lib/types';

// Categories can be strings or objects from API
type CategoryItem = string | { id?: string; name?: string;[key: string]: unknown };

interface MenuState {
    categories: CategoryItem[];
    foods: Food[];
    lastFetched: number | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchMenu: (force?: boolean) => Promise<void>;
    clearCache: () => void;
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export const useMenuStore = create<MenuState>()(
    persist(
        (set, get) => ({
            categories: [],
            foods: [],
            lastFetched: null,
            isLoading: false,
            error: null,

            fetchMenu: async (force = false) => {
                const state = get();

                // Check if cache is still valid
                if (!force && state.lastFetched) {
                    const cacheAge = Date.now() - state.lastFetched;
                    if (cacheAge < CACHE_DURATION && state.foods.length > 0) {
                        console.log('📦 Using cached menu data');
                        return;
                    }
                }

                // Fetch fresh data
                set({ isLoading: true, error: null });

                try {
                    console.log('🔄 Fetching fresh menu data...');
                    const [categoriesRes, foodsRes] = await Promise.all([
                        api.get<CategoryItem[]>('/foods/categories'),
                        api.get<Food[]>('/foods/'),
                    ]);

                    set({
                        categories: categoriesRes.data,
                        foods: foodsRes.data,
                        lastFetched: Date.now(),
                        isLoading: false,
                        error: null,
                    });

                    console.log('✅ Menu cached:', {
                        categories: categoriesRes.data.length,
                        foods: foodsRes.data.length,
                    });
                } catch (err: any) {
                    console.error('Failed to fetch menu:', err);
                    set({
                        error: 'Không thể tải thực đơn. Vui lòng thử lại.',
                        isLoading: false,
                    });
                }
            },

            clearCache: () => {
                set({
                    categories: [],
                    foods: [],
                    lastFetched: null,
                    error: null,
                });
                console.log('🗑️ Menu cache cleared');
            },
        }),
        {
            name: 'menu-storage',
            // Only persist categories, foods, and lastFetched
            partialize: (state) => ({
                categories: state.categories,
                foods: state.foods,
                lastFetched: state.lastFetched,
            }),
        }
    )
);
