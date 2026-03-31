from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect as sa_inspect
from xladmin.config import ModelConfig
from xladmin.introspection import convert_value_for_column, get_column_names, get_create_fields, get_update_fields
from xladmin.router_queries import convert_pk, resolve_relation_model


async def apply_payload_to_item(
        session: AsyncSession,
        model_config: ModelConfig,
        item: Any,
        payload: dict[str, Any],
        *,
        mode: str,
) -> None:
    mapper = sa_inspect(model_config.model)
    column_names = set(get_column_names(model_config))
    relationship_names = set(mapper.relationships.keys())
    allowed_fields = set(get_create_fields(model_config) if mode == "create" else get_update_fields(model_config))
    for field_name, raw_value in payload.items():
        if field_name not in allowed_fields:
            continue
        field_config = model_config.get_field_config(field_name)
        try:
            value = field_config.value_parser(raw_value) if field_config.value_parser is not None else raw_value

            if field_config.value_setter is not None:
                field_config.value_setter(item, value, payload, mode)
                continue

            if field_name in relationship_names:
                await assign_relationship_value(session, model_config, item, field_name, value)
                continue

            if field_name not in column_names:
                continue

            column = mapper.columns[field_name]
            if column.foreign_keys and value not in (None, ""):
                relation_model = resolve_relation_model(model_config, field_name)
                relation_pk_name = sa_inspect(relation_model).primary_key[0].key
                related_item = await session.get(relation_model, convert_pk(value))
                if related_item is None:
                    raise ValueError(f"Unknown related id for field '{field_name}'.")
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
) -> None:
    mapper = sa_inspect(model_config.model)
    relationship = mapper.relationships[field_name]
    relation_model = resolve_relation_model(model_config, field_name)
    relation_pk_name = sa_inspect(relation_model).primary_key[0].key

    if relationship.uselist:
        raw_ids = list(value or [])
        if not raw_ids:
            setattr(item, field_name, [])
            return
        normalized_ids = [convert_pk(item_id) for item_id in raw_ids]
        ordered_unique_ids = list(dict.fromkeys(normalized_ids))
        query = select(relation_model).where(getattr(relation_model, relation_pk_name).in_(ordered_unique_ids))
        related_items = list((await session.execute(query)).scalars().unique())
        related_items_by_pk = {
            getattr(related_item, relation_pk_name): related_item
            for related_item in related_items
        }
        if set(related_items_by_pk) != set(ordered_unique_ids):
            raise ValueError(f"Unknown related ids for field '{field_name}'.")
        setattr(item, field_name, [related_items_by_pk[item_id] for item_id in ordered_unique_ids])
        return

    if value in (None, ""):
        setattr(item, field_name, None)
        return

    related_item = await session.get(relation_model, convert_pk(value))
    if related_item is None:
        raise ValueError(f"Unknown related id for field '{field_name}'.")
    setattr(item, field_name, related_item)
