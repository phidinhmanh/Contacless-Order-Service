
import { test, expect } from '@playwright/test';

test.describe('E2E: Complete Order Flow', () => {
    test('Guest scans QR → Orders → Pays with VietQR', async ({ page }) => {
        // 1. Scan QR code (simulate by navigating to table URL)
        await page.goto('/?table_id=1');

        // 2. Click Start Ordering button
        await page.getByRole('button', { name: /Bắt đầu đặt món/i }).click();

        // 3. Wait for demographic modal and skip it
        const closeButton = page.locator('button').filter({ has: page.locator('svg') }).first();
        await closeButton.waitFor({ state: 'visible', timeout: 5000 });
        await closeButton.click();

        // 4. Now wait for menu page
        await page.waitForURL(/.*\/menu/);

        // 5. Wait for menu items to load
        await page.waitForSelector('.food-card', { state: 'visible', timeout: 10000 });

        // Verify menu loaded successfully
        await expect(page.locator('.food-card')).not.toHaveCount(0); // Ensure items loaded

        // 6. Add to cart
        await page.locator('[data-testid^="add-to-cart-"]').first().click();

        // Verify cart badge
        await expect(page.locator('.cart-count')).toContainText('1');

        // 7. Checkout
        await page.getByRole('link', { name: /cart/i }).click();
        await expect(page).toHaveURL(/.*\/cart/);

        await page.getByRole('button', { name: /đặt món/i }).click();

        // 8. Wait for Order Success / Redirect
        await expect(page).toHaveURL(/.*\/order\/\d+/);
        const orderId = (await page.url()).split('/').pop();

        // 9. Go to Payment
        await page.getByRole('button', { name: /thanh toán/i }).click();

        // 10. Initiate VietQR payment
        await page.getByText('Chuyển khoản ngân hàng').click();

        // 11. Wait for QR code to appear
        await expect(page.locator('img[alt="VietQR Payment Code"]')).toBeVisible();

        // 12. Simulate Webhook (API call from test runner to backend)
        await page.request.post(`http://localhost:8000/api/v1/payments/webhook/casso`, {
            data: {
                // matching backend expectations for Casso payload
                data: [{
                    description: `THANH TOAN DON OC_${orderId}`,
                    amount: 1000, // Should match order total or partial
                    tid: 'test_transaction_id'
                }]
            }
        });

        // 13. Frontend polls and detects payment
        await expect(page.getByText('Thanh toán thành công!')).toBeVisible({ timeout: 15000 });
    });
});
