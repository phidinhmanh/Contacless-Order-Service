'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useErrorLog } from '@/hooks/useErrorLog';
import { cn } from '@/lib/utils';

interface ErrorDebugPanelProps {
    /** Position of the toggle button */
    position?: 'bottom-left' | 'bottom-right';
    /** Only show in development mode */
    devOnly?: boolean;
}

export function ErrorDebugPanel({
    position = 'bottom-left',
    devOnly = true,
}: ErrorDebugPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
    const { errors, clearAll, clearById, exportJson, errorCount, getSummary } = useErrorLog();

    // Hide in production if devOnly
    if (devOnly && process.env.NODE_ENV === 'production') {
        return null;
    }

    const positionClasses = {
        'bottom-left': 'left-4',
        'bottom-right': 'right-4',
    };

    const toggleExpanded = (id: string) => {
        setExpandedErrors((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleExport = () => {
        const json = exportJson();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-log-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const summary = getSummary();

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'fixed bottom-4 z-50 no-print',
                    positionClasses[position],
                    'flex items-center gap-2 px-3 py-2 rounded-full',
                    'bg-dark-card border border-dark-border shadow-lg',
                    'hover:bg-dark-surface transition-colors',
                    errorCount > 0 && 'border-red-500/50'
                )}
            >
                <AlertTriangle
                    size={18}
                    className={errorCount > 0 ? 'text-red-400' : 'text-text-muted'}
                />
                {errorCount > 0 && (
                    <span className="text-xs font-medium text-red-400">
                        {errorCount}
                    </span>
                )}
            </button>

            {/* Error Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className={cn(
                            'fixed bottom-16 z-50 no-print',
                            positionClasses[position],
                            'w-96 max-h-[60vh] overflow-hidden',
                            'bg-dark-surface border border-dark-border rounded-xl shadow-2xl',
                            'flex flex-col'
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 border-b border-dark-border">
                            <div>
                                <h3 className="font-semibold text-text-primary text-sm">
                                    API Error Log
                                </h3>
                                <p className="text-xs text-text-muted">
                                    {errorCount} error{errorCount !== 1 ? 's' : ''} logged
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleExport}
                                    className="p-1.5 rounded hover:bg-dark-card text-text-muted hover:text-text-primary transition-colors"
                                    title="Export as JSON"
                                >
                                    <Download size={14} />
                                </button>
                                <button
                                    onClick={clearAll}
                                    className="p-1.5 rounded hover:bg-dark-card text-text-muted hover:text-red-400 transition-colors"
                                    title="Clear all"
                                >
                                    <Trash2 size={14} />
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded hover:bg-dark-card text-text-muted hover:text-text-primary transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Summary */}
                        {errorCount > 0 && (
                            <div className="px-3 py-2 bg-dark-bg/50 border-b border-dark-border">
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(summary.byStatus).map(([status, count]) => (
                                        <span
                                            key={status}
                                            className={cn(
                                                'px-2 py-0.5 rounded text-xs font-medium',
                                                status === '401' && 'bg-yellow-500/20 text-yellow-400',
                                                status === '403' && 'bg-orange-500/20 text-orange-400',
                                                status === '404' && 'bg-blue-500/20 text-blue-400',
                                                status === '500' && 'bg-red-500/20 text-red-400',
                                                status === 'network' && 'bg-gray-500/20 text-gray-400',
                                                !['401', '403', '404', '500', 'network'].includes(status) &&
                                                'bg-purple-500/20 text-purple-400'
                                            )}
                                        >
                                            {status}: {count}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Error List */}
                        <div className="flex-1 overflow-y-auto">
                            {errors.length === 0 ? (
                                <div className="p-4 text-center text-text-muted text-sm">
                                    No errors logged
                                </div>
                            ) : (
                                <div className="divide-y divide-dark-border">
                                    {errors.map((error) => (
                                        <div key={error.id} className="p-2">
                                            <div
                                                className="flex items-start gap-2 cursor-pointer"
                                                onClick={() => toggleExpanded(error.id)}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={cn(
                                                                'px-1.5 py-0.5 rounded text-[10px] font-bold',
                                                                error.status === 401 && 'bg-yellow-500/20 text-yellow-400',
                                                                error.status === 403 && 'bg-orange-500/20 text-orange-400',
                                                                error.status === 404 && 'bg-blue-500/20 text-blue-400',
                                                                error.status && error.status >= 500 && 'bg-red-500/20 text-red-400',
                                                                !error.status && 'bg-gray-500/20 text-gray-400'
                                                            )}
                                                        >
                                                            {error.status || 'NET'}
                                                        </span>
                                                        <span className="text-xs font-mono text-text-muted">
                                                            {error.method}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-text-primary truncate mt-1">
                                                        {error.endpoint}
                                                    </p>
                                                    <p className="text-xs text-text-muted truncate">
                                                        {typeof error.message === 'object'
                                                            ? JSON.stringify(error.message)
                                                            : error.message}
                                                    </p>
                                                    <p className="text-[10px] text-text-muted">
                                                        {new Date(error.timestamp).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {expandedErrors.has(error.id) ? (
                                                        <ChevronUp size={14} className="text-text-muted" />
                                                    ) : (
                                                        <ChevronDown size={14} className="text-text-muted" />
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            clearById(error.id);
                                                        }}
                                                        className="p-1 rounded hover:bg-dark-card text-text-muted hover:text-red-400"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            <AnimatePresence>
                                                {expandedErrors.has(error.id) && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="mt-2 p-2 bg-dark-bg rounded text-[10px] font-mono">
                                                            {error.details ? (
                                                                <pre className="text-text-secondary whitespace-pre-wrap break-all">
                                                                    {String(JSON.stringify(error.details, null, 2))}
                                                                </pre>
                                                            ) : null}
                                                            {error.stack && (
                                                                <details className="mt-2">
                                                                    <summary className="text-text-muted cursor-pointer">
                                                                        Stack trace
                                                                    </summary>
                                                                    <pre className="mt-1 text-red-400/70 whitespace-pre-wrap break-all">
                                                                        {error.stack}
                                                                    </pre>
                                                                </details>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
