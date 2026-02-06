/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        // Since we are using rewrites, Next.js sees the image as "local" 
        // to its own domain, so remotePatterns are technically for external URLs.
        // However, keeping localhost here is a good safety measure.
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '8000',
                pathname: '/static/**',
            },
        ],
    },
    async rewrites() {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
        return [
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
};

module.exports = nextConfig;