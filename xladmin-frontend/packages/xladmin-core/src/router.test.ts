import {act, createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
    type AdminLocation,
    type AdminRouter,
    buildUrlWithParams,
    createBrowserAdminRouter,
    useAdminLocation
} from './router';

describe('router helpers', () => {
    beforeEach(() => {
        window.history.replaceState(window.history.state, '', '/admin');
        (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    });

    it('builds urls from admin params', () => {
        expect(buildUrlWithParams('/admin/users', 'alpha', '-id', 2, {status: 'true'}))
            .toBe('/admin/users?q=alpha&sort=-id&page=2&status=true');
    });

    it('updates browser location and notifies listeners', () => {
        const router = createBrowserAdminRouter(window);
        const listener = vi.fn();
        const unsubscribe = router.subscribe(listener);

        router.replace('/admin/users?q=alpha');
        router.push('/admin/users/1');

        expect(window.location.pathname).toBe('/admin/users/1');
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
    });

    it('updates hook consumers when router location changes', () => {
        let currentLocation: AdminLocation = {pathname: '/admin/users', search: ''};
        const listeners = new Set<() => void>();
        const router: AdminRouter = {
            getLocation: () => ({...currentLocation}),
            subscribe: (listener) => {
                listeners.add(listener);
                return () => {
                    listeners.delete(listener);
                };
            },
            push: vi.fn(),
            replace: vi.fn(),
            back: vi.fn(),
        };

        const container = document.createElement('div');
        const root = createRoot(container);

        function TestComponent() {
            const location = useAdminLocation(router);
            return createElement('div', null, `${location.pathname}${location.search}`);
        }

        act(() => {
            root.render(createElement(TestComponent));
        });
        expect(container.textContent).toBe('/admin/users');

        act(() => {
            currentLocation = {pathname: '/admin/roles', search: '?page=2'};
            for (const listener of listeners) {
                listener();
            }
        });
        expect(container.textContent).toBe('/admin/roles?page=2');

        act(() => {
            root.unmount();
        });
    });
});
