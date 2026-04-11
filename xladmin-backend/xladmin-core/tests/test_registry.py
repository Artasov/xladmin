from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from xladmin import (
    AdminBulkActionConfig,
    AdminConfig,
    AdminFieldConfig,
    AdminFormFieldConfig,
    AdminFormFieldOptionConfig,
    AdminModelConfig,
    AdminObjectActionConfig,
    AdminRegistry,
    ModelConfig,
)
from xladmin.introspection import get_model_meta, get_visible_list_fields
from xladmin.router import serialize_choice_id


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
    name_field = next(field for field in meta["fields"] if field["name"] == "name")
    password_field = next(field for field in meta["fields"] if field["name"] == "password")

    assert meta["create_fields"] == ["name", "password"]
    assert meta["update_fields"] == ["name", "new_password"]
    assert name_field["required"] is True
    assert password_field["required"] is True


def test_model_meta_auto_form_skips_uselist_and_duplicate_relationship_fields() -> None:
    child_meta = get_model_meta(ModelConfig(model=OrderedChildModel))
    parent_meta = get_model_meta(ModelConfig(model=OrderedParentModel))

    assert child_meta["create_fields"] == ["id", "parent_id"]
    assert child_meta["update_fields"] == ["parent_id"]
    assert parent_meta["create_fields"] == ["id", "title"]
    assert parent_meta["update_fields"] == ["title"]


def test_serialize_choice_id_converts_uuid_to_string() -> None:
    value = uuid4()

    assert serialize_choice_id(value) == str(value)


def test_registry_allows_custom_create_form_fields_with_create_handler() -> None:
    config = ModelConfig(
        model=DemoModel,
        create_form=(AdminFormFieldConfig(name="proxy"),),
        create_handler=lambda _session, _model_config, _payload, _user: DemoModel(id=1),
    )

    registry = AdminRegistry(config)

    assert registry.get("demo-model").create_form is not None


def test_registry_rejects_unknown_custom_create_form_fields_without_create_handler() -> None:
    with pytest.raises(ValueError) as exc_info:
        AdminRegistry(
            ModelConfig(
                model=DemoModel,
                create_form=(AdminFormFieldConfig(name="proxy"),),
            ),
        )

    assert str(exc_info.value) == (
        "Unknown field 'proxy' in create_form for model 'DemoModel'."
    )


def test_registry_rejects_duplicate_object_action_form_fields() -> None:
    with pytest.raises(ValueError) as exc_info:
        AdminRegistry(
            ModelConfig(
                model=DemoModel,
                object_actions=(
                    AdminObjectActionConfig(
                        slug="rename",
                        label="Rename",
                        form=(
                            AdminFormFieldConfig(name="value"),
                            AdminFormFieldConfig(name="value"),
                        ),
                        handler=lambda _session, _model_config, _item, _payload, _user: {},
                    ),
                ),
            ),
        )

    assert str(exc_info.value) == (
        "Duplicate field 'value' in object action 'rename' form for model 'DemoModel'."
    )


def test_registry_rejects_action_form_field_with_options_and_relation_model() -> None:
    with pytest.raises(ValueError) as exc_info:
        AdminRegistry(
            ModelConfig(
                model=DemoModel,
                bulk_actions=(
                    AdminBulkActionConfig(
                        slug="process",
                        label="Process",
                        form=(
                            AdminFormFieldConfig(
                                name="value",
                                options=(AdminFormFieldOptionConfig(value="x", label="X"),),
                                relation_model=DemoModel,
                            ),
                        ),
                        handler=lambda _session, _model_config, _items, _payload, _user: {},
                    ),
                ),
            ),
        )

    assert str(exc_info.value) == (
        "Field 'value' in bulk action 'process' form for model 'DemoModel' "
        "cannot define both options and relation_model."
    )


def test_registry_requires_relation_model_for_custom_relation_action_field() -> None:
    with pytest.raises(ValueError) as exc_info:
        AdminRegistry(
            ModelConfig(
                model=DemoModel,
                object_actions=(
                    AdminObjectActionConfig(
                        slug="assign",
                        label="Assign",
                        form=(
                            AdminFormFieldConfig(
                                name="role",
                                input_kind="relation",
                            ),
                        ),
                        handler=lambda _session, _model_config, _item, _payload, _user: {},
                    ),
                ),
            ),
        )

    assert str(exc_info.value) == (
        "Custom relation field 'role' in object action 'assign' form for model 'DemoModel' "
        "must define relation_model."
    )


def test_registry_requires_explicit_list_fields_for_implicit_relationships() -> None:
    with pytest.raises(ValueError) as exc_info:
        AdminRegistry(ModelConfig(model=OrderedParentModel))

    assert str(exc_info.value) == (
        "Model 'OrderedParentModel' uses relationship fields in the implicit list view "
        "(children). Set 'list_display' or 'list_fields' explicitly, or hide/override these fields "
        "with FieldConfig (for example hidden_in_list or value_getter)."
    )
