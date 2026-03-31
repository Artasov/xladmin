import {act, createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useRemoteChoices} from './useRemoteChoices';

describe('useRemoteChoices', () => {
    beforeEach(() => {
        (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    });

    it('preserves loaded items when initial items are re-created empty for the same reset key', async () => {
        const container = document.createElement('div');
        const root = createRoot(container);
        const loadedItems = [{value: '1', label: 'Admin'}];
        const load = vi.fn().mockResolvedValue(loadedItems);

        function TestComponent({initialItems}: { initialItems: typeof loadedItems }) {
            const {items} = useRemoteChoices({
                enabled: true,
                debounceMs: 0,
                initialItems,
                resetKey: 'users:role_id',
                queryKey: 'users:role_id::',
                load,
            });

            return createElement('div', null, items.map((item) => item.label).join(','));
        }

        await act(async () => {
            root.render(createElement(TestComponent, {initialItems: []}));
        });
        await flushAsyncEffects();

        expect(container.textContent).toBe('Admin');
        expect(load).toHaveBeenCalledTimes(1);

        await act(async () => {
            root.render(createElement(TestComponent, {initialItems: []}));
        });
        expect(container.textContent).toBe('Admin');
        expect(load).toHaveBeenCalledTimes(1);

        await act(async () => {
            root.unmount();
        });
    });
});

async function flushAsyncEffects(): Promise<void> {
    await act(async () => {
        await new Promise((resolve) => {
            window.setTimeout(resolve, 5);
        });
    });
}
