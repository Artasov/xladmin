import {act, createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {AdminClient} from '@xladmin-core/client';
import {FieldEditor} from './FieldEditor';

describe('FieldEditor', () => {
    beforeEach(() => {
        (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    });

    it('does not reload choices endlessly when using the default model choice scope', async () => {
        const container = document.createElement('div');
        const root = createRoot(container);
        const getChoices = vi.fn().mockResolvedValue({
            items: [{id: '1', label: 'One'}],
        });
        const client = {
            getChoices,
            getBulkActionChoices: vi.fn(),
            getObjectActionChoices: vi.fn(),
        } as unknown as AdminClient;

        await act(async () => {
            root.render(createElement(FieldEditor, {
                field: {
                    name: 'interview_id',
                    label: 'Interview',
                    help_text: null,
                    required: true,
                    placeholder: null,
                    nullable: false,
                    read_only: false,
                    type: 'text',
                    input_kind: 'relation',
                    has_choices: true,
                    is_relation_many: false,
                    options: [],
                    auto_now: false,
                },
                value: null,
                onChange: vi.fn(),
                slug: 'interviews-interview-result',
                client,
            }));
        });

        await flushAsyncEffects();
        await flushAsyncEffects();

        expect(getChoices).toHaveBeenCalledTimes(1);

        await act(async () => {
            root.unmount();
        });
    });
});

async function flushAsyncEffects(): Promise<void> {
    await act(async () => {
        await new Promise((resolve) => {
            window.setTimeout(resolve, 300);
        });
    });
}
