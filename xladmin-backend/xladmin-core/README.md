<div align="center">
  <a href="./README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./docs/README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin backend

`xladmin-backend` is the backend package published to PyPI as `xladmin`.

Important:

- package name on PyPI: `xladmin`
- Python import: `from xladmin import ...`
- monorepo: [Artasov/xladmin](https://github.com/Artasov/xladmin)

## Public API

- `AdminConfig` / `ModelConfig` / `FieldConfig`
- `ListFilterConfig`
- `BulkActionConfig` / `ObjectActionConfig`
- `ModelsBlock`
- `HttpConfig`
- `create_router(...)`

Compatibility aliases are kept:

- `Admin*` config names
- `create_admin_router(...)`

## Minimal Example

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

`ModelConfig(model=UserORM)` is enough for a basic admin. The library derives default `slug`, `title`, search fields, and ordering from the ORM model.

## Features

- list / detail / create / patch / delete endpoints
- bulk actions and object actions
- relation choices and relation filters
- overview metadata and model blocks
- `query_for_list` and custom `search_query_builder`
- delete preview for single and bulk delete
- RU / EN locale metadata for the frontend

## Compatibility

- `FastAPI >=0.115,<1.0`
- `Pydantic >=2.9,<3.0`
- `SQLAlchemy >=2.0,<3.0`
- `Python >=3.12`

## Development

```bash
uv sync --extra dev
uv run pytest
uv run ruff check .
uv run mypy
uv run python -m build
uv run python -m twine check dist/*
```

## Docs

- [docs/HOW_TO_USE.md](./docs/HOW_TO_USE.md)
- [xladmin-import-export backend](./xladmin-import-export/README.md)
- [Russian README](./docs/README.ru.md)
- [Monorepo README](../README.md)
