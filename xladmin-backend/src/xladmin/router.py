from __future__ import annotations

import inspect
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect as sa_inspect
from sqlalchemy.orm import selectinload

from xladmin.config import HttpConfig, ModelConfig
from xladmin.delete_preview import build_delete_plan, build_delete_preview
from xladmin.i18n import translate
from xladmin.introspection import (
    convert_value_for_column,
    get_column_names,
    get_create_fields,
    get_model_blocks_meta,
    get_model_meta,
    get_pk_field_name,
    get_sort_column_name,
    get_update_fields,
)
from xladmin.registry import build_registry
from xladmin.serializer import serialize_model_instance


def create_router(config: HttpConfig) -> APIRouter:
    registry = build_registry(config.registry)
    router = APIRouter(prefix="/xladmin", tags=["XLAdmin"])
    model_meta_by_slug = {
        model_config.slug: get_model_meta(model_config, locale=registry.locale)
        for model_config in registry.list()
    }
    models_response = {
        "locale": registry.locale,
        "items": list(model_meta_by_slug.values()),
        "blocks": get_model_blocks_meta(registry),
    }

    def _check_access(user: Any) -> None:
        if not config.is_allowed(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=translate(registry.locale, "forbidden"))

    async def _get_model_config(slug: str) -> ModelConfig:
        try:
            return registry.get(slug)
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=translate(registry.locale, "admin_model_not_found"),
            ) from exc

    @router.get("/models/")
    async def list_models(user: Any = Depends(config.get_current_user_dependency)) -> dict[str, Any]:
        _check_access(user)
        return models_response

    @router.get("/models/{slug}/")
    async def get_model(
            slug: str,
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        _check_access(user)
        try:
            return model_meta_by_slug[slug]
        except KeyError:
            await _get_model_config(slug)
            raise

    @router.get("/models/{slug}/items/")
    async def list_items(
            slug: str,
            request: Request,
            limit: int = Query(default=50, ge=1, le=500),
            offset: int = Query(default=0, ge=0),
            q: str | None = None,
            sort: str | None = None,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        _check_access(user)
        model_config = await _get_model_config(slug)
        request_query_params = request.query_params if request is not None else {}
        list_filter_values: dict[str, str] = {}
        for list_filter in model_config.list_filters:
            raw_value = request_query_params.get(list_filter.slug)
            if raw_value in (None, ""):
                continue
            list_filter_values[list_filter.slug] = str(raw_value)
        query = select(model_config.model)
        if model_config.query_for_list is not None:
            custom_query = model_config.query_for_list(query, session, user)
            query = await custom_query if inspect.isawaitable(custom_query) else custom_query
        query = _apply_eager_loads(model_config, query)
        query = _apply_search(model_config, query, q, session)
        query = await _apply_list_filters(model_config, query, list_filter_values, session, user)
        query = _apply_ordering(model_config, query, sort)
        total_query = select(func.count()).select_from(query.subquery())
        total = int((await session.execute(total_query)).scalar_one())
        items = list((await session.execute(query.limit(limit).offset(offset))).scalars())
        return {
            "meta": model_meta_by_slug[model_config.slug],
            "pagination": {"limit": limit, "offset": offset, "total": total},
            "items": [serialize_model_instance(model_config, item, mode="list") for item in items],
        }

    @router.get("/models/{slug}/items/{item_id}/")
    async def get_item(
            slug: str,
            item_id: str,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        _check_access(user)
        model_config = await _get_model_config(slug)
        item = await _get_item_by_pk(session, model_config, item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=translate(registry.locale, "object_not_found"),
            )
        return {
            "meta": model_meta_by_slug[model_config.slug],
            "item": serialize_model_instance(model_config, item, mode="detail"),
        }

    @router.post("/models/{slug}/items/", status_code=status.HTTP_201_CREATED)
    async def create_item(
            slug: str,
            payload: dict[str, Any],
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        _check_access(user)
        model_config = await _get_model_config(slug)
        item = model_config.model()
        await _apply_payload_to_item(session, model_config, item, payload, mode="create")
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return {"item": serialize_model_instance(model_config, item, mode="detail")}

    @router.patch("/models/{slug}/items/{item_id}/")
    async def patch_item(
            slug: str,
            item_id: str,
            payload: dict[str, Any],
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        _check_access(user)
        model_config = await _get_model_config(slug)
        item = await _get_item_by_pk(session, model_config, item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=translate(registry.locale, "object_not_found"),
            )
        await _apply_payload_to_item(session, model_config, item, payload, mode="update")
        await session.commit()
        await session.refresh(item)
        return {"item": serialize_model_instance(model_config, item, mode="detail")}

    @router.get("/models/{slug}/items/{item_id}/delete-preview/")
    async def get_delete_preview(
            slug: str,
            item_id: str,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        _check_access(user)
        model_config = await _get_model_config(slug)
        item = await _get_item_by_pk(session, model_config, item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=translate(registry.locale, "object_not_found"),
            )
        return await build_delete_preview(session, registry, model_config, [item])

    @router.delete("/models/{slug}/items/{item_id}/", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_item(
            slug: str,
            item_id: str,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> Response:
        _check_access(user)
        model_config = await _get_model_config(slug)
        item = await _get_item_by_pk(session, model_config, item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=translate(registry.locale, "object_not_found"),
            )
        preview, delete_items, set_null_items = await build_delete_plan(session, registry, model_config, [item])
        if not preview["can_delete"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=translate(registry.locale, "delete_blocked"),
            )
        for related_item, attribute_names in set_null_items:
            for attribute_name in attribute_names:
                setattr(related_item, attribute_name, None)
        for related_delete_item in delete_items:
            await session.delete(related_delete_item)
        await session.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.post("/models/{slug}/items/{item_id}/actions/{action_slug}/")
    async def object_action(
            slug: str,
            item_id: str,
            action_slug: str,
            payload: dict[str, Any] | None = None,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        _check_access(user)
        model_config = await _get_model_config(slug)
        item = await _get_item_by_pk(session, model_config, item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=translate(registry.locale, "object_not_found"),
            )

        action = next((item for item in model_config.object_actions if item.slug == action_slug), None)
        if action is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=translate(registry.locale, "object_action_not_found"),
            )

        result = action.handler(session, model_config, item, payload or {}, user)
        if inspect.isawaitable(result):
            result = await result
        await session.commit()
        await session.refresh(item)
        item = await _get_item_by_pk(session, model_config, item_id)
        return {
            "item": serialize_model_instance(model_config, item, mode="detail"),
            "result": result or {},
        }

    @router.post("/models/{slug}/bulk-delete/")
    async def bulk_delete(
            slug: str,
            payload: dict[str, list[Any]],
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, int]:
        _check_access(user)
        model_config = await _get_model_config(slug)
        ids = payload.get("ids", [])
        if not ids:
            return {"deleted": 0}
        pk_attr = getattr(model_config.model, get_pk_field_name(model_config))
        query = select(model_config.model).where(pk_attr.in_([_convert_pk(item_id) for item_id in ids]))
        items = list((await session.execute(query)).scalars())
        preview, delete_items, set_null_items = await build_delete_plan(session, registry, model_config, items)
        if not preview["can_delete"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=translate(registry.locale, "delete_blocked"),
            )
        for related_item, attribute_names in set_null_items:
            for attribute_name in attribute_names:
                setattr(related_item, attribute_name, None)
        for item in delete_items:
            await session.delete(item)
        await session.commit()
        return {"deleted": len(items)}

    @router.post("/models/{slug}/bulk-delete-preview/")
    async def bulk_delete_preview(
            slug: str,
            payload: dict[str, list[Any]],
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        _check_access(user)
        model_config = await _get_model_config(slug)
        ids = payload.get("ids", [])
        if not ids:
            return {
                "can_delete": True,
                "summary": {"roots": 0, "delete": 0, "protect": 0, "set_null": 0, "total": 0},
                "roots": [],
            }
        pk_attr = getattr(model_config.model, get_pk_field_name(model_config))
        query = select(model_config.model).where(pk_attr.in_([_convert_pk(item_id) for item_id in ids]))
        items = list((await session.execute(_apply_eager_loads(model_config, query))).scalars())
        return await build_delete_preview(session, registry, model_config, items)

    @router.post("/models/{slug}/bulk-actions/{action_slug}/")
    async def bulk_action(
            slug: str,
            action_slug: str,
            payload: dict[str, Any],
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        _check_access(user)
        model_config = await _get_model_config(slug)
        ids = payload.get("ids", [])
        if not ids:
            return {"processed": 0}
        if action_slug == "delete":
            deleted_response = await bulk_delete(slug, {"ids": ids}, session, user)
            return {"processed": deleted_response["deleted"]}

        action = next((item for item in model_config.bulk_actions if item.slug == action_slug), None)
        if action is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=translate(registry.locale, "bulk_action_not_found"),
            )

        pk_attr = getattr(model_config.model, get_pk_field_name(model_config))
        query = select(model_config.model).where(pk_attr.in_([_convert_pk(item_id) for item_id in ids]))
        items = list((await session.execute(_apply_eager_loads(model_config, query))).scalars())
        result = action.handler(session, model_config, items, payload, user)
        if inspect.isawaitable(result):
            result = await result
        await session.commit()
        return {"processed": len(items), **(result or {})}

    @router.get("/models/{slug}/fields/{field_name}/choices/")
    async def field_choices(
            slug: str,
            field_name: str,
            q: str | None = None,
            ids: str | None = None,
            limit: int = Query(default=25, ge=1, le=100),
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        _check_access(user)
        model_config = await _get_model_config(slug)
        relation_model = _resolve_relation_model(model_config, field_name, locale=registry.locale)
        relation_config = registry.find_by_model(relation_model)
        label_field = (
                model_config.get_field_config(field_name).relation_label_field
                or _resolve_label_field(relation_model)
        )
        query = select(relation_model)
        relation_pk_name = sa_inspect(relation_model).primary_key[0].key
        selected_ids = [_convert_pk(item_id) for item_id in ids.split(",") if item_id] if ids else []

        if selected_ids:
            query = query.where(getattr(relation_model, relation_pk_name).in_(selected_ids))

        if q:
            if relation_config is not None:
                query = _apply_search(relation_config, query, q, session)
            elif hasattr(relation_model, label_field):
                query = query.where(getattr(relation_model, label_field).ilike(f"%{q}%"))

        items = list((await session.execute(query.limit(limit))).scalars())
        return {
            "items": [
                {
                    "id": getattr(item, relation_pk_name),
                    "label": str(getattr(item, label_field, None) or getattr(item, relation_pk_name)),
                }
                for item in items
            ],
        }

    @router.get("/models/{slug}/filters/{filter_slug}/choices/")
    async def filter_choices(
            slug: str,
            filter_slug: str,
            q: str | None = None,
            ids: str | None = None,
            limit: int = Query(default=25, ge=1, le=100),
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        _check_access(user)
        model_config = await _get_model_config(slug)
        list_filter = next((item for item in model_config.list_filters if item.slug == filter_slug), None)
        if list_filter is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=translate(registry.locale, "list_filter_not_found"),
            )

        input_kind = list_filter.input_kind or _resolve_list_filter_input_kind_for_meta(model_config, list_filter)
        if input_kind == "boolean":
            return {
                "items": [
                    {"id": "true", "label": translate(registry.locale, "yes")},
                    {"id": "false", "label": translate(registry.locale, "no")},
                ],
            }
        if list_filter.options:
            return {
                "items": [
                    {"id": option.value, "label": option.label}
                    for option in list_filter.options
                ],
            }

        relation_model = _resolve_list_filter_relation_model(model_config, list_filter, locale=registry.locale)
        if relation_model is None:
            return {"items": []}

        relation_config = registry.find_by_model(relation_model)
        label_field = list_filter.relation_label_field or _resolve_label_field(relation_model)
        query = select(relation_model)
        relation_pk_name = sa_inspect(relation_model).primary_key[0].key
        selected_ids = [_convert_pk(item_id) for item_id in ids.split(",") if item_id] if ids else []

        if relation_config is not None and relation_config.query_for_list is not None:
            custom_query = relation_config.query_for_list(query, session, user)
            query = await custom_query if inspect.isawaitable(custom_query) else custom_query

        if selected_ids:
            query = query.where(getattr(relation_model, relation_pk_name).in_(selected_ids))

        if q:
            if relation_config is not None:
                query = _apply_search(relation_config, query, q, session)
            elif hasattr(relation_model, label_field):
                query = query.where(getattr(relation_model, label_field).ilike(f"%{q}%"))

        if hasattr(relation_model, label_field):
            query = query.order_by(getattr(relation_model, label_field).asc())

        items = list((await session.execute(query.limit(limit))).scalars())
        return {
            "items": [
                {
                    "id": getattr(item, relation_pk_name),
                    "label": str(getattr(item, label_field, None) or getattr(item, relation_pk_name)),
                }
                for item in items
            ],
        }

    return router


async def _apply_payload_to_item(
        session: AsyncSession,
        model_config: ModelConfig,
        item: Any,
        payload: dict[str, Any],
        *,
        mode: str,
) -> None:
    mapper = sa_inspect(model_config.model)
    column_names = set(get_column_names(model_config))
    relationship_names = set(mapper.relationships.keys())
    allowed_fields = set(get_create_fields(model_config) if mode == "create" else get_update_fields(model_config))
    for field_name, raw_value in payload.items():
        if field_name not in allowed_fields:
            continue
        field_config = model_config.get_field_config(field_name)
        value = field_config.value_parser(raw_value) if field_config.value_parser is not None else raw_value

        if field_config.value_setter is not None:
            field_config.value_setter(item, value, payload, mode)
            continue

        if field_name in relationship_names:
            await _assign_relationship_value(session, model_config, item, field_name, value)
            continue

        if field_name not in column_names:
            continue

        column = mapper.columns[field_name]
        setattr(item, field_name, convert_value_for_column(column, value))


def _apply_ordering(model_config: ModelConfig, query, sort: str | None = None):
    ordering_items = (
        [item.strip() for item in (sort or "").split(",") if item.strip()]
        if sort
        else list(model_config.ordering)
    )
    if not ordering_items:
        return query

    for item in ordering_items:
        descending = item.startswith("-")
        field_name = item[1:] if descending else item
        sort_column_name = get_sort_column_name(model_config, field_name)
        if sort_column_name is None:
            continue
        column = getattr(model_config.model, sort_column_name)
        query = query.order_by(column.desc() if descending else column.asc())
    return query


def _apply_search(model_config: ModelConfig, query, q: str | None, session: AsyncSession):
    if not q:
        return query
    if model_config.search_query_builder is not None:
        return model_config.search_query_builder(query, q, session)
    search_fields = model_config.search_fields or tuple(
        column_name
        for column_name, column in sa_inspect(model_config.model).columns.items()
        if getattr(column.type, "python_type", None) is str
    )
    conditions = [getattr(model_config.model, field_name).ilike(f"%{q}%") for field_name in search_fields]
    if not conditions:
        return query
    return query.where(or_(*conditions))


async def _apply_list_filters(
        model_config: ModelConfig,
        query,
        values: dict[str, str],
        session: AsyncSession,
        user: Any,
):
    if not values:
        return query

    mapper = sa_inspect(model_config.model)
    for list_filter in model_config.list_filters:
        raw_value = values.get(list_filter.slug)
        if raw_value in (None, ""):
            continue

        filter_value = str(raw_value)
        parsed_value = list_filter.value_parser(filter_value) if list_filter.value_parser is not None else filter_value
        option_config = next((item for item in list_filter.options if item.value == filter_value), None)
        filter_handler = option_config.filter_handler if option_config is not None else list_filter.filter_handler
        if filter_handler is not None:
            custom_query = filter_handler(query, parsed_value, session, user)
            query = await custom_query if inspect.isawaitable(custom_query) else custom_query
            continue

        if list_filter.field_name is None:
            continue

        if list_filter.field_name in mapper.relationships:
            relationship = mapper.relationships[list_filter.field_name]
            related_pk_name = relationship.mapper.primary_key[0].key
            related_pk_attr = getattr(relationship.mapper.class_, related_pk_name)
            if relationship.uselist:
                query = query.where(
                    getattr(model_config.model, list_filter.field_name).any(
                        related_pk_attr == _convert_pk(parsed_value),
                    ),
                )
                continue
            local_columns = list(relationship.local_columns)
            if not local_columns:
                continue
            query = query.where(getattr(model_config.model, local_columns[0].key) == _convert_pk(parsed_value))
            continue

        if list_filter.field_name not in mapper.columns:
            continue

        column = mapper.columns[list_filter.field_name]
        column_attr = getattr(model_config.model, list_filter.field_name)
        input_kind = list_filter.input_kind or _resolve_list_filter_input_kind(column, list_filter)
        if input_kind == "boolean":
            query = query.where(column_attr.is_(_parse_boolean_value(parsed_value)))
            continue
        if input_kind == "text":
            query = query.where(column_attr.ilike(f"%{parsed_value}%"))
            continue
        query = query.where(column_attr == convert_value_for_column(column, parsed_value))

    return query


def _apply_eager_loads(model_config: ModelConfig, query):
    mapper = sa_inspect(model_config.model)
    relation_names = set(mapper.relationships.keys())
    relation_fields = [
        field_name
        for field_name in (
            *(model_config.list_display or ()),
            *(model_config.detail_fields or ()),
            *model_config.fields.keys(),
        )
        if field_name in relation_names
    ]
    for field_name in dict.fromkeys(relation_fields):
        query = query.options(selectinload(getattr(model_config.model, field_name)))
    return query


def _resolve_list_filter_input_kind(column: Any, list_filter: Any) -> str:
    if list_filter.options:
        return "select"
    try:
        python_type = column.type.python_type
    except NotImplementedError:
        return "text"
    if python_type is bool:
        return "boolean"
    return "text"


def _resolve_list_filter_input_kind_for_meta(model_config: ModelConfig, list_filter: Any) -> str:
    if list_filter.input_kind is not None:
        return list_filter.input_kind
    if list_filter.options or list_filter.relation_model is not None:
        return "select"
    if list_filter.field_name is None:
        return "text"

    mapper = sa_inspect(model_config.model)
    if list_filter.field_name in mapper.relationships:
        return "select"
    if list_filter.field_name not in mapper.columns:
        return "text"
    return _resolve_list_filter_input_kind(mapper.columns[list_filter.field_name], list_filter)


def _parse_boolean_value(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    normalized_value = str(value).strip().lower()
    return normalized_value in {"1", "true", "yes", "y", "on"}


def _resolve_relation_model(model_config: ModelConfig, field_name: str, *, locale: str | None = None) -> type[Any]:
    configured_model = model_config.get_field_config(field_name).relation_model
    if configured_model is not None:
        return configured_model

    mapper = sa_inspect(model_config.model)
    if field_name in mapper.relationships:
        return mapper.relationships[field_name].mapper.class_
    column = mapper.columns[field_name]
    foreign_key = next(iter(column.foreign_keys), None)
    if foreign_key is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=translate(locale, "field_has_no_relation_choices"),
        )
    remote_table = foreign_key.column.table
    for registry_mapper in mapper.registry.mappers:
        model = registry_mapper.class_
        if getattr(model, "__table__", None) is remote_table:
            return model
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=translate(locale, "related_model_not_found"),
    )


def _resolve_list_filter_relation_model(
        model_config: ModelConfig,
        list_filter: Any,
        *,
        locale: str | None = None,
) -> type[Any] | None:
    if list_filter.relation_model is not None:
        return list_filter.relation_model
    if list_filter.field_name is None:
        return None

    mapper = sa_inspect(model_config.model)
    if list_filter.field_name in mapper.relationships:
        return mapper.relationships[list_filter.field_name].mapper.class_
    if list_filter.field_name in mapper.columns and mapper.columns[list_filter.field_name].foreign_keys:
        return _resolve_relation_model(model_config, list_filter.field_name, locale=locale)
    return None


def _resolve_label_field(model: type[Any]) -> str:
    for candidate in ("name", "title", "username", "slug", "email", "code_name"):
        if hasattr(model, candidate):
            return candidate
    return sa_inspect(model).primary_key[0].key


def _convert_pk(value: Any) -> Any:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return value


async def _assign_relationship_value(
        session: AsyncSession,
        model_config: ModelConfig,
        item: Any,
        field_name: str,
        value: Any,
) -> None:
    mapper = sa_inspect(model_config.model)
    relationship = mapper.relationships[field_name]
    relation_model = _resolve_relation_model(model_config, field_name)
    relation_pk_name = sa_inspect(relation_model).primary_key[0].key

    if relationship.uselist:
        raw_ids = list(value or [])
        if not raw_ids:
            setattr(item, field_name, [])
            return
        normalized_ids = [_convert_pk(str(item_id)) for item_id in raw_ids]
        query = select(relation_model).where(getattr(relation_model, relation_pk_name).in_(normalized_ids))
        related_items = list((await session.execute(query)).scalars())
        setattr(item, field_name, related_items)
        return

    if value in (None, ""):
        setattr(item, field_name, None)
        return

    related_item = await session.get(relation_model, _convert_pk(str(value)))
    setattr(item, field_name, related_item)


async def _get_item_by_pk(
        session: AsyncSession,
        model_config: ModelConfig,
        item_id: str,
) -> Any:
    pk_attr = getattr(model_config.model, get_pk_field_name(model_config))
    query = select(model_config.model).where(pk_attr == _convert_pk(item_id))
    query = _apply_eager_loads(model_config, query)
    return (await session.execute(query)).scalar_one_or_none()


create_admin_router = create_router
