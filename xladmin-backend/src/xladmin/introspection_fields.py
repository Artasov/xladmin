from __future__ import annotations

from typing import Any

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import ColumnProperty, RelationshipProperty

from xladmin.config import AdminModelConfig


def get_mapper_field_names(config: AdminModelConfig) -> list[str]:
    mapper = sa_inspect(config.model)
    ordered_names: list[str] = []
    declared_names = getattr(config.model, "__annotations__", {})

    for field_name in declared_names:
        if field_name not in mapper.attrs:
            continue
        prop = mapper.attrs[field_name]
        if isinstance(prop, ColumnProperty | RelationshipProperty):
            ordered_names.append(prop.key)

    for prop in mapper.attrs:
        if not isinstance(prop, ColumnProperty | RelationshipProperty):
            continue
        if prop.key not in ordered_names:
            ordered_names.append(prop.key)

    return ordered_names


def get_column_names(config: AdminModelConfig) -> list[str]:
    mapper = sa_inspect(config.model)
    return [prop.key for prop in mapper.attrs if isinstance(prop, ColumnProperty)]


def get_relationship_names(config: AdminModelConfig) -> list[str]:
    mapper = sa_inspect(config.model)
    return [prop.key for prop in mapper.attrs if isinstance(prop, RelationshipProperty)]


def get_all_field_names(config: AdminModelConfig) -> list[str]:
    ordered_names = list(get_mapper_field_names(config))
    configured_names = get_configured_field_names(config)
    for field_name in config.fields:
        if field_name not in ordered_names:
            ordered_names.append(field_name)
    for field_name in configured_names:
        if field_name not in ordered_names:
            ordered_names.append(field_name)
    return ordered_names


def get_visible_list_fields(config: AdminModelConfig) -> list[str]:
    if config.list_display is not None:
        return list(config.list_display)
    if config.list_fields is not None:
        return list(config.list_fields)
    return [name for name in get_all_field_names(config) if not config.get_field_config(name).hidden_in_list]


def get_visible_detail_fields(config: AdminModelConfig) -> list[str]:
    if config.detail_fields is not None:
        return list(config.detail_fields)
    return [name for name in get_all_field_names(config) if not config.get_field_config(name).hidden_in_detail]


def get_create_fields(config: AdminModelConfig) -> list[str]:
    if config.create_fields is not None:
        return list(config.create_fields)
    mapper = sa_inspect(config.model)
    fields: list[str] = []
    column_names = set(get_column_names(config))
    relationship_names = set(get_relationship_names(config))
    for name in get_all_field_names(config):
        field_config = config.get_field_config(name)
        if is_read_only(config, name) or field_config.hidden_in_form:
            continue
        if name in column_names:
            column = mapper.columns[name]
            if name == get_pk_field_name(config) and pk_is_generated(column):
                continue
        elif name not in relationship_names and field_config.value_setter is None:
            continue
        fields.append(name)
    return fields


def get_update_fields(config: AdminModelConfig) -> list[str]:
    if config.update_fields is not None:
        return list(config.update_fields)
    relationship_names = set(get_relationship_names(config))
    column_names = set(get_column_names(config))
    return [
        name for name in get_all_field_names(config)
        if (
            name != get_pk_field_name(config)
            and not is_read_only(config, name)
            and not config.get_field_config(name).hidden_in_form
            and (
                name in column_names
                or name in relationship_names
                or config.get_field_config(name).value_setter is not None
            )
        )
    ]


def get_pk_field_name(config: AdminModelConfig) -> str:
    mapper = sa_inspect(config.model)
    if hasattr(config.model, config.pk_field):
        return config.pk_field
    return mapper.primary_key[0].key


def get_pk_value(config: AdminModelConfig, instance: Any) -> Any:
    return getattr(instance, get_pk_field_name(config))


def get_display_value(config: AdminModelConfig, instance: Any) -> str:
    if config.display_field:
        value = getattr(instance, config.display_field, None)
        if value is not None:
            return str(value)
    pk_value = get_pk_value(config, instance)
    return f"{config.title} #{pk_value}"


def get_sort_column_name(config: AdminModelConfig, field_name: str) -> str | None:
    field_config = config.get_field_config(field_name)
    if field_config.ordering_field is not None:
        return field_config.ordering_field

    mapper = sa_inspect(config.model)
    if field_name in mapper.columns:
        return field_name

    if field_name in mapper.relationships and not mapper.relationships[field_name].uselist:
        relationship = mapper.relationships[field_name]
        local_columns = list(relationship.local_columns)
        if local_columns:
            return local_columns[0].key

    return None


def is_read_only(config: AdminModelConfig, field_name: str) -> bool:
    return config.get_field_config(field_name).read_only


def pk_is_generated(column: Any) -> bool:
    if not bool(column.primary_key):
        return False
    if column.autoincrement is True:
        return True
    if column.default is not None or column.server_default is not None:
        return True
    return False


def get_configured_field_names(config: AdminModelConfig) -> list[str]:
    names: list[str] = []
    for field_group in (
        config.list_display,
        config.list_fields,
        config.detail_fields,
        config.create_fields,
        config.update_fields,
    ):
        if field_group is None:
            continue
        for field_name in field_group:
            if field_name not in names:
                names.append(field_name)
    return names


def serialize_related_pk(instance: Any) -> Any:
    mapper = sa_inspect(type(instance))
    pk_column = mapper.primary_key[0]
    return getattr(instance, pk_column.key)
