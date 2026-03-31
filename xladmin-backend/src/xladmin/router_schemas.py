from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, RootModel


class ItemPayload(RootModel[dict[str, Any]]):
    pass


class IdsPayload(BaseModel):
    ids: list[Any] = Field(default_factory=list)


class BulkActionPayload(BaseModel):
    ids: list[Any] = Field(default_factory=list)
    model_config = ConfigDict(extra="allow")

    @property
    def action_payload(self) -> dict[str, Any]:
        return {
            key: value
            for key, value in self.model_dump().items()
            if key != "ids"
        }


class PaginationPayload(BaseModel):
    limit: int
    offset: int
    total: int


class ChoiceItemPayload(BaseModel):
    id: str | int
    label: str


class ChoicesResponse(BaseModel):
    items: list[ChoiceItemPayload]


class ModelsResponse(BaseModel):
    locale: str
    items: list[dict[str, Any]]
    blocks: list[dict[str, Any]]


class ModelResponse(RootModel[dict[str, Any]]):
    pass


class ListResponse(BaseModel):
    meta: dict[str, Any]
    pagination: PaginationPayload
    items: list[dict[str, Any]]


class DetailResponse(BaseModel):
    meta: dict[str, Any]
    item: dict[str, Any]


class ItemOnlyResponse(BaseModel):
    item: dict[str, Any]


class DeleteCountsPayload(BaseModel):
    roots: int
    delete: int
    protect: int
    set_null: int
    total: int


class DeletePreviewNodePayload(BaseModel):
    model_slug: str | None
    model_title: str
    relation_name: str | None
    id: str | int
    label: str
    effect: str
    children: list[DeletePreviewNodePayload]


DeletePreviewNodePayload.model_rebuild()


class DeletePreviewResponse(BaseModel):
    can_delete: bool
    summary: DeleteCountsPayload
    roots: list[DeletePreviewNodePayload]


class DeleteResultResponse(BaseModel):
    deleted: int


class ProcessedResponse(BaseModel):
    processed: int


class FlexibleProcessedResponse(BaseModel):
    processed: int
    model_config = ConfigDict(extra="allow")


class ObjectActionResponse(BaseModel):
    item: dict[str, Any]
    result: dict[str, Any]
