from __future__ import annotations

from typing import Any

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.ext.asyncio import AsyncSession

from xladmin.config import ModelConfig
from xladmin.introspection import get_display_value, get_pk_value
from xladmin.registry import Registry
from xladmin.serializer import serialize_scalar


async def build_delete_preview(
        session: AsyncSession,
        registry: Registry,
        model_config: ModelConfig,
        items: list[Any],
) -> dict[str, Any]:
    roots = [
        await _build_preview_node(
            session=session,
            registry=registry,
            model_config=model_config,
            item=item,
            relation_name=None,
            path_seen=set(),
        )
        for item in items
    ]
    related_count = sum(_count_related_children(root) for root in roots)

    return {
        "summary": {
            "roots": len(roots),
            "related": related_count,
            "total": len(roots) + related_count,
        },
        "roots": roots,
    }


async def _build_preview_node(
        session: AsyncSession,
        registry: Registry,
        model_config: ModelConfig,
        item: Any,
        relation_name: str | None,
        path_seen: set[tuple[type[Any], Any]],
) -> dict[str, Any]:
    item_id = get_pk_value(model_config, item)
    node_key = (type(item), item_id)
    if node_key in path_seen:
        return {
            "model_slug": model_config.slug,
            "model_title": model_config.title,
            "relation_name": relation_name,
            "id": serialize_scalar(item_id),
            "label": get_display_value(model_config, item),
            "children": [],
        }

    next_path_seen = set(path_seen)
    next_path_seen.add(node_key)

    mapper = sa_inspect(model_config.model)
    children: list[dict[str, Any]] = []

    for relationship in mapper.relationships:
        if not _relationship_cascades_delete(relationship.cascade):
            continue

        await session.refresh(item, attribute_names=[relationship.key])
        related_value = getattr(item, relationship.key)
        if related_value is None:
            continue

        related_items = list(related_value) if relationship.uselist else [related_value]
        related_config = registry.find_by_model(relationship.mapper.class_)
        for related_item in related_items:
            if related_config is None:
                children.append(
                    {
                        "model_slug": None,
                        "model_title": relationship.mapper.class_.__name__,
                        "relation_name": relationship.key,
                        "id": serialize_scalar(_get_raw_pk_value(related_item)),
                        "label": _get_fallback_label(related_item),
                        "children": [],
                    },
                )
                continue

            children.append(
                await _build_preview_node(
                    session=session,
                    registry=registry,
                    model_config=related_config,
                    item=related_item,
                    relation_name=relationship.key,
                    path_seen=next_path_seen,
                ),
            )

    return {
        "model_slug": model_config.slug,
        "model_title": model_config.title,
        "relation_name": relation_name,
        "id": serialize_scalar(item_id),
        "label": get_display_value(model_config, item),
        "children": children,
    }


def _relationship_cascades_delete(cascade: Any) -> bool:
    return bool(getattr(cascade, "delete", False) or getattr(cascade, "delete_orphan", False))


def _count_related_children(node: dict[str, Any]) -> int:
    children = node.get("children", [])
    return len(children) + sum(_count_related_children(child) for child in children)


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
