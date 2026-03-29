'use client';

import {useEffect} from 'react';

export function useAdminDocumentTitle(...parts: Array<string | null | undefined>) {
    useEffect(() => {
        const title = parts
            .map((part) => part?.trim())
            .filter((part): part is string => Boolean(part))
            .join(' | ');

        if (!title) {
            return;
        }

        document.title = title;
    }, [parts]);
}
