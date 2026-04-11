from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import select

from ._router_helpers import (
    DemoInviteORM,
    DemoProxyORM,
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


async def test_router_create_detail_does_not_lazy_load_unloaded_relations() -> None:
    app, _session_factory = await build_test_app(include_roles_in_user_detail=True)

    async with get_test_client(app) as client:
        create_response = await client.post(
            "/xladmin/models/users/items/",
            json={"username": "tester", "joined_on": "2026-03-26", "new_password": "secret"},
        )

        assert create_response.status_code == 201
        assert create_response.json()["item"]["roles"] == []
        assert create_response.json()["item"]["_relations"]["roles"] == []


async def test_router_returns_400_when_hidden_required_create_fields_are_missing() -> None:
    app, _session_factory = await build_test_app()

    async with get_test_client(app) as client:
        create_response = await client.post(
            "/xladmin/models/strict-profiles/items/",
            json={"name": "alpha"},
        )

        assert create_response.status_code == 400
        assert create_response.json()["detail"] == "Missing required fields for create: access_code."


async def test_router_exposes_custom_create_form_meta() -> None:
    app, _session_factory = await build_test_app()

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/proxies/")

        assert response.status_code == 200
        payload = response.json()
        assert payload["create_form"] == [
            {
                "name": "scheme",
                "label": "Scheme",
                "help_text": None,
                "required": True,
                "placeholder": None,
                "nullable": False,
                "read_only": False,
                "type": "select",
                "input_kind": "select",
                "has_choices": False,
                "is_relation_many": False,
                "options": [
                    {"value": "http", "label": "HTTP"},
                    {"value": "socks5h", "label": "SOCKS5H"},
                ],
                "auto_now": False,
            },
            {
                "name": "proxy",
                "label": "Proxy",
                "help_text": None,
                "required": True,
                "placeholder": "login:password@ip:port",
                "nullable": False,
                "read_only": False,
                "type": "text",
                "input_kind": "text",
                "has_choices": False,
                "is_relation_many": False,
                "options": [],
                "auto_now": False,
            },
        ]


async def test_router_supports_custom_create_handler() -> None:
    app, session_factory = await build_test_app()

    async with get_test_client(app) as client:
        create_response = await client.post(
            "/xladmin/models/proxies/items/",
            json={"scheme": "http", "proxy": "login:password@127.0.0.1:8080"},
        )

        assert create_response.status_code == 201
        payload = create_response.json()["item"]
        assert payload["scheme"] == "http"
        assert payload["host"] == "127.0.0.1"
        assert payload["port"] == 8080
        assert payload["username"] == "login"
        assert payload["password"] == "password"
        assert payload["name"] == "127.0.0.1:8080"

    async with session_factory() as session:
        item = (await session.execute(select(DemoProxyORM))).scalar_one()
        assert item.scheme == "http"
        assert item.host == "127.0.0.1"
        assert item.port == 8080
        assert item.username == "login"
        assert item.password == "password"


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


async def test_router_supports_bulk_actions_with_custom_form() -> None:
    app, session_factory = await build_test_app()
    await save_entities(
        session_factory,
        DemoUserORM(username="alpha", password="hashed::1", is_active=False),
        DemoUserORM(username="beta", password="hashed::2", is_active=False),
    )

    async with get_test_client(app) as client:
        meta_response = await client.get("/xladmin/models/users/")
        response = await client.post(
            "/xladmin/models/users/bulk-actions/activate-with-reason/",
            json={"ids": [1, 2], "reason": "manual"},
        )

        assert meta_response.status_code == 200
        assert meta_response.json()["bulk_actions"][1] == {
            "slug": "activate",
            "label": "Активировать",
            "form": None,
        }
        assert meta_response.json()["bulk_actions"][2] == {
            "slug": "activate-with-reason",
            "label": "Активировать с причиной",
            "form": [
                {
                    "name": "reason",
                    "label": "Причина",
                    "help_text": None,
                    "required": True,
                    "placeholder": None,
                    "nullable": False,
                    "read_only": False,
                    "type": "text",
                    "input_kind": "text",
                    "has_choices": False,
                    "is_relation_many": False,
                    "options": [],
                    "auto_now": False,
                },
            ],
        }
        assert response.status_code == 200
        assert response.json()["processed"] == 2
        assert response.json()["reason"] == "manual"


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
        assert meta_response.json()["object_actions"][0] == {
            "slug": "deactivate",
            "label": "Деактивировать",
            "form": None,
        }

        assert action_response.status_code == 200
        assert action_response.json()["result"]["deactivated"] == 1
        assert action_response.json()["item"]["is_active"] is False


async def test_router_supports_object_actions_with_custom_form() -> None:
    app, session_factory = await build_test_app()
    await save_entities(session_factory, DemoUserORM(username="alpha", password="hashed::1", is_active=True))

    async with get_test_client(app) as client:
        meta_response = await client.get("/xladmin/models/users/")
        action_response = await client.post(
            "/xladmin/models/users/items/1/actions/rename/",
            json={"username": "renamed"},
        )

        assert meta_response.status_code == 200
        action_meta = meta_response.json()["object_actions"][1]
        assert action_meta["slug"] == "rename"
        assert action_meta["label"] == "Переименовать"
        assert action_meta["form"][0]["name"] == "username"
        assert action_meta["form"][0]["label"] == "Имя пользователя"
        assert action_meta["form"][0]["required"] is True
        assert action_meta["form"][0]["nullable"] is False
        assert action_meta["form"][0]["input_kind"] == "text"
        assert action_meta["form"][0]["options"] == []
        assert action_meta["form"][0]["auto_now"] is False
        assert action_response.status_code == 200
        assert action_response.json()["result"]["username"] == "renamed"
        assert action_response.json()["item"]["username"] == "renamed"


async def test_router_returns_409_on_integrity_conflict_during_create() -> None:
    app, session_factory = await build_test_app(locale="en")
    await save_entities(session_factory, DemoUserORM(username="alpha", password="hashed::1"))

    async with get_test_client(app) as client:
        response = await client.post("/xladmin/models/users/items/", json={"username": "alpha"})

        assert response.status_code == 409
        assert response.json()["detail"] == "The operation conflicts with existing data."


async def test_router_returns_english_locale_and_builtin_delete_label() -> None:
    app, _session_factory = await build_test_app(locale="en")

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/")

        assert response.status_code == 200
        payload = response.json()
        assert payload["locale"] == "en"
        assert payload["items"][0]["locale"] == "en"
        assert payload["items"][0]["bulk_actions"][0] == {"slug": "delete", "label": "Delete", "form": None}


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
