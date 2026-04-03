<div align="center">
  <a href="../README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin backend

`xladmin-backend` — backend-пакет, который публикуется в PyPI под именем `xladmin`.

Важно:

- имя пакета в PyPI: `xladmin`
- импорт в Python: `from xladmin import ...`
- монорепа: [Artasov/xladmin](https://github.com/Artasov/xladmin)

## Публичный API

- `AdminConfig` / `ModelConfig` / `FieldConfig`
- `ListFilterConfig`
- `BulkActionConfig` / `ObjectActionConfig`
- `ModelsBlock`
- `HttpConfig`
- `create_router(...)`

Для совместимости оставлены alias:

- старые `Admin*` имена конфигов
- `create_admin_router(...)`

## Минимальный пример

```python
from xladmin import AdminConfig, HttpConfig, ModelConfig, create_router

from src.core.auth.dependencies import get_current_user
from src.core.db.session import get_db_session
from src.modules.identity.models import UserORM


config = AdminConfig(
    models=(
        ModelConfig(model=UserORM),
    ),
)

router = create_router(
    HttpConfig(
        registry=config,
        get_db_session_dependency=get_db_session,
        get_current_user_dependency=get_current_user,
        is_allowed=lambda user: bool(user.is_staff),
    ),
)
```

`ModelConfig(model=UserORM)` уже достаточно для базовой админки. Библиотека сама выводит `slug`, `title`, базовые search fields и ordering из ORM-модели.

## Что есть в библиотеке

- list / detail / create / patch / delete endpoints
- bulk actions и object actions
- relation choices и relation filters
- overview metadata и model blocks
- `query_for_list` и кастомный `search_query_builder`
- delete preview для single и bulk delete
- RU / EN locale metadata для фронтенда

## Совместимость

- `FastAPI >=0.115,<1.0`
- `Pydantic >=2.9,<3.0`
- `SQLAlchemy >=2.0,<3.0`
- `Python >=3.12`

## Разработка

```bash
uv sync --extra dev
uv run pytest
uv run ruff check .
uv run mypy
uv run python -m build
uv run python -m twine check dist/*
```

## Документация

- [HOW_TO_USE](./HOW_TO_USE.ru.md)
- [English README](../README.md)
- [README монорепы](../../README.md)
