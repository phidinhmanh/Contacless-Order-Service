import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { isApiError } from '@/lib/api';
import type { Food } from '@/lib/types';

// Categories can be strings or objects from API
type CategoryItem = string | { id?: string; name?: string;[key: string]: unknown };

interface MenuState {
    categories: CategoryItem[];
    foods: Food[];
    lastFetched: number | null;
    isLoading: boolean;
    error: string | null;
    retryCount: number;

    // Actions
    fetchMenu: (force?: boolean) => Promise<void>;
    clearCache: () => void;
    clearError: () => void;
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
// Maximum retry attempts for API failures
const MAX_RETRY_COUNT = 3;

export const useMenuStore = create<MenuState>()(
    persist(
        (set, get) => ({
            categories: [],
            foods: [],
            lastFetched: null,
            isLoading: false,
            error: null,
            retryCount: 0,

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
                        api.get<CategoryItem[]>('/categories'),
                        api.get<Food[]>('/foods'),
                    ]);

                    set({
                        categories: categoriesRes.data,
                        foods: foodsRes.data,
                        lastFetched: Date.now(),
                        isLoading: false,
                        error: null,
                        retryCount: 0,
                    });

                    console.log('✅ Menu cached:', {
                        categories: categoriesRes.data.length,
                        foods: foodsRes.data.length,
                    });
                } catch (err: any) {
                    const currentRetry = state.retryCount;
                    const errorStatus = err?.status || err?.response?.status || null;
                    const errorMessage = err?.message || 'Unknown error';

                    console.error('❌ Failed to fetch menu:', {
                        error: err,
                        status: errorStatus,
                        message: errorMessage,
                        retryCount: currentRetry,
                    });

                    // Check if should retry (only for network errors or 5xx server errors)
                    const isRetryable = !errorStatus || (errorStatus >= 500 || errorStatus === 0);

                    if (isRetryable && currentRetry < MAX_RETRY_COUNT) {
                        console.log(`🔄 Retrying menu fetch (attempt ${currentRetry + 1}/${MAX_RETRY_COUNT})...`);
                        set({ retryCount: currentRetry + 1 });

                        // Retry after delay
                        await new Promise(resolve => setTimeout(resolve, 1000 * (currentRetry + 1)));

                        // Recursive retry
                        return get().fetchMenu(force);
                    }

                    // Handle auth errors specifically
                    if (errorStatus === 401) {
                        console.warn('🔐 Menu fetch failed due to auth error (401)');
                        set({
                            error: 'Vui lòng đăng nhập lại để xem thực đơn',
                            isLoading: false,
                        });
                    } else {
                        set({
                            error: 'Không thể tải thực đơn. Vui lòng thử lại.',
                            isLoading: false,
                        });
                    }
                }
            },

            clearCache: () => {
                set({
                    categories: [],
                    foods: [],
                    lastFetched: null,
                    error: null,
                    retryCount: 0,
                });
                console.log('🗑️ Menu cache cleared');
            },

            clearError: () => {
                set({ error: null });
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
