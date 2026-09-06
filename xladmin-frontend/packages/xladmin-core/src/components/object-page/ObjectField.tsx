'use client';

import {memo, useCallback} from 'react';
import type {AdminClient} from '@xladmin-core/client';
import type {AdminFieldMeta} from '@xladmin-core/types';
import {FieldEditor} from '@xladmin-core/components/FieldEditor';

type ObjectFieldProps = {
    field: AdminFieldMeta;
    value: unknown;
    slug: string;
    client: AdminClient;
    readOnly: boolean;
    onFieldChange: (fieldName: string, nextValue: unknown) => void;
};

export const ObjectField = memo(function ObjectField({
                                                         field,
                                                         value,
                                                         slug,
                                                         client,
                                                         readOnly,
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
            readOnly={readOnly}
            onChange={handleChange}
        />
    );
});
