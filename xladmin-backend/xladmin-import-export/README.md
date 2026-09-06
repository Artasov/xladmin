<div align="center">
  <a href="./README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./docs/README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin-import-export backend

Optional backend extension for `xladmin` that adds import/export endpoints.

## Features

- export `json`, `csv`, `xlsx`
- import `json`, `csv`, `xlsx`
- export custom readable fields, including custom `list_display` fields
- import validation before commit
- PK conflict modes: `auto_generate_pk`, `update_existing`, `skip_existing`
- UUID primary key auto-generation on import

## Install

Import validation and commit use the current user's model scope for existing targets and assigned foreign keys. Hidden targets cannot be updated or treated as an existing row to skip; any invalid row makes commit roll back the batch. `auto_generate_pk` ignores the input primary key and does not resolve it as an existing target, but still validates assigned relations. Internal service calls require keyword `registry` and `user`; update the core and extension together.

```bash
pip install xladmin xladmin-import-export
```

## Minimal Example

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

# OR

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

## Development

```bash
cd xladmin-backend/xladmin-import-export
uv sync --extra dev
uv run pytest -q
uv run ruff check .
uv run mypy
uv run python -m build
```

## Docs

- [PyPI package](https://pypi.org/project/xladmin-import-export/)
- [Monorepo README](../../README.md)
