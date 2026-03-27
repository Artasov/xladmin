import {normalizeAdminLocale, translateAdmin} from '../i18n';
import type {AdminFieldMeta, AdminLocale} from '../types';

/**
 * Готовит payload для create/patch так, чтобы nullable-поля можно было очищать,
 * а служебные пустые поля вроде пароля не улетали в API без необходимости.
 */
export function buildAdminPayload(
    values: Record<string, unknown>,
    fields: AdminFieldMeta[],
): Record<string, unknown> {
    const fieldMap = new Map(fields.map((field) => [field.name, field]));
    const payload: Record<string, unknown> = {};

    for (const [fieldName, value] of Object.entries(values)) {
        const field = fieldMap.get(fieldName);
        if (!field || value === undefined) {
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

type FormatAdminValueOptions = {
    locale?: AdminLocale;
    field?: Pick<AdminFieldMeta, 'input_kind' | 'type'>;
};

export function formatAdminValue(value: unknown, options?: FormatAdminValueOptions): string {
    const locale = normalizeAdminLocale(options?.locale);

    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
        return value.map((item) => formatAdminValue(item, options)).filter(Boolean).join(', ');
    }
    if (typeof value === 'boolean') {
        return value ? translateAdmin(locale, 'yes') : translateAdmin(locale, 'no');
    }
    if (typeof value === 'string') {
        const formattedDateValue = formatDateLikeValue(value, locale, options?.field);
        if (formattedDateValue !== null) {
            return formattedDateValue;
        }
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

function formatDateLikeValue(
    value: string,
    locale: AdminLocale,
    field?: Pick<AdminFieldMeta, 'input_kind' | 'type'>,
): string | null {
    const normalizedInputKind = field?.input_kind.toLowerCase();
    const normalizedFieldType = field?.type.toLowerCase();

    if (normalizedInputKind === 'date' || isDateOnlyValue(value)) {
        const date = new Date(`${value}T00:00:00`);
        if (!Number.isNaN(date.getTime())) {
            return new Intl.DateTimeFormat(resolveIntlLocale(locale), {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(date);
        }
    }

    const shouldFormatDateTime = normalizedInputKind === 'datetime'
        || normalizedFieldType?.includes('datetime')
        || isDateTimeValue(value);
    if (!shouldFormatDateTime) {
        return null;
    }

    const dateTime = new Date(value);
    if (Number.isNaN(dateTime.getTime())) {
        return null;
    }

    return new Intl.DateTimeFormat(resolveIntlLocale(locale), {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(dateTime);
}

function isDateOnlyValue(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isDateTimeValue(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function resolveIntlLocale(locale: AdminLocale): string {
    return locale === 'en' ? 'en-US' : 'ru-RU';
}
