from __future__ import annotations

from typing import Any

SUPPORTED_LOCALES = {"ru", "en"}
DEFAULT_LOCALE = "ru"

_MESSAGES: dict[str, dict[str, str]] = {
    "ru": {
        "delete": "Удалить",
        "forbidden": "Доступ запрещён.",
        "admin_model_not_found": "Модель админки не найдена.",
        "object_not_found": "Объект не найден.",
        "object_action_not_found": "Действие объекта не найдено.",
        "bulk_action_not_found": "Массовое действие не найдено.",
        "field_has_no_relation_choices": "У поля нет связанных вариантов выбора.",
        "related_model_not_found": "Связанная модель не найдена.",
        "delete_blocked": "Удаление заблокировано связанными объектами.",
    },
    "en": {
        "delete": "Delete",
        "forbidden": "Access denied.",
        "admin_model_not_found": "Admin model was not found.",
        "object_not_found": "Object was not found.",
        "object_action_not_found": "Object action was not found.",
        "bulk_action_not_found": "Bulk action was not found.",
        "field_has_no_relation_choices": "The field has no related choices.",
        "related_model_not_found": "Related model was not found.",
        "delete_blocked": "Deletion is blocked by related objects.",
    },
}


def normalize_locale(locale: str | None) -> str:
    if locale in SUPPORTED_LOCALES:
        return locale
    return DEFAULT_LOCALE


def translate(locale: str | None, key: str, **kwargs: Any) -> str:
    normalized_locale = normalize_locale(locale)
    template = _MESSAGES.get(normalized_locale, _MESSAGES[DEFAULT_LOCALE]).get(key, key)
    if kwargs:
        return template.format(**kwargs)
    return template
