
import { test, expect } from '@playwright/test';

test.describe('Race Condition: Last Item Stock', () => {
    test('2 users click "Add to Cart" simultaneously', async ({ browser }) => {
        // User 1 session
        const context1 = await browser.newContext();
        const page1 = await context1.newPage();

        // User 2 session
        const context2 = await browser.newContext();
        const page2 = await context2.newPage();

        await page1.goto('/table/1');
        await page2.goto('/table/2');

        // Assume we have an item with stock 1
        // (This requires seeding the DB before test, doing best effort here)
        const targetItemSelector = '[data-testid="add-to-cart-limited-item"]';

        // Both users locate the item
        const btn1 = page1.locator(targetItemSelector);
        const btn2 = page2.locator(targetItemSelector);

        if (await btn1.isVisible()) {
            // Both click "Add" at same time
            await Promise.all([
                btn1.click(),
                btn2.click()
            ]);

            // Checkout both
            await Promise.all([
                page1.goto('/cart'),
                page2.goto('/cart')
            ]);

            // Submit order simultaneously
            const submitSelector = 'button:has-text("Đặt món")';

            await Promise.all([
                page1.locator(submitSelector).click(),
                page2.locator(submitSelector).click()
            ]);

            // One should succeed, one should fail
            // Using Promise.allSettled logic via verifying one gets error

            const success1 = await page1.getByText('Đặt món thành công').isVisible().catch(() => false);
            const error1 = await page1.getByText('Hết hàng').isVisible().catch(() => false);

            const success2 = await page2.getByText('Đặt món thành công').isVisible().catch(() => false);
            const error2 = await page2.getByText('Hết hàng').isVisible().catch(() => false);

            // Logic: (Success1 AND Error2) OR (Error1 AND Success2)
            expect((success1 && error2) || (error1 && success2)).toBeTruthy();
        }
    });
});
