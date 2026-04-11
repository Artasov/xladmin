import {describe, expect, it, vi} from 'vitest';
import {buildAdminFormInitialValues, buildAdminPayload} from './adminFields';

describe('buildAdminPayload', () => {
    it('omits empty passwords and clears nullable empty fields', () => {
        const payload = buildAdminPayload(
            {
                username: 'alpha',
                password: '',
                bio: '',
            },
            [
                {name: 'username', input_kind: 'text', nullable: false},
                {name: 'password', input_kind: 'password', nullable: false},
                {name: 'bio', input_kind: 'textarea', nullable: true},
            ] as never,
        );

        expect(payload).toEqual({
            username: 'alpha',
            bio: null,
        });
    });

    it('prefills auto_now date and datetime fields', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-10T12:34:56Z'));

        const values = buildAdminFormInitialValues(
            [
                {name: 'published_on', input_kind: 'date', auto_now: true},
                {name: 'sent_at', input_kind: 'datetime', auto_now: true},
                {name: 'title', input_kind: 'text', auto_now: false},
            ] as never,
            {title: 'Hello'},
        );

        expect(values.title).toBe('Hello');
        expect(values.published_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(values.sent_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

        vi.useRealTimers();
    });

    it('prefills the first option for required select fields', () => {
        const values = buildAdminFormInitialValues(
            [
                {
                    name: 'scheme',
                    input_kind: 'select',
                    required: true,
                    options: [
                        {value: 'http', label: 'HTTP'},
                        {value: 'socks5h', label: 'SOCKS5H'},
                    ],
                },
            ] as never,
        );

        expect(values.scheme).toBe('http');
    });
});
