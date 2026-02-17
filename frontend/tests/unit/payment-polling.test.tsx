import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaymentSelectionPage from '@/app/payment/page';
import api from '@/lib/api';

// 1. Mock Next Navigation
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(() => ({
        push: jest.fn(),
        back: jest.fn(),
        prefetch: jest.fn(),
        replace: jest.fn()
    })),
    useSearchParams: jest.fn(() => ({
        get: jest.fn((key: string) => (key === 'order_id' ? '123' : null))
    })),
}));

// 2. Mock framer-motion
jest.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => React.createElement('div', props, children),
        header: ({ children, ...props }: any) => React.createElement('header', props, children),
        main: ({ children, ...props }: any) => React.createElement('main', props, children),
        span: ({ children, ...props }: any) => React.createElement('span', props, children),
    },
    AnimatePresence: ({ children }: any) => children,
}));

// 3. Mock API instance
jest.mock('@/lib/api', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }
    }
}));

describe('VietQR Payment Polling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Setup default successful order load
        (api.get as jest.Mock).mockImplementation((url) => {
            if (url.includes('/orders/')) {
                return Promise.resolve({ data: { id: 123, total_amount: 50000, status: 'pending' } });
            }
            return Promise.resolve({ data: { status: 'pending' } });
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test('Full Payment Flow: Initial Load -> Click -> Success', async () => {
        const pushMock = jest.fn();
        const { useRouter } = require('next/navigation');
        const mockRouterReturn = { push: pushMock, back: jest.fn(), prefetch: jest.fn(), replace: jest.fn() };
        (useRouter as jest.Mock).mockReturnValue(mockRouterReturn);

        let pollCount = 0;
        // Hardened Mock for all GET requests
        (api.get as jest.Mock).mockImplementation((url: string) => {
            if (url.includes('/orders/')) {
                return Promise.resolve({ data: { id: 123, total_amount: 50000, status: 'pending' } });
            }
            if (url.includes('/payments/')) {
                pollCount++;
                // 1st: mount/initiate, 2nd: poll 1 (pending), 3rd: poll 2 (completed)
                const status = pollCount >= 3 ? 'completed' : 'pending';
                return Promise.resolve({ data: { status } });
            }
            return Promise.resolve({ data: {} });
        });

        // Mock initiate payment to return the same pending status initialy
        (api.post as jest.Mock).mockResolvedValue({
            data: {
                id: 999,
                qr_url: 'test-qr',
                amount: 50000,
                bank_id: 'ICB',
                account_no: '123',
                account_name: 'TEST',
                transfer_content: 'TEST'
            }
        });

        await act(async () => {
            render(<PaymentSelectionPage />);
        });

        // 1. Wait for loading to clear
        await waitFor(() => {
            expect(screen.queryByText(/Không thể tải thông tin đơn hàng/i)).toBeNull();
        }, { timeout: 8000 });

        // 2. Verify Order Amount is visible
        await screen.findByText(/50.000/);

        // 3. Click pay
        const payBtn = screen.getByText(/Quét mã QR/i);
        await act(async () => {
            fireEvent.click(payBtn);
        });

        // 4. Verify Modal appeared
        await screen.findByText(/Quét mã QR để thanh toán/i, {}, { timeout: 3000 });

        // 5. Trigger First Poll (still pending)
        await act(async () => {
            jest.advanceTimersByTime(2000);
            await Promise.resolve(); // flush microtasks
        });

        // 6. Trigger Second Poll (completed)
        await act(async () => {
            jest.advanceTimersByTime(2000);
            await Promise.resolve();
        });

        // 7. Verify Success UI appears
        await screen.findByText(/Thanh toán thành công/i, {}, { timeout: 5000 });

        // 8. Polling should stop after success
        const finalPollCount = pollCount;
        await act(async () => {
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
        });
        expect(pollCount).toBe(finalPollCount);

        // 9. Jump for redirect delay (2 seconds in code)
        await act(async () => {
            jest.advanceTimersByTime(3000);
            await Promise.resolve();
        });

        expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('status=success'));
    }, 25000);
});
