<div align="center">
  <a href="./HOW_TO_USE.en.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./HOW_TO_USE.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# HOW TO USE

## 1. What the project must provide

`get_current_user_dependency`

- must return the current user
- the object can be an ORM model, DTO, or any other type
- the important part is that `is_allowed(user)` can read the required fields, usually `id` and `is_staff`

Minimal contract:

```python
class AdminActorDTO:
    id: int
    is_staff: bool
```

## 2. Quick start

Integration usually looks like this:

- `src/modules/xladmin/setup.py` assembles config and router
- `src/modules/xladmin/routes.py` exports the router
- `src/app/api.py` mounts the router into FastAPI

```python
from xladmin import AdminConfig, HttpConfig, ModelConfig, create_router

from src.core.auth.dependencies import get_current_user
from src.core.db.session import get_db_session
from src.modules.identity.models import UserORM


xladmin_config = AdminConfig(
    models=(
        ModelConfig(model=UserORM),
    ),
)

xladmin_router = create_router(
    HttpConfig(
        registry=xladmin_config,
        get_db_session_dependency=get_db_session,
        get_current_user_dependency=get_current_user,
        is_allowed=lambda user: bool(user.is_staff),
    ),
)
```

```python
from src.modules.xladmin.setup import xladmin_router

router = xladmin_router
```

```python
from fastapi import APIRouter

from src.modules.xladmin.routes import router as xladmin_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(xladmin_router)
```

## 3. Minimal ModelConfig

For basic list / detail / edit flows, this is enough:

```python
from xladmin import AdminConfig, ModelConfig

from src.modules.commerce.models import OrderORM


xladmin_config = AdminConfig(
    models=(
        ModelConfig(model=OrderORM),
    ),
)
```

The library fills in the rest automatically:

- `slug`
- `title`
- default `search_fields`
- default `ordering`
- `list/detail/create/update` field order based on the ORM model declaration order

## 4. Full example

```python
from sqlalchemy import or_

from xladmin import (
    AdminConfig,
    BulkActionConfig,
    FieldConfig,
    HttpConfig,
    ListFilterConfig,
    ModelConfig,
    ModelsBlock,
    ObjectActionConfig,
    create_router,
)

from src.core.auth.dependencies import get_current_user
from src.core.auth.passwords import hash_password
from src.core.db.session import get_db_session
from src.modules.commerce.models import OrderORM, PaymentORM
from src.modules.identity.models import RoleORM, UserORM


def get_user_display_name(user: UserORM) -> str:
    if user.email:
        return f"{user.username} ({user.email})"
    return user.username


def set_user_password(
    user: UserORM,
    value: str,
    payload: dict[str, object],
    mode: str,
) -> None:
    del payload, mode
    if not value:
        return
    user.password = hash_password(value)


def search_users(query, search_value: str, session):
    del session
    normalized_value = search_value.strip()
    if not normalized_value:
        return query
    if normalized_value.isdigit():
        return query.where(UserORM.id == int(normalized_value))

    like_value = f"%{normalized_value}%"
    return query.where(
        or_(
            UserORM.username.ilike(like_value),
            UserORM.email.ilike(like_value),
            UserORM.first_name.ilike(like_value),
            UserORM.last_name.ilike(like_value),
        ),
    )


async def activate_users(session, model_config, items, payload, user):
    del session, model_config, payload, user
    for item in items:
        item.is_active = True
    return {"activated": len(items)}


async def resend_invite(session, model_config, item, payload, user):
    del session, model_config, payload, user
    item.invites_sent = (item.invites_sent or 0) + 1
    return {"status": "ok"}


xladmin_config = AdminConfig(
    locale="en",
    models=(
        ModelConfig(
            model=UserORM,
            slug="users",
            title="Users",
            description="Project users and access flags.",
            display_field="username",
            page_size=100,
            list_display=("id", "display_name", "is_staff", "is_active", "date_joined"),
            detail_fields=(
                "id",
                "display_name",
                "username",
                "email",
                "roles",
                "is_staff",
                "is_active",
                "date_joined",
                "new_password",
            ),
            update_fields=(
                "username",
                "email",
                "roles",
                "is_staff",
                "is_active",
                "date_joined",
                "new_password",
            ),
            search_query_builder=search_users,
            list_filters=(
                ListFilterConfig(
                    slug="status",
                    label="Status",
                    field_name="is_active",
                    input_kind="boolean",
                ),
            ),
            ordering=("-id",),
            fields={
                "id": FieldConfig(label="ID", read_only=True),
                "display_name": FieldConfig(
                    label="User",
                    read_only=True,
                    hidden_in_form=True,
                    ordering_field="username",
                    value_getter=get_user_display_name,
                ),
                "roles": FieldConfig(
                    label="Roles",
                    relation_model=RoleORM,
                    relation_label_field="name",
                    input_kind="relation-multiple",
                ),
                "date_joined": FieldConfig(
                    label="Joined at",
                    input_kind="datetime",
                ),
                "new_password": FieldConfig(
                    label="New password",
                    help_text="If empty, password stays unchanged.",
                    input_kind="password",
                    value_getter=lambda user: "",
                    value_setter=set_user_password,
                ),
            },
            bulk_actions=(
                BulkActionConfig(
                    slug="activate",
                    label="Activate",
                    handler=activate_users,
                ),
            ),
            object_actions=(
                ObjectActionConfig(
                    slug="resend-invite",
                    label="Resend invite",
                    handler=resend_invite,
                ),
            ),
        ),
        ModelConfig(
            model=OrderORM,
            title="Orders",
            ordering=("-created_at",),
            fields={
                "user_id": FieldConfig(
                    label="User",
                    relation_model=UserORM,
                    relation_label_field="email",
                ),
                "payment_id": FieldConfig(
                    label="Payment",
                    relation_model=PaymentORM,
                ),
            },
        ),
    ),
    models_blocks=(
        ModelsBlock(
            slug="identity-block",
            title="Identity",
            description="Users and access models.",
            models=(UserORM,),
            collapsible=True,
            default_expanded=True,
            color="#1f3b7a",
        ),
        ModelsBlock(
            slug="commerce-block",
            title="Commerce",
            description="Orders and payments.",
            models=(OrderORM,),
            collapsible=True,
            default_expanded=False,
            color="#7a5b1f",
        ),
    ),
)

router = create_router(
    HttpConfig(
        registry=xladmin_config,
        get_db_session_dependency=get_db_session,
        get_current_user_dependency=get_current_user,
        is_allowed=lambda user: bool(user.is_staff),
    ),
)
```

