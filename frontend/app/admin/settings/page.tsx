'use client';

import React from 'react';
import {
    Bell,
    Palette,
    Database,
    Shield
} from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="space-y-6 max-w-2xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-text-primary">Cài đặt</h1>
                <p className="text-text-muted">Quản lý cấu hình hệ thống</p>
            </div>

            {/* Settings Sections */}
            <div className="space-y-4">
                {/* Notifications */}
                <div className="bg-dark-card rounded-2xl border border-dark-border p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Bell className="text-blue-400" size={20} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-text-primary">Thông báo</h2>
                            <p className="text-sm text-text-muted">Cài đặt âm thanh và thông báo</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-text-secondary">Âm báo đơn mới</span>
                            <input
                                type="checkbox"
                                defaultChecked
                                className="w-5 h-5 rounded accent-primary-500"
                            />
                        </label>
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-text-secondary">Thông báo trình duyệt</span>
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded accent-primary-500"
                            />
                        </label>
                    </div>
                </div>

                {/* Appearance */}
                <div className="bg-dark-card rounded-2xl border border-dark-border p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Palette className="text-purple-400" size={20} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-text-primary">Giao diện</h2>
                            <p className="text-sm text-text-muted">Tùy chỉnh hiển thị</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-text-secondary">Chế độ tối</span>
                            <input
                                type="checkbox"
                                defaultChecked
                                className="w-5 h-5 rounded accent-primary-500"
                            />
                        </label>
                    </div>
                </div>

                {/* System */}
                <div className="bg-dark-card rounded-2xl border border-dark-border p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <Database className="text-green-400" size={20} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-text-primary">Hệ thống</h2>
                            <p className="text-sm text-text-muted">Thông tin và bảo trì</p>
                        </div>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-text-muted">Phiên bản</span>
                            <span className="text-text-secondary">1.0.0</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">API</span>
                            <span className="text-green-400">Hoạt động</span>
                        </div>
                    </div>
                </div>

                {/* Security */}
                <div className="bg-dark-card rounded-2xl border border-dark-border p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <Shield className="text-red-400" size={20} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-text-primary">Bảo mật</h2>
                            <p className="text-sm text-text-muted">Quản lý truy cập</p>
                        </div>
                    </div>
                    <button className="w-full py-2 bg-red-500/10 text-red-400 rounded-xl font-medium hover:bg-red-500/20 transition-colors">
                        Đổi mật khẩu
                    </button>
                </div>
            </div>
        </div>
    );
}
