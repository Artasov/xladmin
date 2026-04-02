from __future__ import annotations

import json
import sys
from collections.abc import AsyncIterator
from pathlib import Path
from uuid import UUID

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from xladmin import AdminConfig, AdminHTTPConfig, FieldConfig, ModelConfig

from xladmin_import_export import ImportExportConfig, create_import_export_router


class Base(DeclarativeBase):
    pass


class WidgetORM(Base):
    __tablename__ = "widgets"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    name: Mapped[str]
    is_active: Mapped[bool] = mapped_column(default=True)


class LockedWidgetORM(Base):
    __tablename__ = "locked_widgets"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    name: Mapped[str]
    hidden_required: Mapped[str]


class PasswordWidgetORM(Base):
    __tablename__ = "password_widgets"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    username: Mapped[str]
    password: Mapped[str]


class DummyUser:
    is_staff = True


@pytest.fixture
async def app_bundle() -> AsyncIterator[tuple[FastAPI, async_sessionmaker[AsyncSession]]]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def get_session() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    async def get_current_user() -> DummyUser:
        return DummyUser()

    config = AdminConfig(models=(
        ModelConfig(
            model=WidgetORM,
            slug="widgets",
            title="Widgets",
            display_field="name",
            list_display=("id", "name", "code_label"),
            fields={
                "code_label": FieldConfig(
                    label="Code label",
                    read_only=True,
                    value_getter=lambda item: f"W-{item.name}",
                ),
            },
            import_export=ImportExportConfig(
                export_fields=("id", "name", "code_label"),
                import_fields=("id", "name", "is_active"),
            ),
        ),
        ModelConfig(
            model=LockedWidgetORM,
            slug="locked-widgets",
            title="Locked widgets",
            display_field="name",
            fields={
                "hidden_required": FieldConfig(
                    label="Hidden required",
                    hidden_in_form=True,
                ),
            },
            import_export=ImportExportConfig(
                export_fields=("id", "name"),
                import_fields=("id", "name"),
            ),
        ),
        ModelConfig(
            model=PasswordWidgetORM,
            slug="password-widgets",
            title="Password widgets",
            fields={
                "password": FieldConfig(
                    label="Password",
                    hidden_in_form=True,
                    hidden_in_detail=True,
                    hidden_in_list=True,
                    read_only=True,
                    input_kind="password",
                    value_setter=lambda item, value, payload, mode: setattr(item, "password", f"hashed:{value}"),
                ),
                "new_password": FieldConfig(
                    label="New password",
                    input_kind="password",
                    value_getter=lambda item: "",
                    value_setter=lambda item, value, payload, mode: setattr(item, "password", f"hashed:{value}"),
                ),
            },
            import_export=ImportExportConfig(),
        ),
    ))

    app = FastAPI()
    app.include_router(create_import_export_router(AdminHTTPConfig(
        registry=config,
        get_db_session_dependency=get_session,
        get_current_user_dependency=get_current_user,
        is_allowed=lambda user: bool(user.is_staff),
    )))

    yield app, session_factory

    await engine.dispose()


@pytest.fixture
async def client(app_bundle: tuple[FastAPI, async_sessionmaker[AsyncSession]]) -> AsyncIterator[AsyncClient]:
    app, _session_factory = app_bundle
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as http_client:
        yield http_client


