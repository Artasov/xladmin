from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from xladmin_import_export.config import ImportConflictMode, ImportExportFormat


class ExportSelectionScopePayload(BaseModel):
    q: str | None = None
    sort: str | None = None
    filters: dict[str, str] = Field(default_factory=dict)


class ExportRequestPayload(BaseModel):
    format: ImportExportFormat
    fields: list[str] = Field(default_factory=list)
    ids: list[Any] = Field(default_factory=list)
    select_all: bool = False
    selection_scope: ExportSelectionScopePayload | None = None


class ImportExportFieldMeta(BaseModel):
    name: str
    label: str
    default_selected: bool


class ImportExportMetaResponse(BaseModel):
    model_slug: str
    export_formats: list[ImportExportFormat]
    import_formats: list[ImportExportFormat]
    export_fields: list[ImportExportFieldMeta]
    import_fields: list[ImportExportFieldMeta]
    pk_field: str
    pk_type: str
    available_conflict_modes: list[ImportConflictMode]


class ImportPreviewItem(BaseModel):
    row_number: int
    label: str


class ImportValidationErrorPayload(BaseModel):
    row_number: int
    field: str | None = None
    message: str


class ImportValidationSummary(BaseModel):
    total_rows: int
    create: int
    update: int
    skip: int
    errors: int


class ImportValidationResponse(BaseModel):
    summary: ImportValidationSummary
    created_preview: list[ImportPreviewItem] = Field(default_factory=list)
    updated_preview: list[ImportPreviewItem] = Field(default_factory=list)
    skipped_preview: list[ImportPreviewItem] = Field(default_factory=list)
    errors: list[ImportValidationErrorPayload] = Field(default_factory=list)


class ImportCommitResponse(BaseModel):
    created: int
    updated: int
    skipped: int
