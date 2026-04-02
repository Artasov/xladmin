from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date
from types import SimpleNamespace
from typing import Any

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Date, ForeignKey, String
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
from xladmin.config import AdminLocale


class Base(DeclarativeBase):
    pass


class DemoUserORM(Base):
    __tablename__ = "demo_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    joined_on: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(default=True)
    posts: Mapped[list[DemoPostORM]] = relationship(back_populates="user", cascade="all, delete-orphan")
    badges: Mapped[list[DemoBadgeORM]] = relationship(back_populates="user")
    secrets: Mapped[list[DemoSecretORM]] = relationship(back_populates="user", cascade="all, delete-orphan")
    tasks: Mapped[list[DemoTaskORM]] = relationship(back_populates="user")
    roles: Mapped[list[DemoRoleORM]] = relationship(secondary="demo_user_roles", back_populates="users")


class DemoRoleORM(Base):
    __tablename__ = "demo_roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    users: Mapped[list[DemoUserORM]] = relationship(secondary="demo_user_roles", back_populates="roles")


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
    comments: Mapped[list[DemoCommentORM]] = relationship(back_populates="post", cascade="all, delete-orphan")


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


class DemoInviteORM(Base):
    __tablename__ = "demo_invites"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(128), nullable=False)
    secret_key: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by: Mapped[str] = mapped_column(String(64), nullable=False)


class DemoStrictProfileORM(Base):
    __tablename__ = "demo_strict_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    access_code: Mapped[str] = mapped_column(String(64), nullable=False)


TEST_DATABASE_URL = os.getenv(
    "XLADMIN_TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:adminadmin@localhost:5432/xladmin_test",
)


async def build_test_app(
        locale: AdminLocale = "ru",
        *,
        is_staff: bool = True,
) -> tuple[FastAPI, async_sessionmaker[AsyncSession]]:
    engine_kwargs: dict[str, Any] = {}
    if TEST_DATABASE_URL.startswith("sqlite"):
        engine_kwargs["pool" "class"] = StaticPool
    engine = create_async_engine(TEST_DATABASE_URL, **engine_kwargs)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.dispose()

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

    def create_invite_item(_payload: dict[str, Any], _session: AsyncSession, _user: Any) -> DemoInviteORM:
        return DemoInviteORM(secret_key="generated-secret", created_by="admin")

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
                        slug="role_ids",
                        label="Roles",
                        group="Access",
                        field_name="roles",
                        relation_model=DemoRoleORM,
                        relation_label_field="name",
                        input_kind="select-multiple",
                        multiple=True,
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
                detail_fields=("id", "name"),
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
            ModelConfig(model=DemoPostORM, slug="posts", title="Посты", list_display=("id", "title")),
            ModelConfig(model=DemoCommentORM, slug="comments", title="Комментарии", list_display=("id", "body")),
            ModelConfig(model=DemoBadgeORM, slug="badges", title="Бейджи", list_display=("id", "title")),
            ModelConfig(model=DemoTaskORM, slug="tasks", title="Задачи", list_display=("id", "title")),
            ModelConfig(
                model=DemoOwnedProjectORM,
                slug="owned-projects",
                title="Projects",
                list_display=("id", "title"),
            ),
            ModelConfig(model=DemoOwnedBoardORM, slug="owned-boards", title="Boards", list_display=("id", "title")),
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
            ModelConfig(model=DemoSoftUserORM, slug="soft-users", title="Soft Users", list_display=("id", "username")),
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
            ModelConfig(
                model=DemoInviteORM,
                slug="invites",
                title="Invites",
                list_display=("id", "email", "created_by"),
                create_fields=("email",),
                create_item_factory=create_invite_item,
            ),
            ModelConfig(
                model=DemoStrictProfileORM,
                slug="strict-profiles",
                title="Strict Profiles",
                list_display=("id", "name"),
                fields={
                    "access_code": AdminFieldConfig(hidden_in_form=True),
                },
            ),
        ),
    )

    app = FastAPI(lifespan=lifespan)
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

    async with engine.connect() as connection:
        async with connection.begin():
            await connection.run_sync(Base.metadata.drop_all)
            await connection.run_sync(Base.metadata.create_all)

    return app, session_factory


@asynccontextmanager
async def get_test_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with transport:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            yield client


async def save_entities(session_factory: async_sessionmaker[AsyncSession], *entities: Any) -> None:
    async with session_factory() as session:
        session.add_all(list(entities))
        await session.commit()
