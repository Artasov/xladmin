'use client';

import {memo, useEffect, useMemo, useState} from 'react';
import {
    Autocomplete,
    CircularProgress,
    FormControlLabel,
    Switch,
    TextField,
} from '@mui/material';
import {DatePicker, DateTimePicker} from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import type {XLAdminClient} from '../client';
import {useAdminTranslation} from '../i18n';
import type {AdminFieldMeta} from '../types';

type AdminFieldEditorProps = {
    field: AdminFieldMeta;
    value: unknown;
    onChange: (value: unknown) => void;
    slug: string;
    client: XLAdminClient;
    readOnly?: boolean;
};

type RelationOption = {
    id: string | number;
    label: string;
};

export type FieldEditorProps = AdminFieldEditorProps;

export const FieldEditor = memo(function FieldEditor({
    field,
    value,
    onChange,
    slug,
    client,
    readOnly = false,
}: FieldEditorProps) {
    const t = useAdminTranslation();
    const [choices, setChoices] = useState<RelationOption[]>([]);
    const [searchValue, setSearchValue] = useState('');
    const [isLoadingChoices, setIsLoadingChoices] = useState(false);
    const selectedIds = useMemo(() => normalizeSelectedIds(value, field.is_relation_many), [field.is_relation_many, value]);

    useEffect(() => {
        if (!field.has_choices) {
            setChoices([]);
            return;
        }

        let isMounted = true;
        setIsLoadingChoices(true);

        client.getChoices(slug, field.name, searchValue || undefined, selectedIds)
            .then((response) => {
                if (!isMounted) return;
                setChoices((current) => mergeChoices(current, response.items));
            })
            .catch(() => {
                if (!isMounted) return;
                setChoices((current) => current);
            })
            .finally(() => {
                if (!isMounted) return;
                setIsLoadingChoices(false);
            });

        return () => {
            isMounted = false;
        };
    }, [client, field.has_choices, field.name, searchValue, selectedIds, slug]);

    if (field.input_kind === 'boolean') {
        return (
            <FormControlLabel
                control={(
                    <Switch
                        checked={Boolean(value)}
                        disabled={readOnly}
                        onChange={(_, checked) => onChange(checked)}
                    />
                )}
                label={field.label}
            />
        );
    }

    if (field.input_kind === 'date') {
        return (
            <DatePicker
                label={field.label}
                disabled={readOnly}
                value={value ? dayjs(String(value)) : null}
                onChange={(nextValue) => onChange(nextValue ? nextValue.format('YYYY-MM-DD') : null)}
                slotProps={{
                    popper: {disablePortal: true},
                    desktopPaper: buildPickerPaperProps(),
                    mobilePaper: buildPickerPaperProps(),
                    textField: {
                        fullWidth: true,
                        size: 'small',
                        helperText: field.help_text ?? undefined,
                        slotProps: {htmlInput: buildHtmlInputProps(field)},
                    },
                }}
            />
        );
    }

    if (field.input_kind === 'datetime') {
        return (
            <DateTimePicker
                label={field.label}
                disabled={readOnly}
                value={value ? dayjs(String(value)) : null}
                onChange={(nextValue) => onChange(nextValue ? nextValue.toISOString() : null)}
                slotProps={{
                    popper: {disablePortal: true},
                    desktopPaper: buildPickerPaperProps(),
                    mobilePaper: buildPickerPaperProps(),
                    textField: {
                        fullWidth: true,
                        size: 'small',
                        helperText: field.help_text ?? undefined,
                        slotProps: {htmlInput: buildHtmlInputProps(field)},
                    },
                }}
            />
        );
    }

    if (field.has_choices) {
        return renderChoiceEditor({
            field,
            value,
            onChange,
            readOnly,
            choices,
            isLoadingChoices,
            onSearchChange: setSearchValue,
            searchPlaceholder: t('search'),
        });
    }

    return (
        <TextField
            label={field.label}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            size="small"
            fullWidth
            disabled={readOnly}
            helperText={field.help_text ?? undefined}
            type={resolveInputType(field)}
            multiline={field.input_kind === 'textarea' || field.type.toLowerCase().includes('text')}
            minRows={field.input_kind === 'textarea' || field.type.toLowerCase().includes('text') ? 3 : undefined}
            slotProps={{
                htmlInput: buildHtmlInputProps(field),
            }}
        />
    );
});


