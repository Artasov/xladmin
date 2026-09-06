from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect as sa_inspect

from xladmin.config import ModelConfig
from xladmin.access import ModelWriteAccess
from xladmin.introspection import (
    convert_value_for_column,
    get_column_names,
    get_create_fields,
    get_pk_field_name,
    get_update_fields,
    pk_is_generated,
)
from xladmin.registry import Registry
from xladmin.relation_writes import RelationWriteAccess
from xladmin.router_queries import resolve_relation_model


async def apply_payload_to_item(
        session: AsyncSession,
        model_config: ModelConfig,
        item: Any,
        payload: dict[str, Any],
        *,
        mode: str,
        registry: Registry,
        user: Any,
        allowed_fields: set[str] | None = None,
) -> None:
    ModelWriteAccess.check(model_config)
    mapper = sa_inspect(model_config.model)
    column_names = set(get_column_names(model_config))
    relationship_names = set(mapper.relationships.keys())
    effective_allowed_fields = allowed_fields or set(
        get_create_fields(model_config) if mode == "create" else get_update_fields(model_config)
    )
    for field_name, raw_value in payload.items():
        if field_name not in effective_allowed_fields:
            continue
        field_config = model_config.get_field_config(field_name)
        try:
            value = field_config.value_parser(raw_value) if field_config.value_parser is not None else raw_value

            if field_config.value_setter is not None:
                field_config.value_setter(item, value, payload, mode)
                continue

            if field_name in relationship_names:
                await assign_relationship_value(session, model_config, item, field_name, value, registry=registry, user=user)
                continue

            if field_name not in column_names:
                continue

            column = mapper.columns[field_name]
            if column.foreign_keys and value not in (None, ""):
                relation_model = resolve_relation_model(model_config, field_name)
                relation_pk_name = sa_inspect(relation_model).primary_key[0].key
                related_item, = await RelationWriteAccess.items(session, registry, relation_model, [value], user)
                setattr(item, field_name, getattr(related_item, relation_pk_name))
                continue

            setattr(item, field_name, convert_value_for_column(column, value))
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid value for field '{field_name}'.",
            ) from exc


async def assign_relationship_value(
        session: AsyncSession,
        model_config: ModelConfig,
        item: Any,
        field_name: str,
        value: Any,
        *,
        registry: Registry,
        user: Any,
) -> None:
    mapper = sa_inspect(model_config.model)
    relationship = mapper.relationships[field_name]
    relation_model = resolve_relation_model(model_config, field_name)

    if relationship.uselist:
        raw_ids = list(value or [])
        if not raw_ids:
            setattr(item, field_name, [])
            return
        related_items = await RelationWriteAccess.items(session, registry, relation_model, raw_ids, user)
        setattr(item, field_name, related_items)
        return

    if value in (None, ""):
        setattr(item, field_name, None)
        return

    related_item, = await RelationWriteAccess.items(session, registry, relation_model, [value], user)
    setattr(item, field_name, related_item)


def get_missing_required_create_fields(model_config: ModelConfig, item: Any) -> list[str]:
    mapper = sa_inspect(model_config.model)
    pk_field_name = get_pk_field_name(model_config)
    missing_fields: list[str] = []

    for field_name, column in mapper.columns.items():
        if column.nullable:
            continue
        if field_name == pk_field_name and pk_is_generated(column):
            continue
        if column.default is not None or column.server_default is not None:
            continue
        if getattr(item, field_name, None) is None:
            missing_fields.append(field_name)

    return missing_fields
