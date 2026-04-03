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
- single and multi-select relation filters via `ListFilterConfig(..., multiple=True, input_kind="relation-multiple")`
- overview metadata and model blocks
- `query_for_list` and custom `search_query_builder`
- mode-specific form fields with `hidden_in_create` / `hidden_in_update`
- custom create defaults with `create_item_factory`
- delete preview for single and bulk delete
- RU / EN locale metadata for the frontend

## Multi-Select Relation Filters

If one relation filter is not enough, you can expose a multi-select variant that works as an autocomplete with add/remove chips on the frontend.

```python
from xladmin import ListFilterConfig


ListFilterConfig(
    slug="role_ids",
    label="Roles",
    field_name="roles",
    input_kind="relation-multiple",
    multiple=True,
    relation_model=RoleORM,
    relation_label_field="name",
)
```

## Create And Update Fields

If a field should be visible only in one form mode, use `hidden_in_create` or `hidden_in_update`.

```python
from xladmin import FieldConfig, ModelConfig


ModelConfig(
    model=UserORM,
    fields={
        "password": FieldConfig(
            input_kind="password",
            hidden_in_update=True,
            value_setter=set_user_password,
        ),
        "new_password": FieldConfig(
            input_kind="password",
            hidden_in_create=True,
            value_getter=lambda _user: "",
            value_setter=set_user_password,
        ),
    },
)
```

If create requires hidden service fields, use `create_item_factory`.

```python
from xladmin import ModelConfig


def create_admin_user(payload, session, user):
    del payload, session, user
    return UserORM(
        date_joined=AuthBase.now(),
        secret_key=AuthBase.generate_secret_key(),
    )


ModelConfig(
    model=UserORM,
    create_fields=("username", "email", "password"),
    create_item_factory=create_admin_user,
)
```

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
- [PyPI package](https://pypi.org/project/xladmin/)
- [xladmin-import-export backend](../xladmin-import-export/README.md)
- [Russian README](./docs/README.ru.md)
- [Monorepo README](../README.md)
