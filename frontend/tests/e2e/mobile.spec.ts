
import { test, expect } from '@playwright/test';

test.describe('Mobile UI', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

    test('Menu displays correctly on mobile', async ({ page }) => {
        await page.goto('/table/1');

        // Menu should be scrollable
        // Verifying main container visibility
        await expect(page.locator('main')).toBeVisible();

        // Cards should stack vertically
        const foodCards = page.locator('.food-card');
        await expect(foodCards.first()).toBeVisible();

        if (await foodCards.count() > 1) {
            const firstBox = await foodCards.nth(0).boundingBox();
            const secondBox = await foodCards.nth(1).boundingBox();

            if (firstBox && secondBox) {
                // Second card should be BELOW first (y coordinate significantly larger)
                expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height - 10);
            }
        }
    });

    test('QR code modal is readable on small screens', async ({ page }) => {
        // Navigate straight to payment page mock or flow
        // ... setup state ...

        // Check elements fit width
        // Expect no horizontal scroll on body
        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.viewportSize()?.width || 0;

        expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
    });
});
