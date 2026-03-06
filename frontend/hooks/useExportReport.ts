import { useCallback, useState } from 'react';
import api from '@/lib/api';
import { ExportOptions } from '@/lib/types/analytics';

/**
 * useExportReport Hook
 *
 * Single Responsibility: Handle export functionality.
 * Follows SRP by only handling export/download operations.
 *
 * @returns Export function and loading state
 */
interface ExportResult {
    exportReport: (options: ExportOptions) => Promise<void>;
    isExporting: boolean;
    error: string | null;
}

export function useExportReport(): ExportResult {
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const exportReport = useCallback(async (options: ExportOptions) => {
        setIsExporting(true);
        setError(null);

        try {
            const response = await api.get(options.endpoint, {
                responseType: 'blob',
                params: options.params,
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', options.filename);
            document.body.appendChild(link);
            link.click();
            link.remove();

            // Clean up
            window.URL.revokeObjectURL(url);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to export report';
            setError(message);
            console.error('Failed to export report:', err);
        } finally {
            setIsExporting(false);
        }
    }, []);

    return {
        exportReport,
        isExporting,
        error,
    };
}

/**
 * Hook for exporting analytics report
 */
export function useAnalyticsExport() {
    const { exportReport, isExporting, error } = useExportReport();

    const exportAnalytics = useCallback(async (startDate?: string, endDate?: string) => {
        const filename = `analytics_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        const params: Record<string, unknown> = {};

        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;

        await exportReport({
            endpoint: '/analytics/export',
            filename,
            params: Object.keys(params).length > 0 ? params : undefined,
        });
    }, [exportReport]);

    return {
        exportAnalytics,
        isExporting,
        error,
    };
}

/**
 * Generic download file helper
 */
export async function downloadFile(
    url: string,
    filename: string,
    options?: { method?: string; body?: unknown; headers?: Record<string, string> }
): Promise<void> {
    try {
        const response = await fetch(url, {
            method: options?.method || 'GET',
            headers: options?.headers,
            body: options?.body ? JSON.stringify(options.body) : undefined,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
        console.error('Failed to download file:', err);
        throw err;
    }
}
