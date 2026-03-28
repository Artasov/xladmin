# xladmin

`xladmin` это backend-пакет админки для `FastAPI + SQLAlchemy`.

Важно:

- имя пакета в PyPI: `xladmin`
- импорт в Python: `from xladmin import ...`
- исходники монорепы: [Artasov/xladmin](https://github.com/Artasov/xladmin)

## Основной API

- `AdminConfig` — корневой декларативный конфиг
- `ModelConfig` — конфиг одной ORM-модели
- `FieldConfig` — переопределение поведения конкретного поля
- `BulkActionConfig` — кастомное действие над несколькими объектами
- `ObjectActionConfig` — кастомное действие над одним объектом
- `ModelsBlock` — блок моделей для sidebar и overview
- `HttpConfig` — контракт интеграции с проектом
- `create_router(...)` — фабрика FastAPI-router

Короткие имена считаются основными. Старые `Admin*` имена и `create_admin_router(...)` оставлены как alias для совместимости.

## Минимальный пример

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

router = create_router(
    HttpConfig(
        registry=xladmin_config,
        get_db_session_dependency=get_db_session,
        get_current_user_dependency=get_current_user,
        is_allowed=lambda user: bool(user.is_staff),
    ),
)
```

`ModelConfig(model=UserORM)` уже достаточно для базовой админки. Библиотека сама достроит:

- `slug`
- `title`
- базовые `search_fields`
- базовый `ordering`

## Что есть в библиотеке

- list / detail / create / patch / delete
- bulk actions и object actions
- relation choices
- model descriptions
- model blocks
- `query_for_list` для кастомизации list-query
- `width_px` у `FieldConfig` для ширины колонок списка
- авто-детект `JSON` полей
- RU / EN locale
- delete preview для single delete и bulk delete
- удаление обязательных дочерних `one-to-many` связей даже без явного ORM cascade

## Совместимость

- `FastAPI >=0.115,<1.0`
- `Pydantic >=2.9,<3.0`
- `SQLAlchemy >=2.0,<3.0`

## Документация

- подробная инструкция: [docs/HOW_TO_USE.md](docs/HOW_TO_USE.md)
- фронтенд-пакет: [../xladmin-frontend/README.md](../xladmin-frontend/README.md)
