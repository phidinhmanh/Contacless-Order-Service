'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CreditCard, X, CheckCircle, Loader2 } from 'lucide-react';
import { PaymentButton } from '@/components/PaymentButton';
import { CountdownProgress } from '@/components/CountdownTimer';
import { LoadingState } from '@/components/ui/Spinner';
import { ordersApi, paymentsApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Order, PaymentProvider, VietQRPayment } from '@/lib/types';

const PAYMENT_TIMEOUT_SECONDS = 15 * 60;
const POLL_INTERVAL_MS = 2000;

function PaymentSelectionContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get('order_id');

    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const [showQRModal, setShowQRModal] = useState(false);
    const [vietqrPayment, setVietqrPayment] = useState<VietQRPayment | null>(null);
    const [paymentConfirmed, setPaymentConfirmed] = useState(false);

    // 1. Fetch Order Info
    useEffect(() => {
        if (!orderId) {
            router.push('/menu');
            return;
        }

        const fetchOrder = async () => {
            try {
                const orderData = await ordersApi.getById(Number(orderId));
                setOrder(orderData);
            } catch (err: any) {
                setError('Không thể tải thông tin đơn hàng.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrder();
    }, [orderId, router]);

    // 2. Polling Logic for QR Payment
    useEffect(() => {
        if (!showQRModal || !vietqrPayment || paymentConfirmed) return;

        const pollPaymentStatus = async () => {
            try {
                const paymentStatus = await paymentsApi.getStatus(vietqrPayment.id);
                if (paymentStatus.status === 'completed') {
                    setPaymentConfirmed(true);
                    setTimeout(() => {
                        router.push(`/payment/status/${vietqrPayment.id}?order_id=${orderId}&status=success`);
                    }, 2000);
                }
            } catch (err) {
                // Ignore and retry
            }
        };

        const intervalId = setInterval(pollPaymentStatus, POLL_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [showQRModal, vietqrPayment, paymentConfirmed, orderId, router]);

    // 3. Action Handlers
    const handleSelectProvider = async (provider: PaymentProvider) => {
        if (!orderId || !order || isProcessing) return;

        setSelectedProvider(provider);
        setIsProcessing(true);
        setError('');

        try {
            if (provider === 'cash') {
                // [FIX] Gọi API báo thanh toán tiền mặt để Kitchen nhận đơn ngay
                await ordersApi.payCash(Number(orderId));
                router.push(`/payment/status?order_id=${orderId}&provider=cash&status=success`);
                return;
            }

            const paymentData = await paymentsApi.initiate({
                order_id: Number(orderId),
                payment_method: provider,
                amount: order.total_amount,
            });
            setVietqrPayment(paymentData);
            setShowQRModal(true);
            setIsProcessing(false);
        } catch (err: any) {
            setError(err.message || 'Không thể khởi tạo thanh toán.');
            setIsProcessing(false);
            setSelectedProvider(null);
        }
    };

    const handlePaymentTimeout = () => {
        setShowQRModal(false);
        setError('Thời gian thanh toán đã hết. Vui lòng thử lại.');
    };

    const handleCloseModal = () => {
        setShowQRModal(false);
        setVietqrPayment(null);
        setSelectedProvider(null);
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingState message="Đang tải..." /></div>;

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col">
            <header className="sticky top-0 z-40 bg-dark-bg/95 backdrop-blur-md border-b border-dark-border">
                <div className="px-4 py-4 flex items-center gap-4">
                    <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center text-text-secondary hover:text-text-primary">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-text-primary">Thanh toán</h1>
                        <p className="text-sm text-text-muted">Chọn phương thức thanh toán</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 space-y-6">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-dark-card border border-dark-border rounded-2xl p-4">
                    <CountdownProgress duration={PAYMENT_TIMEOUT_SECONDS} onExpire={handlePaymentTimeout} label="Thời gian thanh toán" />
                </motion.div>

                {order && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-dark-card border border-dark-border rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-text-muted text-sm">Số tiền thanh toán</p>
                                <p className="text-2xl font-bold text-primary-400">{formatPrice(order.total_amount)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center">
                                <CreditCard className="text-primary-400" size={24} />
                            </div>
                        </div>
                    </motion.div>
                )}

                {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
                    <h2 className="text-sm font-medium text-text-secondary mb-3">Phương thức thanh toán</h2>
                    <PaymentButton provider="vietqr" onSelect={handleSelectProvider} isLoading={isProcessing && selectedProvider === 'vietqr'} disabled={isProcessing && selectedProvider !== 'vietqr'} />
                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dark-border" /></div>
                        <div className="relative flex justify-center"><span className="px-3 bg-dark-bg text-text-muted text-sm">hoặc</span></div>
                    </div>
                    <PaymentButton provider="cash" onSelect={handleSelectProvider} isLoading={isProcessing && selectedProvider === 'cash'} disabled={isProcessing && selectedProvider !== 'cash'} />
                </motion.div>
            </main>

            <footer className="p-4 text-center text-text-muted text-xs"><p>Thanh toán an toàn và bảo mật • 0% phí giao dịch</p></footer>

            <AnimatePresence>
                {showQRModal && vietqrPayment && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-dark-card border border-dark-border rounded-3xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between p-4 border-b border-dark-border">
                                <h3 className="text-lg font-bold text-text-primary">Quét mã QR để thanh toán</h3>
                                <button onClick={handleCloseModal} className="w-8 h-8 rounded-full bg-dark-bg flex items-center justify-center text-text-muted hover:text-text-primary"><X size={18} /></button>
                            </div>

                            <div className="p-6 space-y-4">
                                {paymentConfirmed ? (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center py-8">
                                        <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
                                        <p className="text-xl font-bold text-green-500">Thanh toán thành công!</p>
                                        <p className="text-text-muted mt-2 text-center">Đang chuyển hướng...</p>
                                    </motion.div>
                                ) : (
                                    <>
                                        <div className="bg-white rounded-2xl p-4 flex items-center justify-center">
                                            <img src={vietqrPayment.qr_url} alt="VietQR Payment Code" className="w-full max-w-[240px] h-auto object-contain" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-text-muted text-sm">Số tiền</p>
                                            <p className="text-2xl font-bold text-primary-400">{formatPrice(vietqrPayment.amount)}</p>
                                        </div>
                                        <div className="bg-dark-bg rounded-xl p-4 space-y-2 text-sm">
                                            <div className="flex justify-between"><span className="text-text-muted">Ngân hàng</span><span className="text-text-primary font-medium">{vietqrPayment.bank_id}</span></div>
                                            <div className="flex justify-between"><span className="text-text-muted">Số tài khoản</span><span className="text-text-primary font-medium">{vietqrPayment.account_no}</span></div>
                                            <div className="flex justify-between"><span className="text-text-muted">Chủ tài khoản</span><span className="text-text-primary font-medium">{vietqrPayment.account_name}</span></div>
                                            <div className="flex justify-between"><span className="text-text-muted">Nội dung</span><span className="text-primary-400 font-medium">{vietqrPayment.transfer_content}</span></div>
                                        </div>
                                        <div className="flex items-center justify-center gap-2 text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Đang chờ thanh toán...</span></div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// [FIX] Export với Suspense để tránh lỗi build
export default function PaymentSelectionPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingState message="Đang tải hệ thống thanh toán..." /></div>}>
            <PaymentSelectionContent />
        </Suspense>
    );
}
