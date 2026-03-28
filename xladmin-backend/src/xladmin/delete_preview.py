from __future__ import annotations

from typing import Any, Literal

from sqlalchemy import inspect as sa_inspect
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import RelationshipDirection

from xladmin.config import ModelConfig
from xladmin.introspection import get_display_value, get_pk_value
from xladmin.registry import Registry
from xladmin.serializer import serialize_scalar

DeleteEffect = Literal["delete", "protect", "set-null"]


async def build_delete_plan(
        session: AsyncSession,
        registry: Registry,
        model_config: ModelConfig,
        items: list[Any],
) -> tuple[dict[str, Any], list[Any], list[tuple[Any, list[str]]]]:
    ordered_items: list[Any] = []
    ordered_keys: set[tuple[type[Any], Any]] = set()
    set_null_items: list[tuple[Any, list[str]]] = []
    set_null_keys: set[tuple[type[Any], Any]] = set()
    roots = [
        await _build_preview_node(
            session=session,
            registry=registry,
            model_config=model_config,
            item=item,
            relation_name=None,
            path_seen=set(),
            ordered_items=ordered_items,
            ordered_keys=ordered_keys,
            set_null_items=set_null_items,
            set_null_keys=set_null_keys,
            effect="delete",
        )
        for item in items
    ]
    counts = _count_effects(roots)

    return {
        "can_delete": counts["protect"] == 0,
        "summary": {
            "roots": len(roots),
            "delete": counts["delete"],
            "protect": counts["protect"],
            "set_null": counts["set-null"],
            "total": len(roots) + counts["delete"] + counts["protect"] + counts["set-null"],
        },
        "roots": roots,
    }, ordered_items, set_null_items


async def build_delete_preview(
        session: AsyncSession,
        registry: Registry,
        model_config: ModelConfig,
        items: list[Any],
) -> dict[str, Any]:
    preview, _ordered_items, _set_null_items = await build_delete_plan(session, registry, model_config, items)
    return preview


async def _build_preview_node(
        session: AsyncSession,
        registry: Registry,
        model_config: ModelConfig,
        item: Any,
        relation_name: str | None,
        path_seen: set[tuple[type[Any], Any]],
        ordered_items: list[Any],
        ordered_keys: set[tuple[type[Any], Any]],
        set_null_items: list[tuple[Any, list[str]]],
        set_null_keys: set[tuple[type[Any], Any]],
        effect: DeleteEffect,
) -> dict[str, Any]:
    item_id = get_pk_value(model_config, item)
    node_key = (type(item), item_id)
    if node_key in path_seen:
        return _build_node_payload(
            model_slug=model_config.slug,
            model_title=_get_model_title(model_config),
            relation_name=relation_name,
            item_id=item_id,
            label=get_display_value(model_config, item),
            children=[],
            effect=effect,
        )

    next_path_seen = set(path_seen)
    next_path_seen.add(node_key)

    children: list[dict[str, Any]] = []

    for dependent_relation in _iter_dependent_relations(model_config.model):
        related_config = registry.find_by_model(dependent_relation.model)
        related_items = list((await session.execute(_build_dependent_query(item_id, dependent_relation))).scalars())
        for related_item in related_items:
            if related_config is None:
                children.append(
                    _build_node_payload(
                        model_slug=None,
                        model_title=dependent_relation.model.__name__,
                        relation_name=dependent_relation.relation_name,
                        item_id=_get_raw_pk_value(related_item),
                        label=_get_fallback_label(related_item),
                        children=[],
                        effect=dependent_relation.effect,
                    ),
                )
                continue

            if dependent_relation.effect == "set-null":
                related_key = (type(related_item), _get_raw_pk_value(related_item))
                if related_key not in set_null_keys:
                    set_null_items.append((related_item, dependent_relation.attribute_names))
                    set_null_keys.add(related_key)
                children.append(
                    _build_node_payload(
                        model_slug=related_config.slug,
                        model_title=_get_model_title(related_config),
                        relation_name=dependent_relation.relation_name,
                        item_id=get_pk_value(related_config, related_item),
                        label=get_display_value(related_config, related_item),
                        children=[],
                        effect="set-null",
                    ),
                )
                continue

            children.append(
                await _build_preview_node(
                    session=session,
                    registry=registry,
                    model_config=related_config,
                    item=related_item,
                    relation_name=dependent_relation.relation_name,
                    path_seen=next_path_seen,
                    ordered_items=ordered_items,
                    ordered_keys=ordered_keys,
                    set_null_items=set_null_items,
                    set_null_keys=set_null_keys,
                    effect=dependent_relation.effect,
                ),
            )

    if effect == "delete" and node_key not in ordered_keys:
        ordered_items.append(item)
        ordered_keys.add(node_key)

    return _build_node_payload(
        model_slug=model_config.slug,
        model_title=_get_model_title(model_config),
        relation_name=relation_name,
        item_id=item_id,
        label=get_display_value(model_config, item),
        children=children,
        effect=effect,
    )


