from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal

FieldInputKind = Literal[
    "text",
    "textarea",
    "password",
    "number",
    "decimal",
    "boolean",
    "date",
    "datetime",
    "json",
    "relation",
    "relation-multiple",
]

ListFilterInputKind = Literal["text", "select", "boolean"]


@dataclass(slots=True)
class FieldConfig:
    label: str | None = None
    help_text: str | None = None
    width_px: int | None = None
    hidden_in_list: bool = False
    hidden_in_detail: bool = False
    hidden_in_form: bool = False
    read_only: bool = False
    input_kind: FieldInputKind | None = None
    ordering_field: str | None = None
    value_getter: Callable[[Any], Any] | None = None
    value_parser: Callable[[Any], Any] | None = None
    value_setter: Callable[[Any, Any, dict[str, Any], str], None] | None = None
    relation_label_field: str | None = None
    relation_model: type[Any] | None = None


@dataclass(slots=True)
class ListFilterOptionConfig:
    value: str
    label: str
    filter_handler: Callable[[Any, Any, Any, Any], Awaitable[Any] | Any] | None = None


@dataclass(slots=True)
class ListFilterConfig:
    slug: str
    label: str
    group: str | None = None
    field_name: str | None = None
    input_kind: ListFilterInputKind | None = None
    placeholder: str | None = None
    options: tuple[ListFilterOptionConfig, ...] = ()
    value_parser: Callable[[str], Any] | None = None
    filter_handler: Callable[[Any, Any, Any, Any], Awaitable[Any] | Any] | None = None
    relation_label_field: str | None = None
    relation_model: type[Any] | None = None


@dataclass(slots=True)
class BulkActionConfig:
    slug: str
    label: str
    handler: Callable[
        [Any, ModelConfig, list[Any], dict[str, Any], Any],
        Awaitable[dict[str, Any] | None] | dict[str, Any] | None,
    ]


@dataclass(slots=True)
class ObjectActionConfig:
    slug: str
    label: str
    handler: Callable[
        [Any, ModelConfig, Any, dict[str, Any], Any],
        Awaitable[dict[str, Any] | None] | dict[str, Any] | None,
    ]


@dataclass(slots=True)
class ModelsBlockConfig:
    slug: str
    title: str
    models: tuple[type[Any] | str, ...] = ()
    model_slugs: tuple[str, ...] = ()
    description: str | None = None
    color: str | None = None
    collapsible: bool = False
    default_expanded: bool = True


@dataclass(slots=True)
class ModelConfig:
    model: type[Any]
    slug: str | None = None
    title: str | None = None
    description: str | None = None
    fields: dict[str, FieldConfig] = field(default_factory=dict)
    pk_field: str = "id"
    display_field: str | None = None
    search_fields: tuple[str, ...] = ()
    search_query_builder: Callable[[Any, str, Any], Any] | None = None
    query_for_list: Callable[[Any, Any, Any], Awaitable[Any] | Any] | None = None
    list_filters: tuple[ListFilterConfig, ...] = ()
    list_display: tuple[str, ...] | None = None
    list_fields: tuple[str, ...] | None = None
    detail_fields: tuple[str, ...] | None = None
    create_fields: tuple[str, ...] | None = None
    update_fields: tuple[str, ...] | None = None
    ordering: tuple[str, ...] = ()
    page_size: int = 50
    bulk_actions: tuple[BulkActionConfig, ...] = ()
    object_actions: tuple[ObjectActionConfig, ...] = ()

    def get_field_config(self, field_name: str) -> FieldConfig:
        return self.fields.get(field_name, FieldConfig())


@dataclass(slots=True)
class AdminConfig:
    models: tuple[ModelConfig, ...] = ()
    models_blocks: tuple[ModelsBlockConfig, ...] = ()
    locale: str = "ru"


@dataclass(slots=True)
class HttpConfig:
    registry: Any
    get_db_session_dependency: Callable[..., Any]
    get_current_user_dependency: Callable[..., Any]
    is_allowed: Callable[[Any], bool]


AdminFieldConfig = FieldConfig
AdminListFilterConfig = ListFilterConfig
AdminListFilterOptionConfig = ListFilterOptionConfig
AdminBulkActionConfig = BulkActionConfig
AdminObjectActionConfig = ObjectActionConfig
AdminModelsBlockConfig = ModelsBlockConfig
AdminModelConfig = ModelConfig
AdminHTTPConfig = HttpConfig
ModelsBlock = ModelsBlockConfig
