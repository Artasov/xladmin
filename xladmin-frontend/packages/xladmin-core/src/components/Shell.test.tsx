import {act, createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {AdminClient} from '../client';
import type {AdminRouter} from '../router';
import {MainHeader} from './layout/MainHeader';
import {Shell} from './Shell';

describe('Shell', () => {
    beforeEach(() => {
        (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: query.includes('min-width:1200px'),
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
    });

    it('keeps the menu button available while toggling the desktop sidebar', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        await act(async () => {
            root.render(createElement(
                Shell,
                {
                    client: {} as AdminClient,
                    models: [],
                    blocks: [],
                    basePath: '/admin',
                    locale: 'en',
                    currentUser: null,
                    router: createTestRouter(),
                    children: createElement(MainHeader, {title: 'Overview'}),
                },
            ));
        });

        const menuButton = container.querySelector<HTMLButtonElement>('button[aria-label="Menu"]');
        expect(menuButton).not.toBeNull();
        expect(menuButton?.getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('#xladmin-desktop-sidebar')).not.toBeNull();

        await act(async () => {
            menuButton?.click();
        });

        expect(container.querySelector('button[aria-label="Menu"]')).toBe(menuButton);
        expect(menuButton?.getAttribute('aria-expanded')).toBe('false');
        expect(container.querySelector('#xladmin-desktop-sidebar')).toBeNull();

        await act(async () => {
            menuButton?.click();
        });

        expect(menuButton?.getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('#xladmin-desktop-sidebar')).not.toBeNull();

        await act(async () => {
            root.unmount();
        });
        container.remove();
    });
});

function createTestRouter(): AdminRouter {
    return {
        getLocation: () => ({pathname: '/admin', search: ''}),
        subscribe: () => () => {
        },
        push: () => {
        },
        replace: () => {
        },
        back: () => {
        },
    };
}
