from __future__ import annotations

import pytest
from fastapi import Response

from ._router_helpers import build_test_app, get_test_client

pytestmark = pytest.mark.asyncio


async def test_router_logout_preserves_headers_from_logout_dependency() -> None:
    def clear_admin_cookie(response: Response) -> None:
        response.delete_cookie("admin_session", path="/")

    app, _session_factory = await build_test_app(logout_dependency=clear_admin_cookie)

    async with get_test_client(app) as client:
        client.cookies.set("admin_session", "token")
        response = await client.post("/xladmin/logout/")

        assert response.status_code == 204
        assert "admin_session=" in response.headers["set-cookie"]
        assert "Max-Age=0" in response.headers["set-cookie"]