function renderChoiceEditor({
    field,
    value,
    onChange,
    readOnly,
    choices,
    isLoadingChoices,
    onSearchChange,
    searchPlaceholder,
}: {
    field: AdminFieldMeta;
    value: unknown;
    onChange: (value: unknown) => void;
    readOnly: boolean;
    choices: RelationOption[];
    isLoadingChoices: boolean;
    onSearchChange: (value: string) => void;
    searchPlaceholder: string;
}) {
    const selectedIds = normalizeSelectedIds(value, field.is_relation_many);
    const selectedOptions = selectedIds.map((id) => choices.find((choice) => String(choice.id) === String(id)) ?? {
        id,
        label: String(id),
    });

    if (field.is_relation_many || field.input_kind === 'relation-multiple') {
        return (
            <Autocomplete
                multiple
                options={choices}
                value={selectedOptions}
                loading={isLoadingChoices}
                disabled={readOnly}
                filterOptions={(options) => options}
                size="small"
                disablePortal
                isOptionEqualToValue={(option, selected) => String(option.id) === String(selected.id)}
                getOptionLabel={(option) => option.label}
                onChange={(_, nextValue) => onChange(nextValue.map((item) => item.id))}
                onInputChange={(_, nextInputValue) => onSearchChange(nextInputValue)}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 0.5,
                            borderRadius: '10px',
                            backgroundImage: 'none',
                            backgroundColor: 'background.paper',
                        },
                    },
                    listbox: {sx: {maxHeight: 240}},
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={field.label}
                        placeholder={searchPlaceholder}
                        helperText={field.help_text ?? undefined}
                        slotProps={{
                            input: {
                                ...params.InputProps,
                                endAdornment: (
                                    <>
                                        {isLoadingChoices ? <CircularProgress color="inherit" size={16} /> : null}
                                        {params.InputProps.endAdornment}
                                    </>
                                ),
                            },
                            htmlInput: {
                                ...params.inputProps,
                                autoComplete: 'new-password',
                                name: `admin-choice-${field.name}`,
                            },
                        }}
                    />
                )}
            />
        );
    }

    return (
        <Autocomplete
            options={choices}
            value={selectedOptions[0] ?? null}
            loading={isLoadingChoices}
            disabled={readOnly}
            filterOptions={(options) => options}
            size="small"
            disablePortal
            isOptionEqualToValue={(option, selected) => String(option.id) === String(selected.id)}
            getOptionLabel={(option) => option.label}
            onChange={(_, nextValue) => onChange(nextValue?.id ?? null)}
            onInputChange={(_, nextInputValue) => onSearchChange(nextInputValue)}
            slotProps={{
                paper: {
                    sx: {
                        mt: 0.5,
                        borderRadius: '10px',
                        backgroundImage: 'none',
                        backgroundColor: 'background.paper',
                    },
                },
                listbox: {sx: {maxHeight: 240}},
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={field.label}
                    placeholder={searchPlaceholder}
                    helperText={field.help_text ?? undefined}
                    slotProps={{
                        input: {
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {isLoadingChoices ? <CircularProgress color="inherit" size={16} /> : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        },
                        htmlInput: {
                            ...params.inputProps,
                            autoComplete: 'new-password',
                            name: `admin-choice-${field.name}`,
                        },
                    }}
                />
            )}
        />
    );
}

function normalizeSelectedIds(value: unknown, isMultiple: boolean): Array<string | number> {
    if (isMultiple) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.filter((item): item is string | number => typeof item === 'string' || typeof item === 'number');
    }
    if (typeof value === 'string' || typeof value === 'number') {
        return [value];
    }
    return [];
}

function mergeChoices(current: RelationOption[], next: RelationOption[]): RelationOption[] {
    const choiceMap = new Map<string, RelationOption>();
    for (const choice of [...current, ...next]) {
        choiceMap.set(String(choice.id), choice);
    }
    return [...choiceMap.values()];
}

function resolveInputType(field: AdminFieldMeta): string {
    if (field.input_kind === 'password') {
        return 'password';
    }
    if (field.input_kind === 'number' || field.input_kind === 'decimal') {
        return 'number';
    }
    return 'text';
}

function buildHtmlInputProps(field: AdminFieldMeta) {
    if (field.input_kind === 'password') {
        return {
            autoComplete: 'new-password',
            name: `admin-password-${field.name}`,
        };
    }

    return {
        autoComplete: 'off',
        name: `admin-field-${field.name}`,
    };
}

function buildPickerPaperProps() {
    return {
        sx: {
            borderRadius: '10px',
            backgroundImage: 'none',
            backgroundColor: 'background.paper',
        },
    };
}
