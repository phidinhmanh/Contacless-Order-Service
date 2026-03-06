'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';

interface OutOfStockPopupProps {
    isOpen: boolean;
    onClose: () => void;
    foodName?: string;
    message?: string;
}

export function OutOfStockPopup({
    isOpen,
    onClose,
    foodName,
    message = "Món này đã hết ạ quý khách vui lòng đặt lại sau"
}: OutOfStockPopupProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
                    />

                    {/* Popup */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", duration: 0.3 }}
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-[80]"
                    >
                        <div className="bg-dark-card rounded-2xl border border-dark-border shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="relative p-4 bg-red-500/10 border-b border-dark-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                        <AlertCircle size={20} className="text-red-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-text-primary">
                                            Hết món
                                        </h3>
                                        <p className="text-xs text-text-muted">
                                            {foodName ? `Món "${foodName}"` : 'Một số món'} đã hết
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-border transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                <p className="text-text-secondary text-sm text-center leading-relaxed">
                                    {message}
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-dark-border">
                                <button
                                    onClick={onClose}
                                    className="w-full py-2.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 active:scale-[0.98] transition-all"
                                >
                                    Tôi hiểu
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
