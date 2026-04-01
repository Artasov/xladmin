from __future__ import annotations

import pytest
from sqlalchemy import select

from ._router_helpers import (
    DemoAliasedChatORM,
    DemoAliasedMessageORM,
    DemoBadgeORM,
    DemoCommentORM,
    DemoHardChildORM,
    DemoHardParentORM,
    DemoOwnedBoardORM,
    DemoOwnedProjectORM,
    DemoPostORM,
    DemoSecretORM,
    DemoSoftNoteORM,
    DemoSoftUserORM,
    DemoTaskORM,
    DemoTokenProfileORM,
    DemoUserORM,
    build_test_app,
    get_test_client,
)

pytestmark = pytest.mark.asyncio


async def _seed_owned_project_tree(session_factory) -> None:
    async with session_factory() as session:
        user = DemoUserORM(username="owner", password="hashed::1")
        session.add(user)
        await session.flush()
        project = DemoOwnedProjectORM(title="Tracker Project", author_id=user.id)
        session.add(project)
        await session.flush()
        session.add(DemoOwnedBoardORM(title="Roadmap", project_id=project.id))
        await session.commit()


async def test_router_builds_delete_preview_tree_for_object() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        post = DemoPostORM(title="Welcome", user=user)
        post.comments.append(DemoCommentORM(body="First"))
        session.add(user)
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/1/delete-preview/")

        assert response.status_code == 200
        payload = response.json()
        assert payload["can_delete"] is True
        assert payload["summary"] == {"roots": 1, "delete": 2, "protect": 0, "set_null": 0, "total": 3}
        assert payload["roots"][0]["model_slug"] == "users"
        assert payload["roots"][0]["children"][0]["model_slug"] == "posts"
        assert payload["roots"][0]["children"][0]["effect"] == "delete"
        assert payload["roots"][0]["children"][0]["children"][0]["model_slug"] == "comments"


async def test_router_builds_delete_preview_tree_for_bulk_delete() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        first_user = DemoUserORM(username="alpha", password="hashed::1")
        first_post = DemoPostORM(title="Alpha post", user=first_user)
        first_post.comments.append(DemoCommentORM(body="Alpha comment"))
        second_user = DemoUserORM(username="beta", password="hashed::2")
        second_post = DemoPostORM(title="Beta post", user=second_user)
        second_post.comments.append(DemoCommentORM(body="Beta comment"))
        session.add_all([first_user, second_user])
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.post("/xladmin/models/users/bulk-delete-preview/", json={"ids": [1, 2]})

        assert response.status_code == 200
        payload = response.json()
        assert payload["can_delete"] is True
        assert payload["summary"] == {"roots": 2, "delete": 4, "protect": 0, "set_null": 0, "total": 6}
        assert [root["id"] for root in payload["roots"]] == [1, 2]


async def test_router_returns_empty_bulk_delete_preview_for_empty_ids() -> None:
    app, _session_factory = await build_test_app()

    async with get_test_client(app) as client:
        response = await client.post("/xladmin/models/users/bulk-delete-preview/", json={"ids": []})

        assert response.status_code == 200
        assert response.json() == {
            "can_delete": True,
            "summary": {"roots": 0, "delete": 0, "protect": 0, "set_null": 0, "total": 0},
            "roots": [],
        }


async def test_router_builds_bulk_delete_preview_only_for_existing_ids() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        session.add(DemoUserORM(username="alpha", password="hashed::1"))
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.post("/xladmin/models/users/bulk-delete-preview/", json={"ids": [1, 999]})

        assert response.status_code == 200
        payload = response.json()
        assert payload["can_delete"] is True
        assert payload["summary"] == {"roots": 1, "delete": 0, "protect": 0, "set_null": 0, "total": 1}
        assert [root["id"] for root in payload["roots"]] == [1]


async def test_router_marks_non_cascade_relations_as_protected_in_delete_preview() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        badge = DemoBadgeORM(title="VIP", user=user)
        session.add_all([user, badge])
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/1/delete-preview/")

        assert response.status_code == 200
        payload = response.json()
        assert payload["can_delete"] is False
        assert payload["summary"] == {"roots": 1, "delete": 0, "protect": 1, "set_null": 0, "total": 2}
        assert payload["roots"][0]["children"][0]["model_slug"] == "badges"
        assert payload["roots"][0]["children"][0]["effect"] == "protect"


async def test_router_marks_required_non_cascade_relations_as_protected_in_delete_preview() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        user.tasks.append(DemoTaskORM(title="Follow-up"))
        session.add(user)
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/1/delete-preview/")

        assert response.status_code == 200
        payload = response.json()
        assert payload["can_delete"] is False
        assert payload["summary"] == {"roots": 1, "delete": 0, "protect": 1, "set_null": 0, "total": 2}
        assert payload["roots"][0]["children"][0]["model_slug"] == "tasks"
        assert payload["roots"][0]["children"][0]["effect"] == "protect"


async def test_router_blocks_delete_for_required_non_cascade_relations() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        user.tasks.append(DemoTaskORM(title="Follow-up"))
        session.add(user)
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.delete("/xladmin/models/users/items/1/")

        assert response.status_code == 409

    async with session_factory() as session:
        assert len(list((await session.execute(select(DemoUserORM))).scalars())) == 1
        assert len(list((await session.execute(select(DemoTaskORM))).scalars())) == 1


async def test_router_detects_reverse_foreign_keys_without_parent_relationships() -> None:
    app, session_factory = await build_test_app()
    await _seed_owned_project_tree(session_factory)

    async with get_test_client(app) as client:
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