## 5. What can be configured in AdminConfig

`models`

- the list of models that the project explicitly adds to the admin

`models_blocks`

- custom model blocks for the sidebar and overview

`locale`

- language for built-in labels and errors
- currently supported: `ru` and `en`

## 6. What can be configured in ModelConfig

`model`

- SQLAlchemy ORM model

`slug`

- model slug in the URL
- optional

`title`

- human-readable model name
- optional

`description`

- model description for the frontend

`page_size`

- number of objects per page

`list_display`

- fields shown in the object list

`detail_fields`

- fields shown on the detail page

`create_fields`

- fields available on create

`update_fields`

- fields available on update

`ordering`

- default sorting

`search_fields`

- simple search fields

`search_query_builder`

- custom search builder

`fields`

- a dictionary of `FieldConfig` overrides

`list_filters`

- list filters in the right sidebar of the model page
- each filter gets its own query param based on `slug`
- you can define either a simple field via `field_name` or a fully custom `filter_handler`

`bulk_actions`

- custom actions for multiple objects

`object_actions`

- custom actions for a single object

## 7. What can be configured in FieldConfig

`label`

- field label

`help_text`

- helper text below the field

`read_only`

- visible but not editable

`hidden_in_list`

- hidden in the list

`hidden_in_detail`

- hidden on the detail page

`hidden_in_form`

- hidden in create/update forms

`input_kind`

- frontend hint, for example:
  - `password`
  - `date`
  - `datetime`
  - `relation`
  - `relation-multiple`

`ordering_field`

- actual sortable field for a virtual field

`width_px`

- list column width in pixels for the frontend

`display_kind`

- how the field is rendered in the admin UI
- currently supported:
  - `text`
  - `image`

`image_url_prefix`

- prefix for relative paths in image fields
- needed when the DB stores a path like `user/images/avatar.png`, but the frontend should open `/media/user/images/avatar.png`

Example:

```python
FieldConfig(
    label="Avatar",
    width_px=92,
    display_kind="image",
    image_url_prefix="/media",
    hidden_in_form=True,
)
```

`value_getter`

- custom field value

`value_parser`

- custom parser for incoming values

`value_setter`

- custom setter for incoming values

`relation_model`

- related ORM model used to select values

`relation_label_field`

- field shown as the label in relation choices

## 8.1. Custom query_for_list

If the project needs a more precise or cheaper list query, you can override it directly in `ModelConfig`.

```python
from sqlalchemy import select

from xladmin import ModelConfig


def query_roles_for_list(query, session, user):
    del session, user
    return query.where(RoleORM.is_archived.is_(False))


ModelConfig(
    model=RoleORM,
    query_for_list=query_roles_for_list,
)
```

The hook receives an already prepared `select(model)` and can:

