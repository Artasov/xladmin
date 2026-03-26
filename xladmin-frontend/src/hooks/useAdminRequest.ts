'use client';

import {useEffect, useState} from 'react';

export function useAdminRequest<T>(
    loader: () => Promise<T>,
    deps: unknown[],
) {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;
        setIsLoading(true);
        setError(null);
        loader()
            .then((response) => {
                if (!isActive) return;
                setData(response);
            })
            .catch((reason: unknown) => {
                if (!isActive) return;
                setError(reason instanceof Error ? reason.message : 'Request failed');
            })
            .finally(() => {
                if (!isActive) return;
                setIsLoading(false);
            });
        return () => {
            isActive = false;
        };
    }, deps);

    return {data, isLoading, error, setData};
}
