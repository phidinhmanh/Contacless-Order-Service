'use client';

import React, { useState, useEffect } from 'react';
import {
    Users,
    Clock,
    CheckCircle,
    Plus,
    Edit2,
    Trash2,
    QrCode,
    Download,
    RefreshCw,
    X,
    Save,
    Loader2
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { ordersApi, tablesApi, api } from '@/lib/api';

interface Table {
    id: number;
    table_number: number;
    capacity: number;
    is_occupied: boolean;
    qr_code_path: string | null;
}

interface TableOrder {
    id: number;
    status: string;
    total_price: number;
    created_at: string;
    items: { food_name: string; quantity: number }[];
}

interface TableInfo extends Table {
    currentOrders: TableOrder[];
    totalSpend: number;
}

export default function TablesPage() {
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);

    // CRUD states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [editingTable, setEditingTable] = useState<Table | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ table_number: 1, capacity: 4 });
    const [error, setError] = useState('');

    const fetchTables = async () => {
        try {
            // Fetch tables from API
            const tablesRes = await tablesApi.list();
            const tablesData = tablesRes.data as Table[];

            // Fetch orders for status
            const ordersRes = await ordersApi.list({ limit: 200 });
            const orders = ordersRes.data as (TableOrder & { table_id: number })[];

            // Merge data
            const tableInfos: TableInfo[] = tablesData.map(table => {
                const tableOrders = orders.filter(o => o.table_id === table.id);
                const activeOrders = tableOrders.filter(o =>
                    ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
                );
                return {
                    ...table,
                    currentOrders: activeOrders,
                    totalSpend: activeOrders.reduce((sum, o) => sum + (o.total_price || 0), 0),
                };
            });

            setTables(tableInfos.sort((a, b) => a.table_number - b.table_number));
        } catch (error) {
            console.error('Failed to fetch table data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTables();
        const interval = setInterval(fetchTables, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleCreate = async () => {
        setIsSaving(true);
        setError('');
        try {
            await tablesApi.create(formData);
            setShowCreateModal(false);
            setFormData({ table_number: 1, capacity: 4 });
            fetchTables();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Không thể tạo bàn');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingTable) return;
        setIsSaving(true);
        setError('');
        try {
            await tablesApi.update(editingTable.id, {
                table_number: formData.table_number,
                capacity: formData.capacity,
            });
            setShowEditModal(false);
            setEditingTable(null);
            fetchTables();
        } catch (err: any) {
            setError(err.message || 'Không thể cập nhật bàn');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (table: Table) => {
        if (!confirm(`Bạn có chắc muốn xóa Bàn ${table.table_number}?`)) return;
        try {
            await tablesApi.delete(table.id);
            fetchTables();
        } catch (err: any) {
            alert(err.message || 'Không thể xóa bàn');
        }
    };

    const handleRegenerateQR = async (table: Table) => {
        try {
            await tablesApi.regenerateQr(table.id);
            fetchTables();
            alert('Đã tạo lại mã QR thành công!');
        } catch (err: any) {
            alert(err.message || 'Không thể tạo lại mã QR');
        }
    };

    const downloadQR = (table: Table) => {
        window.open(`${api.defaults.baseURL}/tables/${table.id}/qr`, '_blank');
    };

    const openEditModal = (table: Table) => {
        setEditingTable(table);
        setFormData({ table_number: table.table_number, capacity: table.capacity });
        setShowEditModal(true);
        setError('');
    };

    const openQRModal = (table: Table) => {
        setEditingTable(table);
        setShowQRModal(true);
    };

    const getStatusColor = (occupied: boolean) => {
        return occupied
            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
            : 'bg-green-500/20 border-green-500/50 text-green-400';
    };

    const occupiedCount = tables.filter(t => t.is_occupied || t.currentOrders.length > 0).length;
    const availableCount = tables.length - occupiedCount;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Quản lý bàn</h1>
                    <p className="text-text-muted">
                        {tables.length} bàn • {occupiedCount} đang phục vụ • {availableCount} trống
                    </p>
                </div>
                <button
                    onClick={() => {
                        setFormData({ table_number: tables.length + 1, capacity: 4 });
                        setShowCreateModal(true);
                        setError('');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
                >
                    <Plus size={18} />
                    Thêm bàn mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-dark-card rounded-xl p-4 border border-dark-border flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="text-green-400" size={24} />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text-primary">{availableCount}</p>
                        <p className="text-sm text-text-muted">Bàn trống</p>
                    </div>
                </div>
                <div className="bg-dark-card rounded-xl p-4 border border-dark-border flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                        <Users className="text-orange-400" size={24} />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text-primary">{occupiedCount}</p>
                        <p className="text-sm text-text-muted">Đang phục vụ</p>
                    </div>
                </div>
                <div className="bg-dark-card rounded-xl p-4 border border-dark-border flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
                        <Clock className="text-primary-400" size={24} />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text-primary">
                            {tables.reduce((sum, t) => sum + t.currentOrders.length, 0)}
                        </p>
                        <p className="text-sm text-text-muted">Đơn đang xử lý</p>
                    </div>
                </div>
            </div>

            {/* Table List */}
            <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-dark-border/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Số bàn</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Sức chứa</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Trạng thái</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Đơn hiện tại</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Mã QR</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-text-muted">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border">
                        {tables.map((table) => (
                            <tr key={table.id} className="hover:bg-dark-border/30">
                                <td className="px-4 py-3">
                                    <span className="text-lg font-bold text-text-primary">
                                        Bàn {table.table_number}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-text-secondary">
                                    {table.capacity} chỗ
                                </td>
                                <td className="px-4 py-3">
                                    <span className={cn(
                                        'px-2 py-1 rounded-full text-xs font-medium',
                                        getStatusColor(table.currentOrders.length > 0)
                                    )}>
                                        {table.currentOrders.length > 0 ? 'Đang phục vụ' : 'Trống'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-text-secondary">
                                    {table.currentOrders.length > 0 ? (
                                        <span className="text-primary-400">
                                            {table.currentOrders.length} đơn ({formatPrice(table.totalSpend)})
                                        </span>
                                    ) : (
                                        <span className="text-text-muted">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => openQRModal(table)}
                                        className="flex items-center gap-1 text-primary-400 hover:text-primary-300"
                                    >
                                        <QrCode size={16} />
                                        Xem QR
                                    </button>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => openEditModal(table)}
                                            className="p-2 text-text-muted hover:text-primary-400 hover:bg-dark-border rounded-lg transition-colors"
                                            title="Chỉnh sửa"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => downloadQR(table)}
                                            className="p-2 text-text-muted hover:text-green-400 hover:bg-dark-border rounded-lg transition-colors"
                                            title="Tải QR"
                                        >
                                            <Download size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(table)}
                                            className="p-2 text-text-muted hover:text-red-400 hover:bg-dark-border rounded-lg transition-colors"
                                            title="Xóa"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {tables.length === 0 && (
                    <div className="text-center py-12 text-text-muted">
                        Chưa có bàn nào. Nhấn "Thêm bàn mới" để tạo.
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-dark-card rounded-2xl border border-dark-border w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-dark-border flex items-center justify-between">
                            <h2 className="text-xl font-bold text-text-primary">Thêm bàn mới</h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-1 text-text-muted hover:text-text-primary">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Số bàn</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.table_number}
                                    onChange={e => setFormData({ ...formData, table_number: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 bg-dark-border rounded-xl text-text-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Sức chứa (số chỗ)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={formData.capacity}
                                    onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 bg-dark-border rounded-xl text-text-primary"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-dark-border flex gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 py-2 bg-dark-border rounded-xl text-text-secondary hover:text-text-primary"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={isSaving}
                                className="flex-1 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Tạo bàn
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingTable && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
                    <div className="bg-dark-card rounded-2xl border border-dark-border w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-dark-border flex items-center justify-between">
                            <h2 className="text-xl font-bold text-text-primary">Chỉnh sửa Bàn {editingTable.table_number}</h2>
                            <button onClick={() => setShowEditModal(false)} className="p-1 text-text-muted hover:text-text-primary">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Số bàn</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.table_number}
                                    onChange={e => setFormData({ ...formData, table_number: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 bg-dark-border rounded-xl text-text-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Sức chứa (số chỗ)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={formData.capacity}
                                    onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 bg-dark-border rounded-xl text-text-primary"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-dark-border flex gap-3">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 py-2 bg-dark-border rounded-xl text-text-secondary hover:text-text-primary"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleUpdate}
                                disabled={isSaving}
                                className="flex-1 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Lưu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {showQRModal && editingTable && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQRModal(false)}>
                    <div className="bg-dark-card rounded-2xl border border-dark-border w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-dark-border flex items-center justify-between">
                            <h2 className="text-xl font-bold text-text-primary">QR Code - Bàn {editingTable.table_number}</h2>
                            <button onClick={() => setShowQRModal(false)} className="p-1 text-text-muted hover:text-text-primary">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col items-center">
                            <div className="bg-white p-4 rounded-xl mb-4">
                                <img
                                    src={`${api.defaults.baseURL}/tables/${editingTable.id}/qr`}
                                    alt={`QR Code for Table ${editingTable.table_number}`}
                                    className="w-48 h-48"
                                />
                            </div>
                            <p className="text-text-muted text-sm text-center mb-4">
                                Khách hàng quét mã để đặt món cho Bàn {editingTable.table_number}
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => handleRegenerateQR(editingTable)}
                                    className="flex-1 py-2 bg-dark-border rounded-xl text-text-secondary hover:text-text-primary flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={16} />
                                    Tạo lại
                                </button>
                                <button
                                    onClick={() => downloadQR(editingTable)}
                                    className="flex-1 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 flex items-center justify-center gap-2"
                                >
                                    <Download size={16} />
                                    Tải xuống
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
