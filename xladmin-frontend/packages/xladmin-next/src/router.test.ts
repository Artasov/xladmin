import {describe, expect, it, vi} from 'vitest';
import {createNextAdminRouter} from './index';

describe('createNextAdminRouter', () => {
    it('maps navigation methods and current location', () => {
        const push = vi.fn();
        const replace = vi.fn();
        const back = vi.fn();
        const router = createNextAdminRouter({
            pathname: '/admin/posts',
            search: '?page=2',
            push,
            replace,
            back,
        });

        expect(router.getLocation()).toEqual({
            pathname: '/admin/posts',
            search: '?page=2',
        });

        router.push('/admin/users');
        router.replace('/admin/users?page=1');
        router.back();

        expect(push).toHaveBeenCalledWith('/admin/users');
        expect(replace).toHaveBeenCalledWith('/admin/users?page=1');
        expect(back).toHaveBeenCalledTimes(1);
    });
});
