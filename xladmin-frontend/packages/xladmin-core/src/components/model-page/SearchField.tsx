'use client';

import {memo, useEffect, useState} from 'react';
import {TextField} from '@mui/material';

type SearchFieldProps = {
    value: string;
    onCommit: (value: string) => void;
    debounceMs: number;
    placeholder?: string;
};

export const SearchField = memo(function SearchField({
                                                         value,
                                                         onCommit,
                                                         debounceMs,
                                                         placeholder,
                                                     }: SearchFieldProps) {
    const [draftValue, setDraftValue] = useState(value);

    useEffect(() => {
        setDraftValue(value);
    }, [value]);

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            if (draftValue !== value) {
                onCommit(draftValue);
            }
        }, debounceMs);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [debounceMs, draftValue, onCommit, value]);

    return (
        <TextField
            size="small"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            placeholder={placeholder}
            sx={{minWidth: {xs: '100%', lg: 360}}}
            slotProps={{
                htmlInput: {
                    autoComplete: 'off',
                    name: 'admin-search',
                },
            }}
        />
    );
});
