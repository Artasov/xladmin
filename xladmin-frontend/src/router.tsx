'use client';

import type {CSSProperties, MouseEvent as ReactMouseEvent, ReactNode} from 'react';
import {createContext, useContext, useEffect, useMemo, useState} from 'react';

export type XLAdminLocation = {
    pathname: string;
    search: string;
};

export type XLAdminRouter = {
    getLocation: () => XLAdminLocation;
    subscribe: (listener: () => void) => () => void;
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
};

type XLAdminRouterProviderProps = {
    router: XLAdminRouter;
    children: ReactNode;
};

type NavigateLinkOptions = {
    href: string;
    onClick?: () => void;
    router: XLAdminRouter;
};

const XLAdminRouterContext = createContext<XLAdminRouter | null>(null);
let browserRouterInstance: XLAdminRouter | null = null;

export function XLAdminRouterProvider({router, children}: XLAdminRouterProviderProps) {
    return (
        <XLAdminRouterContext.Provider value={router}>
            {children}
        </XLAdminRouterContext.Provider>
    );
}

export function createBrowserXLAdminRouter(browserWindow: Window = window): XLAdminRouter {
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

export function useXLAdminRouter(router?: XLAdminRouter): XLAdminRouter {
    const contextRouter = useContext(XLAdminRouterContext);
    return useMemo(() => {
        if (router) {
            return router;
        }
        if (contextRouter) {
            return contextRouter;
        }
        if (browserRouterInstance === null) {
            browserRouterInstance = createBrowserXLAdminRouter();
        }
        return browserRouterInstance;
    }, [contextRouter, router]);
}

export function useXLAdminLocation(router?: XLAdminRouter): XLAdminLocation {
    const resolvedRouter = useXLAdminRouter(router);
    const [location, setLocation] = useState<XLAdminLocation>(() => resolvedRouter.getLocation());

    useEffect(() => {
        setLocation(resolvedRouter.getLocation());
        return resolvedRouter.subscribe(() => {
            setLocation(resolvedRouter.getLocation());
        });
    }, [resolvedRouter]);

    return location;
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

export type XLAdminAnchorProps = {
    href: string;
    children: ReactNode;
    style?: CSSProperties;
    title?: string;
    onClick?: () => void;
};
