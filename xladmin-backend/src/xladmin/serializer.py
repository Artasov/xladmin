from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm.attributes import NO_VALUE

from xladmin.config import AdminModelConfig
from xladmin.introspection import (
    get_display_value,
    get_field_value,
    get_pk_value,
    get_relationship_names,
    get_visible_detail_fields,
    get_visible_list_fields,
)


def serialize_model_instance(
        config: AdminModelConfig,
        instance: Any,
        *,
        mode: str,
) -> dict[str, Any]:
    fields = get_visible_list_fields(config) if mode == "list" else get_visible_detail_fields(config)
    payload = {field_name: serialize_scalar(get_field_value(config, instance, field_name)) for field_name in fields}
    payload[config.pk_field] = serialize_scalar(get_pk_value(config, instance))
    payload["_display"] = get_display_value(config, instance)
    if mode == "detail":
        payload["_relations"] = serialize_relations(config, instance)
    return payload


def serialize_relations(config: AdminModelConfig, instance: Any) -> dict[str, Any]:
    mapper = sa_inspect(config.model)
    instance_state = sa_inspect(instance)
    payload: dict[str, Any] = {}
    for relation_name in get_relationship_names(config):
        relationship = mapper.relationships[relation_name]
        if instance_state.attrs[relation_name].loaded_value is NO_VALUE:
            payload[relation_name] = [] if relationship.uselist else None
            continue
        value = getattr(instance, relation_name)
        if value is None:
            payload[relation_name] = None
            continue
        if relationship.uselist:
            items = list(value)
            payload[relation_name] = {
                "count": len(items),
                "items": [_serialize_related_item(item) for item in items[:5]],
            }
            continue
        payload[relation_name] = _serialize_related_item(value)
    return payload


def serialize_scalar(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


def _serialize_related_item(instance: Any) -> dict[str, Any]:
    mapper = sa_inspect(type(instance))
    pk_column = mapper.primary_key[0]
    pk_name = pk_column.key
    label = None
    for candidate in ("name", "title", "username", "slug", "email", "code_name"):
        if hasattr(instance, candidate):
            raw = getattr(instance, candidate)
            if raw is not None:
                label = str(raw)
                break
    return {
        "id": serialize_scalar(getattr(instance, pk_name)),
        "label": label or f"{type(instance).__name__} #{getattr(instance, pk_name)}",
    }
