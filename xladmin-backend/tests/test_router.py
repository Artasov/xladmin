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
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.pool import StaticPool

from xladmin import (
    AdminBulkActionConfig,
    AdminConfig,
    AdminFieldConfig,
    AdminHTTPConfig,
    AdminListFilterConfig,
    AdminListFilterOptionConfig,
    AdminModelConfig,
    AdminObjectActionConfig,
    ModelConfig,
    create_admin_router,
)


# TODO: разбить огромный файл на мелкие
class Base(DeclarativeBase):
    pass


class DemoUserORM(Base):
    __tablename__ = "demo_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    joined_on: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(default=True)
    posts: Mapped[list[DemoPostORM]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    badges: Mapped[list[DemoBadgeORM]] = relationship(back_populates="user")
    secrets: Mapped[list[DemoSecretORM]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    tasks: Mapped[list[DemoTaskORM]] = relationship(back_populates="user")
    roles: Mapped[list[DemoRoleORM]] = relationship(
        secondary="demo_user_roles",
        back_populates="users",
    )


class DemoRoleORM(Base):
    __tablename__ = "demo_roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    users: Mapped[list[DemoUserORM]] = relationship(
        secondary="demo_user_roles",
        back_populates="roles",
    )


class DemoUserRoleORM(Base):
    __tablename__ = "demo_user_roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("demo_users.id"), nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("demo_roles.id"), nullable=False)


class DemoAuditORM(Base):
    __tablename__ = "demo_audits"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    role_id: Mapped[int | None] = mapped_column(ForeignKey("demo_roles.id"), nullable=True)


class DemoPostORM(Base):
    __tablename__ = "demo_posts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("demo_users.id"), nullable=False)
    user: Mapped[DemoUserORM] = relationship(back_populates="posts")
    comments: Mapped[list[DemoCommentORM]] = relationship(
        back_populates="post",
        cascade="all, delete-orphan",
    )


class DemoCommentORM(Base):
    __tablename__ = "demo_comments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    body: Mapped[str] = mapped_column(String(255), nullable=False)
    post_id: Mapped[int] = mapped_column(ForeignKey("demo_posts.id"), nullable=False)
    post: Mapped[DemoPostORM] = relationship(back_populates="comments")


class DemoBadgeORM(Base):
    __tablename__ = "demo_badges"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("demo_users.id"), nullable=True)
    user: Mapped[DemoUserORM | None] = relationship(back_populates="badges")


class DemoSecretORM(Base):
    __tablename__ = "demo_secrets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code_name: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("demo_users.id"), nullable=False)
    user: Mapped[DemoUserORM] = relationship(back_populates="secrets")


class DemoTaskORM(Base):
    __tablename__ = "demo_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("demo_users.id"), nullable=False)
    user: Mapped[DemoUserORM] = relationship(back_populates="tasks")


class DemoOwnedProjectORM(Base):
    __tablename__ = "demo_owned_projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(64), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("demo_users.id"), nullable=False)


class DemoOwnedBoardORM(Base):
    __tablename__ = "demo_owned_boards"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(64), nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("demo_owned_projects.id"), nullable=False)


class DemoTokenProfileORM(Base):
    __tablename__ = "demo_token_profiles"

    tokenprofile_ptr_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("demo_users.id"), nullable=False)


class DemoAliasedMessageORM(Base):
    __tablename__ = "demo_aliased_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)


class DemoAliasedChatORM(Base):
    __tablename__ = "demo_aliased_chats"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    last_branch_message_id: Mapped[str | None] = mapped_column(
        "last_leaf_message_id",
        String(36),
        ForeignKey("demo_aliased_messages.id"),
    )


class DemoSoftUserORM(Base):
    __tablename__ = "demo_soft_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False)


class DemoSoftNoteORM(Base):
    __tablename__ = "demo_soft_notes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    body: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("demo_soft_users.id", ondelete="SET NULL"), nullable=True)


class DemoHardParentORM(Base):
    __tablename__ = "demo_hard_parents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(64), nullable=False)


class DemoHardChildORM(Base):
    __tablename__ = "demo_hard_children"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(64), nullable=False)
    parent_id: Mapped[int] = mapped_column(ForeignKey("demo_hard_parents.id", ondelete="CASCADE"), nullable=False)


