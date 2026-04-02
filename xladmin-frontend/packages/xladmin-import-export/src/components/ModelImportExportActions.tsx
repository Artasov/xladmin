'use client';

import {useEffect, useMemo, useState} from 'react';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import {
    Alert, Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    List,
    ListItem,
    MenuItem,
    Select,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import type {ModelPageToolbarContext} from 'xladmin';
import {useAdminLocale} from 'xladmin';
import type {
    ImportCommitResponse,
    ImportConflictMode,
    ImportExportFieldMeta,
    ImportExportFormat,
    ImportExportMetaResponse,
    ImportValidationResponse,
    XLAdminImportExportClient,
} from '../client';

type ModelImportExportActionsProps = {
    client: XLAdminImportExportClient;
    context: ModelPageToolbarContext;
};

export function ModelImportExportActions({client, context}: ModelImportExportActionsProps) {
    const locale = useAdminLocale();
    const messages = useMemo(() => getMessages(locale), [locale]);
    const [meta, setMeta] = useState<ImportExportMetaResponse | null>(null);
    const [isUnavailable, setIsUnavailable] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState<ImportExportFormat>('xlsx');
    const [selectedExportFields, setSelectedExportFields] = useState<string[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const [importFormat, setImportFormat] = useState<ImportExportFormat>('xlsx');
    const [selectedImportFields, setSelectedImportFields] = useState<string[]>([]);
    const [conflictMode, setConflictMode] = useState<ImportConflictMode>('update_existing');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [validationResult, setValidationResult] = useState<ImportValidationResponse | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);

    const resetImportValidation = () => {
        setValidationResult(null);
        setValidationError(null);
        setImportSuccess(null);
    };

    useEffect(() => {
        let isMounted = true;
        setMeta(null);
        setIsUnavailable(false);
        setError(null);

        client.getMeta(context.slug)
            .then((response) => {
                if (!isMounted) {
                    return;
                }
                setMeta(response);
                setExportFormat(response.export_formats[0] ?? 'xlsx');
                setSelectedExportFields(getDefaultSelectedFields(response.export_fields));
                setImportFormat(response.import_formats[0] ?? 'xlsx');
                setSelectedImportFields(getDefaultSelectedFields(response.import_fields));
                setConflictMode(response.available_conflict_modes[0] ?? 'update_existing');
            })
            .catch((reason: unknown) => {
                if (!isMounted) {
                    return;
                }
                const message = reason instanceof Error ? reason.message : 'Failed to load import/export settings.';
                if (message.includes('404')) {
                    setIsUnavailable(true);
                    return;
                }
                setError(message);
            });

        return () => {
            isMounted = false;
        };
    }, [client, context.slug]);

    if (isUnavailable || meta === null) {
        return null;
    }

    const exportCount = context.selectionCount > 0 ? context.selectionCount : context.total;

    return (
        <>
            <Stack direction="row" spacing={0.5} alignItems="center">
                <Tooltip title={messages.exportButton}>
                    <span>
                        <IconButton size="small" onClick={() => setExportOpen(true)} disabled={Boolean(error)}>
                            <DownloadIcon fontSize="small"/>
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title={messages.importButton}>
                    <span>
                        <IconButton size="small" onClick={() => setImportOpen(true)} disabled={Boolean(error)}>
                            <UploadIcon fontSize="small"/>
                        </IconButton>
                    </span>
                </Tooltip>
            </Stack>

            <Dialog open={exportOpen} onClose={() => !isExporting && setExportOpen(false)} fullWidth maxWidth="md">
                <DialogTitle sx={{px: 3, pt: 3, pb: 1}}>{messages.exportTitle}</DialogTitle>
                <DialogContent sx={{px: 3, pb: 3, pt: 0.5}}>
                    <Stack spacing={1.5}>
                        {error ? <Alert severity="error">{error}</Alert> : null}
                        <Typography color="text.secondary">
                            {messages.exportCount(exportCount, context.selectionCount > 0)}
                        </Typography>
                        <FormControl fullWidth>
                            <InputLabel id="export-format-label">{messages.formatLabel}</InputLabel>
                            <Select
                                labelId="export-format-label"
                                value={exportFormat}
                                label={messages.formatLabel}
                                onChange={(event) => setExportFormat(event.target.value as ImportExportFormat)}
                            >
                                {meta.export_formats.map((format) => (
                                    <MenuItem key={format} value={format}>{format.toUpperCase()}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FieldsSelector
                            title={messages.exportFieldsLabel}
                            fields={meta.export_fields}
                            selectedFields={selectedExportFields}
                            onChange={setSelectedExportFields}
                            allLabel={messages.selectAllFields}
                            noneLabel={messages.clearFields}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{px: 3, pb: 3, pt: 0, gap: 1}}>
                    <Button onClick={() => setExportOpen(false)} disabled={isExporting}>{messages.cancel}</Button>
                    <Button
                        variant="contained"
                        onClick={() => void handleExport({
                            client,
                            context,
                            format: exportFormat,
                            fields: selectedExportFields,
                            setIsExporting,
                            onDone: () => setExportOpen(false),
                        })}
                        disabled={isExporting || selectedExportFields.length === 0}
                    >
                        {isExporting ? messages.exporting : messages.exportConfirm}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={importOpen} onClose={() => !isValidating && !isImporting && setImportOpen(false)} fullWidth
                    maxWidth="md">
                <DialogTitle sx={{px: 3, pt: 3, pb: 1}}>{messages.importTitle}</DialogTitle>
                <DialogContent sx={{px: 3, pb: 3, pt: 0.5}}>
                    <Stack spacing={1.5}>
                        {validationError ? <Alert severity="error">{validationError}</Alert> : null}
                        {importSuccess ? <Alert severity="success">{importSuccess}</Alert> : null}
                        <Stack direction={{xs: 'column', sm: 'row'}} sx={{pt: 1}} spacing={1.5}>
                            <Button
                                variant="outlined"
                                component="label"
                                sx={{whiteSpace: 'nowrap', flexShrink: 0, minWidth: 132}}
                            >
                                {importFile ? importFile.name : messages.chooseFile}
                                <input
                                    hidden
                                    type="file"
                                    accept=".xlsx,.csv,.json"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null;
                                        setImportFile(file);
                                        resetImportValidation();
                                        if (!file) {
                                            return;
                                        }
                                        const nextFormat = inferFormatFromFile(file.name);
                                        if (nextFormat !== null && meta.import_formats.includes(nextFormat)) {
                                            setImportFormat(nextFormat);
                                        }
                                    }}
                                />
                            </Button>
                            <FormControl fullWidth>
                                <InputLabel id="import-format-label">{messages.formatLabel}</InputLabel>
                                <Select
                                    labelId="import-format-label"
                                    value={importFormat}
                                    label={messages.formatLabel}
                                    onChange={(event) => {
                                        resetImportValidation();
                                        setImportFormat(event.target.value as ImportExportFormat);
                                    }}
                                >
                                    {meta.import_formats.map((format) => (
                                        <MenuItem key={format} value={format}>{format.toUpperCase()}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>
                        <Box>
                            <FormControl fullWidth sx={{mt: 0.5}}>
                                <InputLabel id="import-conflict-mode-label">{messages.conflictModeLabel}</InputLabel>
                                <Select
                                    labelId="import-conflict-mode-label"
                                    value={conflictMode}
                                    label={messages.conflictModeLabel}
                                    onChange={(event) => {
                                        resetImportValidation();
                                        setConflictMode(event.target.value as ImportConflictMode);
                                    }}
                                >
                                    {meta.available_conflict_modes.map((mode) => (
                                        <MenuItem key={mode} value={mode}>{messages.conflictMode(mode)}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                        <FieldsSelector
                            title={messages.importFieldsLabel}
                            fields={meta.import_fields}
                            selectedFields={selectedImportFields}
                            onChange={(value) => {
                                resetImportValidation();
                                setSelectedImportFields(value);
                            }}
                            allLabel={messages.selectAllFields}
                            noneLabel={messages.clearFields}
                        />
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                                variant="outlined"
                                onClick={() => void handleValidateImport({
                                    client,
                                    slug: context.slug,
                                    file: importFile,
                                    format: importFormat,
                                    fields: selectedImportFields,
                                    conflictMode,
                                    setIsValidating,
                                    setValidationResult,
                                    setValidationError,
                                })}
                                disabled={!importFile || selectedImportFields.length === 0 || isValidating || isImporting}
                            >
                                {messages.validate}
                            </Button>
                            {isValidating ? <CircularProgress size={20}/> : null}
                        </Stack>
                        {validationResult ? <ValidationSummary messages={messages} result={validationResult}/> : null}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{px: 3, pb: 3, pt: 0, gap: 1}}>
                    <Button onClick={() => setImportOpen(false)}
                            disabled={isValidating || isImporting}>{messages.cancel}</Button>
                    <Button
                        variant="contained"
                        onClick={() => void handleCommitImport({
                            client,
                            slug: context.slug,
                            file: importFile,
                            format: importFormat,
                            fields: selectedImportFields,
                            conflictMode,
                            setIsImporting,
                            setValidationError,
                            setImportSuccess,
                            refresh: context.refresh,
                            onSuccess: () => {
                                setValidationResult(null);
                                setImportFile(null);
                            },
                            messages,
                        })}
                        disabled={!importFile || !validationResult || validationResult.summary.errors > 0 || isImporting}
                    >
                        {isImporting ? messages.importing : messages.confirmImport}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

function FieldsSelector({
                            title,
                            fields,
                            selectedFields,
                            onChange,
                            allLabel,
                            noneLabel,
                        }: {
    title: string;
    fields: ImportExportFieldMeta[];
    selectedFields: string[];
    onChange: (value: string[]) => void;
    allLabel: string;
    noneLabel: string;
}) {
    return (
        <Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">{title}</Typography>
                <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => onChange(fields.map((field) => field.name))}>{allLabel}</Button>
                    <Button size="small" onClick={() => onChange([])}>{noneLabel}</Button>
                </Stack>
            </Stack>
            <List
                dense
                disablePadding
                sx={{
                    maxHeight: 280,
                    overflow: 'auto',
                }}
            >
                {fields.map((field) => (
                    <ListItem key={field.name} disableGutters sx={{py: 0.125}}>
                        <FormControlLabel
                            sx={{m: 0, alignItems: 'center'}}
                            control={(
                                <Checkbox
                                    size="small"
                                    checked={selectedFields.includes(field.name)}
                                    onChange={(_, checked) => {
                                        if (checked) {
                                            onChange([...selectedFields, field.name]);
                                            return;
                                        }
                                        onChange(selectedFields.filter((item) => item !== field.name));
                                    }}
                                />
                            )}
                            label={
                                <Stack direction="row" spacing={0.75} alignItems="center" sx={{minHeight: 24}}>
                                    <Typography variant="body2" sx={{lineHeight: 1.35}}>
                                        {field.label}
                                    </Typography>
                                    {field.label !== field.name ? (
                                        <Typography variant="caption" color="text.secondary" sx={{lineHeight: 1.2}}>
                                            {field.name}
                                        </Typography>
                                    ) : null}
                                </Stack>
                            }
                        />
                    </ListItem>
                ))}
            </List>
        </Stack>
    );
}

function ValidationSummary({
                               messages,
                               result,
                           }: {
    messages: ReturnType<typeof getMessages>;
    result: ImportValidationResponse;
}) {
    return (
        <Stack spacing={1.5}>
            <Typography variant="subtitle2">{messages.validationSummaryTitle}</Typography>
            <Typography color="text.secondary">{messages.validationSummary(result)}</Typography>
            {result.errors.length > 0 ? (
                <Alert severity="warning">
                    <Stack spacing={0.5}>
                        {result.errors.slice(0, 10).map((error) => (
                            <Typography key={`${error.row_number}-${error.message}`} variant="body2">
                                #{error.row_number}: {error.message}
                            </Typography>
                        ))}
                    </Stack>
                </Alert>
            ) : null}
        </Stack>
    );
}

function getDefaultSelectedFields(fields: ImportExportFieldMeta[]): string[] {
    const defaultSelected = fields.filter((field) => field.default_selected).map((field) => field.name);
    if (defaultSelected.length > 0) {
        return defaultSelected;
    }
    return fields.map((field) => field.name);
}

async function handleExport({
                                client,
                                context,
                                format,
                                fields,
                                setIsExporting,
                                onDone,
                            }: {
    client: XLAdminImportExportClient;
    context: ModelPageToolbarContext;
    format: ImportExportFormat;
    fields: string[];
    setIsExporting: (value: boolean) => void;
    onDone: () => void;
}) {
    setIsExporting(true);
    try {
        const response = await client.downloadExport(context.slug, {
            format,
            fields,
            ids: context.isAllMatchingSelected ? [] : context.selectedIds,
            select_all: context.isAllMatchingSelected || context.selectedIds.length === 0,
            selection_scope: {
                q: context.appliedQuery || undefined,
                sort: context.sortValue || undefined,
                filters: context.appliedFilters,
            },
        });
        const objectUrl = URL.createObjectURL(response.blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = response.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
        onDone();
    } finally {
        setIsExporting(false);
    }
}

async function handleValidateImport({
                                        client,
                                        slug,
                                        file,
                                        format,
                                        fields,
                                        conflictMode,
                                        setIsValidating,
                                        setValidationResult,
                                        setValidationError,
                                    }: {
    client: XLAdminImportExportClient;
    slug: string;
    file: File | null;
    format: ImportExportFormat;
    fields: string[];
    conflictMode: ImportConflictMode;
    setIsValidating: (value: boolean) => void;
    setValidationResult: (value: ImportValidationResponse | null) => void;
    setValidationError: (value: string | null) => void;
}) {
    if (!file) {
        return;
    }
    setIsValidating(true);
    setValidationError(null);
    try {
        const result = await client.validateImport(slug, {
            file,
            format,
            fields,
            conflict_mode: conflictMode,
        });
        setValidationResult(result);
    } catch (reason: unknown) {
        setValidationResult(null);
        setValidationError(reason instanceof Error ? reason.message : 'Validation failed.');
    } finally {
        setIsValidating(false);
    }
}

async function handleCommitImport({
                                      client,
                                      slug,
                                      file,
                                      format,
                                      fields,
                                      conflictMode,
                                      setIsImporting,
                                      setValidationError,
                                      setImportSuccess,
                                      refresh,
                                      onSuccess,
                                      messages,
                                  }: {
    client: XLAdminImportExportClient;
    slug: string;
    file: File | null;
    format: ImportExportFormat;
    fields: string[];
    conflictMode: ImportConflictMode;
    setIsImporting: (value: boolean) => void;
    setValidationError: (value: string | null) => void;
    setImportSuccess: (value: string | null) => void;
    refresh: () => Promise<void>;
    onSuccess: () => void;
    messages: ReturnType<typeof getMessages>;
}) {
    if (!file) {
        return;
    }
    setIsImporting(true);
    setValidationError(null);
    try {
        const result = await client.commitImport(slug, {
            file,
            format,
            fields,
            conflict_mode: conflictMode,
        });
        await refresh();
        onSuccess();
        setImportSuccess(messages.importSuccess(result));
    } catch (reason: unknown) {
        setValidationError(reason instanceof Error ? reason.message : 'Import failed.');
    } finally {
        setIsImporting(false);
    }
}

function inferFormatFromFile(fileName: string): ImportExportFormat | null {
    const normalized = fileName.toLowerCase();
    if (normalized.endsWith('.xlsx')) {
        return 'xlsx';
    }
    if (normalized.endsWith('.csv')) {
        return 'csv';
    }
    if (normalized.endsWith('.json')) {
        return 'json';
    }
    return null;
}

function getMessages(locale: 'ru' | 'en') {
    if (locale === 'ru') {
        return {
            exportButton: 'Экспорт',
            importButton: 'Импорт',
            exportTitle: 'Экспорт данных',
            importTitle: 'Импорт данных',
            exporting: 'Экспорт...',
            importing: 'Импорт...',
            exportConfirm: 'Экспортировать',
            confirmImport: 'Подтвердить импорт',
            cancel: 'Отмена',
            formatLabel: 'Формат',
            exportFieldsLabel: 'Поля для экспорта',
            importFieldsLabel: 'Поля для импорта',
            selectAllFields: 'Все',
            clearFields: 'Очистить',
            chooseFile: 'Выбрать файл',
            validate: 'Проверить',
            conflictModeLabel: 'Действие при совпадении PK',
            validationSummaryTitle: 'Результат проверки',
            exportCount: (count: number, selected: boolean) => selected
                ? `Будет экспортировано объектов: ${count}`
                : `Будут экспортированы все объекты текущего результата: ${count}`,
            conflictMode: (mode: ImportConflictMode) => ({
                auto_generate_pk: 'Сгенерировать новый PK',
                update_existing: 'Обновить существующие',
                skip_existing: 'Пропустить существующие',
            })[mode],
            validationSummary: (result: ImportValidationResponse) => (
                `Всего строк: ${result.summary.total_rows}. Создать: ${result.summary.create}. `
                + `Обновить: ${result.summary.update}. Пропустить: ${result.summary.skip}. Ошибок: ${result.summary.errors}.`
            ),
            importSuccess: (result: ImportCommitResponse) => (
                `Импорт завершён. Создано: ${result.created}, обновлено: ${result.updated}, пропущено: ${result.skipped}.`
            ),
        };
    }

    return {
        exportButton: 'Export',
        importButton: 'Import',
        exportTitle: 'Export data',
        importTitle: 'Import data',
        exporting: 'Exporting...',
        importing: 'Importing...',
        exportConfirm: 'Export',
        confirmImport: 'Confirm import',
        cancel: 'Cancel',
        formatLabel: 'Format',
        exportFieldsLabel: 'Fields to export',
        importFieldsLabel: 'Fields to import',
        selectAllFields: 'All',
        clearFields: 'Clear',
        chooseFile: 'Choose file',
        validate: 'Validate',
        conflictModeLabel: 'Conflict mode',
        validationSummaryTitle: 'Validation summary',
        exportCount: (count: number, selected: boolean) => selected
            ? `Objects to export: ${count}`
            : `All objects from the current result will be exported: ${count}`,
        conflictMode: (mode: ImportConflictMode) => ({
            auto_generate_pk: 'Auto-generate PK',
            update_existing: 'Update existing',
            skip_existing: 'Skip existing',
        })[mode],
        validationSummary: (result: ImportValidationResponse) => (
            `Rows: ${result.summary.total_rows}. Create: ${result.summary.create}. `
            + `Update: ${result.summary.update}. Skip: ${result.summary.skip}. Errors: ${result.summary.errors}.`
        ),
        importSuccess: (result: ImportCommitResponse) => (
            `Import completed. Created: ${result.created}, updated: ${result.updated}, skipped: ${result.skipped}.`
        ),
    };
}
