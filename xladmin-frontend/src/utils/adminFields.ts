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
    pretty?: boolean;
    maxLength?: number;
};

export function formatAdminValue(value: unknown, options?: FormatAdminValueOptions): string {
    const locale = normalizeAdminLocale(options?.locale);
    const maxLength = options?.maxLength;

    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
        return trimAdminValue(
            value.map((item) => formatAdminValue(item, options)).filter(Boolean).join(', '),
            maxLength,
        );
    }
    if (typeof value === 'boolean') {
        return trimAdminValue(value ? translateAdmin(locale, 'yes') : translateAdmin(locale, 'no'), maxLength);
    }
    if (typeof value === 'string') {
        const formattedDateValue = formatDateLikeValue(value, locale, options?.field);
        if (formattedDateValue !== null) {
            return trimAdminValue(formattedDateValue, maxLength);
        }
        return trimAdminValue(value, maxLength);
    }
    if (typeof value === 'object') {
        const indentation = options?.pretty ? 2 : 0;
        return trimAdminValue(JSON.stringify(value, null, indentation), maxLength);
    }
    return trimAdminValue(String(value), maxLength);
}

export function getListFieldWidthPx(field: AdminFieldMeta | undefined): number {
    if (field?.width_px && field.width_px > 0) {
        return field.width_px;
    }
    if (!field) {
        return 180;
    }
    if (field.display_kind === 'image') {
        return 96;
    }

    const normalizedType = field.type.toLowerCase();
    const normalizedInputKind = field.input_kind.toLowerCase();

    if (normalizedInputKind === 'json' || normalizedType.includes('json')) {
        return 420;
    }
    if (normalizedInputKind === 'textarea' || normalizedType.includes('text')) {
        return 360;
    }
    if (field.is_virtual && normalizedInputKind === 'text') {
        return 360;
    }
    if (field.is_primary_key || normalizedType.includes('uuid')) {
        return 240;
    }
    if (normalizedInputKind === 'datetime') {
        return 190;
    }
    if (normalizedInputKind === 'date') {
        return 160;
    }
    if (normalizedInputKind === 'boolean') {
        return 120;
    }
    if (field.is_relation) {
        return 240;
    }
    return 220;
}

export function resolveAdminMediaUrl(
    value: unknown,
    field?: Pick<AdminFieldMeta, 'image_url_prefix'>,
): string | null {
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }

    const normalizedValue = value.trim();
    if (/^(?:https?:)?\/\//i.test(normalizedValue) || normalizedValue.startsWith('data:') || normalizedValue.startsWith('blob:')) {
        return normalizedValue;
    }

    const imageUrlPrefix = field?.image_url_prefix?.trim();
    if (imageUrlPrefix) {
        const normalizedPrefix = imageUrlPrefix.endsWith('/') ? imageUrlPrefix.slice(0, -1) : imageUrlPrefix;
        const normalizedPath = normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`;
        return `${normalizedPrefix}${normalizedPath}`;
    }

    return normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`;
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

function trimAdminValue(value: string, maxLength: number | undefined): string {
    if (!maxLength || value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength).trimEnd()}…`;
}
