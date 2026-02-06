'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    ClipboardList,
    BarChart3,
    UtensilsCrossed,
    Settings,
    Menu,
    X,
    LogOut,
    Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useAdminAudio } from '@/hooks/useAdminAudio';

const navItems = [
    { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
    { href: '/admin/orders', label: 'Đơn hàng', icon: ClipboardList },
    { href: '/admin/foods', label: 'Quản lý món', icon: Package },
    { href: '/admin/analytics', label: 'Thống kê', icon: BarChart3 },
    { href: '/admin/tables', label: 'Quản lý bàn', icon: UtensilsCrossed },
    { href: '/admin/settings', label: 'Cài đặt', icon: Settings },
];

const ADMIN_TOKEN_KEY = 'admin_access_token';
const ADMIN_USER_KEY = 'admin_user';

interface AdminUser {
    id: number;
    full_name: string;
    role: string;
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState<AdminUser | null>(null);
    const [isChecking, setIsChecking] = useState(true);

    // Initialize audio notifications
    useAdminAudio();

    // Skip auth check for login page
    const isLoginPage = pathname === '/admin/login';

    useEffect(() => {
        if (isLoginPage) {
            setIsChecking(false);
            return;
        }

        const token = localStorage.getItem(ADMIN_TOKEN_KEY);
        const savedUser = localStorage.getItem(ADMIN_USER_KEY);

        if (!token || !savedUser) {
            router.replace('/admin/login');
            return;
        }

        try {
            const parsedUser = JSON.parse(savedUser);
            if (!['manager', 'admin'].includes(parsedUser.role)) {
                router.replace('/admin/login');
                return;
            }
            setUser(parsedUser);
        } catch {
            router.replace('/admin/login');
            return;
        }

        setIsChecking(false);
    }, [pathname, router, isLoginPage]);

    const handleLogout = () => {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(ADMIN_USER_KEY);
        router.replace('/admin/login');
    };

    // For login page, render without layout
    if (isLoginPage) {
        return <>{children}</>;
    }

    // Show loading while checking auth
    if (isChecking) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
        );
    }

    // If no user after check, don't render (redirect happening)
    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-dark-bg flex">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                'fixed lg:static inset-y-0 left-0 z-50 no-print',
                'w-64 bg-dark-card border-r border-dark-border',
                'transform transition-transform duration-200 ease-in-out',
                'lg:translate-x-0',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}>
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-dark-border">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                            <UtensilsCrossed size={18} className="text-white" />
                        </div>
                        <span className="font-bold text-text-primary">Quản lý</span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 text-text-muted hover:text-text-primary"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href !== '/admin' && pathname.startsWith(item.href));
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                                    'transition-all duration-200',
                                    isActive
                                        ? 'bg-primary-500/10 text-primary-400 font-medium'
                                        : 'text-text-secondary hover:bg-dark-border/50 hover:text-text-primary'
                                )}
                            >
                                <Icon size={20} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-dark-border">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-muted hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                        <LogOut size={20} />
                        Đăng xuất
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top bar */}
                <header className="h-16 flex items-center justify-between px-4 border-b border-dark-border bg-dark-card/50 backdrop-blur-md sticky top-0 z-30 no-print">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden p-2 text-text-muted hover:text-text-primary"
                    >
                        <Menu size={24} />
                    </button>

                    <div className="flex-1 lg:flex-none" />

                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-sm font-medium text-text-primary">{user.full_name}</p>
                            <p className="text-xs text-text-muted capitalize">{user.role}</p>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold">
                            {user.full_name?.charAt(0) || 'A'}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-4 lg:p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
