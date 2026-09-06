"""Scoped lookup shared by scalar foreign keys and relationship assignments."""

from typing import Any

from sqlalchemy import inspect, select
from sqlalchemy.ext.asyncio import AsyncSession

from xladmin.registry import Registry
from xladmin.router_queries import apply_scoped_query, convert_pk


class RelationWriteAccess:
    @staticmethod
    async def items(session: AsyncSession, registry: Registry, model: type[Any], ids: list[Any], user: Any) -> list[Any]:
        """Resolve all requested IDs inside the target model's scope, without identity-map shortcuts."""
        normalized_ids = list(dict.fromkeys(convert_pk(value) for value in ids))
        if not normalized_ids:
            return []
        pk = inspect(model).primary_key[0].key
        query = select(model).where(getattr(model, pk).in_(normalized_ids))
        config = registry.find_by_model(model)
        with session.no_autoflush:
            if config is not None:
                query = await apply_scoped_query(query, config, session, user)
            items = list((await session.execute(query)).scalars().unique())
        by_id = {getattr(item, pk): item for item in items}
        if set(by_id) != set(normalized_ids):
            raise ValueError("Unknown or unavailable related ID.")
        return [by_id[value] for value in normalized_ids]
