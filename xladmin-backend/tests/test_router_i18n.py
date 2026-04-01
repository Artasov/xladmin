from __future__ import annotations

import pytest

from ._router_helpers import DemoUserORM, build_test_app, get_test_client, save_entities

pytestmark = pytest.mark.asyncio


async def test_router_returns_localized_forbidden_error() -> None:
    app, _session_factory = await build_test_app(locale="en", is_staff=False)

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/")

        assert response.status_code == 403
        assert response.json()["detail"] == "Access denied."


async def test_router_returns_localized_object_not_found_error() -> None:
    app, _session_factory = await build_test_app(locale="en")

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/999/delete-preview/")

        assert response.status_code == 404
        assert response.json()["detail"] == "Object was not found."


async def test_router_returns_localized_admin_model_not_found_error() -> None:
    app, _session_factory = await build_test_app(locale="en")

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/missing-model/")

        assert response.status_code == 404
        assert response.json()["detail"] == "Admin model was not found."


async def test_router_returns_localized_object_action_not_found_error() -> None:
    app, session_factory = await build_test_app(locale="en")
    await save_entities(session_factory, DemoUserORM(username="alpha", password="hashed::1"))

    async with get_test_client(app) as client:
        response = await client.post("/xladmin/models/users/items/1/actions/missing-action/", json={})

        assert response.status_code == 404
        assert response.json()["detail"] == "Object action was not found."


async def test_router_returns_localized_bulk_action_not_found_error() -> None:
    app, session_factory = await build_test_app(locale="en")
    await save_entities(session_factory, DemoUserORM(username="alpha", password="hashed::1"))

    async with get_test_client(app) as client:
        response = await client.post("/xladmin/models/users/bulk-actions/missing-action/", json={"ids": [1]})

        assert response.status_code == 404
        assert response.json()["detail"] == "Bulk action was not found."