async def test_meta_exposes_custom_export_field_and_uuid_conflict_mode(
    client: AsyncClient,
) -> None:
    response = await client.get("/xladmin/models/widgets/import-export/meta/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["pk_field"] == "id"
    assert payload["pk_type"] == "uuid"
    assert "auto_generate_pk" in payload["available_conflict_modes"]
    assert any(field["name"] == "code_label" for field in payload["export_fields"])
    assert any(field["name"] == "id" for field in payload["import_fields"])
    assert any(field["name"] == "name" for field in payload["import_fields"])
    assert any(field["name"] == "is_active" for field in payload["import_fields"])
    assert not any(field["name"] == "code_label" for field in payload["import_fields"])


async def test_export_json_includes_custom_list_field(
    client: AsyncClient,
    app_bundle: tuple[FastAPI, async_sessionmaker[AsyncSession]],
) -> None:
    _app, session_factory = app_bundle
    async with session_factory() as session:
        widget = WidgetORM(
            id=UUID("00000000-0000-0000-0000-000000000001"),
            name="Alpha",
            is_active=True,
        )
        session.add(widget)
        await session.commit()

    response = await client.post(
        "/xladmin/models/widgets/export/",
        json={
            "format": "json",
            "fields": ["id", "name", "code_label"],
            "ids": ["00000000-0000-0000-0000-000000000001"],
        },
    )

    assert response.status_code == 200
    assert response.headers["content-disposition"].endswith('.json"')
    payload = response.json()
    assert payload == [{
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "Alpha",
        "code_label": "W-Alpha",
    }]


async def test_import_commit_generates_uuid_for_new_rows(
    client: AsyncClient,
    app_bundle: tuple[FastAPI, async_sessionmaker[AsyncSession]],
) -> None:
    _app, session_factory = app_bundle
    file_bytes = json.dumps([{"name": "Imported", "is_active": True}]).encode("utf-8")
    files = {"file": ("widgets.json", file_bytes, "application/json")}
    data = {
        "format": "json",
        "fields": json.dumps(["name", "is_active"]),
        "conflict_mode": "auto_generate_pk",
    }

    validate_response = await client.post("/xladmin/models/widgets/import/validate/", files=files, data=data)
    assert validate_response.status_code == 200
    assert validate_response.json()["summary"]["create"] == 1

    commit_response = await client.post(
        "/xladmin/models/widgets/import/commit/",
        files={"file": ("widgets.json", file_bytes, "application/json")},
        data=data,
    )
    assert commit_response.status_code == 200
    assert commit_response.json() == {"created": 1, "updated": 0, "skipped": 0}

    async with session_factory() as session:
        rows = list((await session.execute(WidgetORM.__table__.select())).mappings())
        assert len(rows) == 1
        assert rows[0]["name"] == "Imported"
        assert isinstance(rows[0]["id"], UUID)


async def test_import_update_existing_creates_when_pk_is_missing(
    client: AsyncClient,
    app_bundle: tuple[FastAPI, async_sessionmaker[AsyncSession]],
) -> None:
    _app, session_factory = app_bundle
    file_bytes = json.dumps([{"name": "Imported without pk", "is_active": True}]).encode("utf-8")
    files = {"file": ("widgets.json", file_bytes, "application/json")}
    data = {
        "format": "json",
        "fields": json.dumps(["name", "is_active"]),
        "conflict_mode": "update_existing",
    }

    validate_response = await client.post("/xladmin/models/widgets/import/validate/", files=files, data=data)
    assert validate_response.status_code == 200
    assert validate_response.json()["summary"] == {
        "total_rows": 1,
        "create": 1,
        "update": 0,
        "skip": 0,
        "errors": 0,
    }

    commit_response = await client.post(
        "/xladmin/models/widgets/import/commit/",
        files={"file": ("widgets.json", file_bytes, "application/json")},
        data=data,
    )
    assert commit_response.status_code == 200
    assert commit_response.json() == {"created": 1, "updated": 0, "skipped": 0}

    async with session_factory() as session:
        rows = list((await session.execute(WidgetORM.__table__.select())).mappings())
        assert len(rows) == 1
        assert rows[0]["name"] == "Imported without pk"
        assert isinstance(rows[0]["id"], UUID)


async def test_import_skip_existing_creates_when_pk_is_missing(client: AsyncClient) -> None:
    file_bytes = json.dumps([{"name": "Skipped mode create"}]).encode("utf-8")
    files = {"file": ("widgets.json", file_bytes, "application/json")}
    data = {
        "format": "json",
        "fields": json.dumps(["name"]),
        "conflict_mode": "skip_existing",
    }

    response = await client.post("/xladmin/models/widgets/import/validate/", files=files, data=data)

    assert response.status_code == 200
    assert response.json()["summary"] == {
        "total_rows": 1,
        "create": 1,
        "update": 0,
        "skip": 0,
        "errors": 0,
    }


async def test_import_validate_reports_missing_required_create_fields(client: AsyncClient) -> None:
    file_bytes = json.dumps([{"is_active": True}]).encode("utf-8")
    files = {"file": ("widgets.json", file_bytes, "application/json")}
    data = {
        "format": "json",
        "fields": json.dumps(["is_active"]),
        "conflict_mode": "update_existing",
    }

    response = await client.post("/xladmin/models/widgets/import/validate/", files=files, data=data)

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] == {
        "total_rows": 1,
        "create": 0,
        "update": 0,
        "skip": 0,
        "errors": 1,
    }
    assert payload["errors"] == [{
        "row_number": 2,
        "field": None,
        "message": "Missing required fields for create: name.",
    }]


async def test_import_validate_reports_hidden_required_fields(client: AsyncClient) -> None:
    file_bytes = json.dumps([{"name": "Visible only"}]).encode("utf-8")
    files = {"file": ("locked-widgets.json", file_bytes, "application/json")}
    data = {
        "format": "json",
        "fields": json.dumps(["name"]),
        "conflict_mode": "update_existing",
    }

    response = await client.post("/xladmin/models/locked-widgets/import/validate/", files=files, data=data)

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["errors"] == 1
    assert payload["errors"] == [{
        "row_number": 2,
        "field": None,
        "message": "Missing required fields for create: hidden_required.",
    }]


async def test_default_import_fields_include_real_password_and_exclude_custom_setter_field(
    client: AsyncClient,
) -> None:
    response = await client.get("/xladmin/models/password-widgets/import-export/meta/")

    assert response.status_code == 200
    field_names = [field["name"] for field in response.json()["import_fields"]]
    assert "password" in field_names
    assert "new_password" not in field_names


async def test_import_uses_real_password_field_value_setter(
    client: AsyncClient,
    app_bundle: tuple[FastAPI, async_sessionmaker[AsyncSession]],
) -> None:
    _app, session_factory = app_bundle
    file_bytes = json.dumps([{"username": "alpha", "password": "secret"}]).encode("utf-8")
    files = {"file": ("password-widgets.json", file_bytes, "application/json")}
    data = {
        "format": "json",
        "fields": json.dumps(["username", "password"]),
        "conflict_mode": "auto_generate_pk",
    }

    response = await client.post("/xladmin/models/password-widgets/import/commit/", files=files, data=data)

    assert response.status_code == 200
    async with session_factory() as session:
        rows = list((await session.execute(PasswordWidgetORM.__table__.select())).mappings())
        assert rows[0]["password"] == "hashed:secret"
