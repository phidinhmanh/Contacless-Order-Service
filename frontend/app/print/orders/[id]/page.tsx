'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Order } from '@/lib/types';

export default function OrderReceiptPage() {
    const params = useParams();
    const orderId = params.id as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const response = await api.get<Order>(`/orders/${orderId}`);
                setOrder(response.data);
            } catch (err: any) {
                console.error(err.messages)
                setError('Không thể tải đơn hàng');
            }
        };
        fetchOrder();
    }, [orderId]);

    // Auto-print when loaded
    useEffect(() => {
        if (order) {
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [order]);

    if (error) return <div className="p-4 text-red-500 font-mono">{error}</div>;

    if (!order) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white text-black">
                <Loader2 className="animate-spin text-black" />
            </div>
        );
    }

    const createdDate = new Date(order.created_at);

    return (
        <div id="printable-area-wrapper" className="min-h-screen bg-white text-black font-mono text-sm leading-tight p-4">
            <div className="max-w-[80mm] mx-auto print:mx-0 print:w-full bill-container">
                {/* Header */}
                <div className="text-center mb-4 border-b border-black pb-2 border-dashed">
                    <h1 className="font-bold text-lg uppercase">Nhà Hàng UET</h1>
                    <p className="text-xs">Hotline: 1900 1234</p>
                    <p className="text-xs">Đ/c: 144 Xuân Thủy, Cầu Giấy</p>
                </div>

                {/* Order Info */}
                <div className="mb-4 text-xs">
                    <div className="flex justify-between">
                        <span>Số HĐ:</span>
                        <span className="font-bold">#{order.id}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Bàn:</span>
                        <span className="font-bold">{order.table_id || 'Mang về'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Ngày:</span>
                        <span>{createdDate.toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Giờ:</span>
                        <span>{createdDate.toLocaleTimeString('vi-VN')}</span>
                    </div>
                </div>

                {/* Items Header */}
                <div className="border-b border-black mb-2 border-dashed" />

                {/* Items */}
                <div className="space-y-2 mb-4">
                    {order.items.map((item, index) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const itemData = item as any;
                        const price = itemData.unit_price || itemData.price || 0;
                        const total = price * itemData.quantity;
                        const name = itemData.food_name || itemData.name;

                        return (
                            <div key={index}>
                                <div className="font-bold">{name}</div>
                                <div className="flex justify-between text-xs">
                                    <span>{itemData.quantity} x {formatPrice(price)}</span>
                                    <span>{formatPrice(total)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="border-b border-black mb-2 border-dashed" />

                {/* Totals */}
                <div className="mb-6">
                    <div className="flex justify-between font-bold text-lg">
                        <span>TỔNG CỘNG:</span>
                        <span>{formatPrice(order.total_amount || order.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                        <span>Trạng thái:</span>
                        <span className="uppercase">{order.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-xs space-y-1">
                    <p className="font-bold">CẢM ƠN QUÝ KHÁCH!</p>
                    <p>Pass Wifi: uet123456</p>
                </div>

                {/* Hidden Print Button for explicit calling if auto-print fails */}
                <button
                    onClick={() => window.print()}
                    className="print:hidden w-full mt-6 py-2 border border-black hover:bg-black hover:text-white transition-colors uppercase text-xs"
                >
                    In hóa đơn
                </button>
            </div>
        </div>
    );
}