async def _build_app(locale: str = "ru", *, is_staff: bool = True) -> tuple[FastAPI, async_sessionmaker[AsyncSession]]:
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
            _payload: dict[str, object],
            _mode: str,
    ) -> None:
        instance.password = f"hashed::{value}"

    def custom_user_search(query, q: str, _session: AsyncSession):
        return query.where(DemoUserORM.username.ilike(f"{q}%"))

    def custom_role_search(query, q: str, _session: AsyncSession):
        return query.where(DemoRoleORM.name.ilike(f"{q}%"))

    def filter_roles_for_list(query, _session: AsyncSession, _user: Any):
        return query.where(DemoRoleORM.name != "hidden")

    def filter_users_by_prefix(query, value: str, _session: AsyncSession, _user: Any):
        if not value:
            return query
        return query.where(DemoUserORM.username.ilike(f"{value}%"))

    def filter_active_audience(query, _value: str, _session: AsyncSession, _user: Any):
        return query.where(DemoUserORM.is_active.is_(True))

    def filter_inactive_audience(query, _value: str, _session: AsyncSession, _user: Any):
        return query.where(DemoUserORM.is_active.is_(False))

    async def activate_users(
            _session: AsyncSession,
            _model_config: AdminModelConfig,
            items: list[DemoUserORM],
            _payload: dict[str, Any],
            _user: Any,
    ) -> dict[str, Any]:
        for item in items:
            item.is_active = True
        return {"activated": len(items)}

    async def deactivate_user(
            _session: AsyncSession,
            _model_config: AdminModelConfig,
            item: DemoUserORM,
            _payload: dict[str, Any],
            _user: Any,
    ) -> dict[str, Any]:
        item.is_active = False
        return {"deactivated": 1}

    config = AdminConfig(
        locale=locale,
        models=(
            ModelConfig(
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
                list_filters=(
                    AdminListFilterConfig(
                        slug="status",
                        label="Status",
                        group="Flags",
                        field_name="is_active",
                        input_kind="boolean",
                    ),
                    AdminListFilterConfig(
                        slug="role_id",
                        label="Role",
                        group="Access",
                        field_name="roles",
                        relation_model=DemoRoleORM,
                        relation_label_field="name",
                    ),
                    AdminListFilterConfig(
                        slug="username_contains",
                        label="Username",
                        field_name="username",
                        input_kind="text",
                    ),
                    AdminListFilterConfig(
                        slug="username_prefix",
                        label="Username Prefix",
                        filter_handler=filter_users_by_prefix,
                    ),
                    AdminListFilterConfig(
                        slug="audience",
                        label="Audience",
                        group="Flags",
                        options=(
                            AdminListFilterOptionConfig(
                                value="active-only",
                                label="Active only",
                                filter_handler=filter_active_audience,
                            ),
                            AdminListFilterOptionConfig(
                                value="inactive-only",
                                label="Inactive only",
                                filter_handler=filter_inactive_audience,
                            ),
                        ),
                    ),
                ),
                fields={
                    "display_name": AdminFieldConfig(
                        label="Отображение",
                        width_px=320,
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
                        label="Деактивировать",
                        handler=deactivate_user,
                    ),
                ),
            ),
            ModelConfig(
                model=DemoRoleORM,
                slug="roles",
                title="Роли",
                list_display=("id", "name"),
                search_query_builder=custom_role_search,
                query_for_list=filter_roles_for_list,
                ordering=("name",),
            ),
            ModelConfig(
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
            ModelConfig(
                model=DemoPostORM,
                slug="posts",
                title="Посты",
                list_display=("id", "title"),
            ),
            ModelConfig(
                model=DemoCommentORM,
                slug="comments",
                title="Комментарии",
                list_display=("id", "body"),
            ),
            ModelConfig(
                model=DemoBadgeORM,
                slug="badges",
                title="Бейджи",
                list_display=("id", "title"),
            ),
            ModelConfig(
                model=DemoTaskORM,
                slug="tasks",
                title="Задачи",
                list_display=("id", "title"),
            ),
            ModelConfig(
                model=DemoOwnedProjectORM,
                slug="owned-projects",
                title="Projects",
                list_display=("id", "title"),
            ),
            ModelConfig(
                model=DemoOwnedBoardORM,
                slug="owned-boards",
                title="Boards",
                list_display=("id", "title"),
            ),
            ModelConfig(
                model=DemoTokenProfileORM,
                slug="token-profiles",
                title="Token Profiles",
                list_display=("tokenprofile_ptr_id", "title"),
            ),
            ModelConfig(
                model=DemoAliasedMessageORM,
                slug="aliased-messages",
                title="Aliased Messages",
                list_display=("id",),
            ),
            ModelConfig(
                model=DemoAliasedChatORM,
                slug="aliased-chats",
                title="Aliased Chats",
                list_display=("id", "last_branch_message_id"),
            ),
            ModelConfig(
                model=DemoSoftUserORM,
                slug="soft-users",
                title="Soft Users",
                list_display=("id", "username"),
            ),
            ModelConfig(
                model=DemoSoftNoteORM,
                slug="soft-notes",
                title="Soft Notes",
                list_display=("id", "body", "user_id"),
            ),
            ModelConfig(
                model=DemoHardParentORM,
                slug="hard-parents",
                title="Hard Parents",
                list_display=("id", "title"),
            ),
            ModelConfig(
                model=DemoHardChildORM,
                slug="hard-children",
                title="Hard Children",
                list_display=("id", "title", "parent_id"),
            ),
        ),
    )

    app = FastAPI()
    app.include_router(
        create_admin_router(
            AdminHTTPConfig(
                registry=config,
                get_db_session_dependency=get_session,
                get_current_user_dependency=lambda: SimpleNamespace(is_staff=is_staff),
                is_allowed=lambda user: bool(user.is_staff),
            ),
        ),
    )

    async with engine.begin() as connection:  # noqa
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
            display_name_meta = next(
                field
                for field in payload["meta"]["fields"]
                if field["name"] == "display_name"
            )
            assert payload["meta"]["list_fields"] == ["id", "display_name", "joined_on", "is_active"]
            assert payload["meta"]["page_size"] == 120
            assert display_name_meta["width_px"] == 320
            assert payload["items"][0]["display_name"].endswith("alpha")
            assert payload["pagination"]["total"] == 1


@pytest.mark.asyncio
async def test_router_supports_custom_query_for_list() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add_all(
            [
                DemoRoleORM(name="admin"),
                DemoRoleORM(name="hidden"),
            ],
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/roles/items/")

            assert response.status_code == 200
            assert [item["name"] for item in response.json()["items"]] == ["admin"]


@pytest.mark.asyncio
async def test_router_returns_list_filters_in_model_meta() -> None:
    app, _session_factory = await _build_app()
    transport = ASGITransport(app=app)

    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/")

            assert response.status_code == 200
            assert response.json()["list_filters"] == [
                {
                    "slug": "status",
                    "label": "Status",
                    "group": "Flags",
                    "field_name": "is_active",
                    "input_kind": "boolean",
                    "placeholder": None,
                    "has_choices": True,
                    "options": [
                        {"value": "true", "label": "Да"},
                        {"value": "false", "label": "Нет"},
                    ],
                },
                {
                    "slug": "role_id",
                    "label": "Role",
                    "group": "Access",
                    "field_name": "roles",
                    "input_kind": "select",
                    "placeholder": None,
                    "has_choices": True,
                    "options": [],
                },
                {
                    "slug": "username_contains",
                    "label": "Username",
                    "group": None,
                    "field_name": "username",
                    "input_kind": "text",
                    "placeholder": None,
                    "has_choices": False,
                    "options": [],
                },
                {
                    "slug": "username_prefix",
                    "label": "Username Prefix",
                    "group": None,
                    "field_name": None,
                    "input_kind": "text",
                    "placeholder": None,
                    "has_choices": False,
                    "options": [],
                },
                {
                    "slug": "audience",
                    "label": "Audience",
                    "group": "Flags",
                    "field_name": None,
                    "input_kind": "select",
                    "placeholder": None,
                    "has_choices": True,
                    "options": [
                        {"value": "active-only", "label": "Active only"},
                        {"value": "inactive-only", "label": "Inactive only"},
                    ],
                },
            ]


@pytest.mark.asyncio
async def test_router_supports_boolean_list_filter() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add_all(
            [
                DemoUserORM(username="alpha", password="hashed::1", is_active=True),
                DemoUserORM(username="beta", password="hashed::2", is_active=False),
            ],
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/", params={"status": "false"})

            assert response.status_code == 200
            assert [item["display_name"] for item in response.json()["items"]] == ["Пользователь 2: beta"]


@pytest.mark.asyncio
async def test_router_returns_relation_filter_choices() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add_all(
            [
                DemoRoleORM(name="admin"),
                DemoRoleORM(name="manager"),
            ],
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/filters/role_id/choices/")

            assert response.status_code == 200
            assert response.json()["items"] == [
                {"id": 1, "label": "admin"},
                {"id": 2, "label": "manager"},
            ]


@pytest.mark.asyncio
async def test_router_supports_many_to_many_relation_list_filter() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        admin_role = DemoRoleORM(name="admin")
        manager_role = DemoRoleORM(name="manager")
        first_user = DemoUserORM(username="alpha", password="hashed::1", roles=[admin_role])
        second_user = DemoUserORM(username="beta", password="hashed::2", roles=[manager_role])
        session.add_all([first_user, second_user])
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/", params={"role_id": "1"})

            assert response.status_code == 200
            assert [item["display_name"] for item in response.json()["items"]] == ["Пользователь 1: alpha"]


@pytest.mark.asyncio
async def test_router_supports_text_list_filter() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add_all(
            [
                DemoUserORM(username="alpha", password="hashed::1"),
                DemoUserORM(username="xlar", password="hashed::2"),
            ],
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/", params={"username_contains": "xla"})

            assert response.status_code == 200
            assert [item["display_name"] for item in response.json()["items"]] == ["Пользователь 2: xlar"]


@pytest.mark.asyncio
async def test_router_supports_custom_list_filter_handler() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add_all(
            [
                DemoUserORM(username="alpha", password="hashed::1"),
                DemoUserORM(username="xlar", password="hashed::2"),
            ],
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/", params={"username_prefix": "xla"})

            assert response.status_code == 200
            assert [item["display_name"] for item in response.json()["items"]] == ["Пользователь 2: xlar"]


@pytest.mark.asyncio
async def test_router_supports_select_option_specific_filter_handler() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add_all(
            [
                DemoUserORM(username="alpha", password="hashed::1", is_active=True),
                DemoUserORM(username="beta", password="hashed::2", is_active=False),
            ],
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/", params={"audience": "inactive-only"})

            assert response.status_code == 200
            assert [item["display_name"] for item in response.json()["items"]] == ["Пользователь 2: beta"]


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
                {"slug": "deactivate", "label": "Деактивировать"},
            ]

            assert action_response.status_code == 200
            assert action_response.json()["result"]["deactivated"] == 1
            assert action_response.json()["item"]["is_active"] is False


@pytest.mark.asyncio
async def test_router_returns_english_locale_and_builtin_delete_label() -> None:
    app, _session_factory = await _build_app(locale="en")
    transport = ASGITransport(app=app)

    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/")

            assert response.status_code == 200
            payload = response.json()
            assert payload["locale"] == "en"
            assert payload["items"][0]["locale"] == "en"
            assert payload["items"][0]["bulk_actions"][0] == {"slug": "delete", "label": "Delete"}


@pytest.mark.asyncio
async def test_router_returns_locale_in_model_list_detail_and_item_meta() -> None:
    app, session_factory = await _build_app(locale="en")

    async with session_factory() as session:
        session.add(DemoUserORM(username="alpha", password="hashed::1"))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            model_response = await client.get("/xladmin/models/users/")
            list_response = await client.get("/xladmin/models/users/items/")
            item_response = await client.get("/xladmin/models/users/items/1/")

            assert model_response.status_code == 200
            assert model_response.json()["locale"] == "en"

            assert list_response.status_code == 200
            assert list_response.json()["meta"]["locale"] == "en"

            assert item_response.status_code == 200
            assert item_response.json()["meta"]["locale"] == "en"


@pytest.mark.asyncio
async def test_router_builds_delete_preview_tree_for_object() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        post = DemoPostORM(title="Welcome", user=user)
        post.comments.append(DemoCommentORM(body="First"))
        session.add(user)
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/1/delete-preview/")

            assert response.status_code == 200
            payload = response.json()
            assert payload["can_delete"] is True
            assert payload["summary"] == {"roots": 1, "delete": 2, "protect": 0, "set_null": 0, "total": 3}
            assert payload["roots"][0]["model_slug"] == "users"
            assert payload["roots"][0]["children"][0]["model_slug"] == "posts"
            assert payload["roots"][0]["children"][0]["effect"] == "delete"
            assert payload["roots"][0]["children"][0]["children"][0]["model_slug"] == "comments"


@pytest.mark.asyncio
async def test_router_builds_delete_preview_tree_for_bulk_delete() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        first_user = DemoUserORM(username="alpha", password="hashed::1")
        first_post = DemoPostORM(title="Alpha post", user=first_user)
        first_post.comments.append(DemoCommentORM(body="Alpha comment"))

        second_user = DemoUserORM(username="beta", password="hashed::2")
        second_post = DemoPostORM(title="Beta post", user=second_user)
        second_post.comments.append(DemoCommentORM(body="Beta comment"))

        session.add_all([first_user, second_user])
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post("/xladmin/models/users/bulk-delete-preview/", json={"ids": [1, 2]})

            assert response.status_code == 200
            payload = response.json()
            assert payload["can_delete"] is True
            assert payload["summary"] == {"roots": 2, "delete": 4, "protect": 0, "set_null": 0, "total": 6}
            assert [root["id"] for root in payload["roots"]] == [1, 2]


@pytest.mark.asyncio
async def test_router_returns_empty_bulk_delete_preview_for_empty_ids() -> None:
    app, _session_factory = await _build_app()
    transport = ASGITransport(app=app)

    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post("/xladmin/models/users/bulk-delete-preview/", json={"ids": []})

            assert response.status_code == 200
            assert response.json() == {
                "can_delete": True,
                "summary": {"roots": 0, "delete": 0, "protect": 0, "set_null": 0, "total": 0},
                "roots": [],
            }


@pytest.mark.asyncio
async def test_router_builds_bulk_delete_preview_only_for_existing_ids() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        session.add(DemoUserORM(username="alpha", password="hashed::1"))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post("/xladmin/models/users/bulk-delete-preview/", json={"ids": [1, 999]})

            assert response.status_code == 200
            payload = response.json()
            assert payload["can_delete"] is True
            assert payload["summary"] == {"roots": 1, "delete": 0, "protect": 0, "set_null": 0, "total": 1}
            assert [root["id"] for root in payload["roots"]] == [1]


@pytest.mark.asyncio
async def test_router_marks_non_cascade_relations_as_protected_in_delete_preview() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        badge = DemoBadgeORM(title="VIP", user=user)
        session.add_all([user, badge])
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/1/delete-preview/")

            assert response.status_code == 200
            payload = response.json()
            assert payload["can_delete"] is False
            assert payload["summary"] == {"roots": 1, "delete": 0, "protect": 1, "set_null": 0, "total": 2}
            assert payload["roots"][0]["children"][0]["model_slug"] == "badges"
            assert payload["roots"][0]["children"][0]["effect"] == "protect"


@pytest.mark.asyncio
async def test_router_marks_required_non_cascade_relations_as_protected_in_delete_preview() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        user.tasks.append(DemoTaskORM(title="Follow-up"))
        session.add(user)
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/1/delete-preview/")

            assert response.status_code == 200
            payload = response.json()
            assert payload["can_delete"] is False
            assert payload["summary"] == {"roots": 1, "delete": 0, "protect": 1, "set_null": 0, "total": 2}
            assert payload["roots"][0]["children"][0]["model_slug"] == "tasks"
            assert payload["roots"][0]["children"][0]["effect"] == "protect"


@pytest.mark.asyncio
async def test_router_blocks_delete_for_required_non_cascade_relations() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        user.tasks.append(DemoTaskORM(title="Follow-up"))
        session.add(user)
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.delete("/xladmin/models/users/items/1/")

            assert response.status_code == 409

    async with session_factory() as session:
        assert len(list((await session.execute(select(DemoUserORM))).scalars())) == 1
        assert len(list((await session.execute(select(DemoTaskORM))).scalars())) == 1


@pytest.mark.asyncio
async def test_router_detects_reverse_foreign_keys_without_parent_relationships() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        user = DemoUserORM(username="owner", password="hashed::1")
        session.add(user)
        await session.flush()
        project = DemoOwnedProjectORM(title="Tracker Project", author_id=user.id)
        session.add(project)
        await session.flush()
        session.add(DemoOwnedBoardORM(title="Roadmap", project_id=project.id))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/1/delete-preview/")

            assert response.status_code == 200
            payload = response.json()
            assert payload["can_delete"] is False
            assert payload["summary"] == {"roots": 1, "delete": 0, "protect": 2, "set_null": 0, "total": 3}
            project_node = payload["roots"][0]["children"][0]
            assert project_node["model_slug"] == "owned-projects"
            assert project_node["relation_name"] == "author_id"
            assert project_node["effect"] == "protect"
            assert project_node["children"][0]["model_slug"] == "owned-boards"
            assert project_node["children"][0]["relation_name"] == "project_id"
            assert project_node["children"][0]["effect"] == "protect"


@pytest.mark.asyncio
async def test_router_blocks_delete_for_reverse_foreign_keys_without_parent_relationships() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        user = DemoUserORM(username="owner", password="hashed::1")
        session.add(user)
        await session.flush()
        project = DemoOwnedProjectORM(title="Tracker Project", author_id=user.id)
        session.add(project)
        await session.flush()
        session.add(DemoOwnedBoardORM(title="Roadmap", project_id=project.id))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.delete("/xladmin/models/users/items/1/")

            assert response.status_code == 409

    async with session_factory() as session:
        assert len(list((await session.execute(select(DemoUserORM))).scalars())) == 1
        assert len(list((await session.execute(select(DemoOwnedProjectORM))).scalars())) == 1
        assert len(list((await session.execute(select(DemoOwnedBoardORM))).scalars())) == 1


@pytest.mark.asyncio
async def test_router_handles_related_models_with_non_default_primary_key() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        user = DemoUserORM(username="owner", password="hashed::1")
        session.add(user)
        await session.flush()
        session.add(
            DemoTokenProfileORM(
                tokenprofile_ptr_id="profile-1",
                title="Profile",
                user_id=user.id,
            ),
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/1/delete-preview/")

            assert response.status_code == 200
            payload = response.json()
            assert payload["can_delete"] is False
            related_slugs = [child["model_slug"] for child in payload["roots"][0]["children"]]
            assert "token-profiles" in related_slugs


@pytest.mark.asyncio
async def test_router_handles_related_models_with_aliased_column_name() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        message = DemoAliasedMessageORM(id="message-1")
        session.add(message)
        await session.flush()
        session.add(DemoAliasedChatORM(id="chat-1", last_branch_message_id=message.id))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/aliased-messages/items/message-1/delete-preview/")

            assert response.status_code == 200
            payload = response.json()
            assert payload["can_delete"] is False
            assert payload["summary"] == {"roots": 1, "delete": 0, "protect": 1, "set_null": 0, "total": 2}
            assert payload["roots"][0]["children"][0]["model_slug"] == "aliased-chats"


@pytest.mark.asyncio
async def test_router_marks_ondelete_set_null_relations_in_delete_preview() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        user = DemoSoftUserORM(username="alpha")
        session.add(user)
        await session.flush()
        session.add(DemoSoftNoteORM(body="note", user_id=user.id))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/soft-users/items/1/delete-preview/")

            assert response.status_code == 200
            payload = response.json()
            assert payload["can_delete"] is True
            assert payload["summary"] == {"roots": 1, "delete": 0, "protect": 0, "set_null": 1, "total": 2}
            assert payload["roots"][0]["children"][0]["model_slug"] == "soft-notes"
            assert payload["roots"][0]["children"][0]["effect"] == "set-null"


@pytest.mark.asyncio
async def test_router_applies_set_null_before_delete() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        user = DemoSoftUserORM(username="alpha")
        session.add(user)
        await session.flush()
        session.add(DemoSoftNoteORM(body="note", user_id=user.id))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.delete("/xladmin/models/soft-users/items/1/")

            assert response.status_code == 204

    async with session_factory() as session:
        assert len(list((await session.execute(select(DemoSoftUserORM))).scalars())) == 0
        note = (await session.execute(select(DemoSoftNoteORM))).scalar_one()
        assert note.user_id is None


@pytest.mark.asyncio
async def test_router_marks_ondelete_cascade_relations_as_delete() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        parent = DemoHardParentORM(title="parent")
        session.add(parent)
        await session.flush()
        session.add(DemoHardChildORM(title="child", parent_id=parent.id))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/hard-parents/items/1/delete-preview/")

            assert response.status_code == 200
            payload = response.json()
            assert payload["can_delete"] is True
            assert payload["summary"] == {"roots": 1, "delete": 1, "protect": 0, "set_null": 0, "total": 2}
            assert payload["roots"][0]["children"][0]["model_slug"] == "hard-children"
            assert payload["roots"][0]["children"][0]["effect"] == "delete"


@pytest.mark.asyncio
async def test_router_deletes_ondelete_cascade_relations() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        parent = DemoHardParentORM(title="parent")
        session.add(parent)
        await session.flush()
        session.add(DemoHardChildORM(title="child", parent_id=parent.id))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.delete("/xladmin/models/hard-parents/items/1/")

            assert response.status_code == 204

    async with session_factory() as session:
        assert len(list((await session.execute(select(DemoHardParentORM))).scalars())) == 0
        assert len(list((await session.execute(select(DemoHardChildORM))).scalars())) == 0


@pytest.mark.asyncio
async def test_router_builds_delete_preview_with_multiple_cascade_branches() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        post = DemoPostORM(title="Welcome", user=user)
        post.comments.append(DemoCommentORM(body="First"))
        user.secrets.append(DemoSecretORM(code_name="vault"))
        session.add(user)
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/1/delete-preview/")

            assert response.status_code == 200
            payload = response.json()
            assert payload["can_delete"] is True
            assert payload["summary"] == {"roots": 1, "delete": 3, "protect": 0, "set_null": 0, "total": 4}
            child_model_slugs = [child["model_slug"] for child in payload["roots"][0]["children"]]
            assert "posts" in child_model_slugs
            assert None in child_model_slugs


@pytest.mark.asyncio
async def test_router_uses_fallback_label_for_unregistered_related_model_in_delete_preview() -> None:
    app, session_factory = await _build_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        user.secrets.append(DemoSecretORM(code_name="vault"))
        session.add(user)
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/1/delete-preview/")

            assert response.status_code == 200
            payload = response.json()
            secret_node = payload["roots"][0]["children"][0]
            assert secret_node["model_slug"] is None
            assert secret_node["model_title"] == "DemoSecretORM"
            assert secret_node["label"] == "vault"


@pytest.mark.asyncio
async def test_router_returns_localized_forbidden_error() -> None:
    app, _session_factory = await _build_app(locale="en", is_staff=False)
    transport = ASGITransport(app=app)

    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/")

            assert response.status_code == 403
            assert response.json()["detail"] == "Access denied."


@pytest.mark.asyncio
async def test_router_returns_localized_object_not_found_error() -> None:
    app, _session_factory = await _build_app(locale="en")
    transport = ASGITransport(app=app)

    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/users/items/999/delete-preview/")

            assert response.status_code == 404
            assert response.json()["detail"] == "Object was not found."


@pytest.mark.asyncio
async def test_router_returns_localized_admin_model_not_found_error() -> None:
    app, _session_factory = await _build_app(locale="en")
    transport = ASGITransport(app=app)

    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/xladmin/models/missing-model/")

            assert response.status_code == 404
            assert response.json()["detail"] == "Admin model was not found."


@pytest.mark.asyncio
async def test_router_returns_localized_object_action_not_found_error() -> None:
    app, session_factory = await _build_app(locale="en")

    async with session_factory() as session:
        session.add(DemoUserORM(username="alpha", password="hashed::1"))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post("/xladmin/models/users/items/1/actions/missing-action/", json={})

            assert response.status_code == 404
            assert response.json()["detail"] == "Object action was not found."


@pytest.mark.asyncio
async def test_router_returns_localized_bulk_action_not_found_error() -> None:
    app, session_factory = await _build_app(locale="en")

    async with session_factory() as session:
        session.add(DemoUserORM(username="alpha", password="hashed::1"))
        await session.commit()

    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post("/xladmin/models/users/bulk-actions/missing-action/", json={"ids": [1]})

            assert response.status_code == 404
            assert response.json()["detail"] == "Bulk action was not found."
