from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
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
NodeKey = tuple[type[Any], Any]
_DEPENDENT_RELATIONS_CACHE: dict[type[Any], list[_DependentRelation]] = {}


async def build_delete_plan(
        session: AsyncSession,
        registry: Registry,
        model_config: ModelConfig,
        items: list[Any],
) -> tuple[dict[str, Any], list[Any], list[tuple[Any, list[str]]]]:
    ordered_items: list[Any] = []
    ordered_keys: set[NodeKey] = set()
    set_null_items: list[tuple[Any, list[str]]] = []
    set_null_index: dict[NodeKey, int] = {}
    edges_by_parent = await _build_dependency_graph(
        session=session,
        registry=registry,
        root_model_config=model_config,
        root_items=items,
        set_null_items=set_null_items,
        set_null_index=set_null_index,
    )
    roots = [
        _build_preview_node(
            registry=registry,
            model_config=model_config,
            item=item,
            relation_name=None,
            effect="delete",
            path_seen=set(),
            edges_by_parent=edges_by_parent,
            ordered_items=ordered_items,
            ordered_keys=ordered_keys,
        )
        for item in items
    ]
    counts = _count_effects(roots)
    preview = {
        "can_delete": counts["protect"] == 0,
        "summary": {
            "roots": len(roots),
            "delete": counts["delete"],
            "protect": counts["protect"],
            "set_null": counts["set-null"],
            "total": len(roots) + counts["delete"] + counts["protect"] + counts["set-null"],
        },
        "roots": roots,
    }
    return preview, ordered_items, set_null_items


async def build_delete_preview(
        session: AsyncSession,
        registry: Registry,
        model_config: ModelConfig,
        items: list[Any],
) -> dict[str, Any]:
    preview, _ordered_items, _set_null_items = await build_delete_plan(session, registry, model_config, items)
    return preview


async def _build_dependency_graph(
        *,
        session: AsyncSession,
        registry: Registry,
        root_model_config: ModelConfig,
        root_items: list[Any],
        set_null_items: list[tuple[Any, list[str]]],
        set_null_index: dict[NodeKey, int],
) -> dict[NodeKey, list[_PreviewEdge]]:
    edges_by_parent: dict[NodeKey, list[_PreviewEdge]] = defaultdict(list)
    expanded_keys: set[NodeKey] = set()
    pending_groups: dict[str, tuple[ModelConfig, list[Any]]] = {}
    _append_pending_items(pending_groups, root_model_config, root_items)

    while pending_groups:
        current_groups = pending_groups
        pending_groups = {}

        for current_model_config, current_items in current_groups.values():
            items_to_expand = [
                item
                for item in current_items
                if (current_model_config.model, get_pk_value(current_model_config, item)) not in expanded_keys
            ]
            if not items_to_expand:
                continue

            parent_ids = [get_pk_value(current_model_config, item) for item in items_to_expand]
            parent_id_set = set(parent_ids)
            for item in items_to_expand:
                expanded_keys.add((current_model_config.model, get_pk_value(current_model_config, item)))

            for dependent_relation in _iter_dependent_relations(current_model_config.model):
                related_items = await _fetch_dependent_items(session, dependent_relation, parent_id_set)
                related_config = registry.find_by_model(dependent_relation.model)

                for related_item in related_items:
                    matching_parent_ids = _resolve_matching_parent_ids(
                        related_item,
                        dependent_relation.attribute_names,
                        parent_id_set,
                    )
                    if not matching_parent_ids:
                        continue

                    preview_edge = _build_preview_edge(
                        registry=registry,
                        model_config=related_config,
                        related_item=related_item,
                        dependent_relation=dependent_relation,
                    )
                    for parent_id in matching_parent_ids:
                        parent_key = (current_model_config.model, parent_id)
                        edges_by_parent[parent_key].append(preview_edge)

                    if related_config is None:
                        continue
                    if dependent_relation.effect == "set-null":
                        _append_set_null_item(
                            set_null_items,
                            set_null_index,
                            related_item,
                            dependent_relation.attribute_names,
                        )
                        continue
                    _append_pending_items(pending_groups, related_config, [related_item])

    return dict(edges_by_parent)


def _build_preview_edge(
        *,
        registry: Registry,
        model_config: ModelConfig | None,
        related_item: Any,
        dependent_relation: _DependentRelation,
) -> _PreviewEdge:
    if model_config is None:
        return _PreviewEdge(
            relation_name=dependent_relation.relation_name,
            effect=dependent_relation.effect,
            model_config=None,
            item=related_item,
            model_title=dependent_relation.model.__name__,
            label=_get_fallback_label(related_item),
        )

    return _PreviewEdge(
        relation_name=dependent_relation.relation_name,
        effect=dependent_relation.effect,
        model_config=model_config,
        item=related_item,
        model_title=_get_model_title(model_config),
        label=get_display_value(model_config, related_item),
    )


