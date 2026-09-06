import {act, StrictMode, useLayoutEffect} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {readOnlyFixture} from '../read-only-fixtures';
import {useAdminFormSession} from './useAdminFormSession';

type Options = Parameters<typeof useAdminFormSession>[0];
let root: Root;
let container: HTMLDivElement;
let session: ReturnType<typeof useAdminFormSession>;
let options: Options;

function Harness({value}: {value: Options}) {
    const current = useAdminFormSession(value);
    useLayoutEffect(() => {session = current;}, [current]);
    return null;
}
async function render(changes: Partial<Options> = {}) {
    options = {...options, ...changes};
    await act(async () => root.render(<StrictMode><Harness value={options}/></StrictMode>));
}

beforeEach(() => {
    Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
    const {client, meta} = readOnlyFixture(false);
    options = {client, fields: meta.fields, initialValues: {name: 'Initial'}, identity: 'ledger:1', open: true, onClose: vi.fn(), errorFallback: 'Failed'};
    container = document.createElement('div');
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
});

describe('form session callbacks', () => {
    it('invalidates callbacks synchronously on close, before the parent renders', async () => {
        await render();
        const operation = vi.fn(async () => {});
        const success = vi.fn();
        await act(async () => {
            session.close();
            session.changeField('name', 'Late edit');
            session.requestPickerOpen('date');
            await session.submit(operation, success);
        });
        expect(options.onClose).toHaveBeenCalledTimes(1);
        expect(session.values.name).toBe('Initial');
        expect(session.openPickerFieldName).toBeNull();
        expect(operation).not.toHaveBeenCalled();
        expect(success).not.toHaveBeenCalled();
    });

    it('blocks duplicate direct submits and edits before a busy render', async () => {
        await render();
        let resolve!: () => void;
        const operation = vi.fn(() => new Promise<void>((done) => {resolve = done;}));
        const success = vi.fn();
        let pending!: Promise<void>;
        await act(async () => {
            pending = session.submit(operation, success);
            session.changeField('name', 'Too late');
            await session.submit(operation, success);
        });
        expect(operation).toHaveBeenCalledTimes(1);
        expect(session.values.name).toBe('Initial');
        await act(async () => {resolve(); await pending;});
        expect(success).toHaveBeenCalledTimes(1);
    });

    it('ignores a pending submit after unmount', async () => {
        await render();
        let resolve!: () => void;
        const success = vi.fn();
        let pending!: Promise<void>;
        await act(async () => {pending = session.submit(() => new Promise<void>((done) => {resolve = done;}), success);});
        await act(async () => root.render(null));
        await act(async () => {resolve(); await pending;});
        expect(success).not.toHaveBeenCalled();
        expect(options.onClose).not.toHaveBeenCalled();
    });

    it('cancels pending pickers and ignores their callbacks after the session changes', async () => {
        let callback!: FrameRequestCallback;
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((next) => {callback = next; return 31;});
        const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        await render();
        await act(async () => {session.requestPickerOpen('first'); session.requestPickerOpen('second');});
        // Closing the old picker must not cancel the requested new picker.
        await act(async () => session.requestPickerClose('first'));
        expect(cancel).not.toHaveBeenCalled();
        await render({identity: 'ledger:2'});
        expect(cancel).toHaveBeenCalledWith(31);
        await act(async () => callback(0));
        expect(session.openPickerFieldName).toBeNull();
    });
});
