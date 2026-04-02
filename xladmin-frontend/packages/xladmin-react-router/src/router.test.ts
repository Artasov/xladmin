import {describe, expect, it, vi} from 'vitest';
import {createReactRouterAdminRouter} from './index';

describe('createReactRouterAdminRouter', () => {
    it('maps navigation methods and current location', () => {
        const push = vi.fn();
        const replace = vi.fn();
        const back = vi.fn();
        const router = createReactRouterAdminRouter({
            pathname: '/admin/posts',
            search: '?sort=-id',
            push,
            replace,
            back,
        });

        expect(router.getLocation()).toEqual({
            pathname: '/admin/posts',
            search: '?sort=-id',
        });

        router.push('/admin/users');
        router.replace('/admin/users?page=3');
        router.back();

        expect(push).toHaveBeenCalledWith('/admin/users');
        expect(replace).toHaveBeenCalledWith('/admin/users?page=3');
        expect(back).toHaveBeenCalledTimes(1);
    });
});
