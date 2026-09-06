import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {AdminClient} from '../client';
import type {AdminRouter} from '../router';
import {MainHeader} from './layout/MainHeader';
import {Shell} from './Shell';

describe('Shell', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    beforeEach(() => {
        (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        const stored = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => stored.get(key) ?? null,
            setItem: (key: string, value: string) => { stored.set(key, value); },
            removeItem: (key: string) => { stored.delete(key); },
            clear: () => stored.clear(),
            key: (index: number) => [...stored.keys()][index] ?? null,
            get length() { return stored.size; },
        } satisfies Storage);
        vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
            matches: query.includes('min-width:1200px'),
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })));
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    it('keeps the menu button available while toggling the desktop sidebar', async () => {
        await act(async () => {
            root.render(
                <Shell client={{} as AdminClient} models={[]} blocks={[]} basePath="/admin"
                    locale="en" currentUser={null} router={createTestRouter()}>
                    <MainHeader title="Overview"/>
                </Shell>,
            );
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

    });
});

function createTestRouter(): AdminRouter {
    return {
        resolveHref: (href) => href,
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
