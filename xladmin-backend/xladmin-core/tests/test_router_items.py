from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import select

from ._router_helpers import (
    DemoInviteORM,
    DemoRoleORM,
    DemoUserORM,
    build_test_app,
    get_test_client,
    save_entities,
)

pytestmark = pytest.mark.asyncio


async def test_router_supports_virtual_fields_and_custom_setter() -> None:
    app, session_factory = await build_test_app()

    async with get_test_client(app) as client:
        create_response = await client.post(
            "/xladmin/models/users/items/",
            json={"username": "tester", "joined_on": "2026-03-26", "new_password": "secret"},
        )

        assert create_response.status_code == 201
        assert create_response.json()["item"]["new_password"] == ""

    async with session_factory() as session:
        item = (await session.execute(select(DemoUserORM))).scalar_one()
        assert item.password == "hashed::secret"


async def test_router_uses_create_item_factory_for_hidden_required_fields() -> None:
    app, session_factory = await build_test_app()

    async with get_test_client(app) as client:
        create_response = await client.post(
            "/xladmin/models/invites/items/",
            json={"email": "invite@example.com"},
        )

        assert create_response.status_code == 201
        assert create_response.json()["item"]["email"] == "invite@example.com"

    async with session_factory() as session:
        item = (await session.execute(select(DemoInviteORM))).scalar_one()
        assert item.secret_key == "generated-secret"
        assert item.created_by == "admin"


async def test_router_returns_400_when_hidden_required_create_fields_are_missing() -> None:
    app, _session_factory = await build_test_app()

    async with get_test_client(app) as client:
        create_response = await client.post(
            "/xladmin/models/strict-profiles/items/",
            json={"name": "alpha"},
        )

        assert create_response.status_code == 400
        assert create_response.json()["detail"] == "Missing required fields for create: access_code."


async def test_router_parses_string_boolean_payloads_correctly() -> None:
    app, session_factory = await build_test_app()

    async with get_test_client(app) as client:
        create_response = await client.post(
            "/xladmin/models/users/items/",
            json={"username": "tester", "is_active": "false"},
        )

        assert create_response.status_code == 201
        assert create_response.json()["item"]["is_active"] is False

    async with session_factory() as session:
        item = (await session.execute(select(DemoUserORM))).scalar_one()
        assert item.is_active is False


async def test_router_rejects_unknown_relation_ids() -> None:
    app, _session_factory = await build_test_app()

    async with get_test_client(app) as client:
        response = await client.post("/xladmin/models/audits/items/", json={"role_id": 999})

        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid value for field 'role_id'."


async def test_router_supports_custom_query_for_list() -> None:
    app, session_factory = await build_test_app()
    await save_entities(session_factory, DemoRoleORM(name="admin"), DemoRoleORM(name="hidden"))

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/roles/items/")

        assert response.status_code == 200
        assert [item["name"] for item in response.json()["items"]] == ["admin"]


async def test_router_applies_query_for_list_scope_to_detail_endpoints() -> None:
    app, session_factory = await build_test_app()
    await save_entities(session_factory, DemoRoleORM(name="admin"), DemoRoleORM(name="hidden"))

    async with get_test_client(app) as client:
        detail_response = await client.get("/xladmin/models/roles/items/2/")
        delete_response = await client.delete("/xladmin/models/roles/items/2/")

        assert detail_response.status_code == 404
        assert delete_response.status_code == 404


async def test_router_uses_list_display_and_custom_search() -> None:
    app, session_factory = await build_test_app()
    await save_entities(
        session_factory,
        DemoUserORM(username="alpha", password="hashed::1"),
        DemoUserORM(username="beta", password="hashed::2"),
    )

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/", params={"q": "al"})

        assert response.status_code == 200
        payload = response.json()
        display_name_meta = next(field for field in payload["meta"]["fields"] if field["name"] == "display_name")
        assert payload["meta"]["list_fields"] == ["id", "display_name", "joined_on", "is_active"]
        assert payload["meta"]["page_size"] == 120
        assert display_name_meta["width_px"] == 320
        assert payload["items"][0]["display_name"].endswith("alpha")
        assert payload["pagination"]["total"] == 1


