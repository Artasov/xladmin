import {describe, expect, it} from 'vitest';
import {buildAdminPayload} from './adminFields';

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
});
