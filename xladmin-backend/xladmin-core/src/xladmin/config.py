from __future__ import annotations

import builtins
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
    "select",
    "select-multiple",
    "relation",
    "relation-multiple",
]

FieldDisplayKind = Literal["text", "image"]

ListFilterInputKind = Literal["text", "select", "select-multiple", "boolean"]
AdminLocale = Literal["ru", "en"]


@dataclass(slots=True)
class FieldConfig:
    label: str | None = None
    help_text: str | None = None
    required: bool | None = None
    width_px: int | None = None
    display_kind: FieldDisplayKind | None = None
    image_url_prefix: str | None = None
    hidden_in_list: bool = False
    hidden_in_detail: bool = False
    hidden_in_form: bool = False
    hidden_in_create: bool = False
    hidden_in_update: bool = False
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
    multiple: bool = False
    placeholder: str | None = None
    options: tuple[ListFilterOptionConfig, ...] = ()
    value_parser: Callable[[str], Any] | None = None
    filter_handler: Callable[[Any, Any, Any, Any], Awaitable[Any] | Any] | None = None
    relation_label_field: str | None = None
    relation_model: type[Any] | None = None


@dataclass(slots=True)
class FormFieldOptionConfig:
    value: Any
    label: str


@dataclass(slots=True)
class FormFieldConfig:
    name: str
    label: str | None = None
    placeholder: str | None = None
    help_text: str | None = None
    required: bool | None = None
    input_kind: FieldInputKind | None = None
    type: str | None = None
    nullable: bool | None = None
    read_only: bool = False
    relation_label_field: str | None = None
    relation_model: builtins.type[Any] | None = None
    options: tuple[FormFieldOptionConfig, ...] = ()
    auto_now: bool = False


@dataclass(slots=True)
class BulkActionConfig:
    slug: str
    label: str
    handler: Callable[
        [Any, ModelConfig, list[Any], dict[str, Any], Any],
        Awaitable[dict[str, Any] | None] | dict[str, Any] | None,
    ]
    form: tuple[FormFieldConfig, ...] | None = None


@dataclass(slots=True)
class ObjectActionConfig:
    slug: str
    label: str
    handler: Callable[
        [Any, ModelConfig, Any, dict[str, Any], Any],
        Awaitable[dict[str, Any] | None] | dict[str, Any] | None,
    ]
    form: tuple[FormFieldConfig, ...] | None = None


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
    create_form: tuple[FormFieldConfig, ...] | None = None
    create_fields: tuple[str, ...] | None = None
    update_fields: tuple[str, ...] | None = None
    create_handler: Callable[[Any, ModelConfig, dict[str, Any], Any], Awaitable[Any] | Any] | None = None
    create_item_factory: Callable[[dict[str, Any], Any, Any], Awaitable[Any] | Any] | None = None
    ordering: tuple[str, ...] = ()
    page_size: int = 50
    import_export: Any | None = None
    bulk_actions: tuple[BulkActionConfig, ...] = ()
    object_actions: tuple[ObjectActionConfig, ...] = ()

    def has_field_config(self, field_name: str) -> bool:
        return field_name in self.fields

    def get_field_config(self, field_name: str) -> FieldConfig:
        return self.fields.get(field_name, FieldConfig())

    def get_create_form_field(self, field_name: str) -> FormFieldConfig | None:
        if self.create_form is None:
            return None
        return next((field for field in self.create_form if field.name == field_name), None)

    def get_bulk_action(self, action_slug: str) -> BulkActionConfig | None:
        return next((action for action in self.bulk_actions if action.slug == action_slug), None)

    def get_object_action(self, action_slug: str) -> ObjectActionConfig | None:
        return next((action for action in self.object_actions if action.slug == action_slug), None)

    def get_bulk_action_form_field(self, action_slug: str, field_name: str) -> FormFieldConfig | None:
        action = self.get_bulk_action(action_slug)
        if action is None or action.form is None:
            return None
        return next((field for field in action.form if field.name == field_name), None)

    def get_object_action_form_field(self, action_slug: str, field_name: str) -> FormFieldConfig | None:
        action = self.get_object_action(action_slug)
        if action is None or action.form is None:
            return None
        return next((field for field in action.form if field.name == field_name), None)


@dataclass(slots=True)
class AdminConfig:
    models: tuple[ModelConfig, ...] = ()
    models_blocks: tuple[ModelsBlockConfig, ...] = ()
    locale: AdminLocale = "ru"


@dataclass(slots=True)
class HttpConfig:
    registry: Any
    get_db_session_dependency: Callable[..., Any]
    get_current_user_dependency: Callable[..., Any]
    is_allowed: Callable[[Any], bool]


AdminFieldConfig = FieldConfig
AdminListFilterConfig = ListFilterConfig
AdminListFilterOptionConfig = ListFilterOptionConfig
AdminFormFieldConfig = FormFieldConfig
AdminFormFieldOptionConfig = FormFieldOptionConfig
AdminBulkActionConfig = BulkActionConfig
AdminObjectActionConfig = ObjectActionConfig
AdminModelsBlockConfig = ModelsBlockConfig
AdminModelConfig = ModelConfig
AdminHTTPConfig = HttpConfig
ModelsBlock = ModelsBlockConfig
