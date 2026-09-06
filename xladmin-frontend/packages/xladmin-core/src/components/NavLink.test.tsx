import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {AdminRouterProvider, createBrowserAdminRouter, type AdminRouter} from '../router';
import {NavLink} from './NavLink';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
});

function scopedRouter(tenant: number): AdminRouter {
    return {
        ...createBrowserAdminRouter(window),
        resolveHref: (href) => {
            const url = new URL(href, window.location.origin);
            url.searchParams.set('tenant_id', String(tenant));
            return `${url.pathname}${url.search}${url.hash}`;
        },
        push: vi.fn(),
    };
}

describe('resolved navigation links', () => {
    it('renders the scoped native href on the server', () => {
        const html = renderToStaticMarkup(<NavLink router={scopedRouter(10)} href="/admin/products/1?q=name#details">Product</NavLink>);
        expect(html).toContain('href="/admin/products/1?q=name&amp;tenant_id=10#details"');
    });

    it('uses the same resolved href for normal navigation', async () => {
        const router = scopedRouter(10);
        await act(async () => root.render(<NavLink router={router} href="/admin/products/1">Product</NavLink>));
        const link = container.querySelector('a')!;
        const event = new MouseEvent('click', {bubbles: true, cancelable: true});
        await act(async () => link.dispatchEvent(event));
        expect(event.defaultPrevented).toBe(true);
        expect(router.push).toHaveBeenCalledWith(link.getAttribute('href'));
    });

    it.each([{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {button: 1}])('preserves native behavior for %j', async (modifiers) => {
        const router = scopedRouter(10);
        await act(async () => root.render(<NavLink router={router} href="/admin/products/1">Product</NavLink>));
        const link = container.querySelector('a')!;
        const event = new MouseEvent('click', {bubbles: true, cancelable: true, ...modifiers});
        // Observe React's decision, then stop only jsdom's unsupported native navigation.
        let interceptedByComponent: boolean | undefined;
        document.addEventListener('click', (nativeEvent) => {
            interceptedByComponent = nativeEvent.defaultPrevented;
            nativeEvent.preventDefault();
        }, {once: true});
        await act(async () => link.dispatchEvent(event));
        expect(interceptedByComponent).toBe(false);
        expect(router.push).not.toHaveBeenCalled();
        expect(link.getAttribute('href')).toBe('/admin/products/1?tenant_id=10');
    });

    it('updates href when the contextual router changes and leaves default URLs intact', async () => {
        const render = (router: AdminRouter) => act(async () => root.render(
            <AdminRouterProvider router={router}><NavLink href="/admin/products/1">Product</NavLink></AdminRouterProvider>,
        ));
        await render(scopedRouter(10));
        expect(container.querySelector('a')?.getAttribute('href')).toBe('/admin/products/1?tenant_id=10');
        await render(scopedRouter(20));
        expect(container.querySelector('a')?.getAttribute('href')).toBe('/admin/products/1?tenant_id=20');
        await render(createBrowserAdminRouter(window));
        expect(container.querySelector('a')?.getAttribute('href')).toBe('/admin/products/1');
    });
});
