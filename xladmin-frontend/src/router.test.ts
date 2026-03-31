import {beforeEach, describe, expect, it, vi} from 'vitest';
import {buildUrlWithParams, createBrowserXLAdminRouter} from './router';

describe('router helpers', () => {
    beforeEach(() => {
        window.history.replaceState(window.history.state, '', '/admin');
    });

    it('builds urls from admin params', () => {
        expect(buildUrlWithParams('/admin/users', 'alpha', '-id', 2, {status: 'true'}))
            .toBe('/admin/users?q=alpha&sort=-id&page=2&status=true');
    });

    it('updates browser location and notifies listeners', () => {
        const router = createBrowserXLAdminRouter(window);
        const listener = vi.fn();
        const unsubscribe = router.subscribe(listener);

        router.replace('/admin/users?q=alpha');
        router.push('/admin/users/1');

        expect(window.location.pathname).toBe('/admin/users/1');
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
    });
});
