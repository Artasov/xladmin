from __future__ import annotations

import json
from typing import Any, cast

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from xladmin.config import HttpConfig, ModelConfig
from xladmin.i18n import translate
from xladmin.introspection_fields import get_pk_field_name
from xladmin.registry import build_registry

from xladmin_import_export.config import ImportConflictMode, ImportExportConfig, ImportExportFormat
from xladmin_import_export.schemas import (
    ExportRequestPayload,
    ImportExportFieldMeta,
    ImportExportMetaResponse,
    ImportValidationResponse,
)
from xladmin_import_export.service import (
    build_export_artifact,
    commit_import_rows,
    get_import_export_config,
    read_import_rows,
    resolve_default_export_fields,
    resolve_default_import_fields,
    resolve_export_fields,
    resolve_export_items,
    resolve_import_fields,
    resolve_pk_type_label,
    supports_auto_generate_pk,
    validate_import_rows,
)


def create_import_export_router(config: HttpConfig) -> APIRouter:
    registry = build_registry(config.registry)
    router = APIRouter(prefix="/xladmin", tags=["XLAdmin Import Export"])
    current_user_dependency = Depends(config.get_current_user_dependency)
    db_session_dependency = Depends(config.get_db_session_dependency)
    file_field = File(...)
    format_field = Form(...)
    fields_field = Form(...)
    conflict_mode_field = Form(...)

    def check_access(user: Any) -> None:
        if not config.is_allowed(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=translate(registry.locale, "forbidden"))

    async def get_model_config(slug: str) -> ModelConfig:
        try:
            model_config = registry.get(slug)
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=translate(registry.locale, "admin_model_not_found"),
            ) from exc
        import_export_config = get_import_export_config(model_config)
        if import_export_config is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import/export is not configured.")
        return model_config

    @router.get("/models/{slug}/import-export/meta/", response_model=ImportExportMetaResponse)
    async def get_import_export_meta(
        slug: str,
        user: Any = current_user_dependency,
    ) -> ImportExportMetaResponse:
        check_access(user)
        model_config = await get_model_config(slug)
        import_export_config = get_enabled_import_export_config(model_config)

        export_fields = resolve_export_fields(model_config, import_export_config)
        default_export_fields = set(resolve_default_export_fields(model_config, import_export_config))
        import_fields = resolve_import_fields(model_config, import_export_config)
        default_import_fields = set(resolve_default_import_fields(model_config, import_export_config))
        available_conflict_modes = get_available_conflict_modes(model_config, import_export_config)

        return ImportExportMetaResponse(
            model_slug=cast(str, model_config.slug),
            export_formats=list(import_export_config.export_formats),
            import_formats=list(import_export_config.import_formats),
            export_fields=[
                ImportExportFieldMeta(
                    name=field_name,
                    label=model_config.get_field_config(field_name).label or field_name,
                    default_selected=field_name in default_export_fields,
                )
                for field_name in export_fields
            ],
            import_fields=[
                ImportExportFieldMeta(
                    name=field_name,
                    label=model_config.get_field_config(field_name).label or field_name,
                    default_selected=field_name in default_import_fields,
                )
                for field_name in import_fields
            ],
            pk_field=get_pk_field_name(model_config),
            pk_type=resolve_pk_type_label(model_config),
            available_conflict_modes=available_conflict_modes,
        )

    @router.post("/models/{slug}/export/")
    async def export_items(
        slug: str,
        payload: ExportRequestPayload,
        session: AsyncSession = db_session_dependency,
        user: Any = current_user_dependency,
    ) -> Response:
        check_access(user)
        model_config = await get_model_config(slug)
        import_export_config = get_enabled_import_export_config(model_config)

        if payload.format not in import_export_config.export_formats:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported export format.")

        export_fields = set(resolve_export_fields(model_config, import_export_config))
        selected_fields = [field_name for field_name in payload.fields if field_name in export_fields]
        if not selected_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid export fields were selected.")

        items = await resolve_export_items(session, model_config, user, payload)
        artifact = build_export_artifact(model_config, items, selected_fields, payload.format)
        return Response(
            content=artifact.content,
            media_type=artifact.content_type,
            headers={"Content-Disposition": f'attachment; filename="{artifact.filename}"'},
        )

    @router.post("/models/{slug}/import/validate/", response_model=ImportValidationResponse)
    async def validate_import(
        slug: str,
        file: UploadFile = file_field,
        format: str = format_field,
        fields: str = fields_field,
        conflict_mode: str = conflict_mode_field,
        session: AsyncSession = db_session_dependency,
        user: Any = current_user_dependency,
    ) -> ImportValidationResponse:
        check_access(user)
        model_config = await get_model_config(slug)
        import_export_config = get_enabled_import_export_config(model_config)
        import_format = validate_import_format(format, import_export_config)
        normalized_conflict_mode = validate_conflict_mode(conflict_mode, model_config, import_export_config)
        selected_fields = parse_fields_json(fields)
        rows = await parse_import_rows(file, import_format)
        return await validate_import_rows(session, model_config, rows, selected_fields, normalized_conflict_mode)

    @router.post("/models/{slug}/import/commit/")
    async def commit_import(
        slug: str,
        file: UploadFile = file_field,
        format: str = format_field,
        fields: str = fields_field,
        conflict_mode: str = conflict_mode_field,
        session: AsyncSession = db_session_dependency,
        user: Any = current_user_dependency,
    ) -> JSONResponse:
        check_access(user)
        model_config = await get_model_config(slug)
        import_export_config = get_enabled_import_export_config(model_config)
        import_format = validate_import_format(format, import_export_config)
        normalized_conflict_mode = validate_conflict_mode(conflict_mode, model_config, import_export_config)
        selected_fields = parse_fields_json(fields)
        rows = await parse_import_rows(file, import_format)
        result = await commit_import_rows(session, model_config, rows, selected_fields, normalized_conflict_mode)
        return JSONResponse(content=result.model_dump(mode="json"))

    return router


def get_enabled_import_export_config(model_config: ModelConfig) -> ImportExportConfig:
    config = get_import_export_config(model_config)
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import/export is not configured.")
    return config


async def parse_import_rows(file: UploadFile, import_format: ImportExportFormat) -> list[dict[str, Any]]:
    try:
        return await read_import_rows(file, import_format)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid import file: {exc}",
        ) from exc


def parse_fields_json(raw_fields: str) -> list[str]:
    try:
        value = json.loads(raw_fields)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid fields payload.") from exc
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Fields must be an array of strings.")
    return value


def validate_import_format(raw_format: str, config: ImportExportConfig) -> ImportExportFormat:
    if raw_format not in config.import_formats:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported import format.")
    return cast(ImportExportFormat, raw_format)


def get_available_conflict_modes(
    model_config: ModelConfig,
    config: ImportExportConfig,
) -> list[ImportConflictMode]:
    available_conflict_modes = list(config.conflict_modes)
    if not supports_auto_generate_pk(model_config):
        available_conflict_modes = [
            mode for mode in available_conflict_modes
            if mode != "auto_generate_pk"
        ]
    return available_conflict_modes


def validate_conflict_mode(
    raw_conflict_mode: str,
    model_config: ModelConfig,
    config: ImportExportConfig,
) -> ImportConflictMode:
    available_conflict_modes = get_available_conflict_modes(model_config, config)
    if raw_conflict_mode not in available_conflict_modes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported conflict mode.")
    return cast(ImportConflictMode, raw_conflict_mode)
