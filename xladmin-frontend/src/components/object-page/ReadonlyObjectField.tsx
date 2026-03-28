'use client';

import {memo} from 'react';
import {TextField} from '@mui/material';
import type {AdminFieldMeta} from '../../types';

type ReadonlyObjectFieldProps = {
    field: AdminFieldMeta;
    value: string;
};

export const ReadonlyObjectField = memo(function ReadonlyObjectField({
    field,
    value,
}: ReadonlyObjectFieldProps) {
    const isMultiline = (
        field.input_kind === 'textarea'
        || field.input_kind === 'json'
        || field.type.toLowerCase().includes('text')
        || value.includes('\n')
        || value.length > 120
    );

    return (
        <TextField
            label={field.label}
            value={value}
            size="small"
            fullWidth
            disabled
            multiline={isMultiline}
            minRows={isMultiline ? 4 : undefined}
            helperText={field.help_text ?? undefined}
        />
    );
});
