'use client';

import React, { useState, useEffect } from 'react';
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    Layers,
    Check,
    X,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { categoriesApi } from '@/lib/api';

interface Category {
    id: number;
    name: string;
    description?: string;
    display_order: number;
    is_active: boolean;
}

interface CategoryFormData {
    name: string;
    description: string;
    display_order: number;
    is_active: boolean;
}

export default function CategoryManagementPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Filters
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState<CategoryFormData>({
        name: '',
        description: '',
        display_order: 0,
        is_active: true
    });
    const [isSaving, setIsSaving] = useState(false);

    // Delete confirmation
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const categories = await categoriesApi.list({ include_inactive: true });
            setCategories(categories);
        } catch (err: any) {
            setError(err.message || 'Không thể tải danh sách danh mục');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.display_order - b.display_order);

    const openCreateModal = () => {
        setEditingCategory(null);
        setFormData({ name: '', description: '', display_order: categories.length, is_active: true });
        setShowModal(true);
    };

    const openEditModal = (category: Category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            description: category.description || '',
            display_order: category.display_order,
            is_active: category.is_active
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            if (editingCategory) {
                await categoriesApi.update(editingCategory.id, formData);
            } else {
                await categoriesApi.create(formData);
            }
            setShowModal(false);
            fetchCategories();
        } catch (err: any) {
            setError(err.message || 'Lỗi khi lưu danh mục');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await categoriesApi.delete(id);
            setDeletingId(null);
            fetchCategories();
        } catch (err: any) {
            setError(err.message || 'Lỗi khi xóa danh mục. Có thể danh mục này đang chứa món ăn.');
        }
    };

    const toggleStatus = async (category: Category) => {
        try {
            await categoriesApi.toggleActive(category.id, !category.is_active);
            fetchCategories();
        } catch (err: any) {
            setError(err.message || 'Lỗi khi cập nhật trạng thái');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Quản lý danh mục</h1>
                    <p className="text-text-secondary mt-1">Quản lý các nhóm món ăn trên thực đơn</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors"
                >
                    <Plus size={20} />
                    Thêm danh mục
                </button>
            </div>

            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm danh mục..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-dark-card border border-dark-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-500"
                    />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                    {error}
                    <button onClick={() => setError('')} className="ml-2 underline">Đóng</button>
                </div>
            )}

            {/* Table */}
            <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={32} className="animate-spin text-primary-500" />
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                        <Layers size={48} className="mb-4 opacity-50" />
                        <p>Chưa có danh mục nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-border/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-text-secondary font-medium w-16 text-center">STT</th>
                                    <th className="text-left px-4 py-3 text-text-secondary font-medium">Tên danh mục</th>
                                    <th className="text-left px-4 py-3 text-text-secondary font-medium">Mô tả</th>
                                    <th className="text-center px-4 py-3 text-text-secondary font-medium">Trạng thái</th>
                                    <th className="text-center px-4 py-3 text-text-secondary font-medium">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {filteredCategories.map((cat, index) => (
                                    <tr key={cat.id} className="hover:bg-dark-border/30 transition-colors">
                                        <td className="px-4 py-3 text-center text-text-secondary">
                                            {cat.display_order}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-text-primary">{cat.name}</span>
                                        </td>
                                        <td className="px-4 py-3 text-text-secondary max-w-xs truncate">
                                            {cat.description || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-center">
                                                <button
                                                    onClick={() => toggleStatus(cat)}
                                                    className={cn(
                                                        'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                                                        cat.is_active
                                                            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                                    )}
                                                >
                                                    {cat.is_active ? 'Hoạt động' : 'Tạm ẩn'}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(cat)}
                                                    className="p-2 text-text-muted hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                                                    title="Sửa"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                {deletingId === cat.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDelete(cat.id)}
                                                            className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg"
                                                            title="Xác nhận xóa"
                                                        >
                                                            <Check size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeletingId(null)}
                                                            className="p-2 text-text-muted hover:bg-dark-border rounded-lg"
                                                            title="Hủy"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeletingId(cat.id)}
                                                        className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b border-dark-border">
                            <h2 className="text-lg font-bold text-text-primary">
                                {editingCategory ? 'Sửa danh mục' : 'Thêm danh mục mới'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 text-text-muted hover:text-text-primary hover:bg-dark-border rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">
                                    Tên danh mục *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-text-primary focus:outline-none focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">
                                    Mô tả
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-text-primary focus:outline-none focus:border-primary-500 resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Thứ tự hiển thị
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.display_order}
                                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-text-primary focus:outline-none focus:border-primary-500"
                                    />
                                </div>
                                <div className="flex items-end pb-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={formData.is_active}
                                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            />
                                            <div className="w-10 h-6 bg-dark-border rounded-full peer peer-checked:bg-primary-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                                        </div>
                                        <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                                            Hoạt động
                                        </span>
                                    </label>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-dark-border text-text-secondary rounded-xl hover:bg-dark-border transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving && <Loader2 size={18} className="animate-spin" />}
                                    {editingCategory ? 'Cập nhật' : 'Lưu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
