
import { test, expect } from '@playwright/test';

test.describe('E2E: Complete Order Flow', () => {
    test('Guest scans QR → Orders → Pays with VietQR', async ({ page }) => {
        // 1. Scan QR code (simulate by navigating to table URL)
        await page.goto('/table/1');

        // 2. Select guest count (if lead guest modal appears)
        // Assuming implementation has guest count selection
        const guestSelect = page.locator('[data-testid="guest-count-2"]');
        if (await guestSelect.isVisible()) {
            await guestSelect.click();
        }

        // 3. Browse menu
        await expect(page.locator('.food-card')).not.toHaveCount(0); // Ensure items loaded

        // 4. Add to cart
        await page.locator('[data-testid^="add-to-cart-"]').first().click();

        // Verify cart badge
        await expect(page.locator('.cart-count')).toContainText('1');

        // 5. Checkout
        await page.getByRole('link', { name: /cart/i }).click(); // Or verify selector
        await expect(page).toHaveURL(/.*\/cart/);

        await page.getByRole('button', { name: /đặt món/i }).click();

        // 6. Wait for Order Success / Redirect
        // Assuming it redirects to order detail or payment
        await expect(page).toHaveURL(/.*\/orders\/\d+/);
        const orderId = (await page.url()).split('/').pop();

        // 7. Go to Payment
        await page.getByRole('button', { name: /thanh toán/i }).click();

        // 8. Initiate VietQR payment
        await page.getByText('Chuyển khoản ngân hàng').click();

        // 9. Wait for QR code to appear
        await expect(page.locator('img[alt="VietQR Payment Code"]')).toBeVisible();

        // 10. Simulate Webhook (API call from test runner to backend)
        // We need to bypass frontend and hit backend directly to simulate Casso
        await page.request.post(`http://localhost:8000/api/v1/payments/webhook`, {
            data: {
                // ... webhook payload matching backend expectations
                order_id: orderId,
                status: 'success'
            }
        });

        // 11. Frontend polls and detects payment
        await expect(page.getByText('Thanh toán thành công!')).toBeVisible({ timeout: 10000 });
    });
});
