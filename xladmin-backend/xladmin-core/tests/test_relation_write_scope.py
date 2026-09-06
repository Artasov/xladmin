"""Relationship writes must obey the same scope as relation choices."""

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Column, ForeignKey, Table, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from xladmin import AdminConfig, AdminHTTPConfig, FieldConfig, ModelConfig, create_admin_router


class Base(DeclarativeBase):
    pass


links = Table("scope_links", Base.metadata,
              Column("record_id", ForeignKey("scope_records.id"), primary_key=True),
              Column("target_id", ForeignKey("scope_targets.id"), primary_key=True))


class Target(Base):
    __tablename__ = "scope_targets"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int]
    name: Mapped[str]


class Record(Base):
    __tablename__ = "scope_records"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str]
    target_id: Mapped[int | None] = mapped_column(ForeignKey("scope_targets.id"))
    target: Mapped[Target | None] = relationship()
    targets: Mapped[list[Target]] = relationship(secondary=links)


@pytest.fixture
async def scope_case():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with factory() as session:
        session.add_all([Target(id=1, tenant_id=10, name="Visible"), Target(id=2, tenant_id=20, name="Hidden"),
                         Record(id=1, title="Original", target_id=1)])
        await session.commit()

    async def database():
        async with factory() as session:
            # A cached foreign row must not bypass the configured query scope.
            hidden = await session.get(Target, 2)
            yield session
            assert hidden is not None

    async def user():
        return SimpleNamespace(tenant_id=10)

    async def targets_scope(query, _session, viewer):
        return query.where(Target.tenant_id == viewer.tenant_id)

    registry = AdminConfig(models=(
        ModelConfig(model=Target, slug="targets", display_field="name", query_for_list=targets_scope),
        ModelConfig(model=Record, slug="records", list_display=("id", "title", "target_id"),
                    create_fields=("title", "target_id", "target", "targets"),
                    update_fields=("title", "target_id", "target", "targets"), fields={
            "target_id": FieldConfig(relation_model=Target),
            "target": FieldConfig(relation_model=Target),
            "targets": FieldConfig(relation_model=Target),
        }),
    ))
    app = FastAPI()
    app.include_router(create_admin_router(AdminHTTPConfig(
        registry=registry, get_db_session_dependency=database,
        get_current_user_dependency=user, is_allowed=lambda _user: True,
    )))
    try:
        async with AsyncClient(transport=ASGITransport(app), base_url="http://test") as client:
            yield client, factory
    finally:
        await engine.dispose()


@pytest.mark.parametrize("field", ["target_id", "target", "targets"])
@pytest.mark.parametrize("method", ["POST", "PATCH"])
@pytest.mark.parametrize("target_id", [1, 2, 999])
async def test_create_and_patch_use_relation_scope(scope_case, field, method, target_id):
    client, factory = scope_case
    choices = await client.get(f"/xladmin/models/records/fields/{field}/choices/", params={"ids": "2"})
    assert choices.status_code == 200
    assert [row["id"] for row in choices.json()["items"]] == [1]
    payload = {"title": "Changed", field: [1, target_id] if field == "targets" else target_id}
    url = "/xladmin/models/records/items/" if method == "POST" else "/xladmin/models/records/items/1/"
    response = await client.request(method, url, json=payload)
    assert response.status_code == ((201 if method == "POST" else 200) if target_id == 1 else 400), response.text
    async with factory() as session:
        rows = list(await session.scalars(select(Record).order_by(Record.id)))
        if target_id != 1:
            assert [(row.id, row.title, row.target_id) for row in rows] == [(1, "Original", 1)]
            assert list(await session.execute(select(links))) == []
        else:
            assert rows[-1].title == "Changed"
            if field == "targets":
                assert list(await session.execute(select(links))) == [(rows[-1].id, 1)]
            else:
                assert rows[-1].target_id == 1
