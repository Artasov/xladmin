from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import ColumnProperty, RelationshipProperty

from xladmin.config import AdminModelConfig
from xladmin.i18n import normalize_locale, translate
from xladmin.registry import AdminRegistry


def get_mapper_field_names(config: AdminModelConfig) -> list[str]:
    """
    Возвращает имена ORM-атрибутов в их естественном порядке объявления в модели.

    Это основной дефолтный порядок для detail/list/create/update представлений,
    если проект не переопределил его явно через конфиг.
    """

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
    """
    Возвращает полный список полей модели для админки.

    Помимо ORM-колонок сюда входят и виртуальные поля, которые клиент библиотеки
    описал в `config.fields`, например `new_password`.
    """

    ordered_names = list(get_mapper_field_names(config))
    configured_names = _get_configured_field_names(config)
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
        if _is_read_only(config, name) or field_config.hidden_in_form:
            continue
        if name in column_names:
            column = mapper.columns[name]
            if name == get_pk_field_name(config) and _pk_is_generated(column):
                continue
        elif name in relationship_names:
            pass
        elif field_config.value_setter is None:
            continue
        fields.append(name)
    return fields


def get_update_fields(config: AdminModelConfig) -> list[str]:
    if config.update_fields is not None:
        return list(config.update_fields)
    relationship_names = set(get_relationship_names(config))
    return [
        name for name in get_all_field_names(config)
        if (
                name != get_pk_field_name(config)
                and not _is_read_only(config, name)
                and not config.get_field_config(name).hidden_in_form
                and (
                        name in get_column_names(config)
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
                "read_only": _is_read_only(config, name),
                "hidden_in_list": field_config.hidden_in_list,
                "hidden_in_detail": field_config.hidden_in_detail,
                "hidden_in_form": field_config.hidden_in_form,
                "type": _get_field_type(config, name, column),
                "input_kind": _get_input_kind(config, name, column),
                "is_primary_key": bool(column.primary_key) if column is not None else False,
                "is_virtual": column is None,
                "has_choices": _has_relation_choice_endpoint(config, name, relation_names),
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
                "input_kind": _get_list_filter_input_kind(config, list_filter),
                "placeholder": list_filter.placeholder,
                "has_choices": _list_filter_has_choices(config, list_filter),
                "options": _get_list_filter_options(normalized_locale, config, list_filter),
            }
            for list_filter in config.list_filters
        ],
        "list_fields": get_visible_list_fields(config),
        "detail_fields": get_visible_detail_fields(config),
        "create_fields": get_create_fields(config),
        "update_fields": get_update_fields(config),
        "bulk_actions": [
            {"slug": "delete", "label": translate(normalized_locale, "delete")}, *[
                {"slug": action.slug, "label": action.label}
                for action in config.bulk_actions
            ]
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


def convert_value_for_column(column, value: Any) -> Any:
    if value is None:
        return None

    try:
        python_type = column.type.python_type
    except NotImplementedError:
        python_type = None

    if python_type is None:
        return value
    if python_type is bool:
        return _convert_boolean_scalar(value)
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


def _convert_boolean_scalar(value: Any) -> bool:
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
            return [_serialize_related_pk(item) for item in list(related_value or [])]
        if related_value is None:
            return None
        return _serialize_related_pk(related_value)

    return getattr(instance, field_name, None)


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


def _is_read_only(config: AdminModelConfig, field_name: str) -> bool:
    return config.get_field_config(field_name).read_only


def _pk_is_generated(column) -> bool:
    if not bool(column.primary_key):
        return False
    if column.autoincrement is True:
        return True
    if column.default is not None or column.server_default is not None:
        return True
    return False


def _has_relation_choice_endpoint(
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


def _get_configured_field_names(config: AdminModelConfig) -> list[str]:
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


def _serialize_related_pk(instance: Any) -> Any:
    mapper = sa_inspect(type(instance))
    pk_column = mapper.primary_key[0]
    return getattr(instance, pk_column.key)


def _get_list_filter_input_kind(config: AdminModelConfig, list_filter: Any) -> str:
    if list_filter.input_kind is not None:
        return list_filter.input_kind

    if list_filter.options:
        return "select"

    if list_filter.relation_model is not None:
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


def _list_filter_has_choices(config: AdminModelConfig, list_filter: Any) -> bool:
    if list_filter.options:
        return True

    input_kind = _get_list_filter_input_kind(config, list_filter)
    if input_kind == "boolean":
        return True
    if list_filter.relation_model is not None:
        return True
    if list_filter.field_name is None:
        return False

    mapper = sa_inspect(config.model)
    return list_filter.field_name in mapper.relationships


def _get_list_filter_options(locale: str, config: AdminModelConfig, list_filter: Any) -> list[dict[str, str]]:
    input_kind = _get_list_filter_input_kind(config, list_filter)
    if list_filter.options:
        return [{"value": option.value, "label": option.label} for option in list_filter.options]
    if input_kind == "boolean":
        return [
            {"value": "true", "label": translate(locale, "yes")},
            {"value": "false", "label": translate(locale, "no")},
        ]
    return []
