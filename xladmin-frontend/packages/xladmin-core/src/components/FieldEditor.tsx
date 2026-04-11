'use client';

import {memo, useCallback, useEffect, useMemo, useState, type MouseEvent} from 'react';
import {Autocomplete, CircularProgress, FormControlLabel, MenuItem, Switch, TextField,} from '@mui/material';
import {DatePicker, DateTimePicker} from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import type {AdminClient} from '@xladmin-core/client';
import {useRemoteChoices} from '@xladmin-core/hooks/useRemoteChoices';
import {useAdminTranslation} from '@xladmin-core/i18n';
import type {AdminEditableFieldMeta} from '@xladmin-core/types';

type AdminFieldEditorProps = {
    field: AdminEditableFieldMeta;
    value: unknown;
    onChange: (value: unknown) => void;
    slug: string;
    client: AdminClient;
    choiceScope?: (
        | {kind: 'model'}
        | {kind: 'bulk-action'; actionSlug: string}
        | {kind: 'object-action'; actionSlug: string; itemId: string | number}
    );
    readOnly?: boolean;
    isPickerOpen?: boolean;
    hasAnotherPickerOpen?: boolean;
    onRequestPickerOpen?: () => void;
    onRequestPickerClose?: () => void;
};

type RelationOption = {
    id: string | number;
    label: string;
};

export type FieldEditorProps = AdminFieldEditorProps;
const DEFAULT_CHOICE_SCOPE = {kind: 'model'} as const;

function handlePickerButtonMouseDown(
    event: MouseEvent,
    hasAnotherPickerOpen: boolean,
    onRequestPickerOpen?: () => void,
) {
    if (!hasAnotherPickerOpen) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    onRequestPickerOpen?.();
}

