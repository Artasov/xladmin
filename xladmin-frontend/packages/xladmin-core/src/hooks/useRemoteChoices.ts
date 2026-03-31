'use client';

import {useEffect, useRef, useState} from 'react';

type UseRemoteChoicesOptions<T> = {
    enabled: boolean;
    debounceMs?: number;
    initialItems?: T[];
    resetKey?: string;
    queryKey: string;
    load: (signal: AbortSignal) => Promise<T[]>;
    merge?: (current: T[], next: T[]) => T[];
};

type UseRemoteChoicesResult<T> = {
    items: T[];
    isLoading: boolean;
};

export function useRemoteChoices<T>({
                                        enabled,
                                        debounceMs = 250,
                                        initialItems = [],
                                        resetKey,
                                        queryKey,
                                        load,
                                        merge,
                                    }: UseRemoteChoicesOptions<T>): UseRemoteChoicesResult<T> {
    const [items, setItems] = useState<T[]>(initialItems);
    const [isLoading, setIsLoading] = useState(false);
    const previousResetKeyRef = useRef(resetKey);

    useEffect(() => {
        if (previousResetKeyRef.current !== resetKey) {
            previousResetKeyRef.current = resetKey;
            setItems(initialItems);
            setIsLoading(false);
            return;
        }

        setItems((currentItems) => {
            if (areChoiceArraysShallowEqual(currentItems, initialItems)) {
                return currentItems;
            }
            if (currentItems.length > 0 && initialItems.length === 0) {
                return currentItems;
            }
            return initialItems;
        });
    }, [initialItems, resetKey]);

    useEffect(() => {
        if (!enabled) {
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            setIsLoading(true);
            load(controller.signal)
                .then((nextItems) => {
                    if (controller.signal.aborted) {
                        return;
                    }
                    setItems((current) => (merge ? merge(current, nextItems) : nextItems));
                })
                .catch((reason: unknown) => {
                    if (isAbortReason(reason) || controller.signal.aborted) {
                        return;
                    }
                    setItems((current) => current);
                })
                .finally(() => {
                    if (controller.signal.aborted) {
                        return;
                    }
                    setIsLoading(false);
                });
        }, debounceMs);

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [debounceMs, enabled, load, merge, queryKey]);

    return {items, isLoading};
}

function areChoiceArraysShallowEqual<T>(left: T[], right: T[]): boolean {
    if (left === right) {
        return true;
    }
    if (left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index += 1) {
        if (!Object.is(left[index], right[index])) {
            return false;
        }
    }
    return true;
}


function isAbortReason(reason: unknown): boolean {
    if (reason instanceof DOMException && reason.name === 'AbortError') {
        return true;
    }
    return typeof reason === 'object'
        && reason !== null
        && 'name' in reason
        && (reason as { name?: string }).name === 'AbortError';
}
