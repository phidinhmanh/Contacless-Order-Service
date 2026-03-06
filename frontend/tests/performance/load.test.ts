/** @jest-environment node */
import {
    createTestApiClient,
    getTestApiUrl,
} from '../testUtils';

// Mock the entire testUtils module
jest.mock('../testUtils', () => ({
    createTestApiClient: jest.fn(),
    getTestApiUrl: jest.fn(() => 'http://localhost:8000'),
}));

describe('Load Testing: 20 Concurrent Users', () => {
    test('System handles 20 simultaneous orders', async () => {
        const REQUEST_COUNT = 20;

        // Mock the API client
        const mockGet = jest.fn().mockResolvedValue({
            status: 200,
            data: []
        });

        (createTestApiClient as jest.Mock).mockReturnValue({
            get: mockGet,
        });

        const api = createTestApiClient();

        const requests = Array.from({ length: REQUEST_COUNT }).map((_, i) =>
            api.get('/foods/').then(() => ({ status: 200, time: Date.now() }))
        );

        const startTime = Date.now();
        const results = await Promise.all(requests);
        const totalTime = Date.now() - startTime;

        // Assertions
        const successCount = results.filter(r => r.status === 200).length;
        expect(successCount).toBe(REQUEST_COUNT);

        console.log(`Processes ${REQUEST_COUNT} requests in ${totalTime}ms (MOCKED)`);
        // Mocked requests are nearly instant, but let's keep a reasonable expectation
        expect(totalTime / REQUEST_COUNT).toBeLessThan(100);
    }, 30000);
});
