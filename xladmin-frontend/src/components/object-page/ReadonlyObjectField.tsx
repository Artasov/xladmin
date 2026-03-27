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
    return (
        <TextField
            label={field.label}
            value={value}
            size="small"
            fullWidth
            disabled
            helperText={field.help_text ?? undefined}
        />
    );
});
