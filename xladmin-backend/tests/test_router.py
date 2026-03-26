from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import date
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Date, ForeignKey, String, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.pool import StaticPool

from xladmin import (
    AdminBulkActionConfig,
    AdminFieldConfig,
    AdminHTTPConfig,
    AdminModelConfig,
    AdminObjectActionConfig,
    AdminRegistry,
    create_admin_router,
)


class Base(DeclarativeBase):
    pass


class DemoUserORM(Base):
    __tablename__ = "demo_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    joined_on: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(default=True)


class DemoRoleORM(Base):
    __tablename__ = "demo_roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)


class DemoAuditORM(Base):
    __tablename__ = "demo_audits"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    role_id: Mapped[int | None] = mapped_column(ForeignKey("demo_roles.id"), nullable=True)


async def _build_app() -> tuple[FastAPI, async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def get_session() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    def display_name(instance: DemoUserORM) -> str:
        return f"Пользователь {instance.id}: {instance.username}"

    def hash_password_setter(
            instance: DemoUserORM,
            value: str,
            payload: dict[str, object],
            mode: str,
    ) -> None:
        del payload, mode
        instance.password = f"hashed::{value}"

    def custom_user_search(query, q: str, session: AsyncSession):
        del session
        return query.where(DemoUserORM.username.ilike(f"{q}%"))

    def custom_role_search(query, q: str, session: AsyncSession):
        del session
        return query.where(DemoRoleORM.name.ilike(f"{q}%"))

    async def activate_users(
            session: AsyncSession,
            model_config: AdminModelConfig,
            items: list[DemoUserORM],
            payload: dict[str, Any],
            user: Any,
    ) -> dict[str, Any]:
        del session, model_config, payload, user
        for item in items:
            item.is_active = True
        return {"activated": len(items)}

    async def deactivate_user(
            session: AsyncSession,
            model_config: AdminModelConfig,
            item: DemoUserORM,
            payload: dict[str, Any],
            user: Any,
    ) -> dict[str, Any]:
        del session, model_config, payload, user
        item.is_active = False
        return {"deactivated": 1}

    registry = AdminRegistry(
        AdminModelConfig(
            model=DemoUserORM,
            slug="users",
            title="Пользователи",
            list_display=("id", "display_name", "joined_on", "is_active"),
            detail_fields=("id", "username", "joined_on", "is_active", "new_password"),
            create_fields=("username", "joined_on", "is_active", "new_password"),
            update_fields=("username", "joined_on", "is_active", "new_password"),
            search_query_builder=custom_user_search,
            page_size=120,
            ordering=("-id",),
            fields={
                "display_name": AdminFieldConfig(
                    label="Отображение",
                    read_only=True,
                    hidden_in_form=True,
                    ordering_field="username",
                    value_getter=display_name,
                ),
                "new_password": AdminFieldConfig(
                    label="Новый пароль",
                    input_kind="password",
                    value_getter=lambda instance: "",
                    value_setter=hash_password_setter,
                ),
            },
            bulk_actions=(
                AdminBulkActionConfig(
                    slug="activate",
                    label="Активировать",
                    handler=activate_users,
                ),
            ),
            object_actions=(
                AdminObjectActionConfig(
                    slug="deactivate",
                    label="Р”РµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ",
                    handler=deactivate_user,
                ),
            ),
        ),
        AdminModelConfig(
            model=DemoRoleORM,
            slug="roles",
            title="Роли",
            list_display=("id", "name"),
            search_query_builder=custom_role_search,
            ordering=("name",),
        ),
        AdminModelConfig(
            model=DemoAuditORM,
            slug="audits",
            title="Журнал",
            list_display=("id", "role_id"),
            fields={
                "role_id": AdminFieldConfig(
                    label="Роль",
                    relation_model=DemoRoleORM,
                    relation_label_field="name",
                ),
            },
        ),
    )

    app = FastAPI()
    app.include_router(
        create_admin_router(
            AdminHTTPConfig(
                registry=registry,
                get_db_session_dependency=get_session,
                get_current_user_dependency=lambda: SimpleNamespace(is_staff=True),
                is_allowed=lambda user: bool(user.is_staff),
            ),
        ),
    )

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    return app, session_factory


@pytest.mark.asyncio
async def test_router_supports_virtual_fields_and_custom_setter() -> None:
    app, session_factory = await _build_app()
    transport = ASGITransport(app=app)

    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            create_response = await client.post(
                "/xladmin/models/users/items/",
                json={
                    "username": "tester",
                    "joined_on": "2026-03-26",
                    "new_password": "secret",
                },
            )

            assert create_response.status_code == 201
            body = create_response.json()
            assert body["item"]["new_password"] == ""

    async with session_factory() as session:
        item = (await session.execute(select(DemoUserORM))).scalar_one()
        assert item.password == "hashed::secret"


@pytest.mark.asyncio
async def test_router_uses_list_display_and_custom_search() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add_all(
            [
                DemoUserORM(username="alpha", password="hashed::1"),
                DemoUserORM(username="beta", password="hashed::2"),
            ],
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/", params={"q": "al"})

            assert response.status_code == 200
            payload = response.json()
            assert payload["meta"]["list_fields"] == ["id", "display_name", "joined_on", "is_active"]
            assert payload["meta"]["page_size"] == 120
            assert payload["items"][0]["display_name"].endswith("alpha")
            assert payload["pagination"]["total"] == 1


@pytest.mark.asyncio
async def test_router_supports_bulk_actions() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add_all(
            [
                DemoUserORM(username="alpha", password="hashed::1", is_active=False),
                DemoUserORM(username="beta", password="hashed::2", is_active=False),
            ],
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/xladmin/models/users/bulk-actions/activate/",
                json={"ids": [1, 2]},
            )

            assert response.status_code == 200
            assert response.json()["processed"] == 2
            assert response.json()["activated"] == 2

    async with session_factory() as session:
        items = list((await session.execute(select(DemoUserORM).order_by(DemoUserORM.id))).scalars())
        assert [item.is_active for item in items] == [True, True]


@pytest.mark.asyncio
async def test_router_reuses_related_model_search_for_choices() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add_all(
            [
                DemoRoleORM(name="admin"),
                DemoRoleORM(name="moderator"),
                DemoRoleORM(name="user"),
            ],
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get(
                "/xladmin/models/audits/fields/role_id/choices/",
                params={"q": "ad"},
            )

            assert response.status_code == 200
            assert response.json()["items"] == [{"id": 1, "label": "admin"}]


@pytest.mark.asyncio
async def test_router_supports_sorting_by_multiple_fields() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add_all(
            [
                DemoUserORM(username="beta", password="hashed::1", joined_on=date(2026, 3, 27), is_active=False),
                DemoUserORM(username="alpha", password="hashed::2", joined_on=date(2026, 3, 25), is_active=True),
                DemoUserORM(username="gamma", password="hashed::3", joined_on=date(2026, 3, 26), is_active=False),
            ],
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            by_display_response = await client.get(
                "/xladmin/models/users/items/",
                params={"sort": "display_name"},
            )
            by_multiple_fields_response = await client.get(
                "/xladmin/models/users/items/",
                params={"sort": "is_active,-id"},
            )
            by_date_response = await client.get(
                "/xladmin/models/users/items/",
                params={"sort": "joined_on"},
            )

            assert by_display_response.status_code == 200
            assert [item["id"] for item in by_display_response.json()["items"]] == [2, 1, 3]

            assert by_multiple_fields_response.status_code == 200
            assert [item["id"] for item in by_multiple_fields_response.json()["items"]] == [3, 1, 2]

            assert by_date_response.status_code == 200
            assert [item["joined_on"] for item in by_date_response.json()["items"]] == [
                "2026-03-25",
                "2026-03-26",
                "2026-03-27",
            ]


@pytest.mark.asyncio
async def test_router_supports_object_actions() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add(DemoUserORM(username="alpha", password="hashed::1", is_active=True))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            meta_response = await client.get("/xladmin/models/users/")
            action_response = await client.post("/xladmin/models/users/items/1/actions/deactivate/", json={})

            assert meta_response.status_code == 200
            assert meta_response.json()["object_actions"] == [
                {"slug": "deactivate", "label": "Р”РµР°РєС‚РёРІРёСЂРѕРІР°С‚СЊ"},
            ]

            assert action_response.status_code == 200
            assert action_response.json()["result"]["deactivated"] == 1
            assert action_response.json()["item"]["is_active"] is False
