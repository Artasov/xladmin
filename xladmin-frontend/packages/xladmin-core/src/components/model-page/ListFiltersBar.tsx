'use client';

import {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {
    Autocomplete,
    Button,
    CircularProgress,
    Divider,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import type {AdminClient} from '@xladmin-core/client';
import {useRemoteChoices} from '@xladmin-core/hooks/useRemoteChoices';
import {useAdminTranslation} from '@xladmin-core/i18n';
import type {AdminListFilterMeta} from '@xladmin-core/types';

type ListFiltersSidebarProps = {
    client: AdminClient;
    slug: string;
    filters: AdminListFilterMeta[];
    values: Record<string, string>;
    onChange: (slug: string, value: string) => void;
    onReset: () => void;
    debounceMs?: number;
};

type FilterGroup = {
    key: string;
    title: string;
    filters: AdminListFilterMeta[];
};

export const ListFiltersSidebar = memo(function ListFiltersSidebar({
                                                                       client,
                                                                       slug,
                                                                       filters,
                                                                       values,
                                                                       onChange,
                                                                       onReset,
                                                                       debounceMs = 300,
                                                                   }: ListFiltersSidebarProps) {
    const t = useAdminTranslation();

    const filterGroups = useMemo(() => {
        const groupedFilters = new Map<string, FilterGroup>();

        for (const filter of filters) {
            const groupKey = filter.group?.trim() || filter.slug;
            const groupTitle = filter.group?.trim() || filter.label;
            const existingGroup = groupedFilters.get(groupKey);

            if (existingGroup) {
                existingGroup.filters.push(filter);
                continue;
            }

            groupedFilters.set(groupKey, {
                key: groupKey,
                title: groupTitle,
                filters: [filter],
            });
        }

        return Array.from(groupedFilters.values());
    }, [filters]);

    const activeFiltersCount = useMemo(
        () => filters.filter((filter) => Boolean(values[filter.slug])).length,
        [filters, values],
    );

    if (filters.length === 0) return null;

    return (
        <Paper
            sx={{
                width: {xs: '100%', lg: 288},
                minWidth: {lg: 288},
                maxWidth: {lg: 288},
                alignSelf: 'stretch',
                borderRadius: '10px',
                p: 1.5,
                overflow: 'auto',
            }}
        >
            <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack spacing={0.25}>
                        <Typography sx={{fontSize: 15, fontWeight: 700}}>
                            {t('filters')}
                        </Typography>
                        {activeFiltersCount > 0 ? (
                            <Typography color="text.secondary" sx={{fontSize: 12}}>
                                {t('active_filters', {count: activeFiltersCount})}
                            </Typography>
                        ) : null}
                    </Stack>
                    <Button
                        size="small"
                        onClick={onReset}
                        disabled={activeFiltersCount === 0}
                        sx={{alignSelf: 'flex-start'}}
                    >
                        {t('reset_filters')}
                    </Button>
                </Stack>

                <Divider/>

                {filterGroups.map((group) => (
                    <FilterGroupSection
                        key={group.key}
                        client={client}
                        slug={slug}
                        group={group}
                        values={values}
                        onChange={onChange}
                        debounceMs={debounceMs}
                    />
                ))}
            </Stack>
        </Paper>
    );
});

type FilterGroupSectionProps = {
    client: AdminClient;
    slug: string;
    group: FilterGroup;
    values: Record<string, string>;
    onChange: (slug: string, value: string) => void;
    debounceMs: number;
};

function FilterGroupSection({client, slug, group, values, onChange, debounceMs}: FilterGroupSectionProps) {
    return (
        <Stack spacing={1}>
            <Typography sx={{fontSize: 13, fontWeight: 700, color: 'text.secondary'}}>
                {group.title}
            </Typography>
            <Stack spacing={1}>
                {group.filters.map((filter) => (
                    <ListFilterField
                        key={filter.slug}
                        client={client}
                        slug={slug}
                        filter={filter}
                        value={values[filter.slug] ?? ''}
                        onChange={onChange}
                        debounceMs={debounceMs}
                    />
                ))}
            </Stack>
        </Stack>
    );
}

type ListFilterFieldProps = {
    client: AdminClient;
    slug: string;
    filter: AdminListFilterMeta;
    value: string;
    onChange: (slug: string, value: string) => void;
    debounceMs: number;
};

function ListFilterField({client, slug, filter, value, onChange, debounceMs}: ListFilterFieldProps) {
    const t = useAdminTranslation();
    const [draftValue, setDraftValue] = useState(value);
    const [searchValue, setSearchValue] = useState('');
    const selectedValues = useMemo(() => parseSelectedFilterValues(value, filter.multiple), [filter.multiple, value]);
    const isSelectFilter = filter.input_kind === 'select' || filter.input_kind === 'select-multiple';
    const loadChoices = useCallback(
        async (signal: AbortSignal) => {
            const response = await client.getFilterChoices(
                slug,
                filter.slug,
                searchValue || undefined,
                selectedValues.length > 0 ? selectedValues : undefined,
                {signal},
            );
            return response.items.map((item) => ({
                value: String(item.id),
                label: item.label,
            }));
        },
        [client, filter.slug, searchValue, selectedValues, slug],
    );
    const {items: options, isLoading: isLoadingChoices} = useRemoteChoices({
        enabled: filter.has_choices && isSelectFilter,
        debounceMs,
        initialItems: filter.options,
        resetKey: `${slug}:${filter.slug}`,
        queryKey: `${slug}:${filter.slug}:${searchValue}:${value}`,
        load: loadChoices,
    });

    useEffect(() => {
        setDraftValue(value);
    }, [value]);

    useEffect(() => {
        setSearchValue('');
    }, [filter.slug]);

    useEffect(() => {
        if (filter.input_kind !== 'text') {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            if (draftValue !== value) {
                onChange(filter.slug, draftValue);
            }
        }, debounceMs);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [debounceMs, draftValue, filter.input_kind, filter.slug, onChange, value]);

    if (filter.input_kind === 'boolean') {
        return (
            <TextField
                select
                size="small"
                fullWidth
                label={filter.label}
                value={value}
                onChange={(event) => onChange(filter.slug, event.target.value)}
            >
                <MenuItem value="">{t('all')}</MenuItem>
                {filter.options.map((option) => (
                    <MenuItem key={`${filter.slug}-${option.value}`} value={option.value}>
                        {option.label}
                    </MenuItem>
                ))}
            </TextField>
        );
    }

    if (isSelectFilter) {
        const selectedOptions = selectedValues.map((selectedValue) => (
            options.find((option) => option.value === selectedValue) ?? {
                value: selectedValue,
                label: selectedValue,
            }
        ));
        const selectedOption = filter.multiple ? selectedOptions : (selectedOptions[0] ?? null);
        return (
            <Autocomplete
                options={options}
                multiple={filter.multiple}
                disableCloseOnSelect={filter.multiple}
                value={selectedOption}
                loading={isLoadingChoices}
                filterOptions={(items) => items}
                size="small"
                disablePortal
                isOptionEqualToValue={(option, selected) => option.value === selected.value}
                getOptionLabel={(option) => option.label}
                onChange={(_, nextValue) => {
                    if (filter.multiple) {
                        const nextItems = Array.isArray(nextValue) ? nextValue : [];
                        onChange(filter.slug, nextItems.map((item) => item.value).join(','));
                        return;
                    }
                    onChange(filter.slug, (Array.isArray(nextValue) ? nextValue[0] : nextValue)?.value ?? '');
                }}
                onInputChange={(_, nextInputValue) => setSearchValue(nextInputValue)}
                renderInput={(params) => (
                    (() => {
                        const {InputProps, inputProps, ...textFieldParams} = params;

                        return (
                            <TextField
                                {...textFieldParams}
                                label={filter.label}
                                placeholder={filter.placeholder ?? t('search')}
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
                                    htmlInput: inputProps,
                                }}
                            />
                        );
                    })()
                )}
            />
        );
    }

    return (
        <TextField
            size="small"
            fullWidth
            label={filter.label}
            placeholder={filter.placeholder ?? undefined}
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
        />
    );
}

function parseSelectedFilterValues(value: string, multiple: boolean): string[] {
    if (!value) {
        return [];
    }
    if (!multiple) {
        return [value];
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
}
