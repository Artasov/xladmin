'use client';

import {memo, useCallback} from 'react';
import type {XLAdminClient} from '../../client';
import type {AdminFieldMeta} from '../../types';
import {FieldEditor} from '../FieldEditor';

type ObjectFieldProps = {
    field: AdminFieldMeta;
    value: unknown;
    slug: string;
    client: XLAdminClient;
    onFieldChange: (fieldName: string, nextValue: unknown) => void;
};

export const ObjectField = memo(function ObjectField({
    field,
    value,
    slug,
    client,
    onFieldChange,
}: ObjectFieldProps) {
    const handleChange = useCallback((nextValue: unknown) => {
        onFieldChange(field.name, nextValue);
    }, [field.name, onFieldChange]);

    return (
        <FieldEditor
            field={field}
            value={value}
            slug={slug}
            client={client}
            onChange={handleChange}
        />
    );
});
