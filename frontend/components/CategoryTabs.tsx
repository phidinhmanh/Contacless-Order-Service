'use client';

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
// Categories can be either strings or objects from the API
type CategoryItem = string | { id?: string; name?: string; title?: string;[key: string]: unknown };

interface CategoryTabsProps {
    categories: CategoryItem[];
    activeCategory: string | null;
    onCategoryChange: (categoryId: string | null) => void;
}

// Helper to safely get category name (handles both strings and objects)
function getCategoryName(category: CategoryItem): string {
    if (typeof category === 'string') {
        return category;
    }
    return String(category.name ?? category.title ?? 'Unknown');
}

// Helper to safely get category id (for strings, use the string itself as ID)
function getCategoryId(category: CategoryItem): string {
    if (typeof category === 'string') {
        return category;
    }
    return String(category.id ?? category.name ?? '');
}

export function CategoryTabs({
    categories,
    activeCategory,
    onCategoryChange,
}: CategoryTabsProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<HTMLButtonElement>(null);

    // Scroll active tab into view
    useEffect(() => {
        if (activeRef.current && scrollRef.current) {
            activeRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center',
            });
        }
    }, [activeCategory]);

    return (
        <div className="sticky top-0 z-30 bg-dark-bg/95 backdrop-blur-md border-b border-dark-border">
            <div
                ref={scrollRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {/* All categories tab */}
                <button
                    ref={activeCategory === null ? activeRef : undefined}
                    onClick={() => onCategoryChange(null)}
                    className={cn(
                        'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium',
                        'transition-all duration-200 min-h-touch',
                        activeCategory === null
                            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                            : 'bg-dark-card text-text-secondary hover:bg-dark-card/80 border border-dark-border'
                    )}
                >
                    Tất cả
                </button>

                {/* Category tabs */}
                {categories.map((category) => {
                    const catId = getCategoryId(category);
                    const catName = getCategoryName(category);

                    return (
                        <button
                            key={catId}
                            ref={activeCategory === catId ? activeRef : undefined}
                            onClick={() => onCategoryChange(catId)}
                            className={cn(
                                'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap',
                                'transition-all duration-200 min-h-touch',
                                activeCategory === catId
                                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                                    : 'bg-dark-card text-text-secondary hover:bg-dark-card/80 border border-dark-border'
                            )}
                        >
                            {catName}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