- add `where`
- add custom `join`s
- replace sorting
- return a completely different query

Both sync and `async` variants are supported.

## 8.2. ListFilterConfig

If the project needs filters on the model list page, define them directly in `ModelConfig`.

```python
from xladmin import ListFilterConfig, ModelConfig


def filter_users_by_prefix(query, value, session, user):
    del session, user
    return query.where(UserORM.username.ilike(f"{value}%"))


ModelConfig(
    model=UserORM,
    list_filters=(
        ListFilterConfig(
            slug="status",
            label="Status",
            field_name="is_active",
            input_kind="boolean",
        ),
        ListFilterConfig(
            slug="username_prefix",
            label="Username prefix",
            filter_handler=filter_users_by_prefix,
        ),
    ),
)
```

What `ListFilterConfig` supports:

- `slug` is the query param name
- `label` is the filter label
- `group` is the filter section in the right sidebar
- `field_name` is the ORM field for a simple filter
- `input_kind` is `text`, `select`, or `boolean`
- `options` are the select options
- `ListFilterOptionConfig.filter_handler` is a dedicated handler for a specific select option
- `placeholder` is the placeholder for a text filter
- `value_parser` is a custom parser for the incoming value
- `filter_handler` gives full control over the SQL query
- `relation_model` is the ORM model for dynamic select options
- `relation_label_field` is the label field for relation options

If `filter_handler` is not set:

- `boolean` filters use `IS true/false`
- `text` filters use `ILIKE %value%`
- other filters use exact field comparison
- for `many-to-many` relations, the library automatically uses `relationship.any(...)`

Example of a relation filter:

```python
ListFilterConfig(
    slug="role_id",
    label="Role",
    group="Access",
    field_name="roles",
    relation_model=RoleORM,
    relation_label_field="name",
)
```

Example of a canned select filter with custom SQL logic per option:

```python
from decimal import Decimal

from sqlalchemy import select
from xladmin import ListFilterConfig, ListFilterOptionConfig


def filter_users_with_winky_balance_over_100(query, _value, _session, _user):
    balance_exists = (
        select(UserTokenBalanceORM.id)
        .join(TokenORM, TokenORM.id == UserTokenBalanceORM.token_id)
        .where(
            UserTokenBalanceORM.user_id == UserORM.id,
            TokenORM.ticker == "WINKY",
            UserTokenBalanceORM.amount > Decimal("100"),
        )
        .exists()
    )
    return query.where(balance_exists)


ListFilterConfig(
    slug="token_balance_scope",
    label="By tokens",
    options=(
        ListFilterOptionConfig(
            value="winky-over-100",
            label="WINKY > 100",
            filter_handler=filter_users_with_winky_balance_over_100,
        ),
    ),
)
```

## 9. What can be configured in ModelsBlock

`slug`

- unique block id

`title`

- block title

`description`

- block description

`models`

- tuple of ORM models from `AdminConfig.models`

`color`

- block color for the frontend

`collapsible`

- whether the block can be collapsed

`default_expanded`

- default accordion state
- afterwards the frontend stores the last block state in `localStorage`

## 10. Built-in endpoints

The library automatically exposes:

- `/xladmin/models/`
- `/xladmin/models/{slug}/`
- `/xladmin/models/{slug}/items/`
- `/xladmin/models/{slug}/items/{id}/`
- `/xladmin/models/{slug}/items/{id}/delete-preview/`
- `/xladmin/models/{slug}/bulk-delete-preview/`
- `/xladmin/models/{slug}/bulk-delete/`
- `/xladmin/models/{slug}/bulk-actions/{action_slug}/`
- `/xladmin/models/{slug}/items/{id}/actions/{action_slug}/`
- `/xladmin/models/{slug}/fields/{field_name}/choices/`
- `/xladmin/models/{slug}/filters/{filter_slug}/choices/`

## 11. Delete preview

Before `delete` and `bulk delete`, the backend builds a tree of related objects.

What is included:

- `delete` / `delete-orphan` cascade
- required child `one-to-many` relations with a non-nullable foreign key
- multiple cascade branches
- unregistered related models

What is excluded:

- relations that should not be deleted together with the root object

This is exactly the tree that the frontend shows before deletion is confirmed.

## 12. Compatibility

Short names are the primary API:

- `FieldConfig`
- `BulkActionConfig`
- `ObjectActionConfig`
- `ModelsBlock`
- `HttpConfig`
- `create_router`

Legacy aliases are still exported:

- `AdminFieldConfig`
- `AdminBulkActionConfig`
- `AdminObjectActionConfig`
- `AdminModelsBlockConfig`
- `AdminHTTPConfig`
- `create_admin_router`