export const FieldEditor = memo(function FieldEditor({
                                                         field,
                                                         value,
                                                         onChange,
                                                         slug,
                                                         client,
                                                         choiceScope,
                                                         readOnly = false,
                                                         isPickerOpen,
                                                         hasAnotherPickerOpen = false,
                                                         onRequestPickerOpen,
                                                         onRequestPickerClose,
                                                     }: FieldEditorProps) {
    const t = useAdminTranslation();
    const [searchValue, setSearchValue] = useState('');
    const [jsonTextValue, setJsonTextValue] = useState(() => stringifyJsonValue(value));
    const [jsonError, setJsonError] = useState<string | null>(null);
    const resolvedChoiceScope = choiceScope ?? DEFAULT_CHOICE_SCOPE;
    const selectedIds = useMemo(() => normalizeSelectedIds(value, field.is_relation_many), [field.is_relation_many, value]);
    const loadChoices = useCallback(
        async (signal: AbortSignal) => {
            const response = resolvedChoiceScope.kind === 'bulk-action'
                ? await client.getBulkActionChoices(
                    slug,
                    resolvedChoiceScope.actionSlug,
                    field.name,
                    searchValue || undefined,
                    selectedIds,
                    {signal},
                )
                : resolvedChoiceScope.kind === 'object-action'
                    ? await client.getObjectActionChoices(
                        slug,
                        resolvedChoiceScope.itemId,
                        resolvedChoiceScope.actionSlug,
                        field.name,
                        searchValue || undefined,
                        selectedIds,
                        {signal},
                    )
                    : await client.getChoices(
                        slug,
                        field.name,
                        searchValue || undefined,
                        selectedIds,
                        {signal},
                    );
            return response.items;
        },
        [
            client,
            field.name,
            resolvedChoiceScope.kind,
            resolvedChoiceScope.kind === 'bulk-action' ? resolvedChoiceScope.actionSlug : null,
            resolvedChoiceScope.kind === 'object-action' ? resolvedChoiceScope.actionSlug : null,
            resolvedChoiceScope.kind === 'object-action' ? resolvedChoiceScope.itemId : null,
            searchValue,
            selectedIds,
            slug,
        ],
    );
    const {items: choices, isLoading: isLoadingChoices} = useRemoteChoices<RelationOption>({
        enabled: field.has_choices,
        debounceMs: 250,
        initialItems: [],
        resetKey: `${slug}:${field.name}`,
        queryKey: `${slug}:${field.name}:${searchValue}:${selectedIds.join(',')}`,
        load: loadChoices,
        merge: mergeChoices,
    });

    useEffect(() => {
        if (field.input_kind !== 'json') {
            return;
        }
        setJsonTextValue(stringifyJsonValue(value));
        setJsonError(null);
    }, [field.input_kind, value]);

    if (field.input_kind === 'boolean') {
        return (
            <FormControlLabel
                required={field.required}
                control={(
                    <Switch
                        checked={Boolean(value)}
                        disabled={readOnly}
                        onChange={(_, checked) => onChange(checked)}
                    />
                )}
                label={field.label}
                sx={buildRequiredLabelSx()}
            />
        );
    }

    if (field.input_kind === 'date') {
        return (
            <DatePicker
                label={field.label}
                disabled={readOnly}
                open={isPickerOpen}
                value={value ? dayjs(String(value)) : null}
                onOpen={onRequestPickerOpen}
                onClose={onRequestPickerClose}
                onChange={(nextValue) => onChange(nextValue ? nextValue.format('YYYY-MM-DD') : null)}
                slotProps={{
                    popper: {disablePortal: true},
                    desktopPaper: buildPickerPaperProps(),
                    mobilePaper: buildPickerPaperProps(),
                    openPickerButton: {
                        onMouseDown: (event) => handlePickerButtonMouseDown(event, hasAnotherPickerOpen, onRequestPickerOpen),
                    },
                    textField: {
                        fullWidth: true,
                        size: 'small',
                        required: field.required,
                        sx: buildRequiredLabelSx(),
                        placeholder: field.placeholder ?? undefined,
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
                open={isPickerOpen}
                value={value ? dayjs(String(value)) : null}
                onOpen={onRequestPickerOpen}
                onClose={onRequestPickerClose}
                onChange={(nextValue) => onChange(nextValue ? nextValue.format('YYYY-MM-DD[T]HH:mm:ss') : null)}
                slotProps={{
                    actionBar: {
                        actions: ['today', 'cancel', 'accept'],
                    },
                    popper: {disablePortal: true},
                    desktopPaper: buildPickerPaperProps(),
                    mobilePaper: buildPickerPaperProps(),
                    openPickerButton: {
                        onMouseDown: (event) => handlePickerButtonMouseDown(event, hasAnotherPickerOpen, onRequestPickerOpen),
                    },
                    textField: {
                        fullWidth: true,
                        size: 'small',
                        required: field.required,
                        sx: buildRequiredLabelSx(),
                        placeholder: field.placeholder ?? undefined,
                        helperText: field.help_text ?? undefined,
                        slotProps: {htmlInput: buildHtmlInputProps(field)},
                    },
                }}
            />
        );
    }

    if (hasStaticOptions(field)) {
        return renderStaticChoiceEditor({
            field,
            value,
            onChange,
            readOnly,
        });
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

    if (field.input_kind === 'json') {
        return (
            <TextField
                label={field.label}
                value={jsonTextValue}
                onChange={(event) => {
                    const nextValue = event.target.value;
                    setJsonTextValue(nextValue);
                    if (nextValue.trim() === '') {
                        setJsonError(null);
                        onChange(null);
                        return;
                    }
                    try {
                        onChange(JSON.parse(nextValue));
                        setJsonError(null);
                    } catch {
                        setJsonError(t('invalid_json'));
                    }
                }}
                size="small"
                fullWidth
                disabled={readOnly}
                multiline
                minRows={6}
                error={jsonError !== null}
                required={field.required}
                sx={buildRequiredLabelSx()}
                helperText={jsonError ?? field.help_text ?? undefined}
                placeholder={field.placeholder ?? undefined}
                slotProps={{
                    htmlInput: buildHtmlInputProps(field),
                }}
            />
        );
    }

    return (
        <TextField
            label={field.label}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            size="small"
            fullWidth
            disabled={readOnly}
            required={field.required}
            sx={buildRequiredLabelSx()}
            helperText={field.help_text ?? undefined}
            placeholder={field.placeholder ?? undefined}
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
    field: AdminEditableFieldMeta;
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
                    (() => {
                        const {InputProps, inputProps, ...textFieldParams} = params;

                        return (
                            <TextField
                                {...textFieldParams}
                                label={field.label}
                                required={field.required}
                                sx={buildRequiredLabelSx()}
                                placeholder={field.placeholder ?? searchPlaceholder}
                                helperText={field.help_text ?? undefined}
                                slotProps={{
                                    input: {
                                        ...InputProps,
                                        endAdornment: (
                                            <>
                                                {isLoadingChoices ? <CircularProgress color="inherit" size={16}/> : null}
                                                {InputProps.endAdornment}
                                            </>
                                        ),
                                    },
                                    htmlInput: {
                                        ...inputProps,
                                        autoComplete: 'new-password',
                                        name: `admin-choice-${field.name}`,
                                    },
                                }}
                            />
                        );
                    })()
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
                (() => {
                    const {InputProps, inputProps, ...textFieldParams} = params;

                    return (
                        <TextField
                            {...textFieldParams}
                            label={field.label}
                            required={field.required}
                            sx={buildRequiredLabelSx()}
                            placeholder={field.placeholder ?? searchPlaceholder}
                            helperText={field.help_text ?? undefined}
                            slotProps={{
                                input: {
                                    ...InputProps,
                                    endAdornment: (
                                        <>
                                            {isLoadingChoices ? <CircularProgress color="inherit" size={16}/> : null}
                                            {InputProps.endAdornment}
                                        </>
                                    ),
                                },
                                htmlInput: {
                                    ...inputProps,
                                    autoComplete: 'new-password',
                                    name: `admin-choice-${field.name}`,
                                },
                            }}
                        />
                    );
                })()
            )}
        />
    );
}

function renderStaticChoiceEditor({
                                      field,
                                      value,
                                      onChange,
                                      readOnly,
                                  }: {
    field: AdminEditableFieldMeta;
    value: unknown;
    onChange: (value: unknown) => void;
    readOnly: boolean;
}) {
    const options = field.options ?? [];
    const optionValueMap = new Map(options.map((option) => [String(option.value), option.value]));
    const canClear = !field.required;

    if (field.input_kind === 'select-multiple') {
        const selectedValues = Array.isArray(value) ? value.map((item) => String(item)) : [];
        return (
            <TextField
                select
                label={field.label}
                value={selectedValues}
                onChange={(event) => {
                    const rawValues = event.target.value;
                    const nextValues = Array.isArray(rawValues) ? rawValues : [rawValues];
                    onChange(nextValues.map((item) => optionValueMap.get(String(item)) ?? item));
                }}
                size="small"
                fullWidth
                disabled={readOnly}
                required={field.required}
                sx={buildRequiredLabelSx()}
                helperText={field.help_text ?? undefined}
                slotProps={{
                    htmlInput: buildHtmlInputProps(field),
                    select: {
                        multiple: true,
                        displayEmpty: true,
                        renderValue: (selected) => {
                            const selectedItems = Array.isArray(selected) ? selected : [selected];
                            if (selectedItems.length === 0) {
                                return field.placeholder ?? '';
                            }
                            return selectedItems
                                .map((item) => options.find((option) => String(option.value) === String(item))?.label ?? String(item))
                                .join(', ');
                        },
                    },
                }}
            >
                {options.map((option) => (
                    <MenuItem key={String(option.value)} value={String(option.value)}>
                        {option.label}
                    </MenuItem>
                ))}
            </TextField>
        );
    }

    return (
        <TextField
            select
            label={field.label}
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(event) => {
                const nextValue = event.target.value;
                onChange(nextValue === '' ? null : (optionValueMap.get(String(nextValue)) ?? nextValue));
            }}
            size="small"
            fullWidth
            disabled={readOnly}
            required={field.required}
            sx={buildRequiredLabelSx()}
            helperText={field.help_text ?? undefined}
            slotProps={{
                htmlInput: buildHtmlInputProps(field),
                select: {
                    displayEmpty: canClear || Boolean(field.placeholder),
                },
            }}
        >
            {canClear || field.placeholder ? (
                <MenuItem value="">
                    {field.placeholder ?? ''}
                </MenuItem>
            ) : null}
            {options.map((option) => (
                <MenuItem key={String(option.value)} value={String(option.value)}>
                    {option.label}
                </MenuItem>
            ))}
        </TextField>
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

function hasStaticOptions(field: AdminEditableFieldMeta): boolean {
    return (field.options?.length ?? 0) > 0 || field.input_kind === 'select' || field.input_kind === 'select-multiple';
}

function buildRequiredLabelSx() {
    return {
        '& .MuiFormLabel-asterisk': {
            color: 'error.main',
        },
        '& .MuiFormControlLabel-asterisk': {
            color: 'error.main',
        },
    };
}

function resolveInputType(field: AdminEditableFieldMeta): string {
    if (field.input_kind === 'password') {
        return 'password';
    }
    if (field.input_kind === 'number' || field.input_kind === 'decimal') {
        return 'number';
    }
    return 'text';
}

function buildHtmlInputProps(field: AdminEditableFieldMeta) {
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

function stringifyJsonValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    return JSON.stringify(value, null, 2);
}
