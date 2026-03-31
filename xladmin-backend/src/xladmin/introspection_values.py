from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import inspect as sa_inspect
from xladmin.config import AdminModelConfig
from xladmin.introspection_fields import serialize_related_pk


def convert_value_for_column(column: Any, value: Any) -> Any:
    if value is None:
        return None

    try:
        python_type = column.type.python_type
    except NotImplementedError:
        python_type = None

    if python_type is None:
        return value
    if python_type is bool:
        return convert_boolean_scalar(value)
    if python_type is int:
        return int(value)
    if python_type is float:
        return float(value)
    if python_type is Decimal:
        return Decimal(str(value))
    if python_type is date:
        return date.fromisoformat(str(value))
    if python_type is datetime:
        return datetime.fromisoformat(str(value))
    if python_type is UUID:
        return UUID(str(value))
    if python_type is str:
        return str(value)
    return value


def convert_boolean_scalar(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    normalized_value = str(value).strip().lower()
    if normalized_value in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized_value in {"0", "false", "no", "n", "off", ""}:
        return False
    raise ValueError(f"Cannot convert value '{value}' to boolean.")


def get_field_value(config: AdminModelConfig, instance: Any, field_name: str) -> Any:
    field_config = config.get_field_config(field_name)
    if field_config.value_getter is not None:
        return field_config.value_getter(instance)

    mapper = sa_inspect(config.model)
    if field_name in mapper.relationships:
        relationship = mapper.relationships[field_name]
        related_value = getattr(instance, field_name, None)
        if relationship.uselist:
            return [serialize_related_pk(item) for item in list(related_value or [])]
        if related_value is None:
            return None
        return serialize_related_pk(related_value)

    return getattr(instance, field_name, None)
