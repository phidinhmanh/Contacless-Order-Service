'use client';

import { useState, useEffect, useCallback } from 'react';
import { errorLogger, ApiError } from '@/lib/errorLogger';

export function useErrorLog() {
    const [errors, setErrors] = useState<ApiError[]>([]);

    useEffect(() => {
        // Initialize with current errors
        setErrors(errorLogger.getErrors());

        // Subscribe to updates
        const unsubscribe = errorLogger.subscribe((newErrors) => {
            setErrors(newErrors);
        });

        return unsubscribe;
    }, []);

    const clearAll = useCallback(() => {
        errorLogger.clear();
    }, []);

    const clearById = useCallback((id: string) => {
        errorLogger.clearById(id);
    }, []);

    const getRecent = useCallback((count: number = 10) => {
        return errorLogger.getRecentErrors(count);
    }, []);

    const getSummary = useCallback(() => {
        return errorLogger.getSummary();
    }, []);

    const exportJson = useCallback(() => {
        return errorLogger.exportAsJson();
    }, []);

    return {
        errors,
        clearAll,
        clearById,
        getRecent,
        getSummary,
        exportJson,
        hasErrors: errors.length > 0,
        errorCount: errors.length,
    };
}
