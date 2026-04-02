'use client';

import {useEffect, useRef} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation.js';
import type {AdminRouter} from 'xladmin';

export type NextAdminRouterAdapter = {
    pathname: string;
    search: string;
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
};

export function createNextAdminRouter(adapter: NextAdminRouterAdapter): AdminRouter {
    return {
        getLocation: () => ({
            pathname: adapter.pathname,
            search: adapter.search,
        }),
        subscribe: () => () => {
        },
        push: (href) => {
            adapter.push(href);
        },
        replace: (href) => {
            adapter.replace(href);
        },
        back: () => {
            adapter.back();
        },
    };
}

export function useNextAdminRouter(): AdminRouter {
    const nextRouter = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const listenersRef = useRef(new Set<() => void>());
    const locationRef = useRef({
        pathname,
        search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    });
    const previousLocationRef = useRef(locationRef.current);
    const navigationRef = useRef(nextRouter);
    const routerRef = useRef<AdminRouter | null>(null);

    locationRef.current = {
        pathname,
        search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    };
    navigationRef.current = nextRouter;

    if (routerRef.current === null) {
        routerRef.current = createNextAdminRouter({
            pathname: locationRef.current.pathname,
            search: locationRef.current.search,
            push: (href: string) => {
                navigationRef.current.push(href);
            },
            replace: (href: string) => {
                navigationRef.current.replace(href);
            },
            back: () => {
                navigationRef.current.back();
            },
        });
        routerRef.current.getLocation = () => ({
            pathname: locationRef.current.pathname,
            search: locationRef.current.search,
        });
        routerRef.current.subscribe = (listener) => {
            listenersRef.current.add(listener);
            return () => {
                listenersRef.current.delete(listener);
            };
        };
    }

    useEffect(() => {
        const previousLocation = previousLocationRef.current;
        if (
            previousLocation.pathname === locationRef.current.pathname
            && previousLocation.search === locationRef.current.search
        ) {
            return;
        }

        previousLocationRef.current = locationRef.current;
        for (const listener of listenersRef.current) {
            listener();
        }
    }, [pathname, searchParams]);

    return routerRef.current;
}
