from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import inspect as sa_inspect

from xladmin.config import AdminModelConfig
from xladmin.i18n import normalize_locale, translate
from xladmin.introspection_fields import (
    get_all_field_names,
    get_column_names,
    get_create_fields,
    get_pk_field_name,
    get_relationship_names,
    get_sort_column_name,
    get_update_fields,
    get_visible_detail_fields,
    get_visible_list_fields,
    is_read_only,
)
from xladmin.registry import AdminRegistry


def get_model_meta(config: AdminModelConfig, *, locale: str = "ru") -> dict[str, Any]:
    normalized_locale = normalize_locale(locale)
    mapper = sa_inspect(config.model)
    relation_names = set(get_relationship_names(config))
    column_names = set(get_column_names(config))
    fields: list[dict[str, Any]] = []

    for name in get_all_field_names(config):
        field_config = config.get_field_config(name)
        column = mapper.columns[name] if name in column_names else None
        fields.append(
            {
                "name": name,
                "label": field_config.label or name,
                "help_text": field_config.help_text,
                "width_px": field_config.width_px,
                "display_kind": field_config.display_kind or "text",
                "image_url_prefix": field_config.image_url_prefix,
                "nullable": bool(column.nullable) if column is not None else True,
                "read_only": is_read_only(config, name),
                "hidden_in_list": field_config.hidden_in_list,
                "hidden_in_detail": field_config.hidden_in_detail,
                "hidden_in_form": field_config.hidden_in_form,
                "type": _get_field_type(config, name, column),
                "input_kind": _get_input_kind(config, name, column),
                "is_primary_key": bool(column.primary_key) if column is not None else False,
                "is_virtual": column is None,
                "has_choices": has_relation_choice_endpoint(config, name, relation_names),
                "is_relation": name in relation_names or (column is not None and bool(column.foreign_keys)),
                "is_relation_many": name in relation_names and bool(mapper.relationships[name].uselist),
                "is_sortable": get_sort_column_name(config, name) is not None,
            },
        )

    return {
        "locale": normalized_locale,
        "slug": config.slug,
        "title": config.title,
        "description": config.description,
        "pk_field": get_pk_field_name(config),
        "display_field": config.display_field,
        "page_size": config.page_size,
        "list_filters": [
            {
                "slug": list_filter.slug,
                "label": list_filter.label,
                "group": list_filter.group,
                "field_name": list_filter.field_name,
                "input_kind": get_list_filter_input_kind(config, list_filter),
                "placeholder": list_filter.placeholder,
                "has_choices": list_filter_has_choices(config, list_filter),
                "options": get_list_filter_options(normalized_locale, config, list_filter),
            }
            for list_filter in config.list_filters
        ],
        "list_fields": get_visible_list_fields(config),
        "detail_fields": get_visible_detail_fields(config),
        "create_fields": get_create_fields(config),
        "update_fields": get_update_fields(config),
        "bulk_actions": [
            {"slug": "delete", "label": translate(normalized_locale, "delete")},
            *[
                {"slug": action.slug, "label": action.label}
                for action in config.bulk_actions
            ],
        ],
        "object_actions": [
            {"slug": action.slug, "label": action.label}
            for action in config.object_actions
        ],
        "fields": fields,
    }


def get_model_blocks_meta(registry: AdminRegistry) -> list[dict[str, Any]]:
    return [
        {
            "slug": block.slug,
            "title": block.title,
            "description": block.description,
            "color": block.color,
            "collapsible": block.collapsible,
            "default_expanded": block.default_expanded,
            "models": [get_model_meta(model_config, locale=registry.locale) for model_config in model_configs],
        }
        for block, model_configs in registry.resolve_model_blocks()
    ]


def has_relation_choice_endpoint(
    config: AdminModelConfig,
    field_name: str,
    relation_names: set[str],
) -> bool:
    field_config = config.get_field_config(field_name)
    if field_config.relation_model is not None:
        return True
    if field_name in relation_names:
        return True
    mapper = sa_inspect(config.model)
    if field_name not in mapper.columns:
        return False
    column = mapper.columns[field_name]
    return bool(column.foreign_keys)


def get_list_filter_input_kind(config: AdminModelConfig, list_filter: Any) -> str:
    if list_filter.input_kind is not None:
        return list_filter.input_kind
    if list_filter.options or list_filter.relation_model is not None:
        return "select"
    if list_filter.field_name is None:
        return "text"

    mapper = sa_inspect(config.model)
    if list_filter.field_name in mapper.relationships:
        return "select"
    if list_filter.field_name not in mapper.columns:
        return "text"

    column = mapper.columns[list_filter.field_name]
    try:
        python_type = column.type.python_type
    except NotImplementedError:
        return "text"
    if python_type is bool:
        return "boolean"
    return "text"


def list_filter_has_choices(config: AdminModelConfig, list_filter: Any) -> bool:
    if list_filter.options:
        return True
    input_kind = get_list_filter_input_kind(config, list_filter)
    if input_kind == "boolean" or list_filter.relation_model is not None:
        return True
    if list_filter.field_name is None:
        return False
    mapper = sa_inspect(config.model)
    return list_filter.field_name in mapper.relationships


def get_list_filter_options(locale: str, config: AdminModelConfig, list_filter: Any) -> list[dict[str, str]]:
    input_kind = get_list_filter_input_kind(config, list_filter)
    if list_filter.options:
        return [{"value": option.value, "label": option.label} for option in list_filter.options]
    if input_kind == "boolean":
        return [
            {"value": "true", "label": translate(locale, "yes")},
            {"value": "false", "label": translate(locale, "no")},
        ]
    return []


def _get_field_type(config: AdminModelConfig, field_name: str, column: Any | None) -> str:
    field_config = config.get_field_config(field_name)
    if field_config.input_kind is not None:
        return field_config.input_kind
    mapper = sa_inspect(config.model)
    if field_name in mapper.relationships:
        return "relationship"
    if column is None:
        return "virtual"
    return str(column.type)


def _get_input_kind(config: AdminModelConfig, field_name: str, column: Any | None) -> str:
    field_config = config.get_field_config(field_name)
    if field_config.input_kind is not None:
        return field_config.input_kind
    mapper = sa_inspect(config.model)
    if field_name in mapper.relationships:
        return "relation-multiple" if mapper.relationships[field_name].uselist else "relation"
    if column is None:
        return "text"
    if "json" in str(column.type).lower():
        return "json"

    try:
        python_type = column.type.python_type
    except NotImplementedError:
        return "text"

    if python_type is bool:
        return "boolean"
    if python_type is int:
        return "number"
    if python_type is float:
        return "number"
    if python_type is Decimal:
        return "decimal"
    if python_type is datetime:
        return "datetime"
    if python_type is UUID:
        return "text"
    if str(column.type).lower() == "date":
        return "date"
    if str(column.type).lower().startswith("varchar") and "password" in field_name.lower():
        return "password"
    return "text"
