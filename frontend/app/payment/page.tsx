'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CreditCard, X, CheckCircle, Loader2 } from 'lucide-react';
import { PaymentButton } from '@/components/PaymentButton';
import { CountdownProgress } from '@/components/CountdownTimer';
import { LoadingState } from '@/components/ui/Spinner';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Order, PaymentProvider, VietQRPayment } from '@/lib/types';

// Payment timeout in seconds (15 minutes)
const PAYMENT_TIMEOUT_SECONDS = 15 * 60;
// Poll interval for payment status (2 seconds)
const POLL_INTERVAL_MS = 2000;

export default function PaymentSelectionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get('order_id');

    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    // VietQR Modal state
    const [showQRModal, setShowQRModal] = useState(false);
    const [vietqrPayment, setVietqrPayment] = useState<VietQRPayment | null>(null);
    const [paymentConfirmed, setPaymentConfirmed] = useState(false);

    // Fetch order
    useEffect(() => {
        if (!orderId) {
            router.push('/menu');
            return;
        }

        const fetchOrder = async () => {
            try {
                const response = await api.get<Order>(`/orders/${orderId}`);
                setOrder(response.data);
            } catch (err: any) {
                setError('Không thể tải thông tin đơn hàng.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrder();
    }, [orderId, router]);

    // Poll for payment status when QR modal is open
    useEffect(() => {
        if (!showQRModal || !vietqrPayment || paymentConfirmed) return;

        const pollPaymentStatus = async () => {
            try {
                const response = await api.get(`/payments/${vietqrPayment.id}`);
                if (response.data.status === 'completed') {
                    setPaymentConfirmed(true);
                    // Wait 2 seconds to show success, then redirect
                    setTimeout(() => {
                        router.push(`/payment/status?order_id=${orderId}&status=success`);
                    }, 2000);
                }
            } catch (err) {
                // Silently fail polling - will retry
            }
        };

        const intervalId = setInterval(pollPaymentStatus, POLL_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [showQRModal, vietqrPayment, paymentConfirmed, orderId, router]);

    // Handle payment provider selection
    const handleSelectProvider = async (provider: PaymentProvider) => {
        if (!orderId || !order || isProcessing) return;

        setSelectedProvider(provider);
        setIsProcessing(true);
        setError('');

        try {
            // Handle cash payment separately
            if (provider === 'cash') {
                // Call API to trigger notification
                await api.post('/payments/initiate', {
                    order_id: parseInt(orderId),
                    provider: provider,
                    amount: order.total_amount,
                });

                router.push(`/payment/status?order_id=${orderId}&provider=cash`);
                return;
            }

            console.log(`💳 Initiating payment for Order #${orderId} via ${provider}`);
            setVietqrPayment(response.data);
            setShowQRModal(true);
            setIsProcessing(false);
        } catch (err: any) {
            setError(err.message || 'Không thể khởi tạo thanh toán.');
            setIsProcessing(false);
            setSelectedProvider(null);
        }
    };

    // Handle payment timeout
    const handlePaymentTimeout = () => {
        setShowQRModal(false);
        setError('Thời gian thanh toán đã hết. Vui lòng thử lại.');
    };

    // Close QR modal
    const handleCloseModal = () => {
        setShowQRModal(false);
        setVietqrPayment(null);
        setSelectedProvider(null);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingState message="Đang tải..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-dark-bg flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-dark-bg/95 backdrop-blur-md border-b border-dark-border">
                <div className="px-4 py-4 flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-text-primary">Thanh toán</h1>
                        <p className="text-sm text-text-muted">
                            Chọn phương thức thanh toán
                        </p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 space-y-6">
                {/* Payment Timer */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-dark-card border border-dark-border rounded-2xl p-4"
                >
                    <CountdownProgress
                        duration={PAYMENT_TIMEOUT_SECONDS}
                        onExpire={handlePaymentTimeout}
                        label="Thời gian thanh toán"
                    />
                </motion.div>

                {/* Order Amount */}
                {order && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-dark-card border border-dark-border rounded-2xl p-4"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-text-muted text-sm">Số tiền thanh toán</p>
                                <p className="text-2xl font-bold text-primary-400">
                                    {formatPrice(order.total_amount)}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center">
                                <CreditCard className="text-primary-400" size={24} />
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Payment Options */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-3"
                >
                    <h2 className="text-sm font-medium text-text-secondary mb-3">
                        Phương thức thanh toán
                    </h2>

                    <PaymentButton
                        provider="vietqr"
                        onSelect={handleSelectProvider}
                        isLoading={isProcessing && selectedProvider === 'vietqr'}
                        disabled={isProcessing && selectedProvider !== 'vietqr'}
                    />

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-dark-border" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-3 bg-dark-bg text-text-muted text-sm">
                                hoặc
                            </span>
                        </div>
                    </div>

                    <PaymentButton
                        provider="cash"
                        onSelect={handleSelectProvider}
                        isLoading={isProcessing && selectedProvider === 'cash'}
                        disabled={isProcessing && selectedProvider !== 'cash'}
                    />
                </motion.div>
            </main>

            {/* Footer Note */}
            <footer className="p-4 text-center text-text-muted text-xs">
                <p>Thanh toán an toàn và bảo mật • 0% phí giao dịch</p>
            </footer>

            {/* VietQR Modal */}
            <AnimatePresence>
                {showQRModal && vietqrPayment && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-dark-card border border-dark-border rounded-3xl w-full max-w-sm overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-4 border-b border-dark-border">
                                <h3 className="text-lg font-bold text-text-primary">
                                    Quét mã QR để thanh toán
                                </h3>
                                <button
                                    onClick={handleCloseModal}
                                    className="w-8 h-8 rounded-full bg-dark-bg flex items-center justify-center text-text-muted hover:text-text-primary"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-4">
                                {paymentConfirmed ? (
                                    /* Success State */
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="flex flex-col items-center py-8"
                                    >
                                        <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
                                        <p className="text-xl font-bold text-green-500">
                                            Thanh toán thành công!
                                        </p>
                                        <p className="text-text-muted mt-2">
                                            Đang chuyển hướng...
                                        </p>
                                    </motion.div>
                                ) : (
                                    <>
                                        {/* QR Code */}
                                        <div className="bg-white rounded-2xl p-4 flex items-center justify-center">
                                            <img
                                                src={vietqrPayment.qr_url}
                                                alt="VietQR Payment Code"
                                                className="w-full max-w-[256px] h-auto"
                                            />
                                        </div>

                                        {/* Amount */}
                                        <div className="text-center">
                                            <p className="text-text-muted text-sm">Số tiền</p>
                                            <p className="text-2xl font-bold text-primary-400">
                                                {formatPrice(vietqrPayment.amount)}
                                            </p>
                                        </div>

                                        {/* Bank Info */}
                                        <div className="bg-dark-bg rounded-xl p-4 space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-text-muted text-sm">Ngân hàng</span>
                                                <span className="text-text-primary font-medium uppercase">
                                                    {vietqrPayment.bank_id}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-text-muted text-sm">Số tài khoản</span>
                                                <span className="text-text-primary font-medium">
                                                    {vietqrPayment.account_no}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-text-muted text-sm">Chủ tài khoản</span>
                                                <span className="text-text-primary font-medium">
                                                    {vietqrPayment.account_name}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-text-muted text-sm">Nội dung CK</span>
                                                <span className="text-primary-400 font-medium text-sm">
                                                    {vietqrPayment.transfer_content}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Waiting Status */}
                                        <div className="flex items-center justify-center gap-2 text-text-muted">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-sm">Đang chờ thanh toán...</span>
                                        </div>
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
