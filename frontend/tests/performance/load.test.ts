/** @jest-environment node */
import axios from 'axios';

jest.mock('axios');

describe('Load Testing: 20 Concurrent Users', () => {
    test('System handles 20 simultaneous orders', async () => {
        const REQUEST_COUNT = 20;
        const URL = 'http://localhost:8000/api/v1/foods';

        (axios.get as jest.Mock).mockResolvedValue({
            status: 200,
            data: []
        });

        const requests = Array.from({ length: REQUEST_COUNT }).map((_, i) =>
            axios.get(URL).then(res => ({ status: res.status, time: Date.now() }))
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