async def test_router_blocks_delete_for_reverse_foreign_keys_without_parent_relationships() -> None:
    app, session_factory = await build_test_app()
    await _seed_owned_project_tree(session_factory)

    async with get_test_client(app) as client:
        response = await client.delete("/xladmin/models/users/items/1/")

        assert response.status_code == 409

    async with session_factory() as session:
        assert len(list((await session.execute(select(DemoUserORM))).scalars())) == 1
        assert len(list((await session.execute(select(DemoOwnedProjectORM))).scalars())) == 1
        assert len(list((await session.execute(select(DemoOwnedBoardORM))).scalars())) == 1


async def test_router_handles_related_models_with_non_default_primary_key() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        user = DemoUserORM(username="owner", password="hashed::1")
        session.add(user)
        await session.flush()
        session.add(DemoTokenProfileORM(tokenprofile_ptr_id="profile-1", title="Profile", user_id=user.id))
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/1/delete-preview/")

        assert response.status_code == 200
        payload = response.json()
        assert payload["can_delete"] is False
        related_slugs = [child["model_slug"] for child in payload["roots"][0]["children"]]
        assert "token-profiles" in related_slugs


async def test_router_handles_related_models_with_aliased_column_name() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        message = DemoAliasedMessageORM(id="message-1")
        session.add(message)
        await session.flush()
        session.add(DemoAliasedChatORM(id="chat-1", last_branch_message_id=message.id))
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/aliased-messages/items/message-1/delete-preview/")

        assert response.status_code == 200
        payload = response.json()
        assert payload["can_delete"] is False
        assert payload["summary"] == {"roots": 1, "delete": 0, "protect": 1, "set_null": 0, "total": 2}
        assert payload["roots"][0]["children"][0]["model_slug"] == "aliased-chats"


async def test_router_marks_ondelete_set_null_relations_in_delete_preview() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        user = DemoSoftUserORM(username="alpha")
        session.add(user)
        await session.flush()
        session.add(DemoSoftNoteORM(body="note", user_id=user.id))
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/soft-users/items/1/delete-preview/")

        assert response.status_code == 200
        payload = response.json()
        assert payload["can_delete"] is True
        assert payload["summary"] == {"roots": 1, "delete": 0, "protect": 0, "set_null": 1, "total": 2}
        assert payload["roots"][0]["children"][0]["model_slug"] == "soft-notes"
        assert payload["roots"][0]["children"][0]["effect"] == "set-null"


async def test_router_applies_set_null_before_delete() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        user = DemoSoftUserORM(username="alpha")
        session.add(user)
        await session.flush()
        session.add(DemoSoftNoteORM(body="note", user_id=user.id))
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.delete("/xladmin/models/soft-users/items/1/")

        assert response.status_code == 204

    async with session_factory() as session:
        assert len(list((await session.execute(select(DemoSoftUserORM))).scalars())) == 0
        note = (await session.execute(select(DemoSoftNoteORM))).scalar_one()
        assert note.user_id is None


async def test_router_marks_ondelete_cascade_relations_as_delete() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        parent = DemoHardParentORM(title="parent")
        session.add(parent)
        await session.flush()
        session.add(DemoHardChildORM(title="child", parent_id=parent.id))
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/hard-parents/items/1/delete-preview/")

        assert response.status_code == 200
        payload = response.json()
        assert payload["can_delete"] is True
        assert payload["summary"] == {"roots": 1, "delete": 1, "protect": 0, "set_null": 0, "total": 2}
        assert payload["roots"][0]["children"][0]["model_slug"] == "hard-children"
        assert payload["roots"][0]["children"][0]["effect"] == "delete"


async def test_router_deletes_ondelete_cascade_relations() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        parent = DemoHardParentORM(title="parent")
        session.add(parent)
        await session.flush()
        session.add(DemoHardChildORM(title="child", parent_id=parent.id))
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.delete("/xladmin/models/hard-parents/items/1/")

        assert response.status_code == 204

    async with session_factory() as session:
        assert len(list((await session.execute(select(DemoHardParentORM))).scalars())) == 0
        assert len(list((await session.execute(select(DemoHardChildORM))).scalars())) == 0


async def test_router_builds_delete_preview_with_multiple_cascade_branches() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        post = DemoPostORM(title="Welcome", user=user)
        post.comments.append(DemoCommentORM(body="First"))
        user.secrets.append(DemoSecretORM(code_name="vault"))
        session.add(user)
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/1/delete-preview/")

        assert response.status_code == 200
        payload = response.json()
        assert payload["can_delete"] is True
        assert payload["summary"] == {"roots": 1, "delete": 3, "protect": 0, "set_null": 0, "total": 4}
        child_model_slugs = [child["model_slug"] for child in payload["roots"][0]["children"]]
        assert "posts" in child_model_slugs
        assert None in child_model_slugs


async def test_router_uses_fallback_label_for_unregistered_related_model_in_delete_preview() -> None:
    app, session_factory = await build_test_app()

    async with session_factory() as session:
        user = DemoUserORM(username="alpha", password="hashed::1")
        user.secrets.append(DemoSecretORM(code_name="vault"))
        session.add(user)
        await session.commit()

    async with get_test_client(app) as client:
        response = await client.get("/xladmin/models/users/items/1/delete-preview/")

        assert response.status_code == 200
        payload = response.json()
        secret_node = payload["roots"][0]["children"][0]
        assert secret_node["model_slug"] is None
        assert secret_node["model_title"] == "DemoSecretORM"
        assert secret_node["label"] == "vault"
