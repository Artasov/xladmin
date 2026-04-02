from __future__ import annotations

import pytest
from sqlalchemy import ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from xladmin import AdminConfig, AdminFieldConfig, AdminModelConfig, AdminRegistry, ModelConfig
from xladmin.introspection import get_model_meta, get_visible_list_fields


class Base(DeclarativeBase):
    pass


class DemoModel(Base):
    __tablename__ = "demo_model"

    id: Mapped[int] = mapped_column(primary_key=True)


class ModeAwareModel(Base):
    __tablename__ = "mode_aware_model"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column()
    password: Mapped[str] = mapped_column()


class OrderedParentModel(Base):
    __tablename__ = "ordered_parent_model"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column()
    children: Mapped[list[OrderedChildModel]] = relationship(back_populates="parent")


class OrderedChildModel(Base):
    __tablename__ = "ordered_child_model"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("ordered_parent_model.id"))
    parent: Mapped[OrderedParentModel] = relationship(back_populates="children")


def test_registry_stores_model_configs() -> None:
    registry = AdminRegistry(AdminModelConfig(model=DemoModel, slug="demo", title="Demo"))

    config = registry.get("demo")

    assert config.model is DemoModel
    assert config.title == "Demo"


def test_registry_builds_defaults_from_admin_config() -> None:
    registry = AdminRegistry(config=AdminConfig(models=(ModelConfig(model=DemoModel),)))

    config = registry.list()[0]

    assert config.model is DemoModel
    assert config.slug == "demo-model"
    assert config.title == "Demo Model"
    assert config.ordering == ("-id",)


def test_visible_list_fields_follow_model_declaration_order() -> None:
    config = ModelConfig(model=OrderedParentModel)

    assert get_visible_list_fields(config) == ["id", "title", "children"]


def test_model_meta_includes_display_kind() -> None:
    config = ModelConfig(
        model=DemoModel,
        fields={"id": AdminFieldConfig(display_kind="image", image_url_prefix="/media")},
    )

    meta = get_model_meta(config)
    field_meta = next(field for field in meta["fields"] if field["name"] == "id")

    assert field_meta["display_kind"] == "image"
    assert field_meta["image_url_prefix"] == "/media"


def test_model_meta_respects_create_and_update_visibility() -> None:
    config = ModelConfig(
        model=ModeAwareModel,
        fields={
            "password": AdminFieldConfig(
                input_kind="password",
                hidden_in_update=True,
            ),
            "new_password": AdminFieldConfig(
                input_kind="password",
                hidden_in_create=True,
                value_getter=lambda _instance: "",
                value_setter=lambda *_args: None,
            ),
        },
    )

    meta = get_model_meta(config)

    assert meta["create_fields"] == ["name", "password"]
    assert meta["update_fields"] == ["name", "new_password"]


def test_registry_requires_explicit_list_fields_for_implicit_relationships() -> None:
    with pytest.raises(ValueError) as exc_info:
        AdminRegistry(ModelConfig(model=OrderedParentModel))

    assert str(exc_info.value) == (
        "Model 'OrderedParentModel' uses relationship fields in the implicit list view "
        "(children). Set 'list_display' or 'list_fields' explicitly, or hide/override these fields "
        "with FieldConfig (for example hidden_in_list or value_getter)."
    )
