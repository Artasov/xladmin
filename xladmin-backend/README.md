# xladmin

`xladmin` это backend-библиотека для быстрой сборки админки поверх `FastAPI` и `SQLAlchemy`.

Важно:

- имя пакета в PyPI: `xladmin`
- Python-импорт внутри проекта: `xladmin`

## Что есть в библиотеке

- `AdminRegistry` — реестр admin-моделей
- `AdminModelConfig` — конфиг одной ORM-модели
- `AdminFieldConfig` — конфиг одного поля
- `AdminBulkActionConfig` — bulk-действие над выбранными объектами
- `create_admin_router(...)` — factory готового FastAPI router

Основные файлы:

- `src/xladmin/config.py`
- `src/xladmin/router.py`
- `src/xladmin/introspection.py`
- `src/xladmin/serializer.py`

## Совместимость

- `FastAPI >=0.115,<1.0`
- `Pydantic >=2.9,<3.0`
- `SQLAlchemy >=2.0,<3.0`

## Документация

Практическая инструкция вынесена в [docs/HOW_TO_USE.md](docs/HOW_TO_USE.md).

Там есть:

- короткий пример подключения
- расширенный пример на `UserORM` и `OrderORM`
- настройка `list_display`, `detail_fields`, `update_fields`
- кастомный поиск
- кастомные `value_getter` / `value_setter`
- relation fields
- bulk actions
- `page_size`
