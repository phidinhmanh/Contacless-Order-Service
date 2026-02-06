'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateGuestDemographics, createTableSession, getTableIdFromUrl } from '@/lib/auth';
import { useCartStore } from '@/store/cartStore';

const GUEST_INFO_FLAG = 'guest_demographics_collected';




interface GuestDemographics {
    age_group: string;
    gender: string;
}

interface GuestDemographicsPopupProps {
    onSubmit?: (data: GuestDemographics) => void;
}

const AGE_GROUPS = [
    { value: 'under_18', label: 'Dưới 18' },
    { value: '18_24', label: '18 - 24' },
    { value: '25_34', label: '25 - 34' },
    { value: '35_44', label: '35 - 44' },
    { value: '45_54', label: '45 - 54' },
    { value: '55_plus', label: 'Trên 55' },
];

const GENDERS = [
    { value: 'male', label: 'Nam', emoji: '👨' },
    { value: 'female', label: 'Nữ', emoji: '👩' },
    { value: 'other', label: 'Khác', emoji: '🧑' },
];

export function GuestDemographicsPopup({ onSubmit }: GuestDemographicsPopupProps) {
    const [isOpen, setIsOpen] = useState(false);
    // Basic focus management and keyboard handling rely on opening state
    const setGlobalGuestCount = useCartStore((state) => state.setGuestCount);
    const [ageGroup, setAgeGroup] = useState('');
    const [guestCount, setGuestCount] = useState<number | null>(null);
    const [gender, setGender] = useState('');
    const [step, setStep] = useState<'count' | 'gender' | 'age'>('count');

    // Check if flag exists on mount
    useEffect(() => {
        const hasAnswered = localStorage.getItem(GUEST_INFO_FLAG);
        if (!hasAnswered) {
            // Delay popup slightly for better UX
            const timer = setTimeout(() => setIsOpen(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleGuestCountSelect = async (count: number) => {
        setGuestCount(count);
        setGlobalGuestCount(count);

        // Attempt to create/join table session immediately
        const tableId = getTableIdFromUrl();
        if (tableId) {
            const parsed = Number.parseInt(tableId, 10);
            if (Number.isFinite(parsed)) {
                try {
                    await createTableSession(parsed, count);
                } catch (e) {
                    console.error('Session creation failed', e);
                }
            } else {
                console.warn('Invalid table id from URL:', tableId);
            }
        }

        setStep('gender');
    };

    const handleGenderSelect = (value: string) => {
        setGender(value);
        setStep('age');
    };

    const handleAgeSelect = async (value: string) => {
        setAgeGroup(value);

        // Save data
        const data: GuestDemographics = { age_group: value, gender };

        // Save flag and data to localStorage
        localStorage.setItem(GUEST_INFO_FLAG, 'true');
        localStorage.setItem('guest_demographics', JSON.stringify(data));

        // Send to server (async, don't wait). Log failures.
        updateGuestDemographics(gender, value).catch((err) => console.error('Update demographics failed', err));

        // Call callback
        onSubmit?.(data);

        // Close popup
        setIsOpen(false);
    };

    // Basic keyboard handling (Escape to close) and focus management
    useEffect(() => {
        if (!isOpen) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleSkip();
        };

        window.addEventListener('keydown', onKey);

        // Focus the first interactive button in the modal for accessibility
        const focusTimer = setTimeout(() => {
            const modal = document.querySelector('.guest-demographics-modal') as HTMLElement | null;
            modal?.querySelector<HTMLElement>('button')?.focus();
        }, 0);

        return () => {
            window.removeEventListener('keydown', onKey);
            clearTimeout(focusTimer);
        };
    }, [isOpen]);

    const handleSkip = () => {
        // Still save flag so we don't show again
        localStorage.setItem(GUEST_INFO_FLAG, 'skipped');
        setIsOpen(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={handleSkip}
                    />

                    {/* Popup */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="guest-demographics-modal fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto bg-dark-card rounded-2xl border border-dark-border shadow-2xl z-50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-dark-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                                    <User size={16} className="text-primary-400" />
                                </div>
                                <span className="font-medium text-text-primary">Xin chào!</span>
                            </div>
                            <button
                                type="button"
                                aria-label="Close demographics popup"
                                onClick={handleSkip}
                                className="p-1 text-text-muted hover:text-text-primary"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            <AnimatePresence mode="wait">
                                {step === 'count' ? (
                                    <motion.div
                                        key="count"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                    >
                                        <p className="text-text-secondary text-center mb-4">
                                            Bàn mình đi bao nhiêu người ạ?
                                        </p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[1, 2, 3, 4, 5, 6].map((num) => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    aria-pressed={guestCount === num}
                                                    onClick={() => handleGuestCountSelect(num)}
                                                    className={cn(
                                                        'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                                                        'hover:border-primary-500 hover:bg-primary-500/10',
                                                        'border-dark-border bg-dark-bg',
                                                        guestCount === num && 'border-primary-500 ring-1 ring-primary-500/30 bg-primary-500/10'
                                                    )}
                                                >
                                                    <span className="text-xl font-bold text-text-primary">
                                                        {num === 6 ? '6+' : num}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                ) : step === 'gender' ? (
                                    <motion.div
                                        key="gender"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                    >
                                        <p className="text-text-secondary text-center mb-4">
                                            Bạn là?
                                        </p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {GENDERS.map((g) => (
                                                <button
                                                    key={g.value}
                                                    type="button"
                                                    aria-pressed={gender === g.value}
                                                    onClick={() => handleGenderSelect(g.value)}
                                                    className={cn(
                                                        'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                                                        'hover:border-primary-500 hover:bg-primary-500/10',
                                                        'border-dark-border bg-dark-bg',
                                                        gender === g.value && 'border-primary-500 ring-1 ring-primary-500/30 bg-primary-500/10'
                                                    )}
                                                >
                                                    <span className="text-2xl">{g.emoji}</span>
                                                    <span className="text-sm text-text-primary">{g.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="age"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                    >
                                        <p className="text-text-secondary text-center mb-4">
                                            Độ tuổi của bạn?
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {AGE_GROUPS.map((age) => (
                                                <button
                                                    key={age.value}
                                                    type="button"
                                                    aria-pressed={ageGroup === age.value}
                                                    onClick={() => handleAgeSelect(age.value)}
                                                    className={cn(
                                                        'p-3 rounded-xl border-2 transition-all text-center',
                                                        'hover:border-primary-500 hover:bg-primary-500/10',
                                                        'border-dark-border bg-dark-bg text-text-primary',
                                                        ageGroup === age.value && 'border-primary-500 ring-1 ring-primary-500/30 bg-primary-500/10'
                                                    )}
                                                >
                                                    {age.label}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setStep('gender')}
                                            className="w-full mt-3 text-sm text-text-muted hover:text-text-primary"
                                        >
                                            ← Quay lại
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-dark-border">
                            <button
                                type="button"
                                aria-label="Skip demographics"
                                onClick={handleSkip}
                                className="w-full text-xs text-text-muted hover:text-text-secondary"
                            >
                                Bỏ qua
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Hook to get guest demographics
export function useGuestDemographics() {
    const [demographics, setDemographics] = useState<GuestDemographics | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('guest_demographics');
        if (saved) {
            try {
                setDemographics(JSON.parse(saved));
            } catch {
                // Ignore parse errors
            }
        }
    }, []);

    return demographics;
}
