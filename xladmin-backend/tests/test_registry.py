from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from xladmin import AdminModelConfig, AdminRegistry


class Base(DeclarativeBase):
    pass


class DemoModel(Base):
    __tablename__ = "demo_model"

    id: Mapped[int] = mapped_column(primary_key=True)


def test_registry_stores_model_configs() -> None:
    registry = AdminRegistry(AdminModelConfig(model=DemoModel, slug="demo", title="Demo"))

    config = registry.get("demo")

    assert config.model is DemoModel
    assert config.title == "Demo"
