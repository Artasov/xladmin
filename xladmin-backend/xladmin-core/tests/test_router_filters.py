from __future__ import annotations

import pytest

from ._router_helpers import (
    DemoRoleORM,
    DemoUserORM,
    build_test_app,
    get_test_client,
    save_entities,
)

pytestmark = pytest.mark.asyncio


async def test_router_returns_list_filters_in_model_meta() -> None:
    app, _session_factory = await build_test_app()

    async with get_test_client(app) as client:
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
                "options": [{"value": "true", "label": "Да"}, {"value": "false", "label": "Нет"}],
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


async def test_router_supports_boolean_list_filter() -> None:
    app, session_factory = await build_test_app()
    await save_entities(
        session_factory,
        DemoUserORM(username="alpha", password="hashed::1", is_active=True),
        DemoUserORM(username="beta", password="hashed::2", is_active=False),
    )

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/", params={"status": "false"})

        assert response.status_code == 200
        assert [item["display_name"] for item in response.json()["items"]] == ["Пользователь 2: beta"]


async def test_router_returns_relation_filter_choices() -> None:
    app, session_factory = await build_test_app()
    await save_entities(
        session_factory,
        DemoRoleORM(name="admin"),
        DemoRoleORM(name="manager"),
        DemoRoleORM(name="hidden"),
    )

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/filters/role_id/choices/")

        assert response.status_code == 200
        assert response.json()["items"] == [{"id": 1, "label": "admin"}, {"id": 2, "label": "manager"}]


async def test_router_supports_many_to_many_relation_list_filter() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        admin_role = DemoRoleORM(name="admin")
        manager_role = DemoRoleORM(name="manager")
        first_user = DemoUserORM(username="alpha", password="hashed::1", roles=[admin_role])
        second_user = DemoUserORM(username="beta", password="hashed::2", roles=[manager_role])
        session.add_all([first_user, second_user])
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/", params={"role_id": "1"})

        assert response.status_code == 200
        assert [item["display_name"] for item in response.json()["items"]] == ["Пользователь 1: alpha"]


async def test_router_supports_text_list_filter() -> None:
    app, session_factory = await build_test_app()
    await save_entities(
        session_factory,
        DemoUserORM(username="alpha", password="hashed::1"),
        DemoUserORM(username="xlar", password="hashed::2"),
    )

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/", params={"username_contains": "xla"})

        assert response.status_code == 200
        assert [item["display_name"] for item in response.json()["items"]] == ["Пользователь 2: xlar"]


async def test_router_supports_custom_list_filter_handler() -> None:
    app, session_factory = await build_test_app()
    await save_entities(
        session_factory,
        DemoUserORM(username="alpha", password="hashed::1"),
        DemoUserORM(username="xlar", password="hashed::2"),
    )

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/", params={"username_prefix": "xla"})

        assert response.status_code == 200
        assert [item["display_name"] for item in response.json()["items"]] == ["Пользователь 2: xlar"]


async def test_router_supports_select_option_specific_filter_handler() -> None:
    app, session_factory = await build_test_app()
    await save_entities(
        session_factory,
        DemoUserORM(username="alpha", password="hashed::1", is_active=True),
        DemoUserORM(username="beta", password="hashed::2", is_active=False),
    )

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/", params={"audience": "inactive-only"})

        assert response.status_code == 200
        assert [item["display_name"] for item in response.json()["items"]] == ["Пользователь 2: beta"]


async def test_router_reuses_related_model_search_for_choices() -> None:
    app, session_factory = await build_test_app()
    await save_entities(
        session_factory,
        DemoRoleORM(name="admin"),
        DemoRoleORM(name="moderator"),
        DemoRoleORM(name="user"),
    )

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/audits/fields/role_id/choices/", params={"q": "ad"})

        assert response.status_code == 200
        assert response.json()["items"] == [{"id": 1, "label": "admin"}]


async def test_router_applies_relation_scope_to_field_choices() -> None:
    app, session_factory = await build_test_app()
    await save_entities(session_factory, DemoRoleORM(name="admin"), DemoRoleORM(name="hidden"))

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/audits/fields/role_id/choices/")

        assert response.status_code == 200
        assert response.json()["items"] == [{"id": 1, "label": "admin"}]
