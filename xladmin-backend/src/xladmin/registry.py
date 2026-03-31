from __future__ import annotations

import builtins
import re
from dataclasses import replace
from typing import Any

from sqlalchemy import inspect as sa_inspect

from xladmin.config import AdminConfig, ModelConfig, ModelsBlockConfig
from xladmin.i18n import normalize_locale


class Registry:
    """Runtime registry for configured admin models."""

    def __init__(
            self,
            *configs: ModelConfig,
            config: AdminConfig | None = None,
            model_blocks: tuple[ModelsBlockConfig, ...] = (),
    ) -> None:
        self._configs_by_slug: dict[str, ModelConfig] = {}
        self._model_blocks = config.models_blocks if config is not None else model_blocks
        self.locale = normalize_locale(config.locale if config is not None else None)

        combined_configs = list(config.models) if config is not None else []
        combined_configs.extend(configs)
        for model_config in combined_configs:
            self.register(model_config)

    def register(self, config: ModelConfig) -> None:
        normalized_config = normalize_config(config)
        slug = normalized_config.slug
        if slug is None:
            raise ValueError("Model slug must be resolved before registration.")
        if slug in self._configs_by_slug:
            raise ValueError(f"Model slug '{slug}' is already registered.")
        self._configs_by_slug[slug] = normalized_config

    def get(self, slug: str) -> ModelConfig:
        try:
            return self._configs_by_slug[slug]
        except KeyError as exc:
            raise KeyError(f"Admin model '{slug}' is not registered.") from exc

    def find_by_model(self, model: type[Any]) -> ModelConfig | None:
        for config in self._configs_by_slug.values():
            if config.model is model:
                return config
        return None

    def list(self) -> builtins.list[ModelConfig]:
        return list(self._configs_by_slug.values())

    def list_model_blocks(self) -> builtins.list[ModelsBlockConfig]:
        return list(self._model_blocks)

    def resolve_model_blocks(self) -> builtins.list[tuple[ModelsBlockConfig, builtins.list[ModelConfig]]]:
        resolved_blocks: builtins.list[tuple[ModelsBlockConfig, builtins.list[ModelConfig]]] = []
        for block in self._model_blocks:
            block_models: builtins.list[ModelConfig] = []
            references = block.models or block.model_slugs
            for item in references:
                if isinstance(item, str):
                    block_models.append(self.get(item))
                    continue

                model_config = self.find_by_model(item)
                if model_config is None:
                    raise KeyError(f"Admin model for '{item.__name__}' is not registered.")
                block_models.append(model_config)

            resolved_blocks.append((block, block_models))
        return resolved_blocks


def build_registry(registry_or_config: Registry | AdminConfig) -> Registry:
    """Normalize config or registry into a runtime registry."""

    if isinstance(registry_or_config, Registry):
        return registry_or_config
    if isinstance(registry_or_config, AdminConfig):
        return Registry(config=registry_or_config)
    raise TypeError("Admin registry must be Registry or AdminConfig.")


def normalize_config(config: ModelConfig) -> ModelConfig:
    """Fill base defaults for minimal `ModelConfig(model=SomeORM)`."""
    normalized_config = replace(
        config,
        slug=config.slug or get_default_model_slug(config.model),
        title=config.title or get_default_model_title(config.model),
        search_fields=config.search_fields or get_default_search_fields(config.model),
        ordering=config.ordering or get_default_ordering(config.model),
    )
    _validate_model_config(normalized_config)
    return normalized_config


def get_default_model_slug(model: type[Any]) -> str:
    module_parts = model.__module__.split(".")
    try:
        modules_index = module_parts.index("modules")
    except ValueError:
        prefix = "model"
    else:
        try:
            models_index = module_parts.index("models", modules_index + 1)
        except ValueError:
            relevant_parts = module_parts[modules_index + 1:]
        else:
            relevant_parts = module_parts[modules_index + 1:models_index]
        prefix = "-".join(relevant_parts) or "model"

    base_name = to_kebab_case(get_base_model_name(model))
    return f"{prefix}-{base_name}" if prefix != "model" else base_name


def get_default_model_title(model: type[Any]) -> str:
    return to_title_case(to_snake_case(get_base_model_name(model)))


def get_default_search_fields(model: type[Any]) -> tuple[str, ...]:
    table = getattr(model, "__table__", None)
    if table is None:
        return ()

    search_fields: list[str] = []
    for field_name in ("name", "title", "slug", "email", "username", "code"):
        if field_name in table.columns:
            search_fields.append(field_name)
    return tuple(search_fields)


def get_default_ordering(model: type[Any]) -> tuple[str, ...]:
    table = getattr(model, "__table__", None)
    if table is None:
        return ()

    for field_name in ("created_at", "updated_at", "date_joined", "id"):
        if field_name in table.columns:
            return (f"-{field_name}",)
    return ()


def get_base_model_name(model: type[Any]) -> str:
    if model.__name__.endswith("ORM"):
        return model.__name__[:-3]
    return model.__name__


def to_snake_case(value: str) -> str:
    normalized_value = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", value)
    normalized_value = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", normalized_value)
    return normalized_value.lower()


def to_kebab_case(value: str) -> str:
    return to_snake_case(value).replace("_", "-")


def to_title_case(value: str) -> str:
    return value.replace("_", " ").strip().title()


def _validate_model_config(config: ModelConfig) -> None:
    mapper = sa_inspect(config.model)
    mapper_field_names = set(mapper.attrs.keys())
    configured_field_names = mapper_field_names | set(config.fields)

    for group_name, field_names in (
        ("list_display", config.list_display),
        ("list_fields", config.list_fields),
        ("detail_fields", config.detail_fields),
        ("create_fields", config.create_fields),
        ("update_fields", config.update_fields),
    ):
        if field_names is None:
            continue
        for field_name in field_names:
            if field_name not in configured_field_names:
                raise ValueError(f"Unknown field '{field_name}' in {group_name} for model '{config.model.__name__}'.")

    for list_filter in config.list_filters:
        if list_filter.field_name is None:
            continue
        if list_filter.field_name not in mapper_field_names and list_filter.field_name not in config.fields:
            raise ValueError(
                f"Unknown field '{list_filter.field_name}' in list filter '{list_filter.slug}' "
                f"for model '{config.model.__name__}'.",
            )

    sortable_field_names = configured_field_names
    for field_name in config.ordering:
        normalized_field_name = field_name[1:] if field_name.startswith("-") else field_name
        if normalized_field_name not in sortable_field_names:
            raise ValueError(
                f"Unknown field '{normalized_field_name}' in ordering for model '{config.model.__name__}'.",
            )


AdminRegistry = Registry
build_admin_registry = build_registry
normalize_model_config = normalize_config
