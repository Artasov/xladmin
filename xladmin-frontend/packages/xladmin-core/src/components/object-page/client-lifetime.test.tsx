import {act, useLayoutEffect} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {AdminTranslationKey} from '../../i18n';
import type {AdminDetailResponse, AdminItemResponse} from '../../types';
import {readOnlyFixture} from '../read-only-fixtures';
import {useObjectPageController} from './useObjectPageController';

type Fixture = ReturnType<typeof readOnlyFixture>;
type Controller = ReturnType<typeof useObjectPageController>;
const t = (key: AdminTranslationKey) => key;
let container: HTMLDivElement;
let root: Root;
let controller: Controller;

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

function Harness({fixture}: {fixture: Fixture}) {
    const current = useObjectPageController({client: fixture.client, router: fixture.router, slug: 'ledger', id: '1', listPath: '/admin/ledger', t});
    useLayoutEffect(() => { controller = current; }, [current]);
    return <output>{String(current.values.name ?? '')}</output>;
}

async function render(fixture: Fixture, key: string) {
    await act(async () => root.render(<Harness fixture={fixture} key={key}/>));
}

describe('object controller scope lifetime', () => {
    it('remounting the workspace clears drafts even when the new tenant has the same object ID', async () => {
        const first = readOnlyFixture(false);
        const second = readOnlyFixture(false);
        second.item.name = 'Second tenant';
        await render(first, 'tenant-10');
        await act(async () => controller.handleFieldChange('name', 'Unsaved draft'));
        const previous = controller;
        expect(controller.isDirty).toBe(true);
        await render(second, 'tenant-20');
        expect(container.textContent).toBe('Second tenant');
        expect(controller.isDirty).toBe(false);
        await act(async () => previous.handleSave());
        expect(first.client.patchItem).not.toHaveBeenCalled();
        expect(second.client.patchItem).not.toHaveBeenCalled();
    });

    it('ignores a late read from the previous workspace', async () => {
        const first = readOnlyFixture(false);
        const second = readOnlyFixture(false);
        second.item.name = 'Second tenant';
        let resolve!: (value: AdminDetailResponse) => void;
        vi.mocked(first.client.getItem).mockImplementation(() => new Promise((done) => { resolve = done; }));
        await render(first, 'tenant-10');
        await render(second, 'tenant-20');
        await act(async () => resolve(first.detail));
        expect(container.textContent).toBe('Second tenant');
        expect(controller.values.name).toBe('Second tenant');
    });

    it('does not navigate after a pending delete completes in an unmounted workspace', async () => {
        const first = readOnlyFixture(false);
        const second = readOnlyFixture(false);
        let resolve!: () => void;
        vi.mocked(first.client.deleteItem).mockImplementation(() => new Promise((done) => { resolve = done; }));
        await render(first, 'tenant-10');
        let pending!: Promise<void>;
        await act(async () => controller.handleOpenDeletePreview());
        await act(async () => { pending = controller.handleDelete(); });
        await render(second, 'tenant-20');
        await act(async () => { resolve(); await pending; });
        expect(first.router.push).not.toHaveBeenCalled();
        expect(second.router.push).not.toHaveBeenCalled();
    });

    it('does not apply a pending save to the new workspace', async () => {
        const first = readOnlyFixture(false);
        const second = readOnlyFixture(false);
        second.item.name = 'Second tenant';
        let resolve!: (value: AdminItemResponse) => void;
        vi.mocked(first.client.patchItem).mockImplementation(() => new Promise((done) => { resolve = done; }));
        await render(first, 'tenant-10');
        await act(async () => controller.handleFieldChange('name', 'Changed'));
        let pending!: Promise<void>;
        await act(async () => { pending = controller.handleSave(); });
        await render(second, 'tenant-20');
        await act(async () => { resolve({item: {id: 1, name: 'Late save'}}); await pending; });
        expect(container.textContent).toBe('Second tenant');
        expect(controller.isDirty).toBe(false);
        expect(second.client.patchItem).not.toHaveBeenCalled();
    });
});
