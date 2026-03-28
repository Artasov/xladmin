# HOW TO USE

## 1. Что должен дать проект

`get_current_user_dependency`

- должен возвращать текущего пользователя
- объект может быть ORM, DTO или любым другим типом
- главное, чтобы `is_allowed(user)` мог прочитать нужные поля, обычно это `id` и `is_staff`

Минимальный контракт:

```python
class AdminActorDTO:
    id: int
    is_staff: bool
```

## 2. Быстрый старт

Обычно интеграция выглядит так:

- `src/modules/xladmin/setup.py` — собирает конфиг и router
- `src/modules/xladmin/routes.py` — экспортирует router
- `src/app/api.py` — подключает router в FastAPI

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

## 3. Минимальный ModelConfig

Для базового list / detail / edit достаточно:

```python
from xladmin import AdminConfig, ModelConfig

from src.modules.commerce.models import OrderORM


xladmin_config = AdminConfig(
    models=(
        ModelConfig(model=OrderORM),
    ),
)
```

Библиотека сама достроит:

- `slug`
- `title`
- базовые `search_fields`
- базовый `ordering`

## 4. Полный пример

```python
from sqlalchemy import or_

from xladmin import (
    AdminConfig,
    BulkActionConfig,
    FieldConfig,
    HttpConfig,
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

## 5. Что настраивается в AdminConfig

`models`

- список моделей, которые проект явно добавляет в админку

`models_blocks`

- кастомные блоки моделей для sidebar и overview

`locale`

- язык встроенных label и ошибок
- сейчас поддерживаются `ru` и `en`

## 6. Что настраивается в ModelConfig

`model`

- SQLAlchemy ORM модель

`slug`

- slug модели в URL
- опционально

`title`

- человекочитаемое название модели
- опционально

`description`

- описание модели для frontend

`page_size`

- количество объектов на страницу

`list_display`

- поля в списке объектов

`detail_fields`

- поля на detail-странице

`create_fields`

- поля, доступные при создании

`update_fields`

- поля, доступные при редактировании

`ordering`

- дефолтная сортировка

`search_fields`

- простые поисковые поля

`search_query_builder`

- кастомный builder для поиска

`fields`

- словарь переопределений `FieldConfig`

`bulk_actions`

- кастомные действия над несколькими объектами

`object_actions`

- кастомные действия над одним объектом

## 7. Что настраивается в FieldConfig

`label`

- label поля

`help_text`

- helper text под полем

`read_only`

- видно, но нельзя редактировать

`hidden_in_list`

- скрыто в списке

`hidden_in_detail`

- скрыто в detail

`hidden_in_form`

- скрыто в create/update форме

`input_kind`

- hint для frontend, например:
  - `password`
  - `date`
  - `datetime`
  - `relation`
  - `relation-multiple`

`ordering_field`

- реальное sortable-поле для виртуального поля

`width_px`

- ширина колонки списка в пикселях для frontend

`value_getter`

- кастомное значение поля

`value_parser`

- кастомный parser входящего значения

`value_setter`

- кастомный setter входящего значения

`relation_model`

- ORM связанной модели для выбора значений

`relation_label_field`

- поле, которое будет показано в relation choices

## 8.1. Кастомный query_for_list

Если проекту нужен более точный или более дешёвый query для списка, его можно переопределить прямо в `ModelConfig`.

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

Хук получает уже подготовленный `select(model)` и может:

- добавить `where`
- добавить свои `join`
- подменить сортировку
- вернуть полностью другой query

Синхронный и `async` варианты поддерживаются.

## 8. Что настраивается в ModelsBlock

`slug`

- уникальный id блока

`title`

- название блока

`description`

- описание блока

`models`

- tuple ORM-моделей из `AdminConfig.models`

`color`

- цвет блока для frontend

`collapsible`

- можно ли сворачивать блок

`default_expanded`

- состояние аккордеона по умолчанию

## 9. Встроенные endpoints

Библиотека сама поднимает:

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

## 10. Delete preview

Перед `delete` и `bulk delete` backend строит дерево связанных объектов.

Что учитывается:

- `delete` / `delete-orphan` cascade
- обязательные дочерние `one-to-many` связи с non-nullable foreign key
- несколько каскадных веток
- незарегистрированные связанные модели

Что не включается:

- relation, которые не должны удаляться вместе с root-объектом

Именно это дерево потом показывает frontend перед подтверждением удаления.

## 11. Совместимость

Короткие имена считаются основными:

- `FieldConfig`
- `BulkActionConfig`
- `ObjectActionConfig`
- `ModelsBlock`
- `HttpConfig`
- `create_router`

Старые alias тоже экспортируются:

- `AdminFieldConfig`
- `AdminBulkActionConfig`
- `AdminObjectActionConfig`
- `AdminModelsBlockConfig`
- `AdminHTTPConfig`
- `create_admin_router`
