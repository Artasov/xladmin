'use client';

import type {CSSProperties, MouseEvent as ReactMouseEvent, ReactNode} from 'react';
import {createContext, useContext, useMemo, useRef, useSyncExternalStore} from 'react';

export type AdminLocation = {
    pathname: string;
    search: string;
};

export type AdminRouter = {
    getLocation: () => AdminLocation;
    subscribe: (listener: () => void) => () => void;
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
};

type AdminRouterProviderProps = {
    router: AdminRouter;
    children: ReactNode;
};

type NavigateLinkOptions = {
    href: string;
    onClick?: () => void;
    router: AdminRouter;
};

const AdminRouterContext = createContext<AdminRouter | null>(null);
let browserRouterInstance: AdminRouter | null = null;

export function AdminRouterProvider({router, children}: AdminRouterProviderProps) {
    return (
        <AdminRouterContext.Provider value={router}>
            {children}
        </AdminRouterContext.Provider>
    );
}

export function createBrowserAdminRouter(browserWindow: Window = window): AdminRouter {
    return {
        getLocation: () => ({
            pathname: browserWindow.location.pathname,
            search: browserWindow.location.search,
        }),
        subscribe: (listener) => {
            const handlePopState = () => listener();
            browserWindow.addEventListener('popstate', handlePopState);
            return () => {
                browserWindow.removeEventListener('popstate', handlePopState);
            };
        },
        push: (href) => {
            browserWindow.history.pushState(browserWindow.history.state, '', href);
            browserWindow.dispatchEvent(new PopStateEvent('popstate'));
        },
        replace: (href) => {
            browserWindow.history.replaceState(browserWindow.history.state, '', href);
            browserWindow.dispatchEvent(new PopStateEvent('popstate'));
        },
        back: () => {
            browserWindow.history.back();
        },
    };
}

export function useAdminRouter(router?: AdminRouter): AdminRouter {
    const contextRouter = useContext(AdminRouterContext);
    return useMemo(() => {
        if (router) {
            return router;
        }
        if (contextRouter) {
            return contextRouter;
        }
        if (browserRouterInstance === null) {
            browserRouterInstance = createBrowserAdminRouter();
        }
        return browserRouterInstance;
    }, [contextRouter, router]);
}

export function useAdminLocation(router?: AdminRouter): AdminLocation {
    const resolvedRouter = useAdminRouter(router);
    const snapshotRef = useRef<AdminLocation | null>(null);
    const getSnapshot = useMemo(() => () => {
        const nextLocation = resolvedRouter.getLocation();
        const cachedLocation = snapshotRef.current;

        if (
            cachedLocation !== null
            && cachedLocation.pathname === nextLocation.pathname
            && cachedLocation.search === nextLocation.search
        ) {
            return cachedLocation;
        }

        snapshotRef.current = nextLocation;
        return nextLocation;
    }, [resolvedRouter]);

    return useSyncExternalStore(
        resolvedRouter.subscribe,
        getSnapshot,
        getSnapshot,
    );
}

export function buildUrlWithParams(
    pathname: string,
    query: string,
    sort: string,
    page: number,
    filters: Record<string, string>,
): string {
    const params = new URLSearchParams();
    if (query) {
        params.set('q', query);
    }
    if (sort) {
        params.set('sort', sort);
    }
    if (page > 1) {
        params.set('page', String(page));
    }
    for (const [key, value] of Object.entries(filters)) {
        if (value) {
            params.set(key, value);
        }
    }

    return params.toString() ? `${pathname}?${params.toString()}` : pathname;
}

export function handleNavLinkClick(
    event: ReactMouseEvent<HTMLAnchorElement>,
    {href, onClick, router}: NavigateLinkOptions,
): void {
    onClick?.();
    if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
    ) {
        return;
    }

    event.preventDefault();
    router.push(href);
}

export type AdminAnchorProps = {
    href: string;
    children: ReactNode;
    style?: CSSProperties;
    title?: string;
    onClick?: () => void;
};
