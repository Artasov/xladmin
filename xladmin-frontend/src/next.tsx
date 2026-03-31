'use client';

import {useMemo} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation.js';
import type {XLAdminRouter} from './router';

export function useNextXLAdminRouter(): XLAdminRouter {
    const nextRouter = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const search = searchParams.toString();

    return useMemo(() => ({
        getLocation: () => ({
            pathname,
            search: search ? `?${search}` : '',
        }),
        subscribe: () => () => {},
        push: (href: string) => {
            nextRouter.push(href);
        },
        replace: (href: string) => {
            nextRouter.replace(href);
        },
        back: () => {
            nextRouter.back();
        },
    }), [nextRouter, pathname, search]);
}
