'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Calendar, Check, X } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';

interface DemographicModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { gender: string; age_group: string }) => void;
}

const GENDER_OPTIONS = [
    { value: 'male', label: 'Nam', icon: '👨' },
    { value: 'female', label: 'Nữ', icon: '👩' },
    { value: 'other', label: 'Khác', icon: '👤' },
];

const AGE_OPTIONS = [
    { value: 'under_18', label: '< 18' },
    { value: '18_24', label: '18-24' },
    { value: '25_34', label: '25-34' },
    { value: '35_44', label: '35-44' },
    { value: '45_54', label: '45-54' },
    { value: '55_plus', label: '55+' },
];

export function DemographicModal({ isOpen, onClose, onSubmit }: DemographicModalProps) {
    const [step, setStep] = useState<'gender' | 'age'>('gender');
    const [gender, setGender] = useState('');
    const [ageGroup, setAgeGroup] = useState('');

    const handleGenderSelect = (val: string) => {
        setGender(val);
        setStep('age');
    };

    const handleAgeSelect = (val: string) => {
        setAgeGroup(val);
    };

    const handleSubmit = () => {
        if (gender && ageGroup) {
            onSubmit({ gender, age_group: ageGroup });
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-sm bg-dark-surface border border-dark-border rounded-3xl p-6 shadow-2xl"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="text-center mb-8">
                            <h2 className="text-xl font-bold text-text-primary mb-2">
                                {step === 'gender' ? 'Bạn là ai?' : 'Độ tuổi của bạn?'}
                            </h2>
                            <p className="text-text-secondary text-sm">
                                {step === 'gender'
                                    ? 'Hãy cho chúng tôi biết giới tính của bạn'
                                    : 'Hãy chọn nhóm tuổi phù hợp nhất'}
                            </p>
                        </div>

                        {step === 'gender' ? (
                            <div className="grid grid-cols-3 gap-3">
                                {GENDER_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleGenderSelect(opt.value)}
                                        className={cn(
                                            "flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                                            gender === opt.value
                                                ? "border-primary-500 bg-primary-500/10"
                                                : "border-dark-border bg-dark-bg hover:border-text-muted"
                                        )}
                                    >
                                        <span className="text-4xl">{opt.icon}</span>
                                        <span className="text-sm font-medium text-text-primary">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-3">
                                    {AGE_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => handleAgeSelect(opt.value)}
                                            className={cn(
                                                "py-3 px-4 rounded-xl border transition-all text-sm font-medium",
                                                ageGroup === opt.value
                                                    ? "bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/20"
                                                    : "bg-dark-bg text-text-secondary border-dark-border hover:border-text-muted"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => setStep('gender')}
                                    >
                                        Quay lại
                                    </Button>
                                    <Button
                                        className="flex-1"
                                        disabled={!ageGroup}
                                        onClick={handleSubmit}
                                    >
                                        Hoàn tất
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex justify-center gap-1.5">
                            <div className={cn("w-1.5 h-1.5 rounded-full", step === 'gender' ? "bg-primary-500 w-4" : "bg-dark-border")} />
                            <div className={cn("w-1.5 h-1.5 rounded-full", step === 'age' ? "bg-primary-500 w-4" : "bg-dark-border")} />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
