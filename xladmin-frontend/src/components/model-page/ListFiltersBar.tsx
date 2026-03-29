'use client';

import {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {Button, CircularProgress, Divider, MenuItem, Paper, Stack, TextField, Typography} from '@mui/material';
import type {XLAdminClient} from '../../client';
import {useAdminTranslation} from '../../i18n';
import type {AdminListFilterMeta} from '../../types';

const inFlightFilterChoicesRequests = new Map<string, Promise<Array<{value: string; label: string}>>>();

type ListFiltersSidebarProps = {
    client: XLAdminClient;
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
    client: XLAdminClient;
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
    client: XLAdminClient;
    slug: string;
    filter: AdminListFilterMeta;
    value: string;
    onChange: (slug: string, value: string) => void;
    debounceMs: number;
};

function ListFilterField({client, slug, filter, value, onChange, debounceMs}: ListFilterFieldProps) {
    const t = useAdminTranslation();
    const [draftValue, setDraftValue] = useState(value);
    const [options, setOptions] = useState(filter.options);
    const [isChoicesLoaded, setIsChoicesLoaded] = useState(filter.options.length > 0);
    const [isLoadingChoices, setIsLoadingChoices] = useState(false);

    useEffect(() => {
        setDraftValue(value);
    }, [value]);

    useEffect(() => {
        setOptions(filter.options);
        setIsChoicesLoaded(filter.options.length > 0);
    }, [filter.slug]);

    useEffect(() => {
        if (filter.options.length === 0) {
            return;
        }
        setOptions(filter.options);
        setIsChoicesLoaded(true);
    }, [filter.options]);

    const loadChoices = useCallback(async () => {
        if (!filter.has_choices || filter.input_kind !== 'select' || isChoicesLoaded) {
            return;
        }

        const requestKey = `${slug}:${filter.slug}`;
        const existingRequest = inFlightFilterChoicesRequests.get(requestKey);
        const request = existingRequest ?? client.getFilterChoices(slug, filter.slug)
            .then((response) => response.items.map((item) => ({
                value: String(item.id),
                label: item.label,
            })))
            .finally(() => {
                inFlightFilterChoicesRequests.delete(requestKey);
            });

        if (!existingRequest) {
            inFlightFilterChoicesRequests.set(requestKey, request);
        }

        setIsLoadingChoices(true);
        try {
            const nextOptions = await request;
            setOptions(nextOptions);
            setIsChoicesLoaded(true);
        } finally {
            setIsLoadingChoices(false);
        }
    }, [client, filter.has_choices, filter.input_kind, filter.slug, isChoicesLoaded, slug]);

    useEffect(() => {
        if (filter.input_kind !== 'text') return;

        const timeoutId = window.setTimeout(() => {
            if (draftValue !== value) {
                onChange(filter.slug, draftValue);
            }
        }, debounceMs);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [debounceMs, draftValue, filter.input_kind, filter.slug, onChange, value]);

    useEffect(() => {
        if (!value || !filter.has_choices || filter.input_kind !== 'select' || isChoicesLoaded) {
            return;
        }

        let isCancelled = false;
        void loadChoices()
            .then(() => {
                if (isCancelled) return;
            })
            .catch(() => {
                if (isCancelled) return;
                setOptions([]);
                setIsChoicesLoaded(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [filter.has_choices, filter.input_kind, isChoicesLoaded, loadChoices, value]);

    if (filter.input_kind === 'boolean' || filter.input_kind === 'select') {
        return (
            <TextField
                select
                size="small"
                fullWidth
                label={filter.label}
                value={value}
                onChange={(event) => onChange(filter.slug, event.target.value)}
                slotProps={{
                    select: filter.input_kind === 'select' ? {onOpen: () => void loadChoices()} : undefined,
                }}
            >
                <MenuItem value="">{t('all')}</MenuItem>
                {isLoadingChoices ? (
                    <MenuItem disabled value="__loading__">
                        <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={14} thickness={5} />
                            <Typography variant="body2">{t('loading')}</Typography>
                        </Stack>
                    </MenuItem>
                ) : null}
                {options.map((option) => (
                    <MenuItem key={`${filter.slug}-${option.value}`} value={option.value}>
                        {option.label}
                    </MenuItem>
                ))}
            </TextField>
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
