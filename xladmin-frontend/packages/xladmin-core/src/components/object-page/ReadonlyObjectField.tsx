'use client';

import {memo} from 'react';
import {Box, Stack, TextField} from '@mui/material';
import type {AdminFieldMeta} from '../../types';

type ReadonlyObjectFieldProps = {
    field: AdminFieldMeta;
    value: string;
    imageUrl?: string | null;
};

export const ReadonlyObjectField = memo(function ReadonlyObjectField({
                                                                         field,
                                                                         value,
                                                                         imageUrl,
                                                                     }: ReadonlyObjectFieldProps) {
    const isMultiline = (
        field.input_kind === 'textarea'
        || field.input_kind === 'json'
        || field.type.toLowerCase().includes('text')
        || value.includes('\n')
        || value.length > 120
    );

    return (
        <Stack spacing={1}>
            {imageUrl ? (
                <Box
                    component="img"
                    src={imageUrl}
                    alt={field.label}
                    sx={{
                        display: 'block',
                        width: 160,
                        maxWidth: '100%',
                        maxHeight: 160,
                        objectFit: 'cover',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(255,255,255,0.04)',
                    }}
                />
            ) : null}
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
        </Stack>
    );
});
