from __future__ import annotations

import inspect
from typing import Any, Literal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect as sa_inspect
from sqlalchemy.orm import selectinload
from xladmin.config import ModelConfig
from xladmin.i18n import translate
from xladmin.introspection import (
    convert_boolean_scalar,
    convert_value_for_column,
    get_pk_field_name,
    get_sort_column_name,
)


def apply_ordering(model_config: ModelConfig, query: Any, sort: str | None = None) -> Any:
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


def apply_search(model_config: ModelConfig, query: Any, q: str | None, session: AsyncSession) -> Any:
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


async def apply_list_filters(
        model_config: ModelConfig,
        query: Any,
        values: dict[str, str],
        session: AsyncSession,
        user: Any,
) -> Any:
    if not values:
        return query

    mapper = sa_inspect(model_config.model)
    for list_filter in model_config.list_filters:
        raw_value = values.get(list_filter.slug)
        if raw_value in (None, ""):
            continue

        filter_value = str(raw_value)
        filter_values = parse_list_filter_values(filter_value, list_filter)
        parsed_filter_values = [
            list_filter.value_parser(item) if list_filter.value_parser is not None else item
            for item in filter_values
        ]
        parsed_value = parsed_filter_values if list_filter_is_multiple(list_filter) else parsed_filter_values[0]
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
                normalized_values = [convert_pk(item) for item in parsed_filter_values]
                if not normalized_values:
                    continue
                query = query.where(
                    getattr(model_config.model, list_filter.field_name).any(
                        related_pk_attr.in_(normalized_values),
                    ),
                )
                continue
            local_columns = list(relationship.local_columns)
            if not local_columns:
                continue
            normalized_values = [convert_pk(item) for item in parsed_filter_values]
            if not normalized_values:
                continue
            local_attr = getattr(model_config.model, local_columns[0].key)
            query = query.where(local_attr.in_(normalized_values))
            continue

        if list_filter.field_name not in mapper.columns:
            continue

        column = mapper.columns[list_filter.field_name]
        column_attr = getattr(model_config.model, list_filter.field_name)
        input_kind = list_filter.input_kind or resolve_list_filter_input_kind(column, list_filter)
        if input_kind == "boolean":
            normalized_values = [convert_boolean_scalar(item) for item in parsed_filter_values]
            query = query.where(column_attr.in_(normalized_values))
            continue
        if input_kind == "text":
            query = query.where(column_attr.ilike(f"%{parsed_value}%"))
            continue
        normalized_values = [convert_value_for_column(column, item) for item in parsed_filter_values]
        query = query.where(column_attr.in_(normalized_values))

    return query


def apply_eager_loads(model_config: ModelConfig, query: Any, *, mode: Literal["list", "detail"]) -> Any:
    mapper = sa_inspect(model_config.model)
    relation_names = set(mapper.relationships.keys())
    configured_fields = (
        tuple(model_config.list_display or ())
        if mode == "list"
        else tuple(dict.fromkeys((*(model_config.detail_fields or ()), *model_config.fields.keys())))
    )
    relation_fields = [field_name for field_name in configured_fields if field_name in relation_names]
    for field_name in dict.fromkeys(relation_fields):
        query = query.options(selectinload(getattr(model_config.model, field_name)))
    return query


def resolve_list_filter_input_kind(column: Any, list_filter: Any) -> str:
    if list_filter.options:
        return "select"
    try:
        python_type = column.type.python_type
    except NotImplementedError:
        return "text"
    if python_type is bool:
        return "boolean"
    return "text"


def resolve_relation_model(model_config: ModelConfig, field_name: str, *, locale: str | None = None) -> type[Any]:
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


def resolve_list_filter_relation_model(
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
        return resolve_relation_model(model_config, list_filter.field_name, locale=locale)
    return None


def resolve_label_field(model: type[Any]) -> str:
    for candidate in ("name", "title", "username", "slug", "email", "code_name"):
        if hasattr(model, candidate):
            return candidate
    return sa_inspect(model).primary_key[0].key


def convert_pk(value: Any) -> Any:
    if isinstance(value, UUID):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        if value.isdigit():
            return int(value)
        try:
            return UUID(value)
        except ValueError:
            return value
    return value


def parse_list_filter_values(value: str, list_filter: Any) -> list[str]:
    if list_filter_is_multiple(list_filter):
        return [item.strip() for item in value.split(",") if item.strip()]
    return [value]


def list_filter_is_multiple(list_filter: Any) -> bool:
    return bool(
        getattr(list_filter, "multiple", False)
        or getattr(list_filter, "input_kind", None) == "select-multiple"
    )


async def apply_scoped_query(query: Any, model_config: ModelConfig, session: AsyncSession, user: Any) -> Any:
    if model_config.query_for_list is None:
        return query
    custom_query = model_config.query_for_list(query, session, user)
    return await custom_query if inspect.isawaitable(custom_query) else custom_query


async def build_model_query(
        session: AsyncSession,
        model_config: ModelConfig,
        user: Any,
        *,
        mode: Literal["list", "detail"],
) -> Any:
    query = select(model_config.model)
    query = await apply_scoped_query(query, model_config, session, user)
    return apply_eager_loads(model_config, query, mode=mode)


async def get_item_by_pk(
        session: AsyncSession,
        model_config: ModelConfig,
        item_id: str,
        user: Any,
        *,
        mode: Literal["list", "detail"] = "detail",
) -> Any:
    pk_attr = getattr(model_config.model, get_pk_field_name(model_config))
    query = await build_model_query(session, model_config, user, mode=mode)
    query = query.where(pk_attr == convert_pk(item_id))
    return (await session.execute(query)).scalars().unique().one_or_none()


async def get_items_by_ids(
        session: AsyncSession,
        model_config: ModelConfig,
        ids: list[Any],
        user: Any,
        *,
        mode: Literal["list", "detail"] = "detail",
) -> list[Any]:
    normalized_ids = [convert_pk(item_id) for item_id in ids]
    if not normalized_ids:
        return []
    pk_attr = getattr(model_config.model, get_pk_field_name(model_config))
    query = await build_model_query(session, model_config, user, mode=mode)
    query = query.where(pk_attr.in_(normalized_ids))
    items = list((await session.execute(query)).scalars().unique())
    items_by_pk = {getattr(item, pk_attr.key): item for item in items}
    return [items_by_pk[item_id] for item_id in normalized_ids if item_id in items_by_pk]


async def count_total_items(session: AsyncSession, model_config: ModelConfig, query: Any) -> int:
    pk_name = get_pk_field_name(model_config)
    query_subquery = query.order_by(None).subquery()
    total_query = select(func.count(func.distinct(getattr(query_subquery.c, pk_name))))
    return int((await session.execute(total_query)).scalar_one())