async def test_router_supports_bulk_actions() -> None:
    app, session_factory = await build_test_app()
    await save_entities(
        session_factory,
        DemoUserORM(username="alpha", password="hashed::1", is_active=False),
        DemoUserORM(username="beta", password="hashed::2", is_active=False),
    )

    async with get_test_client(app) as client:
        response = await client.post("/xladmin/models/users/bulk-actions/activate/", json={"ids": [1, 2]})

        assert response.status_code == 200
        assert response.json()["processed"] == 2
        assert response.json()["activated"] == 2

    async with session_factory() as session:
        items = list((await session.execute(select(DemoUserORM).order_by(DemoUserORM.id))).scalars())
        assert [item.is_active for item in items] == [True, True]


async def test_router_supports_bulk_actions_for_all_filtered_items() -> None:
    app, session_factory = await build_test_app()
    await save_entities(
        session_factory,
        DemoUserORM(username="alpha", password="hashed::1", is_active=False),
        DemoUserORM(username="beta", password="hashed::2", is_active=False),
        DemoUserORM(username="gamma", password="hashed::3", is_active=True),
    )

    async with get_test_client(app) as client:
        response = await client.post(
            "/xladmin/models/users/bulk-actions/activate/",
            json={
                "ids": [],
                "select_all": True,
                "selection_scope": {
                    "filters": {"status": "false"},
                },
            },
        )

        assert response.status_code == 200
        assert response.json()["processed"] == 2
        assert response.json()["activated"] == 2

    async with session_factory() as session:
        items = list((await session.execute(select(DemoUserORM).order_by(DemoUserORM.id))).scalars())
        assert [item.is_active for item in items] == [True, True, True]


async def test_router_supports_sorting_by_multiple_fields() -> None:
    app, session_factory = await build_test_app()
    await save_entities(
        session_factory,
        DemoUserORM(username="beta", password="hashed::1", joined_on=date(2026, 3, 27), is_active=False),
        DemoUserORM(username="alpha", password="hashed::2", joined_on=date(2026, 3, 25), is_active=True),
        DemoUserORM(username="gamma", password="hashed::3", joined_on=date(2026, 3, 26), is_active=False),
    )

    async with get_test_client(app) as client:
        by_display_response = await client.get("/xladmin/models/users/items/", params={"sort": "display_name"})
        by_multiple_fields_response = await client.get("/xladmin/models/users/items/", params={"sort": "is_active,-id"})
        by_date_response = await client.get("/xladmin/models/users/items/", params={"sort": "joined_on"})

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


async def test_router_supports_object_actions() -> None:
    app, session_factory = await build_test_app()
    await save_entities(session_factory, DemoUserORM(username="alpha", password="hashed::1", is_active=True))

    async with get_test_client(app) as client:
        meta_response = await client.get("/xladmin/models/users/")
        action_response = await client.post("/xladmin/models/users/items/1/actions/deactivate/", json={})

        assert meta_response.status_code == 200
        assert meta_response.json()["object_actions"] == [{"slug": "deactivate", "label": "Деактивировать"}]

        assert action_response.status_code == 200
        assert action_response.json()["result"]["deactivated"] == 1
        assert action_response.json()["item"]["is_active"] is False


async def test_router_returns_english_locale_and_builtin_delete_label() -> None:
    app, _session_factory = await build_test_app(locale="en")

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/")

        assert response.status_code == 200
        payload = response.json()
        assert payload["locale"] == "en"
        assert payload["items"][0]["locale"] == "en"
        assert payload["items"][0]["bulk_actions"][0] == {"slug": "delete", "label": "Delete"}


async def test_router_returns_locale_in_model_list_detail_and_item_meta() -> None:
    app, session_factory = await build_test_app(locale="en")
    await save_entities(session_factory, DemoUserORM(username="alpha", password="hashed::1"))

    async with get_test_client(app) as client:
        model_response = await client.get("/xladmin/models/users/")
        list_response = await client.get("/xladmin/models/users/items/")
        item_response = await client.get("/xladmin/models/users/items/1/")

        assert model_response.status_code == 200
        assert model_response.json()["locale"] == "en"

        assert list_response.status_code == 200
        assert list_response.json()["meta"]["locale"] == "en"

        assert item_response.status_code == 200
        assert item_response.json()["meta"]["locale"] == "en"
