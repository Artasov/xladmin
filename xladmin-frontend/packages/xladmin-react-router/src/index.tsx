'use client';

import {useEffect, useRef} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import type {AdminRouter} from 'xladmin';

export type ReactRouterAdminAdapter = {
    pathname: string;
    search: string;
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
};

export function createReactRouterAdminRouter(adapter: ReactRouterAdminAdapter): AdminRouter {
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

export function useReactRouterAdminRouter(): AdminRouter {
    const location = useLocation();
    const navigate = useNavigate();
    const listenersRef = useRef(new Set<() => void>());
    const locationRef = useRef({
        pathname: location.pathname,
        search: location.search,
    });
    const previousLocationRef = useRef(locationRef.current);
    const navigateRef = useRef(navigate);
    const routerRef = useRef<AdminRouter | null>(null);

    locationRef.current = {
        pathname: location.pathname,
        search: location.search,
    };
    navigateRef.current = navigate;

    if (routerRef.current === null) {
        routerRef.current = createReactRouterAdminRouter({
            pathname: locationRef.current.pathname,
            search: locationRef.current.search,
            push: (href: string) => {
                navigateRef.current(href);
            },
            replace: (href: string) => {
                navigateRef.current(href, {replace: true});
            },
            back: () => {
                navigateRef.current(-1);
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
    }, [location.pathname, location.search]);

    return routerRef.current;
}
