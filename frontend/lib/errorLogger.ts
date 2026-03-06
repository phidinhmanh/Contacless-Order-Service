// Error types
export interface ApiError {
    id: string;
    timestamp: Date;
    endpoint: string;
    method: string;
    status: number | null;
    message: string;
    details?: unknown;
    stack?: string;
}

// Error log storage (in-memory, persists to sessionStorage)
const MAX_ERROR_LOG_SIZE = 100;
const ERROR_LOG_KEY = 'api_error_log';

class ErrorLogger {
    private errors: ApiError[] = [];
    private listeners: Set<(errors: ApiError[]) => void> = new Set();

    constructor() {
        // Load existing errors from sessionStorage on init
        if (typeof window !== 'undefined') {
            try {
                const stored = sessionStorage.getItem(ERROR_LOG_KEY);
                if (stored) {
                    this.errors = JSON.parse(stored).map((e: ApiError) => ({
                        ...e,
                        timestamp: new Date(e.timestamp),
                    }));
                }
            } catch {
                // Ignore parsing errors
            }
        }
    }

    // Generate unique ID
    private generateId(): string {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Log an API error
    log(error: Omit<ApiError, 'id' | 'timestamp'>): ApiError {
        const apiError: ApiError = {
            id: this.generateId(),
            timestamp: new Date(),
            ...error,
        };

        // Add to beginning of array (newest first)
        this.errors.unshift(apiError);

        // Trim to max size
        if (this.errors.length > MAX_ERROR_LOG_SIZE) {
            this.errors = this.errors.slice(0, MAX_ERROR_LOG_SIZE);
        }

        // Persist to sessionStorage
        this.persist();

        // Notify listeners
        this.notifyListeners();

        // Notify listeners
        this.notifyListeners();

        return apiError;
    }

    // Get all errors
    getErrors(): ApiError[] {
        return [...this.errors];
    }

    // Get errors by endpoint
    getErrorsByEndpoint(endpoint: string): ApiError[] {
        return this.errors.filter((e) => e.endpoint.includes(endpoint));
    }

    // Get recent errors (last N)
    getRecentErrors(count: number = 10): ApiError[] {
        return this.errors.slice(0, count);
    }

    // Clear all errors
    clear(): void {
        this.errors = [];
        this.persist();
        this.notifyListeners();
    }

    // Clear error by ID
    clearById(id: string): void {
        this.errors = this.errors.filter((e) => e.id !== id);
        this.persist();
        this.notifyListeners();
    }

    // Subscribe to error changes
    subscribe(listener: (errors: ApiError[]) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // Persist to sessionStorage
    private persist(): void {
        if (typeof window !== 'undefined') {
            try {
                sessionStorage.setItem(ERROR_LOG_KEY, JSON.stringify(this.errors));
            } catch {
                // Ignore storage errors
            }
        }
    }

    // Notify all listeners
    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener(this.getErrors()));
    }

    // Export errors as JSON for debugging
    exportAsJson(): string {
        return JSON.stringify(this.errors, null, 2);
    }

    // Get error summary
    getSummary(): { total: number; byStatus: Record<string, number> } {
        const byStatus: Record<string, number> = {};

        this.errors.forEach((e) => {
            const key = e.status ? `${e.status}` : 'network';
            byStatus[key] = (byStatus[key] || 0) + 1;
        });

        return {
            total: this.errors.length,
            byStatus,
        };
    }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

// Helper function to create error from axios error
export function createApiErrorFromAxios(
    error: unknown,
    endpoint: string,
    method: string
): Omit<ApiError, 'id' | 'timestamp'> {
    // Handle axios errors
    if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
            response?: {
                status: number;
                data?: { detail?: string; message?: string };
            };
            message?: string;
            stack?: string;
        };

        return {
            endpoint,
            method,
            status: axiosError.response?.status || null,
            message:
                axiosError.response?.data?.detail ||
                axiosError.response?.data?.message ||
                axiosError.message ||
                'Unknown error',
            details: axiosError.response?.data,
            stack: axiosError.stack,
        };
    }

    // Handle network errors
    if (error && typeof error === 'object' && 'message' in error) {
        const netError = error as { message: string; stack?: string };
        return {
            endpoint,
            method,
            status: null,
            message: netError.message || 'Network error',
            stack: netError.stack,
        };
    }

    // Handle unknown errors
    return {
        endpoint,
        method,
        status: null,
        message: String(error) || 'Unknown error',
    };
}
