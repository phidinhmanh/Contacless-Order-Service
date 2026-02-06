
import { test, expect } from '@playwright/test';

test.describe('Offline Behavior', () => {
    test('Shows error when creating order offline', async ({ page, context }) => {
        await page.goto('/table/1');

        // Add to cart
        await page.locator('[data-testid^="add-to-cart-"]').first().click();
        await page.goto('/cart');

        // Go offline
        await context.setOffline(true);

        // Try to create order
        await page.getByRole('button', { name: /đặt món/i }).click();

        // Should show network error
        // Assuming UI has a toast or error message for network failure
        await expect(page.getByText(/internet|kết nối/i)).toBeVisible();
    });

    test('Cart persists when offline', async ({ page, context }) => {
        await page.goto('/table/1');
        await page.locator('[data-testid^="add-to-cart-"]').first().click();

        // Go offline
        await context.setOffline(true);

        // Reload page
        await page.reload();

        // Cart should still be there (localStorage check)
        await expect(page.locator('.cart-count')).toHaveText('1');
    });
});
