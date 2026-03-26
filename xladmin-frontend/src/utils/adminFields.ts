import type {AdminFieldMeta} from '../types';

/**
 * Готовит payload для create/patch так, чтобы nullable-поля можно было очищать,
 * а служебные пустые поля вроде пароля не улетали в API без необходимости.
 */
export function buildAdminPayload(
    values: Record<string, unknown>,
    fields: AdminFieldMeta[],
) : Record<string, unknown> {
    const fieldMap = new Map(fields.map((field) => [field.name, field]));
    const payload: Record<string, unknown> = {};

    for (const [fieldName, value] of Object.entries(values)) {
        const field = fieldMap.get(fieldName);
        if (!field) {
            continue;
        }
        if (value === undefined) {
            continue;
        }
        if (value === '' && field.input_kind === 'password') {
            continue;
        }
        if (value === '' && field.nullable) {
            payload[fieldName] = null;
            continue;
        }
        if (value === '') {
            continue;
        }
        payload[fieldName] = value;
    }

    return payload;
}


export function formatAdminValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    if (Array.isArray(value)) {
        return value.map((item) => formatAdminValue(item)).filter(Boolean).join(', ');
    }
    if (typeof value === 'boolean') {
        return value ? 'Да' : 'Нет';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}
