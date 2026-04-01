from __future__ import annotations

import inspect
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect as sa_inspect

from xladmin.config import HttpConfig, ModelConfig
from xladmin.delete_preview import build_delete_plan, build_delete_preview
from xladmin.i18n import translate
from xladmin.introspection import get_list_filter_input_kind, get_model_blocks_meta, get_model_meta
from xladmin.registry import build_registry
from xladmin.router_mutations import apply_payload_to_item
from xladmin.router_queries import (
    apply_list_filters,
    apply_ordering,
    apply_scoped_query,
    apply_search,
    build_model_query,
    convert_pk,
    count_total_items,
    get_item_by_pk,
    get_items_by_ids,
    resolve_label_field,
    resolve_list_filter_relation_model,
    resolve_relation_model,
)
from xladmin.router_schemas import (
    BulkActionPayload,
    ChoiceItemPayload,
    ChoicesResponse,
    DeletePreviewResponse,
    DeleteResultResponse,
    DetailResponse,
    FlexibleProcessedResponse,
    IdsPayload,
    ItemOnlyResponse,
    ItemPayload,
    ListResponse,
    ModelResponse,
    ModelsResponse,
    ObjectActionResponse,
    PaginationPayload,
)
from xladmin.serializer import serialize_model_instance


def create_router(config: HttpConfig) -> APIRouter:
    registry = build_registry(config.registry)
    router = APIRouter(prefix="/xladmin", tags=["XLAdmin"])
    model_meta_by_slug = {
        model_config.slug: get_model_meta(model_config, locale=registry.locale)
        for model_config in registry.list()
    }
    models_response = ModelsResponse(
        locale=registry.locale,
        items=list(model_meta_by_slug.values()),
        blocks=get_model_blocks_meta(registry),
    )

    def check_access(user: Any) -> None:
        if not config.is_allowed(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=translate(registry.locale, "forbidden"))

    async def get_model_config(slug: str) -> ModelConfig:
        try:
            return registry.get(slug)
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=translate(registry.locale, "admin_model_not_found"),
            ) from exc

    async def get_existing_item(
            slug: str,
            item_id: str,
            session: AsyncSession,
            user: Any,
    ) -> tuple[ModelConfig, Any]:
        model_config = await get_model_config(slug)
        item = await get_item_by_pk(session, model_config, item_id, user, mode="detail")
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=translate(registry.locale, "object_not_found"),
            )
        return model_config, item

    async def execute_delete_plan(
            model_config: ModelConfig,
            items: list[Any],
            session: AsyncSession,
    ) -> int:
        preview, delete_items, set_null_items = await build_delete_plan(session, registry, model_config, items)
        if not preview["can_delete"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=translate(registry.locale, "delete_blocked"),
            )
        for related_item, attribute_names in set_null_items:
            for attribute_name in attribute_names:
                setattr(related_item, attribute_name, None)
        for item_to_delete in delete_items:
            await session.delete(item_to_delete)
        await session.commit()
        return len(items)

    @router.get("/models/", response_model=ModelsResponse)
    async def list_models(user: Any = Depends(config.get_current_user_dependency)) -> ModelsResponse:
        check_access(user)
        return models_response

    @router.get("/models/{slug}/", response_model=ModelResponse)
    async def get_model(
            slug: str,
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        check_access(user)
        try:
            return model_meta_by_slug[slug]
        except KeyError:
            await get_model_config(slug)
            raise

    @router.get("/models/{slug}/items/", response_model=ListResponse)
    async def list_items(
            slug: str,
            request: Request,
            limit: int = Query(default=50, ge=1, le=500),
            offset: int = Query(default=0, ge=0),
            q: str | None = None,
            sort: str | None = None,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> ListResponse:
        check_access(user)
        model_config = await get_model_config(slug)
        list_filter_values = {
            list_filter.slug: str(raw_value)
            for list_filter in model_config.list_filters
            if (raw_value := request.query_params.get(list_filter.slug)) not in (None, "")
        }
        query = await build_model_query(session, model_config, user, mode="list")
        query = apply_search(model_config, query, q, session)
        query = await apply_list_filters(model_config, query, list_filter_values, session, user)
        query = apply_ordering(model_config, query, sort)
        total = await count_total_items(session, model_config, query)
        items = list((await session.execute(query.limit(limit).offset(offset))).scalars().unique())
        return ListResponse(
            meta=model_meta_by_slug[model_config.slug],
            pagination=PaginationPayload(limit=limit, offset=offset, total=total),
            items=[serialize_model_instance(model_config, item, mode="list") for item in items],
        )

    @router.get("/models/{slug}/items/{item_id}/", response_model=DetailResponse)
    async def get_item(
            slug: str,
            item_id: str,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> DetailResponse:
        check_access(user)
        model_config, item = await get_existing_item(slug, item_id, session, user)
        return DetailResponse(
            meta=model_meta_by_slug[model_config.slug],
            item=serialize_model_instance(model_config, item, mode="detail"),
        )

    @router.post("/models/{slug}/items/", status_code=status.HTTP_201_CREATED, response_model=ItemOnlyResponse)
    async def create_item(
            slug: str,
            payload: ItemPayload,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> ItemOnlyResponse:
        check_access(user)
        model_config = await get_model_config(slug)
        item = model_config.model()
        await apply_payload_to_item(session, model_config, item, payload.root, mode="create")
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return ItemOnlyResponse(item=serialize_model_instance(model_config, item, mode="detail"))

    @router.patch("/models/{slug}/items/{item_id}/", response_model=ItemOnlyResponse)
    async def patch_item(
            slug: str,
            item_id: str,
            payload: ItemPayload,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> ItemOnlyResponse:
        check_access(user)
        model_config, item = await get_existing_item(slug, item_id, session, user)
        await apply_payload_to_item(session, model_config, item, payload.root, mode="update")
        await session.commit()
        await session.refresh(item)
        refreshed_item = await get_item_by_pk(session, model_config, item_id, user, mode="detail")
        return ItemOnlyResponse(
            item=serialize_model_instance(model_config, refreshed_item or item, mode="detail"),
        )

    @router.get("/models/{slug}/items/{item_id}/delete-preview/", response_model=DeletePreviewResponse)
    async def get_delete_preview(
            slug: str,
            item_id: str,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        check_access(user)
        model_config, item = await get_existing_item(slug, item_id, session, user)
        return await build_delete_preview(session, registry, model_config, [item])

    @router.delete("/models/{slug}/items/{item_id}/", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_item(
            slug: str,
            item_id: str,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> Response:
        check_access(user)
        model_config, item = await get_existing_item(slug, item_id, session, user)
        await execute_delete_plan(model_config, [item], session)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.post(
        "/models/{slug}/items/{item_id}/actions/{action_slug}/",
        response_model=ObjectActionResponse,
    )
    async def object_action(
            slug: str,
            item_id: str,
            action_slug: str,
            payload: ItemPayload | None = None,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> ObjectActionResponse:
        check_access(user)
        model_config, item = await get_existing_item(slug, item_id, session, user)

        action = next((item for item in model_config.object_actions if item.slug == action_slug), None)
        if action is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=translate(registry.locale, "object_action_not_found"),
            )

        result = action.handler(session, model_config, item, payload.root if payload is not None else {}, user)
        if inspect.isawaitable(result):
            result = await result
        await session.commit()
        await session.refresh(item)
        refreshed_item = await get_item_by_pk(session, model_config, item_id, user, mode="detail")
        return ObjectActionResponse(
            item=serialize_model_instance(model_config, refreshed_item or item, mode="detail"),
            result=result or {},
        )

    @router.post("/models/{slug}/bulk-delete/", response_model=DeleteResultResponse)
    async def bulk_delete(
            slug: str,
            payload: IdsPayload,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> DeleteResultResponse:
        check_access(user)
        model_config = await get_model_config(slug)
        if not payload.ids:
            return DeleteResultResponse(deleted=0)
        items = await get_items_by_ids(session, model_config, payload.ids, user, mode="detail")
        deleted = await execute_delete_plan(model_config, items, session)
        return DeleteResultResponse(deleted=deleted)

    @router.post("/models/{slug}/bulk-delete-preview/", response_model=DeletePreviewResponse)
    async def bulk_delete_preview(
            slug: str,
            payload: IdsPayload,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> dict[str, Any]:
        check_access(user)
        model_config = await get_model_config(slug)
        if not payload.ids:
            return {
                "can_delete": True,
                "summary": {"roots": 0, "delete": 0, "protect": 0, "set_null": 0, "total": 0},
                "roots": [],
            }
        items = await get_items_by_ids(session, model_config, payload.ids, user, mode="detail")
        return await build_delete_preview(session, registry, model_config, items)

    @router.post("/models/{slug}/bulk-actions/{action_slug}/", response_model=FlexibleProcessedResponse)
    async def bulk_action(
            slug: str,
            action_slug: str,
            payload: BulkActionPayload,
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> FlexibleProcessedResponse:
        check_access(user)
        model_config = await get_model_config(slug)
        if not payload.ids:
            return FlexibleProcessedResponse(processed=0)
        if action_slug == "delete":
            deleted_response = await bulk_delete(slug, IdsPayload(ids=list(payload.ids)), session, user)
            return FlexibleProcessedResponse(processed=deleted_response.deleted)

        action = next((item for item in model_config.bulk_actions if item.slug == action_slug), None)
        if action is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=translate(registry.locale, "bulk_action_not_found"),
            )

        items = await get_items_by_ids(session, model_config, list(payload.ids), user, mode="detail")
        result = action.handler(session, model_config, items, payload.action_payload, user)
        if inspect.isawaitable(result):
            result = await result
        await session.commit()
        response_payload = {"processed": len(items)}
        if result:
            response_payload.update(result)
        return FlexibleProcessedResponse.model_validate(response_payload)

    @router.get("/models/{slug}/fields/{field_name}/choices/", response_model=ChoicesResponse)
    async def field_choices(
            slug: str,
            field_name: str,
            q: str | None = None,
            ids: str | None = None,
            limit: int = Query(default=25, ge=1, le=100),
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> ChoicesResponse:
        check_access(user)
        model_config = await get_model_config(slug)
        relation_model = resolve_relation_model(model_config, field_name, locale=registry.locale)
        relation_config = registry.find_by_model(relation_model)
        label_field = (
                model_config.get_field_config(field_name).relation_label_field
                or resolve_label_field(relation_model)
        )
        return await load_relation_choices(
            session=session,
            relation_model=relation_model,
            relation_config=relation_config,
            label_field=label_field,
            q=q,
            ids=ids,
            limit=limit,
            user=user,
        )

    @router.get("/models/{slug}/filters/{filter_slug}/choices/", response_model=ChoicesResponse)
    async def filter_choices(
            slug: str,
            filter_slug: str,
            q: str | None = None,
            ids: str | None = None,
            limit: int = Query(default=25, ge=1, le=100),
            session: AsyncSession = Depends(config.get_db_session_dependency),
            user: Any = Depends(config.get_current_user_dependency),
    ) -> ChoicesResponse:
        check_access(user)
        model_config = await get_model_config(slug)
        list_filter = next((item for item in model_config.list_filters if item.slug == filter_slug), None)
        if list_filter is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=translate(registry.locale, "list_filter_not_found"),
            )

        input_kind = get_list_filter_input_kind(model_config, list_filter)
        if input_kind == "boolean":
            return ChoicesResponse(
                items=[
                    ChoiceItemPayload(id="true", label=translate(registry.locale, "yes")),
                    ChoiceItemPayload(id="false", label=translate(registry.locale, "no")),
                ],
            )
        if list_filter.options:
            return ChoicesResponse(
                items=[
                    ChoiceItemPayload(id=option.value, label=option.label)
                    for option in list_filter.options
                ],
            )

        relation_model = resolve_list_filter_relation_model(model_config, list_filter, locale=registry.locale)
        if relation_model is None:
            return ChoicesResponse(items=[])

        relation_config = registry.find_by_model(relation_model)
        label_field = list_filter.relation_label_field or resolve_label_field(relation_model)
        return await load_relation_choices(
            session=session,
            relation_model=relation_model,
            relation_config=relation_config,
            label_field=label_field,
            q=q,
            ids=ids,
            limit=limit,
            user=user,
        )

    return router


async def load_relation_choices(
        *,
        session: AsyncSession,
        relation_model: type[Any],
        relation_config: ModelConfig | None,
        label_field: str,
        q: str | None,
        ids: str | None,
        limit: int,
        user: Any,
) -> ChoicesResponse:
    relation_pk_name = sa_inspect(relation_model).primary_key[0].key
    relation_pk_attr = getattr(relation_model, relation_pk_name)
    selected_ids = [convert_pk(item_id) for item_id in ids.split(",") if item_id] if ids else []
    base_query = select(relation_model)
    if relation_config is not None:
        base_query = await apply_scoped_query(base_query, relation_config, session, user)

    selected_items = await fetch_choice_items(
        session=session,
        query=base_query.where(relation_pk_attr.in_(selected_ids)) if selected_ids else None,
    )
    search_query = base_query
    if q:
        if relation_config is not None:
            search_query = apply_search(relation_config, search_query, q, session)
        elif hasattr(relation_model, label_field):
            search_query = search_query.where(getattr(relation_model, label_field).ilike(f"%{q}%"))
    if selected_ids:
        search_query = search_query.where(~relation_pk_attr.in_(selected_ids))
    if hasattr(relation_model, label_field):
        search_query = search_query.order_by(getattr(relation_model, label_field).asc())
    search_items = await fetch_choice_items(
        session=session,
        query=search_query.limit(max(limit - len(selected_items), 0)),
    )
    return ChoicesResponse(
        items=[
            ChoiceItemPayload(
                id=getattr(item, relation_pk_name),
                label=str(getattr(item, label_field, None) or getattr(item, relation_pk_name)),
            )
            for item in [*selected_items, *search_items]
        ],
    )


async def fetch_choice_items(session: AsyncSession, query: Any | None) -> list[Any]:
    if query is None:
        return []
    return list((await session.execute(query)).scalars().unique())


create_admin_router = create_router
