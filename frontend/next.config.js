/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    async rewrites() {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
        return [
            {
                // QR Token Resolution - Domain agnostic redirect
                source: '/t/:token',
                destination: `${backendUrl}/api/v1/tables/t/:token`,
            },
            {
                // Proxy API calls
                source: '/api/:path*',
                destination: `${backendUrl}/api/:path*`,
            },
            {
                // Proxy Static files (Images)
                source: '/static/:path*',
                destination: `${backendUrl}/static/:path*`,
            },
        ];
    },
    eslint: {
        dirs: ['pages', 'utils'],
    },
};

module.exports = nextConfig;
