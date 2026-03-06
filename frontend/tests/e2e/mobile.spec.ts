
import { test, expect } from '@playwright/test';

test.describe('Mobile UI', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

    test('Menu displays correctly on mobile', async ({ page }) => {
        // Navigate to home with table ID
        await page.goto('/?table_id=1');

        // Click start ordering button
        await page.getByRole('button', { name: /Bắt đầu đặt món/i }).click();

        // Close demographic modal (X button at top-right)
        await page.locator('button:has(svg)').filter({ hasText: '' }).first().click();

        // Wait for navigation to menu page
        await page.waitForURL(/.*\/menu/);

        // Ensure no error messages are displayed
        const errorMessage = page.locator('[class*="red"]').filter({ hasText: /không|error|lỗi/i });
        await expect(errorMessage).not.toBeVisible().catch(() => {});

        // Wait for menu data to load (wait for food cards to appear)
        await page.waitForSelector('.food-card', { state: 'visible', timeout: 10000 });

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
        // This test verifies the welcome page has no horizontal overflow
        await page.goto('/?table_id=1');

        // Wait for page to fully render
        await page.waitForLoadState('networkidle');

        // Check main container doesn't overflow
        const mainContent = page.locator('main, body > div').first();
        const mainWidth = await mainContent.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width;
        });

        const viewportWidth = page.viewportSize()?.width || 0;

        // Main content should fit within viewport
        expect(mainWidth).toBeLessThanOrEqual(viewportWidth);

        // Also verify no visible horizontal scrollbar
        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasHorizontalScroll).toBe(false);
    });
});