def _append_pending_items(
        pending_groups: dict[str, tuple[ModelConfig, list[Any]]],
        model_config: ModelConfig,
        items: list[Any],
) -> None:
    if not items:
        return
    slug = model_config.slug
    if slug is None:
        raise ValueError(f"Model '{model_config.model.__name__}' must have a resolved slug.")
    existing = pending_groups.get(slug)
    if existing is None:
        pending_groups[slug] = (model_config, list(items))
        return
    existing[1].extend(items)


def _append_set_null_item(
        set_null_items: list[tuple[Any, list[str]]],
        set_null_index: dict[NodeKey, int],
        item: Any,
        attribute_names: list[str],
) -> None:
    item_key = (type(item), _get_raw_pk_value(item))
    existing_index = set_null_index.get(item_key)
    if existing_index is None:
        set_null_index[item_key] = len(set_null_items)
        set_null_items.append((item, list(attribute_names)))
        return

    existing_attributes = set_null_items[existing_index][1]
    for attribute_name in attribute_names:
        if attribute_name not in existing_attributes:
            existing_attributes.append(attribute_name)


async def _fetch_dependent_items(
        session: AsyncSession,
        dependent_relation: _DependentRelation,
        parent_ids: set[Any],
) -> list[Any]:
    if not parent_ids:
        return []
    return list((await session.execute(_build_dependent_query(parent_ids, dependent_relation))).scalars().unique())


def _build_dependent_query(parent_ids: set[Any], dependent_relation: _DependentRelation) -> Any:
    return select(dependent_relation.model).where(
        or_(
            *[
                getattr(dependent_relation.model, attribute_name).in_(parent_ids)
                for attribute_name in dependent_relation.attribute_names
            ]
        ),
    )


def _resolve_matching_parent_ids(item: Any, attribute_names: list[str], parent_ids: set[Any]) -> list[Any]:
    matching_parent_ids: list[Any] = []
    for attribute_name in attribute_names:
        parent_id = getattr(item, attribute_name, None)
        if parent_id in parent_ids and parent_id not in matching_parent_ids:
            matching_parent_ids.append(parent_id)
    return matching_parent_ids


def _build_preview_node(
        *,
        registry: Registry,
        model_config: ModelConfig,
        item: Any,
        relation_name: str | None,
        effect: DeleteEffect,
        path_seen: set[NodeKey],
        edges_by_parent: dict[NodeKey, list[_PreviewEdge]],
        ordered_items: list[Any],
        ordered_keys: set[NodeKey],
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
    for edge in edges_by_parent.get(node_key, []):
        if edge.model_config is None:
            children.append(
                _build_node_payload(
                    model_slug=None,
                    model_title=edge.model_title,
                    relation_name=edge.relation_name,
                    item_id=_get_raw_pk_value(edge.item),
                    label=edge.label,
                    children=[],
                    effect=edge.effect,
                ),
            )
            continue

        if edge.effect == "set-null":
            children.append(
                _build_node_payload(
                    model_slug=edge.model_config.slug,
                    model_title=edge.model_title,
                    relation_name=edge.relation_name,
                    item_id=get_pk_value(edge.model_config, edge.item),
                    label=edge.label,
                    children=[],
                    effect="set-null",
                ),
            )
            continue

        children.append(
            _build_preview_node(
                registry=registry,
                model_config=edge.model_config,
                item=edge.item,
                relation_name=edge.relation_name,
                effect=edge.effect,
                path_seen=next_path_seen,
                edges_by_parent=edges_by_parent,
                ordered_items=ordered_items,
                ordered_keys=ordered_keys,
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


def _iter_dependent_relations(model: type[Any]) -> list[_DependentRelation]:
    cached_relations = _DEPENDENT_RELATIONS_CACHE.get(model)
    if cached_relations is not None:
        return cached_relations

    mapper = sa_inspect(model)
    pk_column = mapper.primary_key[0]
    relations: list[_DependentRelation] = []

    for candidate_mapper in mapper.registry.mappers:
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

        relations.append(
            _DependentRelation(
                model=candidate_model,
                relation_name=", ".join(column.key for column in columns),
                columns=columns,
                attribute_names=[_get_attribute_name_for_column(candidate_mapper, column) for column in columns],
                effect=_resolve_dependent_effect(model, candidate_model, columns),
            ),
        )

    _DEPENDENT_RELATIONS_CACHE[model] = relations
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


@dataclass(slots=True)
class _DependentRelation:
    model: type[Any]
    relation_name: str
    columns: list[Any]
    attribute_names: list[str]
    effect: DeleteEffect


@dataclass(slots=True)
class _PreviewEdge:
    relation_name: str | None
    effect: DeleteEffect
    model_config: ModelConfig | None
    item: Any
    model_title: str
    label: str