def _build_dependent_query(item_id: Any, dependent_relation: _DependentRelation):
    return select(dependent_relation.model).where(
        or_(*[
            getattr(dependent_relation.model, attribute_name) == item_id
            for attribute_name in dependent_relation.attribute_names
        ]),
    )


def _iter_dependent_relations(model: type[Any]) -> list[_DependentRelation]:
    mapper = sa_inspect(model)
    pk_column = mapper.primary_key[0]
    relations: list[_DependentRelation] = []

    for candidate_mapper in model.registry.mappers:
        candidate_model = candidate_mapper.class_
        if candidate_model is model:
            continue

        columns = [
            column
            for column in candidate_mapper.columns
            if any(
                foreign_key.column.table is pk_column.table and foreign_key.column.key == pk_column.key
                for foreign_key in column.foreign_keys
            )
        ]
        if not columns:
            continue
        attribute_names = [_get_attribute_name_for_column(candidate_mapper, column) for column in columns]

        relations.append(
            _DependentRelation(
                model=candidate_model,
                relation_name=", ".join(column.key for column in columns),
                columns=columns,
                attribute_names=attribute_names,
                effect=_resolve_dependent_effect(model, candidate_model, columns),
            ),
        )

    return relations


def _resolve_dependent_effect(
        parent_model: type[Any],
        candidate_model: type[Any],
        columns: list[Any],
) -> DeleteEffect:
    relationship_effect = _get_relationship_effect(parent_model, candidate_model, columns)
    if relationship_effect is not None:
        return relationship_effect
    if any(_column_has_ondelete(column, "CASCADE") for column in columns):
        return "delete"
    if any(_column_has_ondelete(column, "SET NULL") for column in columns):
        return "set-null"
    return "protect"


def _get_relationship_effect(
        parent_model: type[Any],
        candidate_model: type[Any],
        columns: list[Any],
) -> DeleteEffect | None:
    parent_mapper = sa_inspect(parent_model)
    column_keys = {column.key for column in columns}

    for relationship in parent_mapper.relationships:
        if relationship.mapper.class_ is not candidate_model:
            continue
        if relationship.secondary is not None or relationship.viewonly:
            continue
        if relationship.direction is not RelationshipDirection.ONETOMANY:
            continue

        relationship_column_keys = {remote.key for _local, remote in relationship.local_remote_pairs}
        if relationship_column_keys and not relationship_column_keys.issubset(column_keys):
            continue
        if _relationship_cascades_delete(relationship.cascade):
            return "delete"

    return None


def _relationship_cascades_delete(cascade: Any) -> bool:
    return bool(getattr(cascade, "delete", False) or getattr(cascade, "delete_orphan", False))


def _column_has_ondelete(column: Any, value: str) -> bool:
    return any(
        isinstance(getattr(foreign_key, "ondelete", None), str) and foreign_key.ondelete.upper() == value
        for foreign_key in column.foreign_keys
    )


def _get_attribute_name_for_column(candidate_mapper: Any, column: Any) -> str:
    return candidate_mapper.get_property_by_column(column).key


def _count_effects(roots: list[dict[str, Any]]) -> dict[DeleteEffect, int]:
    counts: dict[DeleteEffect, int] = {"delete": 0, "protect": 0, "set-null": 0}
    for root in roots:
        for child in root.get("children", []):
            _accumulate_effects(child, counts)
    return counts


def _accumulate_effects(node: dict[str, Any], counts: dict[DeleteEffect, int]) -> None:
    effect = node.get("effect", "delete")
    counts[effect] += 1
    for child in node.get("children", []):
        _accumulate_effects(child, counts)


def _build_node_payload(
        *,
        model_slug: str | None,
        model_title: str,
        relation_name: str | None,
        item_id: Any,
        label: str,
        children: list[dict[str, Any]],
        effect: DeleteEffect,
) -> dict[str, Any]:
    return {
        "model_slug": model_slug,
        "model_title": model_title,
        "relation_name": relation_name,
        "id": serialize_scalar(item_id),
        "label": label,
        "effect": effect,
        "children": children,
    }


def _get_raw_pk_value(item: Any) -> Any:
    mapper = sa_inspect(type(item))
    pk_column = mapper.primary_key[0]
    return getattr(item, pk_column.key)


def _get_fallback_label(item: Any) -> str:
    item_id = serialize_scalar(_get_raw_pk_value(item))
    for candidate in ("name", "title", "username", "slug", "email", "code_name"):
        if hasattr(item, candidate):
            raw_value = getattr(item, candidate)
            if raw_value is not None:
                return str(raw_value)
    return f"{type(item).__name__} #{item_id}"


def _get_model_title(model_config: ModelConfig) -> str:
    return model_config.title or model_config.slug or model_config.model.__name__


class _DependentRelation:
    def __init__(
            self,
            *,
            model: type[Any],
            relation_name: str,
            columns: list[Any],
            attribute_names: list[str],
            effect: DeleteEffect,
    ) -> None:
        self.model = model
        self.relation_name = relation_name
        self.columns = columns
        self.attribute_names = attribute_names
        self.effect = effect
