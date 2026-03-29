from __future__ import annotations

from typing import Any, cast

from xladmin.config import AdminLocale

SUPPORTED_LOCALES: set[AdminLocale] = {"ru", "en"}
DEFAULT_LOCALE: AdminLocale = "ru"

_MESSAGES: dict[str, dict[str, str]] = {
    "ru": {
        "delete": "Удалить",
        "yes": "Да",
        "no": "Нет",
        "forbidden": "Доступ запрещён.",
        "admin_model_not_found": "Модель админки не найдена.",
        "object_not_found": "Объект не найден.",
        "object_action_not_found": "Действие объекта не найдено.",
        "bulk_action_not_found": "Массовое действие не найдено.",
        "list_filter_not_found": "Фильтр списка не найден.",
        "field_has_no_relation_choices": "У поля нет связанных вариантов выбора.",
        "related_model_not_found": "Связанная модель не найдена.",
        "delete_blocked": "Удаление заблокировано связанными объектами.",
    },
    "en": {
        "delete": "Delete",
        "yes": "Yes",
        "no": "No",
        "forbidden": "Access denied.",
        "admin_model_not_found": "Admin model was not found.",
        "object_not_found": "Object was not found.",
        "object_action_not_found": "Object action was not found.",
        "bulk_action_not_found": "Bulk action was not found.",
        "list_filter_not_found": "List filter was not found.",
        "field_has_no_relation_choices": "The field has no related choices.",
        "related_model_not_found": "Related model was not found.",
        "delete_blocked": "Deletion is blocked by related objects.",
    },
}


def normalize_locale(locale: str | None) -> AdminLocale:
    if locale == "ru" or locale == "en":
        return cast(AdminLocale, locale)
    return DEFAULT_LOCALE


def translate(locale: str | None, key: str, **kwargs: Any) -> str:
    normalized_locale = normalize_locale(locale)
    template = _MESSAGES.get(normalized_locale, _MESSAGES[DEFAULT_LOCALE]).get(key, key)
    if kwargs:
        return template.format(**kwargs)
    return template
