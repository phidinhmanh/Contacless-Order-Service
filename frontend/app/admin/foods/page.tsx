'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    Package,
    Check,
    X,
    Loader2,
    Upload,
    ImageIcon
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { foodsApi, categoriesApi } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Category {
    id: number;
    name: string;
    description?: string;
    display_order: number;
    is_active: boolean;
}

interface Food {
    id: number;
    name: string;
    price: number;
    category_id: number | null;
    stock_quantity: number | null;
    is_available: boolean;
    is_out_of_stock: boolean;
    description?: string;
    image_url?: string;
}

interface FoodFormData {
    name: string;
    price: number;
    category_id: number | null;
    stock_quantity: number;
    description?: string;
}

export default function FoodManagementPage() {
    const [foods, setFoods] = useState<Food[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | ''>('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingFood, setEditingFood] = useState<Food | null>(null);
    const [formData, setFormData] = useState<FoodFormData>({
        name: '',
        price: 0,
        category_id: null,
        stock_quantity: 0,
        description: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    // Delete confirmation
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Image upload
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();
    }, [selectedCategory]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const params: Record<string, string> = { include_unavailable: 'true' };
            if (selectedCategory !== '') params.category_id = String(selectedCategory);

            const [foodsData, categoriesData] = await Promise.all([
                foodsApi.list(params),
                categoriesApi.list()
            ]);
            setFoods(foodsData);
            setCategories(categoriesData);
        } catch (err: any) {
            setError(err.message || 'Không thể tải dữ liệu');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredFoods = foods.filter(food =>
        food.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getCategoryName = (categoryId: number | null): string => {
        if (!categoryId) return 'Chưa phân loại';
        const cat = categories.find(c => c.id === categoryId);
        return cat?.name || 'Không xác định';
    };

    const openCreateModal = () => {
        setEditingFood(null);
        setFormData({ name: '', price: 0, category_id: null, stock_quantity: 0, description: '' });
        setShowModal(true);
    };

    const openEditModal = (food: Food) => {
        setEditingFood(food);
        setFormData({
            name: food.name,
            price: food.price,
            category_id: food.category_id,
            stock_quantity: food.stock_quantity || 0,
            description: food.description || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            if (editingFood) {
                await foodsApi.update(editingFood.id, formData);
            } else {
                await foodsApi.create(formData);
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Lỗi khi lưu món ăn');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await foodsApi.delete(id);
            setDeletingId(null);
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Lỗi khi xóa món ăn');
        }
    };

    const handleStockUpdate = async (id: number, stock_quantity: number) => {
        try {
            await foodsApi.updateStock(id, stock_quantity);
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Lỗi khi cập nhật tồn kho');
        }
    };

    const toggleAvailability = async (food: Food) => {
        try {
            await foodsApi.toggleAvailability(food.id, !food.is_available);
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Lỗi khi cập nhật trạng thái');
        }
    };

    const handleImageUpload = async (foodId: number, file: File) => {
        setUploadingId(foodId);
        try {
            await foodsApi.uploadImage(foodId, file);
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Lỗi khi tải ảnh lên');
        } finally {
            setUploadingId(null);
        }
    };

    const triggerImageUpload = (foodId: number) => {
        setUploadingId(foodId);
        fileInputRef.current?.click();
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && uploadingId) {
            handleImageUpload(uploadingId, file);
        }
        e.target.value = ''; // Reset input
    };

    const getImageUrl = (imageUrl: string | undefined) => {
        if (!imageUrl) return null;
        if (imageUrl.startsWith('http')) return imageUrl;
        return `${API_BASE_URL}${imageUrl}`;
    };

    return (
        <div className="space-y-6">
            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={onFileChange}
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Quản lý món ăn</h1>
                    <p className="text-text-secondary mt-1">Thêm, sửa, xóa và quản lý tồn kho món ăn</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors"
                >
                    <Plus size={20} />
                    Thêm món mới
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm món ăn..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-dark-card border border-dark-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-500"
                    />
                </div>
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value === '' ? '' : Number(e.target.value))}
                    className="px-4 py-2.5 bg-dark-card border border-dark-border rounded-xl text-text-primary focus:outline-none focus:border-primary-500"
                >
                    <option value="">Tất cả danh mục</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
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
                ) : filteredFoods.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                        <Package size={48} className="mb-4 opacity-50" />
                        <p>Không tìm thấy món ăn nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-border/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-text-secondary font-medium">Hình ảnh</th>
                                    <th className="text-left px-4 py-3 text-text-secondary font-medium">Tên món</th>
                                    <th className="text-left px-4 py-3 text-text-secondary font-medium">Danh mục</th>
                                    <th className="text-right px-4 py-3 text-text-secondary font-medium">Giá</th>
                                    <th className="text-center px-4 py-3 text-text-secondary font-medium">Tồn kho</th>
                                    <th className="text-center px-4 py-3 text-text-secondary font-medium">Trạng thái</th>
                                    <th className="text-center px-4 py-3 text-text-secondary font-medium">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {filteredFoods.map(food => (
                                    <tr key={food.id} className="hover:bg-dark-border/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div
                                                onClick={() => triggerImageUpload(food.id)}
                                                className="w-14 h-14 rounded-lg overflow-hidden bg-dark-border cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all relative group"
                                            >
                                                {uploadingId === food.id ? (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Loader2 size={20} className="animate-spin text-primary-500" />
                                                    </div>
                                                ) : food.image_url ? (
                                                    <>
                                                        <img
                                                            src={getImageUrl(food.image_url) || ''}
                                                            alt={food.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Upload size={18} className="text-white" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-text-muted group-hover:text-primary-400 transition-colors">
                                                        <ImageIcon size={24} />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-text-primary">{food.name}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 bg-primary-500/10 text-primary-400 rounded-lg text-sm">
                                                {getCategoryName(food.category_id)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-text-primary">
                                            {formatPrice(food.price)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={food.stock_quantity ?? 0}
                                                    onChange={(e) => handleStockUpdate(food.id, parseInt(e.target.value) || 0)}
                                                    className="w-20 px-2 py-1 bg-dark-bg border border-dark-border rounded-lg text-center text-text-primary focus:outline-none focus:border-primary-500"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-center">
                                                <button
                                                    onClick={() => toggleAvailability(food)}
                                                    className={cn(
                                                        'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                                                        food.is_available
                                                            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                                    )}
                                                >
                                                    {food.is_available ? 'Còn hàng' : 'Hết hàng'}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(food)}
                                                    className="p-2 text-text-muted hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                                                    title="Sửa"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                {deletingId === food.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDelete(food.id)}
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
                                                        onClick={() => setDeletingId(food.id)}
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
                                {editingFood ? 'Sửa món ăn' : 'Thêm món mới'}
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
                                    Tên món *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-text-primary focus:outline-none focus:border-primary-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Giá (VND) *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-text-primary focus:outline-none focus:border-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Số lượng
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.stock_quantity}
                                        onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-text-primary focus:outline-none focus:border-primary-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">
                                    Danh mục
                                </label>
                                <select
                                    value={formData.category_id ?? ''}
                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value === '' ? null : Number(e.target.value) })}
                                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-text-primary focus:outline-none focus:border-primary-500"
                                >
                                    <option value="">Chọn danh mục</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
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
                            {editingFood && (
                                <div className="text-sm text-text-muted">
                                    💡 Để tải ảnh, nhấp vào ô hình ảnh trong bảng danh sách món ăn
                                </div>
                            )}
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
                                    {editingFood ? 'Cập nhật' : 'Thêm món'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
