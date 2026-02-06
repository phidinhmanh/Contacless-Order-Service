
import { act } from '@testing-library/react';
import { useCartStore } from '@/store/cartStore';

// Mock persist middleware to avoid localStorage issues in tests
jest.mock('zustand/middleware', () => ({
    persist: (config: any) => (set: any, get: any, api: any) => config(set, get, api),
}));

describe('Cart State Management', () => {
    const initialStore = useCartStore.getState();

    beforeEach(() => {
        useCartStore.setState(initialStore, true);
    });

    test('Adding item updates cart count and total', () => {
        const foodItem = {
            id: '1',
            name: 'Ốc Hương',
            price: 120000,
            description: 'Test',
            image_url: 'test.jpg',
            category_id: '1',
            is_available: true,
            stock_quantity: 10,
            created_at: new Date(),
            updated_at: new Date()
        };

        act(() => {
            useCartStore.getState().addItem(foodItem as any);
        });

        expect(useCartStore.getState().items).toHaveLength(1);
        expect(useCartStore.getState().getTotal()).toBe(120000);
        expect(useCartStore.getState().getItemCount()).toBe(1);
    });

    test('Updating quantity updates total correctly', () => {
        const foodItem = {
            id: '1',
            name: 'Ốc Hương',
            price: 120000,
            description: 'Test',
            image_url: 'test.jpg',
            category_id: '1',
            is_available: true,
            stock_quantity: 10,
            created_at: new Date(),
            updated_at: new Date()
        };

        act(() => {
            useCartStore.getState().addItem(foodItem as any);
            useCartStore.getState().updateQuantity('1', 2);
        });

        expect(useCartStore.getState().getItemQuantity('1')).toBe(2);
        expect(useCartStore.getState().getTotal()).toBe(240000);
    });

    test('Cart clearing works', () => {
        const foodItem = {
            id: '1',
            name: 'Ốc Hương',
            price: 120000,
            description: 'Test',
            image_url: 'test.jpg',
            category_id: '1',
            is_available: true,
            stock_quantity: 10,
            created_at: new Date(),
            updated_at: new Date()
        };

        act(() => {
            useCartStore.getState().addItem(foodItem as any);
            useCartStore.getState().clearCart();
        });

        expect(useCartStore.getState().items).toHaveLength(0);
        expect(useCartStore.getState().getTotal()).toBe(0);
    });
});
