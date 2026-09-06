"""Read-only models reject writes and remain protected through parent deletion."""

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import ForeignKey, String, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from xladmin.config import AdminConfig, BulkActionConfig, HttpConfig, ModelConfig, ObjectActionConfig
from xladmin.router import create_router


class Base(DeclarativeBase):
    pass


class Parent(Base):
    __tablename__ = "readonly_parent"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))


class Ledger(Base):
    __tablename__ = "readonly_ledger"
    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey(Parent.id, ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80))


class Reference(Base):
    __tablename__ = "readonly_reference"
    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey(Parent.id, ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(80))


class ForbiddenHandler:
    @staticmethod
    def run(*args):
        raise AssertionError("A read-only model must not invoke write handlers")


@pytest.fixture
async def readonly_client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with factory() as session:
        session.add_all([Parent(id=1, name="parent"), Parent(id=2, name="empty parent")])
        await session.flush()
        session.add_all([Ledger(id=1, parent_id=1, name="posted"), Reference(id=1, parent_id=1, name="source")])
        await session.commit()

    async def database():
        async with factory() as session:
            yield session

    config = AdminConfig(models=(
        ModelConfig(Parent, slug="parents"),
        ModelConfig(Ledger, slug="ledger", read_only=True,
            create_fields=("name", "parent_id"), update_fields=("name", "parent_id"),
            create_handler=ForbiddenHandler.run,
            bulk_actions=(BulkActionConfig("change", "Change", ForbiddenHandler.run),),
            object_actions=(ObjectActionConfig("change", "Change", ForbiddenHandler.run),)),
        ModelConfig(Reference, slug="references", read_only=True),
    ))
    app = FastAPI()
    app.include_router(create_router(HttpConfig(
        registry=config, get_db_session_dependency=database,
        get_current_user_dependency=lambda: SimpleNamespace(is_admin=True), is_allowed=lambda user: user.is_admin,
    )))
    try:
        async with AsyncClient(transport=ASGITransport(app), base_url="http://test") as client:
            yield client, factory
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("method,path,payload", [
    ("POST", "items/", {"name": "new", "parent_id": 1}),
    ("PATCH", "items/1/", {"name": "changed"}),
    ("DELETE", "items/1/", None),
    ("POST", "bulk-delete/", {"ids": [1]}),
    ("POST", "bulk-delete/", {"select_all": True}),
    ("POST", "bulk-delete/", {"ids": []}),
    ("POST", "bulk-actions/delete/", {"ids": [1]}),
    ("POST", "bulk-actions/change/", {"ids": [1]}),
    ("POST", "items/1/actions/change/", {}),
])
async def test_read_only_rejects_every_mutation_before_handlers(readonly_client, method, path, payload):
    client, factory = readonly_client
    response = await client.request(method, f"/xladmin/models/ledger/{path}", json=payload)
    assert response.status_code == 403, response.text
    async with factory() as session:
        item = await session.get(Ledger, 1)
        assert item.name == "posted" and item.parent_id == 1
        assert await session.scalar(select(func.count(Ledger.id))) == 1


@pytest.mark.asyncio
async def test_read_metadata_and_preview_remain_available(readonly_client):
    client, factory = readonly_client
    listing = await client.get("/xladmin/models/ledger/items/")
    assert listing.status_code == 200
    meta = listing.json()["meta"]
    assert meta["read_only"] is True
    assert meta["bulk_actions"] == meta["object_actions"] == meta["create_fields"] == meta["update_fields"] == []
    assert all(field["read_only"] for field in meta["fields"])
    assert (await client.get("/xladmin/models/ledger/items/1/")).status_code == 200
    preview = await client.get("/xladmin/models/ledger/items/1/delete-preview/")
    assert preview.status_code == 200 and preview.json()["can_delete"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize("bulk", [False, True])
async def test_parent_delete_cannot_cascade_or_clear_read_only_references(readonly_client, bulk):
    client, factory = readonly_client
    preview = await client.get("/xladmin/models/parents/items/1/delete-preview/")
    assert preview.status_code == 200, preview.text
    data = preview.json()
    assert data["can_delete"] is False
    protected = {child["model_slug"] for child in data["roots"][0]["children"] if child["effect"] == "protect"}
    assert protected == {"ledger", "references"}
    response = (await client.post("/xladmin/models/parents/bulk-delete/", json={"ids": [1, 2]})
        if bulk else await client.delete("/xladmin/models/parents/items/1/"))
    assert response.status_code == 409, response.text
    async with factory() as session:
        assert await session.scalar(select(func.count(Parent.id))) == 2
        assert (await session.get(Ledger, 1)).parent_id == (await session.get(Reference, 1)).parent_id == 1


@pytest.mark.asyncio
async def test_writable_model_without_protected_dependents_still_supports_crud(readonly_client):
    client, factory = readonly_client
    created = await client.post("/xladmin/models/parents/items/", json={"id": 3, "name": "new"})
    assert created.status_code == 201, created.text
    identifier = created.json()["item"]["id"]
    updated = await client.patch(f"/xladmin/models/parents/items/{identifier}/", json={"name": "edited"})
    assert updated.status_code == 200
    assert (await client.delete(f"/xladmin/models/parents/items/{identifier}/")).status_code == 204
