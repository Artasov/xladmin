# HOW TO USE

## 1. Что библиотека ожидает от проекта

`get_current_user_dependency`

- должен возвращать объект текущего пользователя
- у этого объекта должно быть как минимум поле `id`
- и должны быть поля, которые использует ваше правило доступа в `is_allowed(...)`
- обычно это `is_staff`

Минимально нормальный контракт такой:

```python
class AdminActorDTO:
    id: int
    is_staff: bool
```

Важно:

- библиотека не требует конкретную ORM-модель пользователя
- можно вернуть ORM, DTO или любой другой объект
- главное, чтобы `is_allowed(user)` мог прочитать нужные поля

## 2. Быстрое подключение

Обычно проект делает так:

- `src/modules/xladmin/setup.py` — собирает registry и router
- `src/modules/xladmin/routes.py` — экспортирует router
- `src/app/api.py` или другой агрегатор роутов — подключает router в FastAPI

Минимальный пример сразу с wiring:

```python
# src/modules/xladmin/setup.py
from xladmin import (
    AdminHTTPConfig,
    AdminModelConfig,
    AdminRegistry,
    create_admin_router,
)

from src.core.auth.dependencies import get_current_user
from src.core.db.session import get_db_session
from src.modules.identity.models import UserORM


xladmin_registry = AdminRegistry(
    AdminModelConfig(
        model=UserORM,
        slug="users",
        title="Пользователи",
        ordering=("-id",),
    ),
)

xladmin_router = create_admin_router(
    AdminHTTPConfig(
        registry=xladmin_registry,
        get_db_session_dependency=get_db_session,
        get_current_user_dependency=get_current_user,
        is_allowed=lambda user: bool(user.is_staff),
    ),
)
```

```python
# src/modules/xladmin/routes.py
from src.modules.xladmin.setup import xladmin_router

router = xladmin_router
```

```python
# src/app/api.py
from fastapi import APIRouter

from src.modules.xladmin.routes import router as xladmin_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(xladmin_router)
```

## 3. Расширенный пример

Ниже уже нормальный конфиг, где есть:

- свой `list_display`
- своя деталка
- свой поиск
- relation field
- виртуальное поле для пароля
- размер страницы списка

```python
from sqlalchemy import or_

from xladmin import (
    AdminBulkActionConfig,
    AdminFieldConfig,
    AdminHTTPConfig,
    AdminModelConfig,
    AdminRegistry,
    create_admin_router,
)

from src.core.auth.dependencies import get_current_user
from src.core.auth.passwords import hash_password
from src.core.db.session import get_db_session
from src.modules.commercexl.models import OrderORM, PaymentORM
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
            UserORM.middle_name.ilike(like_value),
        ),
    )


async def activate_users(session, model_config, items, payload, user):
    del session, model_config, payload, user
    for item in items:
        item.is_active = True
    return {"activated": len(items)}


registry = AdminRegistry(
    AdminModelConfig(
        model=UserORM,
        slug="users",
        title="Пользователи",
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
            "id": AdminFieldConfig(
                label="ID",
                read_only=True,
            ),
            "display_name": AdminFieldConfig(
                label="Пользователь",
                read_only=True,
                hidden_in_form=True,
                ordering_field="username",
                value_getter=get_user_display_name,
            ),
            "roles": AdminFieldConfig(
                label="Роли",
                relation_model=RoleORM,
                relation_label_field="name",
                input_kind="relation-multiple",
            ),
            "date_joined": AdminFieldConfig(
                label="Дата регистрации",
                input_kind="datetime",
            ),
            "new_password": AdminFieldConfig(
                label="Новый пароль",
                help_text="Если поле пустое, пароль не изменится.",
                input_kind="password",
                value_getter=lambda user: "",
                value_setter=set_user_password,
            ),
        },
        bulk_actions=(
            AdminBulkActionConfig(
                slug="activate",
                label="Активировать",
                handler=activate_users,
            ),
        ),
    ),
    AdminModelConfig(
        model=OrderORM,
        slug="orders",
        title="Заказы",
        page_size=200,
        ordering=("-created_at",),
        fields={
            "user_id": AdminFieldConfig(
                label="Пользователь",
                relation_model=UserORM,
                relation_label_field="email",
            ),
            "payment_id": AdminFieldConfig(
                label="Оплата",
                relation_model=PaymentORM,
            ),
        },
    ),
)

router = create_admin_router(
    AdminHTTPConfig(
        registry=registry,
        get_db_session_dependency=get_db_session,
        get_current_user_dependency=get_current_user,
        is_allowed=lambda user: bool(user.is_staff),
    ),
)
```

## 4. Что можно настраивать в `AdminModelConfig`

`model`
- SQLAlchemy ORM-модель.

`slug`
- имя модели в URL и во frontend routing.

`title`
- человекочитаемое имя модели.

`page_size`
- сколько объектов библиотека запрашивает одной страницей.
- это значение уходит и во frontend-мету.

`list_display`
- какие поля показывать в списке объектов.

`detail_fields`
- какие поля показывать в детальном просмотре объекта.

`create_fields`
- какие поля разрешены при создании.

`update_fields`
- какие поля разрешены при редактировании.

`ordering`
- дефолтная сортировка, если frontend не передал `sort`.

`search_fields`
- простой встроенный поиск по строковым полям.

`search_query_builder`
- свой поиск, если простой встроенный поиск недостаточен.

`fields`
- точечная настройка отдельных полей через `AdminFieldConfig`.

`bulk_actions`
- свои массовые действия над выбранными объектами.

## 5. Что можно настраивать в `AdminFieldConfig`

`label`
- человекочитаемое имя поля.

`help_text`
- подсказка под полем.

`read_only`
- поле видно, но редактировать его нельзя.

`hidden_in_list`
- скрыть поле из списка объектов.

`hidden_in_detail`
- скрыть поле из детального просмотра.

`hidden_in_form`
- скрыть поле из формы создания/редактирования.

`input_kind`
- подсказать frontend, какой редактор использовать.
- например: `password`, `date`, `datetime`, `relation-multiple`

`ordering_field`
- если поле виртуальное, можно сказать, по какой настоящей колонке его сортировать.

`value_getter`
- как получить значение виртуального поля.

`value_setter`
- как применить значение обратно в ORM-объект.
- это удобно для хеширования пароля, преобразования DTO и другого прикладного поведения.

`relation_model`
- какую ORM-модель использовать для relation choices.

`relation_label_field`
- какое поле связанной модели показывать в списке выбора.

## 6. Как работает сортировка и поиск

- frontend передаёт `sort=id,-is_active,username`
- backend применяет эти поля в указанном порядке
- если поле виртуальное, библиотека возьмёт `ordering_field`
- relation `many` по умолчанию не сортируются

Поиск:

- если задан `search_query_builder`, используется он
- если нет, библиотека ищет по `search_fields`
- если нет и `search_fields`, библиотека берёт строковые колонки модели
