<div align="center">
  <a href="../README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin-import-export backend

Опциональное backend-расширение для `xladmin`, которое добавляет import/export endpoints.

## Что умеет

- экспорт в `json`, `csv`, `xlsx`
- импорт из `json`, `csv`, `xlsx`
- экспорт кастомных readable-полей, включая кастомные поля из `list_display`
- двухшаговый import: проверка и подтверждение
- режимы конфликта PK: `auto_generate_pk`, `update_existing`, `skip_existing`
- автогенерация UUID primary key при импорте

## Установка

```bash
pip install xladmin xladmin-import-export
```

## Базовое подключение

```python
from fastapi import APIRouter
from xladmin import HttpConfig, create_router
from xladmin_import_export import ImportExportConfig, create_import_export_router

router = APIRouter()
router.include_router(create_router(http_config))
router.include_router(create_import_export_router(http_config))

user_model = ModelConfig(
    model=UserORM,
    slug="users",
    import_export=ImportExportConfig(),
)

# ИЛИ

user_model = ModelConfig(
    model=UserORM,
    slug="users",
    import_export=ImportExportConfig(
        export_fields=("id", "email", "roles"),
        import_fields=("id", "email", "roles"),
    ),
)
```

## Endpoints

- `GET /xladmin/models/{slug}/import-export/meta/`
- `POST /xladmin/models/{slug}/export/`
- `POST /xladmin/models/{slug}/import/validate/`
- `POST /xladmin/models/{slug}/import/commit/`

## Разработка

```bash
cd xladmin-backend/xladmin-import-export
uv sync --extra dev
uv run pytest -q
uv run ruff check .
uv run mypy
uv run python -m build
```

## Документация

- [PyPI package](https://pypi.org/project/xladmin-import-export/)
- [README монорепы](../../../README.md)
