import {act, StrictMode, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AdminLocaleProvider, translateAdmin} from '../../i18n';
import {ActionFormDialog} from '../ActionFormDialog';
import {FormDialog} from '../FormDialog';
import {readOnlyFixture} from '../read-only-fixtures';

const messages = vi.hoisted(() => ({success: vi.fn(), error: vi.fn()}));
vi.mock('../layout/AdminMessageContext', () => ({useAdminMessage: () => messages}));
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

async function render(node: ReactNode) {
    await act(async () => root.render(<StrictMode><AdminLocaleProvider locale="en">{node}</AdminLocaleProvider></StrictMode>));
}

function input() { return document.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea:not([aria-hidden="true"])')!; }
function button(text: string) {
    return Array.from(document.querySelectorAll('button')).find((item) => item.textContent === text)!;
}
async function edit(value: string) {
    await act(async () => {
        const prototype = input() instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input(), value);
        input().dispatchEvent(new Event('input', {bubbles: true}));
    });
}
function deferred() {
    let resolve!: () => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<void>((done, fail) => {resolve = done; reject = fail;});
    return {promise, resolve, reject};
}

describe.each(['model', 'action'] as const)('%s form session', (kind) => {
    function setup() {
        const fixture = readOnlyFixture(false);
        fixture.meta.fields = fixture.meta.fields.map((field) => ({...field, type: 'varchar'}));
        const onSuccess = vi.fn();
        const onClose = vi.fn();
        const operation = vi.fn(async (_payload: Record<string, unknown>) => {});
        vi.mocked(fixture.client.patchItem).mockImplementation(async (_slug, _id, payload) => {
            await operation(payload);
            return fixture.detail;
        });
        const draw = (options: {open?: boolean; client?: typeof fixture.client; id?: number; name?: string; json?: boolean} = {}) => {
            const {open = true, client = fixture.client, id = 1, name = 'Receipt'} = options;
            // Deliberately recreate metadata and initialValues on every render.
            const common = {open, client, onClose, onSuccess, slug: 'ledger', title: 'Edit', initialValues: {name}};
            const fields = fixture.meta.fields.map((field) => ({...field, input_kind: options.json ? 'json' as const : field.input_kind}));
            return render(kind === 'model'
                ? <FormDialog {...common} mode="patch" itemId={id} meta={{...fixture.meta, fields}}/>
                : <ActionFormDialog {...common} locale="en" fields={fields.map((field) => ({...field, placeholder: null, options: [], auto_now: false}))}
                    choiceScope={{kind: 'object-action', actionSlug: 'recalculate', itemId: id}} onSubmit={operation}/>);
        };
        return {fixture, operation, onClose, onSuccess, draw};
    }

    it('preserves dirty fields when metadata and initial values are refreshed', async () => {
        const state = setup();
        await state.draw();
        await edit('Unsaved');
        await state.draw({name: 'Server update'});
        expect(input().value).toBe('Unsaved');
        await act(async () => button('Save').click());
        expect(state.operation).toHaveBeenCalledWith({name: 'Unsaved'});
        expect(state.onSuccess).toHaveBeenCalledTimes(1);
        expect(state.onClose).toHaveBeenCalledTimes(1);
    });

    it('resets internal editor drafts on a quick close and reopen with unchanged values', async () => {
        const state = setup();
        await state.draw({json: true, name: '{}'});
        await edit('{unfinished');
        expect(input().value).toBe('{unfinished');
        await state.draw({open: false, json: true, name: '{}'});
        await state.draw({json: true, name: '{}'});
        expect(input().value).toBe('{}');
    });

    it('keeps one in-flight operation locked across rerenders', async () => {
        const state = setup();
        const pending = deferred();
        state.operation.mockReturnValue(pending.promise);
        await state.draw();
        await act(async () => {button('Save').click(); button('Save')?.click();});
        await state.draw();
        expect(button(translateAdmin('en', 'saving')).disabled).toBe(true);
        expect(input().readOnly || input().disabled).toBe(true);
        expect(state.operation).toHaveBeenCalledTimes(1);
        await act(async () => {pending.resolve(); await pending.promise;});
        expect(state.onSuccess).toHaveBeenCalledTimes(1);
    });

    it('does not close a reopened form after the previous save resolves', async () => {
        const state = setup();
        const pending = deferred();
        state.operation.mockReturnValue(pending.promise);
        await state.draw();
        await act(async () => button('Save').click());
        await state.draw({open: false});
        await state.draw({name: 'Reopened'});
        await edit('New draft');
        await act(async () => {pending.resolve(); await pending.promise;});
        expect(input().value).toBe('New draft');
        expect(button('Save').disabled).toBe(false);
        expect(state.onSuccess).not.toHaveBeenCalled();
        expect(state.onClose).not.toHaveBeenCalled();
        expect(messages.success).not.toHaveBeenCalled();
    });

    it('does not clear the busy state of a new opening when an old request finishes', async () => {
        const state = setup();
        const first = deferred();
        const second = deferred();
        state.operation.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        await state.draw();
        await act(async () => button('Save').click());
        await state.draw({open: false});
        await state.draw({name: 'New opening'});
        await act(async () => button('Save').click());
        await act(async () => {first.resolve(); await first.promise;});
        expect(button(translateAdmin('en', 'saving')).disabled).toBe(true);
        expect(state.onSuccess).not.toHaveBeenCalled();
        await act(async () => {second.resolve(); await second.promise;});
        expect(state.onSuccess).toHaveBeenCalledTimes(1);
    });

    it('ignores a rejection from a replaced client', async () => {
        const state = setup();
        const pending = deferred();
        state.operation.mockReturnValue(pending.promise);
        await state.draw();
        await act(async () => button('Save').click());
        await state.draw({client: readOnlyFixture(false).client, name: 'Other tenant'});
        await act(async () => {pending.reject(new Error('Old failure')); await pending.promise.catch(() => {});});
        expect(input().value).toBe('Other tenant');
        expect(button('Save').disabled).toBe(false);
        expect(document.querySelector('[role="alert"]')).toBeNull();
        expect(messages.error).not.toHaveBeenCalled();
    });

    it('invalidates an operation when the target object changes', async () => {
        const state = setup();
        const pending = deferred();
        state.operation.mockReturnValue(pending.promise);
        await state.draw();
        await act(async () => button('Save').click());
        await state.draw({id: 2, name: 'Other object'});
        await act(async () => {pending.resolve(); await pending.promise;});
        expect(input().value).toBe('Other object');
        expect(state.onSuccess).not.toHaveBeenCalled();
        expect(state.onClose).not.toHaveBeenCalled();
    });

    it('keeps an active failed draft editable and allows retry', async () => {
        const state = setup();
        state.operation.mockRejectedValueOnce(new Error('Save failed'));
        await state.draw();
        await edit('Retry this');
        await act(async () => button('Save').click());
        expect(input().value).toBe('Retry this');
        expect(document.querySelector('[role="alert"]')?.textContent).toBe('Save failed');
        expect(state.onClose).not.toHaveBeenCalled();
        await act(async () => button('Save').click());
        expect(state.operation).toHaveBeenCalledTimes(2);
        expect(state.onSuccess).toHaveBeenCalledTimes(1);
    });
});

it('creates a model with its draft payload and confirms completion once', async () => {
    const {client, meta} = readOnlyFixture(false);
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    await render(<FormDialog open client={client} meta={meta} mode="create" initialValues={{name: 'New record'}} slug="ledger" title="Create" onClose={onClose} onSuccess={onSuccess}/>);
    await edit('Created draft');
    await act(async () => button('Save').click());
    expect(client.createItem).toHaveBeenCalledWith('ledger', {name: 'Created draft'});
    expect(client.patchItem).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
});

it('cannot report success for a patch without an object ID, but can cancel', async () => {
    const {client, meta} = readOnlyFixture(false);
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    await render(<FormDialog open client={client} meta={meta} mode="patch" slug="ledger" title="Edit" onClose={onClose} onSuccess={onSuccess}/>);
    expect(button('Save').disabled).toBe(true);
    await act(async () => button('Cancel').click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(client.patchItem).not.toHaveBeenCalled();
});
