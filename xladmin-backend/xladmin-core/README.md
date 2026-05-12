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
- current-user endpoint for frontend sidebar identity: `GET /xladmin/me/`
- logout endpoint for frontend logout buttons: `POST /xladmin/logout/`
- bulk actions and object actions
- relation choices and relation filters
- single and multi-select relation filters via `ListFilterConfig(..., multiple=True, input_kind="relation-multiple")`
- overview metadata and model blocks
- `query_for_list` and custom `search_query_builder`
- mode-specific form fields with `hidden_in_create` / `hidden_in_update`
- custom create defaults with `create_item_factory`
- delete preview for single and bulk delete
- RU / EN locale metadata for the frontend

## Current User And Logout

The frontend `Shell` can show the current user in the sidebar and call logout from the sidebar action.
The backend router exposes two endpoints for this:

- `GET /xladmin/me/`
- `POST /xladmin/logout/`

`/xladmin/me/` uses `get_current_user_dependency` and returns a small payload:

```json
{
  "id": 1,
  "login": "admin@example.com",
  "email": "admin@example.com",
  "name": "Admin"
}
```

The `login` value is resolved from the first available user attribute in this order:
`username`, `email`, `login`, `name`, then `id`.

By default `/xladmin/logout/` only checks that the user can access admin and returns `204`.
Real applications should pass `logout_dependency` to `HttpConfig` to clear cookies, sessions, tokens, or any other auth state.

```python
from fastapi import Response
from xladmin import HttpConfig, create_router


async def logout_admin_user(response: Response) -> None:
    response.delete_cookie("session")


router = create_router(
    HttpConfig(
        registry=admin_config,
        get_db_session_dependency=get_db_session,
        get_current_user_dependency=get_current_user,
        is_allowed=lambda user: bool(user.is_staff),
        logout_dependency=logout_admin_user,
    ),
)
```

If your auth system needs the current user in the logout handler, add it as a regular FastAPI dependency inside your function.

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

If create needs a fully custom form and payload handler, use `create_form` + `create_handler`.

The same `FormFieldConfig` mechanism is also available for `object_actions` and `bulk_actions` via `form=...`.
If an action has no form, the frontend runs it immediately as before.

For `datetime` inputs the built-in dialog uses the MUI action bar with a localized `Today` / `Сегодня` button, which inserts the current date and time.

```python
from xladmin import FormFieldConfig, FormFieldOptionConfig, ModelConfig


async def create_proxy(session, model_config, payload, user):
    del session, model_config, user
    parsed = ProxyBase.parse_raw(f"{payload['scheme']}://{payload['proxy']}")
    return ProxyORM(
        name=parsed.name,
        scheme=parsed.scheme,
        host=parsed.host,
        port=parsed.port,
        username=parsed.username,
        password=parsed.password,
        created_at=ProxyBase.now(),
        updated_at=ProxyBase.now(),
    )


ModelConfig(
    model=ProxyORM,
    create_form=(
        FormFieldConfig(
            name="scheme",
            label="Scheme",
            input_kind="select",
            required=True,
            options=(
                FormFieldOptionConfig(value="http", label="HTTP"),
                FormFieldOptionConfig(value="socks5h", label="SOCKS5H"),
            ),
        ),
        FormFieldConfig(
            name="proxy",
            label="Proxy",
            placeholder="login:password@ip:port",
            required=True,
        ),
    ),
    create_handler=create_proxy,
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

- [How to use](./docs/HOW_TO_USE.en.md)
- [PyPI package](https://pypi.org/project/xladmin/)
- [xladmin-import-export backend](../xladmin-import-export/README.md)
- [Russian README](./docs/README.ru.md)
- [Monorepo README](../README.md)
