from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class AdminFieldConfig:
    """
    Настройки одного поля в админке.

    Через этот объект можно скрывать поле, запрещать редактирование и подсказывать,
    какое поле лучше использовать как label у связанного объекта.
    """

    label: str | None = None
    help_text: str | None = None
    hidden_in_list: bool = False
    hidden_in_detail: bool = False
    hidden_in_form: bool = False
    read_only: bool = False
    input_kind: str | None = None
    ordering_field: str | None = None
    value_getter: Callable[[Any], Any] | None = None
    value_parser: Callable[[Any], Any] | None = None
    value_setter: Callable[[Any, Any, dict[str, Any], str], None] | None = None
    relation_label_field: str | None = None
    relation_model: type[Any] | None = None


@dataclass(slots=True)
class AdminBulkActionConfig:
    """
    Описывает bulk-операцию над выбранными объектами списка.

    По умолчанию библиотека уже умеет удаление, а через этот конфиг проект
    может добавить свои действия, например архивирование или массовую смену статуса.
    """

    slug: str
    label: str
    handler: Callable[
        [Any, AdminModelConfig, list[Any], dict[str, Any], Any],
        Awaitable[dict[str, Any] | None] | dict[str, Any] | None
    ]


@dataclass(slots=True)
class AdminObjectActionConfig:
    """
    Описывает кастомное действие над конкретным объектом.

    Такие действия показываются на детальной странице объекта справа, рядом со
    встроенными действиями `Сохранить` и `Удалить`.
    """

    slug: str
    label: str
    handler: Callable[
        [Any, AdminModelConfig, Any, dict[str, Any], Any],
        Awaitable[dict[str, Any] | None] | dict[str, Any] | None
    ]


@dataclass(slots=True)
class AdminModelConfig:
    """
    Описание ORM-модели для админки.

    `slug` используется в URL и в frontend routing.
    `title` это человекочитаемое имя модели в sidebar и на страницах.
    """

    model: type[Any]
    slug: str
    title: str
    fields: dict[str, AdminFieldConfig] = field(default_factory=dict)
    pk_field: str = "id"
    display_field: str | None = None
    search_fields: tuple[str, ...] = ()
    search_query_builder: Callable[[Any, str, Any], Any] | None = None
    list_display: tuple[str, ...] | None = None
    list_fields: tuple[str, ...] | None = None
    detail_fields: tuple[str, ...] | None = None
    create_fields: tuple[str, ...] | None = None
    update_fields: tuple[str, ...] | None = None
    ordering: tuple[str, ...] = ()
    page_size: int = 50
    bulk_actions: tuple[AdminBulkActionConfig, ...] = ()
    object_actions: tuple[AdminObjectActionConfig, ...] = ()

    def get_field_config(self, field_name: str) -> AdminFieldConfig:
        return self.fields.get(field_name, AdminFieldConfig())


@dataclass(slots=True)
class AdminHTTPConfig:
    """
    HTTP-конфиг для подключения админки к проекту.

    Библиотека не знает, как у проекта устроены session и auth.
    Поэтому проект сам передаёт зависимости и правило доступа.
    """

    registry: Any
    get_db_session_dependency: Callable[..., Any]
    get_current_user_dependency: Callable[..., Any]
    is_allowed: Callable[[Any], bool]
