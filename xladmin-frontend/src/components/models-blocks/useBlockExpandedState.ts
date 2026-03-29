'use client';

import {useCallback, useEffect, useState} from 'react';

const STORAGE_KEY_PREFIX = 'xladmin.models-block.expanded';

export function useBlockExpandedState(blockSlug: string, defaultExpanded: boolean) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const rawValue = window.localStorage.getItem(getStorageKey(blockSlug));
        if (rawValue === null) {
            setIsExpanded(defaultExpanded);
            return;
        }

        setIsExpanded(rawValue === 'true');
    }, [blockSlug, defaultExpanded]);

    const updateExpanded = useCallback((nextExpanded: boolean) => {
        setIsExpanded(nextExpanded);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(getStorageKey(blockSlug), String(nextExpanded));
        }
    }, [blockSlug]);

    return [isExpanded, updateExpanded] as const;
}

function getStorageKey(blockSlug: string) {
    return `${STORAGE_KEY_PREFIX}.${blockSlug}`;
}
