import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ErrorDebugPanel } from '@/components/ErrorDebugPanel';
import { SocketProvider } from '@/components/providers/SocketProvider';

export const metadata: Metadata = {
    title: 'Đặt món - Contactless Order',
    description: 'Đặt món nhanh chóng, không cần chờ đợi',
    keywords: ['restaurant', 'order', 'food', 'contactless', 'vietnamese'],
    authors: [{ name: 'Contactless Order Service' }],
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#1A1A2E',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="vi" suppressHydrationWarning>
            <body className="bg-dark-bg text-text-primary min-h-screen antialiased" suppressHydrationWarning>
                <SocketProvider>
                    <main className="min-h-screen flex flex-col">{children}</main>
                    <ErrorDebugPanel position="bottom-left" devOnly={true} />
                </SocketProvider>
            </body>
        </html>
    );
}
